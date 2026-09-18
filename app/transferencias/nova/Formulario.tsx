'use client';

import { useActionState, useMemo, useState } from 'react';
import { criarTransferencia, type Resultado } from '../acoes';
import { paraCentavos, deCentavos } from '@/lib/parcelamento';

type Conta = { id: number; nome: string; empresa_id: number; saldo: number };

export default function Formulario({ contas, empresaId, empresas }: {
  contas: Conta[]; empresaId: number | null; empresas: { id: number; nome: string }[];
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(criarTransferencia, {});
  const [empresa, setEmpresa] = useState(String(empresaId ?? empresas[0]?.id ?? ''));
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [valor, setValor] = useState('');

  const daEmpresa = contas.filter(c => String(c.empresa_id) === empresa);
  const contaOrigem = daEmpresa.find(c => String(c.id) === origem);
  const centavos = paraCentavos(valor);

  const saldoDepois = useMemo(() => {
    if (!contaOrigem) return null;
    return Math.round(contaOrigem.saldo * 100) - centavos;
  }, [contaOrigem, centavos]);

  const mesmaConta = origem !== '' && origem === destino;
  const podeEnviar = !!origem && !!destino && !mesmaConta && centavos > 0;

  return (
    <form action={acao}>
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Transferência</h2>
        <div className="grade">
          {empresaId ? (
            <input type="hidden" name="empresa_id" value={empresaId} />
          ) : (
            <div className="campo c4">
              <label htmlFor="empresa_id">Empresa</label>
              <select id="empresa_id" name="empresa_id" value={empresa}
                      onChange={(e) => { setEmpresa(e.target.value); setOrigem(''); setDestino(''); }} required>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          )}
          <div className={empresaId ? 'campo c5' : 'campo c4'}>
            <label htmlFor="conta_origem_id">Sai da conta</label>
            <select id="conta_origem_id" name="conta_origem_id" value={origem}
                    onChange={(e) => setOrigem(e.target.value)} required>
              <option value="">Escolha…</option>
              {daEmpresa.map(c => (
                <option key={c.id} value={c.id}>{c.nome} · {deCentavos(Math.round(c.saldo * 100))}</option>
              ))}
            </select>
          </div>
          <div className={empresaId ? 'campo c5' : 'campo c4'}>
            <label htmlFor="conta_destino_id">Entra na conta</label>
            <select id="conta_destino_id" name="conta_destino_id" value={destino}
                    onChange={(e) => setDestino(e.target.value)} required>
              <option value="">Escolha…</option>
              {daEmpresa.filter(c => String(c.id) !== origem).map(c => (
                <option key={c.id} value={c.id}>{c.nome} · {deCentavos(Math.round(c.saldo * 100))}</option>
              ))}
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="data_movimento">Data</label>
            <input id="data_movimento" type="date" name="data_movimento" defaultValue={hoje} required />
          </div>
          <div className="campo c3">
            <label htmlFor="valor">Valor</label>
            <input id="valor" name="valor" inputMode="decimal" value={valor}
                   onChange={(e) => setValor(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="campo c6">
            <label htmlFor="descricao">Descrição</label>
            <input id="descricao" name="descricao" className="maiusculas"
                   placeholder="Ex.: Aporte para folha de pagamento" />
          </div>
        </div>

        {mesmaConta && (
          <p className="dica erro-texto" style={{ marginTop: 12 }}>
            Origem e destino são a mesma conta.
          </p>
        )}
        {contaOrigem && centavos > 0 && saldoDepois !== null && (
          <p className="dica" style={{ marginTop: 12 }}>
            {contaOrigem.nome} fica com <strong className={saldoDepois < 0 ? 'v-saida' : ''}>
              {deCentavos(saldoDepois)}
            </strong> depois da transferência.
            {saldoDepois < 0 && ' O saldo fica negativo — confira se é isso mesmo.'}
          </p>
        )}
        <p className="dica" style={{ marginTop: 10 }}>
          Transferência não é receita nem despesa: o dinheiro só muda de conta,
          e o caixa consolidado da empresa não se altera.
        </p>
      </section>

      <div className="acoes">
        <a className="btn-secundario" href="/transferencias">Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando || !podeEnviar}>
          {enviando ? 'Gravando…' : 'Transferir'}
        </button>
      </div>
    </form>
  );
}
