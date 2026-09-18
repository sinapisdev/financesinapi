// Validação de CPF e CNPJ pelo dígito verificador. Um documento digitado
// errado só aparece meses depois, numa nota fiscal ou cobrança — barrar na
// entrada é muito mais barato que corrigir depois.

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function digitoCPF(base: string, peso: number): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (peso - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;          // 111.111.111-11 e afins
  return digitoCPF(d.slice(0, 9), 10) === Number(d[9])
      && digitoCPF(d.slice(0, 10), 11) === Number(d[10]);
}

function digitoCNPJ(base: string): number {
  // pesos vão de 2 a 9, da direita para a esquerda
  let soma = 0, peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  return digitoCNPJ(d.slice(0, 12)) === Number(d[12])
      && digitoCNPJ(d.slice(0, 13)) === Number(d[13]);
}

export function documentoValido(v: string): boolean {
  const d = soDigitos(v);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
}

export function formatarDocumento(v: string | null | undefined): string {
  const d = soDigitos(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d || '—';
}

export const formatarCEP = (v: string | null | undefined) => {
  const d = soDigitos(v);
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : (d || '');
};
