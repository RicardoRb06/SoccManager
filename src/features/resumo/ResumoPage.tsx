// Carregada sob demanda (lazy). Implementação completa no marco 5.
import { ComingSoon, PageHeader } from '../../components/AppShell';

export default function ResumoPage() {
  return (
    <>
      <PageHeader title="Resumo" />
      <ComingSoon milestone={5} />
    </>
  );
}
