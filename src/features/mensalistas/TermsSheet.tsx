/** Editar condições do mensalista (nome do time, cobrança, valores, data final). */
import { useState } from 'react';
import type { BillingMode, Recurrence } from '../../domain/types';
import { parseBRL } from '../../domain/money';
import { isISODate } from '../../domain/dates';
import { updateRecurrenceTerms } from '../../db/repo';
import { Sheet } from '../../components/ui/Sheet';
import { Button, Chip, Field, Input } from '../../components/ui/controls';
import { centsToInput } from '../../components/PaymentSheets';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../utils/text';

export function TermsSheet({ rec, onClose }: { rec: Recurrence; onClose: () => void }) {
  const toast = useToast();
  const [team, setTeam] = useState(rec.notes ?? '');
  const [billing, setBilling] = useState<BillingMode>(rec.billingMode);
  const [fixedPrice, setFixedPrice] = useState(rec.pricePerGame !== undefined);
  const [perGameText, setPerGameText] = useState(rec.pricePerGame !== undefined ? centsToInput(rec.pricePerGame) : '');
  const [monthlyText, setMonthlyText] = useState(rec.monthlyPrice !== undefined ? centsToInput(rec.monthlyPrice) : '');
  const [endDate, setEndDate] = useState(rec.endDate ?? '');
  const [busy, setBusy] = useState(false);

  const perGame = fixedPrice ? parseBRL(perGameText) : undefined;
  const monthly = billing === 'mensal' ? parseBRL(monthlyText) : undefined;
  const invalid = (billing === 'mensal' && !(monthly && monthly > 0)) || (billing === 'por_jogo' && fixedPrice && (perGame === null || perGame === undefined)) || (!!endDate && !isISODate(endDate));

  async function save() {
    setBusy(true);
    try {
      await updateRecurrenceTerms(rec.id, {
        notes: team,
        billingMode: billing,
        pricePerGame: billing === 'por_jogo' && fixedPrice && perGame != null ? perGame : undefined,
        monthlyPrice: billing === 'mensal' && monthly != null ? monthly : undefined,
        endDate: endDate || undefined,
      });
      toast.success('Mensalista atualizado.');
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
      title="Editar mensalista"
      footer={
        <Button className="w-full" onClick={save} disabled={invalid || busy}>
          Salvar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome do time" htmlFor="t-team">
          <Input id="t-team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Cobrança">
          <div className="flex flex-wrap gap-2">
            <Chip selected={billing === 'por_jogo'} onClick={() => setBilling('por_jogo')}>
              Por jogo
            </Chip>
            <Chip selected={billing === 'mensal'} onClick={() => setBilling('mensal')}>
              Mensalidade
            </Chip>
          </div>
        </Field>
        {billing === 'mensal' ? (
          <Field label="Valor da mensalidade" htmlFor="t-monthly">
            <Input id="t-monthly" inputMode="decimal" value={monthlyText} onChange={(e) => setMonthlyText(e.target.value)} />
          </Field>
        ) : (
          <Field label="Valor por jogo">
            <div className="flex flex-wrap items-center gap-2">
              <Chip selected={!fixedPrice} onClick={() => setFixedPrice(false)}>
                Tabela de preços
              </Chip>
              <Chip selected={fixedPrice} onClick={() => setFixedPrice(true)}>
                Valor fixo
              </Chip>
              {fixedPrice && <Input aria-label="Valor fixo por jogo" inputMode="decimal" value={perGameText} onChange={(e) => setPerGameText(e.target.value)} className="w-32" />}
            </div>
          </Field>
        )}
        <Field label="Data final (opcional)" htmlFor="t-end" hint="Deixe em branco para não ter fim.">
          <Input id="t-end" type="date" min={rec.startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <p className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">
          Para mudar o dia, o horário ou a quadra, encerre este mensalista e crie outro. Assim o histórico dos jogos anteriores fica correto.
        </p>
      </div>
    </Sheet>
  );
}
