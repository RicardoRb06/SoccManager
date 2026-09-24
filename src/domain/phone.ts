/** Telefones: apenas formatação para exibição (o app não faz ligações nem envia mensagens). */

/** Formata telefone para exibição: (11) 98765-4321 */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  const local = d.length > 11 && d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}
