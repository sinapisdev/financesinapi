import { q } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';
import FormEntrada from './FormEntrada';

export const dynamic = 'force-dynamic';

export default async function EntradaEstoque() {
  const ctx = await exigirEmpresa('estoque');

  const [grupos, empresas, centros, pessoas, itens] = await Promise.all([
    // só grupos que estocam: não faz sentido dar entrada em serviço
    q(`select g.id, g.nome, g.controle from item_grupo g
        where g.ativo and g.controle <> 'nenhum'
          and (not exists (select 1 from item_grupo_ramo gr where gr.grupo_id = g.id)
               or exists (select 1 from item_grupo_ramo gr join empresa e on e.ramo = gr.ramo
                           where gr.grupo_id = g.id and e.ativo
                             and ($1::bigint is null or e.id = $1)))
        order by g.controle desc, g.nome`, [ctx.id]),
    q(`select id, razao_social from empresa where ativo
        and ($1::bigint is null or id = $1) order by codigo`, [ctx.id]),
    q(`select id, nome from centro_custo where status <> 'cancelada'
        and ($1::bigint is null or empresa_id = $1) order by nome`, [ctx.id]),
    q(`select id, nome_razao_social from pessoa where ativo and eh_fornecedor
        order by nome_razao_social limit 2000`),
    q(`select id, identificacao, codigo, codigo_barras, grupo_id,
              preco_venda::float8 as preco_venda
         from item where ativo and ($1::bigint is null or empresa_id = $1)
        order by identificacao limit 5000`, [ctx.id]),
  ]);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Estoque</div>
        <h1>Entrada de mercadoria</h1>
        <p className="sub">
          {ctx.todas ? 'Escolha a empresa abaixo' : nomeCurto(ctx.nome)} · dá entrada numa
          nota inteira de uma vez, cadastrando na hora o que ainda não existe
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="vazio">
          Nenhum grupo que estoque para esta empresa.{' '}
          <a className="link-acao" href="/cadastros/grupos">Criar um grupo</a>
        </div>
      ) : (
        <FormEntrada empresas={empresas.map((e: any) => ({ id: e.id, nome: nomeCurto(e.razao_social) }))}
                     grupos={grupos as any} centros={centros as any}
                     pessoas={pessoas.map((p: any) => ({ id: p.id, nome: p.nome_razao_social }))}
                     itens={itens as any}
                     hoje={new Date().toISOString().slice(0, 10)} />
      )}
    </main>
  );
}
