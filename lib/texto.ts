/** Texto digitado entra sempre em maiúsculas, para o sistema ficar uniforme. */
export const normalizar = (v: unknown): string | null => {
  const t = String(v ?? '').trim().replace(/\s+/g, ' ');
  return t ? t.toUpperCase() : null;
};
