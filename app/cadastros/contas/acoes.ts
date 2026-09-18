'use server';

import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type Resultado = { erro?: string };
const TIPOS = ['corrente', 'poupanca', 'aplicacao', 'caixa_fisico'];

export async function salvarConta(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('id')) || null;
  const empresaId = Number(form.get('empresa_id'));
  const apelido = normalizar(form.get('apelido'));
  const instituicao = normalizar(form.get('instituicao'));
  const tipo = String(form.get('tipo') || 'corrente');
  const agencia = normalizar(form.get('agencia'));
  const conta = normalizar(form.get('numero_conta'));
  const saldoTxt = String(form.get('saldo_inicial') || '0').replace(/\./g, '').replace(',', '.');
  const saldo = Number(saldoTxt) || 0;

  if (!apelido || apelido.length < 2) return { erro: 'Dê um apelido para a conta (ex.: SICOOB OBRAS).' };
  if (!instituicao) return { erro: 'Informe a instituição.' };
  if (!empresaId) return { erro: 'Escolha a empresa.' };
  if (!TIPOS.includes(tipo)) return { erro: 'Tipo de conta inválido.' };
  if (tipo !== 'caixa_fisico' && (!agencia || !conta)) {
    return { erro: 'Agência e número da conta são obrigatórios, exceto em caixa físico.' };
  }

  // a mesma agência/conta não pode se repetir dentro da empresa
  if (agencia && conta) {
    const [dupe] = await q<any>(
      `select id, apelido from conta_bancaria
        where empresa_id = $1 and agencia = $2 and numero_conta = $3
          and ($4::bigint is null or id <> $4)`, [empresaId, agencia, conta, id]);
    if (dupe) return { erro: `Esta agência e conta já estão em "${dupe.apelido}".` };
  }

  const campos = [empresaId, apelido, instituicao, normalizar(form.get('codigo_bacen')),
                  agencia, conta, tipo, Number(form.get('centro_custo_id')) || null,
                  Number(form.get('conta_contabil_id')) || null, saldo,
                  String(form.get('data_saldo_inicial') || '') || null,
                  form.get('ativo') !== 'off'];
  let novoId = id;
  try {
    if (id) {
      await pool.query(
        `update conta_bancaria set empresa_id=$2, apelido=$3, instituicao=$4, codigo_bacen=$5,
                agencia=$6, numero_conta=$7, tipo=$8, centro_custo_id=$9, conta_contabil_id=$10,
                saldo_inicial=$11, data_saldo_inicial=$12, ativo=$13, atualizado_em=now()
          where id=$1`, [id, ...campos]);
    } else {
      const { rows } = await pool.query(
        `insert into conta_bancaria (empresa_id, apelido, instituicao, codigo_bacen, agencia,
                                     numero_conta, tipo, centro_custo_id, conta_contabil_id,
                                     saldo_inicial, data_saldo_inicial, ativo)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, campos);
      novoId = rows[0].id;
    }
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }
  revalidatePath('/cadastros/contas');
  revalidatePath('/transferencias');
  redirect(`/cadastros/contas?salvo=${novoId}`);
}
