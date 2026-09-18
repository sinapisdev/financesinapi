'use server';

import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { exigirEscritaArea } from '@/lib/permissoes';
import { cnpjValido, soDigitos } from '@/lib/documento';
import { revalidatePath } from 'next/cache';

export type Resultado = { erro?: string; ok?: boolean };

const TIPOS = ['operacional', 'spe', 'holding'];

export async function salvarEmpresa(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscritaArea('administracao'); } catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('id')) || null;
  const codigo = Number(form.get('codigo'));
  const razao = normalizar(form.get('razao_social'));
  const tipo = String(form.get('tipo') || 'operacional');
  const ramo = String(form.get('ramo') || 'outro');
  const cnpj = soDigitos(form.get('cnpj')) || null;

  if (!codigo || codigo < 1) return { erro: 'Informe um código numérico.' };
  if (!razao || razao.length < 3) return { erro: 'A razão social é obrigatória.' };
  if (!TIPOS.includes(tipo)) return { erro: 'Tipo societário inválido.' };
  if (cnpj && !cnpjValido(cnpj)) return { erro: 'CNPJ inválido — confira os dígitos.' };

  const [ramoOk] = await q<any>('select codigo from ramo where codigo = $1', [ramo]);
  if (!ramoOk) return { erro: 'Ramo de atividade inválido.' };

  const [dupe] = await q<any>(
    'select razao_social from empresa where codigo = $1 and ($2::bigint is null or id <> $2)',
    [codigo, id]);
  if (dupe) return { erro: `O código ${codigo} já é de "${dupe.razao_social}".` };

  const campos = [codigo, cnpj, razao, normalizar(form.get('nome_fantasia')),
                  tipo, ramo, form.get('ativo') !== null];
  try {
    if (id) {
      await pool.query(
        `update empresa set codigo=$2, cnpj=$3, razao_social=$4, nome_fantasia=$5,
                tipo=$6, ramo=$7, ativo=$8, atualizado_em=now() where id=$1`, [id, ...campos]);
    } else {
      await pool.query(
        `insert into empresa (codigo, cnpj, razao_social, nome_fantasia, tipo, ramo, ativo)
         values ($1,$2,$3,$4,$5,$6,$7)`, campos);
    }
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }

  revalidatePath('/cadastros/empresas');
  revalidatePath('/empresa');
  return { ok: true };
}
