import { Loader2 } from 'lucide-react';

export function LoadingOverlay({ visible, label = 'Cargando…' }: { visible: boolean; label?: string }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-full bg-white px-6 py-3 shadow-lg ring-1 ring-wash-border">
        <Loader2 className="animate-spin text-wash-primary" size={20} />
        <span className="text-sm font-medium text-wash-text-strong">{label}</span>
      </div>
    </div>
  );
}
