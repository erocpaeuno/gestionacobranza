import React, { useState, useMemo } from 'react';
import {
  Search,
  Receipt,
  Printer,
  Share2,
  Calendar,
  User,
  Filter,
} from 'lucide-react';
import { ReciboGenerado, UsuarioConfig } from '../types';
import { formatCurrency, getTodayDateString } from '../utils/storage';

interface ReceiptsHistoryProps {
  recibos: ReciboGenerado[];
  config: UsuarioConfig;
  onSelectRecibo: (recibo: ReciboGenerado) => void;
}

export const ReceiptsHistory: React.FC<ReceiptsHistoryProps> = ({
  recibos,
  config,
  onSelectRecibo,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CUOTA' | 'AMORTIZACION' | 'CANCELACION'>('ALL');

  const filtered = useMemo(() => {
    return recibos.filter((r) => {
      const matchSearch =
        String(r.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.cliente?.nombres || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.cliente?.apellidos || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.cliente?.dni || '').includes(searchTerm) ||
        String(r.prestamo?.id || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = filterType === 'ALL' || r.tipo_operacion === filterType;

      return matchSearch && matchType;
    });
  }, [recibos, searchTerm, filterType]);

  const totalCobrado = useMemo(() => {
    return filtered.reduce((acc, r) => acc + r.total_cobrado, 0);
  }, [filtered]);

  return (
    <div className="space-y-3 pb-20">
      {/* Header Metrics */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 text-white shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              Historial de Recibos Emitidos
            </span>
            <h3 className="text-2xl font-black mt-0.5">{formatCurrency(totalCobrado)}</h3>
          </div>
          <div className="text-right">
            <span className="px-2.5 py-1 bg-white/10 rounded-full text-xs font-bold">
              {filtered.length} comprobante(s)
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, DNI, préstamo o N° recibo..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 shadow-2xs"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              filterType === 'ALL'
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todos ({recibos.length})
          </button>
          <button
            onClick={() => setFilterType('CUOTA')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              filterType === 'CUOTA'
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cuotas
          </button>
          <button
            onClick={() => setFilterType('AMORTIZACION')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              filterType === 'AMORTIZACION'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Amortizaciones
          </button>
          <button
            onClick={() => setFilterType('CANCELACION')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              filterType === 'CANCELACION'
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Liquidaciones
          </button>
        </div>
      </div>

      {/* Receipts List */}
      {filtered.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl text-center border border-slate-200 text-slate-500">
          <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700">No hay comprobantes</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Los pagos, amortizaciones y cancelaciones realizados aparecerán aquí listos para re-impresión o re-envío por WhatsApp.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((recibo) => {
            const isCuota = recibo.tipo_operacion === 'CUOTA';
            const isAmort = recibo.tipo_operacion === 'AMORTIZACION';
            const isCancel = recibo.tipo_operacion === 'CANCELACION';

            return (
              <div
                key={recibo.id}
                onClick={() => onSelectRecibo(recibo)}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer transition-all active:scale-[0.99] space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {recibo.id}
                      </span>
                      <span
                        className={`px-2 py-0.2 rounded-md text-[10px] font-extrabold uppercase ${
                          isCuota
                            ? 'bg-emerald-100 text-emerald-800'
                            : isAmort
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {recibo.tipo_operacion}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      {recibo.cliente.nombres} {recibo.cliente.apellidos}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Préstamo: {recibo.prestamo.id} • DNI: {recibo.cliente.dni}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 block">
                      {formatCurrency(recibo.total_cobrado)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {recibo.fecha_hora.split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* Operations preview */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">
                    {isCuota
                      ? `${recibo.cuotas_afectadas.length} cuota(s) pagada(s)`
                      : isAmort
                      ? 'Amortización a capital'
                      : 'Préstamo liquidado'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRecibo(recibo);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 px-2 py-1 bg-slate-100 rounded-lg"
                    >
                      <Printer className="w-3 h-3 text-slate-600" />
                      Imprimir
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRecibo(recibo);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 px-2 py-1 bg-emerald-50 rounded-lg"
                    >
                      <Share2 className="w-3 h-3 text-emerald-600" />
                      WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
