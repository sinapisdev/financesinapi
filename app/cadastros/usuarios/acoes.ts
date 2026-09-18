'use server';

import { randomBytes } from 'node:crypto';
import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { exigirUsuario, gerarHash } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type Resultado = { erro?: string; senhaTemporaria?: string; nome?: string };

/** Mexer em usuário é privilégio de admin, não de quem pode escrever. */
async function exigirAdmin() {
  const u = await exigirUsuario();
  if (u.papel !== 'admin') throw new Error('Só um administrador pode gerenciar acessos.');
  return u;
}

/** Senha temporária legível: o admin passa para a pessoa, que troca no primeiro acesso. */
function senhaTemporaria(): string {
  const palavras = ['casa', 'obra', 'norte', 'campo', 'porto', 'vale', 'monte', 'rio'];
  const p = palavras[randomBytes(1)[0] % palavras.length];
  return `${p}-${randomBytes(4).toString('hex')}`;
}

export async function salvarUsuario(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirAdmin(); } catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('id')) || null;
  const email = String(form.get('email') || '').trim().toLowerCase();
  const nome = normalizar(form.get('nome'));
  const papel = String(form.get('papel') || 'financeiro');
  const ativo = form.get('ativo') !== 'off';

  if (!nome || nome.length < 3) return { erro: 'Informe o nome.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: 'E-mail inválido.' };
  if (!['admin', 'financeiro', 'leitura'].includes(papel)) return { erro: 'Papel inválido.' };

  // ninguém se rebaixa nem se desativa sozinho: seria possível ficar sem admin
  if (id === autor.id && (papel !== 'admin' || !ativo)) {
    return { erro: 'Você não pode mudar o próprio papel nem se desativar. Peça a outro administrador.' };
  }
  if (id) {
    const [outros] = await q<any>(
      `select count(*)::int as n from usuario where papel='admin' and ativo and id <> $1`, [id]);
    if (outros.n === 0 && (papel !== 'admin' || !ativo)) {
      return { erro: 'Este é o último administrador ativo. Promova outro antes de mudar este.' };
    }
  }

  const [dupe] = await q<any>(
    'select id from usuario where email = $1 and ($2::bigint is null or id <> $2)', [email, id]);
  if (dupe) return { erro: 'Já existe um acesso com este e-mail.' };

  try {
    if (id) {
      await pool.query(
        `update usuario set email=$2, nome=$3, papel=$4, ativo=$5, atualizado_em=now() where id=$1`,
        [id, email, nome, papel, ativo]);
      if (!ativo) await pool.query('delete from sessao where usuario_id = $1', [id]);
      revalidatePath('/cadastros/usuarios');
      return {};
    }
    const senha = senhaTemporaria();
    await pool.query(
      `insert into usuario (email, nome, senha_hash, papel, precisa_trocar_senha, ativo)
       values ($1,$2,$3,$4,true,true)`, [email, nome, await gerarHash(senha), papel]);
    revalidatePath('/cadastros/usuarios');
    return { senhaTemporaria: senha, nome };
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }
}

export async function resetarSenha(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirAdmin(); } catch (e: any) { return { erro: e.message }; }
  const id = Number(form.get('id'));
  if (!id) return { erro: 'Usuário não informado.' };

  const [u] = await q<any>('select nome from usuario where id = $1', [id]);
  if (!u) return { erro: 'Usuário não encontrado.' };

  const senha = senhaTemporaria();
  await pool.query(
    `update usuario set senha_hash = $2, precisa_trocar_senha = true, atualizado_em = now()
      where id = $1`, [id, await gerarHash(senha)]);
  // derruba as sessões: quem estava dentro com a senha antiga sai
  await pool.query('delete from sessao where usuario_id = $1', [id]);
  revalidatePath('/cadastros/usuarios');
  return { senhaTemporaria: senha, nome: u.nome };
}
