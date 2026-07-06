import { useEffect, useState } from 'react';

const MODAL_DURATION = 180;

/**
 * Mantiene un modal montado durante su animación de salida.
 * Emparejar con `.modal-enter`/`.modal-exit`/`.overlay-enter`/`.overlay-exit` de index.css.
 */
export function useModalAnimation(isOpen: boolean) {
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con la prop `isOpen`; el timeout de salida no tiene equivalente sin efecto.
      setVisible(true);
      setClosing(false);
      return;
    }
    if (!visible) return;
    setClosing(true);
    const t = setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, MODAL_DURATION);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar a isOpen, no a `visible` (evitaría relanzar el timer de salida).
  }, [isOpen]);

  return {
    visible,
    overlayClass: closing ? 'overlay-exit' : 'overlay-enter',
    modalClass: closing ? 'modal-exit' : 'modal-enter',
  };
}
