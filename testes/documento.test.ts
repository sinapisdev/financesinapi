import { cpfValido, cnpjValido, documentoValido, formatarDocumento } from '../lib/documento';

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? 'ok    ' : 'FALHOU'} ${msg}`);
  if (!cond) falhas++;
};

console.log('# CPF\n');
ok(cpfValido('529.982.247-25'), 'CPF válido conhecido, formatado');
ok(cpfValido('52998224725'), 'o mesmo, só dígitos');
ok(!cpfValido('529.982.247-24'), 'dígito verificador errado');
ok(!cpfValido('111.111.111-11'), 'todos os dígitos iguais');
ok(!cpfValido('5299822472'), 'curto demais');

console.log('\n# CNPJ\n');
ok(cnpjValido('11.222.333/0001-81'), 'CNPJ válido conhecido, formatado');
ok(cnpjValido('11222333000181'), 'o mesmo, só dígitos');
ok(!cnpjValido('11.222.333/0001-82'), 'dígito verificador errado');
ok(!cnpjValido('00.000.000/0000-00'), 'todos os dígitos iguais');

console.log('\n# Genérico e formatação\n');
ok(documentoValido('52998224725'), 'aceita CPF');
ok(documentoValido('11222333000181'), 'aceita CNPJ');
ok(!documentoValido('123'), 'recusa o que não é nenhum dos dois');
ok(formatarDocumento('52998224725') === '529.982.247-25', 'formata CPF');
ok(formatarDocumento('11222333000181') === '11.222.333/0001-81', 'formata CNPJ');
ok(formatarDocumento(null) === '—', 'nulo vira travessão');

console.log(`\n${'='.repeat(50)}`);
console.log(falhas ? `# ${falhas} FALHAS` : '# todos os casos passaram');
process.exit(falhas ? 1 : 0);
