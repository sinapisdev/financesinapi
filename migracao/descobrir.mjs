// Descobre a lista real de entidades do app lendo o bundle JS servido publicamente.
// Objetivo: não depender de uma lista escrita à mão (risco de esquecer uma tabela).
const HOST = process.env.BASE44_HOST || 'https://construtoraprosilvereng.base44.app';

const html = await (await fetch(HOST)).text();
const assets = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(m => new URL(m[1], HOST).href);
console.error(`# html: ${html.length} bytes · ${assets.length} bundles`);

const entidades = new Set();
const padroes = [
  /entities\/([A-Z][A-Za-z0-9_]{2,40})/g,
  /entities\.([A-Z][A-Za-z0-9_]{2,40})/g,
  /["'`]([A-Z][A-Za-z0-9_]{2,40})["'`]\s*[,)]\s*\/\*\s*entity/gi,
];

for (const url of assets) {
  let js = '';
  try { js = await (await fetch(url)).text(); } catch { continue; }
  console.error(`# bundle ${url.split('/').pop()} — ${(js.length/1024).toFixed(0)} KB`);
  for (const p of padroes) for (const m of js.matchAll(p)) entidades.add(m[1]);
  // bundles filhos (code-splitting)
  for (const m of js.matchAll(/["'`](\.?\/?assets\/[A-Za-z0-9._-]+\.js)["'`]/g)) {
    assets.push(new URL(m[1].replace(/^\.\//, '/'), HOST).href);
  }
}

const lista = [...entidades].sort();
console.error(`\n# ${lista.length} entidades candidatas encontradas`);
console.log(JSON.stringify(lista, null, 2));
