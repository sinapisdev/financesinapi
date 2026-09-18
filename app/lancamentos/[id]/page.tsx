import { q, brl, dataBR } from '@/lib/db';
import { notFound } from 'next/navigation';
import { BotaoEstornar, BotaoCancelarLancamento } from './Acoes';
import { exigirEmpresa } from '@/lib/empresa';
import DescricaoEditavel from '@/app/_componentes/DescricaoEditavel';

export const dynamic = 'force-dynamic';

export default async function DetalheLancamento({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ editado?: string }>;
}) {
  await exigirEmpresa();
  const { id } = await params;
  const { editado } = await searchParams;
  const lancId = Number(id);
  if (!lancId) notFound();

  const [linhas, parcelas, baixas] = await Promise.all([
    q(`select l.*, l.valor_total::float8 as valor, l.data_competencia::text as competencia,
              e.razao_social as empresa,
              cc.nome as centro_custo, pe.nome_razao_social as pessoa,
              pr.codigo as processo_codigo, pr.nome as processo_nome,
              ct.codigo as conta_codigo, ct.descricao as conta_nome,
              cd.codigo as debito_codigo, cd.descricao as debito_nome,
              ccr.codigo as credito_codigo, ccr.descricao as credito_nome
         from lancamento l
         join empresa e on e.id = l.empresa_id
         left join centro_custo cc on cc.id = l.centro_custo_id
         left join pessoa pe on pe.id = l.pessoa_id
         left join processo pr on pr.id = l.processo_id
         left join plano_conta ct on ct.id = l.conta_id
         left join plano_conta cd on cd.id = pr.conta_debito_id
         left join plano_conta ccr on ccr.id = pr.conta_credito_id
        where l.id = $1`, [lancId]),
    q(`select p.id, p.numero, p.categoria, p.tipo, p.data_vencimento::text as vencimento,
              p.valor_original::float8 as original, p.valor_baixado::float8 as baixado,
              (p.valor_original - p.valor_baixado)::float8 as saldo, p.status, p.documento,
              (current_date - p.data_vencimento) as dias
         from parcela p where p.lancamento_id = $1 order by p.numero`, [lancId]),
    q(`select b.id, b.data_liquidacao::text as data, b.valor_principal::float8 as principal,
              b.juros::float8 as juros, b.multa::float8 as multa, b.desconto::float8 as desconto,
              b.valor_liquido::float8 as liquido, b.observacao, b.estornada_em, b.motivo_estorno,
              p.numero as parcela_numero, cb.apelido as conta
         from baixa b
         join parcela p on p.id = b.parcela_id
         left join conta_bancaria cb on cb.id = b.conta_bancaria_id
        where p.lancamento_id = $1 order by b.data_liquidacao, b.id`, [lancId]),
  ]);

  const l = linhas[0];
  if (!l) notFound();

  const totalBaixado = parcelas.reduce((s: number, p: any) => s + p.baixado, 0);
  const saldo = l.valor - totalBaixado;
  const voltarPara = `/lancamentos/${lancId}`;

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">{l.tipo === 'receita' ? 'Receita' : 'Despesa'} · {l.numero}</div>
          <h1 className="titulo-editavel">
            <DescricaoEditavel id={lancId} descricao={l.descricao}
                               automatica={l.descricao_automatica} />
          </h1>
          <p className="sub">
            {l.empresa} · {dataBR(l.competencia)}
            {l.centro_custo && ` · ${l.centro_custo}`}
            {l.status === 'cancelado' && ' · CANCELADO'}
          </p>
        </div>
        <div className="acoes">
          <a className="btn-secundario" href="/lancamentos">Voltar</a>
          {l.status === 'ativo' && (
            <a className="aplicar" href={`/lancamentos/${lancId}/editar`}>Editar</a>
          )}
          {l.status === 'ativo' && <BotaoCancelarLancamento lancamentoId={lancId} />}
        </div>
      </div>

      {l.status === 'cancelado' && (
        <div className="aviso">
          Este lançamento está <strong>cancelado</strong>. As parcelas em aberto foram canceladas
          junto; baixas já efetuadas continuam valendo no caixa, porque o dinheiro se moveu.
        </div>
      )}
      {editado && <div className="sucesso">Lançamento atualizado.</div>}
      {l.requer_revisao && (
        <div className="aviso">Marcado para revisão na migração: {l.motivo_revisao}</div>
      )}

      <section className="cards">
        <div className="card destaque-navy">
          <div className="rotulo">Valor do lançamento</div>
          <div className="valor tabular">{brl(l.valor)}</div>
          <div className="nota">{parcelas.length} parcela(s)</div>
        </div>
        <div className="card destaque-positivo">
          <div className="rotulo">Baixado</div>
          <div className="valor tabular v-entrada">{brl(totalBaixado)}</div>
        </div>
        <div className="card destaque-negativo">
          <div className="rotulo">Em aberto</div>
          <div className="valor tabular">{brl(saldo)}</div>
        </div>
      </section>

      <section className="bloco">
        <h2>Contabilização</h2>
        <div className="par-contas">
          <div className="perna">
            <span className="perna-rotulo">Processo</span>
            <strong>{l.processo_codigo ?? '—'}</strong>
            <span className="perna-nome">{l.processo_nome ?? 'sem processo'}</span>
          </div>
          <div className="perna">
            <span className="perna-rotulo">Conta</span>
            <strong>{l.conta_codigo ?? l.debito_codigo ?? '—'}</strong>
            <span className="perna-nome">{l.conta_nome ?? l.debito_nome ?? 'não definida'}</span>
            {!l.conta_codigo && l.debito_codigo && <span className="tag tag-alerta">do processo</span>}
          </div>
          <div className="perna">
            <span className="perna-rotulo">Contraparte</span>
            <span className="perna-nome">{l.pessoa ?? '—'}</span>
          </div>
        </div>
      </section>

      <section className="bloco">
        <h2>Parcelas</h2>
        <div className="tabela-wrap" style={{ boxShadow: 'none', border: '1px solid var(--linha)' }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Tipo</th><th>Vencimento</th>
                <th className="num">Valor</th><th className="num">Baixado</th><th className="num">Saldo</th>
                <th>Situação</th><th></th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p: any) => {
                const vencida = ['aberta', 'parcial'].includes(p.status) && p.dias > 0;
                const podeBaixar = ['aberta', 'parcial'].includes(p.status) && l.status === 'ativo';
                return (
                  <tr key={p.id}>
                    <td className="tabular">{p.numero}</td>
                    <td><span className={`tag tag-${p.categoria ?? 'parcela'}`}>{p.categoria ?? 'parcela'}</span></td>
                    <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                      {dataBR(p.vencimento)}
                      {vencida && <div className="sub v-saida">{p.dias} dias</div>}
                    </td>
                    <td className="num tabular">{brl(p.original)}</td>
                    <td className="num tabular sub">{p.baixado > 0 ? brl(p.baixado) : '—'}</td>
                    <td className="num tabular"><strong>{brl(p.saldo)}</strong></td>
                    <td>
                      {p.status === 'liquidada' && <span className="tag tag-entrada">liquidada</span>}
                      {p.status === 'parcial' && <span className="tag tag-alerta">parcial</span>}
                      {p.status === 'cancelada' && <span className="tag tag-transf">cancelada</span>}
                      {p.status === 'aberta' && (vencida
                        ? <span className="tag tag-saida">vencida</span>
                        : <span className="tag tag-transf">em aberto</span>)}
                    </td>
                    <td className="num">
                      {podeBaixar && (
                        <a className="link-acao" href={`/parcelas/${p.id}/baixar?voltar=${encodeURIComponent(voltarPara)}`}>
                          Dar baixa
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bloco">
        <h2>Baixas <span className="sub" style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
          {baixas.length === 0 ? 'nenhuma' : `${baixas.filter((b: any) => !b.estornada_em).length} ativa(s)`}
        </span></h2>
        {baixas.length === 0 ? (
          <p className="dica">Nenhuma baixa registrada neste lançamento.</p>
        ) : (
          <div className="tabela-wrap" style={{ boxShadow: 'none', border: '1px solid var(--linha)' }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Parcela</th><th>Conta</th>
                  <th className="num">Principal</th><th className="num">Juros/Multa</th>
                  <th className="num">Desconto</th><th className="num">Líquido</th><th></th>
                </tr>
              </thead>
              <tbody>
                {baixas.map((b: any) => (
                  <tr key={b.id} style={b.estornada_em ? { opacity: .55 } : undefined}>
                    <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{dataBR(b.data)}</td>
                    <td className="tabular">{b.parcela_numero}</td>
                    <td className="sub">{b.conta ?? '—'}</td>
                    <td className="num tabular">{brl(b.principal)}</td>
                    <td className="num tabular sub">{b.juros + b.multa > 0 ? brl(b.juros + b.multa) : '—'}</td>
                    <td className="num tabular sub">{b.desconto > 0 ? brl(b.desconto) : '—'}</td>
                    <td className="num tabular"><strong>{brl(b.liquido)}</strong></td>
                    <td className="num">
                      {b.estornada_em
                        ? <span className="tag tag-transf" title={b.motivo_estorno}>estornada</span>
                        : <BotaoEstornar baixaId={b.id} voltarPara={voltarPara} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
