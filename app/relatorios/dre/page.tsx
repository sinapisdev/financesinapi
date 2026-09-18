import { Fragment } from 'react';
import { q, brl } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

const GRUPOS: Record<string, string> = {
  '4.1': 'Receitas de venda de imóveis', '4.2': 'Receitas financeiras', '4.3': 'Outras receitas',
  '5.1': 'Custos de obra', '5.2': 'Custo de mercadoria vendida',
  '6.1': 'Despesas administrativas', '6.2': 'Despesas comerciais', '6.3': 'Despesas financeiras',
  '6.4': 'Impostos sobre vendas', '6.5': 'Despesas não recorrentes', '6.6': 'Depreciações e amortizações',
};

export default async function DRE({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa();
  const sp = await searchParams;
  const anoAtual = new Date().getFullYear();
  const de = str(sp.de) || `${anoAtual}-01-01`;
  const ate = str(sp.ate) || `${anoAtual}-12-31`;

  const [contas, [fora], [semConta]] = await Promise.all([
    q(`select pc.codigo, pc.descricao, left(pc.codigo, 3) as subgrupo, left(pc.codigo, 1) as grupo,
              count(*)::int as lancamentos, sum(l.valor_total)::float8 as valor
         from lancamento l join plano_conta pc on pc.id = l.conta_id
        where l.status = 'ativo' and left(pc.codigo, 1) in ('4','5','6')
          and l.data_competencia between $2 and $3
          and ($1::bigint is null or l.empresa_id = $1)
        group by 1,2,3,4 order by 1`, [ctx.id, de, ate]),
    q(`select count(*)::int as qtd, coalesce(sum(l.valor_total), 0)::float8 as valor
         from lancamento l join plano_conta pc on pc.id = l.conta_id
        where l.status = 'ativo' and left(pc.codigo, 1) in ('1','2','3')
          and l.data_competencia between $2 and $3
          and ($1::bigint is null or l.empresa_id = $1)`, [ctx.id, de, ate]),
    q(`select count(*)::int as qtd, coalesce(sum(l.valor_total), 0)::float8 as valor
         from lancamento l
        where l.status = 'ativo' and l.conta_id is null
          and l.data_competencia between $2 and $3
          and ($1::bigint is null or l.empresa_id = $1)`, [ctx.id, de, ate]),
  ]);

  const soma = (g: string) => (contas as any[])
    .filter(c => c.grupo === g).reduce((s, c) => s + c.valor, 0);
  const receitas = soma('4'), custos = soma('5'), despesas = soma('6');
  const lucroBruto = receitas - custos;
  const resultado = lucroBruto - despesas;
  const pct = (v: number) => (receitas > 0 ? `${((v / receitas) * 100).toFixed(1)}%` : '—');

  const porSubgrupo = (g: string) => {
    const mapa = new Map<string, any[]>();
    for (const c of (contas as any[]).filter(x => x.grupo === g)) {
      const lista = mapa.get(c.subgrupo) ?? [];
      lista.push(c);
      mapa.set(c.subgrupo, lista);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const Secao = ({ titulo, grupo, sinal }: { titulo: string; grupo: string; sinal: 1 | -1 }) => (
    <>
      <tr className="dre-grupo">
        <td>{titulo}</td>
        <td className="num tabular">{brl(sinal * soma(grupo))}</td>
        <td className="num tabular sub">{pct(soma(grupo))}</td>
      </tr>
      {porSubgrupo(grupo).map(([sub, lista]) => {
        const total = lista.reduce((s, c) => s + c.valor, 0);
        return (
          <Fragment key={sub}>
            <tr className="dre-sub">
              <td>{GRUPOS[sub] ?? sub}</td>
              <td className="num tabular">{brl(sinal * total)}</td>
              <td className="num tabular sub">{pct(total)}</td>
            </tr>
            {lista.map((c) => (
              <tr key={c.codigo} className="dre-conta">
                <td>
                  <span className="tabular dre-codigo">{c.codigo}</span> {c.descricao}
                  <span className="sub"> · {c.lancamentos} lanç.</span>
                </td>
                <td className="num tabular sub">{brl(sinal * c.valor)}</td>
                <td></td>
              </tr>
            ))}
          </Fragment>
        );
      })}
    </>
  );

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Relatórios</div>
        <h1>Demonstração de resultado</h1>
        <p className="sub">
          {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · por competência,
          usando a conta contábil de cada lançamento.
        </p>
      </div>

      <div className="aviso">
        <strong>Esta DRE é gerencial, não contábil.</strong> Ela soma os lançamentos pela conta que
        cada um tem hoje — e essa classificação vem do Base44, com os problemas que já mapeamos:
        custo de obra lançado como despesa em vez de estoque, depreciação sobre bens que não
        existem, e 7 processos apontando para conta de agrupamento. Serve para enxergar a ordem de
        grandeza e comparar períodos; <strong>não serve para fechamento fiscal</strong> até a
        reestruturação contábil.
      </div>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="de">De</label>
          <input id="de" type="date" name="de" defaultValue={de} />
        </div>
        <div className="campo">
          <label htmlFor="ate">Até</label>
          <input id="ate" type="date" name="ate" defaultValue={ate} />
        </div>
        <button className="aplicar" type="submit">Aplicar</button>
      </form>

      <div className="tabela-wrap">
        <table className="dre">
          <thead>
            <tr><th>Conta</th><th className="num">Valor</th><th className="num">% da receita</th></tr>
          </thead>
          <tbody>
            <Secao titulo="RECEITAS" grupo="4" sinal={1} />
            <Secao titulo="(−) CUSTOS" grupo="5" sinal={-1} />
            <tr className="dre-total">
              <td>LUCRO BRUTO</td>
              <td className={`num tabular ${lucroBruto < 0 ? 'v-saida' : ''}`}>{brl(lucroBruto)}</td>
              <td className="num tabular sub">{pct(lucroBruto)}</td>
            </tr>
            <Secao titulo="(−) DESPESAS" grupo="6" sinal={-1} />
            <tr className="dre-total dre-final">
              <td>RESULTADO DO PERÍODO</td>
              <td className={`num tabular ${resultado < 0 ? 'v-saida' : 'v-entrada'}`}>{brl(resultado)}</td>
              <td className="num tabular sub">{pct(resultado)}</td>
            </tr>
          </tbody>
        </table>
        <div className="rodape">
          Ficaram de fora <strong>{fora.qtd} lançamentos ({brl(fora.valor)})</strong> classificados em
          contas de ativo ou passivo — mútuos, empréstimos e compra de imobilizado não são resultado,
          são movimentação patrimonial.
          {semConta.qtd > 0 && <> Outros <strong>{semConta.qtd} ({brl(semConta.valor)})</strong> ainda
          não têm conta contábil e também não entram.</>}
        </div>
      </div>
    </main>
  );
}
