// Cliente HTTP mínimo para a API de entidades do Base44.
// Sem dependências: roda em node >= 18.
import fs from 'node:fs';
import path from 'node:path';

export function carregarEnv(dir = process.cwd()) {
  const arquivo = path.join(dir, '.env');
  if (fs.existsSync(arquivo)) {
    for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const env = {
    appId: process.env.BASE44_APP_ID || '69ceaaf2ff370a0c3a2d44e7',
    host: process.env.BASE44_HOST || 'https://construtoraprosilvereng.base44.app',
    apiKey: process.env.BASE44_API_KEY || '',
    bearer: process.env.BASE44_BEARER || '',
    cookie: process.env.BASE44_COOKIE || '',
    authHeader: process.env.BASE44_AUTH_HEADER || 'api_key',
  };
  if (!env.apiKey && !env.bearer && !env.cookie) {
    throw new Error('Nenhuma credencial em .env — preencha BASE44_API_KEY, BASE44_BEARER ou BASE44_COOKIE.');
  }
  return env;
}

// O Base44 aceita a chave em mais de um header conforme o plano/versao.
// BASE44_AUTH_HEADER fixa o que funcionou (definido por testar-acesso.mjs).
export const VARIANTES = ['api_key', 'x-api-key', 'api-key', 'bearer'];

export function headers(env, variante = env.authHeader || 'api_key') {
  const h = { accept: 'application/json' };
  if (env.apiKey) {
    if (variante === 'bearer') h['authorization'] = `Bearer ${env.apiKey}`;
    else h[variante] = env.apiKey;
  }
  if (env.bearer) h['authorization'] = `Bearer ${env.bearer}`;
  if (env.cookie) h['cookie'] = env.cookie;
  return h;
}

const base = (env) => `${env.host}/api/apps/${env.appId}`;

export async function get(env, caminho, params = {}) {
  const url = new URL(caminho ? `${base(env)}/${caminho}` : base(env));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: headers(env) });
  const texto = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} em ${caminho} :: ${texto.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  try { return JSON.parse(texto); }
  catch { throw new Error(`Resposta não-JSON em ${caminho}: ${texto.slice(0, 200)}`); }
}

// Lista TODOS os registros de uma entidade, paginando com limit/skip.
// Verifica ativamente se a paginação está funcionando: se a página seguinte
// repetir os mesmos ids, aborta em vez de entregar um snapshot incompleto.
// ATENCAO: o sort PRECISA ser por campo unico. created_date tem empates aos
// montes (167 em 500 registros), e com empate o skip devolve paginas instaveis
// — registros somem do resultado sem nenhum erro aparecer. Ordenar por id.
export async function listarTudo(env, entidade, { pageSize = 200, sort = 'id', max = 200000 } = {}) {
  const registros = [];
  const vistos = new Set();
  let skip = 0;
  let duplicadosSeguidos = 0;

  for (;;) {
    const pagina = await get(env, `entities/${entidade}`, { limit: pageSize, skip, sort });
    if (!Array.isArray(pagina)) throw new Error(`${entidade}: esperava array, veio ${typeof pagina}`);
    if (pagina.length === 0) break;

    let novos = 0;
    for (const r of pagina) {
      const id = r.id ?? r._id ?? JSON.stringify(r);
      if (vistos.has(id)) continue;
      vistos.add(id);
      registros.push(r);
      novos++;
    }

    if (novos === 0) {
      duplicadosSeguidos++;
      // Página inteira repetida = 'skip' foi ignorado pelo servidor.
      if (duplicadosSeguidos >= 2) {
        throw new Error(`${entidade}: paginação não avança (skip ignorado) em skip=${skip}. ` +
          `Recebidos ${registros.length} únicos. NÃO tratar como snapshot completo.`);
      }
    } else {
      duplicadosSeguidos = 0;
    }

    skip += pagina.length;
    if (pagina.length < pageSize) break;   // última página
    if (registros.length >= max) throw new Error(`${entidade}: passou de ${max} registros — revise.`);
  }
  return registros;
}
