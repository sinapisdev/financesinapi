// A camada financeira é a fonte de verdade (bate com extrato bancário).
// Este script produz o baseline que o sistema novo TEM de reproduzir,
// mês a mês, para que a migração seja considerada correta.
import fs from 'node:fs';
const R = (n) => JSON.parse(fs.readFileSync(`data/raw/${n}.json`, 'utf8'));
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cent = (v) => Math.round((Number(v) || 0) * 100);

const mf = R('MovimentosFinanceiros'), emp = R('Empresas'), obras = R('Obras');
const nomeEmp = (c) => (emp.find(e => String(e.codigo_empresa) === String(c)) || {}).razao_social || '?';

const alvo = process.argv[2] || '1';
const desde = process.argv[3] || '2026-01-01';

// valor x valor_total: conferir se divergem antes de escolher
const divergem = mf.filter(m => cent(m.valor) !== cent(m.valor_total)).length;
console.log(`# Movimentos financeiros: ${mf.length} · valor != valor_total em ${divergem}`);
console.log(`# status: ${JSON.stringify(mf.reduce((a, m) => (a[m.status ?? '(null)'] = (a[m.status ?? '(null)'] || 0) + 1, a), {}))}\n`);

// CRITICO: 'pendente' sao parcelas futuras (ha previsoes ate 2029).
// Extrato bancario so contem o que foi EFETIVADO.
const daEmpresa = mf.filter(m => String(m.codigo_empresa) === alvo && m.status === 'efetivado');
const pendentes = mf.filter(m => String(m.codigo_empresa) === alvo && m.status === 'pendente');
console.log(`## EMPRESA ${alvo} — ${nomeEmp(alvo).slice(0, 50)}`);
console.log(`## Movimentos EFETIVADOS desde ${desde} — comparavel ao extrato\n`);

const meses = new Map();
for (const m of daEmpresa) {
  if (!m.data_movimento || m.data_movimento < desde) continue;
  const mes = m.data_movimento.slice(0, 7);
  const g = meses.get(mes) ?? { ent: 0, sai: 0, tr: 0, n: 0 };
  const v = cent(m.valor_total ?? m.valor);
  if (m.tipo_movimento === 'entrada') g.ent += v;
  else if (m.tipo_movimento === 'saida') g.sai += v;
  else g.tr += v;
  g.n++;
  meses.set(mes, g);
}

let acc = 0, totEnt = 0, totSai = 0;
console.log('  mês      movs        entradas            saídas         resultado       acumulado');
for (const [mes, g] of [...meses.entries()].sort()) {
  const res = g.ent - g.sai;
  acc += res; totEnt += g.ent; totSai += g.sai;
  console.log(`  ${mes}  ${String(g.n).padStart(5)}  ${brl(g.ent / 100).padStart(16)}  ${brl(g.sai / 100).padStart(16)}  ${brl(res / 100).padStart(16)}  ${brl(acc / 100).padStart(16)}`);
}
console.log(`\n  TOTAL         ${brl(totEnt / 100).padStart(16)}  ${brl(totSai / 100).padStart(16)}  ${brl((totEnt - totSai) / 100).padStart(16)}`);
console.log(`\n  >> Este é o número para bater com o extrato bancário.`);

// Pendentes: previsao, nao caixa realizado
const pend = pendentes.filter(m => m.data_movimento >= desde);
const pEnt = pend.filter(m => m.tipo_movimento === 'entrada').reduce((s, m) => s + cent(m.valor_total ?? m.valor), 0);
const pSai = pend.filter(m => m.tipo_movimento === 'saida').reduce((s, m) => s + cent(m.valor_total ?? m.valor), 0);
const hoje = new Date().toISOString().slice(0, 10);
const vencidos = pend.filter(m => m.data_movimento < hoje);
console.log(`\n## Pendentes (previsao, fora do extrato)\n`);
console.log(`  ${pend.length} movimentos · a receber ${brl(pEnt / 100)} · a pagar ${brl(pSai / 100)}`);
console.log(`  VENCIDOS (data passada e ainda pendentes): ${vencidos.length} — sao os que voce mencionou corrigir`);
const vEnt = vencidos.filter(m => m.tipo_movimento === 'entrada').reduce((s, m) => s + cent(m.valor_total ?? m.valor), 0);
const vSai = vencidos.filter(m => m.tipo_movimento === 'saida').reduce((s, m) => s + cent(m.valor_total ?? m.valor), 0);
console.log(`    a receber vencido ${brl(vEnt / 100)} · a pagar vencido ${brl(vSai / 100)}`);

// Transferências entre contas não alteram caixa consolidado, mas alteram por obra
const transf = daEmpresa.filter(m => m.tipo_movimento === 'transferencia' && m.data_movimento >= desde);
if (transf.length) console.log(`\n  (${transf.length} transferências no período, ${brl(transf.reduce((s, m) => s + cent(m.valor_total ?? m.valor), 0) / 100)} — não alteram o caixa consolidado)`);

// Quebra por obra, que é como o caixa é segregado hoje
console.log(`\n## Por obra no período\n`);
const porObra = new Map();
for (const m of daEmpresa) {
  if (!m.data_movimento || m.data_movimento < desde) continue;
  const k = m.codigo_obra ?? '(sem obra)';
  const g = porObra.get(k) ?? { ent: 0, sai: 0 };
  const v = cent(m.valor_total ?? m.valor);
  if (m.tipo_movimento === 'entrada') g.ent += v; else if (m.tipo_movimento === 'saida') g.sai += v;
  porObra.set(k, g);
}
for (const [k, g] of [...porObra.entries()].sort()) {
  const o = obras.find(x => String(x.codigo_obra) === String(k));
  console.log(`  ${String(k).padStart(3)} ${String(o?.nome_obra || o?.nome || '(sem obra)').slice(0, 26).padEnd(28)} entrou ${brl(g.ent / 100).padStart(15)}  saiu ${brl(g.sai / 100).padStart(15)}  saldo ${brl((g.ent - g.sai) / 100).padStart(15)}`);
}
