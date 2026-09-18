import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

const SITUACAO: Record<string, { texto: string; tag: string }> = {
  disponivel:    { texto: 'disponível',    tag: 'tag-entrada' },
  reservado:     { texto: 'reservado',     tag: 'tag-alerta' },
  sob_encomenda: { texto: 'sob encomenda', tag: 'tag-alerta' },
  vendido:       { texto: 'vendido',       tag: 'tag-transf' },
  permutado:     { texto: 'permutado',     tag: 'tag-transf' },
  baixado:       { texto: 'baixado',       tag: 'tag-saida' },
  cancelado:     { texto: 'cancelado',     tag: 'tag-saida' },
};
const qtd = (v: number, unidade: string) =>
  `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${unidade}`;

export default async function Estoque({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa('estoque');
  const sp = await searchParams;
  const grupo = str(sp.grupo);
  const situacao = str(sp.situacao) || 'em_estoque';
  const busca = str(sp.busca).trim();
  const inativos = str(sp.inativos) === '1';
  const salvo = str(sp.salvo);

  const [linhas, grupos] = await Promise.all([
    q(`select i.id, i.codigo, i.identificacao, i.descricao, i.unidade, i.status,
              i.quantidade::float8 as quantidade, i.quantidade_minima::float8 as minimo,
              i.custo_unitario::float8 as custo, i.preco_venda::float8 as preco,
              i.localizacao, i.bloco, i.andar, i.area_privativa::float8 as area,
              i.data_entrada::text as entrada,
              (i.quantidade * i.custo_unitario)::float8 as valor_custo,
              (i.quantidade * coalesce(i.preco_venda, 0))::float8 as valor_venda,
              g.codigo as grupo_codigo, g.nome as grupo_nome, g.controle, g.tipo,
              g.conta_estoque_id is null and g.controle <> 'nenhum' as conta_pendente,
              e.razao_social as empresa, cc.nome as centro_custo,
              pe.nome_razao_social as pessoa
         from item i
         join item_grupo g on g.id = i.grupo_id
         join empresa e on e.id = i.empresa_id
         left join centro_custo cc on cc.id = i.centro_custo_id
         left join pessoa pe on pe.id = i.pessoa_id
        where ($1::bigint is null or i.empresa_id = $1)
          and ($5 or i.ativo)
          and ($2 = '' or g.codigo = $2)
          and (case when $3 = 'em_estoque'
                    then i.status in ('disponivel','reservado','sob_encomenda')
                    when $3 = 'todos' then true
                    else i.status = $3 end)
          and ($4 = '' or i.identificacao ilike '%'||$4||'%'
                       or coalesce(i.codigo,'') ilike '%'||$4||'%'
                       or coalesce(i.codigo_barras,'') = $4
                       or coalesce(i.descricao,'') ilike '%'||$4||'%')
        order by g.tipo, g.nome, i.identificacao`,
      [ctx.id, grupo, situacao, busca, inativos]),
    q(`select g.codigo, g.nome, g.controle,
              (select count(*) from item i where i.grupo_id = g.id
                and ($1::bigint is null or i.empresa_id = $1))::int as itens
         from item_grupo g
        where g.ativo
          and (not exists (select 1 from item_grupo_ramo gr where gr.grupo_id = g.id)
               or exists (select 1 from item_grupo_ramo gr join empresa e on e.ramo = gr.ramo
                           where gr.grupo_id = g.id and e.ativo
                             and ($1::bigint is null or e.id = $1)))
        order by g.tipo, g.nome`, [ctx.id]),
  ]);

  const emEstoque = linhas.filter((i: any) =>
    ['disponivel', 'reservado', 'sob_encomenda'].includes(i.status));
  const totalCusto = emEstoque.reduce((s: number, i: any) => s + i.valor_custo, 0);
  const totalVenda = emEstoque.reduce((s: number, i: any) => s + i.valor_venda, 0);
  const abaixoMinimo = linhas.filter((i: any) =>
    i.controle === 'quantidade' && i.minimo != null && i.quantidade < i.minimo).length;
  const pendencias = linhas.filter((i: any) => i.conta_pendente).length;

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">Estoque</div>
          <h1>Itens</h1>
          <p className="sub">
            {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · {linhas.length}{' '}
            {linhas.length === 1 ? 'item' : 'itens'} · imóveis, mercadorias e mostruário
          </p>
        </div>
        <div className="acoes-cabecalho">
          <a className="btn-secundario" href="/estoque/entrada">Entrada de nota</a>
          <a className="aplicar" href="/estoque/novo">Novo item</a>
        </div>
      </div>

      {salvo && <div className="sucesso">Item salvo.</div>}
      {str(sp.entrada) && (
        <div className="sucesso">
          Entrada registrada em {str(sp.entrada)}{' '}
          {str(sp.entrada) === '1' ? 'item' : 'itens'}
          {Number(str(sp.novos)) > 0 && ` · ${str(sp.novos)} cadastrado${
            str(sp.novos) === '1' ? '' : 's'} agora`}.
        </div>
      )}

      <div className="cards">
        <div className="card destaque-navy">
          <div className="rotulo">Em estoque</div>
          <div className="valor tabular">{emEstoque.length}</div>
          <div className="nota">disponíveis, reservados e sob encomenda</div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">Valor de custo</div>
          <div className="valor tabular">{brl(totalCusto)}</div>
          <div className="nota">o que já foi gasto no que está parado</div>
        </div>
        <div className="card destaque-positivo">
          <div className="rotulo">Valor de venda</div>
          <div className="valor tabular">{brl(totalVenda)}</div>
          <div className="nota">
            {totalCusto > 0 && totalVenda > 0
              ? `margem embutida de ${brl(totalVenda - totalCusto)}`
              : 'preço de tabela dos itens em estoque'}
          </div>
        </div>
        <div className="card">
          <div className="rotulo">Atenção</div>
          <div className="valor tabular">{abaixoMinimo + pendencias}</div>
          <div className="nota">
            {abaixoMinimo > 0 && `${abaixoMinimo} abaixo do mínimo`}
            {abaixoMinimo > 0 && pendencias > 0 && ' · '}
            {pendencias > 0 && `${pendencias} sem conta de estoque`}
            {abaixoMinimo + pendencias === 0 && 'nada pendente'}
          </div>
        </div>
      </div>

      <form className="filtros" method="get">
        <div className="campo cresce">
          <label htmlFor="busca">Buscar</label>
          <input id="busca" name="busca" defaultValue={busca}
                 placeholder="Nome, código, EAN ou descrição" />
        </div>
        <div className="campo">
          <label htmlFor="grupo">Grupo</label>
          <select id="grupo" name="grupo" defaultValue={grupo}>
            <option value="">Todos</option>
            {grupos.map((g: any) => (
              <option key={g.codigo} value={g.codigo}>{g.nome} ({g.itens})</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="situacao">Situação</label>
          <select id="situacao" name="situacao" defaultValue={situacao}>
            <option value="em_estoque">Em estoque</option>
            <option value="todos">Todas</option>
            <option value="disponivel">Disponível</option>
            <option value="reservado">Reservado</option>
            <option value="sob_encomenda">Sob encomenda</option>
            <option value="vendido">Vendido</option>
            <option value="baixado">Baixado</option>
          </select>
        </div>
        <div className="campo">
          <label className="opcional" htmlFor="inativos">
            <input id="inativos" type="checkbox" name="inativos" value="1"
                   defaultChecked={inativos} />
            Ver inativos
          </label>
        </div>
        <button className="aplicar" type="submit">Filtrar</button>
      </form>

      {linhas.length === 0 ? (
        <div className="vazio">
          Nenhum item com esses filtros.{' '}
          <a className="link-acao" href="/estoque/novo">Cadastrar o primeiro</a>
        </div>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Grupo</th>
                <th>Situação</th>
                <th className="num">Saldo</th>
                <th className="num">Custo</th>
                <th className="num">Preço</th>
                <th className="num oculta-mobile">Valor em estoque</th>
                <th className="oculta-mobile">Local</th>
                <th className="oculta-mobile">Centro de custo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((i: any) => {
                const baixo = i.controle === 'quantidade' && i.minimo != null && i.quantidade < i.minimo;
                const s = SITUACAO[i.status] ?? { texto: i.status, tag: 'tag-transf' };
                return (
                  <tr key={i.id} className={String(i.id) === salvo ? 'destaque' : ''}>
                    <td>
                      <a className="desc-link" href={`/estoque/${i.id}`}>
                        <div className="desc">{i.identificacao}</div>
                      </a>
                      {(() => {
                        const partes = [i.codigo, i.descricao,
                                        ctx.todas ? nomeCurto(i.empresa) : null].filter(Boolean);
                        return partes.length > 0 &&
                          <div className="sub">{partes.join(' · ')}</div>;
                      })()}
                    </td>
                    <td>
                      <span className="tag tag-transf">{i.grupo_nome}</span>
                      {i.conta_pendente && (
                        <div className="sub" title="O grupo ainda não tem conta de estoque no plano de contas">
                          <span className="ponto-sem-descricao" /> sem conta
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`tag ${s.tag}`}>{s.texto}</span>
                      {i.pessoa && <div className="sub">{i.pessoa}</div>}
                    </td>
                    <td className="num tabular">
                      {i.controle === 'nenhum'
                        ? <span className="sub">não estoca</span>
                        : i.controle === 'unidade'
                          ? <span className="sub">{i.quantidade > 0 ? '1 un' : '—'}</span>
                          : <span className={baixo ? 'v-saida' : undefined}>
                              {qtd(i.quantidade, i.unidade)}
                            </span>}
                      {baixo && <div className="sub v-saida">mín. {qtd(i.minimo, i.unidade)}</div>}
                    </td>
                    <td className="num tabular sub">{i.custo > 0 ? brl(i.custo) : '—'}</td>
                    <td className="num tabular">{i.preco > 0 ? brl(i.preco) : '—'}</td>
                    <td className="num tabular oculta-mobile">
                      {i.valor_custo > 0 ? brl(i.valor_custo) : '—'}
                    </td>
                    <td className="sub oculta-mobile">
                      {i.localizacao || [i.bloco, i.andar ? `${i.andar}º` : null]
                        .filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="sub oculta-mobile">{i.centro_custo || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
