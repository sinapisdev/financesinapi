'use server';

import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type Resultado = { erro?: string; ok?: boolean };

export async function salvarForma(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('id')) || null;
  const nome = normalizar(form.get('nome'));
  if (!nome || nome.length < 2) return { erro: 'Informe o nome da forma de pagamento.' };

  const [dupe] = await q<any>(
    'select id from forma_pagamento where upper(nome) = $1 and ($2::bigint is null or id <> $2)',
    [nome, id]);
  if (dupe) return { erro: `"${nome}" já existe.` };

  try {
    if (id) {
      await pool.query('update forma_pagamento set nome = $2 where id = $1', [id, nome]);
    } else {
      const [prox] = await q<any>('select coalesce(max(codigo), 0) + 1 as n from forma_pagamento');
      await pool.query('insert into forma_pagamento (codigo, nome) values ($1, $2)', [prox.n, nome]);
    }
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }
  revalidatePath('/cadastros/formas');
  return { ok: true };
}

export async function alternarForma(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }
  const id = Number(form.get('id'));
  if (!id) return { erro: 'Forma não informada.' };
  await pool.query('update forma_pagamento set ativo = not ativo where id = $1', [id]);
  revalidatePath('/cadastros/formas');
  return { ok: true };
}
