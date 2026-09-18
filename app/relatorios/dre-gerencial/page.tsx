import { q, brl } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default async function DreGerencial({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa('relatorios');
  const sp = await searchParams;
  const ano = Number(str(sp.ano)) || 2026;

  const [estrutura, valores, anos] = await Promise.all([
    q(`select ordem, codigo, rotulo, tipo, nivel, formula, destaque
         from dre_estrutura order by ordem`),
    q(`select linha_dre, mes, sum(valor)::float8 as valor
         from dre_gerencial
        where ano = $1 and ($2::bigint is null or empresa_id = $2)
        group by linha_dre, mes`, [ano, ctx.id]),
    q(`select distinct ano from dre_gerencial
        where ($1::bigint is null or empresa_id = $1) order by ano desc`, [ctx.id]),
  ]);

  // valor[linha][mes]
  const bruto = new Map<string, number[]>();
  for (const v of valores as any[]) {
    if (!v.linha_dre) continue;
    const arr = bruto.get(v.linha_dre) ?? Array(12).fill(0);
    arr[v.mes - 1] += v.valor;
    bruto.set(v.linha_dre, arr);
  }

  const zeros = () => Array(12).fill(0);
  const somaArr = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);

  /* 'conta' pega a linha exata; 'grupo' soma as filhas — e só as filhas, para
     que o subtotal do grupo não conte duas vezes o que já está detalhado. */
  const calc = new Map<string, number[]>();
  for (const l of estrutura as any[]) {
    if (l.tipo === 'conta') {
      calc.set(l.codigo, bruto.get(l.codigo) ?? zeros());
    } else if (l.tipo === 'grupo') {
      let acc = zeros();
      for (const [k, arr] of bruto) if (k.startsWith(l.codigo)) acc = somaArr(acc, arr);
      calc.set(l.codigo, acc);
    } else if (l.tipo === 'total') {
      let acc = zeros();
      for (const parte of String(l.formula).split(',')) {
        acc = somaArr(acc, calc.get(parte.trim()) ?? zeros());
      }
      calc.set(l.codigo, acc);
    }
  }

  // linhas que não apareceram em nenhuma linha da estrutura
  const previstas = new Set((estrutura as any[]).map((l) => l.codigo));
  const orfas = [...bruto.keys()].filter(
    (k) => !previstas.has(k) && ![...previstas].some((p) => k.startsWith(p + '.')));

  const meses = [...Array(12).keys()];
  const total = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const cel = (v: number) => (Math.abs(v) < 0.005 ? '—' : brl(v));

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">Relatórios</div>
          <h1>DRE gerencial</h1>
          <p className="sub">
            {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · {ano} · regime de caixa,
            na mesma estrutura da planilha
          </p>
        </div>
        <form className="form-inline" method="get">
          <select name="ano" defaultValue={String(ano)}>
            {(anos as any[]).map((a) => <option key={a.ano} value={a.ano}>{a.ano}</option>)}
          </select>
          <button className="aplicar pequeno" type="submit">Ver</button>
        </form>
      </div>

      {orfas.length > 0 && (
        <div className="aviso">
          <strong>{orfas.length} classificação(ões) fora da estrutura:</strong>{' '}
          {orfas.join(', ')} — aparecem no total do sistema mas não têm linha nesta DRE.
        </div>
      )}

      <div className="tabela-wrap">
        <table className="dre">
          <thead>
            <tr>
              <th style={{ minWidth: 230 }}>Linha</th>
              {meses.map((m) => <th key={m} className="num">{MES[m]}</th>)}
              <th className="num">Ano</th>
            </tr>
          </thead>
          <tbody>
            {(estrutura as any[]).map((l) => {
              const arr = calc.get(l.codigo) ?? zeros();
              const ano12 = total(arr);
              const vazia = Math.abs(ano12) < 0.005 && l.tipo === 'conta';
              if (vazia) return null;
              const cls = l.destaque ? 'dre-total' : l.tipo === 'grupo' ? 'dre-grupo' : 'dre-conta';
              return (
                <tr key={l.codigo} className={cls}>
                  <td>
                    <span className="dre-codigo">{l.tipo === 'total' ? '' : l.codigo}</span>
                    <span style={{ paddingLeft: (l.nivel - 1) * 14 }}>{l.rotulo}</span>
                  </td>
                  {meses.map((m) => (
                    <td key={m} className={`num tabular ${arr[m] < 0 ? 'v-saida' : arr[m] > 0 ? 'v-entrada' : 'sub'}`}>
                      {cel(arr[m])}
                    </td>
                  ))}
                  <td className={`num tabular ${ano12 < 0 ? 'v-saida' : ano12 > 0 ? 'v-entrada' : 'sub'}`}>
                    <strong>{cel(ano12)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="dica" style={{ marginTop: 14 }}>
        Regime de caixa: cada linha é o que efetivamente entrou ou saiu no mês, classificado
        pela mesma regra da planilha. A contabilidade por competência, com partidas dobradas,
        está em <a className="link-acao" href="/relatorios/dre">DRE contábil</a>.
      </div>
    </main>
  );
}
