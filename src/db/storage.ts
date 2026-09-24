/**
 * Armazenamento persistente do navegador: pede para o navegador NÃO apagar
 * os dados do app por falta de espaço, e informa uso/cota.
 */
export interface StorageStatus {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

export async function storageStatus(): Promise<StorageStatus> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s) return { supported: false, persisted: null, usage: null, quota: null };
  const [persisted, est] = await Promise.all([
    s.persisted ? s.persisted().catch(() => null) : Promise.resolve(null),
    s.estimate ? s.estimate().catch(() => null) : Promise.resolve(null),
  ]);
  return { supported: true, persisted, usage: est?.usage ?? null, quota: est?.quota ?? null };
}

/** Pede armazenamento persistente. Retorna se foi concedido. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
}
