// RECONCILIAÇÃO — compara o caixa do Postgres com o do Base44, item a item.
// Objetivo: zero diferença, ou cada centavo explicado.
import fs from 'node:fs';
import pg from 'pg';
const R = (n) => JSON.parse(fs.readFileSync(`data/raw/${n}.json`, 'utf8'));
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cent = (v) => Math.round((Number(v) || 0) * 100);

const cli = new pg.Client({ database: 'silvereng_dev' });
await cli.connect();

const DE = process.argv[2] || '2000-01-01', ATE = process.argv[3] || '2100-01-01';
const EMPRESA = process.argv[4] || null;   // null = todas

// lado Base44: movimentos financeiros efetivados
const mf = R('MovimentosFinanceiros').filter(m =>
  (!EMPRESA || String(m.codigo_empresa) === String(EMPRESA)) && m.status === 'efetivado' &&
  m.data_movimento >= DE && m.data_movimento < ATE && m.tipo_movimento !== 'transferencia');

// lado Postgres: baixas
const { rows: pgBaixas } = await cli.query(`
  select b.id, b.data_liquidacao::text as data, mc.sentido, b.valor_liquido::numeric as valor,
         b.base44_id, l.base44_numero
    from baixa b
    join parcela p       on p.id = b.parcela_id
    join lancamento l    on l.id = p.lancamento_id
    join movimento_caixa mc on mc.origem = 'baixa' and mc.origem_id = b.id
   where ($1::int is null or l.empresa_id = (select id from empresa where codigo = $1))
     and b.data_liquidacao >= $2 and b.data_liquidacao < $3`, [EMPRESA, DE, ATE]);

const chave = (data, sentido, valor) => `${data}|${sentido}|${cent(valor)}`;
const mapB44 = new Map();
for (const m of mf) {
  const k = chave(m.data_movimento, m.tipo_movimento, m.valor_total ?? m.valor);
  mapB44.set(k, (mapB44.get(k) ?? 0) + 1);
}
const mapPG = new Map();
for (const b of pgBaixas) {
  const k = chave(b.data, b.sentido, b.valor);
  mapPG.set(k, (mapPG.get(k) ?? 0) + 1);
}

const soNoB44 = [], soNoPG = [];
for (const [k, n] of mapB44) { const d = n - (mapPG.get(k) ?? 0); for (let i = 0; i < d; i++) soNoB44.push(k); }
for (const [k, n] of mapPG)  { const d = n - (mapB44.get(k) ?? 0); for (let i = 0; i < d; i++) soNoPG.push(k); }

const somaChaves = (arr, sentido) => arr.filter(k => k.split('|')[1] === sentido)
  .reduce((s, k) => s + Number(k.split('|')[2]), 0);

console.log(`# Reconciliação Base44 x Postgres — ${EMPRESA ? 'empresa '+EMPRESA : 'TODAS as empresas'}, ${DE} a ${ATE}\n`);
console.log(`  movimentos no Base44: ${mf.length}`);
console.log(`  baixas no Postgres:   ${pgBaixas.length}\n`);
console.log(`  ## Só no Base44 (faltam no Postgres): ${soNoB44.length}`);
console.log(`     entradas ${brl(somaChaves(soNoB44,'entrada')/100)} · saídas ${brl(somaChaves(soNoB44,'saida')/100)}`);
for (const k of soNoB44.slice(0, 12)) {
  const [d, s, v] = k.split('|');
  const orig = mf.find(m => chave(m.data_movimento, m.tipo_movimento, m.valor_total ?? m.valor) === k);
  console.log(`       ${d} ${s.padEnd(8)} ${brl(Number(v)/100).padStart(14)}  ${String(orig?.descricao||'').slice(0,26)} lanc=${orig?.id_lancamento}`);
}
if (soNoB44.length > 12) console.log(`       ... e mais ${soNoB44.length - 12}`);

console.log(`\n  ## Só no Postgres (sobram): ${soNoPG.length}`);
console.log(`     entradas ${brl(somaChaves(soNoPG,'entrada')/100)} · saídas ${brl(somaChaves(soNoPG,'saida')/100)}`);
for (const k of soNoPG.slice(0, 12)) {
  const [d, s, v] = k.split('|');
  const orig = pgBaixas.find(b => chave(b.data, b.sentido, b.valor) === k);
  console.log(`       ${d} ${s.padEnd(8)} ${brl(Number(v)/100).padStart(14)}  base44_id=${orig?.base44_id} lanc=${orig?.base44_numero}`);
}
if (soNoPG.length > 12) console.log(`       ... e mais ${soNoPG.length - 12}`);

// veredito
const difEnt = somaChaves(soNoB44,'entrada') - somaChaves(soNoPG,'entrada');
const difSai = somaChaves(soNoB44,'saida')   - somaChaves(soNoPG,'saida');
console.log(`\n${'='.repeat(58)}`);
if (difEnt === 0 && difSai === 0) console.log('# CAIXA RECONCILIADO: diferença de R$ 0,00 nos dois sentidos.');
else { console.log(`# DIVERGE — entradas ${brl(difEnt/100)} · saídas ${brl(difSai/100)}`); process.exitCode = 1; }
await cli.end();
