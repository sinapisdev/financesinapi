// Cria ou redefine um usuário. A senha é digitada aqui no terminal, sem eco,
// e nunca aparece em log, histórico de shell ou arquivo.
//
//   node scripts/criar-usuario.mjs <email> "<Nome>" [admin|financeiro|leitura]
//
// Para uso não interativo (sem terminal), aceita as duas senhas pela entrada:
//   printf 'senha\nsenha\n' | node scripts/criar-usuario.mjs ...
import pg from 'pg';
import readline from 'node:readline';
import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const gerarHash = async (senha) => {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(senha, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
};

const PAPEIS = ['admin', 'financeiro', 'leitura'];
const [email, nome, papel = 'admin'] = process.argv.slice(2);

if (!email || !nome) {
  console.error('\n  uso: node scripts/criar-usuario.mjs <email> "<Nome>" [admin|financeiro|leitura]\n');
  process.exit(1);
}
if (!PAPEIS.includes(papel)) {
  console.error(`\n  papel inválido: "${papel}" — use ${PAPEIS.join(', ')}\n`);
  process.exit(1);
}
// mesma regra da tela: senão o script cria acesso que depois não pode ser editado
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`\n  e-mail inválido: "${email}" — precisa de domínio completo, como nome@empresa.com.br\n`);
  process.exit(1);
}

/**
 * Lê as duas senhas. Terminal e entrada canalizada precisam de caminhos
 * diferentes: no pipe o stdin acaba após as linhas, e uma segunda pergunta
 * de readline nunca resolveria.
 */
async function lerSenhas() {
  if (!process.stdin.isTTY) {
    const partes = [];
    for await (const pedaco of process.stdin) partes.push(pedaco);
    const linhas = Buffer.concat(partes).toString('utf8').split(/\r?\n/);
    return [linhas[0] ?? '', linhas[1] ?? ''];
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const escreverNormal = rl._writeToOutput.bind(rl);
  const perguntar = (rotulo) => new Promise((resolve) => {
    rl._writeToOutput = (s) => { if (s.includes(rotulo)) escreverNormal(s); };  // esconde o que é digitado
    rl.question(rotulo, (valor) => {
      rl._writeToOutput = escreverNormal;
      process.stdout.write('\n');
      resolve(valor);
    });
  });
  const a = await perguntar(`Senha para ${email}: `);
  const b = await perguntar('Repita a senha: ');
  rl.close();
  return [a, b];
}

const encerrar = (codigo, mensagem) => {
  if (mensagem) console.error(`\n  ${mensagem}\n`);
  process.exit(codigo);
};

const [senha, repetida] = await lerSenhas();

if (senha !== repetida) encerrar(1, 'As senhas não conferem. Rode de novo.');
if (senha.length < 10)  encerrar(1, `Use ao menos 10 caracteres (você digitou ${senha.length}).`);
if (/^\d+$/.test(senha)) encerrar(1, 'Não use só números.');

const cli = new pg.Client({ database: process.env.PGDATABASE || 'silvereng_dev' });
try {
  await cli.connect();
} catch (e) {
  console.error(`\n  Não consegui conectar ao banco "${process.env.PGDATABASE || 'silvereng_dev'}".`);
  console.error(`  ${e.message}\n`);
  process.exit(1);
}

try {
  const { rows } = await cli.query(
    `insert into usuario (email, nome, senha_hash, papel, precisa_trocar_senha)
     values ($1,$2,$3,$4,false)
     on conflict (email) do update set nome = excluded.nome, senha_hash = excluded.senha_hash,
          papel = excluded.papel, precisa_trocar_senha = false, ativo = true, atualizado_em = now()
     returning id, email, nome, papel`,
    [email.toLowerCase().trim(), nome.trim().toUpperCase(), await gerarHash(senha), papel]);

  // trocar a senha encerra as sessões antigas
  await cli.query('delete from sessao where usuario_id = $1', [rows[0].id]);
  const u = rows[0];
  console.log(`\n  Pronto. Entre em http://localhost:3100 com:`);
  console.log(`    e-mail: ${u.email}`);
  console.log(`    papel:  ${u.papel}\n`);
} catch (e) {
  console.error(`\n  Falhou: ${e.message}\n`);
  process.exit(1);
} finally {
  await cli.end();
}
