// Contexto de empresa: escolhido na entrada do sistema e válido em todas as
// telas. Evita o filtro repetido em cada página e o risco de olhar um número
// consolidado achando que é de uma SPE só.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q } from './db';
import { exigirUsuario } from './auth';

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
 * Usar no topo de toda página protegida. Exige usuário logado ANTES de
 * qualquer consulta — é o ponto único por onde todas as telas passam, então
 * proteger aqui protege o sistema inteiro.
 */
export async function exigirEmpresa(): Promise<Contexto> {
  await exigirUsuario();
  const ctx = await empresaAtiva();
  if (!ctx) redirect('/empresa');
  return ctx;
}

/** Nome curto para caber na barra lateral e nos cabeçalhos. */
export const nomeCurto = (nome: string) =>
  nome
    .replace(/EDIFICIO RESIDENCIAL /i, '')
    .replace(/ - EMPREENDIMENTO IMOBILIARIO SPE LTDA/i, ' (SPE)')
    .replace(/ LTDA$/i, '')
    .trim();
