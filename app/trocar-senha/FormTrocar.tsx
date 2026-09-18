'use client';

import { useActionState } from 'react';
import { trocarSenha } from '@/app/entrar/acoes';
import type { Resultado } from '@/app/entrar/acoes';

export default function FormTrocar() {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(trocarSenha, {});
  return (
    <form action={acao}>
      {estado.erro && <div className="erro">{estado.erro}</div>}
      <div className="campo c12" style={{ marginBottom: 14 }}>
        <label htmlFor="senha_atual">Senha atual</label>
        <input id="senha_atual" name="senha_atual" type="password"
               autoComplete="current-password" required autoFocus />
      </div>
      <div className="campo c12" style={{ marginBottom: 14 }}>
        <label htmlFor="senha_nova">Senha nova</label>
        <input id="senha_nova" name="senha_nova" type="password"
               autoComplete="new-password" required minLength={10} />
      </div>
      <div className="campo c12" style={{ marginBottom: 20 }}>
        <label htmlFor="senha_repetida">Repita a senha nova</label>
        <input id="senha_repetida" name="senha_repetida" type="password"
               autoComplete="new-password" required minLength={10} />
      </div>
      <p className="dica" style={{ marginBottom: 16, fontSize: 12.5 }}>
        Ao menos 10 caracteres, não só números e sem conter seu e-mail.
        As outras sessões suas são encerradas ao trocar.
      </p>
      <button className="aplicar" type="submit" disabled={enviando} style={{ width: '100%' }}>
        {enviando ? 'Salvando…' : 'Salvar senha'}
      </button>
    </form>
  );
}
