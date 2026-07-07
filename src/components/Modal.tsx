import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { backdropClose } from '@/lib/backdropClose';
import { useModalAnimation } from '@/hooks/useModalAnimation';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
  className?: string;
}

export function Modal({ open, onClose, title, children, width = 580, className }: ModalProps) {
  const { visible, overlayClass, modalClass } = useModalAnimation(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!visible) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm sm:p-6',
        overlayClass
      )}
      {...backdropClose(onClose)}
    >
      <div
        className={cn(
          // Ancho fluido en mobile (w-full hasta max-w), el body scrollea si no entra (§5.5).
          'relative flex w-full max-h-[90dvh] flex-col overflow-hidden rounded-2xl bg-wash-surface shadow-2xl',
          modalClass,
          className
        )}
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-wash-border px-6 py-4">
            <h2 className="font-display text-lg font-bold text-wash-accent">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-1 text-wash-text-muted hover:bg-wash-canvas"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  // Footer pegado al fondo del modal: los botones quedan SIEMPRE visibles aunque el
  // cuerpo scrollee (evita tener que scrollear para ver Guardar/Aceptar/Cancelar,
  // incluso a 125% de zoom). Se extiende a los bordes (-mx-6/-mb-6) para tapar el
  // padding p-6 del cuerpo y dibujar una barra con borde superior.
  // Mobile: apilados full-width; desktop: en línea a la derecha (§5.5).
  return (
    <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 flex flex-col gap-2 border-t border-wash-border bg-wash-surface px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
      {children}
    </div>
  );
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
  /** Mientras `busy` está en true, el confirm se deshabilita y no se puede cerrar el diálogo. */
  busy?: boolean;
  /** Mensaje de error a mostrar (p. ej. si la acción confirmada falló). */
  error?: string | null;
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
  busy = false,
  error = null,
}: ConfirmDialogProps) {
  // Con una acción en vuelo, ignorar cierres (Escape / backdrop / Cancelar).
  const guardedCancel = () => {
    if (!busy) onCancel();
  };
  return (
    <Modal open={open} onClose={guardedCancel} title={title} width={460}>
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}
      <p className="text-wash-text-strong">{message}</p>
      <ModalActions>
        <button
          type="button"
          onClick={guardedCancel}
          disabled={busy}
          className="rounded-lg border border-wash-border bg-wash-surface px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            'rounded-lg px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60',
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
