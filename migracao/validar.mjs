// FASE 1 — Auditoria do snapshot. Roda offline, só sobre data/raw/.
// Checagens que não dependem do schema exato: contagem, ids duplicados,
// chaves estrangeiras órfãs e conferência do hash contra o manifesto.
// (As checagens contábeis — débito = crédito, saldo por conta — entram
//  depois, quando os nomes reais dos campos estiverem confirmados.)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAW = path.join(process.cwd(), 'data', 'raw');
const MAN = path.join(process.cwd(), 'data', 'manifest');
if (!fs.existsSync(RAW) || !fs.readdirSync(RAW).length) {
  console.error('data/raw/ vazio — rode `node migracao/extrair.mjs` antes.');
  process.exit(1);
}

const tabelas = {};
// arquivos com _ no inicio sao metadados (definicao do app), nao tabelas
for (const f of fs.readdirSync(RAW).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
  const bruto = fs.readFileSync(path.join(RAW, f), 'utf8');
  tabelas[f.replace('.json', '')] = { registros: JSON.parse(bruto), sha256: crypto.createHash('sha256').update(bruto).digest('hex') };
}

const problemas = [];
const idsGlobais = new Map();   // id -> entidade, para resolver FKs

for (const [nome, t] of Object.entries(tabelas)) {
  for (const r of t.registros) if (r.id) idsGlobais.set(r.id, nome);
}

console.log('# Contagem por entidade\n');
for (const [nome, t] of Object.entries(tabelas)) {
  const ids = t.registros.map(r => r.id).filter(Boolean);
  const dup = ids.length - new Set(ids).size;
  const semId = t.registros.length - ids.length;
  console.log(`  ${nome.padEnd(26)} ${String(t.registros.length).padStart(6)} registros` +
    (dup ? `  ⚠ ${dup} ids duplicados` : '') + (semId ? `  ⚠ ${semId} sem id` : ''));
  if (dup) problemas.push(`${nome}: ${dup} ids duplicados (paginação suspeita)`);
}

// Conferência contra o manifesto mais recente da extração.
const mans = fs.existsSync(MAN) ? fs.readdirSync(MAN).filter(f => f.endsWith('.json')).sort() : [];
if (mans.length) {
  const m = JSON.parse(fs.readFileSync(path.join(MAN, mans.at(-1)), 'utf8'));
  console.log(`\n# Conferência com ${mans.at(-1)}\n`);
  for (const [nome, esperado] of Object.entries(m.entidades)) {
    if (esperado.erro) { problemas.push(`${nome}: falhou na extração — ${esperado.erro}`); continue; }
    const t = tabelas[nome];
    if (!t) { problemas.push(`${nome}: no manifesto mas sem arquivo em data/raw/`); continue; }
    const okCount = t.registros.length === esperado.registros;
    const okHash = t.sha256 === esperado.sha256;
    console.log(`  ${nome.padEnd(26)} contagem ${okCount ? 'ok' : 'DIVERGE'} · hash ${okHash ? 'ok' : 'DIVERGE'}`);
    if (!okCount) problemas.push(`${nome}: contagem ${t.registros.length} ≠ manifesto ${esperado.registros}`);
    if (!okHash) problemas.push(`${nome}: arquivo alterado depois da extração (hash diverge)`);
  }
}

// Chaves estrangeiras órfãs: qualquer campo *_id cujo valor não existe em lugar nenhum.
console.log('\n# Referências órfãs\n');
for (const [nome, t] of Object.entries(tabelas)) {
  const orfas = {};
  for (const r of t.registros) {
    for (const [campo, valor] of Object.entries(r)) {
      if (!/_id$/.test(campo) || campo === 'app_id' || !valor || typeof valor !== 'string') continue;
      if (/^[0-9a-f]{24}$/i.test(valor) && !idsGlobais.has(valor)) {
        (orfas[campo] ??= new Set()).add(valor);
      }
    }
  }
  for (const [campo, set] of Object.entries(orfas)) {
    console.log(`  ⚠ ${nome}.${campo}: ${set.size} referência(s) sem destino`);
    problemas.push(`${nome}.${campo}: ${set.size} FK órfã(s)`);
  }
}

console.log(`\n${'='.repeat(60)}`);
if (problemas.length) {
  console.log(`# ${problemas.length} PROBLEMA(S) — resolver antes de migrar:\n`);
  problemas.forEach(p => console.log(`  - ${p}`));
  process.exitCode = 1;
} else {
  console.log('# Snapshot íntegro: sem duplicatas, sem órfãs, hashes conferem.');
}
