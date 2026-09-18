// CARGA — snapshot Base44 -> Postgres.
// Idempotente: toda linha carrega base44_id e usa upsert, então rodar de novo
// atualiza em vez de duplicar. Só lê de data/raw/.
import fs from 'node:fs';
import pg from 'pg';

const R = (n) => JSON.parse(fs.readFileSync(`data/raw/${n}.json`, 'utf8'));
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v) => (v == null || v === '' ? null : Number(v));
const txt = (v) => (v == null || v === '' ? null : String(v).trim());
// O sistema mostra tudo em maiúsculas; normalizar aqui evita depender de um
// UPDATE posterior que não sobrevive à próxima recarga.
const nome = (v) => { const t = txt(v); return t ? t.toUpperCase() : null; };
const doc  = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length >= 11 ? d.slice(0, 14) : null; };
const data = (v) => (v ? String(v).slice(0, 10) : null);

const cli = new pg.Client({ database: process.env.PGDATABASE || 'silvereng_dev' });
await cli.connect();

const M = { empresa: {}, obra: {}, conta: {}, processo: {}, cliente: {}, fornecedor: {},
            vendedor: {}, banco: {}, forma: {}, item: {}, lancamento: {}, parcela: {} };
const relatorio = [];
const log = (etapa, n, obs = '') => { console.log(`  ${etapa.padEnd(22)} ${String(n).padStart(6)} ${obs}`); relatorio.push({ etapa, n, obs }); };

console.log('# Carga do snapshot Base44 -> Postgres\n');
await cli.query('begin');

// ---------- EMPRESAS ----------
for (const e of R('Empresas')) {
  const tipo = /SPE|EMPREENDIMENTO/i.test(e.razao_social || '') ? 'spe' : 'operacional';
  const { rows } = await cli.query(
    `insert into empresa (codigo, cnpj, razao_social, nome_fantasia, tipo, base44_id)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (base44_id) do update set razao_social = excluded.razao_social
     returning id`,
    [e.codigo_empresa, doc(e.cnpj), nome(e.razao_social), nome(e.nome_fantasia), tipo, e.id]);
  M.empresa[e.codigo_empresa] = rows[0].id;
}
log('empresas', Object.keys(M.empresa).length);

// ---------- PLANO DE CONTAS (pais antes dos filhos) ----------
const contas = R('PlanoContas').sort((a, b) =>
  String(a.codigo_conta).split('.').length - String(b.codigo_conta).split('.').length ||
  String(a.codigo_conta).localeCompare(String(b.codigo_conta)));
for (const c of contas) {
  const cod = String(c.codigo_conta);
  const partes = cod.split('.');
  const paiCod = partes.length > 1 ? partes.slice(0, -1).join('.') : null;
  const { rows } = await cli.query(
    `insert into plano_conta (codigo, descricao, conta_pai_id, grupo, natureza, aceita_lancamento, observacao, base44_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (base44_id) do update set descricao = excluded.descricao
     returning id`,
    [cod, nome(c.descricao), paiCod ? M.conta[paiCod] ?? null : null, Number(cod[0]),
     c.natureza === 'credora' ? 'credora' : 'devedora',
     c.aceita_lancamento !== false, txt(c.observacao), c.id]);
  M.conta[cod] = rows[0].id;
}
log('plano de contas', Object.keys(M.conta).length);

// ---------- PROCESSOS ----------
for (const p of R('ConfiguracoesProcessos')) {
  const tipos = ['receita','despesa','venda','compra','transferencia','ajuste'];
  const { rows } = await cli.query(
    `insert into processo (codigo, nome, tipo, conta_debito_id, conta_credito_id, observacao, base44_id)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (base44_id) do update set nome = excluded.nome,
       conta_debito_id = excluded.conta_debito_id, conta_credito_id = excluded.conta_credito_id
     returning id`,
    [String(p.codigo_processo), nome(p.descricao),
     tipos.includes(p.tipo_processo) ? p.tipo_processo : 'ajuste',
     M.conta[String(p.conta_debito ?? '')] ?? null,
     M.conta[String(p.conta_credito ?? '')] ?? null,
     txt(p.observacao), p.id]);
  M.processo[String(p.id_processo)] = rows[0].id;
  M.processo[String(p.codigo_processo)] = rows[0].id;
}
log('processos', R('ConfiguracoesProcessos').length);

// ---------- CENTROS DE CUSTO ----------
// No Base44 chama-se "Obras", mas agrupa também ADMINISTRATIVO, INCORPORADORA
// e projetos de engenharia — é centro de custo.
const statusObra = { 'PLANEJADA':'planejada','EM ANDAMENTO':'em_andamento','CONCLUIDA':'concluida','CONCLUÍDA':'concluida','CANCELADA':'cancelada' };
const tipoCentro = (nome) => {
  const n = String(nome || '').toUpperCase();
  if (/^ADMINISTRATIVO/.test(n))  return 'administrativo';
  if (/INCORPORADORA/.test(n))    return 'incorporadora';
  if (/^PROJETO|^OBRAS$/.test(n)) return 'projeto';
  return 'obra';
};
for (const o of R('Obras')) {
  const { rows } = await cli.query(
    `insert into centro_custo (codigo, empresa_id, nome, tipo, tipo_imovel, cidade, uf, status,
                               qtd_unidades, vgv_estimado, custo_estimado, data_inicio_prevista, data_fim_prevista, base44_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (base44_id) do update set nome = excluded.nome returning id`,
    [o.codigo_obra, M.empresa[o.codigo_empresa] ?? M.empresa[1], nome(o.nome_obra), tipoCentro(o.nome_obra),
     txt(o.tipo_imovel), txt(o.cidade), txt(o.uf), statusObra[String(o.status).toUpperCase()] ?? 'planejada',
     num(o.qtd_total), num(o.valor_venda_total), num(o.custo_estimado_total),
     data(o.data_inicio_prevista), data(o.data_fim_prevista), o.id]);
  M.obra[o.codigo_obra] = rows[0].id;
}
log('centros de custo', Object.keys(M.obra).length);

// ---------- PESSOAS (clientes + fornecedores + vendedores unificados) ----------
const porDoc = new Map();
async function upsertPessoa(dados, papel, origem, base44id) {
  const d = doc(dados.cpf_cnpj ?? dados.cpf);
  const jaExiste = d ? porDoc.get(d) : null;
  if (jaExiste) {                       // mesma pessoa em outro cadastro: só acrescenta o papel
    await cli.query(`update pessoa set ${papel} = true where id = $1`, [jaExiste]);
    return jaExiste;
  }
  const { rows } = await cli.query(
    `insert into pessoa (codigo, tipo_pessoa, nome_razao_social, nome_fantasia, cpf_cnpj, rg_ie,
                         email, telefone, endereco, numero, complemento, bairro, cidade, uf, cep,
                         ${papel}, juros_percentual, multa_percentual, dias_tolerancia,
                         percentual_comissao, base44_id, base44_origem)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16,$17,$18,$19,$20,$21)
     on conflict (base44_id) do update set nome_razao_social = excluded.nome_razao_social
     returning id`,
    [num(dados.codigo_cliente ?? dados.codigo_fornecedor ?? dados.codigo_vendedor),
     d && d.length === 11 ? 'PF' : 'PJ',
     nome(dados.nome_razao_social ?? dados.nome) ?? 'SEM NOME', nome(dados.nome_fantasia), d, txt(dados.rg_ie),
     txt(dados.email), txt(dados.telefone), txt(dados.endereco), txt(dados.numero), txt(dados.complemento),
     txt(dados.bairro), txt(dados.cidade), txt(dados.uf), txt(dados.cep) ? String(dados.cep).replace(/\D/g,'').slice(0,8) : null,
     num(dados.juros_percentual) ?? 0, num(dados.multa_percentual) ?? 0, num(dados.dias_tolerancia) ?? 0,
     num(dados.percentual_comissao), base44id, origem]);
  if (d) porDoc.set(d, rows[0].id);
  return rows[0].id;
}
for (const c of R('Clientes'))     M.cliente[c.codigo_cliente]       = await upsertPessoa(c, 'eh_cliente',    'Clientes',     c.id);
for (const f of R('Fornecedores')) M.fornecedor[f.codigo_fornecedor] = await upsertPessoa(f, 'eh_fornecedor', 'Fornecedores', f.id);
for (const v of R('Vendedores')) {
  const id = await upsertPessoa(v, 'eh_vendedor', 'Vendedores', v.id);
  M.vendedor[v.codigo_vendedor ?? v.codigo_fornecedor] = id;
  if (v.codigo_fornecedor) M.vendedor[v.codigo_fornecedor] = id;
}
const { rows: [{ count: qtdPessoas }] } = await cli.query('select count(*) from pessoa');
log('pessoas', qtdPessoas, `(${R('Clientes').length} clientes + ${R('Fornecedores').length} fornecedores + ${R('Vendedores').length} vendedores, deduplicados por CPF/CNPJ)`);

// ---------- CONTAS BANCÁRIAS ----------
// O Base44 não liga banco a empresa; deduzimos pela identificação da conta.
const empresaDoBanco = (ident) => /izmenia/i.test(ident) ? 3 : /kika/i.test(ident) ? 2 : 1;
const centroDoBanco = (ident) => Object.entries(M.obra).find(([cod]) => {
  const o = R('Obras').find(x => String(x.codigo_obra) === cod);
  return o && new RegExp(ident.replace(/[^a-z0-9 ]/gi, ''), 'i').test(o.nome_obra || '');
})?.[1] ?? null;
for (const b of R('InstituicoesBancarias')) {
  const ident = b.identificacao || b.nome_curto || 'Conta';
  const { rows } = await cli.query(
    `insert into conta_bancaria (empresa_id, apelido, instituicao, codigo_bacen, agencia, numero_conta,
                                 centro_custo_id, conta_contabil_id, base44_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (base44_id) do update set apelido = excluded.apelido returning id`,
    [M.empresa[empresaDoBanco(ident)], nome(ident), nome(b.nome_instituicao ?? b.nome_curto),
     txt(b.codigo_bacen), txt(b.agencia), txt(b.conta), centroDoBanco(ident),
     M.conta['1.1.1.02'] ?? null, b.id]);
  M.banco[ident.toLowerCase()] = rows[0].id;
}
// conta guarda-chuva: o histórico do Base44 não diz de qual banco saiu o dinheiro
for (const [cod, empId] of Object.entries(M.empresa)) {
  const { rows } = await cli.query(
    `insert into conta_bancaria (empresa_id, apelido, instituicao, numero_conta, conta_contabil_id, base44_id)
     values ($1,$2,'(NÃO INFORMADO)',$3,$4,$5)
     on conflict (base44_id) do update set apelido = excluded.apelido returning id`,
    [empId, 'A IDENTIFICAR — HISTÓRICO BASE44', `HIST-${cod}`, M.conta['1.1.1.02'] ?? null, `__hist_emp_${cod}`]);
  M.banco[`__hist_${cod}`] = rows[0].id;
}
log('contas bancárias', Object.keys(M.banco).length, '(6 do Sicoob + 4 guarda-chuva por empresa)');

// ---------- FORMAS DE PAGAMENTO ----------
for (const f of R('FormasPagamento')) {
  const { rows } = await cli.query(
    `insert into forma_pagamento (codigo, nome, base44_id) values ($1,$2,$3)
     on conflict (base44_id) do update set nome = excluded.nome returning id`,
    [f.codigo, nome(f.descricao), f.id]);
  M.forma[f.codigo] = rows[0].id;
}
log('formas de pagamento', Object.keys(M.forma).length);

// ---------- IMÓVEIS (viram itens de estoque) ----------
// A tabela `imovel` virou `item` em 05_estoque.sql: imóvel é um caso
// particular de item, e a mesma tela atende mercadoria e mostruário.
const grupoDe = async (codigo) =>
  (await cli.query('select id from item_grupo where codigo = $1', [codigo])).rows[0]?.id ?? null;
const gTerreno = await grupoDe('TERRENO');
const gObra    = await grupoDe('IMOV-OBRA');

for (const i of R('Imoveis')) {
  const identificacao = nome(i.nome ?? i.numero) ?? `IMOVEL-${i.id.slice(-6)}`;
  const centroId = M.obra[i.codigo_obra] ?? null;
  const empresaId = centroId
    ? (await cli.query('select empresa_id from centro_custo where id = $1', [centroId])).rows[0].empresa_id
    : M.empresa[1];
  // Fora de construtora/incorporadora, "imóvel" do Base44 não é estoque: na loja
  // de móveis é o projeto do cliente, que já virou centro de custo. Entra
  // inativo e sinalizado, para ninguém contar como item à venda.
  const { rows: [{ ramo }] } =
    await cli.query('select ramo from empresa where id = $1', [empresaId]);
  const ehEstoque = ['construcao', 'incorporacao', 'imobiliaria'].includes(ramo);
  const { rows } = await cli.query(
    `insert into item (empresa_id, grupo_id, centro_custo_id, identificacao, andar,
                       area_privativa, status, ativo, observacao, base44_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (base44_id) do update set identificacao = excluded.identificacao returning id`,
    [empresaId, /TERRENO/i.test(identificacao) ? gTerreno : gObra, centroId, identificacao,
     num(i.andar), num(i.area_m2),
     String(i.status).toLowerCase() === 'disponivel' ? 'disponivel' : 'vendido',
     ehEstoque,
     ehEstoque ? null : 'VEIO DA ENTIDADE IMOVEIS DO BASE44 MAS NAO E ESTOQUE: '
                      + 'E O PROJETO DO CLIENTE, QUE JA EXISTE COMO CENTRO DE CUSTO',
     i.id]);
  M.item[i.id] = rows[0].id;
}
log('imóveis (itens)', Object.keys(M.item).length);

await cli.query('commit');
console.log('\n# Cadastros carregados. Próxima etapa: lançamentos, parcelas e baixas.');
await cli.end();
