import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function proper(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function formatToday(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function currentMonthYear(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function currentMonthName(locale = 'es-AR'): string {
  return new Date().toLocaleString(locale, { month: 'long' });
}

export function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Convierte un Tipo en UPPERCASE (LAVADORA, SECADORA SIMPLE) a Title Case (Lavadora, Secadora Simple). */
export function tipoLabel(tipo: string): string {
  return tipo
    .split(' ')
    .map((w) => (w ? w[0] + w.slice(1).toLowerCase() : ''))
    .join(' ');
}
