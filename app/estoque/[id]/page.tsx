import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';
import { notFound } from 'next/navigation';
import FormMovimento from './FormMovimento';
import { estornarMovimento, mudarSituacao } from '../acoes';

export const dynamic = 'force-dynamic';

const SITUACAO: Record<string, { texto: string; tag: string }> = {
  disponivel:    { texto: 'disponível',    tag: 'tag-entrada' },
  reservado:     { texto: 'reservado',     tag: 'tag-alerta' },
  sob_encomenda: { texto: 'sob encomenda', tag: 'tag-alerta' },
  vendido:       { texto: 'vendido',       tag: 'tag-transf' },
  permutado:     { texto: 'permutado',     tag: 'tag-transf' },
  baixado:       { texto: 'baixado',       tag: 'tag-saida' },
  cancelado:     { texto: 'cancelado',     tag: 'tag-saida' },
};
const MOV: Record<string, { texto: string; entrada: boolean }> = {
  entrada:        { texto: 'Entrada',  entrada: true },
  saida:          { texto: 'Saída',    entrada: false },
  ajuste_entrada: { texto: 'Ajuste +', entrada: true },
  ajuste_saida:   { texto: 'Ajuste −', entrada: false },
};

export default async function DetalheItem({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ movimentado?: string; estornado?: string; situacao?: string }>;
}) {
  const ctx = await exigirEmpresa();
  const { id } = await params;
  const aviso = await searchParams;
  const itemId = Number(id);
  if (!itemId) notFound();

  const [linhas, movimentos, centros, pessoas] = await Promise.all([
    q(`select i.*, i.quantidade::float8 as quantidade,
              i.custo_unitario::float8 as custo, i.preco_venda::float8 as preco,
              i.quantidade_minima::float8 as minimo, i.area_privativa::float8 as area,
              i.data_entrada::text as entrada, i.data_saida::text as saida,
              (i.quantidade * i.custo_unitario)::float8 as valor_custo,
              g.nome as grupo_nome, g.controle, g.tipo as grupo_tipo, g.observacao as grupo_obs,
              ce.codigo || ' ' || ce.descricao as conta_estoque,
              cr.codigo || ' ' || cr.descricao as conta_receita,
              cs.codigo || ' ' || cs.descricao as conta_custo,
              e.razao_social as empresa, cc.nome as centro_custo,
              pe.nome_razao_social as pessoa
         from item i
         join item_grupo g on g.id = i.grupo_id
         join empresa e on e.id = i.empresa_id
         left join plano_conta ce on ce.id = g.conta_estoque_id
         left join plano_conta cr on cr.id = g.conta_receita_id
         left join plano_conta cs on cs.id = g.conta_custo_id
         left join centro_custo cc on cc.id = i.centro_custo_id
         left join pessoa pe on pe.id = i.pessoa_id
        where i.id = $1`, [itemId]),
    q(`select m.id, m.tipo, m.data::text as data, m.quantidade::float8 as quantidade,
              m.valor_unitario::float8 as unitario, m.valor_total::float8 as total,
              m.documento, m.historico, m.estornado_em, m.criado_por, m.lancamento_id,
              l.numero as lancamento_numero,
              cc.nome as centro_custo, pe.nome_razao_social as pessoa
         from movimento_estoque m
         left join lancamento l on l.id = m.lancamento_id
         left join centro_custo cc on cc.id = m.centro_custo_id
         left join pessoa pe on pe.id = m.pessoa_id
        where m.item_id = $1 order by m.data desc, m.id desc`, [itemId]),
    q(`select id, nome from centro_custo where status <> 'cancelada'
        and empresa_id = (select empresa_id from item where id = $1) order by nome`, [itemId]),
    q(`select id, nome_razao_social from pessoa where ativo
        order by nome_razao_social limit 2000`),
  ]);

  const i = linhas[0];
  if (!i) notFound();
  const s = SITUACAO[i.status] ?? { texto: i.status, tag: 'tag-transf' };
  const vivos = movimentos.filter((m: any) => !m.estornado_em);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">
            Estoque · {i.grupo_nome}
            {ctx.todas && ` · ${nomeCurto(i.empresa)}`}
          </div>
          <h1>{i.identificacao}</h1>
          <p className="sub">
            {[i.codigo, i.descricao, i.centro_custo, i.localizacao].filter(Boolean).join(' · ') ||
              'Sem descrição adicional'}
          </p>
        </div>
        <a className="aplicar" href={`/estoque/${i.id}/editar`}>Editar</a>
      </div>

      {aviso.movimentado && <div className="sucesso">Movimento registrado e saldo recalculado.</div>}
      {aviso.estornado && <div className="sucesso">Movimento estornado. O saldo voltou ao que era.</div>}
      {aviso.situacao && <div className="sucesso">Situação alterada.</div>}
      {!i.conta_estoque && i.controle !== 'nenhum' && (
        <div className="aviso">
          <strong>Sem conta de estoque.</strong> O grupo <em>{i.grupo_nome}</em> ainda não aponta
          para uma conta do plano — este item aparece no estoque, mas não vai gerar partida
          contábil enquanto isso não for resolvido na reestruturação do plano de contas.
        </div>
      )}

      <div className="cards">
        <div className="card destaque-navy">
          <div className="rotulo">Situação</div>
          <div className="valor" style={{ fontSize: 18 }}>
            <span className={`tag ${s.tag}`}>{s.texto}</span>
          </div>
          <div className="nota">{i.pessoa ? i.pessoa : 'sem contraparte'}</div>
        </div>
        <div className="card">
          <div className="rotulo">Saldo</div>
          <div className="valor tabular">
            {i.controle === 'nenhum' ? '—'
              : i.controle === 'unidade' ? (i.quantidade > 0 ? '1 un' : '0 un')
              : `${i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${i.unidade}`}
          </div>
          <div className="nota">
            {i.controle === 'nenhum' ? 'não estoca'
              : i.minimo != null ? `mínimo de ${i.minimo} ${i.unidade}`
              : `${vivos.length} ${vivos.length === 1 ? 'movimento' : 'movimentos'}`}
          </div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">{i.controle === 'unidade' ? 'Custo acumulado' : 'Custo unitário'}</div>
          <div className="valor tabular">{brl(i.custo)}</div>
          <div className="nota">
            {i.controle === 'quantidade'
              ? `${brl(i.valor_custo)} em estoque`
              : i.conta_estoque || 'sem conta de estoque'}
          </div>
        </div>
        <div className="card destaque-positivo">
          <div className="rotulo">Preço de venda</div>
          <div className="valor tabular">{i.preco > 0 ? brl(i.preco) : '—'}</div>
          <div className="nota">
            {i.preco > 0 && i.custo > 0
              ? `margem de ${brl(i.preco - i.custo)}`
              : i.conta_receita || 'sem preço definido'}
          </div>
        </div>
      </div>

      {i.controle === 'unidade' && !['vendido', 'cancelado', 'baixado'].includes(i.status) && (
        <div className="bloco">
          <h2>Mudar situação</h2>
          <div className="acoes" style={{ justifyContent: 'flex-start' }}>
            {(['disponivel', 'reservado', 'vendido', 'permutado', 'baixado'] as const)
              .filter((st) => st !== i.status)
              .map((st) => (
                <form key={st} action={mudarSituacao}>
                  <input type="hidden" name="item_id" value={i.id} />
                  <input type="hidden" name="status" value={st} />
                  <button className="btn-secundario" type="submit">
                    Marcar como {SITUACAO[st].texto}
                  </button>
                </form>
              ))}
          </div>
          <div className="dica">
            Peça única: vender zera o saldo. O custo acumulado continua registrado para virar
            CMV quando a contabilidade for regerada.
          </div>
        </div>
      )}

      {i.controle !== 'nenhum' && (
        <FormMovimento itemId={i.id} controle={i.controle} unidade={i.unidade}
                       centros={centros as any}
                       pessoas={(pessoas as any).map((p: any) =>
                         ({ id: p.id, nome: p.nome_razao_social }))}
                       hoje={hoje} />
      )}

      <div className="bloco">
        <h2>Movimentos</h2>
        {movimentos.length === 0 ? (
          <div className="vazio">Nenhum movimento registrado neste item.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Tipo</th><th>Histórico</th>
                  <th className="num">Qtd.</th><th className="num">Unitário</th>
                  <th className="num">Total</th>
                  <th className="oculta-mobile">Documento</th>
                  <th className="oculta-mobile">Vínculo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m: any) => {
                  const t = MOV[m.tipo] ?? { texto: m.tipo, entrada: true };
                  return (
                    <tr key={m.id} style={m.estornado_em ? { opacity: .5 } : undefined}>
                      <td className="tabular">{dataBR(m.data)}</td>
                      <td>
                        <span className={`tag ${t.entrada ? 'tag-entrada' : 'tag-saida'}`}>
                          {t.texto}
                        </span>
                      </td>
                      <td>
                        <div className="desc">{m.historico}</div>
                        {m.estornado_em && <div className="sub v-saida">estornado</div>}
                      </td>
                      <td className="num tabular">
                        {Number(m.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                      </td>
                      <td className="num tabular sub">{m.unitario > 0 ? brl(m.unitario) : '—'}</td>
                      <td className={`num tabular ${t.entrada ? 'v-entrada' : 'v-saida'}`}>
                        {m.total > 0 ? brl(m.total) : '—'}
                      </td>
                      <td className="sub oculta-mobile">{m.documento || '—'}</td>
                      <td className="sub oculta-mobile">
                        {m.lancamento_id
                          ? <a className="link-acao" href={`/lancamentos/${m.lancamento_id}`}>
                              {m.lancamento_numero}
                            </a>
                          : m.pessoa || m.centro_custo || '—'}
                      </td>
                      <td>
                        {!m.estornado_em && (
                          <form action={estornarMovimento}>
                            <input type="hidden" name="movimento_id" value={m.id} />
                            <input type="hidden" name="item_id" value={i.id} />
                            <button className="btn-perigo" type="submit">Estornar</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
