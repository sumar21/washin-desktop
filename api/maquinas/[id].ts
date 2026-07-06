import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getItem, createItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapMaquina, maquinaSelectFields } from '../_lib/lists.js';
import {
  applyMaquinaTransfer,
  applyMaquinaBaja,
  buildTransferAprobacionFields,
} from '../_lib/maquinaMoves.js';
import { readSession } from '../_lib/session.js';

interface Body {
  action?: 'transfer' | 'baja';
  edificioDestino?: string;
  codigoDestino?: string;
  motivo?: string;
  encendido?: string;
}

const canDirect = (rol: string) => rol === 'Admin';
const canTransfer = (rol: string) => rol === 'Admin' || rol === 'Jefe Taller';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  const body = (req.body ?? {}) as Body;

  try {
    const raw = await getItem(LIST_IDS.detalleMaquina, id, maquinaSelectFields());
    if (!raw) return res.status(404).json({ error: 'not_found', message: 'La máquina no existe' });
    const maquina = mapMaquina(raw);

    // Precondición: una máquina eliminada no se puede volver a bajar ni transferir.
    if (maquina.Status_DM === 'ELIMINADA') {
      return res.status(409).json({ error: 'conflict', message: 'La máquina ya está dada de baja.' });
    }

    // ── Baja (Admin directo) ────────────────────────────────────────────
    if (body.action === 'baja') {
      if (!canDirect(session.rol)) {
        return res.status(403).json({ error: 'forbidden', message: 'Solo un Admin puede dar de baja una máquina.' });
      }
      await applyMaquinaBaja(maquina, body.motivo?.trim() ?? '', session.usuario);
      return res.status(200).json({ ID: id, Status_DM: 'ELIMINADA' });
    }

    // ── Transferir ──────────────────────────────────────────────────────
    if (body.action === 'transfer') {
      if (!canTransfer(session.rol)) {
        return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para transferir máquinas.' });
      }
      const destino = body.edificioDestino ?? '';
      if (!destino.trim()) return res.status(400).json({ error: 'invalid', message: 'Falta el edificio destino' });

      const input = {
        maquina,
        destino,
        codigoDestino: body.codigoDestino ?? '',
        motivo: body.motivo?.trim() ?? '',
        encendidoElegido: body.encendido?.trim() ?? '',
        usuario: session.usuario,
      };

      // Jefe Taller → genera una aprobación (Transferencia de Maquina); Admin → directo.
      if (session.rol === 'Jefe Taller') {
        await createItem(LIST_IDS.aprobaciones, buildTransferAprobacionFields(input));
        return res.status(202).json({ ID: id, pendingApproval: true });
      }

      await applyMaquinaTransfer(input);
      return res.status(200).json({ ID: id, Status_DM: destino.trim() === 'Wash Inn' ? 'DEPOSITO' : 'INSTALADA', Edificio_DM: destino });
    }

    return res.status(400).json({ error: 'invalid', message: 'Acción de máquina desconocida' });
  } catch (err) {
    console.error('maquinas [id] POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
