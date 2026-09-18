// FASE 1 (contábil) — o teste que importa: as partidas fecham?
// Em partida dobrada, dentro de cada transação a soma dos débitos tem de ser
// igual à soma dos créditos. Qualquer centavo de diferença é erro de dado.
import fs from 'node:fs';
const R = (n) => JSON.parse(fs.readFileSync(`data/raw/${n}.json`, 'utf8'));
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cent = (v) => Math.round((Number(v) || 0) * 100);   // inteiro: sem erro de float

const mc = R('MovimentosContabeis');
const lf = R('LancamentosFinanceiros');

function analisar(rotulo, movs, chave) {
  const grupos = new Map();
  for (const m of movs) {
    const k = m[chave] ?? '(sem chave)';
    const g = grupos.get(k) ?? { d: 0, c: 0, n: 0 };
    if (m.tipo_partida === 'D') g.d += cent(m.valor);
    else if (m.tipo_partida === 'C') g.c += cent(m.valor);
    g.n++;
    grupos.set(k, g);
  }
  const desbalanceados = [...grupos.entries()].filter(([, g]) => g.d !== g.c);
  const somaD = [...grupos.values()].reduce((s, g) => s + g.d, 0);
  const somaC = [...grupos.values()].reduce((s, g) => s + g.c, 0);

  console.log(`\n## ${rotulo} — agrupado por ${chave}`);
  console.log(`   ${grupos.size} transações · débitos ${brl(somaD / 100)} · créditos ${brl(somaC / 100)}`);
  console.log(`   diferença global: ${brl((somaD - somaC) / 100)}`);
  console.log(`   transações desbalanceadas: ${desbalanceados.length}`);
  for (const [k, g] of desbalanceados.slice(0, 15)) {
    console.log(`     ${String(k).padEnd(26)} D ${brl(g.d / 100).padStart(16)}  C ${brl(g.c / 100).padStart(16)}  dif ${brl((g.d - g.c) / 100)}`);
  }
  if (desbalanceados.length > 15) console.log(`     ... e mais ${desbalanceados.length - 15}`);
  return desbalanceados;
}

console.log('# Conferência de partidas dobradas\n');
console.log(`Total de movimentos contábeis: ${mc.length}`);

const ativos = mc.filter(m => m.status === 'ativo');
const cancelados = mc.filter(m => m.status === 'cancelado');
console.log(`  ativos: ${ativos.length} · cancelados: ${cancelados.length}`);

analisar('TODOS os movimentos', mc, 'codigo_transacao');
const desbAtivos = analisar('Somente ATIVOS', ativos, 'codigo_transacao');
analisar('Somente CANCELADOS', cancelados, 'codigo_transacao');

// Movimentos apontando para lançamento que não existe mais
const idsLanc = new Set(lf.map(l => l.id_lancamento).filter(Boolean));
const orfaos = mc.filter(m => m.id_lancamento && !idsLanc.has(m.id_lancamento));
console.log(`\n## Movimentos órfãos (lançamento inexistente): ${orfaos.length}`);
const porStatus = orfaos.reduce((a, m) => (a[m.status] = (a[m.status] || 0) + 1, a), {});
console.log(`   por status: ${JSON.stringify(porStatus)}`);
console.log(`   valor envolvido: ${brl(orfaos.reduce((s, m) => s + cent(m.valor), 0) / 100)}`);
for (const m of orfaos.slice(0, 8)) {
  console.log(`     ${m.id_lancamento} · ${m.data_movimento} · ${m.tipo_partida} ${brl(m.valor)} · ${String(m.historico).slice(0, 40)}`);
}

console.log(`\n${'='.repeat(60)}`);
if (desbAtivos.length) { console.log(`# ${desbAtivos.length} transação(ões) ATIVAS desbalanceadas — investigar antes de migrar.`); process.exitCode = 1; }
else console.log('# Todas as transações ativas fecham: débito = crédito.');
