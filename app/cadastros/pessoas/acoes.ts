'use server';

import { pool, q } from '@/lib/db';
import { normalizar } from '@/lib/texto';
import { soDigitos, documentoValido } from '@/lib/documento';
import { exigirEscritaArea } from '@/lib/permissoes';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type Resultado = { erro?: string };

function ler(form: FormData) {
  return {
    id: Number(form.get('id')) || null,
    tipo_pessoa: String(form.get('tipo_pessoa') || 'PJ'),
    nome: normalizar(form.get('nome_razao_social')),
    fantasia: normalizar(form.get('nome_fantasia')),
    documento: soDigitos(form.get('cpf_cnpj')) || null,
    rg_ie: normalizar(form.get('rg_ie')),
    email: String(form.get('email') || '').trim().toLowerCase() || null,
    telefone: normalizar(form.get('telefone')),
    endereco: normalizar(form.get('endereco')),
    numero: normalizar(form.get('numero')),
    complemento: normalizar(form.get('complemento')),
    bairro: normalizar(form.get('bairro')),
    cidade: normalizar(form.get('cidade')),
    uf: normalizar(form.get('uf'))?.slice(0, 2) ?? null,
    cep: soDigitos(form.get('cep')).slice(0, 8) || null,
    eh_cliente: form.get('eh_cliente') === 'on',
    eh_fornecedor: form.get('eh_fornecedor') === 'on',
    eh_vendedor: form.get('eh_vendedor') === 'on',
    juros: Number(String(form.get('juros_percentual') || '0').replace(',', '.')) || 0,
    multa: Number(String(form.get('multa_percentual') || '0').replace(',', '.')) || 0,
    tolerancia: Number(form.get('dias_tolerancia')) || 0,
    comissao: String(form.get('percentual_comissao') || '').trim()
      ? Number(String(form.get('percentual_comissao')).replace(',', '.')) : null,
    ativo: form.get('ativo') !== 'off',
  };
}

function validar(d: ReturnType<typeof ler>): string | null {
  if (!d.nome || d.nome.length < 3) return 'O nome ou razão social é obrigatório.';
  if (!d.eh_cliente && !d.eh_fornecedor && !d.eh_vendedor) {
    return 'Marque ao menos um papel: cliente, fornecedor ou vendedor.';
  }
  if (d.documento && !documentoValido(d.documento)) {
    return d.documento.length === 11 || d.documento.length === 14
      ? 'CPF/CNPJ inválido — confira os dígitos.'
      : 'CPF precisa ter 11 dígitos e CNPJ 14.';
  }
  if (d.documento) {
    const ehPF = d.documento.length === 11;
    if (ehPF && d.tipo_pessoa === 'PJ') return 'Documento é um CPF, mas o tipo está como pessoa jurídica.';
    if (!ehPF && d.tipo_pessoa === 'PF') return 'Documento é um CNPJ, mas o tipo está como pessoa física.';
  }
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return 'E-mail inválido.';
  if (d.juros < 0 || d.juros > 100) return 'Juros deve ficar entre 0 e 100%.';
  if (d.multa < 0 || d.multa > 100) return 'Multa deve ficar entre 0 e 100%.';
  return null;
}

export async function salvarPessoa(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscritaArea('cadastros'); } catch (e: any) { return { erro: e.message }; }

  const d = ler(form);
  const erro = validar(d);
  if (erro) return { erro };

  // o mesmo documento não pode pertencer a duas pessoas
  if (d.documento) {
    const [existe] = await q<any>(
      'select id, nome_razao_social from pessoa where cpf_cnpj = $1 and ($2::bigint is null or id <> $2)',
      [d.documento, d.id]);
    if (existe) return { erro: `Este CPF/CNPJ já está em ${existe.nome_razao_social}.` };
  }

  const campos = [d.tipo_pessoa, d.nome, d.fantasia, d.documento, d.rg_ie, d.email, d.telefone,
                  d.endereco, d.numero, d.complemento, d.bairro, d.cidade, d.uf, d.cep,
                  d.eh_cliente, d.eh_fornecedor, d.eh_vendedor,
                  d.juros, d.multa, d.tolerancia, d.comissao, d.ativo];
  let id = d.id;
  try {
    if (id) {
      await pool.query(
        `update pessoa set tipo_pessoa=$2, nome_razao_social=$3, nome_fantasia=$4, cpf_cnpj=$5,
                rg_ie=$6, email=$7, telefone=$8, endereco=$9, numero=$10, complemento=$11,
                bairro=$12, cidade=$13, uf=$14, cep=$15, eh_cliente=$16, eh_fornecedor=$17,
                eh_vendedor=$18, juros_percentual=$19, multa_percentual=$20, dias_tolerancia=$21,
                percentual_comissao=$22, ativo=$23, atualizado_em=now()
          where id=$1`, [id, ...campos]);
    } else {
      const { rows } = await pool.query(
        `insert into pessoa (tipo_pessoa, nome_razao_social, nome_fantasia, cpf_cnpj, rg_ie, email,
                             telefone, endereco, numero, complemento, bairro, cidade, uf, cep,
                             eh_cliente, eh_fornecedor, eh_vendedor, juros_percentual,
                             multa_percentual, dias_tolerancia, percentual_comissao, ativo)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         returning id`, campos);
      id = rows[0].id;
    }
  } catch (e: any) {
    return { erro: String(e?.message || '').replace(/^error:\s*/i, '') };
  }

  revalidatePath('/cadastros/pessoas');
  redirect(`/cadastros/pessoas?salvo=${id}`);
}

export async function alternarAtivo(_anterior: Resultado, form: FormData): Promise<Resultado> {
  try { await exigirEscritaArea('cadastros'); } catch (e: any) { return { erro: e.message }; }
  const id = Number(form.get('id'));
  if (!id) return { erro: 'Pessoa não informada.' };

  // não se exclui quem tem movimento: desativa-se, e o histórico continua íntegro
  const [uso] = await q<any>(
    `select (select count(*) from lancamento where pessoa_id = $1)::int as lancamentos
       from pessoa where id = $1`, [id]);
  const [p] = await q<any>('select ativo, nome_razao_social from pessoa where id = $1', [id]);
  if (!p) return { erro: 'Pessoa não encontrada.' };

  await pool.query('update pessoa set ativo = not ativo, atualizado_em = now() where id = $1', [id]);
  revalidatePath('/cadastros/pessoas');
  return {};
}
