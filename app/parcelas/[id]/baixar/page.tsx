import { q, brl, dataBR } from '@/lib/db';
import { notFound } from 'next/navigation';
import FormBaixa from './FormBaixa';
import { exigirEmpresa } from '@/lib/empresa';

export const dynamic = 'force-dynamic';

export default async function Baixar({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ voltar?: string }>;
}) {
  await exigirEmpresa('contas');
  const { id } = await params;
  const { voltar } = await searchParams;
  const parcelaId = Number(id);
  if (!parcelaId) notFound();

  const [linhas] = await Promise.all([
    q(`select p.id, p.numero, p.tipo, p.categoria, p.data_vencimento::text as vencimento,
              p.valor_original::float8 as original, p.valor_baixado::float8 as baixado,
              (p.valor_original - p.valor_baixado)::float8 as saldo, p.status,
              l.id as lancamento_id, l.numero as lancamento, l.descricao, l.empresa_id,
              l.status as lanc_status, e.razao_social as empresa,
              pe.nome_razao_social as pessoa, cc.nome as centro_custo,
              (current_date - p.data_vencimento) as dias
         from parcela p
         join lancamento l on l.id = p.lancamento_id
         join empresa e on e.id = l.empresa_id
         left join pessoa pe on pe.id = p.pessoa_id
         left join centro_custo cc on cc.id = l.centro_custo_id
        where p.id = $1`, [parcelaId]),
  ]);
  const parcela = linhas[0];
  if (!parcela) notFound();

  const [contas, formas] = await Promise.all([
    q(`select id, apelido as nome from conta_bancaria
        where ativo and empresa_id = $1 order by apelido`, [parcela.empresa_id]),
    q(`select id, nome from forma_pagamento where ativo order by codigo`),
  ]);

  const voltarPara = voltar || (parcela.tipo === 'receber' ? '/receber' : '/pagar');
  const bloqueada = parcela.status === 'cancelada' || parcela.lanc_status === 'cancelado' || parcela.saldo <= 0;

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">{parcela.tipo === 'receber' ? 'Contas a receber' : 'Contas a pagar'}</div>
        <h1>Dar baixa — parcela {parcela.numero}</h1>
        <p className="sub">
          <a href={`/lancamentos/${parcela.lancamento_id}`}>{parcela.lancamento}</a> · {parcela.descricao}
          {parcela.pessoa && ` · ${parcela.pessoa}`}
        </p>
      </div>

      <section className="cards">
        <div className="card destaque-navy">
          <div className="rotulo">Saldo em aberto</div>
          <div className="valor tabular">{brl(parcela.saldo)}</div>
          <div className="nota">de {brl(parcela.original)}</div>
        </div>
        <div className="card">
          <div className="rotulo">Vencimento</div>
          <div className="valor tabular" style={{ fontSize: 21 }}>{dataBR(parcela.vencimento)}</div>
          <div className="nota">
            {parcela.dias > 0 ? `${parcela.dias} dias em atraso`
              : parcela.dias === 0 ? 'vence hoje' : `vence em ${-parcela.dias} dias`}
          </div>
        </div>
        <div className="card">
          <div className="rotulo">Empresa</div>
          <div className="valor" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
            {parcela.empresa}
          </div>
          <div className="nota">{parcela.centro_custo ?? 'sem centro de custo'}</div>
        </div>
      </section>

      {bloqueada ? (
        <div className="aviso">
          {parcela.saldo <= 0 ? 'Esta parcela já está liquidada.'
            : 'Esta parcela está cancelada e não pode receber baixa.'}
          {' '}<a href={voltarPara}>Voltar</a>
        </div>
      ) : (
        <FormBaixa parcela={parcela} contas={contas as any} formas={formas as any} voltarPara={voltarPara} />
      )}
    </main>
  );
}
