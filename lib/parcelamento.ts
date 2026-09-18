// Geração de parcelas. Usada no preview (navegador) e na gravação (servidor),
// para que o que você vê seja exatamente o que é gravado.
// Tudo em CENTAVOS inteiros: dividir dinheiro em float gera diferença de
// centavo, e a trava do banco recusa parcelas que não somam o lançamento.

export type Categoria = 'entrada' | 'parcela' | 'balao' | 'chaves';

export type ParcelaGerada = {
  numero: number;
  categoria: Categoria;
  vencimento: string;   // YYYY-MM-DD
  valor: number;        // centavos
};

export type PlanoPagamento = {
  valorTotal: number;          // centavos
  aVista: boolean;
  dataBase: string;            // competência, YYYY-MM-DD
  // a prazo
  numParcelas?: number;
  primeiroVencimento?: string;
  periodicidadeMeses?: number;
  valorEntrada?: number;       // centavos
  dataEntrada?: string;
  // balões
  numBaloes?: number;
  valorBalao?: number;         // centavos, cada
  primeiroBalao?: string;
  periodicidadeBaloes?: number;
  // entrega de chaves
  valorChaves?: number;        // centavos
  dataChaves?: string;
};

/** Soma meses preservando o fim do mês (31/01 + 1 mês = 28/02, não 03/03). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export function gerarParcelas(p: PlanoPagamento): ParcelaGerada[] {
  const total = Math.round(p.valorTotal);
  if (total <= 0) return [];

  if (p.aVista) {
    return [{ numero: 1, categoria: 'parcela', vencimento: p.dataBase, valor: total }];
  }

  const fixas: ParcelaGerada[] = [];
  let restante = total;

  const entrada = Math.max(0, Math.round(p.valorEntrada ?? 0));
  if (entrada > 0) {
    fixas.push({ numero: 0, categoria: 'entrada', vencimento: p.dataEntrada || p.dataBase, valor: entrada });
    restante -= entrada;
  }

  const numBaloes = Math.max(0, p.numBaloes ?? 0);
  const valorBalao = Math.max(0, Math.round(p.valorBalao ?? 0));
  const baloes: ParcelaGerada[] = [];
  if (numBaloes > 0 && valorBalao > 0 && p.primeiroBalao) {
    const passo = p.periodicidadeBaloes ?? 6;
    for (let i = 0; i < numBaloes; i++) {
      baloes.push({ numero: 0, categoria: 'balao',
        vencimento: somarMeses(p.primeiroBalao, i * passo), valor: valorBalao });
      restante -= valorBalao;
    }
  }

  const chaves = Math.max(0, Math.round(p.valorChaves ?? 0));
  const parcelaChaves: ParcelaGerada[] = [];
  if (chaves > 0 && p.dataChaves) {
    parcelaChaves.push({ numero: 0, categoria: 'chaves', vencimento: p.dataChaves, valor: chaves });
    restante -= chaves;
  }

  const n = Math.max(0, p.numParcelas ?? 0);
  const mensais: ParcelaGerada[] = [];
  if (n > 0 && p.primeiroVencimento) {
    const passo = p.periodicidadeMeses ?? 1;
    const base = Math.floor(restante / n);
    const sobra = restante - base * n;          // centavos que não dividem
    for (let i = 0; i < n; i++) {
      mensais.push({
        numero: 0, categoria: 'parcela',
        vencimento: somarMeses(p.primeiroVencimento, i * passo),
        // a sobra vai na ÚLTIMA parcela: a soma fecha exatamente com o total
        valor: base + (i === n - 1 ? sobra : 0),
      });
    }
  }

  const todas = [...fixas, ...mensais, ...baloes, ...parcelaChaves]
    .filter(x => x.valor !== 0)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  return todas.map((x, i) => ({ ...x, numero: i + 1 }));
}

/** O que sobra para as parcelas mensais depois de entrada, balões e chaves. */
export function restanteParaParcelas(p: PlanoPagamento): number {
  return Math.round(p.valorTotal)
    - Math.max(0, Math.round(p.valorEntrada ?? 0))
    - Math.max(0, (p.numBaloes ?? 0) * Math.round(p.valorBalao ?? 0))
    - Math.max(0, Math.round(p.valorChaves ?? 0));
}

export const paraCentavos = (v: string | number): number => {
  if (typeof v === 'number') return Math.round(v * 100);
  const limpo = String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return Math.round((Number(limpo) || 0) * 100);
};

export const deCentavos = (c: number): string =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
