/** Mais › Configurações (carregada sob demanda). */
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '../../../components/AppShell';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { navigate, useHashPath } from '../../../utils/router';
import { VenueSection } from './VenueSection';
import { CourtsSection } from './CourtsSection';
import { HoursSection } from './HoursSection';
import { PricesSection } from './PricesSection';

const TABS = [
  { key: 'quadra', label: 'Estabelecimento' },
  { key: 'quadras', label: 'Quadras' },
  { key: 'horarios', label: 'Horários' },
  { key: 'precos', label: 'Preços' },
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
          <a href="#/mais" className="grid size-10 place-items-center rounded-full hover:bg-accent" aria-label="Voltar para Mais">
            <ChevronLeft className="size-5" aria-hidden />
          </a>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <Tabs value={tab} onValueChange={(v) => navigate(`/mais/configuracoes/${v}`, { replace: true })}>
          <TabsList aria-label="Seções" className="w-full">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab === 'quadra' && <VenueSection />}
        {tab === 'quadras' && <CourtsSection />}
        {tab === 'horarios' && <HoursSection />}
        {tab === 'precos' && <PricesSection />}
      </div>
    </>
  );
}
