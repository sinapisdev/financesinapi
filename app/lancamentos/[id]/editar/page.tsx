import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { notFound } from 'next/navigation';
import Formulario from './Formulario';

export const dynamic = 'force-dynamic';

export default async function EditarLancamento({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigirEmpresa();
  const { id } = await params;
  const lancId = Number(id);
  if (!lancId) notFound();

  const [linhas, parcelas, centros, processos, pessoas, planoContas] = await Promise.all([
    q(`select l.*, l.valor_total::float8 as valor, l.data_competencia::text as competencia,
              (select count(*) from parcela p join baixa b on b.parcela_id = p.id
                where p.lancamento_id = l.id and b.estornada_em is null)::int as baixas
         from lancamento l where l.id = $1`, [lancId]),
    q(`select id, numero, categoria, data_vencimento::text as vencimento,
              valor_original::float8 as valor, status
         from parcela where lancamento_id = $1 order by numero`, [lancId]),
    q(`select id, nome from centro_custo
        where ($1::bigint is null or empresa_id = $1) order by tipo, nome`, [ctx.id]),
    q(`select p.id, p.codigo, p.nome,
              cd.codigo as debito_codigo, cd.descricao as debito_nome,
              coalesce(cd.aceita_lancamento, true) as debito_analitica,
              cc.codigo as credito_codigo, cc.descricao as credito_nome,
              coalesce(cc.aceita_lancamento, true) as credito_analitica
         from processo p
         left join plano_conta cd on cd.id = p.conta_debito_id
         left join plano_conta cc on cc.id = p.conta_credito_id
        where p.ativo and (
          not exists (select 1 from processo_ramo pr where pr.processo_id = p.id)
          or exists (select 1 from processo_ramo pr join empresa e on e.ramo = pr.ramo
                      join lancamento l on l.empresa_id = e.id
                     where pr.processo_id = p.id and l.id = $1)
          -- o processo que o lançamento já usa continua na lista mesmo que o
          -- ramo tenha mudado depois; senão editar outra coisa o apagaria
          or p.id = (select processo_id from lancamento where id = $1))
        order by p.codigo`, [lancId]),
    q(`select id, nome_razao_social as nome, eh_cliente, eh_fornecedor
         from pessoa where ativo order by nome_razao_social`),
    q(`select id, codigo, descricao from plano_conta where aceita_lancamento and ativo order by codigo`),
  ]);

  const lanc = linhas[0];
  if (!lanc) notFound();
  if (lanc.status === 'cancelado') {
    return (
      <main>
        <div className="cabecalho-pagina">
          <div className="eyebrow">Movimento</div>
          <h1>Lançamento cancelado</h1>
        </div>
        <div className="aviso">
          Este lançamento está cancelado e não pode ser editado.{' '}
          <a href={`/lancamentos/${lancId}`}>Voltar ao lançamento</a>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">{lanc.tipo === 'receita' ? 'Receita' : 'Despesa'} · {lanc.numero}</div>
        <h1>Editar lançamento</h1>
        <p className="sub">
          Classificação pode mudar sempre. O valor só muda enquanto não houver baixa.
        </p>
      </div>
      <Formulario lanc={lanc} parcelas={parcelas as any} centros={centros as any}
                  processos={processos as any} pessoas={pessoas as any}
                  planoContas={planoContas as any} baixas={lanc.baixas} />
    </main>
  );
}
