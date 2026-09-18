// Descobre qual combinação de host + header autentica neste app, e grava no .env.
// Rode logo depois de colar o token. Tolerante a .env desatualizado.
import fs from 'node:fs';
import { carregarEnv, headers, VARIANTES } from './lib/base44.mjs';

const env = carregarEnv(process.cwd());
const HOSTS = [...new Set([env.host, 'https://app.base44.com', 'https://base44.app'])];
const ENTIDADES_TESTE = ['Obras', 'Empresas', 'LancamentosFinanceiros'];

console.log(`# Testando acesso ao app ${env.appId}\n`);

let ok = null;
for (const host of HOSTS) {
  for (const v of VARIANTES) {
    if (!env.apiKey && v !== 'bearer') continue;
    let res, corpo;
    try {
      res = await fetch(`${host}/api/apps/${env.appId}/entities/Obras?limit=1`,
        { headers: headers({ ...env, host }, v) });
      corpo = await res.text();
    } catch (e) { console.log(`  ${host} · ${v.padEnd(10)} -> rede: ${e.message}`); continue; }

    const marca = `${host.replace('https://', '').padEnd(26)} · ${v.padEnd(10)}`;
    if (res.ok) { console.log(`  ${marca} -> HTTP 200 OK`); ok ??= { host, v }; }
    else console.log(`  ${marca} -> HTTP ${res.status} ${corpo.slice(0, 70).replace(/\s+/g, ' ')}`);
  }
}

if (!ok) {
  console.log('\n# Nenhuma combinação autenticou.');
  console.log('# Verifique se o token foi colado inteiro (sem aspas e sem espaços)');
  console.log('# e se ele foi criado DENTRO do app ConstrutoraPRO.');
  process.exit(1);
}

console.log(`\n# Acesso confirmado: host ${ok.host}, header "${ok.v}".`);

// Corrige o .env para o que realmente funciona.
let txt = fs.readFileSync('.env', 'utf8');
txt = txt.replace(/^BASE44_HOST=.*$/m, `BASE44_HOST=${ok.host}`);
txt = /^BASE44_AUTH_HEADER=/m.test(txt)
  ? txt.replace(/^BASE44_AUTH_HEADER=.*$/m, `BASE44_AUTH_HEADER=${ok.v}`)
  : txt.trimEnd() + `\nBASE44_AUTH_HEADER=${ok.v}\n`;
fs.writeFileSync('.env', txt);
console.log('# .env atualizado.\n');

// Prévia do volume, para calibrar a extração.
const env2 = { ...env, host: ok.host, authHeader: ok.v };
for (const e of ENTIDADES_TESTE) {
  try {
    const r = await fetch(`${ok.host}/api/apps/${env.appId}/entities/${e}?limit=1`, { headers: headers(env2, ok.v) });
    const d = await r.json();
    const campos = Array.isArray(d) && d[0] ? Object.keys(d[0]).length : 0;
    console.log(`  ${e.padEnd(24)} acessível · ${campos} campos por registro`);
  } catch { console.log(`  ${e.padEnd(24)} indisponível`); }
}
console.log('\n# Pronto para: node migracao/extrair.mjs');
