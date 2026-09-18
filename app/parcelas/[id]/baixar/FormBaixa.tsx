'use client';

import { useActionState, useMemo, useState } from 'react';
import { darBaixa, type Resultado } from '@/app/parcelas/acoes';
import { paraCentavos, deCentavos } from '@/lib/parcelamento';

type Conta = { id: number; nome: string };

export default function FormBaixa({ parcela, contas, formas, voltarPara }: {
  parcela: any; contas: Conta[]; formas: Conta[]; voltarPara: string;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(darBaixa, {});

  const saldo = Number(parcela.saldo);
  const [principal, setPrincipal] = useState(saldo.toFixed(2).replace('.', ','));
  const [juros, setJuros] = useState('');
  const [multa, setMulta] = useState('');
  const [desconto, setDesconto] = useState('');

  const calc = useMemo(() => {
    const p = paraCentavos(principal), j = paraCentavos(juros);
    const m = paraCentavos(multa), d = paraCentavos(desconto);
    return { p, j, m, d, liquido: p + j + m - d, excede: p > Math.round(saldo * 100) };
  }, [principal, juros, multa, desconto, saldo]);

  const ehReceber = parcela.tipo === 'receber';

  return (
    <form action={acao}>
      <input type="hidden" name="parcela_id" value={parcela.id} />
      <input type="hidden" name="voltar_para" value={voltarPara} />
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>{ehReceber ? 'Recebimento' : 'Pagamento'}</h2>
        <div className="grade">
          <div className="campo c3">
            <label htmlFor="data_liquidacao">Data da liquidação</label>
            <input id="data_liquidacao" type="date" name="data_liquidacao" defaultValue={hoje} required />
          </div>
          <div className="campo c5">
            <label htmlFor="conta_bancaria_id">
              Conta bancária {ehReceber ? 'que recebeu' : 'que pagou'}
            </label>
            <select id="conta_bancaria_id" name="conta_bancaria_id" required defaultValue="">
              <option value="">Escolha…</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="campo c4">
            <label htmlFor="forma_pagamento_id">Forma</label>
            <select id="forma_pagamento_id" name="forma_pagamento_id" defaultValue="">
              <option value="">—</option>
              {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>

          <div className="campo c3">
            <label htmlFor="valor_principal">Principal</label>
            <input id="valor_principal" name="valor_principal" inputMode="decimal"
                   value={principal} onChange={(e) => setPrincipal(e.target.value)} required />
          </div>
          <div className="campo c3">
            <label htmlFor="juros">Juros {ehReceber ? 'recebidos' : 'pagos'}</label>
            <input id="juros" name="juros" inputMode="decimal" placeholder="0,00"
                   value={juros} onChange={(e) => setJuros(e.target.value)} />
          </div>
          <div className="campo c3">
            <label htmlFor="multa">Multa</label>
            <input id="multa" name="multa" inputMode="decimal" placeholder="0,00"
                   value={multa} onChange={(e) => setMulta(e.target.value)} />
          </div>
          <div className="campo c3">
            <label htmlFor="desconto">Desconto</label>
            <input id="desconto" name="desconto" inputMode="decimal" placeholder="0,00"
                   value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          </div>
          <div className="campo c12">
            <label htmlFor="observacao">Observação</label>
            <input id="observacao" name="observacao" className="maiusculas" placeholder="opcional" />
          </div>
        </div>

        {calc.excede && (
          <p className="dica erro-texto" style={{ marginTop: 12 }}>
            O principal é maior que o saldo em aberto ({deCentavos(Math.round(saldo * 100))}).
            Acréscimos vão nos campos de juros e multa, não no principal.
          </p>
        )}
      </section>

      <section className="bloco">
        <h2>
          O que vai para o caixa
          <span className="selo selo-ok">{deCentavos(calc.liquido)}</span>
        </h2>
        <div className="conta-liquido">
          <div><span>Principal</span><strong className="tabular">{deCentavos(calc.p)}</strong></div>
          {calc.j > 0 && <div><span>+ Juros</span><strong className="tabular v-entrada">{deCentavos(calc.j)}</strong></div>}
          {calc.m > 0 && <div><span>+ Multa</span><strong className="tabular v-entrada">{deCentavos(calc.m)}</strong></div>}
          {calc.d > 0 && <div><span>− Desconto</span><strong className="tabular v-saida">{deCentavos(calc.d)}</strong></div>}
          <div className="total">
            <span>{ehReceber ? 'Entra no banco' : 'Sai do banco'}</span>
            <strong className="tabular">{deCentavos(calc.liquido)}</strong>
          </div>
        </div>
        <p className="dica" style={{ marginTop: 12 }}>
          É este valor que aparece no extrato — juros e desconto entram como
          resultado, nunca somem dentro do principal.
        </p>
      </section>

      <div className="acoes">
        <a className="btn-secundario" href={voltarPara}>Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando || calc.liquido <= 0 || calc.excede}>
          {enviando ? 'Gravando…' : `Confirmar ${ehReceber ? 'recebimento' : 'pagamento'}`}
        </button>
      </div>
    </form>
  );
}
