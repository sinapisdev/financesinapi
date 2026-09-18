// Contexto de empresa: escolhido na entrada do sistema e válido em todas as
// telas. Evita o filtro repetido em cada página e o risco de olhar um número
// consolidado achando que é de uma SPE só.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q } from './db';
import { exigirArea, atende, type Area, type Mapa } from './permissoes';

export const COOKIE_EMPRESA = 'empresa_ativa';

export type Contexto = {
  id: number | null;      // null = consolidado
  nome: string;
  codigo: number | null;
  todas: boolean;
};

export async function empresaAtiva(): Promise<Contexto | null> {
  const valor = (await cookies()).get(COOKIE_EMPRESA)?.value;
  if (!valor) return null;
  if (valor === 'todas') {
    return { id: null, nome: 'Todas as empresas', codigo: null, todas: true };
  }
  const [e] = await q(
    `select id, codigo, razao_social from empresa where id = $1 and ativo`, [Number(valor)]);
  if (!e) return null;
  return { id: e.id, nome: e.razao_social, codigo: e.codigo, todas: false };
}

/**
 * Usar no topo de toda página protegida. É o ponto único por onde todas as
 * telas passam — proteger aqui protege o sistema inteiro. Checa, nesta ordem:
 * sessão válida, permissão na área da tela, e se a empresa escolhida está
 * entre as que a pessoa pode ver.
 */
export async function exigirEmpresa(area: Area): Promise<Contexto> {
  const sessao = await exigirArea(area, 'ver');
  const ctx = await empresaAtiva();
  if (!ctx) redirect('/empresa');

  // Escopo por empresa. Lista vazia = vê todas; senão, o consolidado fica
  // fora, porque ele soma empresas que a pessoa não deveria enxergar.
  if (sessao.empresas.length) {
    if (ctx.todas || ctx.id === null || !sessao.empresas.includes(ctx.id)) {
      redirect('/empresa');
    }
  }
  return ctx;
}

/** Igual à anterior, mas devolve também as permissões — para a tela decidir
 *  o que mostrar (botão de editar, coluna a mais) sem consultar de novo. */
export async function exigirEmpresaCom(area: Area): Promise<Contexto & { perms: Mapa; podeEditar: boolean }> {
  const sessao = await exigirArea(area, 'ver');
  const ctx = await empresaAtiva();
  if (!ctx) redirect('/empresa');
  if (sessao.empresas.length) {
    if (ctx.todas || ctx.id === null || !sessao.empresas.includes(ctx.id)) redirect('/empresa');
  }
  return { ...ctx, perms: sessao.perms, podeEditar: atende(sessao.perms[area], 'editar') };
}

/** Nome curto para caber na barra lateral e nos cabeçalhos. */
export const nomeCurto = (nome: string) =>
  nome
    .replace(/EDIFICIO RESIDENCIAL /i, '')
    .replace(/ - EMPREENDIMENTO IMOBILIARIO SPE LTDA/i, ' (SPE)')
    .replace(/ LTDA$/i, '')
    .trim();
