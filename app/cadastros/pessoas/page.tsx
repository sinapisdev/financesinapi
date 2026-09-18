import { q, brl } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { formatarDocumento } from '@/lib/documento';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function Pessoas({ searchParams }: { searchParams: Promise<Params> }) {
  await exigirEmpresa('cadastros');
  const sp = await searchParams;
  const busca = str(sp.busca);
  const papel = str(sp.papel);
  const situacao = str(sp.situacao) || 'ativos';
  const salvo = str(sp.salvo);

  const cond: string[] = [];
  const args: unknown[] = [];
  if (busca) {
    args.push(`%${busca}%`);
    cond.push(`(p.nome_razao_social ilike $${args.length} or p.nome_fantasia ilike $${args.length}
                or p.cpf_cnpj like $${args.length} or p.email ilike $${args.length})`);
  }
  if (papel === 'cliente')    cond.push('p.eh_cliente');
  if (papel === 'fornecedor') cond.push('p.eh_fornecedor');
  if (papel === 'vendedor')   cond.push('p.eh_vendedor');
  if (situacao === 'ativos')  cond.push('p.ativo');
  if (situacao === 'inativos') cond.push('not p.ativo');
  const where = cond.length ? `where ${cond.join(' and ')}` : '';

  const linhas = await q(`
    select p.id, p.nome_razao_social, p.nome_fantasia, p.cpf_cnpj, p.tipo_pessoa,
           p.email, p.telefone, p.cidade, p.uf, p.ativo,
           p.eh_cliente, p.eh_fornecedor, p.eh_vendedor,
           (select count(*) from lancamento l where l.pessoa_id = p.id and l.status='ativo')::int as lancamentos,
           (select coalesce(sum(pa.valor_original - pa.valor_baixado), 0)
              from parcela pa where pa.pessoa_id = p.id and pa.status in ('aberta','parcial'))::float8 as em_aberto
      from pessoa p ${where}
     order by p.nome_razao_social limit 300`, args);

  const [tot] = await q(`select count(*)::int as qtd,
      count(*) filter (where eh_cliente)::int as clientes,
      count(*) filter (where eh_fornecedor)::int as fornecedores,
      count(*) filter (where eh_vendedor)::int as vendedores,
      count(*) filter (where not ativo)::int as inativos from pessoa`);

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">Cadastros</div>
          <h1>Clientes e fornecedores</h1>
          <p className="sub">
            {tot.qtd} cadastros · {tot.clientes} clientes · {tot.fornecedores} fornecedores ·
            {' '}{tot.vendedores} vendedores{tot.inativos > 0 && ` · ${tot.inativos} inativos`}
          </p>
        </div>
        <a className="aplicar" href="/cadastros/pessoas/nova">Novo cadastro</a>
      </div>

      {salvo && <div className="sucesso">Cadastro salvo.</div>}

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="papel">Papel</label>
          <select id="papel" name="papel" defaultValue={papel}>
            <option value="">Todos</option>
            <option value="cliente">Clientes</option>
            <option value="fornecedor">Fornecedores</option>
            <option value="vendedor">Vendedores</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="situacao">Situação</label>
          <select id="situacao" name="situacao" defaultValue={situacao}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="campo cresce">
          <label htmlFor="busca">Buscar</label>
          <input id="busca" name="busca" defaultValue={busca} placeholder="Nome, documento ou e-mail" />
        </div>
        <button className="aplicar" type="submit">Aplicar</button>
      </form>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th className="oculta-mobile">Documento</th>
              <th>Papéis</th>
              <th className="oculta-mobile">Cidade</th>
              <th className="oculta-mobile">Contato</th>
              <th className="num">Lançamentos</th>
              <th className="num">Em aberto</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={7}><div className="vazio">Nenhum cadastro nesse filtro.</div></td></tr>
            )}
            {linhas.map((p: any) => (
              <tr key={p.id} className={String(p.id) === salvo ? 'destaque' : ''}
                  style={!p.ativo ? { opacity: .55 } : undefined}>
                <td>
                  <a className="desc-link" href={`/cadastros/pessoas/${p.id}`}>
                    <div className="desc">{p.nome_razao_social}</div>
                  </a>
                  <div className="sub">
                    {p.nome_fantasia || (p.tipo_pessoa === 'PF' ? 'pessoa física' : 'pessoa jurídica')}
                    {!p.ativo && ' · INATIVO'}
                  </div>
                </td>
                <td className="tabular sub oculta-mobile">{formatarDocumento(p.cpf_cnpj)}</td>
                <td>
                  <span className="papel-tag">
                    {p.eh_cliente && <span className="tag tag-entrada">cliente</span>}
                    {p.eh_fornecedor && <span className="tag tag-saida">fornec.</span>}
                    {p.eh_vendedor && <span className="tag tag-alerta">vend.</span>}
                  </span>
                </td>
                <td className="sub oculta-mobile">{p.cidade ? `${p.cidade}${p.uf ? '/' + p.uf : ''}` : '—'}</td>
                <td className="sub oculta-mobile">{p.email || p.telefone || '—'}</td>
                <td className="num tabular sub">{p.lancamentos || '—'}</td>
                <td className="num tabular">{p.em_aberto > 0 ? brl(p.em_aberto) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
