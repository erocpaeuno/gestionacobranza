import React, { useState, useMemo } from 'react';
import { X, Check, AlertCircle, Coins, ShieldCheck } from 'lucide-react';
import { Cliente, Prestamo, Cuota, ReciboGenerado } from '../types';
import { formatCurrency, formatDate, getNowDateTimeString, getTodayDateString } from '../utils/storage';

interface PayInstallmentsModalProps {
  cliente: Cliente;
  prestamo: Prestamo;
  cuotas: Cuota[];
  onClose: () => void;
  onSuccess: (recibo: ReciboGenerado, updatedCuotas: Cuota[], updatedCliente: Cliente, updatedPrestamo: Prestamo) => void;
}

export const PayInstallmentsModal: React.FC<PayInstallmentsModalProps> = ({
  cliente,
  prestamo,
  cuotas,
  onClose,
  onSuccess,
}) => {
  // Pending or overdue cuotas sorted by numero
  const pendingCuotas = useMemo(() => {
    return cuotas
      .filter((c) => c.prestamo_id === prestamo.id && c.estado !== 'PAGADO')
      .sort((a, b) => a.numero - b.numero);
  }, [cuotas, prestamo.id]);

  // Selected cuota IDs (by default select the very next pending one)
  const [selectedCuotaIds, setSelectedCuotaIds] = useState<number[]>(() => {
    return pendingCuotas.length > 0 ? [pendingCuotas[0].id] : [];
  });

  // Mora custom adjustments (record of cuotaId -> adjusted mora amount)
  const [moraOverrides, setMoraOverrides] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    pendingCuotas.forEach((c) => {
      initial[c.id] = c.mora || 0;
    });
    return initial;
  });

  // Use client balance (saldo a favor) toggle
  const [useSaldoFavor, setUseSaldoFavor] = useState(cliente.saldo_a_favor > 0);

  // Quick helper to select first N cuotas
  const selectFirstN = (n: number) => {
    const selected = pendingCuotas.slice(0, n).map((c) => c.id);
    setSelectedCuotaIds(selected);
  };

  const selectAll = () => {
    setSelectedCuotaIds(pendingCuotas.map((c) => c.id));
  };

  const clearSelection = () => {
    setSelectedCuotaIds([]);
  };

  // Toggle single cuota selection independently (e.g. cuotas 2, 4 and 5)
  const toggleCuota = (id: number) => {
    setSelectedCuotaIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  // Calculations
  const selectedList = useMemo(() => {
    return pendingCuotas.filter((c) => selectedCuotaIds.includes(c.id));
  }, [pendingCuotas, selectedCuotaIds]);

  const subtotalCuotas = useMemo(() => {
    return selectedList.reduce((acc, c) => acc + Math.max(0, c.monto - c.monto_pagado), 0);
  }, [selectedList]);

  const totalMora = useMemo(() => {
    return selectedList.reduce((acc, c) => acc + (moraOverrides[c.id] || 0), 0);
  }, [selectedList, moraOverrides]);

  const rawTotal = subtotalCuotas + totalMora;

  const appliedSaldoFavor = useMemo(() => {
    if (!useSaldoFavor || cliente.saldo_a_favor <= 0) return 0;
    return Math.min(cliente.saldo_a_favor, rawTotal);
  }, [useSaldoFavor, cliente.saldo_a_favor, rawTotal]);

  const totalToPay = Math.max(0, rawTotal - appliedSaldoFavor);

  const handleConfirmPayment = () => {
    if (selectedList.length === 0) return;

    const today = getTodayDateString();
    const nowDateTime = getNowDateTimeString();
    const receiptId = `REC-${Date.now().toString().slice(-6)}`;

    // Prepare updated cuotas
    const updatedCuotas = cuotas.map((c) => {
      if (selectedCuotaIds.includes(c.id)) {
        return {
          ...c,
          monto_pagado: c.monto,
          mora: moraOverrides[c.id] || 0,
          estado: 'PAGADO' as const,
          fecha_pago_real: today,
        };
      }
      return c;
    });

    // Check if all cuotas for this loan are now paid
    const remainingUnpaid = updatedCuotas.filter(
      (c) => c.prestamo_id === prestamo.id && c.estado !== 'PAGADO'
    );

    const updatedPrestamo: Prestamo = {
      ...prestamo,
      estado: remainingUnpaid.length === 0 ? 'TERMINADO' : prestamo.estado,
    };

    // Remaining loan balance
    const remainingDebtAfterPayment = remainingUnpaid.reduce(
      (acc, c) => acc + Math.max(0, c.monto - c.monto_pagado),
      0
    );

    // Remaining client balance
    const remainingClientSaldo =
      appliedSaldoFavor > 0 ? Math.max(0, cliente.saldo_a_favor - appliedSaldoFavor) : cliente.saldo_a_favor;

    // Updated client saldo a favor
    const updatedCliente: Cliente = {
      ...cliente,
      saldo_a_favor: remainingClientSaldo,
      estado: remainingUnpaid.length === 0 && prestamo.estado !== 'TERMINADO' ? 'INACTIVO' : cliente.estado,
    };

    // Find next upcoming due date if any
    const nextUpcoming = remainingUnpaid[0];
    const nextDue = nextUpcoming ? formatDate(nextUpcoming.fecha_vencimiento) : null;

    const recibo: ReciboGenerado = {
      id: receiptId,
      fecha_hora: nowDateTime,
      cliente: updatedCliente,
      prestamo: updatedPrestamo,
      tipo_operacion: 'CUOTA',
      cuotas_afectadas: selectedList.map((c) => {
        const saldoCuota = Math.max(0, c.monto - c.monto_pagado);
        const moraVal = moraOverrides[c.id] || 0;
        return {
          id: c.id,
          numero: c.numero,
          monto: saldoCuota,
          mora: moraVal,
          total: saldoCuota + moraVal,
        };
      }),
      total_cuotas: subtotalCuotas,
      total_mora: totalMora,
      saldo_favor_usado: appliedSaldoFavor,
      total_cobrado: totalToPay,
      saldo_restante_prestamo: remainingDebtAfterPayment,
      cuotas_restantes: remainingUnpaid.length,
      proximo_vencimiento: nextDue,
      observaciones: `Pago de cuotas seleccionadas: ${selectedList.map((c) => `#${c.numero}`).join(', ')}`,
    };

    onSuccess(recibo, updatedCuotas, updatedCliente, updatedPrestamo);
  };

  return (
    <div
      id="pay-installments-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900 text-white shrink-0">
          <div>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Cobranza de Cuotas
            </span>
            <h3 className="font-bold text-base leading-tight">
              {cliente.nombres} {cliente.apellidos}
            </h3>
            <p className="text-xs text-slate-400">
              Préstamo: {prestamo.id} • Modalidad: {prestamo.tipo_credito}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Selection Pills */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-slate-500 font-medium whitespace-nowrap">Selección rápida:</span>
          <button
            onClick={() => selectFirstN(1)}
            className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition-colors ${
              selectedCuotaIds.length === 1
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            1 Cuota
          </button>
          {pendingCuotas.length >= 2 && (
            <button
              onClick={() => selectFirstN(2)}
              className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition-colors ${
                selectedCuotaIds.length === 2
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              2 Cuotas
            </button>
          )}
          {pendingCuotas.length >= 3 && (
            <button
              onClick={() => selectFirstN(3)}
              className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition-colors ${
                selectedCuotaIds.length === 3
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              3 Cuotas
            </button>
          )}
          {pendingCuotas.some((c) => c.estado === 'VENCIDO') && (
            <button
              onClick={() => {
                const vencidas = pendingCuotas.filter((c) => c.estado === 'VENCIDO').map((c) => c.id);
                setSelectedCuotaIds(vencidas);
              }}
              className="px-3 py-1 rounded-full font-semibold whitespace-nowrap bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200 cursor-pointer"
            >
              Vencidas ({pendingCuotas.filter((c) => c.estado === 'VENCIDO').length})
            </button>
          )}
          <button
            onClick={selectAll}
            className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCuotaIds.length === pendingCuotas.length
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            Todas ({pendingCuotas.length})
          </button>
          {selectedCuotaIds.length > 0 && (
            <button
              onClick={clearSelection}
              className="px-3 py-1 rounded-full font-semibold whitespace-nowrap bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
            >
              Limpiar ({selectedCuotaIds.length})
            </button>
          )}
        </div>

        {/* Selected Cuotas Banner */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs flex items-center justify-between">
          <span className="text-slate-600 font-medium">
            Cuotas a pagar:{' '}
            <strong className="text-emerald-700 font-bold">
              {selectedList.length > 0
                ? selectedList.map((c) => `#${c.numero}`).join(', ')
                : 'Ninguna (selecciona las cuotas que desees)'}
            </strong>
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">
            {selectedList.length} seleccionada(s)
          </span>
        </div>

        {/* Cuotas Checklist (Scrollable) */}
        <div className="p-4 overflow-y-auto grow space-y-2">
          {pendingCuotas.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-800">¡Todas las cuotas están pagadas!</p>
              <p className="text-xs text-slate-500">Este crédito no tiene saldos pendientes.</p>
            </div>
          ) : (
            pendingCuotas.map((cuota) => {
              const isSelected = selectedCuotaIds.includes(cuota.id);
              const isVencido = cuota.estado === 'VENCIDO';
              const isAmortizada = cuota.monto_pagado > 0 && cuota.estado !== 'PAGADO';
              const saldoCuota = Math.max(0, cuota.monto - cuota.monto_pagado);
              const currentMora = moraOverrides[cuota.id] ?? cuota.mora ?? 0;

              return (
                <div
                  key={cuota.id}
                  onClick={() => toggleCuota(cuota.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            Cuota #{cuota.numero}
                          </span>
                          {isAmortizada && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Amortizada (-{formatCurrency(cuota.monto_pagado)})
                            </span>
                          )}
                          {isVencido ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                              Vencida ({cuota.dias_atraso}d)
                            </span>
                          ) : !isAmortizada && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Vence: {formatDate(cuota.fecha_vencimiento)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isAmortizada ? (
                        <div>
                          <span className="text-[10px] text-indigo-600 font-semibold block">
                            Saldo actual:
                          </span>
                          <div className="font-black text-indigo-700 text-sm">
                            {formatCurrency(saldoCuota)}
                          </div>
                          <span className="text-[10px] text-slate-400 line-through">
                            Orig: {formatCurrency(cuota.monto)}
                          </span>
                        </div>
                      ) : (
                        <div className="font-bold text-slate-900 text-sm">
                          {formatCurrency(cuota.monto)}
                        </div>
                      )}
                      {currentMora > 0 && (
                        <div className="text-[11px] font-semibold text-amber-700">
                          +Mora: {formatCurrency(currentMora)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mora control when selected */}
                  {isSelected && isVencido && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2.5 pt-2 border-t border-emerald-200/80 flex items-center justify-between text-xs"
                    >
                      <span className="text-amber-800 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Ajustar Mora:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px]">$</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={currentMora}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setMoraOverrides((prev) => ({ ...prev, [cuota.id]: val }));
                          }}
                          className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-right font-mono text-xs font-semibold focus:outline-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setMoraOverrides((prev) => ({ ...prev, [cuota.id]: 0 }));
                          }}
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 underline ml-1"
                        >
                          Condonar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Saldo a favor option if client has any */}
          {cliente.saldo_a_favor > 0 && (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-indigo-900 block">
                    Saldo a favor disponible: {formatCurrency(cliente.saldo_a_favor)}
                  </span>
                  <span className="text-indigo-700 text-[11px]">
                    Aplicar para reducir el monto a cobrar
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSaldoFavor}
                  onChange={(e) => setUseSaldoFavor(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          )}
        </div>

        {/* Bottom Payment Summary & CTA */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Cuotas seleccionadas ({selectedList.length}):</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(subtotalCuotas)}
              </span>
            </div>
            {totalMora > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Total Mora:</span>
                <span className="font-semibold">+{formatCurrency(totalMora)}</span>
              </div>
            )}
            {appliedSaldoFavor > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Saldo a favor aplicado:</span>
                <span className="font-semibold">-{formatCurrency(appliedSaldoFavor)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-base font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>TOTAL A COBRAR:</span>
              <span className="text-xl text-emerald-600">
                {formatCurrency(totalToPay)}
              </span>
            </div>
          </div>

          <button
            id="confirm-pay-cuotas-btn"
            disabled={selectedList.length === 0}
            onClick={handleConfirmPayment}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            Cobrar {formatCurrency(totalToPay)} ({selectedList.length} cuota{selectedList.length > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
};
