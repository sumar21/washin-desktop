import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAppStore } from '@/store/useAppStore';

export function Login() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const VarVersion = useAppStore((s) => s.VarVersion);

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTimeout(() => {
      const result = login(usuario, password);
      setLoading(false);
      if (!result.ok) {
        setError(
          result.reason === 'empty'
            ? 'Completá usuario y contraseña.'
            : 'Usuario o contraseña incorrectos.'
        );
        return;
      }
      navigate('/home', { replace: true });
    }, 400);
  };

  const quickFill = (u: string, p: string) => {
    setUsuario(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-50">
      {/* Very subtle cyan corner accents */}
      <div
        className="pointer-events-none absolute -right-48 -top-48 h-[520px] w-[520px] rounded-full opacity-[0.08]"
        style={{ background: 'radial-gradient(circle, var(--color-wash-brand) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-48 -left-48 h-[520px] w-[520px] rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(circle, var(--color-wash-brand) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-[440px] px-6">
        {/* Logo above card */}
        <div className="mb-8 flex justify-center">
          <Logo size={52} tone="dark" sub="DESKTOP" />
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.18),0_8px_16px_-12px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/70">
          {/* Top accent strip */}
          <div className="h-[3px] bg-gradient-to-r from-wash-brand-light via-wash-brand to-wash-brand-dark" />

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-8">
            <div>
              <h1 className="font-display text-2xl font-black text-slate-900">
                Inicia sesión
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Ingresá tus credenciales para continuar
              </p>
            </div>

            <Field label="Usuario">
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Tu usuario"
                autoComplete="username"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
              />
            </Field>

            <Field label="Contraseña">
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group mt-1 flex items-center justify-center gap-2 rounded-xl bg-wash-brand px-4 py-3 text-[15px] font-semibold text-white shadow-sm shadow-wash-brand/30 transition hover:bg-wash-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Validando…
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </form>

          {/* Demo users footer inside card */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-4">
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <span>¿Estás probando la app?</span>
              <span className="text-wash-brand">
                {showHints ? 'Ocultar' : 'Ver usuarios demo →'}
              </span>
            </button>

            {showHints && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ['admin', 'admin', 'Admin'],
                  ['jtaller', 'jtaller', 'Jefe Taller'],
                  ['supervisor', 'super', 'Supervisor'],
                  ['mfernandez', 'tecnico', 'Técnico'],
                ].map(([u, p, role]) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => quickFill(u, p)}
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-left text-xs transition hover:border-wash-brand hover:bg-wash-brand/[0.03]"
                  >
                    <div className="font-mono text-[11px] font-semibold text-slate-700">
                      {u}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{role}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400">
          {VarVersion}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
