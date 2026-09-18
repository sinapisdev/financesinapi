// Guardas de permissão. As constantes (áreas, perfis) moram em lib/areas.ts,
// que é seguro para o cliente; aqui ficam as funções que tocam o banco.
//
// Regra de ouro: área sem linha em usuario_permissao = SEM ACESSO. Área nova
// do sistema nasce fechada; abrir é decisão explícita do admin.
import { q } from './db';
import { redirect } from 'next/navigation';
import { usuarioLogado, type Usuario } from './auth';
import { AREAS, EH_AREA, atende, mapaVazio, nomeArea,
         type Area, type Mapa, type Nivel } from './areas';

export * from './areas';

export async function permissoesDe(usuarioId: number): Promise<Mapa> {
  const linhas = await q<{ area: string; nivel: Nivel }>(
    'select area, nivel from usuario_permissao where usuario_id = $1', [usuarioId]);
  const mapa = mapaVazio();
  for (const l of linhas) if (EH_AREA(l.area)) mapa[l.area] = l.nivel;
  return mapa;
}

/**
 * Empresas que o usuário enxerga. Lista vazia = todas — mesma convenção do
 * 04_acesso.sql, para não precisar cadastrar as 4 empresas em cada acesso.
 */
export async function empresasDe(usuarioId: number): Promise<number[]> {
  const linhas = await q<{ empresa_id: number }>(
    'select empresa_id from usuario_empresa where usuario_id = $1', [usuarioId]);
  return linhas.map((l) => l.empresa_id);
}

export type Sessao = { usuario: Usuario; perms: Mapa; empresas: number[] };

/**
 * Guarda de PÁGINA. Manda para /sem-permissao em vez de estourar, porque
 * aqui existe uma tela para explicar; em server action não existe.
 */
export async function exigirArea(area: Area, nivel: Nivel = 'ver'): Promise<Sessao> {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.precisa_trocar_senha) redirect('/trocar-senha');

  const perms = await permissoesDe(usuario.id);
  if (!atende(perms[area], nivel)) redirect(`/sem-permissao?area=${area}`);
  return { usuario, perms, empresas: await empresasDe(usuario.id) };
}

/**
 * Guarda de SERVER ACTION que grava. As actions são endpoints próprios: não
 * passam pela verificação da página, então sem isto alguém com acesso de
 * leitura gravaria chamando a action direto.
 */
export async function exigirEscritaArea(area: Area): Promise<Usuario> {
  const usuario = await usuarioLogado();
  if (!usuario) throw new Error('Sessão expirada. Entre de novo para continuar.');
  const perms = await permissoesDe(usuario.id);
  if (!atende(perms[area], 'editar')) {
    throw new Error(`Seu acesso não permite alterar ${nomeArea(area)}.`);
  }
  return usuario;
}

/** Áreas que a pessoa enxerga, para o menu montar só o que ela pode abrir. */
export const areasVisiveis = (perms: Mapa): Area[] =>
  AREAS.map((a) => a.id).filter((id) => perms[id] !== 'nenhum');
