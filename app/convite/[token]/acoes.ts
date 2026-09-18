'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool, q } from '@/lib/db';
import { COOKIE_SESSAO, criarSessao, gerarHash, registrarAcesso } from '@/lib/auth';
import { EH_AREA } from '@/lib/areas';

export type Resultado = { erro?: string };

/** Convite ainda válido: existe, não foi usado, não foi cancelado, não venceu. */
export async function conviteValido(token: string) {
  const [c] = await q<any>(
    `select token, email, nome, papel, permissoes, empresas
       from convite
      where token = $1 and usado_em is null and cancelado_em is null and expira_em > now()`,
    [token]);
  return c ?? null;
}

export async function aceitarConvite(_anterior: Resultado, form: FormData): Promise<Resultado> {
  const token = String(form.get('token') || '');
  const senha = String(form.get('senha') || '');
  const repetida = String(form.get('senha_repetida') || '');

  const c = await conviteValido(token);
  if (!c) return { erro: 'Este convite não vale mais. Peça um novo ao administrador.' };

  if (senha.length < 10) return { erro: `Use ao menos 10 caracteres (você digitou ${senha.length}).` };
  if (senha !== repetida) return { erro: 'A confirmação não confere com a senha.' };
  if (/^\d+$/.test(senha)) return { erro: 'Não use só números.' };
  if (senha.toLowerCase().includes(String(c.email).split('@')[0].toLowerCase())) {
    return { erro: 'A senha não pode conter seu e-mail.' };
  }

  // Entre a validação e a gravação alguém pode ter criado o mesmo e-mail;
  // o unique da tabela resolve, mas a mensagem precisa fazer sentido.
  const [existe] = await q<any>('select id from usuario where email = $1', [c.email]);
  if (existe) return { erro: 'Já existe um acesso com este e-mail. Fale com o administrador.' };

  const hash = await gerarHash(senha);
  const cli = await pool.connect();
  let usuarioId: number;
  try {
    await cli.query('begin');
    const { rows } = await cli.query(
      `insert into usuario (email, nome, senha_hash, papel, precisa_trocar_senha, ativo)
       values ($1,$2,$3,$4,false,true) returning id`,
      [String(c.email).toLowerCase(), c.nome, hash, c.papel]);
    usuarioId = rows[0].id;

    for (const [area, nivel] of Object.entries(c.permissoes ?? {})) {
      if (!EH_AREA(area) || (nivel !== 'ver' && nivel !== 'editar')) continue;
      await cli.query(
        'insert into usuario_permissao (usuario_id, area, nivel) values ($1,$2,$3)',
        [usuarioId, area, nivel]);
    }
    for (const empresaId of (c.empresas ?? [])) {
      await cli.query(
        'insert into usuario_empresa (usuario_id, empresa_id) values ($1,$2) on conflict do nothing',
        [usuarioId, empresaId]);
    }
    // marca o convite como usado DENTRO da transação: se algo falhar, o link
    // continua valendo em vez de queimar sem ter criado o acesso
    await cli.query(
      'update convite set usado_em = now(), usuario_id = $2 where token = $1', [token, usuarioId]);
    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback');
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  } finally {
    cli.release();
  }

  const sessao = await criarSessao(usuarioId);
  (await cookies()).set(COOKIE_SESSAO, sessao, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 60 * 60 * 24 * 15,
  });
  await registrarAcesso(String(c.email), true, 'primeiro acesso por convite');
  redirect('/');
}
