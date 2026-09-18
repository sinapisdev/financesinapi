'use server';

import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type Resultado = { erro?: string };
const TIPOS = ['obra', 'administrativo', 'incorporadora', 'projeto', 'outro'];
const STATUS = ['planejada', 'em_andamento', 'concluida', 'cancelada'];

const num = (v: FormDataEntryValue | null) => {
  const t = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  return t ? Number(t) : null;
};

export async function salvarCentro(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('id')) || null;
  const codigo = Number(form.get('codigo'));
  const empresaId = Number(form.get('empresa_id'));
  const nome = normalizar(form.get('nome'));
  const tipo = String(form.get('tipo') || 'obra');
  const status = String(form.get('status') || 'planejada');

  if (!nome || nome.length < 3) return { erro: 'O nome é obrigatório.' };
  if (!codigo || codigo < 1) return { erro: 'Informe um código numérico.' };
  if (!empresaId) return { erro: 'Escolha a empresa.' };
  if (!TIPOS.includes(tipo)) return { erro: 'Tipo inválido.' };
  if (!STATUS.includes(status)) return { erro: 'Situação inválida.' };

  const [dupe] = await q<any>(
    'select id, nome from centro_custo where codigo = $1 and ($2::bigint is null or id <> $2)',
    [codigo, id]);
  if (dupe) return { erro: `O código ${codigo} já é de "${dupe.nome}".` };

  const campos = [codigo, empresaId, nome, tipo, normalizar(form.get('tipo_imovel')),
                  normalizar(form.get('cidade')), normalizar(form.get('uf'))?.slice(0, 2) ?? null,
                  status, Number(form.get('qtd_unidades')) || null,
                  num(form.get('vgv_estimado')), num(form.get('custo_estimado')),
                  String(form.get('data_inicio_prevista') || '') || null,
                  String(form.get('data_fim_prevista') || '') || null];
  let novoId = id;
  try {
    if (id) {
      await pool.query(
        `update centro_custo set codigo=$2, empresa_id=$3, nome=$4, tipo=$5, tipo_imovel=$6,
                cidade=$7, uf=$8, status=$9, qtd_unidades=$10, vgv_estimado=$11,
                custo_estimado=$12, data_inicio_prevista=$13, data_fim_prevista=$14,
                atualizado_em=now() where id=$1`, [id, ...campos]);
    } else {
      const { rows } = await pool.query(
        `insert into centro_custo (codigo, empresa_id, nome, tipo, tipo_imovel, cidade, uf, status,
                                   qtd_unidades, vgv_estimado, custo_estimado,
                                   data_inicio_prevista, data_fim_prevista)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`, campos);
      novoId = rows[0].id;
    }
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }
  revalidatePath('/cadastros/centros');
  redirect(`/cadastros/centros?salvo=${novoId}`);
}
