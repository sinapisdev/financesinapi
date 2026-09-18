import { q } from '@/lib/db';
import Formulario from './Formulario';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';

export default async function NovoLancamento() {
  const ctx = await exigirEmpresa('movimento');
  const [empresas, centros, processos, pessoas, contas, planoContas] = await Promise.all([
    q(`select id, razao_social as nome from empresa where ativo
        and ($1::bigint is null or id = $1) order by codigo`, [ctx.id]),
    q(`select id, nome from centro_custo
        where ($1::bigint is null or empresa_id = $1) order by tipo, nome`, [ctx.id]),
    // cada processo carrega as contas que usa; quando são sintéticas,
    // quem lança precisa escolher a analítica de verdade
    q(`select p.id, p.codigo, p.nome, p.tipo,
              cd.codigo as debito_codigo, cd.descricao as debito_nome,
              coalesce(cd.aceita_lancamento, true) as debito_analitica,
              cc.codigo as credito_codigo, cc.descricao as credito_nome,
              coalesce(cc.aceita_lancamento, true) as credito_analitica
         from processo p
         left join plano_conta cd on cd.id = p.conta_debito_id
         left join plano_conta cc on cc.id = p.conta_credito_id
        where p.ativo and (
          -- processo sem ramo declarado serve a qualquer empresa; com ramo,
          -- só aparece para quem é daquele ramo. É o que impede "CUSTOS OBRA"
          -- de aparecer numa loja e "CMV" de aparecer numa SPE.
          not exists (select 1 from processo_ramo pr where pr.processo_id = p.id)
          or exists (select 1 from processo_ramo pr join empresa e on e.ramo = pr.ramo
                      where pr.processo_id = p.id and e.ativo
                        and ($1::bigint is null or e.id = $1)))
        order by p.codigo`, [ctx.id]),
    q(`select id, nome_razao_social as nome, eh_cliente, eh_fornecedor
         from pessoa where ativo order by nome_razao_social`),
    q(`select id, apelido as nome, empresa_id from conta_bancaria where ativo
        and ($1::bigint is null or empresa_id = $1) order by empresa_id, apelido`, [ctx.id]),
    q(`select id, codigo, descricao from plano_conta
        where aceita_lancamento and ativo order by codigo`),
  ]);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Movimento</div>
        <h1>Novo lançamento</h1>
        <p className="sub">
          {ctx.todas
            ? 'Nenhuma empresa selecionada — escolha a empresa do lançamento abaixo.'
            : nomeCurto(ctx.nome) + '. As parcelas são conferidas antes de gravar: o banco recusa lançamento cujas parcelas não somam o valor total.'}
        </p>
      </div>
      <Formulario empresas={empresas as any} centros={centros as any} processos={processos as any}
                  pessoas={pessoas as any} contas={contas as any} planoContas={planoContas as any}
                  empresaFixa={ctx.todas ? null : ctx.id} />
    </main>
  );
}
