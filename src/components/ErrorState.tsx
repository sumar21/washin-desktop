import { AlertCircle } from 'lucide-react';

/** Bloque de error centrado con retry — ver DESIGN.md 4.6 / regla de oro 22. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <AlertCircle className="text-red-500" size={26} />
      </div>
      <p className="max-w-xs text-sm text-wash-text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-wash-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Reintentar
      </button>
    </div>
  );
}
