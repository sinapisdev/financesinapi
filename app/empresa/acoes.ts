'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_EMPRESA } from '@/lib/empresa';
import { exigirUsuario } from '@/lib/auth';
import { empresasDe } from '@/lib/permissoes';

export async function escolherEmpresa(form: FormData) {
  const eu = await exigirUsuario();
  const valor = String(form.get('empresa') || '');
  const destino = String(form.get('destino') || '/painel');
  if (!valor) return;

  // A action é um endpoint próprio: sem esta checagem, bastaria forjar o
  // envio com outro id para ver uma empresa fora do escopo.
  const permitidas = await empresasDe(eu.id);
  if (permitidas.length) {
    const id = Number(valor);
    if (valor === 'todas' || !permitidas.includes(id)) {
      throw new Error('Seu acesso não alcança esta empresa.');
    }
  }

  (await cookies()).set(COOKIE_EMPRESA, valor, {
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
    sameSite: 'lax',
  });
  redirect(destino);
}
