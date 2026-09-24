import { useEffect } from 'react';
import { useSettings } from '../db/hooks';

/** Aplica as cores e o nome da quadra (vindos das configurações) no documento. */
export function ThemeSync() {
  const s = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', s.primaryColor);
    root.style.setProperty('--brand-accent', s.accentColor);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.primaryColor);
    document.title = `${s.courtName} · Agenda`;
  }, [s.primaryColor, s.accentColor, s.courtName]);
  return null;
}
