import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { Button } from './controls';

/** Confirmação antes de ações destrutivas. */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-foreground/85">{children}</div>
    </Sheet>
  );
}
