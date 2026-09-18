import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';
import DescricaoEditavel from '@/app/_componentes/DescricaoEditavel';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function Lancamentos({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa('movimento');
  const sp = await searchParams;

  const criado   = str(sp.criado);
  const busca    = str(sp.busca);
  const centro   = str(sp.centro);
  const processo = str(sp.processo);
  const tipo     = str(sp.tipo);
  const situacao = str(sp.situacao) || 'ativos';
  const de       = str(sp.de);
  const ate      = str(sp.ate);

  const [centros, processos] = await Promise.all([
    q(`select id, nome, tipo from centro_custo
        where ($1::bigint is null or empresa_id = $1) order by tipo, nome`, [ctx.id]),
    q(`select id, codigo, nome from processo where ativo order by codigo`),
  ]);

  const cond: string[] = [];
  const args: unknown[] = [];
  if (ctx.id)   { args.push(ctx.id);            cond.push(`l.empresa_id = $${args.length}`); }
  if (centro)   { args.push(Number(centro));    cond.push(`l.centro_custo_id = $${args.length}`); }
  if (processo) { args.push(Number(processo));  cond.push(`l.processo_id = $${args.length}`); }
  if (tipo)     { args.push(tipo);              cond.push(`l.tipo = $${args.length}`); }
  if (de)       { args.push(de);                cond.push(`l.data_competencia >= $${args.length}`); }
  if (ate)      { args.push(ate);               cond.push(`l.data_competencia <= $${args.length}`); }
  if (situacao === 'ativos')    cond.push(`l.status = 'ativo'`);
  if (situacao === 'cancelados') cond.push(`l.status = 'cancelado'`);
  if (situacao === 'revisao')     cond.push(`l.requer_revisao`);
  if (situacao === 'sem_conta')   cond.push(`l.conta_id is null and l.status = 'ativo'`);
  if (situacao === 'conta_torta') cond.push(`l.requer_revisao and l.motivo_revisao like 'Conta contábil%'`);
  if (situacao === 'sem_descricao') cond.push(`l.descricao_automatica and l.status = 'ativo'`);
  if (busca) {
    args.push(`%${busca}%`);
    cond.push(`(l.descricao ilike $${args.length} or l.numero ilike $${args.length}
                or l.base44_numero ilike $${args.length} or pe.nome_razao_social ilike $${args.length})`);
  }
  const where = cond.length ? `where ${cond.join(' and ')}` : '';

  const base = `
    from lancamento l
    join empresa e on e.id = l.empresa_id
    left join centro_custo cc on cc.id = l.centro_custo_id
    left join pessoa pe on pe.id = l.pessoa_id
    left join processo pr on pr.id = l.processo_id
    left join plano_conta pc on pc.id = l.conta_id`;

  const [linhas, [tot]] = await Promise.all([
    q(`select l.id, l.numero, l.tipo, l.data_competencia::text as data, l.valor_total::float8 as valor,
              l.descricao, l.descricao_automatica, l.status, l.a_vista, l.requer_revisao,
              e.razao_social as empresa, cc.nome as centro_custo, pe.nome_razao_social as pessoa,
              pr.codigo as processo_codigo, pr.nome as processo_nome,
              pc.codigo as conta_codigo, pc.descricao as conta_nome,
              (select count(*) from parcela p where p.lancamento_id = l.id and p.status <> 'cancelada')::int as qtd_parcelas,
              (select coalesce(sum(p.valor_baixado), 0) from parcela p where p.lancamento_id = l.id)::float8 as baixado
         ${base} ${where}
        order by l.data_competencia desc, l.id desc limit 300`, args),
    q(`select count(*)::int as qtd,
              coalesce(sum(l.valor_total) filter (where l.tipo = 'receita'), 0)::float8 as receitas,
              coalesce(sum(l.valor_total) filter (where l.tipo = 'despesa'), 0)::float8 as despesas
         ${base} ${where}`, args),
  ]);

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">Movimento</div>
          <h1>Lançamentos</h1>
          <p className="sub">
            {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} ·{' '}
            {tot.qtd} lançamento(s){linhas.length >= 300 && ' · mostrando os 300 mais recentes'}
          </p>
        </div>
        <a className="aplicar" href="/lancamentos/novo">Novo lançamento</a>
      </div>

      {criado && <div className="sucesso">Lançamento gravado com sucesso.</div>}

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo}>
            <option value="">Receitas e despesas</option>
            <option value="receita">Só receitas</option>
            <option value="despesa">Só despesas</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="centro">Centro de custo</label>
          <select id="centro" name="centro" defaultValue={centro}>
            <option value="">Todos</option>
            {centros.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="processo">Processo</label>
          <select id="processo" name="processo" defaultValue={processo}>
            <option value="">Todos</option>
            {processos.map((p: any) => (
              <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="situacao">Situação</label>
          <select id="situacao" name="situacao" defaultValue={situacao}>
            <option value="ativos">Ativos</option>
            <option value="cancelados">Cancelados</option>
            <option value="revisao">Marcados para revisão</option>
            <option value="sem_conta">Sem conta contábil</option>
            <option value="conta_torta">Conta fora do grupo do processo</option>
            <option value="sem_descricao">Sem descrição própria</option>
            <option value="todos">Todos</option>
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
        <div className="campo cresce">
          <label htmlFor="busca">Buscar</label>
          <input id="busca" name="busca" defaultValue={busca}
                 placeholder="Número, descrição ou contraparte" />
        </div>
        <button className="aplicar" type="submit">Aplicar</button>
      </form>

      <section className="cards">
        <div className="card destaque-positivo">
          <div className="rotulo">Receitas</div>
          <div className="valor tabular v-entrada">{brl(tot.receitas)}</div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">Despesas</div>
          <div className="valor tabular v-saida">{brl(tot.despesas)}</div>
        </div>
        <div className="card destaque-navy">
          <div className="rotulo">Resultado</div>
          <div className={`valor tabular ${tot.receitas - tot.despesas >= 0 ? '' : 'v-saida'}`}>
            {brl(tot.receitas - tot.despesas)}
          </div>
          <div className="nota">no filtro aplicado, por competência</div>
        </div>
      </section>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Número</th><th>Data</th><th>Descrição</th>
              <th className="oculta-mobile">Contraparte</th>
              <th className="oculta-mobile">Centro de custo</th>
              <th className="oculta-mobile">Processo</th>
              <th className="oculta-mobile">Conta</th>
              <th className="num">Valor</th>
              <th className="num oculta-mobile">Baixado</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={10}><div className="vazio">Nenhum lançamento nesse filtro.</div></td></tr>
            )}
            {linhas.map((l: any) => (
              <tr key={l.id} className={String(l.id) === criado ? 'destaque' : ''}>
                <td className="tabular">
                  <a className="link-acao" href={`/lancamentos/${l.id}`}>{l.numero}</a>
                </td>
                <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{dataBR(l.data)}</td>
                <td>
                  <DescricaoEditavel id={l.id} descricao={l.descricao}
                                     automatica={l.descricao_automatica}
                                     href={`/lancamentos/${l.id}`} />
                  <div className="sub">
                    {ctx.todas ? `${nomeCurto(l.empresa)} · ` : ''}{l.qtd_parcelas}x
                  </div>
                </td>
                <td className="oculta-mobile">{l.pessoa?.slice(0, 28) || '—'}</td>
                <td className="oculta-mobile sub">{l.centro_custo || '—'}</td>
                <td className="oculta-mobile sub">{l.processo_codigo ? `${l.processo_codigo} ${l.processo_nome?.slice(0, 16)}` : '—'}</td>
                <td className="oculta-mobile sub">
                  {l.conta_codigo
                    ? <><strong className="tabular" style={{ color: 'var(--navy)' }}>{l.conta_codigo}</strong>
                        {' '}{l.conta_nome?.slice(0, 20)}</>
                    : <span className="tag tag-alerta">sem conta</span>}
                </td>
                <td className={`num tabular ${l.tipo === 'receita' ? 'v-entrada' : 'v-saida'}`}>
                  {l.tipo === 'receita' ? '+' : '−'} {brl(l.valor)}
                </td>
                <td className="num tabular sub oculta-mobile">{l.baixado > 0 ? brl(l.baixado) : '—'}</td>
                <td>
                  {l.status === 'cancelado' && <span className="tag tag-transf">cancelado</span>}
                  {l.status === 'ativo' && l.a_vista && <span className="tag tag-entrada">à vista</span>}
                  {l.status === 'ativo' && !l.a_vista && <span className="tag tag-parcela">a prazo</span>}
                  {l.requer_revisao && <div className="sub">revisar</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
