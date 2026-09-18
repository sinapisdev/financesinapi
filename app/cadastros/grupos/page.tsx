import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import Lista from './Lista';

export const dynamic = 'force-dynamic';

export default async function Grupos() {
  await exigirEmpresa();

  const [grupos, contas, ramos] = await Promise.all([
    q(`select g.id, g.codigo, g.nome, g.tipo, g.controle, g.ativo, g.observacao,
              g.conta_estoque_id, g.conta_receita_id, g.conta_custo_id,
              coalesce((select array_agg(gr.ramo order by gr.ramo)
                          from item_grupo_ramo gr where gr.grupo_id = g.id), '{}') as ramos,
              (select string_agg(r.nome, ', ' order by r.ordem)
                 from item_grupo_ramo gr join ramo r on r.codigo = gr.ramo
                where gr.grupo_id = g.id) as ramos_nome,
              ce.codigo || ' ' || ce.descricao as conta_estoque,
              cr.codigo || ' ' || cr.descricao as conta_receita,
              cs.codigo || ' ' || cs.descricao as conta_custo,
              (select count(*) from item i where i.grupo_id = g.id)::int as itens
         from item_grupo g
         left join plano_conta ce on ce.id = g.conta_estoque_id
         left join plano_conta cr on cr.id = g.conta_receita_id
         left join plano_conta cs on cs.id = g.conta_custo_id
        order by g.tipo, g.nome`),
    q(`select id, codigo, descricao from plano_conta
        where aceita_lancamento and ativo order by codigo`),
    q(`select codigo, nome from ramo order by ordem`),
  ]);

  const semConta = grupos.filter((g: any) => g.controle !== 'nenhum' && !g.conta_estoque).length;

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>Grupos de item</h1>
        <p className="sub">
          {grupos.length} grupos · definem como cada tipo de item é controlado e em que
          contas ele entra
        </p>
      </div>

      {semConta > 0 && (
        <div className="aviso">
          <strong>{semConta} {semConta === 1 ? 'grupo' : 'grupos'} sem conta de estoque.</strong>{' '}
          O plano de contas hoje só tem <em>1.1.3.01 materiais de construção</em> e{' '}
          <em>1.1.3.02 imóveis concluídos</em> — falta conta para mercadoria de revenda e para
          receita de serviços. Ficou para a reestruturação contábil; até lá, esses grupos
          funcionam no estoque mas não geram partida.
        </div>
      )}

      <Lista grupos={grupos as any} contas={contas as any} ramos={ramos as any} />
    </main>
  );
}
