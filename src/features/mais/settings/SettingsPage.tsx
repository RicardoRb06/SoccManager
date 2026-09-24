/** Mais › Configurações (carregada sob demanda). */
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '../../../components/AppShell';
import { Chip } from '../../../components/ui/controls';
import { navigate, useHashPath } from '../../../utils/router';
import { VenueSection } from './VenueSection';
import { CourtsSection } from './CourtsSection';
import { HoursSection } from './HoursSection';
import { PricesSection } from './PricesSection';
import { TemplatesSection } from './TemplatesSection';

const TABS = [
  { key: 'quadra', label: 'Estabelecimento' },
  { key: 'quadras', label: 'Quadras' },
  { key: 'horarios', label: 'Horários' },
  { key: 'precos', label: 'Preços' },
  { key: 'mensagens', label: 'Mensagens' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function SettingsPage() {
  const path = useHashPath();
  const seg = path.split('/')[3] as TabKey | undefined;
  const tab: TabKey = TABS.some((t) => t.key === seg) ? seg! : 'quadra';

  return (
    <>
      <PageHeader
        title="Configurações"
        actions={
          <a href="#/mais" className="grid size-11 place-items-center rounded-full hover:bg-slate-100" aria-label="Voltar para Mais">
            <ChevronLeft className="size-5" aria-hidden />
          </a>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Seções">
          {TABS.map((t) => (
            <Chip key={t.key} role="tab" aria-selected={tab === t.key} selected={tab === t.key} className="shrink-0" onClick={() => navigate(`/mais/configuracoes/${t.key}`, { replace: true })}>
              {t.label}
            </Chip>
          ))}
        </div>
        {tab === 'quadra' && <VenueSection />}
        {tab === 'quadras' && <CourtsSection />}
        {tab === 'horarios' && <HoursSection />}
        {tab === 'precos' && <PricesSection />}
        {tab === 'mensagens' && <TemplatesSection />}
      </div>
    </>
  );
}
