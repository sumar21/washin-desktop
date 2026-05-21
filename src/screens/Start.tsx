import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export function Start() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/login', { replace: true }), 1800);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#020816]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-wash-brand/20 blur-[140px]" />
      </div>

      <div className="relative flex flex-col items-center gap-8">
        <div className="animate-[pulse_2s_ease-in-out_infinite]">
          <Logo size={88} sub="DESKTOP" />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-wash-brand"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
