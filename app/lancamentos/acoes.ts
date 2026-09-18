'use server';

import { pool } from '@/lib/db';
import { gerarParcelas, paraCentavos, type PlanoPagamento } from '@/lib/parcelamento';
import { exigirEscrita } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { normalizar } from '@/lib/texto';

export type Resultado = { erro?: string };

/** Edita a descrição e tira a marca de "gerada automaticamente". */
export async function editarDescricao(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('lancamento_id'));
  const descricao = normalizar(form.get('descricao'));
  if (!id) return { erro: 'Lançamento não informado.' };
  if (!descricao) return { erro: 'A descrição não pode ficar vazia.' };
  if (descricao.length < 3) return { erro: 'A descrição precisa ter ao menos 3 caracteres.' };
  if (descricao.length > 200) return { erro: 'Descrição longa demais (máximo 200 caracteres).' };

  const { rowCount } = await pool.query(
    `update lancamento set descricao = $2, descricao_automatica = false, atualizado_em = now()
      where id = $1`, [id, descricao]);
  if (!rowCount) return { erro: 'Lançamento não encontrado.' };

  revalidatePath('/lancamentos');
  revalidatePath(`/lancamentos/${id}`);
  revalidatePath('/extrato');
  return {};
}

export async function criarLancamento(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const tipo = String(form.get('tipo') || '');
  const empresaId = Number(form.get('empresa_id'));
  const centroId = Number(form.get('centro_custo_id')) || null;
  const processoId = Number(form.get('processo_id')) || null;
  const pessoaId = Number(form.get('pessoa_id')) || null;
  const contaId = Number(form.get('conta_id')) || null;
  const descricao = normalizar(form.get('descricao')) ?? '';
  const observacao = normalizar(form.get('observacao'));
  const competencia = String(form.get('data_competencia') || '');
  const valorTotal = paraCentavos(String(form.get('valor_total') || ''));
  const aVista = form.get('forma') === 'avista';

  if (!['receita', 'despesa'].includes(tipo)) return { erro: 'Escolha receita ou despesa.' };
  if (!empresaId) return { erro: 'Escolha a empresa.' };
  if (!descricao) return { erro: 'A descrição é obrigatória.' };
  if (descricao.length < 3) return { erro: 'A descrição precisa ter ao menos 3 caracteres.' };
  if (!competencia) return { erro: 'Informe a data de lançamento.' };
  if (valorTotal <= 0) return { erro: 'O valor precisa ser maior que zero.' };

  // Se o processo aponta para conta sintética, a analítica é obrigatória.
  // Validado aqui e não só na tela: o formulário pode ser burlado.
  if (processoId) {
    const { rows } = await pool.query(
      `select p.codigo, p.nome,
              cd.codigo as d_cod, coalesce(cd.aceita_lancamento, true) as d_analitica,
              cc.codigo as c_cod, coalesce(cc.aceita_lancamento, true) as c_analitica
         from processo p
         left join plano_conta cd on cd.id = p.conta_debito_id
         left join plano_conta cc on cc.id = p.conta_credito_id
        where p.id = $1`, [processoId]);
    const proc = rows[0];
    if (!proc) return { erro: 'Processo não encontrado.' };

    const raiz = (!proc.d_analitica && proc.d_cod) ? proc.d_cod
               : (!proc.c_analitica && proc.c_cod) ? proc.c_cod : null;

    if (raiz) {
      if (!contaId) {
        return { erro: `O processo ${proc.codigo} — ${proc.nome} usa a conta ${raiz}, que é de agrupamento. Escolha a conta analítica.` };
      }
      const { rows: ct } = await pool.query(
        `select codigo, aceita_lancamento from plano_conta where id = $1`, [contaId]);
      const conta = ct[0];
      if (!conta) return { erro: 'Conta contábil não encontrada.' };
      if (!conta.aceita_lancamento) return { erro: `A conta ${conta.codigo} é sintética e não recebe lançamento.` };
      if (!String(conta.codigo).startsWith(raiz + '.')) {
        return { erro: `A conta ${conta.codigo} não pertence a ${raiz}, que é o grupo do processo ${proc.codigo}.` };
      }
    }
  }

  const plano: PlanoPagamento = {
    valorTotal, aVista, dataBase: competencia,
    numParcelas: Number(form.get('num_parcelas')) || 0,
    primeiroVencimento: String(form.get('primeiro_vencimento') || '') || undefined,
    periodicidadeMeses: Number(form.get('periodicidade')) || 1,
    valorEntrada: paraCentavos(String(form.get('valor_entrada') || '')),
    dataEntrada: String(form.get('data_entrada') || '') || undefined,
    numBaloes: Number(form.get('num_baloes')) || 0,
    valorBalao: paraCentavos(String(form.get('valor_balao') || '')),
    primeiroBalao: String(form.get('primeiro_balao') || '') || undefined,
    periodicidadeBaloes: Number(form.get('periodicidade_baloes')) || 6,
    valorChaves: paraCentavos(String(form.get('valor_chaves') || '')),
    dataChaves: String(form.get('data_chaves') || '') || undefined,
  };

  // recalculado aqui: o preview do navegador nunca é a fonte
  const parcelas = gerarParcelas(plano);
  if (!parcelas.length) return { erro: 'Nenhuma parcela foi gerada. Revise o parcelamento.' };

  const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
  if (somaParcelas !== valorTotal) {
    return { erro: `As parcelas somam R$ ${(somaParcelas / 100).toFixed(2)} e o lançamento vale R$ ${(valorTotal / 100).toFixed(2)}. Revise entrada, balões e chaves.` };
  }

  const contaBancariaId = Number(form.get('conta_bancaria_id')) || null;
  const dataPagamento = String(form.get('data_pagamento') || '') || competencia;
  if (aVista && !contaBancariaId) return { erro: 'Em pagamento à vista, informe a conta bancária.' };

  const cli = await pool.connect();
  let novoId = 0;
  try {
    await cli.query('begin');
    await cli.query('set constraints all deferred');

    const { rows } = await cli.query(
      `insert into lancamento (numero, empresa_id, centro_custo_id, processo_id, conta_id, tipo, pessoa_id,
                               data_competencia, valor_total, descricao, observacao, a_vista, status, criado_por)
       values ('LAN' || lpad(nextval('lancamento_numero_seq')::text, 6, '0'),
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ativo',$12)
       returning id`,
      [empresaId, centroId, processoId, contaId, tipo, pessoaId, competencia,
       valorTotal / 100, descricao, observacao, aVista, autor.email]);
    novoId = rows[0].id;

    for (const p of parcelas) {
      const { rows: pr } = await cli.query(
        `insert into parcela (lancamento_id, numero, tipo, pessoa_id, data_vencimento,
                              valor_original, categoria, status)
         values ($1,$2,$3,$4,$5,$6,$7,'aberta') returning id`,
        [novoId, p.numero, tipo === 'receita' ? 'receber' : 'pagar', pessoaId,
         p.vencimento, p.valor / 100, p.categoria]);

      if (aVista) {
        await cli.query(
          `insert into baixa (parcela_id, conta_bancaria_id, data_liquidacao, valor_principal, criado_por)
           values ($1,$2,$3,$4,$5)`,
          [pr[0].id, contaBancariaId, dataPagamento, p.valor / 100, autor.email]);
      }
    }
    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback').catch(() => {});
    // a trava do banco fala português; repassamos a mensagem dela
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') || 'Não foi possível gravar o lançamento.' };
  } finally {
    cli.release();
  }

  revalidatePath('/lancamentos');
  revalidatePath('/extrato');
  redirect(`/lancamentos?criado=${novoId}`);
}


/**
 * Edita um lançamento.
 * Classificação (data, centro, processo, conta, contraparte, observação) pode
 * mudar sempre. O VALOR só muda enquanto não houver baixa: com dinheiro já
 * movimentado, mexer no valor descolaria o sistema do extrato bancário.
 */
export async function editarLancamento(_anterior: Resultado, form: FormData): Promise<Resultado> {
  let autor;
  try { autor = await exigirEscrita(); }
  catch (e: any) { return { erro: e.message }; }

  const id = Number(form.get('lancamento_id'));
  if (!id) return { erro: 'Lançamento não informado.' };

  const descricao = normalizar(form.get('descricao'));
  const observacao = normalizar(form.get('observacao'));
  const competencia = String(form.get('data_competencia') || '');
  const centroId = Number(form.get('centro_custo_id')) || null;
  const processoId = Number(form.get('processo_id')) || null;
  const contaId = Number(form.get('conta_id')) || null;
  const pessoaId = Number(form.get('pessoa_id')) || null;
  const novoValor = paraCentavos(String(form.get('valor_total') || ''));

  if (!descricao) return { erro: 'A descrição é obrigatória.' };
  if (descricao.length < 3) return { erro: 'A descrição precisa ter ao menos 3 caracteres.' };
  if (!competencia) return { erro: 'Informe a data do lançamento.' };

  const { rows } = await pool.query(
    `select l.id, l.status, l.valor_total,
            (select count(*) from parcela p join baixa b on b.parcela_id = p.id
              where p.lancamento_id = l.id and b.estornada_em is null)::int as baixas
       from lancamento l where l.id = $1`, [id]);
  const atual = rows[0];
  if (!atual) return { erro: 'Lançamento não encontrado.' };
  if (atual.status === 'cancelado') return { erro: 'Lançamento cancelado não pode ser editado.' };

  const valorAtual = paraCentavos(atual.valor_total);
  const mudouValor = novoValor > 0 && novoValor !== valorAtual;

  if (mudouValor && atual.baixas > 0) {
    return { erro: `Este lançamento já tem ${atual.baixas} baixa(s). O valor não pode mudar — o caixa deixaria de bater com o extrato. Estorne as baixas primeiro, ou cancele e refaça.` };
  }

  // a conta precisa continuar pertencendo ao grupo do processo
  if (processoId) {
    const { rows: pr } = await pool.query(
      `select p.codigo, p.nome,
              cd.codigo as d_cod, coalesce(cd.aceita_lancamento, true) as d_analitica,
              cc.codigo as c_cod, coalesce(cc.aceita_lancamento, true) as c_analitica
         from processo p
         left join plano_conta cd on cd.id = p.conta_debito_id
         left join plano_conta cc on cc.id = p.conta_credito_id
        where p.id = $1`, [processoId]);
    const proc = pr[0];
    if (!proc) return { erro: 'Processo não encontrado.' };
    const raiz = (!proc.d_analitica && proc.d_cod) ? proc.d_cod
               : (!proc.c_analitica && proc.c_cod) ? proc.c_cod : null;
    if (raiz) {
      if (!contaId) return { erro: `O processo ${proc.codigo} usa a conta ${raiz}, que é de agrupamento. Escolha a conta analítica.` };
      const { rows: ct } = await pool.query('select codigo from plano_conta where id = $1', [contaId]);
      if (!ct[0]) return { erro: 'Conta contábil não encontrada.' };
      if (!String(ct[0].codigo).startsWith(raiz + '.')) {
        return { erro: `A conta ${ct[0].codigo} não pertence a ${raiz}, grupo do processo ${proc.codigo}.` };
      }
    }
  }

  const cli = await pool.connect();
  try {
    await cli.query('begin');
    await cli.query('set constraints all deferred');

    await cli.query(
      `update lancamento set descricao = $2, descricao_automatica = false, observacao = $3,
              data_competencia = $4, centro_custo_id = $5, processo_id = $6, conta_id = $7,
              pessoa_id = $8, valor_total = coalesce($9, valor_total), atualizado_em = now()
        where id = $1`,
      [id, descricao, observacao, competencia, centroId, processoId, contaId, pessoaId,
       mudouValor ? novoValor / 100 : null]);

    if (mudouValor) {
      // redistribui proporcionalmente, mantendo datas e quantidade de parcelas.
      // A sobra de arredondamento vai na última, para a soma fechar exata.
      const { rows: ps } = await cli.query(
        `select id, valor_original from parcela
          where lancamento_id = $1 and status <> 'cancelada' order by numero`, [id]);
      if (!ps.length) return { erro: 'Lançamento sem parcelas para redistribuir.' };

      const somaAntiga = ps.reduce((s: number, p: any) => s + paraCentavos(p.valor_original), 0);
      let acumulado = 0;
      for (let i = 0; i < ps.length; i++) {
        const proporcional = i === ps.length - 1
          ? novoValor - acumulado
          : Math.round(paraCentavos(ps[i].valor_original) * novoValor / somaAntiga);
        acumulado += proporcional;
        if (proporcional <= 0) {
          await cli.query('rollback');
          return { erro: 'A redistribuição deixaria alguma parcela zerada ou negativa. Ajuste as parcelas manualmente.' };
        }
        await cli.query('update parcela set valor_original = $2, atualizado_em = now() where id = $1',
          [ps[i].id, proporcional / 100]);
      }
      await cli.query('update lancamento set juros_embutidos = 0 where id = $1', [id]);
    }

    await cli.query('commit');
  } catch (e: any) {
    await cli.query('rollback').catch(() => {});
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  } finally { cli.release(); }

  revalidatePath('/lancamentos');
  revalidatePath(`/lancamentos/${id}`);
  revalidatePath('/extrato');
  redirect(`/lancamentos/${id}?editado=1`);
}
