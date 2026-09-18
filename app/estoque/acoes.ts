'use server';

import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type Resultado = { erro?: string };

const STATUS = ['disponivel', 'reservado', 'vendido', 'permutado',
                'cancelado', 'sob_encomenda', 'baixado'];

const num = (v: FormDataEntryValue | null) => {
  const t = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  return t ? Number(t) : null;
};
const id = (v: FormDataEntryValue | null) => Number(v) || null;

export async function salvarItem(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let usuario;
  try { usuario = await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }

  const itemId = Number(form.get('id')) || null;
  const empresaId = id(form.get('empresa_id'));
  const grupoId = id(form.get('grupo_id'));
  const identificacao = normalizar(form.get('identificacao'));
  const status = String(form.get('status') || 'disponivel');
  const codigo = normalizar(form.get('codigo'));

  if (!empresaId) return { erro: 'Escolha a empresa dona do item.' };
  if (!grupoId) return { erro: 'Escolha o grupo — é ele que define as contas contábeis.' };
  if (!identificacao || identificacao.length < 3)
    return { erro: 'A identificação é obrigatória e precisa dizer o que é o item.' };
  if (!STATUS.includes(status)) return { erro: 'Situação inválida.' };

  if (codigo) {
    const [dupe] = await q<any>(
      `select identificacao from item
        where empresa_id = $1 and codigo = $2 and ($3::bigint is null or id <> $3)`,
      [empresaId, codigo, itemId]);
    if (dupe) return { erro: `O código ${codigo} já é de "${dupe.identificacao}" nesta empresa.` };
  }

  const ean = normalizar(form.get('codigo_barras'));
  if (ean) {
    const [dupeEan] = await q<any>(
      `select identificacao from item
        where empresa_id = $1 and codigo_barras = $2 and ($3::bigint is null or id <> $3)`,
      [empresaId, ean, itemId]);
    if (dupeEan) return { erro: `O código de barras ${ean} já é de "${dupeEan.identificacao}".` };
  }

  const campos = [empresaId, grupoId, id(form.get('centro_custo_id')), codigo, identificacao,
                  normalizar(form.get('descricao')), normalizar(form.get('unidade')) || 'UN',
                  num(form.get('quantidade_minima')), num(form.get('preco_venda')),
                  normalizar(form.get('localizacao')), id(form.get('pessoa_id')), status,
                  normalizar(form.get('bloco')), Number(form.get('andar')) || null,
                  num(form.get('area_privativa')),
                  String(form.get('data_entrada') || '') || null,
                  String(form.get('data_saida') || '') || null,
                  normalizar(form.get('observacao')),
                  form.get('ativo') !== null, ean];

  const cli = await pool.connect();
  let novoId = itemId;
  try {
    await cli.query('begin');
    if (itemId) {
      await cli.query(
        `update item set empresa_id=$2, grupo_id=$3, centro_custo_id=$4, codigo=$5,
                identificacao=$6, descricao=$7, unidade=$8, quantidade_minima=$9,
                preco_venda=$10, localizacao=$11, pessoa_id=$12, status=$13, bloco=$14,
                andar=$15, area_privativa=$16, data_entrada=$17, data_saida=$18,
                observacao=$19, ativo=$20, codigo_barras=$21, atualizado_em=now()
          where id=$1`, [itemId, ...campos]);
    } else {
      const { rows } = await cli.query(
        `insert into item (empresa_id, grupo_id, centro_custo_id, codigo, identificacao,
                           descricao, unidade, quantidade_minima, preco_venda, localizacao,
                           pessoa_id, status, bloco, andar, area_privativa, data_entrada,
                           data_saida, observacao, ativo, codigo_barras)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         returning id`, campos);
      novoId = rows[0].id;

      // Saldo inicial nasce como MOVIMENTO, não como número digitado na coluna.
      // Assim o item começa com a sua própria história e o saldo continua
      // sendo o que os movimentos dizem — sem exceção de origem.
      const qtdInicial = num(form.get('quantidade_inicial')) ?? 0;
      const custoInicial = num(form.get('custo_inicial')) ?? 0;
      if (qtdInicial > 0 || custoInicial > 0) {
        await cli.query(
          `insert into movimento_estoque (item_id, tipo, data, quantidade, valor_unitario,
                                          centro_custo_id, historico, criado_por)
           values ($1, 'entrada', current_date, $2, $3, $4, 'SALDO INICIAL DE CADASTRO', $5)`,
          [novoId, qtdInicial || 1, custoInicial, id(form.get('centro_custo_id')), usuario.email]);
      }
    }
    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback');
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  } finally {
    cli.release();
  }

  revalidatePath('/estoque');
  redirect(`/estoque?salvo=${novoId}`);
}

export async function registrarMovimento(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let usuario;
  try { usuario = await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }

  const itemId = Number(form.get('item_id'));
  const tipo = String(form.get('tipo') || '');
  const data = String(form.get('data') || '');
  const quantidade = num(form.get('quantidade')) ?? 0;
  let valorUnitario = num(form.get('valor_unitario')) ?? 0;
  const historico = normalizar(form.get('historico'));

  if (!itemId) return { erro: 'Item não identificado.' };
  if (!['entrada', 'saida', 'ajuste_entrada', 'ajuste_saida'].includes(tipo))
    return { erro: 'Tipo de movimento inválido.' };
  if (!data) return { erro: 'Informe a data do movimento.' };
  if (!(quantidade > 0)) return { erro: 'A quantidade precisa ser maior que zero.' };
  if (!historico || historico.length < 3)
    return { erro: 'Escreva um histórico dizendo o que foi este movimento.' };

  // Saída sem valor sai pelo custo que o item tem hoje. Deixar em zero faria o
  // estoque perder quantidade sem perder custo — o valor do que sobra ficaria
  // inflado, e o custo da venda, subestimado.
  if (valorUnitario === 0 && (tipo === 'saida' || tipo === 'ajuste_saida')) {
    const [atual] = await q<any>(
      'select custo_unitario::float8 as custo from item where id = $1', [itemId]);
    valorUnitario = atual?.custo ?? 0;
  }

  try {
    await pool.query(
      `insert into movimento_estoque (item_id, tipo, data, quantidade, valor_unitario,
                                      lancamento_id, centro_custo_id, pessoa_id, documento,
                                      historico, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [itemId, tipo, data, quantidade, valorUnitario, id(form.get('lancamento_id')),
       id(form.get('centro_custo_id')), id(form.get('pessoa_id')),
       normalizar(form.get('documento')), historico, usuario.email]);
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }

  revalidatePath(`/estoque/${itemId}`);
  redirect(`/estoque/${itemId}?movimentado=1`);
}

export async function estornarMovimento(form: FormData) {
  await exigirEscrita();
  const movId = Number(form.get('movimento_id'));
  const itemId = Number(form.get('item_id'));
  if (!movId) return;
  // Estorno marca, não apaga: o movimento errado continua visível e o saldo
  // é recalculado ignorando-o.
  await pool.query(
    `update movimento_estoque set estornado_em = now() where id = $1 and estornado_em is null`,
    [movId]);
  revalidatePath(`/estoque/${itemId}`);
  redirect(`/estoque/${itemId}?estornado=1`);
}

export async function mudarSituacao(form: FormData) {
  await exigirEscrita();
  const itemId = Number(form.get('item_id'));
  const status = String(form.get('status') || '');
  if (!itemId || !STATUS.includes(status)) return;
  await pool.query(
    `update item set status = $2,
            data_saida = case when $2 in ('vendido','permutado','baixado')
                              then coalesce(data_saida, current_date) else data_saida end,
            atualizado_em = now()
      where id = $1`, [itemId, status]);
  revalidatePath(`/estoque/${itemId}`);
  redirect(`/estoque/${itemId}?situacao=1`);
}

/**
 * Entrada de uma nota inteira de uma vez. Sem isto, uma loja de decoração
 * teria de cadastrar copo, taça e vaso um a um e depois lançar um movimento
 * para cada — meia hora por nota, e ninguém faz.
 *
 * Cada linha resolve o item por EAN, código ou nome; o que não existe é
 * cadastrado na hora, no grupo escolhido naquela linha.
 */
export async function entradaEmLote(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let usuario;
  try { usuario = await exigirEscrita(); } catch (e: any) { return { erro: e.message }; }

  const empresaId = id(form.get('empresa_id'));
  const data = String(form.get('data') || '');
  const documento = normalizar(form.get('documento'));
  const pessoaId = id(form.get('pessoa_id'));
  const centroId = id(form.get('centro_custo_id'));
  const lancamentoId = id(form.get('lancamento_id'));

  if (!empresaId) return { erro: 'Escolha a empresa.' };
  if (!data) return { erro: 'Informe a data da entrada.' };

  const itens = form.getAll('linha_item').map((v) => normalizar(v) ?? '');
  const grupos = form.getAll('linha_grupo').map((v) => Number(v) || 0);
  const qtds = form.getAll('linha_quantidade').map((v) => num(v) ?? 0);
  const custos = form.getAll('linha_custo').map((v) => num(v) ?? 0);
  const precos = form.getAll('linha_preco').map((v) => num(v));
  const eans = form.getAll('linha_ean').map((v) => normalizar(v));

  // linha em branco é linha que o usuário abriu e não usou: ignora
  const linhas = itens
    .map((nome, i) => ({ nome, grupoId: grupos[i], quantidade: qtds[i],
                         custo: custos[i], preco: precos[i], ean: eans[i] }))
    .filter((l) => l.nome && l.quantidade > 0);

  if (linhas.length === 0)
    return { erro: 'Nenhuma linha preenchida. Informe ao menos um item com quantidade.' };
  for (const l of linhas) {
    if (!l.grupoId) return { erro: `Escolha o grupo de "${l.nome}".` };
    if (l.quantidade <= 0) return { erro: `A quantidade de "${l.nome}" precisa ser maior que zero.` };
  }

  const historico = documento ? `ENTRADA ${documento}` : 'ENTRADA DE MERCADORIA';
  const cli = await pool.connect();
  let criados = 0;
  try {
    await cli.query('begin');
    for (const l of linhas) {
      // EAN primeiro: é o que o leitor de código de barras preenche.
      const { rows: achados } = await cli.query(
        `select id from item
          where empresa_id = $1
            and ($2::text is not null and codigo_barras = $2
                 or upper(trim(codigo)) = $3
                 or upper(trim(identificacao)) = $3)
          order by (codigo_barras = $2) desc nulls last
          limit 1`, [empresaId, l.ean, l.nome]);

      let itemId: number;
      if (achados.length) {
        itemId = achados[0].id;
        // preço e EAN informados na nota atualizam o cadastro que já existia
        await cli.query(
          `update item set preco_venda = coalesce($2, preco_venda),
                  codigo_barras = coalesce(codigo_barras, $3), atualizado_em = now()
            where id = $1`, [itemId, l.preco, l.ean]);
      } else {
        const { rows } = await cli.query(
          `insert into item (empresa_id, grupo_id, identificacao, codigo_barras,
                             preco_venda, centro_custo_id, status)
           values ($1,$2,$3,$4,$5,$6,'disponivel') returning id`,
          [empresaId, l.grupoId, l.nome, l.ean, l.preco, centroId]);
        itemId = rows[0].id;
        criados++;
      }

      await cli.query(
        `insert into movimento_estoque (item_id, tipo, data, quantidade, valor_unitario,
                                        lancamento_id, centro_custo_id, pessoa_id,
                                        documento, historico, criado_por)
         values ($1,'entrada',$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [itemId, data, l.quantidade, l.custo, lancamentoId, centroId, pessoaId,
         documento, historico, usuario.email]);
    }
    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback');
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  } finally {
    cli.release();
  }

  revalidatePath('/estoque');
  redirect(`/estoque?entrada=${linhas.length}&novos=${criados}`);
}
