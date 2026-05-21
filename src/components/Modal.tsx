import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
  className?: string;
}

export function Modal({ open, onClose, title, children, width = 580, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div
        className={cn('relative rounded-2xl bg-wash-surface shadow-2xl', className)}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-wash-border px-6 py-4">
            <h2 className="font-display text-lg font-bold text-wash-accent">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-wash-text-muted hover:bg-wash-canvas"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex justify-end gap-3">{children}</div>;
}

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open,
  title = 'Confirmar',
  message,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  tone = 'primary',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width={460}>
      <p className="text-wash-text-strong">{message}</p>
      <ModalActions>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-wash-border bg-wash-surface px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            'rounded-lg px-5 py-2 font-medium text-white',
            tone === 'danger'
              ? 'bg-wash-status-rejected hover:brightness-110'
              : 'bg-wash-primary hover:brightness-110'
          )}
        >
          {confirmLabel}
        </button>
      </ModalActions>
    </Modal>
  );
}
