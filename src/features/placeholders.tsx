import { ComingSoon, PageHeader } from '../components/AppShell';

export function MensalistasPage() {
  return (
    <>
      <PageHeader title="Mensalistas" />
      <ComingSoon milestone={4} />
    </>
  );
}

export function ClientesPage() {
  return (
    <>
      <PageHeader title="Clientes" />
      <ComingSoon milestone={3} />
    </>
  );
}
