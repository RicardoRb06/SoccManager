import { describe, expect, it } from 'vitest';
import { formatPhone } from './phone';

describe('telefone', () => {
  it('formata para exibição', () => {
    expect(formatPhone('5511987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
    expect(formatPhone('11 98765-4321')).toBe('(11) 98765-4321');
    expect(formatPhone('123')).toBe('123');
  });
});
