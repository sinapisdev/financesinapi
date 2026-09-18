'use server';

import { pool } from '@/lib/db';
import { paraCentavos } from '@/lib/parcelamento';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { normalizar } from '@/lib/texto';

export type Resultado = { erro?: string };

/** Liquida (total ou parcialmente) uma parcela. */
export async function darBaixa(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const parcelaId = Number(form.get('parcela_id'));
  const contaBancariaId = Number(form.get('conta_bancaria_id')) || null;
  const formaId = Number(form.get('forma_pagamento_id')) || null;
  const data = String(form.get('data_liquidacao') || '');
  const principal = paraCentavos(String(form.get('valor_principal') || ''));
  const juros = paraCentavos(String(form.get('juros') || ''));
  const multa = paraCentavos(String(form.get('multa') || ''));
  const desconto = paraCentavos(String(form.get('desconto') || ''));
  const observacao = normalizar(form.get('observacao'));
  const voltarPara = String(form.get('voltar_para') || '');

  if (!parcelaId) return { erro: 'Parcela não informada.' };
  if (!contaBancariaId) return { erro: 'Escolha a conta bancária que recebeu ou pagou.' };
  if (!data) return { erro: 'Informe a data da liquidação.' };
  if (principal <= 0) return { erro: 'O valor principal precisa ser maior que zero.' };
  if (desconto > principal + juros + multa) {
    return { erro: 'O desconto não pode ser maior que o valor da baixa.' };
  }

  const { rows } = await pool.query(
    `select p.id, p.status, p.valor_original, p.valor_baixado, l.status as lanc_status
       from parcela p join lancamento l on l.id = p.lancamento_id where p.id = $1`, [parcelaId]);
  const parcela = rows[0];
  if (!parcela) return { erro: 'Parcela não encontrada.' };
  if (parcela.status === 'cancelada') return { erro: 'Esta parcela está cancelada.' };
  if (parcela.lanc_status === 'cancelado') return { erro: 'O lançamento desta parcela foi cancelado.' };

  const saldo = paraCentavos(parcela.valor_original) - paraCentavos(parcela.valor_baixado);
  if (saldo <= 0) return { erro: 'Esta parcela já está liquidada.' };
  if (principal > saldo) {
    return { erro: `O principal (R$ ${(principal / 100).toFixed(2)}) é maior que o saldo em aberto (R$ ${(saldo / 100).toFixed(2)}). Juros e multa entram nos campos próprios.` };
  }

  try {
    await pool.query(
      `insert into baixa (parcela_id, conta_bancaria_id, forma_pagamento_id, data_liquidacao,
                          valor_principal, juros, multa, desconto, observacao, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [parcelaId, contaBancariaId, formaId, data,
       principal / 100, juros / 100, multa / 100, desconto / 100, observacao, autor.email]);
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') || 'Não foi possível gravar a baixa.' };
  }

  revalidatePath('/extrato'); revalidatePath('/receber');
  revalidatePath('/pagar'); revalidatePath('/lancamentos');
  redirect(voltarPara || '/receber');
}

/** Estorna uma baixa: ela fica no histórico e deixa de contar no caixa. */
export async function estornarBaixa(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const baixaId = Number(form.get('baixa_id'));
  const motivo = normalizar(form.get('motivo')) ?? '';
  const voltarPara = String(form.get('voltar_para') || '');
  if (!baixaId) return { erro: 'Baixa não informada.' };
  if (!motivo) return { erro: 'Descreva o motivo do estorno.' };

  const { rowCount } = await pool.query(
    `update baixa set estornada_em = now(), estornada_por = $3, motivo_estorno = $2
      where id = $1 and estornada_em is null`, [baixaId, motivo, autor.email]);
  if (!rowCount) return { erro: 'Essa baixa não existe ou já foi estornada.' };

  revalidatePath('/extrato'); revalidatePath('/receber');
  revalidatePath('/pagar'); revalidatePath('/lancamentos');
  redirect(voltarPara || '/lancamentos');
}

/** Cancela o lançamento e suas parcelas em aberto. Baixas já feitas não são desfeitas. */
export async function cancelarLancamento(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('lancamento_id'));
  const motivo = normalizar(form.get('motivo')) ?? '';
  if (!id) return { erro: 'Lançamento não informado.' };
  if (!motivo) return { erro: 'Descreva o motivo do cancelamento.' };

  const { rows } = await pool.query(
    `select l.status,
            (select count(*) from parcela p join baixa b on b.parcela_id = p.id
              where p.lancamento_id = l.id and b.estornada_em is null)::int as baixas
       from lancamento l where l.id = $1`, [id]);
  if (!rows[0]) return { erro: 'Lançamento não encontrado.' };
  if (rows[0].status === 'cancelado') return { erro: 'Este lançamento já está cancelado.' };
  if (rows[0].baixas > 0) {
    return { erro: `Este lançamento tem ${rows[0].baixas} baixa(s) ativa(s). Estorne as baixas antes de cancelar — senão o caixa deixa de bater com o extrato.` };
  }

  const cli = await pool.connect();
  try {
    await cli.query('begin');
    await cli.query('set constraints all deferred');
    await cli.query(
      `update lancamento set status = 'cancelado', observacao =
         coalesce(observacao || ' · ', '') || 'CANCELADO: ' || $2, atualizado_em = now()
        where id = $1`, [id, motivo]);
    await cli.query(
      `update parcela set status = 'cancelada', atualizado_em = now()
        where lancamento_id = $1 and status <> 'cancelada'`, [id]);
    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback').catch(() => {});
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  } finally { cli.release(); }

  revalidatePath('/lancamentos'); revalidatePath('/receber'); revalidatePath('/pagar');
  redirect(`/lancamentos/${id}`);
}
