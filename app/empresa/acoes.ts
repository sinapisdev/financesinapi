'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_EMPRESA } from '@/lib/empresa';
import { exigirUsuario } from '@/lib/auth';

export async function escolherEmpresa(form: FormData) {
  await exigirUsuario();
  const valor = String(form.get('empresa') || '');
  const destino = String(form.get('destino') || '/painel');
  if (!valor) return;

  (await cookies()).set(COOKIE_EMPRESA, valor, {
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
    sameSite: 'lax',
  });
  redirect(destino);
}
