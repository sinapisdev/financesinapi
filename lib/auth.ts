// Autenticação. Sem dependência externa: scrypt e randomBytes são do Node.
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { q, pool } from './db';

const scryptAsync = promisify(scrypt) as (s: string, salt: string, n: number) => Promise<Buffer>;

export const COOKIE_SESSAO = 'sessao';
const DIAS_SESSAO = 15;
const CUSTO = 64;

/** Gera "salt:hash". Salt novo a cada senha. */
export async function gerarHash(senha: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(senha, salt, CUSTO);
  return `${salt}:${hash.toString('hex')}`;
}

/** Comparação em tempo constante: o tempo de resposta não revela nada. */
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [salt, hashHex] = String(guardado).split(':');
  if (!salt || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtido = await scryptAsync(senha, salt, esperado.length);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

export type Usuario = {
  id: number; email: string; nome: string;
  /** Perfil base. A permissão que vale está em usuario_permissao. */
  papel: 'admin' | 'financeiro' | 'contabil' | 'obra' | 'leitura' | 'personalizado';
  precisa_trocar_senha: boolean;
};

export async function usuarioLogado(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const [linha] = await q<any>(
    `select u.id, u.email, u.nome, u.papel, u.precisa_trocar_senha
       from sessao s join usuario u on u.id = s.usuario_id
      where s.token = $1 and s.expira_em > now() and u.ativo`, [token]);
  if (!linha) return null;

  // marca atividade sem bloquear a renderização
  pool.query('update sessao set visto_em = now() where token = $1', [token]).catch(() => {});
  return linha as Usuario;
}

/** Usar no topo de toda página protegida. */
export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioLogado();
  if (!u) redirect('/entrar');
  if (u.precisa_trocar_senha) redirect('/trocar-senha');
  return u;
}

// Permissão por área mora em lib/permissoes.ts: exigirArea nas páginas e
// exigirEscritaArea nas server actions. Aqui ficou só sessão e senha, para
// não existirem dois modelos de permissão concorrendo.

export async function criarSessao(usuarioId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const agente = (await headers()).get('user-agent')?.slice(0, 200) ?? null;
  await pool.query(
    `insert into sessao (token, usuario_id, expira_em, agente)
     values ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [token, usuarioId, String(DIAS_SESSAO), agente]);
  await pool.query('update usuario set ultimo_acesso = now() where id = $1', [usuarioId]);
  // limpeza oportunista das expiradas
  pool.query('delete from sessao where expira_em < now()').catch(() => {});
  return token;
}

export async function encerrarSessao(token: string) {
  await pool.query('delete from sessao where token = $1', [token]);
}

export async function registrarAcesso(email: string, sucesso: boolean, motivo?: string) {
  const agente = (await headers()).get('user-agent')?.slice(0, 200) ?? null;
  await pool.query(
    'insert into acesso_log (email, sucesso, motivo, agente) values ($1,$2,$3,$4)',
    [email.slice(0, 120), sucesso, motivo ?? null, agente]);
}

/** Tentativas falhas recentes, para travar força bruta. */
export async function falhasRecentes(email: string): Promise<number> {
  const [r] = await q<any>(
    `select count(*)::int as n from acesso_log
      where email = $1 and not sucesso and quando > now() - interval '15 minutes'`, [email]);
  return r?.n ?? 0;
}
