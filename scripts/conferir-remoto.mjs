// Diagnóstico read-only do banco remoto. Não grava nada.
//   DATABASE_URL='postgresql://...' node conferir-remoto.mjs
import pg from 'pg';
import fs from 'node:fs';

/** Lê DATABASE_URL do .env quando ela não veio pelo ambiente. */
function doEnv() {
  if (!fs.existsSync('.env')) return undefined;
  for (const linha of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
    if (m) {
      const v = m[1].trim().replace(/^['"]|['"]$/g, '');
      if (v) return v;
    }
  }
  return undefined;
}

const url = process.env.DATABASE_URL || doEnv();
if (!url) {
  console.error('\n  Não achei a DATABASE_URL.');
  console.error('  Abra o arquivo .env e cole a string de conexão do Supabase na linha:');
  console.error('    DATABASE_URL=postgresql://...');
  console.error('  (é o mesmo valor que está na Vercel, em Settings > Environment Variables)\n');
  process.exit(1);
}

let u;
try {
  u = new URL(url);
} catch {
  console.error(`\n  Isso não é uma string de conexão: "${url}"`);
  console.error('  Era um exemplo — troque pela string real do painel do Supabase.');
  console.error('  Ela começa com postgresql:// e termina com /postgres\n');
  process.exit(1);
}
if (!/^postgres(ql)?:$/.test(u.protocol)) {
  console.error(`\n  Protocolo inesperado: "${u.protocol}" — a string precisa começar com postgresql://\n`);
  process.exit(1);
}
if (/xxxx|SENHA|YOUR-PASSWORD|COLE_AQUI|aws-0-\.\.\./.test(url)) {
  console.error('\n  A string ainda tem trechos de exemplo (xxxx, SENHA, [YOUR-PASSWORD], ...).');
  console.error('  Copie a linha inteira do painel e troque só a senha.\n');
  process.exit(1);
}
// Supabase exige TLS com CA própria; Postgres local não fala TLS nenhum.
const local = ['localhost', '127.0.0.1', ''].includes(u.hostname);
const cli = new pg.Client({
  connectionString: url,
  ...(local ? {} : { ssl: { rejectUnauthorized: false } }),
});
console.log(`\n  destino: ${u.host}${u.pathname}`);

try {
  await cli.connect();
  console.log('  conexão: OK');
} catch (e) {
  console.error(`  conexão: FALHOU — ${e.message}`);
  console.error('\n  Se for timeout: a Direct connection do Supabase só responde em IPv6.');
  console.error('  Volte no painel > Connect e copie a string do pooler.\n');
  process.exit(1);
}

const uma = async (sql) => (await cli.query(sql)).rows[0];

try {
  const { n } = await uma("select count(*)::int n from information_schema.tables where table_schema='public'");
  console.log(`  tabelas no schema public: ${n}`);

  if (n === 0) {
    console.log('\n  >> O banco está VAZIO. É esta a causa do erro no login.');
    console.log('     Rode: bash scripts/subir-supabase.sh\n');
    process.exit(0);
  }

  for (const t of ['usuario', 'sessao', 'acesso_log', 'empresa', 'lancamento', 'movimento_caixa']) {
    const { existe } = await uma(`select to_regclass('public.${t}') is not null as existe`);
    if (!existe) { console.log(`  ${t.padEnd(16)} AUSENTE`); continue; }
    const { c } = await uma(`select count(*)::int c from ${t}`);
    console.log(`  ${t.padEnd(16)} ${c} linha(s)`);
  }

  const { rows } = await cli.query('select email, nome, papel, ativo from usuario order by id');
  console.log(rows.length ? '\n  usuários:' : '\n  >> Nenhum usuário cadastrado no banco remoto.');
  for (const r of rows) console.log(`    ${r.email} · ${r.papel} · ${r.ativo ? 'ativo' : 'inativo'}`);
  console.log();
} catch (e) {
  console.error(`\n  Erro na consulta: ${e.message}\n`);
} finally {
  await cli.end();
}
