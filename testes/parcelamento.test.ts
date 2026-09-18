// A soma das parcelas TEM de fechar com o valor do lançamento — sempre.
// É o que a trava do banco exige, e é onde arredondamento costuma escapar.
import { gerarParcelas, somarMeses, paraCentavos, type PlanoPagamento } from '../lib/parcelamento';

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? 'ok    ' : 'FALHOU'} ${msg}`);
  if (!cond) falhas++;
};
const soma = (ps: { valor: number }[]) => ps.reduce((s, p) => s + p.valor, 0);

console.log('# Parcelamento\n');

// valores escolhidos para não dividir redondo
const casos: Array<[string, PlanoPagamento]> = [
  ['10.000,00 em 3x', { valorTotal: 1000000, aVista: false, dataBase: '2026-01-10', numParcelas: 3, primeiroVencimento: '2026-02-10' }],
  ['1.000,00 em 7x', { valorTotal: 100000, aVista: false, dataBase: '2026-01-10', numParcelas: 7, primeiroVencimento: '2026-02-10' }],
  ['0,07 em 3x', { valorTotal: 7, aVista: false, dataBase: '2026-01-10', numParcelas: 3, primeiroVencimento: '2026-02-10' }],
  ['145.000,00 com entrada 43.500 + 30x', { valorTotal: 14500000, aVista: false, dataBase: '2026-01-10', valorEntrada: 4350000, dataEntrada: '2026-01-10', numParcelas: 30, primeiroVencimento: '2026-02-15' }],
  ['255.000,00 entrada + 12x + 3 balões', { valorTotal: 25500000, aVista: false, dataBase: '2026-01-05', valorEntrada: 5000000, dataEntrada: '2026-01-05', numParcelas: 12, primeiroVencimento: '2026-02-15', numBaloes: 3, valorBalao: 1000000, primeiroBalao: '2026-06-10', periodicidadeBaloes: 6 }],
  ['venda com chaves', { valorTotal: 20000000, aVista: false, dataBase: '2026-01-05', valorEntrada: 2000000, dataEntrada: '2026-01-05', numParcelas: 36, primeiroVencimento: '2026-02-15', valorChaves: 1500000, dataChaves: '2029-12-31' }],
  ['à vista', { valorTotal: 220000, aVista: true, dataBase: '2026-02-24' }],
];

for (const [nome, plano] of casos) {
  const ps = gerarParcelas(plano);
  ok(soma(ps) === plano.valorTotal,
     `${nome}: soma ${soma(ps)} = total ${plano.valorTotal} (${ps.length} parcelas)`);
  ok(ps.every(p => p.valor > 0), `${nome}: nenhuma parcela zerada`);
  ok(ps.every((p, i) => p.numero === i + 1), `${nome}: numeração sequencial`);
  const ordenado = ps.every((p, i) => i === 0 || ps[i - 1].vencimento <= p.vencimento);
  ok(ordenado, `${nome}: vencimentos em ordem`);
}

console.log('\n# Datas');
ok(somarMeses('2026-01-31', 1) === '2026-02-28', '31/01 + 1 mês = 28/02 (não pula para março)');
ok(somarMeses('2026-01-31', 3) === '2026-04-30', '31/01 + 3 meses = 30/04');
ok(somarMeses('2026-12-15', 1) === '2027-01-15', 'vira o ano corretamente');
ok(somarMeses('2028-01-31', 1) === '2028-02-29', 'ano bissexto: 29/02');

console.log('\n# Valores digitados');
ok(paraCentavos('1.234,56') === 123456, 'formato brasileiro com milhar');
ok(paraCentavos('1234,56') === 123456, 'sem separador de milhar');
ok(paraCentavos('0,07') === 7, 'centavos');
ok(paraCentavos('') === 0, 'vazio vira zero');

// o caso que quebra: divisão infinita
const cem = gerarParcelas({ valorTotal: 10000, aVista: false, dataBase: '2026-01-01', numParcelas: 3, primeiroVencimento: '2026-02-01' });
console.log(`\n  R$ 100,00 em 3x -> ${cem.map(p => (p.valor / 100).toFixed(2)).join(' + ')} = ${(soma(cem) / 100).toFixed(2)}`);
ok(soma(cem) === 10000, 'R$ 100,00 em 3x fecha em 100,00');

console.log(`\n${'='.repeat(50)}`);
console.log(falhas ? `# ${falhas} FALHAS` : '# todos os casos passaram');
process.exit(falhas ? 1 : 0);
