'use client';

import { useActionState, useMemo, useState } from 'react';
import { editarLancamento, type Resultado } from '../../acoes';
import { paraCentavos, deCentavos } from '@/lib/parcelamento';

type Opcao = { id: number; nome: string };
type Processo = {
  id: number; codigo: string; nome: string;
  debito_codigo: string | null; debito_nome: string | null; debito_analitica: boolean;
  credito_codigo: string | null; credito_nome: string | null; credito_analitica: boolean;
};
type Conta = { id: number; codigo: string; descricao: string };
type Parcela = { id: number; numero: number; categoria: string; vencimento: string; valor: number; status: string };

export default function Formulario({ lanc, parcelas, centros, processos, pessoas, planoContas, baixas }: {
  lanc: any; parcelas: Parcela[]; centros: Opcao[]; processos: Processo[];
  pessoas: (Opcao & { eh_cliente: boolean; eh_fornecedor: boolean })[];
  planoContas: Conta[]; baixas: number;
}) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(editarLancamento, {});
  const [processoId, setProcessoId] = useState(String(lanc.processo_id ?? ''));
  const [contaId, setContaId] = useState(String(lanc.conta_id ?? ''));
  const [valor, setValor] = useState(Number(lanc.valor).toFixed(2).replace('.', ','));

  const travado = baixas > 0;
  const processo = processos.find(p => String(p.id) === processoId);

  const escolha = useMemo(() => {
    if (!processo) return null;
    if (processo.debito_codigo && !processo.debito_analitica)
      return { lado: 'débito' as const, raiz: processo.debito_codigo, nome: processo.debito_nome };
    if (processo.credito_codigo && !processo.credito_analitica)
      return { lado: 'crédito' as const, raiz: processo.credito_codigo, nome: processo.credito_nome };
    return null;
  }, [processo]);

  const contasDisponiveis = useMemo(
    () => (escolha ? planoContas.filter(c => c.codigo.startsWith(escolha.raiz + '.')) : []),
    [escolha, planoContas]);
  const precisaConta = !!escolha && contasDisponiveis.length > 0;

  // prévia da redistribuição proporcional
  const novoValor = paraCentavos(valor);
  const valorAtual = Math.round(Number(lanc.valor) * 100);
  const mudouValor = novoValor > 0 && novoValor !== valorAtual;
  const ativas = parcelas.filter(p => p.status !== 'cancelada');
  const previa = useMemo(() => {
    if (!mudouValor || !ativas.length) return null;
    const somaAntiga = ativas.reduce((s, p) => s + Math.round(p.valor * 100), 0);
    let acc = 0;
    return ativas.map((p, i) => {
      const v = i === ativas.length - 1 ? novoValor - acc
              : Math.round(Math.round(p.valor * 100) * novoValor / somaAntiga);
      acc += v;
      return { ...p, novo: v };
    });
  }, [mudouValor, novoValor, ativas]);

  const contraparte = pessoas.filter(p => (lanc.tipo === 'receita' ? p.eh_cliente : p.eh_fornecedor));

  return (
    <form action={acao}>
      <input type="hidden" name="lancamento_id" value={lanc.id} />
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Lançamento</h2>
        <div className="grade">
          <div className="campo c3">
            <label htmlFor="data_competencia">Data do lançamento</label>
            <input id="data_competencia" type="date" name="data_competencia"
                   defaultValue={lanc.competencia} required />
          </div>
          <div className="campo c5">
            <label htmlFor="centro_custo_id">Centro de custo</label>
            <select id="centro_custo_id" name="centro_custo_id" defaultValue={lanc.centro_custo_id ?? ''}>
              <option value="">—</option>
              {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="campo c4">
            <label htmlFor="pessoa_id">{lanc.tipo === 'receita' ? 'Cliente' : 'Fornecedor'}</label>
            <select id="pessoa_id" name="pessoa_id" defaultValue={lanc.pessoa_id ?? ''}>
              <option value="">—</option>
              {contraparte.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="campo c8">
            <label htmlFor="descricao">Descrição</label>
            <input id="descricao" name="descricao" className="maiusculas" required minLength={3}
                   defaultValue={lanc.descricao_automatica ? '' : lanc.descricao}
                   placeholder={lanc.descricao_automatica ? lanc.descricao : undefined} />
          </div>
          <div className="campo c4">
            <label htmlFor="observacao">Observação</label>
            <input id="observacao" name="observacao" className="maiusculas"
                   defaultValue={lanc.observacao ?? ''} placeholder="opcional" />
          </div>
        </div>
      </section>

      <section className="bloco">
        <h2>Contabilização</h2>
        <div className="grade">
          <div className="campo c5">
            <label htmlFor="processo_id">Processo</label>
            <select id="processo_id" name="processo_id" value={processoId}
                    onChange={(e) => { setProcessoId(e.target.value); setContaId(''); }}>
              <option value="">—</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
            </select>
          </div>
          {precisaConta && (
            <div className="campo c7">
              <label htmlFor="conta_id">Conta de {escolha!.lado} — analítica dentro de {escolha!.raiz}</label>
              <select id="conta_id" name="conta_id" value={contaId}
                      onChange={(e) => setContaId(e.target.value)} required>
                <option value="">Escolha a conta…</option>
                {contasDisponiveis.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {processo && !precisaConta && (
          <p className="dica" style={{ marginTop: 12 }}>
            As contas deste processo já são analíticas — não há escolha a fazer.
          </p>
        )}
      </section>

      <section className="bloco">
        <h2>
          Valor
          {travado && <span className="selo selo-erro">travado por baixa</span>}
        </h2>

        {travado ? (
          <>
            <div className="grade">
              <div className="campo c3">
                <label>Valor do lançamento</label>
                <input value={deCentavos(valorAtual)} disabled />
              </div>
            </div>
            <p className="dica" style={{ marginTop: 12 }}>
              Este lançamento já tem <strong>{baixas} baixa(s)</strong>. Mudar o valor agora
              descolaria o sistema do extrato bancário. Para alterar, estorne as baixas antes —
              ou cancele o lançamento e refaça.
            </p>
          </>
        ) : (
          <>
            <div className="grade">
              <div className="campo c3">
                <label htmlFor="valor_total">Valor do lançamento</label>
                <input id="valor_total" name="valor_total" inputMode="decimal"
                       value={valor} onChange={(e) => setValor(e.target.value)} required />
              </div>
            </div>
            {previa ? (
              <>
                <p className="dica" style={{ margin: '12px 0 10px' }}>
                  As {previa.length} parcelas serão redistribuídas proporcionalmente, mantendo
                  datas e quantidade:
                </p>
                <div className="previa">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Tipo</th><th>Vencimento</th>
                          <th className="num">Hoje</th><th className="num">Fica</th></tr>
                    </thead>
                    <tbody>
                      {previa.map(p => (
                        <tr key={p.id}>
                          <td className="tabular">{p.numero}</td>
                          <td><span className={`tag tag-${p.categoria ?? 'parcela'}`}>{p.categoria ?? 'parcela'}</span></td>
                          <td className="tabular">{p.vencimento.split('-').reverse().join('/')}</td>
                          <td className="num tabular sub">{deCentavos(Math.round(p.valor * 100))}</td>
                          <td className="num tabular"><strong>{deCentavos(p.novo)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="dica" style={{ marginTop: 12 }}>
                Sem baixas neste lançamento, então o valor pode mudar. As parcelas se
                ajustam proporcionalmente.
              </p>
            )}
          </>
        )}
      </section>

      <div className="acoes">
        <a className="btn-secundario" href={`/lancamentos/${lanc.id}`}>Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
