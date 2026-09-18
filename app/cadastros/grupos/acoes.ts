'use server';

import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type Resultado = { erro?: string; ok?: boolean };

const TIPOS = ['imovel', 'produto', 'servico', 'outro'];
const CONTROLES = ['unidade', 'quantidade', 'nenhum'];
const id = (v: FormDataEntryValue | null) => Number(v) || null;

export async function salvarGrupo(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }

  const grupoId = Number(form.get('id')) || null;
  const codigo = normalizar(form.get('codigo'))?.replace(/\s+/g, '-') ?? '';
  const nome = normalizar(form.get('nome'));
  const tipo = String(form.get('tipo') || 'produto');
  const controle = String(form.get('controle') || 'quantidade');
  const ramos = form.getAll('ramos').map(String).filter(Boolean);

  if (!codigo) return { erro: 'Informe um código curto para o grupo.' };
  if (!nome || nome.length < 3) return { erro: 'O nome do grupo é obrigatório.' };
  if (!TIPOS.includes(tipo)) return { erro: 'Tipo inválido.' };
  if (!CONTROLES.includes(controle)) return { erro: 'Forma de controle inválida.' };

  const [dupe] = await q<any>(
    'select nome from item_grupo where codigo = $1 and ($2::bigint is null or id <> $2)',
    [codigo, grupoId]);
  if (dupe) return { erro: `O código ${codigo} já é de "${dupe.nome}".` };

  // Trocar a forma de controle de um grupo que já tem item muda como o saldo
  // é calculado — e o saldo antigo deixaria de fazer sentido em silêncio.
  if (grupoId) {
    const [atual] = await q<any>(
      `select g.controle, (select count(*) from item i where i.grupo_id = g.id)::int as itens
         from item_grupo g where g.id = $1`, [grupoId]);
    if (atual && atual.controle !== controle && atual.itens > 0)
      return { erro: `Este grupo já tem ${atual.itens} ${atual.itens === 1 ? 'item' : 'itens'}. ` +
                     'Mova os itens para outro grupo antes de mudar a forma de controle.' };
  }

  const campos = [codigo, nome, tipo, controle,
                  id(form.get('conta_estoque_id')), id(form.get('conta_receita_id')),
                  id(form.get('conta_custo_id')), normalizar(form.get('observacao')),
                  form.get('ativo') !== null];
  const cli = await pool.connect();
  try {
    await cli.query('begin');
    let alvo = grupoId;
    if (grupoId) {
      await cli.query(
        `update item_grupo set codigo=$2, nome=$3, tipo=$4, controle=$5,
                conta_estoque_id=$6, conta_receita_id=$7, conta_custo_id=$8,
                observacao=$9, ativo=$10 where id=$1`, [grupoId, ...campos]);
    } else {
      const { rows } = await cli.query(
        `insert into item_grupo (codigo, nome, tipo, controle, conta_estoque_id,
                                 conta_receita_id, conta_custo_id, observacao, ativo)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, campos);
      alvo = rows[0].id;
    }
    // Nenhum ramo marcado = grupo universal, aparece para todo mundo.
    await cli.query('delete from item_grupo_ramo where grupo_id = $1', [alvo]);
    if (ramos.length)
      await cli.query(
        `insert into item_grupo_ramo (grupo_id, ramo)
         select $1, unnest($2::text[])`, [alvo, ramos]);
    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback');
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  } finally {
    cli.release();
  }

  revalidatePath('/cadastros/grupos');
  revalidatePath('/estoque');
  return { ok: true };
}
