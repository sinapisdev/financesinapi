'use client';

import { useActionState, useState } from 'react';
import { salvarForma, alternarForma, type Resultado } from './acoes';

function LinhaEditavel({ forma }: { forma: any }) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarForma, {});
  const [alt, acaoAlt, alterando] = useActionState<Resultado, FormData>(alternarForma, {});

  if (editando && !estado.ok) {
    return (
      <tr>
        <td className="tabular sub">{forma.codigo}</td>
        <td colSpan={3}>
          <form action={acao} className="form-inline">
            <input type="hidden" name="id" value={forma.id} />
            <input name="nome" defaultValue={forma.nome} className="maiusculas" autoFocus required />
            <button className="aplicar pequeno" disabled={enviando}>Salvar</button>
            <button type="button" className="link-acao" onClick={() => setEditando(false)}>Cancelar</button>
            {estado.erro && <span className="erro-inline">{estado.erro}</span>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr style={!forma.ativo ? { opacity: .55 } : undefined}>
      <td className="tabular sub">{forma.codigo}</td>
      <td>
        <div className="desc-linha">
          <span className="desc">{forma.nome}</span>
          <button type="button" className="botao-lapis" onClick={() => { setEditando(true); }}
                  title="Renomear" aria-label="Renomear">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5 13l-2.5.5L3 11z" />
            </svg>
          </button>
        </div>
      </td>
      <td className="num tabular sub">{forma.usos || '—'}</td>
      <td className="num">
        <form action={acaoAlt} style={{ display: 'inline' }}>
          <input type="hidden" name="id" value={forma.id} />
          <button className="link-acao" disabled={alterando}>
            {forma.ativo ? 'Desativar' : 'Reativar'}
          </button>
        </form>
      </td>
    </tr>
  );
}

export default function Lista({ formas }: { formas: any[] }) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarForma, {});
  return (
    <>
      <section className="bloco">
        <h2>Nova forma de pagamento</h2>
        {estado.erro && <div className="erro">{estado.erro}</div>}
        <form action={acao} className="form-inline">
          <input name="nome" className="maiusculas" placeholder="Ex.: TRANSFERÊNCIA BANCÁRIA"
                 required style={{ minWidth: 300 }} />
          <button className="aplicar pequeno" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Adicionar'}
          </button>
        </form>
      </section>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">Cód.</th><th>Nome</th>
              <th className="num">Usos em baixas</th><th className="num"></th>
            </tr>
          </thead>
          <tbody>
            {formas.length === 0 && (
              <tr><td colSpan={4}><div className="vazio">Nenhuma forma cadastrada.</div></td></tr>
            )}
            {formas.map(f => <LinhaEditavel key={f.id} forma={f} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}
