'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { editarDescricao, type Resultado } from '@/app/lancamentos/acoes';

export default function DescricaoEditavel({ id, descricao, automatica, href }: {
  id: number; descricao: string; automatica: boolean; href?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(editarDescricao, {});
  const campo = useRef<HTMLInputElement>(null);

  // fecha sozinho quando a gravação dá certo
  useEffect(() => {
    if (!enviando && editando && estado && !estado.erro && campo.current?.dataset.enviou) {
      setEditando(false);
    }
  }, [enviando, estado, editando]);

  if (editando) {
    return (
      <form action={acao} className="form-desc"
            onSubmit={() => { if (campo.current) campo.current.dataset.enviou = '1'; }}>
        <input type="hidden" name="lancamento_id" value={id} />
        <input ref={campo} name="descricao" defaultValue={automatica ? '' : descricao}
               placeholder={automatica ? descricao : undefined}
               className="maiusculas" autoFocus maxLength={200}
               onKeyDown={(e) => { if (e.key === 'Escape') setEditando(false); }} />
        <button className="aplicar pequeno" disabled={enviando}>{enviando ? '…' : 'Salvar'}</button>
        <button type="button" className="link-acao" onClick={() => setEditando(false)}>Cancelar</button>
        {estado.erro && <span className="erro-inline">{estado.erro}</span>}
      </form>
    );
  }

  return (
    <div className="desc-linha">
      {automatica && (
        <span className="ponto-sem-descricao"
              title="Sem descrição no Base44 — está usando o nome da contraparte ou do processo" />
      )}
      {href
        ? <a className="desc-link" href={href}><span className="desc">{descricao}</span></a>
        : <span className="desc">{descricao}</span>}
      <button type="button" className="botao-lapis" onClick={() => setEditando(true)}
              title="Editar descrição" aria-label="Editar descrição">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5 13l-2.5.5L3 11z" />
        </svg>
      </button>
    </div>
  );
}
