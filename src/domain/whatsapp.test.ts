import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES, fillTemplate, formatPhone, normalizePhone, templateValues, waLink } from './whatsapp';

describe('WhatsApp', () => {
  it('normaliza telefone e prefixa 55 com 10/11 dígitos', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('5511987654321');
    expect(normalizePhone('11 3456-7890')).toBe('551134567890');
    expect(normalizePhone('+55 11 98765-4321')).toBe('5511987654321');
    expect(normalizePhone('011 98765-4321')).toBe('5511987654321');
    expect(normalizePhone('1234')).toBe('');
  });

  it('preenche variáveis do template', () => {
    const msg = fillTemplate(DEFAULT_TEMPLATES.cobrar, { cliente: 'João', saldo: 'R$ 60,00', data: '22/09/2026', chavePix: 'pix@x' });
    expect(msg).toBe('Olá, João! Passando para lembrar do saldo de R$ 60,00 referente ao jogo de 22/09/2026. Pix: pix@x. Obrigado!');
    expect(fillTemplate('{desconhecida} {cliente}', {})).toBe('{desconhecida} ');
  });

  it('monta link wa.me com texto codificado', () => {
    expect(waLink('(11) 98765-4321', 'Olá & até já?')).toBe('https://wa.me/5511987654321?text=Ol%C3%A1%20%26%20at%C3%A9%20j%C3%A1%3F');
    expect(waLink('', 'oi')).toBe('https://wa.me/?text=oi');
  });

  it('formata telefone para exibição', () => {
    expect(formatPhone('5511987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
  });
});

describe('mensagem de mensalidade', () => {
  it('usa o mês por extenso', () => {
    const v = templateValues({ customerName: 'Pedro Almeida', courtName: 'Q1', venueName: 'Arena', date: '2026-09-24', startMin: 1260, endMin: 1320, price: 44000, balance: 44000, pixKey: 'pix', month: '2026-09' });
    expect(fillTemplate(DEFAULT_TEMPLATES.mensalidade, v).replace(/ /g, ' ')).toBe(
      'Olá, Pedro! Passando para lembrar da mensalidade de setembro de 2026 do seu horário de quinta-feira às 21:00 na Arena: R$ 440,00. Pix: pix. Obrigado!',
    );
  });
});
