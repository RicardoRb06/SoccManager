/**
 * Tour guiado da demonstração: 4 balões apontando para as abas principais.
 * Só abre pelo botão "Como funciona?" da faixa de demonstração.
 * Pode ser pulado a qualquer momento (botão, Esc ou toque fora) e revisto pelo mesmo botão.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { navigate } from '../../utils/router';
import { closeTour, useTourOpen } from './tourStore';

const STEPS = [
  {
    tab: 'agenda',
    path: '/agenda',
    title: 'Agenda sem horário duplicado',
    text: 'Toque num horário livre para reservar. Se já estiver ocupado, o app avisa quem está lá e sugere os horários livres mais próximos.',
  },
  {
    tab: 'mensalistas',
    path: '/mensalistas',
    title: 'Mensalistas no automático',
    text: 'Cadastre o time fixo uma vez: os jogos de toda semana aparecem sozinhos na agenda e você vê quem está em dia.',
  },
  {
    tab: 'resumo',
    path: '/resumo',
    title: 'Quanto você está deixando na mesa',
    text: 'Recebido, a receber e o valor das horas vazias em reais, com os piores horários para fazer promoção.',
  },
  {
    tab: 'mais',
    path: '/mais',
    title: 'Dados seguros',
    text: 'Backup em arquivo, cópias automáticas, Lixeira e todas as configurações da quadra ficam aqui.',
  },
] as const;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Acha o elemento visível da aba (há um na barra inferior e outro na lateral do desktop). */
function findTarget(tab: string): Box | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="tab-${tab}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

const BALLOON_W = 300;
const GAP = 12;

export function Tour() {
  const open = useTourOpen();
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const balloonRef = useRef<HTMLDivElement>(null);
  const current = STEPS[step] ?? STEPS[0];

  const measure = useCallback(() => setBox(findTarget(current.tab)), [current.tab]);

  // Ao abrir, recomeça do primeiro passo
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    navigate(current.path);
  }, [open, current.path]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    balloonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTour();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, step]);

  if (!open) return null;

  const last = step === STEPS.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Posição do balão: acima do alvo (barra inferior) ou à direita (barra lateral do desktop)
  let style: CSSProperties = { left: Math.max(16, (vw - BALLOON_W) / 2), top: vh / 2 - 100 };
  if (box) {
    const below = box.top + box.height / 2 > vh * 0.6;
    if (below) {
      const left = Math.min(Math.max(16, box.left + box.width / 2 - BALLOON_W / 2), vw - BALLOON_W - 16);
      style = { left, bottom: vh - box.top + GAP };
    } else {
      style = { left: box.left + box.width + GAP, top: Math.max(16, box.top - 8) };
    }
  }

  return createPortal(
    <div className="no-print fixed inset-0 z-[60]">
      {/* Fundo escurecido com "recorte" no alvo */}
      <button type="button" aria-label="Fechar tour" className="absolute inset-0 cursor-default" onClick={closeTour} />
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl ring-4 ring-white transition-all"
          style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8, boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.55)' }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-overlay" />
      )}

      <div
        ref={balloonRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="absolute rounded-2xl bg-card p-4 shadow-xl outline-none"
        style={{ ...style, width: Math.min(BALLOON_W, vw - 32) }}
      >
        <p className="text-xs font-semibold text-brand">
          Passo {step + 1} de {STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-1 font-bold">
          {current.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{current.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="min-h-11 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:bg-accent" onClick={closeTour}>
            Pular
          </button>
          <span className="flex-1" />
          {step > 0 && (
            <button type="button" className="min-h-11 rounded-xl border border-input px-3 text-sm font-semibold hover:bg-accent" onClick={() => setStep((s) => s - 1)}>
              Voltar
            </button>
          )}
          <button
            type="button"
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
            onClick={() => (last ? (closeTour(), navigate('/agenda')) : setStep((s) => s + 1))}
          >
            {last ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
