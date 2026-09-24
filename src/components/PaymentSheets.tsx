/** Registrar pagamento e quitar saldo. */
import { useState } from 'react';
import type { Cents, PaymentMethod } from '../domain/types';
import { formatBRL, parseBRL } from '../domain/money';
import { addPayment, payBalance, type PaymentInput } from '../db/repo';
import { Sheet } from './ui/Sheet';
import { Button, Chip, Field, Input } from './ui/controls';
import { useToast } from './ui/Toast';
import { errorMessage } from '../utils/text';

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outro', label: 'Outro' },
];

export const METHOD_LABEL: Record<PaymentMethod, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', outro: 'Outro' };

export function centsToInput(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

export function PaymentSheet({
  title = 'Registrar pagamento',
  target,
  suggested,
  onClose,
}: {
  title?: string;
  target: Omit<PaymentInput, 'amount' | 'method' | 'note'>;
  suggested: Cents;
  onClose: () => void;
}) {
  const toast = useToast();
  const [amountText, setAmountText] = useState(suggested > 0 ? centsToInput(suggested) : '');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = parseBRL(amountText);
  const invalid = amount === null || amount <= 0;

  async function save() {
    if (invalid || amount === null) return;
    setBusy(true);
    try {
      await addPayment({ ...target, amount, method, note });
      toast.success(`Pagamento de ${formatBRL(amount)} registrado.`);
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
      title={title}
      footer={
        <Button block onClick={save} disabled={invalid || busy}>
          {amount && amount > 0 ? `Registrar ${formatBRL(amount)}` : 'Registrar'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Valor recebido" htmlFor="pay-amount" error={amountText && invalid ? 'Valor inválido.' : undefined} hint={suggested > 0 ? `Saldo atual: ${formatBRL(suggested)}` : undefined}>
          <Input id="pay-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} autoFocus />
        </Field>
        <Field label="Forma de pagamento">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Forma de pagamento">
            {PAYMENT_METHODS.map((m) => (
              <Chip key={m.value} selected={method === m.value} onClick={() => setMethod(m.value)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Observação" htmlFor="pay-note">
          <Input id="pay-note" value={note} placeholder="Opcional" onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Quitar saldo em um toque: escolhe a forma e pronto. */
export function PayBalanceSheet({ reservationId, balance, onClose }: { reservationId: string; balance: Cents; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function pay(method: PaymentMethod) {
    setBusy(true);
    try {
      const v = await payBalance(reservationId, method);
      toast.success(`Saldo de ${formatBRL(v)} quitado.`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open onClose={onClose} title={`Quitar ${formatBRL(balance)}`}>
      <p className="mb-3 text-slate-600">Como o cliente pagou?</p>
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => (
          <Button key={m.value} variant="secondary" className="min-h-14 text-base" disabled={busy} onClick={() => pay(m.value)}>
            {m.label}
          </Button>
        ))}
      </div>
    </Sheet>
  );
}
