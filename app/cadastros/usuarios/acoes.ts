'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { gerarHash, usuarioLogado } from '@/lib/auth';
import {
  AREAS, EH_AREA, PERFIS, areasDoPerfil, exigirEscritaArea,
  type Area, type Mapa, type Nivel,
} from '@/lib/permissoes';

export type Resultado = {
  erro?: string;
  ok?: string;
  convite?: { link: string; nome: string; expira: string };
  senhaTemporaria?: string;
  nome?: string;
};

const DIAS_CONVITE = 7;

/** Mexer em acesso é privilégio de quem administra, não de quem lança. */
const exigirAdmin = () => exigirEscritaArea('administracao');

const emailValido = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/**
 * Lê as áreas do formulário. Cada área vem como area_<id>. Nível inválido
 * ou ausente vira 'nenhum': o formulário não consegue abrir acesso por engano.
 */
function lerAreas(form: FormData): Mapa {
  const mapa = Object.fromEntries(AREAS.map((a) => [a.id, 'nenhum'])) as Mapa;
  for (const a of AREAS) {
    const v = String(form.get(`area_${a.id}`) || 'nenhum');
    if (v === 'ver' || v === 'editar') mapa[a.id] = v as Nivel;
  }
  return mapa;
}

const lerEmpresas = (form: FormData): number[] =>
  form.getAll('empresa').map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);

/** Grava permissões e empresas. Apaga o que não veio: a tela é a verdade. */
async function gravarAcessos(cli: any, usuarioId: number, areas: Mapa, empresas: number[]) {
  await cli.query('delete from usuario_permissao where usuario_id = $1', [usuarioId]);
  for (const [area, nivel] of Object.entries(areas)) {
    if (nivel === 'nenhum') continue;
    await cli.query(
      'insert into usuario_permissao (usuario_id, area, nivel) values ($1,$2,$3)',
      [usuarioId, area, nivel]);
  }
  await cli.query('delete from usuario_empresa where usuario_id = $1', [usuarioId]);
  for (const id of empresas) {
    await cli.query(
      'insert into usuario_empresa (usuario_id, empresa_id) values ($1,$2) on conflict do nothing',
      [usuarioId, id]);
  }
}

/** Quantos outros administradores ativos existem além deste. */
async function outrosAdmins(exceto: number): Promise<number> {
  const [r] = await q<{ n: number }>(
    `select count(*)::int as n
       from usuario u
       join usuario_permissao p on p.usuario_id = u.id
      where u.ativo and p.area = 'administracao' and p.nivel = 'editar' and u.id <> $1`,
    [exceto]);
  return r?.n ?? 0;
}

// ------------------------------------------------------------- CONVITE

export async function criarConvite(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirAdmin(); } catch (e: any) { return { erro: e.message }; }

  const email = String(form.get('email') || '').trim().toLowerCase();
  const nome = normalizar(form.get('nome'));
  const papel = String(form.get('papel') || 'financeiro');

  if (!nome || nome.length < 3) return { erro: 'Informe o nome de quem vai receber o convite.' };
  if (!emailValido(email)) return { erro: 'E-mail inválido — precisa de domínio completo, como nome@empresa.com.br.' };
  if (!PERFIS[papel]) return { erro: 'Perfil inválido.' };

  const [existe] = await q<any>('select id, ativo from usuario where email = $1', [email]);
  if (existe) {
    return { erro: existe.ativo
      ? 'Já existe um acesso ativo com este e-mail. Edite o acesso em vez de convidar de novo.'
      : 'Já existe um acesso com este e-mail, desativado. Reative-o na lista abaixo.' };
  }

  const areas = lerAreas(form);
  const empresas = lerEmpresas(form);
  if (Object.values(areas).every((n) => n === 'nenhum')) {
    return { erro: 'Libere ao menos uma área — senão a pessoa entra e não vê nada.' };
  }

  // convite anterior ainda aberto para o mesmo e-mail perde a validade
  await pool.query(
    `update convite set cancelado_em = now()
      where lower(email) = $1 and usado_em is null and cancelado_em is null`, [email]);

  const token = randomBytes(32).toString('base64url');
  const [linha] = await q<any>(
    `insert into convite (token, email, nome, papel, permissoes, empresas, criado_por, expira_em)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7, now() + ($8 || ' days')::interval)
     returning to_char(expira_em, 'DD/MM/YYYY') as expira`,
    [token, email, nome, papel, JSON.stringify(areas), empresas, autor.id, String(DIAS_CONVITE)]);

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const protocolo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  revalidatePath('/cadastros/usuarios');
  return { convite: { link: `${protocolo}://${host}/convite/${token}`, nome, expira: linha.expira } };
}

export async function cancelarConvite(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirAdmin(); } catch (e: any) { return { erro: e.message }; }
  const token = String(form.get('token') || '');
  if (!token) return { erro: 'Convite não informado.' };
  await pool.query(
    'update convite set cancelado_em = now() where token = $1 and usado_em is null', [token]);
  revalidatePath('/cadastros/usuarios');
  return { ok: 'Convite cancelado. O link parou de funcionar.' };
}

// -------------------------------------------------------- ACESSO EXISTENTE

export async function salvarAcesso(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirAdmin(); } catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('id'));
  if (!id) return { erro: 'Acesso não informado.' };

  const nome = normalizar(form.get('nome'));
  const email = String(form.get('email') || '').trim().toLowerCase();
  const papel = String(form.get('papel') || 'personalizado');
  const ativo = String(form.get('ativo') || 'on') === 'on';
  const areas = lerAreas(form);
  const empresas = lerEmpresas(form);

  if (!nome || nome.length < 3) return { erro: 'Informe o nome.' };
  if (!emailValido(email)) return { erro: 'E-mail inválido.' };
  if (!PERFIS[papel]) return { erro: 'Perfil inválido.' };

  const [dupe] = await q<any>(
    'select id from usuario where email = $1 and id <> $2', [email, id]);
  if (dupe) return { erro: 'Já existe outro acesso com este e-mail.' };

  // ninguém se tranca para fora nem se rebaixa sozinho
  const perdeAdmin = areas.administracao !== 'editar';
  if (id === autor.id && (perdeAdmin || !ativo)) {
    return { erro: 'Você não pode tirar a própria administração nem se desativar. Peça a outro administrador.' };
  }
  if ((perdeAdmin || !ativo) && (await outrosAdmins(id)) === 0) {
    return { erro: 'Este é o último acesso com administração. Dê administração a outra pessoa antes de mudar este.' };
  }

  const cli = await pool.connect();
  try {
    await cli.query('begin');
    await cli.query(
      `update usuario set nome=$2, email=$3, papel=$4, ativo=$5, atualizado_em=now() where id=$1`,
      [id, nome, email, papel, ativo]);
    await gravarAcessos(cli, id, areas, empresas);
    // tirar permissão só vale de verdade se a sessão aberta cair junto
    if (!ativo) await cli.query('delete from sessao where usuario_id = $1', [id]);
    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback');
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  } finally {
    cli.release();
  }

  revalidatePath('/cadastros/usuarios');
  return { ok: `Acesso de ${nome} atualizado.` };
}

/** Senha temporária legível, para quem perdeu o acesso e precisa voltar hoje. */
function senhaTemporaria(): string {
  const palavras = ['casa', 'obra', 'norte', 'campo', 'porto', 'vale', 'monte', 'rio'];
  const p = palavras[randomBytes(1)[0] % palavras.length];
  return `${p}-${randomBytes(4).toString('hex')}`;
}

export async function resetarSenha(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirAdmin(); } catch (e: any) { return { erro: e.message }; }
  const id = Number(form.get('id'));
  if (!id) return { erro: 'Acesso não informado.' };

  const [u] = await q<any>('select nome from usuario where id = $1', [id]);
  if (!u) return { erro: 'Acesso não encontrado.' };

  const senha = senhaTemporaria();
  await pool.query(
    `update usuario set senha_hash = $2, precisa_trocar_senha = true, atualizado_em = now()
      where id = $1`, [id, await gerarHash(senha)]);
  await pool.query('delete from sessao where usuario_id = $1', [id]);
  revalidatePath('/cadastros/usuarios');
  return { senhaTemporaria: senha, nome: u.nome };
}

/** Usado pela tela para preencher as áreas quando o admin troca de perfil. */
export async function areasDe(papel: string): Promise<Mapa> {
  return areasDoPerfil(papel);
}
