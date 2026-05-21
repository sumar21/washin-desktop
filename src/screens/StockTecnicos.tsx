import { useMemo, useState } from 'react';
import { HardHat, ArrowLeftRight, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { useAppStore } from '@/store/useAppStore';
import type { RepuestoTecnico } from '@/types/domain';

export function StockTecnicos() {
  const stockT = useAppStore((s) => s.CollectStockTecnicos);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);
  const [query, setQuery] = useState('');

  const canEdit = VarTipoUser === 'Admin' || VarTipoUser === 'Jefe Taller';

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return stockT
      .filter((r) => r.Cantidad_RT > 0)
      .filter(
        (r) =>
          r.Tecnico_RT.toLowerCase().includes(q) ||
          r.Concat_RT.toLowerCase().includes(q) ||
          r.Codigo_RT.toLowerCase().includes(q)
      )
      .sort((a, b) => a.Tecnico_RT.localeCompare(b.Tecnico_RT));
  }, [stockT, query]);

  const columns: Column<RepuestoTecnico>[] = [
    {
      key: 'tecnico',
      header: 'Técnico',
      width: '220px',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-wash-primary/10 p-1.5 text-wash-primary">
            <HardHat size={14} />
          </div>
          <span className="font-semibold text-wash-text-strong">{r.Tecnico_RT}</span>
        </div>
      ),
    },
    {
      key: 'repuesto',
      header: 'Repuesto',
      render: (r) => <div className="font-display font-bold text-wash-accent">{r.Concat_RT}</div>,
    },
    {
      key: 'codigo',
      header: 'Código',
      width: '140px',
      render: (r) => <span className="font-mono text-xs">{r.Codigo_RT}</span>,
    },
    {
      key: 'cantidad',
      header: 'Cant.',
      width: '90px',
      align: 'center',
      render: (r) => (
        <span className="inline-flex min-w-[40px] items-center justify-center rounded-full bg-wash-primary/10 px-2 py-0.5 text-sm font-bold text-wash-primary">
          {r.Cantidad_RT}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      align: 'right',
      truncate: false,
      render: () => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <>
              <button
                type="button"
                className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
                title="Editar cantidad"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
                title="Reingresar a depósito"
              >
                <ArrowLeftRight size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Stock Técnicos"
        subtitle="Repuestos asignados al equipo de campo"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar técnico o repuesto' }}
      />
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="Sin repuestos asignados"
        />
      </div>
    </div>
  );
}
