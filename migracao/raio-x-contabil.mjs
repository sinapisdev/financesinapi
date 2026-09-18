// Varredura sistemática de incoerências contábeis.
// Em vez de achar erro por exemplo, testa regras que TÊM de valer sempre.
import fs from 'node:fs';
const R = (n) => JSON.parse(fs.readFileSync(`data/raw/${n}.json`, 'utf8'));
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cent = (v) => Math.round((Number(v) || 0) * 100);

const mc = R('MovimentosContabeis'), pc = R('PlanoContas'), cfg = R('ConfiguracoesProcessos'), lf = R('LancamentosFinanceiros');
const conta = (c) => pc.find(x => String(x.codigo_conta) === String(c));
const ativos = mc.filter(m => m.status === 'ativo');
const achados = [];

// ---------- 1. Saldo com natureza invertida ----------
// Ativo e despesa fecham devedor; passivo, PL e receita fecham credor.
const razao = new Map();
for (const m of ativos) {
  const c = m.conta_debito || m.conta_credito;
  const r = razao.get(c) ?? { d: 0, c: 0, n: 0 };
  if (m.tipo_partida === 'D') r.d += cent(m.valor); else r.c += cent(m.valor);
  r.n++;
  razao.set(c, r);
}
console.log('## 1. Contas com saldo de natureza invertida\n');
const invertidas = [];
for (const [cod, r] of [...razao.entries()].sort()) {
  const info = conta(cod);
  if (!info) { achados.push(`conta ${cod} usada mas ausente do plano`); continue; }
  const saldo = r.d - r.c;                        // positivo = devedor
  const esperaDevedora = /^[156]/.test(String(cod));
  const invertida = esperaDevedora ? saldo < 0 : saldo > 0;
  if (invertida && Math.abs(saldo) > 100) invertidas.push({ cod, nome: info.descricao, saldo, n: r.n, esperaDevedora });
}
for (const i of invertidas.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))) {
  console.log(`  ${i.cod.padEnd(11)} ${String(i.nome).slice(0, 36).padEnd(38)} ${brl(i.saldo / 100).padStart(18)}  (esperado ${i.esperaDevedora ? 'devedor' : 'credor'}, ${i.n} movs)`);
  achados.push(`${i.cod} ${i.nome}: saldo ${brl(i.saldo / 100)} invertido`);
}
if (!invertidas.length) console.log('  nenhuma');

// ---------- 2. Movimentos em conta sintética ----------
console.log('\n## 2. Movimentos lançados em conta sintética\n');
const sinteticas = new Map();
for (const [cod, r] of razao) {
  const info = conta(cod);
  if (info && info.aceita_lancamento === false) sinteticas.set(cod, { ...r, nome: info.descricao });
}
for (const [cod, r] of sinteticas) {
  console.log(`  ${cod.padEnd(11)} ${String(r.nome).slice(0, 36).padEnd(38)} ${r.n} movimentos`);
  achados.push(`${cod}: ${r.n} movimentos em conta sintética`);
}
if (!sinteticas.size) console.log('  nenhum');

// ---------- 3. Contas do plano nunca usadas ----------
const nunca = pc.filter(c => c.aceita_lancamento !== false && !razao.has(String(c.codigo_conta)));
console.log(`\n## 3. Contas analíticas nunca usadas: ${nunca.length} de ${pc.filter(c => c.aceita_lancamento !== false).length}\n`);
for (const c of nunca.slice(0, 14)) console.log(`  ${String(c.codigo_conta).padEnd(11)} ${String(c.descricao).slice(0, 44)}`);
if (nunca.length > 14) console.log(`  ... e mais ${nunca.length - 14}`);

// ---------- 4. Saldo gravado no plano x razão recalculado ----------
console.log('\n## 4. saldo_atual do plano x razão recalculado\n');
let divergentes = 0;
for (const [cod, r] of [...razao.entries()].sort()) {
  const info = conta(cod);
  if (!info || info.saldo_atual == null) continue;
  const calc = r.d - r.c;
  const gravado = cent(info.saldo_atual);
  if (Math.abs(calc - gravado) > 100 && Math.abs(calc - gravado) > Math.abs(calc) * 0.001) {
    divergentes++;
    if (divergentes <= 12) console.log(`  ${cod.padEnd(11)} ${String(info.descricao).slice(0, 30).padEnd(32)} gravado ${brl(gravado / 100).padStart(16)}  razão ${brl(calc / 100).padStart(16)}`);
  }
}
console.log(divergentes ? `  -> ${divergentes} contas divergem entre saldo gravado e razão` : '  nenhuma divergência');
if (divergentes) achados.push(`${divergentes} contas com saldo gravado != razão`);

// ---------- 5. Lançamento x soma dos seus movimentos ----------
console.log('\n## 5. Valor do lançamento x movimentos gerados\n');
const porLanc = new Map();
for (const m of ativos) {
  if (m.tipo_partida !== 'D') continue;          // um lado basta
  const g = porLanc.get(m.id_lancamento) ?? 0;
  porLanc.set(m.id_lancamento, g + cent(m.valor));
}
let dobrados = 0, outros = 0;
const exemplosDobro = [];
for (const l of lf.filter(l => l.status === 'processado')) {
  const somaD = porLanc.get(l.id_lancamento);
  if (somaD == null) continue;
  const valor = cent(l.valor_total);
  if (valor === 0) continue;
  const razaoV = somaD / valor;
  if (Math.abs(razaoV - 2) < 0.01) { dobrados++; if (exemplosDobro.length < 5) exemplosDobro.push(l); }
  else if (razaoV > 1.01) outros++;
}
console.log(`  lançamentos cujos débitos somam exatamente 2x o valor: ${dobrados}`);
console.log(`  lançamentos com débitos acima do valor (outras proporções): ${outros}`);
for (const l of exemplosDobro) console.log(`    ${l.id_lancamento} · ${l.tipo_lancamento} · ${brl(l.valor_total)} · ${String(l.observacao || '').slice(0, 36)}`);
if (dobrados) achados.push(`${dobrados} lançamentos contabilizam o dobro do próprio valor`);

// ---------- 6. Processo usado fora da sua natureza ----------
console.log('\n## 6. Processos com natureza incoerente\n');
for (const p of cfg) {
  const problemas = [];
  const d = String(p.conta_debito || ''), c = String(p.conta_credito || '');
  if (p.tipo_processo === 'receita' && /^6/.test(d)) problemas.push(`tipo receita mas debita despesa (${d})`);
  if (p.tipo_processo === 'despesa' && /^4/.test(d)) problemas.push(`tipo despesa mas debita receita (${d})`);
  if (p.conta_debito_avista && p.conta_debito_baixa && p.conta_debito_avista === p.conta_debito_baixa)
    problemas.push(`à vista e baixa debitam a mesma conta (${p.conta_debito_avista}) — dupla contagem`);
  const dInfo = conta(d), cInfo = conta(c);
  if (dInfo?.aceita_lancamento === false) problemas.push(`débito em conta sintética (${d})`);
  if (cInfo?.aceita_lancamento === false) problemas.push(`crédito em conta sintética (${c})`);
  if (problemas.length) {
    console.log(`  [${p.codigo_processo}] ${String(p.descricao).slice(0, 40)}`);
    for (const x of problemas) { console.log(`      - ${x}`); achados.push(`processo ${p.codigo_processo}: ${x}`); }
  }
}

console.log(`\n${'='.repeat(64)}`);
console.log(`# ${achados.length} incoerências catalogadas`);
