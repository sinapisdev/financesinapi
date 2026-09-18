import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function Transferencias({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa();
  const sp = await searchParams;
  const criada = str(sp.criada);
  const de = str(sp.de);
  const ate = str(sp.ate);

  const cond: string[] = [];
  const args: unknown[] = [];
  if (ctx.id) { args.push(ctx.id); cond.push(`t.empresa_id = $${args.length}`); }
  if (de)     { args.push(de);     cond.push(`t.data_movimento >= $${args.length}`); }
  if (ate)    { args.push(ate);    cond.push(`t.data_movimento <= $${args.length}`); }
  const where = cond.length ? `where ${cond.join(' and ')}` : '';

  const [linhas, [tot], saldos] = await Promise.all([
    q(`select t.id, t.data_movimento::text as data, t.valor::float8 as valor, t.descricao,
              e.razao_social as empresa, o.apelido as origem, d.apelido as destino,
              t.base44_id is not null as veio_do_base44
         from transferencia t
         join empresa e on e.id = t.empresa_id
         left join conta_bancaria o on o.id = t.conta_origem_id
         left join conta_bancaria d on d.id = t.conta_destino_id
         ${where} order by t.data_movimento desc, t.id desc limit 200`, args),
    q(`select count(*)::int as qtd, coalesce(sum(t.valor), 0)::float8 as total
         from transferencia t ${where}`, args),
    q(`select cb.apelido as conta, e.razao_social as empresa,
              coalesce((select sum(mc.valor_com_sinal) from movimento_caixa mc
                         where mc.conta_bancaria_id = cb.id), 0)::float8 as saldo
         from conta_bancaria cb join empresa e on e.id = cb.empresa_id
        where cb.ativo and ($1::bigint is null or cb.empresa_id = $1)
        order by e.codigo, cb.apelido`, [ctx.id]),
  ]);

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">Movimento</div>
          <h1>Transferências</h1>
          <p className="sub">
            {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · {tot.qtd} transferência(s),
            {' '}{brl(tot.total)} movimentados entre contas.
          </p>
        </div>
        <a className="aplicar" href="/transferencias/nova">Nova transferência</a>
      </div>

      {criada && <div className="sucesso">Transferência registrada.</div>}

      <section className="cards">
        {saldos.map((s: any) => (
          <div key={`${s.empresa}-${s.conta}`} className={`card ${s.saldo >= 0 ? 'destaque-navy' : 'destaque-negativo'}`}>
            <div className="rotulo">{s.conta}</div>
            <div className={`valor tabular ${s.saldo < 0 ? 'v-saida' : ''}`} style={{ fontSize: 20 }}>
              {brl(s.saldo)}
            </div>
            {ctx.todas && <div className="nota">{nomeCurto(s.empresa)}</div>}
          </div>
        ))}
      </section>

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
        <table>
          <thead>
            <tr>
              <th>Data</th><th>Descrição</th>
              <th>Sai de</th><th>Entra em</th>
              <th className="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={5}><div className="vazio">Nenhuma transferência registrada.</div></td></tr>
            )}
            {linhas.map((t: any) => (
              <tr key={t.id}>
                <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{dataBR(t.data)}</td>
                <td>
                  <div className="desc">{t.descricao || 'TRANSFERÊNCIA'}</div>
                  {ctx.todas && <div className="sub">{nomeCurto(t.empresa)}</div>}
                  {t.veio_do_base44 && <div className="sub">migrada do Base44</div>}
                </td>
                <td className="sub">{t.origem ?? '—'}</td>
                <td className="sub">{t.destino ?? '—'}</td>
                <td className="num tabular"><strong>{brl(t.valor)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
