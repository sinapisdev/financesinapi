// CARGA parte 2 — lançamentos, parcelas, baixas e transferências.
// Cada lançamento entra com suas parcelas numa savepoint própria: se um não
// fechar, ele é isolado e relatado, sem derrubar a carga inteira.
import fs from 'node:fs';
import pg from 'pg';

const R = (n) => JSON.parse(fs.readFileSync(`data/raw/${n}.json`, 'utf8'));
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cent = (v) => Math.round((Number(v) || 0) * 100);
const num = (v) => (v == null || v === '' ? null : Number(v));
const txt = (v) => (v == null || v === '' ? null : String(v).trim());
const data = (v) => (v ? String(v).slice(0, 10) : null);

const cli = new pg.Client({ database: process.env.PGDATABASE || 'silvereng_dev' });
await cli.connect();

// nome da contraparte e do processo, para descrever lançamento sem observação
const nomePorId = new Map();
const processoPorIdB44 = new Map();

// remonta os mapas a partir do que já está no banco
const mapaDe = async (tabela, chave = 'base44_id') => {
  const { rows } = await cli.query(`select id, ${chave} as k from ${tabela} where ${chave} is not null`);
  return Object.fromEntries(rows.map(r => [String(r.k), r.id]));
};
const porCodigo = async (tabela, col) => {
  const { rows } = await cli.query(`select id, ${col} as k from ${tabela} where ${col} is not null`);
  return Object.fromEntries(rows.map(r => [String(r.k), r.id]));
};
const M = {
  empresa:  await porCodigo('empresa', 'codigo'),
  obra:     await porCodigo('centro_custo', 'codigo'),
  processoB44: await mapaDe('processo'),
  item:     await mapaDe('item'),
  pessoaB44: await mapaDe('pessoa'),
  banco:    await porCodigo('conta_bancaria', 'numero_conta'),
};
// processo: do id_processo do Base44 para o id novo
const procPorIdB44 = {};
for (const p of R('ConfiguracoesProcessos')) {
  procPorIdB44[String(p.id_processo)] = M.processoB44[p.id];
  processoPorIdB44.set(String(p.id_processo), p.descricao);
}
// pessoa: do código de cliente/fornecedor para o id novo.
// ATENÇÃO: não dá para resolver só pelo base44_id. Cliente e fornecedor com o
// mesmo CPF/CNPJ viram UMA pessoa, e o segundo cadastro não guarda base44_id
// próprio — 16 cadastros (SICOOB, as SPEs, os sócios) caíam fora e deixavam
// 403 lançamentos sem contraparte. Resolve-se pelo documento, com o
// base44_id e o nome como reserva.
const doc = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length >= 11 ? d.slice(0, 14) : null; };
const pessoaPorDoc = new Map(), pessoaPorNome = new Map();
{
  const { rows } = await cli.query('select id, cpf_cnpj, nome_razao_social from pessoa');
  for (const r of rows) {
    if (r.cpf_cnpj) pessoaPorDoc.set(r.cpf_cnpj, r.id);
    pessoaPorNome.set(String(r.nome_razao_social).trim().toUpperCase(), r.id);
  }
}
const resolverPessoa = (cad) => {
  if (!cad) return null;
  const d = doc(cad.cpf_cnpj ?? cad.cpf);
  if (d && pessoaPorDoc.has(d)) return pessoaPorDoc.get(d);
  if (M.pessoaB44[cad.id]) return M.pessoaB44[cad.id];
  const nome = String(cad.nome_razao_social ?? cad.nome ?? '').trim().toUpperCase();
  return pessoaPorNome.get(nome) ?? null;
};

const pessoaPorCliente = {}, pessoaPorFornecedor = {};
for (const c of R('Clientes'))     pessoaPorCliente[c.codigo_cliente]       = resolverPessoa(c);
for (const f of R('Fornecedores')) pessoaPorFornecedor[f.codigo_fornecedor] = resolverPessoa(f);

const semVinculo = [...Object.values(pessoaPorCliente), ...Object.values(pessoaPorFornecedor)]
  .filter(v => !v).length;
if (semVinculo) console.log(`  ! ${semVinculo} cadastro(s) sem pessoa correspondente`);

{
  const { rows } = await cli.query('select id, nome_razao_social from pessoa');
  for (const r of rows) nomePorId.set(r.id, r.nome_razao_social);
}

const lf = R('LancamentosFinanceiros'), cr = R('ContasReceber'), cp = R('ContasPagar');

// ---------------------------------------------------------------------
// Conta contábil do lançamento
// O Base44 não guarda a conta escolhida no lançamento — ela só aparece nos
// movimentos contábeis que ele gerou. Recupera-se de lá, senão seria preciso
// reabrir 1.389 lançamentos à mão.
// ---------------------------------------------------------------------
const contaIdPorCodigo = new Map();
const contaEhAnalitica = new Map();
{
  const { rows } = await cli.query('select id, codigo, aceita_lancamento from plano_conta');
  for (const r of rows) {
    contaIdPorCodigo.set(String(r.codigo), r.id);
    contaEhAnalitica.set(String(r.codigo), r.aceita_lancamento);
  }
}
// contas usadas na EMISSÃO de cada lançamento (baixa, estorno e transitória fora)
const contasDaEmissao = new Map();
for (const m of R('MovimentosContabeis')) {
  if (m.status !== 'ativo') continue;
  if (/^(ESTORNO|Baixa|BAIXA|Transitória)/i.test(String(m.historico || ''))) continue;
  const k = String(m.id_lancamento);
  const set = contasDaEmissao.get(k) ?? new Set();
  if (m.conta_debito) set.add(String(m.conta_debito));
  if (m.conta_credito) set.add(String(m.conta_credito));
  contasDaEmissao.set(k, set);
}
const cfgPorIdProcesso = new Map(R('ConfiguracoesProcessos').map(p => [String(p.id_processo), p]));

/** Devolve { contaId, revisar } para o lançamento. */
function contaContabilDe(l) {
  const proc = cfgPorIdProcesso.get(String(l.id_processo));
  if (!proc) return { contaId: null, revisar: false };

  const d = String(proc.conta_debito || ''), c = String(proc.conta_credito || '');
  const sinteticaD = d && contaEhAnalitica.get(d) === false;
  const sinteticaC = c && contaEhAnalitica.get(c) === false;

  // processo já aponta conta analítica: é ela mesma, nada a escolher
  if (!sinteticaD && !sinteticaC) {
    const fixa = (d && contaEhAnalitica.get(d)) ? d : (c && contaEhAnalitica.get(c)) ? c : null;
    return { contaId: fixa ? contaIdPorCodigo.get(fixa) ?? null : null, revisar: false };
  }

  const raiz = sinteticaD ? d : c;
  const usadas = [...(contasDaEmissao.get(String(l.id_lancamento)) ?? [])];
  const doGrupo = usadas.filter(x => x.startsWith(raiz + '.') && contaEhAnalitica.get(x));
  if (doGrupo.length === 1) return { contaId: contaIdPorCodigo.get(doGrupo[0]), revisar: false };
  if (doGrupo.length > 1)  return { contaId: contaIdPorCodigo.get(doGrupo[0]), revisar: true };

  // o Base44 usou conta fora do grupo do processo: preserva o que ele fez,
  // mas marca para revisão em vez de esconder a inconsistência
  const resultado = usadas.find(x => /^[456]\./.test(x) && contaEhAnalitica.get(x));
  if (resultado) return { contaId: contaIdPorCodigo.get(resultado), revisar: true };
  return { contaId: null, revisar: true };
}
const parcelasPorLanc = new Map();
for (const p of [...cr.map(x => ({ ...x, __tipo: 'receber' })), ...cp.map(x => ({ ...x, __tipo: 'pagar' }))]) {
  const a = parcelasPorLanc.get(p.id_lancamento) ?? []; a.push(p); parcelasPorLanc.set(p.id_lancamento, a);
}

async function inserirBaixa(parcelaId, p, l) {
  const desconto = cent(p.desconto_aplicado) + cent(p.abatimento_aplicado);
  await cli.query(
    `insert into baixa (parcela_id, conta_bancaria_id, data_liquidacao, valor_principal,
                        juros, multa, desconto, observacao, base44_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (base44_id) do nothing`,
    [parcelaId, M.banco[`HIST-${l.codigo_empresa}`], data(p.data_pagamento),
     Number(p.valor_original), num(p.juros_aplicado) ?? 0, num(p.multa_aplicada) ?? 0,
     desconto / 100, txt(p.observacao), `baixa_${p.id}`]);
  stat.baixas++;
}

// Sem observação no Base44, a descrição vira o nome da contraparte.
// "receita 1789501922995" não diz nada a ninguém.
function descricaoDe(l, pessoaId) {
  const propria = txt(l.observacao);
  if (propria) return propria.toUpperCase();
  const nome = pessoaId ? nomePorId.get(pessoaId) : null;
  if (nome) return String(nome).toUpperCase();
  const proc = processoPorIdB44.get(String(l.id_processo));
  if (proc) return String(proc).toUpperCase();
  return `${l.tipo_lancamento === 'receita' ? 'RECEITA' : 'DESPESA'} SEM DESCRIÇÃO`;
}

const stat = { parcelasImplicitas: 0, baixasSemParcela: 0, baixasInvalidas: 0, desdobramentos: 0, lancamentos: 0, parcelas: 0, baixas: 0, transferencias: 0, revisao: 0, falhas: [] };
const statusParcela = { aberto: 'aberta', recebido: 'liquidada', pago: 'liquidada', cancelado: 'cancelada', parcial: 'parcial' };
// Se o lançamento foi cancelado, suas parcelas não são mais exigíveis.
const statusDaParcela = (p, l) =>
  l.status === 'cancelado' ? 'cancelada' : (statusParcela[p.status] ?? 'aberta');

console.log('# Carga de movimentos\n');
await cli.query('begin');
await cli.query('set constraints all deferred');

for (const l of lf) {
  // transferências não são receita nem despesa: vão para a tabela própria
  if (l.tipo_lancamento === 'transferencia') continue;

  const ps = parcelasPorLanc.get(l.id_lancamento) ?? [];
  const SUF = /-\d+\s+[A-Z]$/;
  const temDesdobro = ps.some(p => SUF.test(String(p.numero_documento || '')));
  // a soma que a trava vai conferir: principais + desdobradas que seguem abertas
  const statusPrincipal = new Map();
  for (const p of ps) if (!SUF.test(String(p.numero_documento || '')))
    statusPrincipal.set(String(p.parcela_numero), p.status);
  // renegociação = original ficou ABERTA e o sufixo foi pago no lugar dela
  const ehRenegociacao = (p) => SUF.test(String(p.numero_documento || ''))
    && statusPrincipal.get(String(p.parcela_numero)) === 'aberto'
    && p.data_pagamento && ['recebido','pago'].includes(p.status);
  const contamNaSoma = ps.filter(p => !ehRenegociacao(p));
  const somaParcelas = contamNaSoma.reduce((s, p) => s + cent(p.valor_original), 0);
  const valorLanc = cent(l.valor_total);
  const diferenca = somaParcelas - valorLanc;

  const jurosEmbutidos = ps.length && diferenca > 0 ? diferenca : 0;
  const temRenegociacao = ps.some(ehRenegociacao);
  const precisaRevisao = temRenegociacao || (ps.length > 0 && diferenca < 0);
  const motivo = temRenegociacao
    ? 'Parcela renegociada no Base44 virou parcela nova; aqui foi convertida em baixa parcial'
    : (diferenca < 0 ? `Parcelas somam ${brl(somaParcelas/100)}, menos que o lançamento (${brl(valorLanc/100)})` : null);

  const { contaId: contaContabilId, revisar: contaSuspeita } = contaContabilDe(l);

  await cli.query('savepoint sp');
  try {
    const empresaId = M.empresa[l.codigo_empresa];
    if (!empresaId) throw new Error(`empresa ${l.codigo_empresa} não encontrada`);
    const pessoaId = l.tipo_lancamento === 'receita'
      ? pessoaPorCliente[l.codigo_cliente] : pessoaPorFornecedor[l.codigo_fornecedor];

    const { rows } = await cli.query(
      `insert into lancamento (numero, empresa_id, centro_custo_id, processo_id, conta_id, tipo, pessoa_id, item_id,
                               data_competencia, valor_total, descricao, descricao_automatica, observacao, a_vista,
                               juros_embutidos, requer_revisao, motivo_revisao, status, base44_id, base44_numero, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       on conflict (base44_id) do update set valor_total = excluded.valor_total returning id`,
      [`LAN${l.id_lancamento}`, empresaId, M.obra[l.codigo_obra] ?? null,
       procPorIdB44[String(l.id_processo)] ?? null, contaContabilId,
       l.tipo_lancamento === 'receita' ? 'receita' : 'despesa',
       pessoaId ?? null, M.item[l.imovel_id] ?? null,
       data(l.data_lancamento ?? l.data_movimento), Number(l.valor_total),
       descricaoDe(l, pessoaId), !txt(l.observacao), txt(l.observacao)?.toUpperCase() ?? null,
       !!l.avista, jurosEmbutidos / 100, precisaRevisao || contaSuspeita,
       motivo ?? (contaSuspeita ? 'Conta contábil do Base44 não bate com o grupo do processo' : null),
       l.status === 'cancelado' ? 'cancelado' : 'ativo',
       l.id, String(l.id_lancamento), txt(l.created_by)]);
    const lancId = rows[0].id;
    stat.lancamentos++;
    if (precisaRevisao) stat.revisao++;

    // Lançamento sem parcela nenhuma (nasceu incompleto no Base44, ou é à
    // vista puro): cria-se uma parcela única com o valor do lançamento, para
    // que a baixa tenha onde se apoiar e o caixa feche.
    if (ps.length === 0) {
      await cli.query(
        `insert into parcela (lancamento_id, numero, tipo, pessoa_id, data_vencimento,
                              valor_original, documento, categoria, status, base44_id)
         values ($1,1,$2,$3,$4,$5,$6,'gerada_na_migracao',$8,$7)
         on conflict (base44_id) do nothing`,
        [lancId, l.tipo_lancamento === 'receita' ? 'receber' : 'pagar', pessoaId ?? null,
         data(l.data_lancamento ?? l.data_movimento), Number(l.valor_total),
         `LAN${l.id_lancamento}-001`, `parcela_implicita_${l.id}`,
         l.status === 'cancelado' ? 'cancelada' : 'aberta']);
      stat.parcelas++;
      stat.parcelasImplicitas++;
    }

    // ---- desdobramento: "-013 A" é pagamento parcial da parcela 13, não parcela nova
    const SUFIXO = /-\d+\s+[A-Z]$/;
    const principais = ps.filter(p => !SUFIXO.test(String(p.numero_documento || '')));
    const desdobradas = ps.filter(p =>  SUFIXO.test(String(p.numero_documento || '')));
    const parcelaIdPorNumero = new Map();
    let seq = 0;

    for (const p of principais) {
      seq++;
      const pessoaParcela = p.__tipo === 'receber'
        ? pessoaPorCliente[p.codigo_cliente] : pessoaPorFornecedor[p.codigo_fornecedor];
      const { rows: pr } = await cli.query(
        `insert into parcela (lancamento_id, numero, tipo, pessoa_id, data_vencimento, valor_original,
                              documento, categoria, status, autorizada_em, autorizada_por, base44_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (base44_id) do update set valor_original = excluded.valor_original returning id`,
        [lancId, seq, p.__tipo, pessoaParcela ?? pessoaId ?? null,
         data(p.data_vencimento), Number(p.valor_original), txt(p.numero_documento), txt(p.tipo_parcela),
         statusDaParcela(p, l),
         p.data_autorizacao ? new Date(p.data_autorizacao) : null, txt(p.autorizado_por), p.id]);
      stat.parcelas++;
      parcelaIdPorNumero.set(String(p.parcela_numero),
        { id: pr[0].id, valor: cent(p.valor_original), statusOrigem: p.status });

    }

    // desdobradas já pagas viram BAIXA PARCIAL da parcela de mesmo número
    for (const p of desdobradas) {
      const alvo = parcelaIdPorNumero.get(String(p.parcela_numero));
      const foiPaga = p.data_pagamento && ['recebido','pago'].includes(p.status);
      // só vira baixa parcial se a original ficou aberta (renegociação de verdade)
      const renegociou = alvo && foiPaga && alvo.statusOrigem === 'aberto';

      if (renegociou) {
        stat.desdobramentos++;   // a baixa vem do movimento financeiro, adiante
      } else {
        // ainda em aberto: é parcela adicional de verdade
        seq++;
        const pessoaParcela = p.__tipo === 'receber'
          ? pessoaPorCliente[p.codigo_cliente] : pessoaPorFornecedor[p.codigo_fornecedor];
        const { rows: pr } = await cli.query(
          `insert into parcela (lancamento_id, numero, tipo, pessoa_id, data_vencimento, valor_original,
                                documento, categoria, status, base44_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict (base44_id) do update set valor_original = excluded.valor_original returning id`,
          [lancId, seq, p.__tipo, pessoaParcela ?? pessoaId ?? null, data(p.data_vencimento),
           Number(p.valor_original), txt(p.numero_documento), txt(p.tipo_parcela),
           statusDaParcela(p, l), p.id]);
        stat.parcelas++;
      }
    }

    // força a checagem das travas agora, para isolar o lançamento problemático
    await cli.query('set constraints all immediate');
    await cli.query('set constraints all deferred');
    await cli.query('release savepoint sp');
  } catch (e) {
    await cli.query('rollback to savepoint sp');
    stat.falhas.push({ lanc: l.id_lancamento, valor: l.valor_total, erro: e.message.slice(0, 110) });
  }
}

// ---------- BAIXAS ----------
// A baixa É o movimento no banco. O valor da parcela é o que se esperava
// receber; o movimento é o que de fato entrou — e é ele que bate com o extrato.
{
  const parcelaPorTx = new Map();   // codigo_transacao -> parcela no Postgres
  const { rows } = await cli.query(
    `select p.id, p.base44_id from parcela p`);
  const idPorB44 = Object.fromEntries(rows.map(r => [r.base44_id, r.id]));
  for (const p of [...cr, ...cp]) {
    if (p.codigo_transacao && idPorB44[p.id]) parcelaPorTx.set(String(p.codigo_transacao), idPorB44[p.id]);
  }
  // fallback: primeira parcela do lançamento
  const primeiraDoLanc = new Map();
  for (const p of [...cr, ...cp]) {
    const k = String(p.id_lancamento);
    if (!primeiraDoLanc.has(k) && idPorB44[p.id]) primeiraDoLanc.set(k, idPorB44[p.id]);
  }
  // parcelas implícitas, criadas acima para lançamentos que não tinham nenhuma
  const { rows: impl } = await cli.query(
    `select p.id, l.base44_numero from parcela p join lancamento l on l.id = p.lancamento_id
      where p.categoria = 'gerada_na_migracao'`);
  for (const r of impl) if (!primeiraDoLanc.has(String(r.base44_numero)))
    primeiraDoLanc.set(String(r.base44_numero), r.id);

  const mf = R('MovimentosFinanceiros');
  for (const m of mf) {
    if (m.status !== 'efetivado' || m.tipo_movimento === 'transferencia') continue;
    const parcelaId = parcelaPorTx.get(String(m.codigo_transacao))
                   ?? primeiraDoLanc.get(String(m.id_lancamento));
    if (!parcelaId) { stat.baixasSemParcela++; continue; }

    const liquido = cent(m.valor_total ?? m.valor);
    if (liquido <= 0) continue;
    const juros = cent(m.juros_aplicado), multa = cent(m.multa_aplicada), desc = cent(m.desconto_aplicado);
    const principal = liquido - juros - multa + desc;
    if (principal <= 0) { stat.baixasInvalidas++; continue; }

    await cli.query('savepoint sb');
    try {
      await cli.query(
        `insert into baixa (parcela_id, conta_bancaria_id, data_liquidacao, valor_principal,
                            juros, multa, desconto, observacao, base44_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (base44_id) do nothing`,
        [parcelaId, M.banco[`HIST-${m.codigo_empresa}`] ?? M.banco['HIST-1'],
         data(m.data_movimento), principal / 100, juros / 100, multa / 100, desc / 100,
         txt(m.observacao) ?? txt(m.descricao), `mf_${m.id}`]);
      stat.baixas++;
      await cli.query('release savepoint sb');
    } catch (e) {
      await cli.query('rollback to savepoint sb');
      stat.falhas.push({ lanc: m.id_lancamento, valor: m.valor_total, erro: e.message.slice(0, 100) });
    }
  }
}

// ---------- TRANSFERÊNCIAS ----------
for (const l of lf.filter(x => x.tipo_lancamento === 'transferencia' && x.status !== 'cancelado')) {
  const empId = M.empresa[l.codigo_empresa];
  const conta = M.banco[`HIST-${l.codigo_empresa}`];
  try {
    // origem = destino = conta guarda-chuva: não sabemos as contas reais,
    // e chutar um destino inventaria saldo onde não há.
    await cli.query(
      `insert into transferencia (empresa_id, conta_origem_id, conta_destino_id, data_movimento,
                                  valor, descricao, contas_identificadas, base44_id)
       values ($1, $2, $2, $3, $4, $5, false, $6)
       on conflict (base44_id) do nothing`,
      [empId, conta, data(l.data_lancamento ?? l.data_movimento), Number(l.valor_total),
       txt(l.observacao)?.toUpperCase() ?? 'TRANSFERÊNCIA ENTRE CONTAS', l.id]);
    stat.transferencias++;
  } catch (e) { stat.falhas.push({ lanc: l.id_lancamento, valor: l.valor_total, erro: e.message.slice(0, 90) }); }
}

await cli.query('commit');

console.log(`  lançamentos          ${String(stat.lancamentos).padStart(6)}`);
console.log(`  parcelas             ${String(stat.parcelas).padStart(6)}`);
console.log(`  baixas               ${String(stat.baixas).padStart(6)}`);
console.log(`  transferências       ${String(stat.transferencias).padStart(6)}`);
console.log(`  desdobramentos -> baixa parcial  ${String(stat.desdobramentos).padStart(4)}`);
console.log(`  marcados p/ revisão  ${String(stat.revisao).padStart(6)}`);
console.log(`  parcelas implícitas  ${String(stat.parcelasImplicitas).padStart(6)}`);
console.log(`  baixas sem parcela   ${String(stat.baixasSemParcela).padStart(6)}`);
console.log(`  falhas               ${String(stat.falhas.length).padStart(6)}`);
for (const f of stat.falhas.slice(0, 12)) console.log(`     LAN${f.lanc} ${brl(f.valor).padStart(14)} — ${f.erro}`);
if (stat.falhas.length > 12) console.log(`     ... e mais ${stat.falhas.length - 12}`);
fs.writeFileSync('data/derived/falhas-carga.json', JSON.stringify(stat.falhas, null, 2));
await cli.end();
