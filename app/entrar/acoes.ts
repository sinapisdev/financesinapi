'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q, pool } from '@/lib/db';
import {
  COOKIE_SESSAO, conferirSenha, criarSessao, encerrarSessao,
  registrarAcesso, falhasRecentes, gerarHash, usuarioLogado,
} from '@/lib/auth';

export type Resultado = { erro?: string };
const LIMITE_FALHAS = 5;

export async function entrar(_anterior: Resultado, form: FormData): Promise<Resultado> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const senha = String(form.get('senha') || '');
  if (!email || !senha) return { erro: 'Informe e-mail e senha.' };

  // trava de força bruta por e-mail
  if (await falhasRecentes(email) >= LIMITE_FALHAS) {
    await registrarAcesso(email, false, 'bloqueado por tentativas');
    return { erro: 'Muitas tentativas seguidas. Espere 15 minutos e tente de novo.' };
  }

  const [u] = await q<any>(
    'select id, senha_hash, ativo from usuario where email = $1', [email]);

  // mensagem idêntica para e-mail inexistente e senha errada: não confirma
  // a quem tenta se aquele e-mail existe no sistema
  const generico = 'E-mail ou senha incorretos.';
  if (!u) { await registrarAcesso(email, false, 'e-mail não encontrado'); return { erro: generico }; }
  if (!u.ativo) { await registrarAcesso(email, false, 'usuário inativo'); return { erro: 'Este acesso está desativado. Fale com o administrador.' }; }
  if (!await conferirSenha(senha, u.senha_hash)) {
    await registrarAcesso(email, false, 'senha incorreta');
    return { erro: generico };
  }

  const token = await criarSessao(u.id);
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,                 // JavaScript da página não lê o cookie
    sameSite: 'lax',                // não viaja em requisição de outro site
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 15,
  });
  await registrarAcesso(email, true);
  redirect('/');
}

export async function sair() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await encerrarSessao(token);
  jar.delete(COOKIE_SESSAO);
  redirect('/entrar');
}

export async function trocarSenha(_anterior: Resultado, form: FormData): Promise<Resultado> {
  const u = await usuarioLogado();
  if (!u) redirect('/entrar');

  const atual = String(form.get('senha_atual') || '');
  const nova = String(form.get('senha_nova') || '');
  const repetida = String(form.get('senha_repetida') || '');

  if (nova.length < 10) return { erro: 'A senha nova precisa ter ao menos 10 caracteres.' };
  if (nova !== repetida) return { erro: 'A confirmação não confere com a senha nova.' };
  if (/^\d+$/.test(nova)) return { erro: 'Não use só números.' };
  if (nova.toLowerCase().includes(u.email.split('@')[0].toLowerCase())) {
    return { erro: 'A senha não pode conter seu e-mail.' };
  }

  const [linha] = await q<any>('select senha_hash from usuario where id = $1', [u.id]);
  if (!await conferirSenha(atual, linha.senha_hash)) return { erro: 'A senha atual está incorreta.' };
  if (atual === nova) return { erro: 'A senha nova precisa ser diferente da atual.' };

  await pool.query(
    `update usuario set senha_hash = $2, precisa_trocar_senha = false, atualizado_em = now()
      where id = $1`, [u.id, await gerarHash(nova)]);

  // derruba as outras sessões: se a senha vazou, quem estava dentro sai
  const atualToken = (await cookies()).get(COOKIE_SESSAO)?.value;
  await pool.query('delete from sessao where usuario_id = $1 and token <> $2', [u.id, atualToken]);
  redirect('/');
}
