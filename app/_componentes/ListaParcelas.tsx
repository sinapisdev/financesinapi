import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function ListaParcelas({
  tipo, searchParams,
}: { tipo: 'receber' | 'pagar'; searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa('contas');
  const sp = await searchParams;
  const centro   = str(sp.centro);
  const situacao = str(sp.situacao) || 'em_aberto';
  const busca    = str(sp.busca);
  const baseData = str(sp.base) || 'vencimento';   // qual data o período filtra
  const de       = str(sp.de);
  const ate      = str(sp.ate);

  const centros = await q(
    `select id, nome, tipo from centro_custo
      where ($1::bigint is null or empresa_id = $1) order by tipo, nome`, [ctx.id]);

  const cond: string[] = ['p.tipo = $1'];
  const args: unknown[] = [tipo];
  if (ctx.id)  { args.push(ctx.id);          cond.push(`l.empresa_id = $${args.length}`); }
  if (centro)  { args.push(Number(centro));  cond.push(`l.centro_custo_id = $${args.length}`); }
  if (busca)   { args.push(`%${busca}%`);    cond.push(`(pe.nome_razao_social ilike $${args.length} or l.descricao ilike $${args.length} or p.documento ilike $${args.length})`); }

  // O período incide sobre a data que o usuário escolher. Pagamento não é
  // campo da parcela: é a data das baixas dela.
  const coluna = { vencimento: 'p.data_vencimento', lancamento: 'l.data_competencia' }[baseData];
  if (de || ate) {
    if (coluna) {
      if (de)  { args.push(de);  cond.push(`${coluna} >= $${args.length}`); }
      if (ate) { args.push(ate); cond.push(`${coluna} <= $${args.length}`); }
    } else {
      const faixa: string[] = [];
      if (de)  { args.push(de);  faixa.push(`b.data_liquidacao >= $${args.length}`); }
      if (ate) { args.push(ate); faixa.push(`b.data_liquidacao <= $${args.length}`); }
      cond.push(`exists (select 1 from baixa b where b.parcela_id = p.id${faixa.length ? ' and ' + faixa.join(' and ') : ''})`);
    }
  }

  const porSituacao: Record<string, string> = {
    em_aberto:  `p.status in ('aberta','parcial')`,
    vencidas:   `p.status in ('aberta','parcial') and p.data_vencimento < current_date`,
    a_vencer:   `p.status in ('aberta','parcial') and p.data_vencimento >= current_date`,
    liquidadas: `p.status = 'liquidada'`,
    canceladas: `p.status = 'cancelada'`,
    todas:      `true`,
  };
  const where = [...cond, porSituacao[situacao] ?? porSituacao.em_aberto].join(' and ');
  const whereSemSituacao = cond.join(' and ');

  const base = `
    from parcela p
    join lancamento l   on l.id = p.lancamento_id
    left join pessoa pe on pe.id = p.pessoa_id
    left join centro_custo cc on cc.id = l.centro_custo_id
    join empresa e      on e.id = l.empresa_id`;

  const [linhas, [tot]] = await Promise.all([
    q(`select p.id, p.numero, p.data_vencimento::text as vencimento,
              p.valor_original::float8 as original, p.valor_baixado::float8 as baixado,
              (p.valor_original - p.valor_baixado)::float8 as saldo,
              p.status, p.documento, p.categoria,
              pe.nome_razao_social as pessoa, cc.nome as centro_custo,
              e.razao_social as empresa, l.descricao, l.descricao_automatica, l.base44_numero, l.id as lancamento_id,
              l.status as lanc_status,
              l.data_competencia::text as competencia,
              (select max(b.data_liquidacao)::text from baixa b where b.parcela_id = p.id) as pagamento,
              (current_date - p.data_vencimento) as dias
         ${base} where ${where}
        order by p.data_vencimento asc, p.id asc limit 500`, args),
    q(`select
         coalesce(sum(p.valor_original - p.valor_baixado) filter (
           where p.status in ('aberta','parcial')), 0)::float8 as em_aberto,
         coalesce(sum(p.valor_original - p.valor_baixado) filter (
           where p.status in ('aberta','parcial') and p.data_vencimento < current_date), 0)::float8 as vencido,
         count(*) filter (where p.status in ('aberta','parcial') and p.data_vencimento < current_date)::int as qtd_vencidas
       ${base} where ${whereSemSituacao}`, args),
  ]);

  const rotulo = tipo === 'receber' ? 'receber' : 'pagar';
  const contraparte = tipo === 'receber' ? 'Cliente' : 'Fornecedor';

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Contas</div>
        <h1>{tipo === 'receber' ? 'Contas a receber' : 'Contas a pagar'}</h1>
        <p className="sub">
          {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} ·{' '}
          {tipo === 'receber'
            ? 'parcelas a receber de clientes.'
            : 'parcelas a pagar a fornecedores.'}
        </p>
      </div>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="centro">Centro de custo</label>
          <select id="centro" name="centro" defaultValue={centro}>
            <option value="">Todos</option>
            {centros.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="situacao">Situação</label>
          <select id="situacao" name="situacao" defaultValue={situacao}>
            <option value="em_aberto">Em aberto</option>
            <option value="vencidas">Somente vencidas</option>
            <option value="a_vencer">A vencer</option>
            <option value="liquidadas">Liquidadas</option>
            <option value="canceladas">Canceladas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="base">Período por</label>
          <select id="base" name="base" defaultValue={baseData}>
            <option value="vencimento">Vencimento</option>
            <option value="lancamento">Lançamento</option>
            <option value="pagamento">Pagamento</option>
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
        <div className="campo" style={{ minWidth: 200 }}>
          <label htmlFor="busca">Buscar</label>
          <input id="busca" name="busca" defaultValue={busca} placeholder={`${contraparte}, descrição ou documento`} />
        </div>
        <button className="aplicar" type="submit">Aplicar</button>
      </form>

      <section className="cards">
        <div className="card destaque-navy">
          <div className="rotulo">Em aberto</div>
          <div className="valor tabular">{brl(tot.em_aberto)}</div>
          <div className="nota">saldo a {rotulo}</div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">Vencido</div>
          <div className="valor tabular v-saida">{brl(tot.vencido)}</div>
          <div className="nota">{tot.qtd_vencidas} parcelas com vencimento passado</div>
        </div>
        <div className="card destaque-positivo">
          <div className="rotulo">A vencer</div>
          <div className="valor tabular">{brl(tot.em_aberto - tot.vencido)}</div>
        </div>
      </section>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Vencimento</th>
              <th className="oculta-mobile">Lançamento</th>
              <th className="oculta-mobile">Pagamento</th>
              <th>{contraparte}</th>
              <th className="oculta-mobile">Descrição</th>
              <th className="oculta-mobile">Centro de custo</th>
              <th className="num">Original</th>
              <th className="num oculta-mobile">Baixado</th>
              <th className="num">Saldo</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={11}><div className="vazio">Nenhuma parcela nesse filtro.</div></td></tr>
            )}
            {linhas.map((p: any) => {
              const vencida = ['aberta', 'parcial'].includes(p.status) && p.dias > 0;
              return (
                <tr key={p.id}>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                    {dataBR(p.vencimento)}
                    {vencida && <div className="sub v-saida">{p.dias} dias</div>}
                  </td>
                  <td className="tabular sub oculta-mobile" style={{ whiteSpace: 'nowrap' }}>
                    {dataBR(p.competencia)}
                  </td>
                  <td className="tabular sub oculta-mobile" style={{ whiteSpace: 'nowrap' }}>
                    {p.pagamento ? dataBR(p.pagamento) : '—'}
                  </td>
                  <td>
                    <a className="desc-link" href={`/lancamentos/${p.lancamento_id}`}>
                      <div className="desc">{p.pessoa || '—'}</div>
                    </a>
                    {ctx.todas && <div className="sub">{nomeCurto(p.empresa ?? '')}</div>}
                  </td>
                  <td className="oculta-mobile">
                    <div className="desc-linha">
                      {p.descricao_automatica && (
                        <span className="ponto-sem-descricao"
                              title="Sem descrição própria — usando o nome da contraparte ou do processo" />
                      )}
                      <div className="desc sub">{p.descricao || '—'}</div>
                    </div>
                    <div className="sub">{p.documento}</div>
                  </td>
                  <td className="oculta-mobile sub">{p.centro_custo || '—'}</td>
                  <td className="num tabular">{brl(p.original)}</td>
                  <td className="num tabular sub oculta-mobile">{p.baixado > 0 ? brl(p.baixado) : '—'}</td>
                  <td className="num tabular"><strong>{brl(p.saldo)}</strong></td>
                  <td>
                    {p.status === 'liquidada'  && <span className="tag tag-entrada">liquidada</span>}
                    {p.status === 'parcial'    && <span className="tag tag-alerta">parcial</span>}
                    {p.status === 'cancelada'  && <span className="tag tag-transf">cancelada</span>}
                    {p.status === 'aberta'     && (vencida
                      ? <span className="tag tag-saida">vencida</span>
                      : <span className="tag tag-transf">em aberto</span>)}
                    {p.categoria === 'gerada_na_migracao' &&
                      <div className="sub" style={{ marginTop: 3 }}>gerada na migração</div>}
                  </td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    {['aberta', 'parcial'].includes(p.status) && p.lanc_status === 'ativo' && (
                      <a className="link-acao"
                         href={`/parcelas/${p.id}/baixar?voltar=${encodeURIComponent('/' + tipo)}`}>
                        Dar baixa
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {linhas.length >= 500 && (
          <div className="rodape">Mostrando 500 parcelas. Refine o filtro para ver o restante.</div>
        )}
      </div>
    </main>
  );
}
