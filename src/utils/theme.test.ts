import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('tema', () => {
  it('"system" segue o celular', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('claro e escuro fixos ignoram o celular', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
