'use client';

import { useActionState, useMemo, useState } from 'react';
import { criarLancamento, type Resultado } from '../acoes';
import { gerarParcelas, paraCentavos, deCentavos, restanteParaParcelas } from '@/lib/parcelamento';

type Opcao = { id: number; nome: string };
type Processo = {
  id: number; codigo: string; nome: string; tipo: string;
  debito_codigo: string | null;  debito_nome: string | null;  debito_analitica: boolean;
  credito_codigo: string | null; credito_nome: string | null; credito_analitica: boolean;
};
type Conta = { id: number; codigo: string; descricao: string };

export default function Formulario({ empresas, centros, processos, pessoas, contas, planoContas, empresaFixa }: {
  empresas: Opcao[]; centros: Opcao[]; processos: Processo[];
  pessoas: (Opcao & { eh_cliente: boolean; eh_fornecedor: boolean })[];
  contas: (Opcao & { empresa_id: number })[];
  planoContas: Conta[];
  empresaFixa: number | null;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(criarLancamento, {});

  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [empresaId, setEmpresaId] = useState(String(empresaFixa ?? empresas[0]?.id ?? ''));
  const [processoId, setProcessoId] = useState('');
  const [contaId, setContaId] = useState('');
  const [forma, setForma] = useState<'avista' | 'prazo'>('avista');
  const [competencia, setCompetencia] = useState(hoje);
  const [valor, setValor] = useState('');
  const [entrada, setEntrada] = useState('');
  const [dataEntrada, setDataEntrada] = useState(hoje);
  const [numParcelas, setNumParcelas] = useState('1');
  const [primeiroVenc, setPrimeiroVenc] = useState(hoje);
  const [periodicidade, setPeriodicidade] = useState('1');
  const [usarBaloes, setUsarBaloes] = useState(false);
  const [numBaloes, setNumBaloes] = useState('');
  const [valorBalao, setValorBalao] = useState('');
  const [primeiroBalao, setPrimeiroBalao] = useState('');
  const [periodicidadeBaloes, setPeriodicidadeBaloes] = useState('6');
  const [usarChaves, setUsarChaves] = useState(false);
  const [valorChaves, setValorChaves] = useState('');
  const [dataChaves, setDataChaves] = useState('');

  const plano = useMemo(() => ({
    valorTotal: paraCentavos(valor),
    aVista: forma === 'avista',
    dataBase: competencia,
    numParcelas: Number(numParcelas) || 0,
    primeiroVencimento: primeiroVenc,
    periodicidadeMeses: Number(periodicidade) || 1,
    valorEntrada: paraCentavos(entrada),
    dataEntrada,
    numBaloes: usarBaloes ? Number(numBaloes) || 0 : 0,
    valorBalao: usarBaloes ? paraCentavos(valorBalao) : 0,
    primeiroBalao: usarBaloes ? primeiroBalao : undefined,
    periodicidadeBaloes: Number(periodicidadeBaloes) || 6,
    valorChaves: usarChaves ? paraCentavos(valorChaves) : 0,
    dataChaves: usarChaves ? dataChaves : undefined,
  }), [valor, forma, competencia, numParcelas, primeiroVenc, periodicidade, entrada, dataEntrada,
       usarBaloes, numBaloes, valorBalao, primeiroBalao, periodicidadeBaloes, usarChaves, valorChaves, dataChaves]);

  const parcelas = useMemo(() => gerarParcelas(plano), [plano]);
  const soma = parcelas.reduce((s, p) => s + p.valor, 0);
  const fecha = soma === plano.valorTotal && plano.valorTotal > 0;
  const sobra = restanteParaParcelas(plano);

  const contraparte = pessoas.filter(p => (tipo === 'receita' ? p.eh_cliente : p.eh_fornecedor));
  const contasDaEmpresa = contas.filter(c => String(c.empresa_id) === empresaId);

  const processo = processos.find(p => String(p.id) === processoId);

  // O processo aponta o par de contas. Quando uma delas é SINTÉTICA
  // (6.1 despesas administrativas, 5.1 custos de obra…), é quem lança que
  // diz qual analítica de fato — despesas com pessoal, material, etc.
  const escolha = useMemo(() => {
    if (!processo) return null;
    if (processo.debito_codigo && !processo.debito_analitica)
      return { lado: 'débito' as const, raiz: processo.debito_codigo, nome: processo.debito_nome };
    if (processo.credito_codigo && !processo.credito_analitica)
      return { lado: 'crédito' as const, raiz: processo.credito_codigo, nome: processo.credito_nome };
    return null;
  }, [processo]);

  const contasDisponiveis = useMemo(() => {
    if (!escolha) return [];
    return planoContas.filter(c => c.codigo.startsWith(escolha.raiz + '.'));
  }, [escolha, planoContas]);

  const precisaConta = !!escolha && contasDisponiveis.length > 0;
  const contaOk = !precisaConta || !!contaId;

  return (
    <form action={acao}>
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Lançamento</h2>
        <div className="grade">
          <div className="campo c3">
            <label>Tipo</label>
            <div className="radios">
              <label className={tipo === 'despesa' ? 'sel' : ''}>
                <input type="radio" name="tipo" value="despesa" checked={tipo === 'despesa'}
                       onChange={() => setTipo('despesa')} /> Despesa
              </label>
              <label className={tipo === 'receita' ? 'sel' : ''}>
                <input type="radio" name="tipo" value="receita" checked={tipo === 'receita'}
                       onChange={() => setTipo('receita')} /> Receita
              </label>
            </div>
          </div>
          {empresaFixa ? (
            <input type="hidden" name="empresa_id" value={empresaFixa} />
          ) : (
            <div className="campo c4">
              <label htmlFor="empresa_id">Empresa</label>
              <select id="empresa_id" name="empresa_id" value={empresaId}
                      onChange={(e) => setEmpresaId(e.target.value)} required>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          )}
          <div className={empresaFixa ? 'campo c9' : 'campo c5'}>
            <label htmlFor="centro_custo_id">Centro de custo</label>
            <select id="centro_custo_id" name="centro_custo_id" defaultValue="">
              <option value="">—</option>
              {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="campo c5">
            <label htmlFor="processo_id">Processo</label>
            <select id="processo_id" name="processo_id" value={processoId}
                    onChange={(e) => { setProcessoId(e.target.value); setContaId(''); }}>
              <option value="">—</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
            </select>
          </div>
          <div className="campo c4">
            <label htmlFor="pessoa_id">{tipo === 'receita' ? 'Cliente' : 'Fornecedor'}</label>
            <select id="pessoa_id" name="pessoa_id" defaultValue="">
              <option value="">—</option>
              {contraparte.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="data_competencia">Data do lançamento</label>
            <input id="data_competencia" type="date" name="data_competencia" value={competencia}
                   onChange={(e) => setCompetencia(e.target.value)} required />
          </div>
          <div className="campo c3">
            <label htmlFor="valor_total">Valor total</label>
            <input id="valor_total" name="valor_total" value={valor} inputMode="decimal"
                   onChange={(e) => setValor(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="campo c9">
            <label htmlFor="descricao">Descrição</label>
            <input id="descricao" name="descricao" required className="maiusculas"
                   placeholder="Ex.: Cimento — obra Izmenia" />
          </div>
          <div className="campo c12">
            <label htmlFor="observacao">Observação</label>
            <input id="observacao" name="observacao" className="maiusculas" placeholder="opcional" />
          </div>
        </div>
      </section>

      {processo && (
        <section className="bloco">
          <h2>
            Contabilização
            {precisaConta && (
              <span className={`selo ${contaId ? 'selo-ok' : 'selo-erro'}`}>
                {contaId ? 'conta definida' : 'escolha a conta'}
              </span>
            )}
          </h2>

          <div className="par-contas">
            <div className="perna">
              <span className="perna-rotulo">Débito</span>
              <strong>{processo.debito_codigo ?? '—'}</strong>
              <span className="perna-nome">{processo.debito_nome ?? 'não definido no processo'}</span>
              {processo.debito_codigo && !processo.debito_analitica && <span className="tag tag-alerta">sintética</span>}
            </div>
            <div className="perna">
              <span className="perna-rotulo">Crédito</span>
              <strong>{processo.credito_codigo ?? '—'}</strong>
              <span className="perna-nome">{processo.credito_nome ?? 'não definido no processo'}</span>
              {processo.credito_codigo && !processo.credito_analitica && <span className="tag tag-alerta">sintética</span>}
            </div>
          </div>

          {precisaConta ? (
            <>
              <div className="grade" style={{ marginTop: 14 }}>
                <div className="campo c8">
                  <label htmlFor="conta_id">
                    Conta de {escolha!.lado} — analítica dentro de {escolha!.raiz}
                  </label>
                  <select id="conta_id" name="conta_id" value={contaId}
                          onChange={(e) => setContaId(e.target.value)} required>
                    <option value="">Escolha a conta…</option>
                    {contasDisponiveis.map(c => (
                      <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="dica" style={{ marginTop: 8 }}>
                O processo aponta para <strong>{escolha!.raiz} {escolha!.nome}</strong>, que é conta de
                agrupamento e não recebe lançamento. Escolha a conta que descreve o gasto de verdade.
              </p>
            </>
          ) : (
            <p className="dica" style={{ marginTop: 12 }}>
              As duas contas já são analíticas — este processo não pede escolha.
            </p>
          )}
        </section>
      )}

      <section className="bloco">
        <h2>Pagamento</h2>
        <div className="radios largo">
          <label className={forma === 'avista' ? 'sel' : ''}>
            <input type="radio" name="forma" value="avista" checked={forma === 'avista'}
                   onChange={() => setForma('avista')} /> À vista
          </label>
          <label className={forma === 'prazo' ? 'sel' : ''}>
            <input type="radio" name="forma" value="prazo" checked={forma === 'prazo'}
                   onChange={() => setForma('prazo')} /> A prazo
          </label>
        </div>

        {forma === 'avista' ? (
          <div className="grade">
            <div className="campo c5">
              <label htmlFor="conta_bancaria_id">Conta bancária</label>
              <select id="conta_bancaria_id" name="conta_bancaria_id" required>
                <option value="">Escolha…</option>
                {contasDaEmpresa.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="campo c3">
              <label htmlFor="data_pagamento">Data do pagamento</label>
              <input id="data_pagamento" type="date" name="data_pagamento" defaultValue={hoje} />
            </div>
          </div>
        ) : (
          <>
            <div className="grade">
              <div className="campo c3">
                <label htmlFor="valor_entrada">Entrada</label>
                <input id="valor_entrada" name="valor_entrada" value={entrada} inputMode="decimal"
                       onChange={(e) => setEntrada(e.target.value)} placeholder="0,00" />
              </div>
              <div className="campo c3">
                <label htmlFor="data_entrada">Data da entrada</label>
                <input id="data_entrada" type="date" name="data_entrada" value={dataEntrada}
                       onChange={(e) => setDataEntrada(e.target.value)} />
              </div>
              <div className="campo c2">
                <label htmlFor="num_parcelas">Parcelas</label>
                <input id="num_parcelas" name="num_parcelas" type="number" min={0} value={numParcelas}
                       onChange={(e) => setNumParcelas(e.target.value)} />
              </div>
              <div className="campo c2">
                <label htmlFor="primeiro_vencimento">1º vencimento</label>
                <input id="primeiro_vencimento" type="date" name="primeiro_vencimento" value={primeiroVenc}
                       onChange={(e) => setPrimeiroVenc(e.target.value)} />
              </div>
              <div className="campo c2">
                <label htmlFor="periodicidade">A cada</label>
                <select id="periodicidade" name="periodicidade" value={periodicidade}
                        onChange={(e) => setPeriodicidade(e.target.value)}>
                  <option value="1">1 mês</option>
                  <option value="2">2 meses</option>
                  <option value="3">3 meses</option>
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                </select>
              </div>
            </div>

            <label className="opcional">
              <input type="checkbox" checked={usarBaloes} onChange={(e) => setUsarBaloes(e.target.checked)} />
              Usar balões
            </label>
            {usarBaloes && (
              <div className="grade">
                <div className="campo c3">
                  <label htmlFor="num_baloes">Qtd. de balões</label>
                  <input id="num_baloes" name="num_baloes" type="number" min={0} value={numBaloes}
                         onChange={(e) => setNumBaloes(e.target.value)} />
                </div>
                <div className="campo c3">
                  <label htmlFor="valor_balao">Valor de cada</label>
                  <input id="valor_balao" name="valor_balao" value={valorBalao} inputMode="decimal"
                         onChange={(e) => setValorBalao(e.target.value)} placeholder="0,00" />
                </div>
                <div className="campo c3">
                  <label htmlFor="primeiro_balao">1º balão</label>
                  <input id="primeiro_balao" type="date" name="primeiro_balao" value={primeiroBalao}
                         onChange={(e) => setPrimeiroBalao(e.target.value)} />
                </div>
                <div className="campo c3">
                  <label htmlFor="periodicidade_baloes">A cada</label>
                  <select id="periodicidade_baloes" name="periodicidade_baloes" value={periodicidadeBaloes}
                          onChange={(e) => setPeriodicidadeBaloes(e.target.value)}>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                    <option value="3">3 meses</option>
                  </select>
                </div>
              </div>
            )}

            <label className="opcional">
              <input type="checkbox" checked={usarChaves} onChange={(e) => setUsarChaves(e.target.checked)} />
              Parcela na entrega das chaves
            </label>
            {usarChaves && (
              <div className="grade">
                <div className="campo c3">
                  <label htmlFor="valor_chaves">Valor</label>
                  <input id="valor_chaves" name="valor_chaves" value={valorChaves} inputMode="decimal"
                         onChange={(e) => setValorChaves(e.target.value)} placeholder="0,00" />
                </div>
                <div className="campo c3">
                  <label htmlFor="data_chaves">Data prevista</label>
                  <input id="data_chaves" type="date" name="data_chaves" value={dataChaves}
                         onChange={(e) => setDataChaves(e.target.value)} />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="bloco">
        <h2>
          Parcelas geradas
          <span className={`selo ${fecha ? 'selo-ok' : 'selo-erro'}`}>
            {plano.valorTotal === 0 ? 'informe o valor'
              : fecha ? `fecha em ${deCentavos(soma)}`
              : `soma ${deCentavos(soma)} de ${deCentavos(plano.valorTotal)}`}
          </span>
        </h2>

        {forma === 'prazo' && sobra < 0 && (
          <p className="dica erro-texto">
            Entrada, balões e chaves somam mais que o valor total — sobram {deCentavos(sobra)} para as parcelas.
          </p>
        )}
        {forma === 'prazo' && sobra > 0 && Number(numParcelas) === 0 && (
          <p className="dica">Faltam {deCentavos(sobra)} sem parcela. Informe a quantidade de parcelas.</p>
        )}

        {parcelas.length === 0 ? (
          <p className="dica">Preencha o valor e o parcelamento para ver as parcelas.</p>
        ) : (
          <div className="previa">
            <table>
              <thead>
                <tr><th>#</th><th>Tipo</th><th>Vencimento</th><th className="num">Valor</th></tr>
              </thead>
              <tbody>
                {parcelas.map(p => (
                  <tr key={p.numero}>
                    <td className="tabular">{p.numero}</td>
                    <td><span className={`tag tag-${p.categoria}`}>{p.categoria}</span></td>
                    <td className="tabular">{p.vencimento.split('-').reverse().join('/')}</td>
                    <td className="num tabular">{deCentavos(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="acoes">
        <a href="/lancamentos" className="btn-secundario">Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando || !fecha || !contaOk}>
          {enviando ? 'Gravando…' : 'Gravar lançamento'}
        </button>
      </div>
    </form>
  );
}
