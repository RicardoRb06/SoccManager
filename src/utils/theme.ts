/**
 * Tema claro/escuro. A preferência fica nas configurações (banco) e é espelhada
 * no localStorage só para o index.html aplicar a classe antes do app carregar
 * (evita o "piscar" de tela clara ao abrir no modo escuro).
 */
import { useSyncExternalStore } from 'react';
import type { ThemePreference } from '../domain/types';

export const THEME_STORAGE_KEY = 'agenda-quadra-theme';
const QUERY = '(prefers-color-scheme: dark)';

function systemDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;
}

export function resolveTheme(pref: ThemePreference, sysDark = systemDark()): 'light' | 'dark' {
  if (pref === 'system') return sysDark ? 'dark' : 'light';
  return pref;
}

/** Aplica a classe .dark no <html> e guarda a preferência para a próxima abertura. */
export function applyTheme(pref: ThemePreference): void {
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // sem localStorage (aba anônima etc.): só perde o ajuste antecipado
  }
  emit();
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener?.('change', l);
  return () => {
    listeners.delete(l);
    mq?.removeEventListener?.('change', l);
  };
}

/** Tema efetivo neste momento (lê a classe do <html>). */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    () => 'light',
  );
}

/** Reage à troca de tema do celular quando a preferência é "seguir o celular". */
export function watchSystemTheme(getPref: () => ThemePreference): () => void {
  const mq = window.matchMedia?.(QUERY);
  if (!mq) return () => {};
  const onChange = () => {
    if (getPref() === 'system') applyTheme('system');
  };
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}
