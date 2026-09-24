/** Normaliza texto para busca: minúsculas, sem acentos. */
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Casa por nome (sem acento) ou por dígitos do telefone. */
export function matchesCustomer(query: string, name: string, phone: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3 && phone.replace(/\D/g, '').includes(digits)) return true;
  return normalizeSearch(name).includes(q);
}

/** Mensagem amigável para qualquer erro. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Algo deu errado. Tente de novo.';
}
