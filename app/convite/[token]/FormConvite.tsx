'use client';

import { useActionState } from 'react';
import { aceitarConvite, type Resultado } from './acoes';

export default function FormConvite({ token, email }: { token: string; email: string }) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(aceitarConvite, {});
  return (
    <form action={acao}>
      {estado.erro && <div className="erro">{estado.erro}</div>}
      <input type="hidden" name="token" value={token} />
      {/* o gerenciador de senhas do navegador precisa do usuário para salvar */}
      <input type="hidden" name="email" value={email} autoComplete="username" />

      <div className="campo c12" style={{ marginBottom: 14 }}>
        <label htmlFor="senha">Escolha sua senha</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password"
               required minLength={10} autoFocus />
        <div className="sub" style={{ marginTop: 4 }}>
          Ao menos 10 caracteres, e não só números. Ninguém mais vai saber esta senha.
        </div>
      </div>
      <div className="campo c12" style={{ marginBottom: 20 }}>
        <label htmlFor="senha_repetida">Repita a senha</label>
        <input id="senha_repetida" name="senha_repetida" type="password"
               autoComplete="new-password" required minLength={10} />
      </div>
      <button className="aplicar" type="submit" disabled={enviando} style={{ width: '100%' }}>
        {enviando ? 'Criando seu acesso…' : 'Criar acesso e entrar'}
      </button>
    </form>
  );
}
