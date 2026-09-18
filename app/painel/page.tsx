import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';
import GraficoMensal from '@/app/_componentes/GraficoMensal';

export const dynamic = 'force-dynamic';

export default async function Painel() {
  const ctx = await exigirEmpresa();
  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = hoje.slice(0, 7);

  const [[caixa], [receber], [pagar], [mes], evolucao, vencendo, aging, centros] = await Promise.all([
    q(`select coalesce(sum(valor_com_sinal), 0)::float8 as saldo
         from movimento_caixa where ($1::bigint is null or empresa_id = $1)`, [ctx.id]),
    q(`select coalesce(sum(p.valor_original - p.valor_baixado), 0)::float8 as aberto,
              coalesce(sum(p.valor_original - p.valor_baixado)
                       filter (where p.data_vencimento < current_date), 0)::float8 as vencido,
              count(*) filter (where p.data_vencimento < current_date)::int as qtd_vencida
         from parcela p join lancamento l on l.id = p.lancamento_id
        where p.tipo = 'receber' and p.status in ('aberta','parcial')
          and ($1::bigint is null or l.empresa_id = $1)`, [ctx.id]),
    q(`select coalesce(sum(p.valor_original - p.valor_baixado), 0)::float8 as aberto,
              coalesce(sum(p.valor_original - p.valor_baixado)
                       filter (where p.data_vencimento < current_date), 0)::float8 as vencido,
              count(*) filter (where p.data_vencimento < current_date)::int as qtd_vencida
         from parcela p join lancamento l on l.id = p.lancamento_id
        where p.tipo = 'pagar' and p.status in ('aberta','parcial')
          and ($1::bigint is null or l.empresa_id = $1)`, [ctx.id]),
    q(`select coalesce(sum(valor_liquido) filter (where sentido = 'entrada'), 0)::float8 as entradas,
              coalesce(sum(valor_liquido) filter (where sentido = 'saida'), 0)::float8 as saidas
         from movimento_caixa
        where to_char(data, 'YYYY-MM') = $2 and ($1::bigint is null or empresa_id = $1)`,
      [ctx.id, mesAtual]),
    q(`select to_char(data, 'YYYY-MM') as mes,
              coalesce(sum(valor_liquido) filter (where sentido = 'entrada'), 0)::float8 as entradas,
              coalesce(sum(valor_liquido) filter (where sentido = 'saida'), 0)::float8 as saidas
         from movimento_caixa
        where data >= (date_trunc('month', current_date) - interval '11 months')
          and data < (date_trunc('month', current_date) + interval '1 month')
          and ($1::bigint is null or empresa_id = $1)
        group by 1 order by 1`, [ctx.id]),
    q(`select p.id, p.tipo, p.data_vencimento::text as vencimento,
              (p.valor_original - p.valor_baixado)::float8 as saldo,
              l.descricao, pe.nome_razao_social as pessoa, l.id as lancamento_id
         from parcela p
         join lancamento l on l.id = p.lancamento_id
         left join pessoa pe on pe.id = p.pessoa_id
        where p.status in ('aberta','parcial')
          and p.data_vencimento between current_date and current_date + 15
          and ($1::bigint is null or l.empresa_id = $1)
        order by p.data_vencimento, p.id limit 12`, [ctx.id]),
    q(`select case
                when current_date - p.data_vencimento <= 30  then '1 a 30 dias'
                when current_date - p.data_vencimento <= 90  then '31 a 90 dias'
                when current_date - p.data_vencimento <= 365 then '91 a 365 dias'
                else 'mais de 1 ano' end as faixa,
              min(case
                when current_date - p.data_vencimento <= 30 then 1
                when current_date - p.data_vencimento <= 90 then 2
                when current_date - p.data_vencimento <= 365 then 3 else 4 end) as ordem,
              count(*)::int as qtd,
              sum(p.valor_original - p.valor_baixado)::float8 as valor
         from parcela p join lancamento l on l.id = p.lancamento_id
        where p.tipo = 'receber' and p.status in ('aberta','parcial')
          and p.data_vencimento < current_date
          and ($1::bigint is null or l.empresa_id = $1)
        group by 1 order by 2`, [ctx.id]),
    q(`select coalesce(cc.nome, 'SEM CENTRO DE CUSTO') as centro,
              sum(l.valor_total)::float8 as valor
         from lancamento l left join centro_custo cc on cc.id = l.centro_custo_id
        where l.tipo = 'despesa' and l.status = 'ativo'
          and l.data_competencia >= date_trunc('year', current_date)
          and ($1::bigint is null or l.empresa_id = $1)
        group by 1 order by 2 desc limit 6`, [ctx.id]),
  ]);

  const resultadoMes = mes.entradas - mes.saidas;
  const maxAging = Math.max(...aging.map((a: any) => a.valor), 1);
  const maxCentro = Math.max(...centros.map((c: any) => c.valor), 1);
  const totalCentros = centros.reduce((s: number, c: any) => s + c.valor, 0);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Painel</div>
        <h1>Visão geral</h1>
        <p className="sub">
          {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · posição em {dataBR(hoje)}
        </p>
      </div>

      <section className="cards">
        <div className="card destaque-navy">
          <div className="rotulo">Saldo em caixa</div>
          <div className={`valor tabular ${caixa.saldo < 0 ? 'v-saida' : ''}`}>{brl(caixa.saldo)}</div>
          <div className="nota">todas as contas, desde o início</div>
        </div>
        <div className="card destaque-positivo">
          <div className="rotulo">A receber</div>
          <div className="valor tabular">{brl(receber.aberto)}</div>
          <div className="nota">
            {receber.vencido > 0
              ? <><strong className="v-saida">{brl(receber.vencido)} vencido</strong> · {receber.qtd_vencida} parcelas</>
              : 'nada vencido'}
          </div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">A pagar</div>
          <div className="valor tabular">{brl(pagar.aberto)}</div>
          <div className="nota">
            {pagar.vencido > 0
              ? <><strong className="v-saida">{brl(pagar.vencido)} vencido</strong> · {pagar.qtd_vencida} parcelas</>
              : 'nada vencido'}
          </div>
        </div>
        <div className={`card ${resultadoMes >= 0 ? 'destaque-positivo' : 'destaque-negativo'}`}>
          <div className="rotulo">Resultado do mês</div>
          <div className={`valor tabular ${resultadoMes >= 0 ? 'v-entrada' : 'v-saida'}`}>
            {brl(resultadoMes)}
          </div>
          <div className="nota">{brl(mes.entradas)} entrou · {brl(mes.saidas)} saiu</div>
        </div>
      </section>

      <section className="bloco">
        <h2>Entradas e saídas · últimos 12 meses</h2>
        <GraficoMensal dados={evolucao as any} />
      </section>

      <div className="painel-duplo">
        <section className="bloco">
          <h2>Vence nos próximos 15 dias</h2>
          {vencendo.length === 0 ? (
            <p className="dica">Nada a vencer nos próximos 15 dias.</p>
          ) : (
            <div className="lista-simples">
              {vencendo.map((v: any) => (
                <a key={v.id} href={`/lancamentos/${v.lancamento_id}`} className="ls-item">
                  <span className="ls-data tabular">{dataBR(v.vencimento)}</span>
                  <span className="ls-texto">
                    <strong>{v.pessoa?.slice(0, 26) ?? v.descricao?.slice(0, 26)}</strong>
                    <span className="sub">{v.descricao?.slice(0, 34)}</span>
                  </span>
                  <span className={`ls-valor tabular ${v.tipo === 'receber' ? 'v-entrada' : 'v-saida'}`}>
                    {v.tipo === 'receber' ? '+' : '−'} {brl(v.saldo)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="bloco">
          <h2>Recebíveis vencidos, por idade</h2>
          {aging.length === 0 ? (
            <p className="dica">Nenhum recebível vencido.</p>
          ) : (
            <div className="barras">
              {aging.map((a: any) => (
                <div key={a.faixa} className="barra-linha">
                  <span className="barra-rotulo">{a.faixa}<i className="sub">{a.qtd} parcelas</i></span>
                  <span className="barra-trilho">
                    <span className="barra-fill" style={{ width: `${Math.max(3, (a.valor / maxAging) * 100)}%` }} />
                  </span>
                  <span className="barra-valor tabular">{brl(a.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bloco">
        <h2>Despesas do ano por centro de custo</h2>
        {centros.length === 0 ? (
          <p className="dica">Sem despesas no ano.</p>
        ) : (
          <div className="barras">
            {centros.map((c: any) => (
              <div key={c.centro} className="barra-linha">
                <span className="barra-rotulo">
                  {c.centro}
                  <i className="sub">{((c.valor / totalCentros) * 100).toFixed(0)}% do total</i>
                </span>
                <span className="barra-trilho">
                  <span className="barra-fill escura" style={{ width: `${Math.max(3, (c.valor / maxCentro) * 100)}%` }} />
                </span>
                <span className="barra-valor tabular">{brl(c.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
