import { useEffect, useRef } from 'react';
import { useSettings } from '../db/hooks';
import { applyTheme, useResolvedTheme, watchSystemTheme } from '../utils/theme';

/** Aplica cores, nome da quadra e tema claro/escuro (vindos das configurações) no documento. */
export function ThemeSync() {
  const s = useSettings();
  const prefRef = useRef(s.theme);
  prefRef.current = s.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', s.primaryColor);
    root.style.setProperty('--brand-accent', s.accentColor);
    document.title = `${s.courtName} · Agenda`;
  }, [s.primaryColor, s.accentColor, s.courtName]);

  const resolved = useResolvedTheme();

  useEffect(() => {
    applyTheme(s.theme);
  }, [s.theme]);

  // barra do navegador/status acompanha o tema
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : s.primaryColor);
  }, [resolved, s.primaryColor]);

  useEffect(() => watchSystemTheme(() => prefRef.current), []);
  return null;
}
