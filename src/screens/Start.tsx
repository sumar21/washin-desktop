import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

const MIN_SPLASH_MS = 900;

export function Start() {
  const navigate = useNavigate();
  const restoreSession = useAppStore((s) => s.restoreSession);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    restoreSession().then((restored) => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => {
        if (!cancelled) navigate(restored ? '/home' : '/login', { replace: true });
      }, wait);
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, restoreSession]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-wash-navy via-wash-navy to-wash-navy-deep">
      {/* Glows suaves de marca */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-wash-brand/20 blur-3xl" />

      <div className="relative flex flex-col items-center gap-9">
        {/* Logo real de Wash Inn (consistente con Login / Sidebar) */}
        <div className="flex animate-[pulse_2s_ease-in-out_infinite] flex-col items-center gap-4">
          <img
            src="/Logoapp.png"
            alt="Wash Inn"
            className="h-24 w-24 rounded-3xl shadow-2xl ring-2 ring-white/25"
          />
          <div className="flex flex-col items-center leading-none">
            <span className="font-display text-3xl font-black tracking-tight text-white">Wash Inn</span>
            <span className="mt-2 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white ring-1 ring-white/20">
              Desktop
            </span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-white/80"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
