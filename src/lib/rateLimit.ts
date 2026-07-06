/** Lockout client-side por intentos fallidos (localStorage, key `rl:<kind>`). Ver DESIGN.md 12.2. */

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const CONFIGS = {
  login: { maxAttempts: 5, windowMs: 5 * 60 * 1000 },
  recover: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, RateLimitConfig>;

type RateLimitKind = keyof typeof CONFIGS;

interface RateLimitState {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

export interface LockStatus {
  locked: boolean;
  remainingSeconds: number;
}

function readState(kind: RateLimitKind): RateLimitState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(`rl:${kind}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RateLimitState;
  } catch {
    return null;
  }
}

function writeState(kind: RateLimitKind, state: RateLimitState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`rl:${kind}`, JSON.stringify(state));
}

export function getLockStatus(kind: RateLimitKind): LockStatus {
  const state = readState(kind);
  if (!state?.lockedUntil) return { locked: false, remainingSeconds: 0 };
  const remainingSeconds = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
  return remainingSeconds > 0
    ? { locked: true, remainingSeconds }
    : { locked: false, remainingSeconds: 0 };
}

export function recordFailedAttempt(kind: RateLimitKind): LockStatus {
  const config = CONFIGS[kind];
  const now = Date.now();
  const prev = readState(kind);
  const withinWindow = !!prev && now - prev.firstAttemptAt < config.windowMs;
  const attempts = withinWindow ? prev!.attempts + 1 : 1;
  const firstAttemptAt = withinWindow ? prev!.firstAttemptAt : now;
  const lockedUntil = attempts >= config.maxAttempts ? now + config.windowMs : undefined;
  writeState(kind, { attempts, firstAttemptAt, lockedUntil });
  return getLockStatus(kind);
}

export function resetAttempts(kind: RateLimitKind): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(`rl:${kind}`);
}

export function formatLockTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
