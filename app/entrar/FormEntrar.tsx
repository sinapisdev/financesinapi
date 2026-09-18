'use client';

import { useActionState } from 'react';
import { entrar, type Resultado } from './acoes';

export default function FormEntrar() {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(entrar, {});
  return (
    <form action={acao}>
      {estado.erro && <div className="erro">{estado.erro}</div>}
      <div className="campo c12" style={{ marginBottom: 14 }}>
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username"
               required autoFocus placeholder="voce@silvereng.com.br" />
      </div>
      <div className="campo c12" style={{ marginBottom: 20 }}>
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password"
               autoComplete="current-password" required />
      </div>
      <button className="aplicar" type="submit" disabled={enviando} style={{ width: '100%' }}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
