// Helpers del Calendario compartidos entre la pantalla (screens/Calendario.tsx) y el widget del
// Home (components/AgendaProximosDias.tsx): qué día cae cada cosa y de qué color se pinta.
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { EventoCalendario, Ventilacion } from '@/types/domain';

export type Item =
  | { tipo: 'evento'; key: string; dia: string; evento: EventoCalendario }
  | { tipo: 'ventilacion'; key: string; dia: string; ventilacion: Ventilacion; vencida: boolean };

// ── Fechas ────────────────────────────────────────────────────────────────
// Los días se manejan como clave `yyyy-mm-dd`: ordena bien como string y no arrastra horas.

/** dd/mm/yyyy → yyyy-mm-dd. Vacío si no es una fecha. */
export function claveDia(ddmmyyyy: string | undefined): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((ddmmyyyy ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
export const claveDeDate = (d: Date) => format(d, 'yyyy-MM-dd');
export const mesAnoDe = (d: Date) => format(d, 'MM/yyyy');
/** Se calcula al usarse y no al montar: el escritorio queda abierto días entre recargas. */
export const hoyClave = () => claveDeDate(new Date());
/** yyyy-mm-dd → Date local a las 00:00. */
export const fechaDeClave = (clave: string) => new Date(`${clave}T00:00:00`);

/**
 * Hoy, actualizado solo al pasar la medianoche. El Home y el calendario quedan abiertos días
 * enteros: con un valor fijo, al día siguiente "Hoy" seguía siendo ayer y las vencidas no cambiaban.
 * El chequeo es cada minuto; si el día no cambió, React no vuelve a renderizar (mismo string).
 */
export function useHoy(): string {
  const [hoy, setHoy] = useState(hoyClave);
  useEffect(() => {
    const id = window.setInterval(() => setHoy(hoyClave()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hoy;
}
/** "Miércoles 14 de octubre" (date-fns devuelve el día en minúscula). */
export const fechaLarga = (d: Date) => {
  const s = format(d, "EEEE d 'de' MMMM", { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Fecha en la que cae una ventilación según su estado:
 *  - Realizada  → el día que se finalizó.
 *  - Programada → el día que eligió el técnico.
 *  - Pendiente / Asignada → la próxima limpieza. Las que el técnico genera desde un incidente
 *    nacen Asignadas SIN próxima limpieza (`crearVentilacion` de la mobile): para esas, el día
 *    en que se generaron.
 * Al reasignar, el desktop borra FechaProgramada_VE, así que una Asignada nunca arrastra una
 * fecha programada vieja.
 */
export function fechaVentilacion(v: Ventilacion): string {
  if (v.Estado_VE === 'Realizada') return v.FechaFinalizacion_VE ?? '';
  if (v.Estado_VE === 'Programada') return v.FechaProgramada_VE || v.ProximaLimpieza_VE;
  return v.ProximaLimpieza_VE || v.FechaAsignado_VE || '';
}

/**
 * Estados de ventilación que muestran el Calendario y el widget del Home: lo que ya tiene técnico
 * y falta hacer (decisión de gerencia, 15/10/2026). Ni Pendientes sin técnico ni Realizadas.
 */
export const ESTADOS_VENT_CALENDARIO: readonly string[] = ['Asignada', 'Programada'];

/** Estados de una ventilación que todavía hay que hacer (igual que VENTILACIONES_ABIERTAS_FILTER). */
export const ESTADOS_VENT_ABIERTOS: readonly string[] = ['Pendiente', 'Asignada', 'Programada'];

/**
 * Días de atraso de una ventilación ABIERTA según su fecha en el calendario (> 0 = vencida).
 * Es LA definición de "vencida" de la app: la usan el Calendario, el widget, el Home (tarjeta y
 * "Requiere atención") y el contador de Ventilaciones. Antes el Home y Ventilaciones miraban sólo
 * ProximaLimpieza_VE, así que una Programada para una fecha que ya pasó no contaba como vencida.
 * 0 si no está abierta o no tiene fecha.
 */
export function diasDeAtraso(v: Ventilacion, hoy = hoyClave()): number {
  if (!ESTADOS_VENT_ABIERTOS.includes(v.Estado_VE)) return 0;
  const dia = claveDia(fechaVentilacion(v));
  if (!dia || dia >= hoy) return 0;
  return Math.round((fechaDeClave(hoy).getTime() - fechaDeClave(dia).getTime()) / 86_400_000);
}
export const estaVencida = (v: Ventilacion, hoy = hoyClave()) => diasDeAtraso(v, hoy) > 0;

export function etiquetaFechaVentilacion(v: Ventilacion): string {
  if (v.Estado_VE === 'Realizada') return 'Realizada el';
  if (v.Estado_VE === 'Programada') return 'Programada para';
  if (!v.ProximaLimpieza_VE && v.FechaAsignado_VE) return 'Generada el';
  return 'Próxima limpieza';
}

export function horario(e: EventoCalendario): string {
  if (!e.HoraInicio) return 'Todo el día';
  return e.HoraFin ? `${e.HoraInicio} – ${e.HoraFin}` : e.HoraInicio;
}

// ── Colores ───────────────────────────────────────────────────────────────
// Mismos tonos que StatusBadge para cada estado de ventilación; los eventos van en la marca.

export const TONO = {
  evento: 'bg-wash-brand/10 text-wash-accent ring-wash-brand/30',
  eventoRealizado: 'bg-wash-surface-2 text-wash-text-muted ring-wash-border',
  Pendiente: 'bg-amber-50 text-amber-800 ring-amber-300/70',
  Asignada: 'bg-sky-50 text-sky-800 ring-sky-300/70',
  Programada: 'bg-indigo-50 text-indigo-800 ring-indigo-300/70',
  vencida: 'bg-rose-50 text-rose-700 ring-rose-300/70',
  Realizada: 'bg-slate-50 text-slate-500 ring-slate-200',
} as const;

export function tonoDe(it: Item): string {
  if (it.tipo === 'evento') return it.evento.Estado === 'Realizado' ? TONO.eventoRealizado : TONO.evento;
  if (it.vencida) return TONO.vencida;
  const e = it.ventilacion.Estado_VE;
  return e === 'Asignada' || e === 'Programada' || e === 'Realizada' ? TONO[e] : TONO.Pendiente;
}

/** Orden dentro del día: eventos (los de todo el día primero, después por hora) y ventilaciones. */
export function ordenDe(it: Item): string {
  if (it.tipo === 'evento') return `0|${it.evento.HoraInicio}|${it.evento.Titulo}`;
  const rango = it.vencida ? 1 : it.ventilacion.Estado_VE === 'Realizada' ? 3 : 2;
  return `${rango}|${it.ventilacion.Edificio_VE}`;
}
