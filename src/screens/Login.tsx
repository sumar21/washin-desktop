import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  User2,
  Lock,
  RotateCw,
  Building2,
  ClipboardList,
  AlertOctagon,
  AlertCircle,
  Wind,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getLockStatus, recordFailedAttempt, resetAttempts, formatLockTime } from '@/lib/rateLimit';

export function Login() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const VarVersion = useAppStore((s) => s.VarVersion);

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockSecs, setLockSecs] = useState(() => getLockStatus('login').remainingSeconds);

  useEffect(() => {
    if (lockSecs <= 0) return;
    const t = setInterval(() => {
      setLockSecs((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [lockSecs]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockSecs > 0) return;
    setError(null);
    setLoading(true);
    const result = await login(usuario, password);
    setLoading(false);
    if (!result.ok) {
      const status = recordFailedAttempt('login');
      setLockSecs(status.remainingSeconds);
      setError(
        status.locked
          ? `Demasiados intentos. Probá de nuevo en ${formatLockTime(status.remainingSeconds)}.`
          : result.message
      );
      return;
    }
    resetAttempts('login');
    navigate('/home', { replace: true });
  };

  return (
    <div className="grid h-full w-full grid-cols-1 bg-white lg:grid-cols-2">
      {/* ----- Left: form ----- */}
      <div className="relative flex h-full flex-col">
        {/* Top: logo */}
        <div className="flex items-center gap-2.5 p-8">
          <img
            src="/Logoapp.png"
            alt="Wash Inn"
            className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-slate-200"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display text-[18px] font-black tracking-tight text-slate-900">
              Wash <span className="text-wash-navy">Inn</span>
            </span>
            <span className="mt-1 inline-flex w-fit items-center rounded-md bg-slate-100 px-1.5 py-[2px] text-[8.5px] font-bold uppercase tracking-[0.2em] text-slate-600">
              Desktop
            </span>
          </div>
        </div>

        {/* Center: form card */}
        <div className="flex flex-1 items-center justify-center px-8">
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-[420px] flex-col gap-5"
          >
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight text-slate-900">
                Bienvenido
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Iniciá sesión para gestionar la operación.
              </p>
            </div>

            <FieldWithIcon
              icon={User2}
              label="Usuario"
              type="text"
              placeholder="Tu usuario"
              value={usuario}
              onChange={setUsuario}
              autoComplete="username"
            />

            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Contraseña
              </label>
              <div className="mt-1.5 relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-[14.5px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-wash-navy focus:ring-2 focus:ring-wash-navy/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-[12px] font-semibold text-wash-navy hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-700"
              >
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || lockSecs > 0}
              className="group mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wash-navy to-wash-navy-dark px-4 py-3 text-[15px] font-semibold text-white shadow-md shadow-wash-navy/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {lockSecs > 0 ? (
                <>
                  <Lock size={16} />
                  Bloqueado · {formatLockTime(lockSecs)}
                </>
              ) : loading ? (
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

            <div className="mt-2 text-center text-[11px] font-mono text-slate-400">
              {VarVersion}
            </div>
          </form>
        </div>

        {/* Bottom: footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-8 py-4 text-[11.5px] text-slate-500">
          <span>© {new Date().getFullYear()} Wash Inn</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider hover:text-slate-900"
          >
            <RotateCw size={12} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ----- Right: marketing panel ----- */}
      <div className="relative hidden h-full overflow-hidden bg-gradient-to-br from-wash-navy via-wash-navy to-wash-navy-deep lg:block">
        {/* Subtle dot pattern */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.5) 1.5px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Soft glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl"
        />

        <div className="relative flex h-full flex-col items-center justify-center px-12 text-white">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <img
              src="/Logoapp.png"
              alt="Wash Inn"
              className="h-14 w-14 rounded-2xl shadow-lg ring-2 ring-white/25"
            />
            <span className="font-display text-[28px] font-black tracking-tight">
              Wash Inn
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-center font-display text-[40px] font-black leading-[1.1] tracking-tight xl:text-[48px]">
            Operación de
            <br />
            <span className="text-white/85">lavandería</span> bajo
            <br />
            control.
          </h2>

          <p className="mt-6 max-w-[440px] text-center text-[14.5px] leading-relaxed text-white/80">
            Stock, planificación de rutas, incidentes y mantenimiento —
            toda la operación diaria de tus edificios en una sola app.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <FeaturePill icon={Building2} label="Multi-edificio" />
            <FeaturePill icon={ClipboardList} label="Stock & repuestos" />
            <FeaturePill icon={AlertOctagon} label="Incidentes" />
            <FeaturePill icon={Wind} label="Ventilaciones" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldWithIcon({
  icon: Icon,
  label,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: typeof User2;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-600">
        {label}
      </label>
      <div className="relative mt-1.5">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-[14.5px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-wash-navy focus:ring-2 focus:ring-wash-navy/15"
        />
      </div>
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: typeof Building2;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
      <Icon size={12} />
      {label}
    </span>
  );
}
