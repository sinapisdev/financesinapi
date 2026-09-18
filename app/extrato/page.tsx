import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';

type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function Extrato({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa('movimento');
  const sp = await searchParams;
  const hoje = new Date().toISOString().slice(0, 10);
  const conta   = str(sp.conta);
  const obra    = str(sp.obra);
  const de      = str(sp.de)  || `${hoje.slice(0, 4)}-01-01`;
  const ate     = str(sp.ate) || hoje;
  // o período pode incidir sobre o movimento (quando o dinheiro andou)
  // ou sobre a competência do lançamento (quando o fato aconteceu)
  const baseData = str(sp.base) || 'movimento';
  const colData  = baseData === 'lancamento' ? 'l.data_competencia' : 'mc.data';

  const [contas, obras] = await Promise.all([
    q(`select cb.id, cb.apelido, cb.empresa_id, e.razao_social as empresa
         from conta_bancaria cb join empresa e on e.id = cb.empresa_id
        where ($1::bigint is null or cb.empresa_id = $1)
        order by e.codigo, cb.apelido`, [ctx.id]),
    q(`select cc.id, cc.codigo, cc.nome, cc.tipo from centro_custo cc
        where ($1::bigint is null or cc.empresa_id = $1) order by cc.tipo, cc.nome`, [ctx.id]),
  ]);

  // filtros montados por posição, sem interpolar valor nenhum na SQL
  const cond: string[] = [`${colData} >= $1`, `${colData} <= $2`];
  const args: unknown[] = [de, ate];
  if (ctx.id)  { args.push(ctx.id);          cond.push(`mc.empresa_id = $${args.length}`); }
  if (conta)   { args.push(Number(conta));   cond.push(`mc.conta_bancaria_id = $${args.length}`); }
  if (obra)    { args.push(Number(obra));    cond.push(`mc.centro_custo_id = $${args.length}`); }
  const where = cond.join(' and ');

  const movs = await q(`
    select mc.data::text as data, mc.sentido, mc.valor_liquido::float8 as valor,
           mc.valor_com_sinal::float8 as sinal, mc.descricao, mc.origem,
           e.razao_social as empresa, cb.apelido as conta, o.nome as centro_custo,
           pe.nome_razao_social as pessoa, l.base44_numero, l.status as lanc_status,
           sum(mc.valor_com_sinal) over (order by mc.data, mc.origem, mc.origem_id
                                         rows between unbounded preceding and current row)::float8 as saldo
      from movimento_caixa mc
      join empresa e          on e.id  = mc.empresa_id
      left join conta_bancaria cb on cb.id = mc.conta_bancaria_id
      left join centro_custo o on o.id = mc.centro_custo_id
      left join pessoa pe     on pe.id = mc.pessoa_id
      left join lancamento l  on l.id  = mc.lancamento_id
     where ${where}
     order by mc.data desc, mc.origem_id desc
     limit 500`, args);

  const [tot] = await q(`
    select count(*)::int as movs,
           coalesce(sum(mc.valor_liquido) filter (where mc.sentido = 'entrada'), 0)::float8 as entradas,
           coalesce(sum(mc.valor_liquido) filter (where mc.sentido = 'saida'),   0)::float8 as saidas,
           coalesce(sum(mc.valor_com_sinal), 0)::float8 as resultado
      from movimento_caixa mc
      left join lancamento l on l.id = mc.lancamento_id
     where ${where}`, args);

  const naoIdentificada = contas.find((c: any) => /A IDENTIFICAR/.test(c.apelido));

  const periodoTexto = `${dataBR(de)} a ${dataBR(ate)}`;

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Movimento</div>
        <h1>Extrato de caixa</h1>
        <p className="sub">
          {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · {periodoTexto}.
          {' '}É o que se compara com o extrato bancário.
        </p>
      </div>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="conta">Conta</label>
          <select id="conta" name="conta" defaultValue={conta}>
            <option value="">Todas</option>
            {ctx.todas
              ? Object.entries(
                  contas.reduce((acc: any, c: any) => {
                    (acc[c.empresa] ??= []).push(c); return acc;
                  }, {})
                ).map(([empresaNome, lista]: any) => (
                  <optgroup key={empresaNome} label={nomeCurto(empresaNome)}>
                    {lista.map((c: any) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
                  </optgroup>
                ))
              : contas.map((c: any) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="obra">Centro de custo</label>
          <select id="obra" name="obra" defaultValue={obra}>
            <option value="">Todas</option>
            {['obra','incorporadora','administrativo','projeto','outro'].map((t) => {
              const doTipo = obras.filter((o: any) => o.tipo === t);
              if (!doTipo.length) return null;
              const rotulo = { obra: 'Obras', incorporadora: 'Incorporadora',
                administrativo: 'Administrativo', projeto: 'Projetos', outro: 'Outros' }[t]!;
              return (
                <optgroup key={t} label={rotulo}>
                  {doTipo.map((o: any) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="base">Período por</label>
          <select id="base" name="base" defaultValue={baseData}>
            <option value="movimento">Movimento (pagamento)</option>
            <option value="lancamento">Lançamento (competência)</option>
          </select>
        </div>
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

      <section className="cards">
        <div className="card destaque-positivo">
          <div className="rotulo">Entradas</div>
          <div className="valor v-entrada tabular">{brl(tot.entradas)}</div>
          <div className="nota">{tot.movs} movimentos no período</div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">Saídas</div>
          <div className="valor v-saida tabular">{brl(tot.saidas)}</div>
        </div>
        <div className="card destaque-navy">
          <div className="rotulo">Resultado</div>
          <div className={`valor tabular ${tot.resultado >= 0 ? '' : 'v-saida'}`}>
            {brl(tot.resultado)}
          </div>
          <div className="nota">entradas menos saídas</div>
        </div>
      </section>

      {naoIdentificada && !conta && (
        <div className="aviso">
          O histórico vindo do Base44 é <strong>consolidado</strong>: lá não se registrava
          de qual conta saiu cada valor, então ele aparece agrupado em “histórico Base44”.
          Para conferir o caixa desse período, some os extratos das contas do Sicoob, como
          você já faz. Lançamentos novos exigem a conta e ficam separados por banco.
        </div>
      )}

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th className="oculta-mobile">Contraparte</th>
              <th className="oculta-mobile">Centro de custo</th>
              <th className="num">Entrada</th>
              <th className="num">Saída</th>
              <th className="num oculta-mobile">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {movs.length === 0 && (
              <tr><td colSpan={7}><div className="vazio">Nenhum movimento no período selecionado.</div></td></tr>
            )}
            {movs.map((m: any, i: number) => (
              <tr key={i}>
                <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{dataBR(m.data)}</td>
                <td>
                  <div className="desc">{m.descricao || '—'}</div>
                  <div className="sub">
                    {ctx.todas ? nomeCurto(m.empresa ?? '') : (m.conta ?? '—')}
                    {m.origem === 'transferencia' && <span className="tag tag-transf" style={{ marginLeft: 6 }}>transferência</span>}
                    {m.lanc_status === 'cancelado' && <span className="tag tag-alerta" style={{ marginLeft: 6 }}>lanç. cancelado</span>}
                  </div>
                </td>
                <td className="oculta-mobile">{m.pessoa?.slice(0, 30) || '—'}</td>
                <td className="oculta-mobile sub">{m.centro_custo || '—'}</td>
                <td className="num tabular v-entrada">{m.sentido === 'entrada' ? brl(m.valor) : ''}</td>
                <td className="num tabular v-saida">{m.sentido === 'saida' ? brl(m.valor) : ''}</td>
                <td className="num tabular oculta-mobile sub">{brl(m.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {movs.length >= 500 && (
          <div className="rodape">Mostrando os 500 movimentos mais recentes do período. Refine o filtro para ver o restante.</div>
        )}
      </div>
    </main>
  );
}
