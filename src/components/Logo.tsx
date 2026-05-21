import { cn } from '@/lib/utils';

interface LogoMarkProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/** Just the circular "w'" mark from the Wash Inn brand */
export function LogoMark({ size = 48, className, glow = false }: LogoMarkProps) {
  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        glow && 'shadow-[0_0_40px_rgba(0,180,229,0.45)]',
        className
      )}
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(circle at 30% 25%, rgb(60 210 245) 0%, rgb(0 180 229) 45%, rgb(0 145 195) 100%)',
      }}
      aria-label="Washin"
    >
      <span
        className="select-none font-bold leading-none text-white"
        style={{
          fontFamily: '"Comfortaa", system-ui, sans-serif',
          fontSize: size * 0.52,
          letterSpacing: '-0.04em',
          paddingBottom: size * 0.04,
        }}
      >
        w
        <span
          style={{
            fontSize: size * 0.38,
            marginLeft: size * -0.05,
            verticalAlign: 'top',
            display: 'inline-block',
            transform: `translateY(-${size * 0.08}px)`,
          }}
        >
          ’
        </span>
      </span>
      {/* subtle highlight ring */}
      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/30" />
    </div>
  );
}

interface LogoProps {
  variant?: 'full' | 'mark';
  tone?: 'light' | 'dark';
  sub?: string;
  size?: number;
  className?: string;
}

/** Full lockup: mark + WASH INN wordmark + optional pill subtitle */
export function Logo({
  variant = 'full',
  tone = 'light',
  sub = 'DESKTOP',
  size = 48,
  className,
}: LogoProps) {
  if (variant === 'mark') return <LogoMark size={size} className={className} />;

  const wordmarkColor = tone === 'light' ? 'text-white' : 'text-wash-brand';
  const pillBg = tone === 'light' ? 'bg-white text-wash-brand' : 'bg-wash-brand text-white';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark size={size} glow={tone === 'light'} />
      <div className="flex flex-col leading-none">
        <span
          className={cn('font-black tracking-tight', wordmarkColor)}
          style={{
            fontFamily: '"Comfortaa", system-ui, sans-serif',
            fontSize: size * 0.55,
            letterSpacing: '-0.02em',
          }}
        >
          WASH INN
        </span>
        {sub && (
          <span
            className={cn(
              'mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-[3px] font-bold tracking-[0.2em]',
              pillBg
            )}
            style={{ fontSize: size * 0.22 }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
