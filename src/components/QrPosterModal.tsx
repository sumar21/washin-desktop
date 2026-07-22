import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, QrCode, Hash, Printer } from 'lucide-react';
import { Modal, ModalActions } from '@/components/Modal';

/**
 * Póster QR de edificio — PORT EXACTO del builder externo (Builder-QR-WashInn/public/builder.js).
 * La estética del póster (fondo, blurs, logo, panel glass, QR, textos, footer) NO debe cambiar:
 * las constantes de `drawPoster`/`generateQrCanvas` están copiadas 1:1. Lo único propio de este repo
 * es el chrome del modal (el <Modal> de la app). El QR encoda el CÓDIGO del edificio (lo mismo que
 * la mobile escanea para habilitar el checklist).
 *
 * Salida: JPG 1080x1350, calidad 0.94, nombre `washinn-<slug>.jpg`.
 */

const POSTER_FONT = 'Geist';
const ASSET_BASE = '/qr-poster';

// El generador de QR vive como script global vendorizado (mismo archivo que el builder), para que
// la salida sea byte a byte idéntica (qrcode(0, "Q")). No se reimplementa en TS.
declare global {
  interface Window {
    qrcode?: (
      typeNumber: number,
      errorCorrectionLevel: string,
    ) => {
      addData: (data: string) => void;
      make: () => void;
      getModuleCount: () => number;
      isDark: (row: number, col: number) => boolean;
    };
  }
}

let qrScriptPromise: Promise<void> | null = null;
function loadQrScript(): Promise<void> {
  if (window.qrcode) return Promise.resolve();
  if (qrScriptPromise) return qrScriptPromise;
  qrScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${ASSET_BASE}/qrcode.min.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      qrScriptPromise = null;
      reject(new Error('No se pudo cargar el generador de QR.'));
    };
    document.head.appendChild(s);
  });
  return qrScriptPromise;
}

// El póster dibuja los textos con la fuente Geist (igual que el builder). Se carga on-demand, solo
// cuando se abre este modal, para no tocar la tipografía Inter de la app.
let geistPromise: Promise<void> | null = null;
function loadGeist(): Promise<void> {
  if (geistPromise) return geistPromise;
  geistPromise = (async () => {
    if (!document.getElementById('qr-poster-geist')) {
      const link = document.createElement('link');
      link.id = 'qr-poster-geist';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
    try {
      await Promise.all([
        document.fonts.load('700 42px Geist'),
        document.fonts.load('500 40px Geist'),
        document.fonts.load('500 32px Geist'),
        document.fonts.load('600 24px Geist'),
      ]);
      await document.fonts.ready;
    } catch {
      /* si Geist no carga, el canvas cae al sans por defecto — no rompe la descarga */
    }
  })();
  return geistPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar el recurso ${src}`));
    img.src = src;
  });
}

export interface PosterInput {
  codigo: string;
  edificio: string;
  direccion: string;
}

// ── Helpers de dibujo (port 1:1 de builder.js) ────────────────────────────────

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
): string[] {
  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function getBuildingDisplayName(payload: PosterInput): string {
  const building = String(payload.edificio || '').trim();
  const address = String(payload.direccion || '').trim();
  if (building && address) return `${building} - ${address}`;
  if (building) return building;
  if (address) return address;
  return 'AGREGA NOMBRE Y DIRECCION DEL EDIFICIO';
}

function getPosterTitle(payload: PosterInput): string {
  const building = String(payload.edificio || '').trim();
  return (building || 'AGREGA NOMBRE DEL EDIFICIO').toUpperCase();
}

function toDownloadSlug(text: string): string {
  return String(text || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function generateQrCanvas(codigo: string): HTMLCanvasElement {
  const qrData = String(codigo || '').trim() || 'SIN-CODIGO';
  const factory = window.qrcode;
  if (!factory) throw new Error('El generador de QR no está disponible.');
  const qr = factory(0, 'Q');
  qr.addData(qrData);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const size = 400;
  const cellSize = Math.floor(size / moduleCount);
  const margin = Math.floor((size - moduleCount * cellSize) / 2);

  const qrCanvas = document.createElement('canvas');
  qrCanvas.width = size;
  qrCanvas.height = size;

  const qrContext = qrCanvas.getContext('2d');
  if (!qrContext) throw new Error('No se pudo crear el canvas del QR.');
  qrContext.fillStyle = '#ffffff';
  qrContext.fillRect(0, 0, size, size);
  qrContext.fillStyle = '#000000';

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        qrContext.fillRect(margin + col * cellSize, margin + row * cellSize, cellSize, cellSize);
      }
    }
  }
  return qrCanvas;
}

function drawFooterWarningIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const sides = 8;
  const radius = size / 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = ((Math.PI * 2) / sides) * i - Math.PI / 8;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = `600 ${Math.floor(size * 0.6)}px ${POSTER_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('!', 0, 2);
  ctx.restore();
}

interface Assets {
  topRight: HTMLImageElement;
  bottomLeft: HTMLImageElement;
  bottomRight: HTMLImageElement;
  logo: HTMLImageElement;
}

function drawPoster(canvas: HTMLCanvasElement, payload: PosterInput, assets: Assets) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#3f98ea';
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(assets.topRight, width - 250, -20, 320, 320);
  ctx.drawImage(assets.bottomLeft, -230, 915, 430, 430);
  ctx.drawImage(assets.bottomRight, 840, 1020, 230, 230);

  const logoTargetWidth = 380;
  const logoRatio = assets.logo.height / assets.logo.width;
  const logoHeight = logoTargetWidth * logoRatio;
  ctx.drawImage(assets.logo, (width - logoTargetWidth) / 2, 90, logoTargetWidth, logoHeight);

  const title = getPosterTitle(payload);
  const titleFont = `700 42px ${POSTER_FONT}`;
  ctx.font = titleFont;
  const tempPanelWidth = 700;
  const titleLines = wrapTextLines(ctx, title, tempPanelWidth - 60, titleFont).slice(0, 2);
  const numLines = titleLines.length;

  const panelHeight = 740 + (numLines === 2 ? 54 : 0);
  const panel = { x: 190, y: 345, width: tempPanelWidth, height: panelHeight };

  drawRoundedRect(ctx, panel.x, panel.y, panel.width, panel.height, 16);
  ctx.fillStyle = 'rgba(180, 217, 255, 0.23)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';

  const lineHeight = 54;
  const titleTop = panel.y + 45;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, width / 2, titleTop + index * lineHeight);
  });

  const qrCanvas = generateQrCanvas(payload.codigo);
  const qrBoxSize = 420;
  const qrX = (width - qrBoxSize) / 2;
  const qrY = titleTop + numLines * lineHeight + 31;

  drawRoundedRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const qrImageSize = qrBoxSize - 50;
  ctx.drawImage(qrCanvas, qrX + 25, qrY + 25, qrImageSize, qrImageSize);

  ctx.fillStyle = '#ffffff';
  ctx.font = `500 40px ${POSTER_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const descY = qrY + qrBoxSize + 48;
  ctx.fillText('Escanea el QR para', width / 2, descY);
  ctx.fillText('comenzar el mantenimiento.', width / 2, descY + 50);

  const warningText = 'Uso exclusivo para personal de Wash Inn';
  ctx.font = `500 32px ${POSTER_FONT}`;
  const textW = ctx.measureText(warningText).width;
  const iconSize = 40;
  const gap = 16;
  const totalBarWidth = iconSize + gap + textW;
  const startX = (width - totalBarWidth) / 2;
  const iconX = startX + iconSize / 2;
  const warningY = 1220;

  drawFooterWarningIcon(ctx, iconX, warningY, iconSize);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(warningText, startX + iconSize + gap, warningY + 2);
}

// ── Componente ────────────────────────────────────────────────────────────────

export function QrPosterModal({
  edificio,
  onClose,
}: {
  edificio: PosterInput | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!edificio} onClose={onClose} title="QR del edificio" width={520}>
      {/* Keyed por código: cada edificio remonta el body con status inicial 'loading', así el
          effect solo transiciona a ready/error (sin setState síncrono en el effect). */}
      {edificio && <QrPosterBody key={edificio.codigo} edificio={edificio} onClose={onClose} />}
    </Modal>
  );
}

function QrPosterBody({ edificio, onClose }: { edificio: PosterInput; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const [, , topRight, bottomLeft, bottomRight, logo] = await Promise.all([
          loadQrScript(),
          loadGeist(),
          loadImage(`${ASSET_BASE}/circulo-blur-arriba-derecha.png`),
          loadImage(`${ASSET_BASE}/circulo-izquierda-abajo.png`),
          loadImage(`${ASSET_BASE}/mini-circulo-blur-abajo-derecha.png`),
          loadImage(`${ASSET_BASE}/logo-washinn.svg`),
        ]);
        if (cancelado) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        drawPoster(canvas, edificio, { topRight, bottomLeft, bottomRight, logo });
        setStatus('ready');
      } catch (err) {
        if (!cancelado) {
          console.error('QrPosterModal', err);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [edificio]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || status !== 'ready' || !edificio) return;
    const slug = toDownloadSlug(getBuildingDisplayName(edificio)) || 'qr';
    const link = document.createElement('a');
    link.download = `washinn-${slug}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.94);
    link.click();
  };

  const codigo = edificio.codigo.trim();
  const nombre = edificio.edificio.trim();

  return (
    <>
      {/* Contexto del edificio: da información y equilibra el modal (evita el póster flotando en blanco). */}
      <div className="flex items-center gap-3 rounded-xl bg-wash-brand/[0.06] p-3 ring-1 ring-wash-brand/15">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <QrCode size={16} />
        </span>
        <div className="min-w-0 flex-1">
          {codigo ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
              <Hash size={9} />
              {codigo}
            </span>
          ) : (
            <span className="text-[11px] italic text-wash-text-muted">Sin código</span>
          )}
          <p className="mt-0.5 truncate font-display text-[13px] font-bold text-wash-accent">
            {nombre || <span className="italic text-wash-text-muted">Sin nombre aún</span>}
          </p>
        </div>
      </div>

      {/* Póster enmarcado en un panel suave (no cambia el póster, solo lo presenta). */}
      <div className="mt-4 rounded-2xl bg-gradient-to-b from-wash-surface-2/60 to-wash-surface-2/20 p-5 ring-1 ring-wash-border">
        <div className="relative mx-auto w-full max-w-[300px]">
          <div className="overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/[0.06]">
            {/* Resolución interna fija 1080x1350 (la salida real); en pantalla se escala a ancho. */}
            <canvas
              ref={canvasRef}
              width={1080}
              height={1350}
              aria-label="Póster QR del edificio"
              className="block h-auto w-full"
            />
          </div>
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-wash-surface/85 text-wash-text-muted">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-xs font-medium">Generando QR…</p>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-wash-surface/95 px-4 text-center">
              <p className="text-sm font-semibold text-wash-text-strong">No se pudo generar el QR</p>
              <p className="text-xs text-wash-text-muted">Revisá la conexión y reintentá.</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] leading-relaxed text-wash-text-muted">
        <Printer size={12} className="shrink-0" />
        <span>
          El QR codifica el <span className="font-semibold text-wash-text-strong">código</span> del edificio · salida JPG 1080×1350
        </span>
      </p>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={status !== 'ready'}
          className="inline-flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} />
          Descargar JPG
        </button>
      </ModalActions>
    </>
  );
}

/** Botón compacto "Ver QR" para el header del detalle de edificio. */
export function VerQrButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ver QR del edificio"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-wash-brand/10 px-3 py-2 text-[12.5px] font-semibold text-wash-brand ring-1 ring-wash-brand/25 transition hover:bg-wash-brand/15 hover:ring-wash-brand/40"
    >
      <QrCode size={15} />
      Ver QR
    </button>
  );
}
