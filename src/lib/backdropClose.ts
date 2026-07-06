import type { MouseEvent } from 'react';

/**
 * Cierra SOLO si el mousedown Y el click caen sobre el overlay mismo, para que
 * una selección de texto que arranca dentro del modal y suelta sobre el fondo
 * no lo cierre. Es una función (no un hook) para poder usarse en JSX condicional.
 * Uso: <div className="fixed inset-0 …" {...backdropClose(onClose)}>
 */
export function backdropClose(onClose: () => void) {
  let pressedOnBackdrop = false;
  return {
    onMouseDown: (e: MouseEvent) => {
      pressedOnBackdrop = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      if (pressedOnBackdrop && e.target === e.currentTarget) onClose();
      pressedOnBackdrop = false;
    },
  };
}
