/**
 * Assistente inicial (só quando `demo: false` e ainda não configurado):
 * 1 dados da quadra → 2 quadras → 3 horários → 4 preços.
 * Parte dos valores do tenant.config e grava cada passo no banco.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { saveSettings } from '../../db/settingsRepo';
import { useSettings } from '../../db/hooks';
import { Button } from '../../components/ui/controls';
import { CourtBadge } from '../../components/AppShell';
import { VenueSection } from '../mais/settings/VenueSection';
import { CourtsSection } from '../mais/settings/CourtsSection';
import { HoursSection } from '../mais/settings/HoursSection';
import { PricesSection } from '../mais/settings/PricesSection';
import { navigate } from '../../utils/router';

const STEPS = ['Estabelecimento', 'Quadras', 'Horários', 'Preços'] as const;

export default function OnboardingPage() {
  const s = useSettings();
  const [step, setStep] = useState(0);
  const next = () => setStep((x) => Math.min(STEPS.length - 1, x + 1));

  async function finish() {
    await saveSettings({ onboardingDone: true });
    navigate('/agenda', { replace: true });
  }

  return (
    <div className="pt-safe pb-safe mx-auto min-h-dvh max-w-2xl p-4">
      <header className="mb-4 flex items-center gap-3">
        <CourtBadge size={44} />
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo à Agenda da Quadra</p>
          <h1 className="text-xl font-bold">{s.courtName}: configuração inicial</h1>
        </div>
      </header>

      <ol className="mb-5 grid grid-cols-4 gap-2" aria-label="Passos">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`flex w-full flex-col items-center gap-1 rounded-xl p-2 text-xs font-medium ${i === step ? 'bg-brand-soft text-brand-strong' : 'text-muted-foreground'}`}
            >
              <span className={`grid size-7 place-items-center rounded-full text-sm font-bold ${i < step ? 'bg-primary text-white' : i === step ? 'border-2 border-brand' : 'border border-input'}`}>
                {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <h2 className="mb-1 text-lg font-bold">
        {step + 1}. {STEPS[step]}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {step === 0 && 'Nome, logo, cores e telefone. Tudo pode ser mudado depois em Mais › Configurações.'}
        {step === 1 && 'Cadastre cada quadra que pode ser alugada separadamente.'}
        {step === 2 && 'Marque os dias e horários em que a quadra funciona.'}
        {step === 3 && 'O valor por hora de cada faixa. O app calcula o preço de cada reserva sozinho.'}
      </p>

      {step === 0 && <VenueSection compact onSaved={next} />}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <CourtsSection />
          <Button onClick={next}>Continuar</Button>
        </div>
      )}
      {step === 2 && <HoursSection onSaved={next} saveLabel="Salvar e continuar" />}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <PricesSection />
          <Button onClick={() => void finish()}>
            <Check className="size-4" aria-hidden /> Concluir e abrir a agenda
          </Button>
        </div>
      )}
    </div>
  );
}
