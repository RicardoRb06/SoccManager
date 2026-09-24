import { useMemo } from 'react';
import { useAllData, useSettings } from '../../db/hooks';
import type { Cents, Customer } from '../../domain/types';
import { nowMinutes, todayISO } from '../../domain/dates';
import { prepareSchedule } from '../../domain/schedule';
import { debtByCustomer } from '../../domain/metrics';
import { customerStats, type CustomerStats } from '../../domain/customers';

export interface CustomerSummary {
  customer: Customer;
  debt: Cents;
  stats: CustomerStats;
  isMensalista: boolean;
}

/** Débito e estatísticas de todos os clientes (reativo). */
export function useCustomerSummaries() {
  const all = useAllData();
  const settings = useSettings();
  return useMemo(() => {
    if (!all) return undefined;
    const today = todayISO();
    const prep = prepareSchedule({ ...all, openingHours: settings.openingHours });
    const debt = debtByCustomer(prep, all.payments, all.priceRules, today, nowMinutes(), all.customers);
    const mensalistas = new Set(all.recurrences.filter((r) => r.status !== 'encerrado').map((r) => r.customerId));
    const list: CustomerSummary[] = all.customers.map((c) => ({
      customer: c,
      debt: debt.get(c.id) ?? 0,
      stats: customerStats(c.id, all.reservations, all.payments, all.recurrences, today),
      isMensalista: mensalistas.has(c.id),
    }));
    return { list, all, prep, today };
  }, [all, settings.openingHours]);
}
