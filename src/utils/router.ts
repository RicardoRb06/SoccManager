/**
 * Roteador por hash mínimo (#/agenda, #/clientes/123).
 * Hash evita depender de rewrites no servidor estático (GitHub Pages, Netlify...).
 * Mantido próprio para não adicionar dependência só para 5 rotas.
 */
import { useSyncExternalStore } from 'react';

function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** Caminho atual sem query (ex.: "/agenda"). */
export function useHashPath(): string {
  const full = useSyncExternalStore(subscribe, currentPath, () => '/');
  return full.split('?')[0] || '/';
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (opts.replace) window.location.replace(target);
  else window.location.hash = target;
}

/** Casa "/clientes/:id" com "/clientes/abc" → { id: "abc" } */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = s[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}
