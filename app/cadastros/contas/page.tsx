import { q, brl } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

const TIPO: Record<string, string> = {
  corrente: 'Corrente', poupanca: 'Poupança', aplicacao: 'Aplicação', caixa_fisico: 'Caixa físico',
};

export default async function Contas({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa('cadastros');
  const salvo = str((await searchParams).salvo);

  const linhas = await q(`
    select cb.id, cb.apelido, cb.instituicao, cb.agencia, cb.numero_conta, cb.tipo, cb.ativo,
           cb.saldo_inicial::float8 as saldo_inicial,
           e.razao_social as empresa, cc.nome as centro, pc.codigo as conta_contabil,
           coalesce((select sum(mc.valor_com_sinal) from movimento_caixa mc
                      where mc.conta_bancaria_id = cb.id), 0)::float8 as saldo,
           (select count(*) from movimento_caixa mc where mc.conta_bancaria_id = cb.id)::int as movimentos
      from conta_bancaria cb
      join empresa e on e.id = cb.empresa_id
      left join centro_custo cc on cc.id = cb.centro_custo_id
      left join plano_conta pc on pc.id = cb.conta_contabil_id
     where ($1::bigint is null or cb.empresa_id = $1)
     order by e.codigo, cb.apelido`, [ctx.id]);

  const total = linhas.reduce((s: number, c: any) => s + c.saldo, 0);

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">Cadastros</div>
          <h1>Contas bancárias</h1>
          <p className="sub">
            {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · {linhas.length} contas ·
            {' '}saldo somado {brl(total)}
          </p>
        </div>
        <a className="aplicar" href="/cadastros/contas/nova">Nova conta</a>
      </div>

      {salvo && <div className="sucesso">Conta salva.</div>}

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Apelido</th><th className="oculta-mobile">Instituição</th>
              <th>Agência / conta</th><th>Tipo</th>
              <th className="oculta-mobile">Centro de custo</th>
              <th className="oculta-mobile">Conta contábil</th>
              <th className="num">Movimentos</th><th className="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((c: any) => (
              <tr key={c.id} className={String(c.id) === salvo ? 'destaque' : ''}
                  style={!c.ativo ? { opacity: .55 } : undefined}>
                <td>
                  <a className="desc-link" href={`/cadastros/contas/${c.id}`}>
                    <div className="desc">{c.apelido}</div>
                  </a>
                  {ctx.todas && <div className="sub">{nomeCurto(c.empresa)}</div>}
                  {!c.ativo && <div className="sub">INATIVA</div>}
                </td>
                <td className="oculta-mobile">
                  <div className="desc sub" style={{ maxWidth: 190 }} title={c.instituicao}>
                    {c.instituicao}
                  </div>
                </td>
                <td className="tabular sub">
                  {c.agencia ? `${c.agencia} / ${c.numero_conta}` : '—'}
                </td>
                <td><span className="tag tag-transf">{TIPO[c.tipo] ?? c.tipo}</span></td>
                <td className="sub oculta-mobile">{c.centro ?? '—'}</td>
                <td className="tabular sub oculta-mobile">{c.conta_contabil ?? '—'}</td>
                <td className="num tabular sub">{c.movimentos || '—'}</td>
                <td className="num tabular">
                  <strong className={c.saldo < 0 ? 'v-saida' : ''}>{brl(c.saldo)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
