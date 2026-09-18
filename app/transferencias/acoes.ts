'use server';

import { pool } from '@/lib/db';
import { paraCentavos } from '@/lib/parcelamento';
import { normalizar } from '@/lib/texto';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type Resultado = { erro?: string };

export async function criarTransferencia(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const empresaId = Number(form.get('empresa_id'));
  const origem = Number(form.get('conta_origem_id'));
  const destino = Number(form.get('conta_destino_id'));
  const data = String(form.get('data_movimento') || '');
  const valor = paraCentavos(String(form.get('valor') || ''));
  const descricao = normalizar(form.get('descricao'));

  if (!empresaId) return { erro: 'Empresa não informada.' };
  if (!origem || !destino) return { erro: 'Escolha a conta de origem e a de destino.' };
  if (origem === destino) return { erro: 'A conta de destino precisa ser diferente da origem.' };
  if (!data) return { erro: 'Informe a data da transferência.' };
  if (valor <= 0) return { erro: 'O valor precisa ser maior que zero.' };

  // as duas contas têm de pertencer à empresa — senão o dinheiro "muda de dono"
  const { rows } = await pool.query(
    `select id, empresa_id, apelido from conta_bancaria where id = any($1::bigint[])`,
    [[origem, destino]]);
  if (rows.length !== 2) return { erro: 'Conta bancária não encontrada.' };
  // node-postgres devolve bigint como string; comparar sem converter dá falso negativo
  const fora = rows.find((c: any) => Number(c.empresa_id) !== empresaId);
  if (fora) return { erro: `A conta "${fora.apelido}" não pertence a esta empresa. Movimento entre empresas é mútuo, não transferência.` };

  try {
    await pool.query(
      `insert into transferencia (empresa_id, conta_origem_id, conta_destino_id,
                                  data_movimento, valor, descricao, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [empresaId, origem, destino, data, valor / 100,
       descricao ?? 'TRANSFERÊNCIA ENTRE CONTAS', autor.email]);
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }

  revalidatePath('/transferencias');
  revalidatePath('/extrato');
  redirect('/transferencias?criada=1');
}

export async function excluirTransferencia(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('transferencia_id'));
  if (!id) return { erro: 'Transferência não informada.' };
  const { rowCount } = await pool.query('delete from transferencia where id = $1', [id]);
  if (!rowCount) return { erro: 'Transferência não encontrada.' };
  revalidatePath('/transferencias');
  revalidatePath('/extrato');
  return {};
}
