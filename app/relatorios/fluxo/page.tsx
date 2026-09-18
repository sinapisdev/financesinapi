import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

const rotuloMes = (iso: string) => {
  const [a, m] = iso.split('-');
  return `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(m) - 1]}/${a.slice(2)}`;
};

export default async function Fluxo({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa();
  const sp = await searchParams;
  const meses = Number(str(sp.meses)) || 12;
  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = hoje.slice(0, 7);

  const [[saldo], realizado, previsto, [proximos]] = await Promise.all([
    q(`select coalesce(sum(valor_com_sinal), 0)::float8 as atual
         from movimento_caixa where ($1::bigint is null or empresa_id = $1)`, [ctx.id]),
    // o que já aconteceu no banco
    q(`select to_char(data, 'YYYY-MM') as mes,
              coalesce(sum(valor_liquido) filter (where sentido = 'entrada'), 0)::float8 as entradas,
              coalesce(sum(valor_liquido) filter (where sentido = 'saida'), 0)::float8 as saidas
         from movimento_caixa
        where ($1::bigint is null or empresa_id = $1)
          and data >= (date_trunc('month', current_date) - ($2 || ' months')::interval)
          and to_char(data, 'YYYY-MM') <= $3
        group by 1 order by 1`, [ctx.id, String(meses), mesAtual]),
    // o que está previsto: parcelas em aberto, pela data de vencimento
    q(`select to_char(p.data_vencimento, 'YYYY-MM') as mes,
              coalesce(sum(p.valor_original - p.valor_baixado)
                       filter (where p.tipo = 'receber'), 0)::float8 as a_receber,
              coalesce(sum(p.valor_original - p.valor_baixado)
                       filter (where p.tipo = 'pagar'), 0)::float8 as a_pagar,
              count(*) filter (where p.data_vencimento < current_date)::int as vencidas
         from parcela p join lancamento l on l.id = p.lancamento_id
        where p.status in ('aberta','parcial') and l.status = 'ativo'
          and ($1::bigint is null or l.empresa_id = $1)
        group by 1 order by 1`, [ctx.id]),
    q(`select coalesce(sum(p.valor_original - p.valor_baixado) filter (
                where p.tipo='receber' and p.data_vencimento <= current_date + 30), 0)::float8 as receber30,
              coalesce(sum(p.valor_original - p.valor_baixado) filter (
                where p.tipo='pagar' and p.data_vencimento <= current_date + 30), 0)::float8 as pagar30
         from parcela p join lancamento l on l.id = p.lancamento_id
        where p.status in ('aberta','parcial') and l.status = 'ativo'
          and ($1::bigint is null or l.empresa_id = $1)`, [ctx.id]),
  ]);

  // junta passado e futuro numa linha do tempo só
  const mapa = new Map<string, any>();
  for (const r of realizado as any[]) {
    mapa.set(r.mes, { mes: r.mes, entradas: r.entradas, saidas: r.saidas, futuro: false });
  }
  for (const p of previsto as any[]) {
    const existente = mapa.get(p.mes);
    if (existente && p.mes <= mesAtual) {
      // mês corrente/passado com parcela ainda em aberto: some ao previsto do mês
      existente.prev_receber = p.a_receber; existente.prev_pagar = p.a_pagar; existente.vencidas = p.vencidas;
    } else if (p.mes > mesAtual) {
      mapa.set(p.mes, { mes: p.mes, entradas: 0, saidas: 0, futuro: true,
                        prev_receber: p.a_receber, prev_pagar: p.a_pagar, vencidas: 0 });
    } else {
      mapa.set(p.mes, { mes: p.mes, entradas: 0, saidas: 0, futuro: false,
                        prev_receber: p.a_receber, prev_pagar: p.a_pagar, vencidas: p.vencidas });
    }
  }
  const linhas = [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));

  // saldo acumulado: parte do saldo de hoje e projeta o futuro para frente
  let acumuladoFuturo = saldo.atual;
  const comSaldo = linhas.map((l) => {
    if (l.futuro) {
      acumuladoFuturo += (l.prev_receber ?? 0) - (l.prev_pagar ?? 0);
      return { ...l, saldo: acumuladoFuturo };
    }
    return { ...l, saldo: null };
  });

  const vencidoTotal = (previsto as any[])
    .filter(p => p.mes <= mesAtual)
    .reduce((s, p) => s + p.a_receber - p.a_pagar, 0);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Relatórios</div>
        <h1>Fluxo de caixa</h1>
        <p className="sub">
          {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · realizado até {dataBR(hoje)} e
          previsto pela data de vencimento das parcelas em aberto.
        </p>
      </div>

      <section className="cards">
        <div className="card destaque-navy">
          <div className="rotulo">Saldo hoje</div>
          <div className={`valor tabular ${saldo.atual < 0 ? 'v-saida' : ''}`}>{brl(saldo.atual)}</div>
          <div className="nota">todas as contas</div>
        </div>
        <div className="card destaque-positivo">
          <div className="rotulo">A receber em 30 dias</div>
          <div className="valor tabular v-entrada">{brl(proximos.receber30)}</div>
          <div className="nota">inclui o que já está vencido</div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">A pagar em 30 dias</div>
          <div className="valor tabular v-saida">{brl(proximos.pagar30)}</div>
        </div>
        <div className={`card ${saldo.atual + proximos.receber30 - proximos.pagar30 >= 0 ? 'destaque-positivo' : 'destaque-negativo'}`}>
          <div className="rotulo">Projeção em 30 dias</div>
          <div className={`valor tabular ${saldo.atual + proximos.receber30 - proximos.pagar30 < 0 ? 'v-saida' : ''}`}>
            {brl(saldo.atual + proximos.receber30 - proximos.pagar30)}
          </div>
          <div className="nota">se tudo entrar e sair na data</div>
        </div>
      </section>

      <div className="aviso">
        A projeção assume que <strong>toda parcela em aberto se realiza na data de vencimento</strong>.
        Como {brl(Math.abs(vencidoTotal))} já estão vencidos e continuam previstos, trate a linha
        futura como teto, não como certeza.
      </div>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="meses">Histórico</label>
          <select id="meses" name="meses" defaultValue={String(meses)}>
            <option value="6">Últimos 6 meses</option>
            <option value="12">Últimos 12 meses</option>
            <option value="24">Últimos 24 meses</option>
          </select>
        </div>
        <button className="aplicar" type="submit">Aplicar</button>
      </form>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="num">Entrou</th>
              <th className="num">Saiu</th>
              <th className="num">Resultado</th>
              <th className="num">A receber</th>
              <th className="num">A pagar</th>
              <th className="num">Saldo projetado</th>
            </tr>
          </thead>
          <tbody>
            {comSaldo.map((l) => {
              const resultado = l.entradas - l.saidas;
              const ehAtual = l.mes === mesAtual;
              return (
                <tr key={l.mes} className={ehAtual ? 'destaque' : undefined}
                    style={l.futuro ? { color: 'var(--aco)' } : undefined}>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                    <strong>{rotuloMes(l.mes)}</strong>
                    {ehAtual && <div className="sub">mês corrente</div>}
                    {l.futuro && <div className="sub">previsto</div>}
                  </td>
                  <td className="num tabular v-entrada">{l.entradas > 0 ? brl(l.entradas) : '—'}</td>
                  <td className="num tabular v-saida">{l.saidas > 0 ? brl(l.saidas) : '—'}</td>
                  <td className={`num tabular ${resultado >= 0 ? '' : 'v-saida'}`}>
                    {l.entradas || l.saidas ? <strong>{brl(resultado)}</strong> : '—'}
                  </td>
                  <td className="num tabular sub">
                    {l.prev_receber > 0 ? brl(l.prev_receber) : '—'}
                    {l.vencidas > 0 && <div className="sub v-saida">{l.vencidas} vencidas</div>}
                  </td>
                  <td className="num tabular sub">{l.prev_pagar > 0 ? brl(l.prev_pagar) : '—'}</td>
                  <td className="num tabular">
                    {l.saldo !== null
                      ? <strong className={l.saldo < 0 ? 'v-saida' : ''}>{brl(l.saldo)}</strong>
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="rodape">
          Saldo projetado parte do saldo de hoje ({brl(saldo.atual)}) e soma o previsto de cada mês
          seguinte. Meses passados não têm projeção — o que aconteceu já está nas colunas da esquerda.
        </div>
      </div>
    </main>
  );
}
