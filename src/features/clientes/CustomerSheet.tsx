import { useState } from 'react';
import type { Customer } from '../../domain/types';
import { createCustomer, updateCustomer } from '../../db/repo';
import { Sheet } from '../../components/ui/Sheet';
import { Button, Field, Input, Textarea } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../utils/text';

/** Cadastrar / editar cliente. */
export function CustomerSheet({ customer, onClose, onCreated }: { customer?: Customer; onClose: () => void; onCreated?: (c: Customer) => void }) {
  const toast = useToast();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  async function save() {
    setTouched(true);
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (customer) {
        await updateCustomer(customer.id, { name, phone, notes });
        toast.success('Cliente atualizado.');
      } else {
        const c = await createCustomer({ name, phone, notes });
        toast.success('Cliente cadastrado.');
        onCreated?.(c);
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={customer ? 'Editar cliente' : 'Novo cliente'}
      footer={
        <Button className="w-full" onClick={save} disabled={busy}>
          Salvar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="cs-name" error={touched && !name.trim() ? 'Informe o nome.' : undefined}>
          <Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Telefone" htmlFor="cs-phone" hint="Com DDD. Ex.: (11) 98765-4321">
          <Input id="cs-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Observações" htmlFor="cs-notes">
          <Textarea id="cs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Ex.: prefere horários depois das 21h" />
        </Field>
      </div>
    </Sheet>
  );
}
