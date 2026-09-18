// Prova de completude: varre cada entidade nos dois sentidos (sort=id e sort=-id).
// Se a paginação estiver perdendo registros, os dois conjuntos divergem.
// Conjuntos idênticos = varredura completa, não é presunção.
import fs from 'node:fs';
import path from 'node:path';
import { carregarEnv, listarTudo } from './lib/base44.mjs';

const env = carregarEnv(process.cwd());
const RAW = path.join(process.cwd(), 'data', 'raw');
const entidades = fs.readdirSync(RAW).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.replace('.json', ''));

console.log('# Varredura dupla (ascendente x descendente)\n');
let divergentes = 0;

for (const ent of entidades) {
  const noDisco = JSON.parse(fs.readFileSync(path.join(RAW, `${ent}.json`), 'utf8'));
  if (noDisco.length === 0) { console.log(`  ${ent.padEnd(24)} vazia`); continue; }

  const asc = new Set(noDisco.map(r => r.id));
  const desc = new Set((await listarTudo(env, ent, { sort: '-id' })).map(r => r.id));

  const soAsc = [...asc].filter(id => !desc.has(id));
  const soDesc = [...desc].filter(id => !asc.has(id));
  const ok = soAsc.length === 0 && soDesc.length === 0;

  console.log(`  ${ent.padEnd(24)} ${String(asc.size).padStart(6)} x ${String(desc.size).padStart(6)} ` +
    (ok ? 'IDENTICOS' : `DIVERGE (+${soDesc.length} / -${soAsc.length})`));

  if (!ok) {
    divergentes++;
    fs.writeFileSync(path.join(RAW, `_divergencia_${ent}.json`), JSON.stringify({ soAsc, soDesc }, null, 2));
  }
}

console.log(`\n${'='.repeat(56)}`);
if (divergentes) { console.log(`# ${divergentes} entidade(s) DIVERGEM — snapshot nao confiavel.`); process.exitCode = 1; }
else console.log('# Todas as entidades bateram nos dois sentidos: varredura completa.');
