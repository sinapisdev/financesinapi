// FASE 0 — Snapshot completo e verificável do app Base44.
// Salva o JSON bruto de cada entidade + um manifesto com contagem e hash.
// Regra: este script só LÊ. Nunca escreve no Base44.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { carregarEnv, get, listarTudo } from './lib/base44.mjs';

const env = carregarEnv(process.cwd());
const DIR = path.join(process.cwd(), 'data', 'raw');
const carimbo = new Date().toISOString();

// A lista de entidades vem da DEFINICAO DO APP, nunca de palpite.
// (Um probe por adivinhacao achou 15 de 24 na primeira tentativa — perderia
//  InstituicoesBancarias, Historicos, Permutas e DeParaDRE.)
const BUILTINS = ['User'];   // entidades nativas do Base44, fora de app.entities

async function descobrirEntidades() {
  const app = await get(env, '');
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, '_app_definition.json'), JSON.stringify(app, null, 2));
  const nomes = Object.keys(app.entities || {});
  if (!nomes.length) throw new Error('app.entities vazio — nao da para garantir snapshot completo.');
  return { nomes: [...nomes, ...BUILTINS], app };
}

// Confirma que a entidade responde de fato (declarada != acessivel).
async function existe(entidade) {
  try { await get(env, `entities/${entidade}`, { limit: 1 }); return true; }
  catch (e) { if (e.status === 404 || e.status === 400) return false; throw e; }
}

console.log(`# Snapshot Base44 — app ${env.appId} — ${carimbo}\n`);
fs.mkdirSync(DIR, { recursive: true });

const { nomes, app } = await descobrirEntidades();
console.log(`# App "${app.name}" — ${nomes.length} entidades declaradas, ${(app.page_names || []).length} paginas`);
console.log(`# Definicao do app salva em data/raw/_app_definition.json (schemas + codigo das paginas)\n`);

const encontradas = [];
for (const c of nomes) {
  try {
    if (await existe(c)) encontradas.push(c);
    else console.log(`  ! ${c}: declarada no app mas inacessivel via API`);
  } catch (e) { console.log(`  ! ${c}: ERRO ${e.status || ''} ${e.message.slice(0, 70)}`); }
}
if (encontradas.length < nomes.length) {
  console.log(`  -> ${nomes.length - encontradas.length} entidade(s) declarada(s) sem dados acessiveis\n`);
}
console.log(`# Extraindo ${encontradas.length} entidades...\n`);

const manifesto = { app_id: env.appId, extraido_em: carimbo, entidades: {} };
for (const ent of encontradas) {
  process.stdout.write(`  ${ent.padEnd(24)}`);
  try {
    const dados = await listarTudo(env, ent);
    const json = JSON.stringify(dados, null, 2);
    fs.writeFileSync(path.join(DIR, `${ent}.json`), json);
    const campos = [...new Set(dados.flatMap(Object.keys))].sort();
    manifesto.entidades[ent] = {
      registros: dados.length,
      sha256: crypto.createHash('sha256').update(json).digest('hex'),
      bytes: json.length,
      campos,
    };
    console.log(`${String(dados.length).padStart(6)} registros · ${campos.length} campos`);
  } catch (e) {
    manifesto.entidades[ent] = { erro: e.message };
    console.log(`FALHOU — ${e.message.slice(0, 120)}`);
  }
}

const mf = path.join(process.cwd(), 'data', 'manifest', `snapshot-${carimbo.slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(mf), { recursive: true });
fs.writeFileSync(mf, JSON.stringify(manifesto, null, 2));

const total = Object.values(manifesto.entidades).reduce((s, e) => s + (e.registros || 0), 0);
const falhas = Object.entries(manifesto.entidades).filter(([, e]) => e.erro);
console.log(`\n# TOTAL: ${total} registros em ${encontradas.length} entidades`);
console.log(`# Manifesto: ${path.relative(process.cwd(), mf)}`);
if (falhas.length) {
  console.log(`\n# ATENCAO — ${falhas.length} entidade(s) falharam. Snapshot INCOMPLETO:`);
  for (const [n, e] of falhas) console.log(`  - ${n}: ${e.erro.slice(0, 140)}`);
  process.exitCode = 1;
}
