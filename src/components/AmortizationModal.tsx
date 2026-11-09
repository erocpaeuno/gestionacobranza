import React, { useState, useMemo } from 'react';
import { X, TrendingDown, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Cliente, Prestamo, Cuota, ReciboGenerado } from '../types';
import { formatCurrency, formatDate, getNowDateTimeString, getTodayDateString } from '../utils/storage';

interface AmortizationModalProps {
  cliente: Cliente;
  prestamo: Prestamo;
  cuotas: Cuota[];
  onClose: () => void;
  onSuccess: (recibo: ReciboGenerado, updatedCuotas: Cuota[], updatedCliente: Cliente, updatedPrestamo: Prestamo) => void;
}

export const AmortizationModal: React.FC<AmortizationModalProps> = ({
  cliente,
  prestamo,
  cuotas,
  onClose,
  onSuccess,
}) => {
  // Pending cuotas sorted by numero
  const pendingCuotas = useMemo(() => {
    return cuotas
      .filter((c) => c.prestamo_id === prestamo.id && c.estado !== 'PAGADO')
      .sort((a, b) => a.numero - b.numero);
  }, [cuotas, prestamo.id]);

  // Current outstanding debt across remaining cuotas
  const currentTotalDebt = useMemo(() => {
    return pendingCuotas.reduce((acc, c) => acc + Math.max(0, c.monto - c.monto_pagado), 0);
  }, [pendingCuotas]);

  // Amortization mode: Specific cuota vs General loan reduction
  const [amortMode, setAmortMode] = useState<'SPECIFIC_CUOTA' | 'GENERAL'>('SPECIFIC_CUOTA');
  const [selectedCuotaId, setSelectedCuotaId] = useState<number>(() => {
    return pendingCuotas.length > 0 ? pendingCuotas[0].id : 0;
  });

  const selectedCuota = useMemo(() => {
    return pendingCuotas.find((c) => c.id === selectedCuotaId) || pendingCuotas[0];
  }, [pendingCuotas, selectedCuotaId]);

  const selectedCuotaSaldoActual = useMemo(() => {
    if (!selectedCuota) return 0;
    return Math.max(0, selectedCuota.monto - selectedCuota.monto_pagado);
  }, [selectedCuota]);

  const singleCuotaAmount = selectedCuotaSaldoActual > 0 ? selectedCuotaSaldoActual : (pendingCuotas[0]?.monto || 50);

  const [amountInput, setAmountInput] = useState<string>(singleCuotaAmount.toString());
  const [strategy, setStrategy] = useState<'FROM_END' | 'FROM_START'>('FROM_START');

  const amount = parseFloat(amountInput) || 0;
  const maxAllowedAmount = amortMode === 'SPECIFIC_CUOTA' ? selectedCuotaSaldoActual : currentTotalDebt;
  const validAmount = amount > 0 && amount <= maxAllowedAmount;

  // Simulation of which cuotas get affected
  const simulation = useMemo(() => {
    if (!validAmount) {
      return {
        remainingDebt: currentTotalDebt,
        affectedCuotas: [] as Array<{
          id: number;
          numero: number;
          montoAbonado: number;
          saldoAnterior: number;
          saldoActual: number;
          nuevoMontoPagado: number;
          estadoResultante: string;
        }>,
        newRemainingCuotas: pendingCuotas.length,
        workingCuotas: [] as Cuota[],
      };
    }

    const workingCuotas = pendingCuotas.map((c) => ({ ...c }));
    const affectedCuotas: Array<{
      id: number;
      numero: number;
      montoAbonado: number;
      saldoAnterior: number;
      saldoActual: number;
      nuevoMontoPagado: number;
      estadoResultante: string;
    }> = [];

    if (amortMode === 'SPECIFIC_CUOTA' && selectedCuota) {
      const targetIdx = workingCuotas.findIndex((c) => c.id === selectedCuota.id);
      if (targetIdx !== -1) {
        const c = workingCuotas[targetIdx];
        const saldoAnterior = Math.max(0, c.monto - c.monto_pagado);
        const montoAbonado = Math.min(amount, saldoAnterior);
        c.monto_pagado += montoAbonado;
        const saldoActual = Math.max(0, c.monto - c.monto_pagado);
        if (saldoActual === 0) {
          c.estado = 'PAGADO';
        }
        affectedCuotas.push({
          id: c.id,
          numero: c.numero,
          montoAbonado,
          saldoAnterior,
          saldoActual,
          nuevoMontoPagado: c.monto_pagado,
          estadoResultante: c.estado,
        });
      }
    } else if (strategy === 'FROM_END') {
      // Apply backwards from the last installment to shorten loan duration
      let remainingToDistribute = amount;
      for (let i = workingCuotas.length - 1; i >= 0 && remainingToDistribute > 0; i--) {
        const c = workingCuotas[i];
        const unpaidPart = Math.max(0, c.monto - c.monto_pagado);
        if (unpaidPart <= 0) continue;

        const saldoAnterior = unpaidPart;
        const abono = Math.min(remainingToDistribute, unpaidPart);
        c.monto_pagado += abono;
        remainingToDistribute -= abono;
        const saldoActual = Math.max(0, c.monto - c.monto_pagado);
        if (saldoActual === 0) {
          c.estado = 'PAGADO';
        }
        affectedCuotas.unshift({
          id: c.id,
          numero: c.numero,
          montoAbonado: abono,
          saldoAnterior,
          saldoActual,
          nuevoMontoPagado: c.monto_pagado,
          estadoResultante: c.estado,
        });
      }
    } else {
      // Apply forward from the next installment
      let remainingToDistribute = amount;
      for (let i = 0; i < workingCuotas.length && remainingToDistribute > 0; i++) {
        const c = workingCuotas[i];
        const unpaidPart = Math.max(0, c.monto - c.monto_pagado);
        if (unpaidPart <= 0) continue;

        const saldoAnterior = unpaidPart;
        const abono = Math.min(remainingToDistribute, unpaidPart);
        c.monto_pagado += abono;
        remainingToDistribute -= abono;
        const saldoActual = Math.max(0, c.monto - c.monto_pagado);
        if (saldoActual === 0) {
          c.estado = 'PAGADO';
        }
        affectedCuotas.push({
          id: c.id,
          numero: c.numero,
          montoAbonado: abono,
          saldoAnterior,
          saldoActual,
          nuevoMontoPagado: c.monto_pagado,
          estadoResultante: c.estado,
        });
      }
    }

    const newUnpaid = workingCuotas.filter((c) => c.estado !== 'PAGADO');
    const newDebt = newUnpaid.reduce((acc, c) => acc + Math.max(0, c.monto - c.monto_pagado), 0);

    return {
      remainingDebt: Math.max(0, newDebt),
      affectedCuotas,
      newRemainingCuotas: newUnpaid.length,
      workingCuotas,
    };
  }, [validAmount, amount, amortMode, selectedCuota, currentTotalDebt, pendingCuotas, strategy]);

  const handleConfirm = () => {
    if (!validAmount || !simulation.workingCuotas) return;

    const today = getTodayDateString();
    const nowDateTime = getNowDateTimeString();
    const receiptId = `REC-AMORT-${Date.now().toString().slice(-6)}`;

    // Update the cuotas in the full list
    const updatedMap = new Map<number, Cuota>(simulation.workingCuotas.map((c) => [c.id, c]));
    const updatedCuotas = cuotas.map((c) => {
      const simulated = updatedMap.get(c.id);
      if (simulated) {
        return {
          ...simulated,
          fecha_pago_real: simulated.estado === 'PAGADO' ? today : c.fecha_pago_real,
        };
      }
      return c;
    });

    const isFinished = simulation.newRemainingCuotas === 0;
    const updatedPrestamo: Prestamo = {
      ...prestamo,
      estado: isFinished ? 'TERMINADO' : prestamo.estado,
    };

    const nextUpcoming = simulation.workingCuotas.find((c) => c.estado !== 'PAGADO');

    const recibo: ReciboGenerado = {
      id: receiptId,
      fecha_hora: nowDateTime,
      cliente,
      prestamo: updatedPrestamo,
      tipo_operacion: 'AMORTIZACION',
      cuotas_afectadas: simulation.affectedCuotas.map((ac) => ({
        id: ac.id,
        numero: ac.numero,
        monto: ac.montoAbonado,
        mora: 0,
        total: ac.montoAbonado,
        saldo_actual: ac.saldoActual,
      })),
      total_cuotas: amount,
      total_mora: 0,
      saldo_favor_usado: 0,
      total_cobrado: amount,
      saldo_restante_prestamo: simulation.remainingDebt,
      cuotas_restantes: simulation.newRemainingCuotas,
      proximo_vencimiento: nextUpcoming ? formatDate(nextUpcoming.fecha_vencimiento) : null,
      observaciones:
        amortMode === 'SPECIFIC_CUOTA' && selectedCuota
          ? `Amortización a Cuota #${selectedCuota.numero} ($${amount.toFixed(2)}). Saldo actual de cuota: $${simulation.affectedCuotas[0]?.saldoActual.toFixed(2) || '0.00'}`
          : `Amortización extraordinaria de $${amount.toFixed(2)} (${
              strategy === 'FROM_END' ? 'Cuotas finales' : 'Cuotas próximas'
            })`,
    };

    onSuccess(recibo, updatedCuotas, cliente, updatedPrestamo);
  };

  return (
    <div
      id="amortization-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                Amortización Extraordinaria
              </span>
              <h3 className="font-bold text-base leading-tight">
                {cliente.nombres} {cliente.apellidos}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 overflow-y-auto grow space-y-4">
          {/* Current Debt & Loan Balance Card */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Saldo Actual Total del Crédito
                </span>
                <span className="text-xl font-black text-emerald-400">
                  {formatCurrency(currentTotalDebt)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Cuotas por Pagar
                </span>
                <span className="text-sm font-bold text-indigo-300">
                  {pendingCuotas.length} cuotas
                </span>
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tipo de Amortización
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAmortMode('SPECIFIC_CUOTA');
                  setAmountInput(selectedCuotaSaldoActual.toString());
                }}
                className={`py-2 px-3 rounded-xl font-bold transition-all text-left flex flex-col cursor-pointer border ${
                  amortMode === 'SPECIFIC_CUOTA'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Abonar a Cuota Específica</span>
                <span className="text-[10px] font-normal text-slate-500 mt-0.5">
                  Elige una cuota y abona a su saldo
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAmortMode('GENERAL');
                  setAmountInput(singleCuotaAmount.toString());
                }}
                className={`py-2 px-3 rounded-xl font-bold transition-all text-left flex flex-col cursor-pointer border ${
                  amortMode === 'GENERAL'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Amortización General</span>
                <span className="text-[10px] font-normal text-slate-500 mt-0.5">
                  Distribuye abono en el cronograma
                </span>
              </button>
            </div>
          </div>

          {/* Specific Cuota Selector */}
          {amortMode === 'SPECIFIC_CUOTA' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seleccionar Cuota a Amortizar
                </label>
                <select
                  value={selectedCuotaId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedCuotaId(id);
                    const target = pendingCuotas.find((c) => c.id === id);
                    if (target) {
                      const sActual = Math.max(0, target.monto - target.monto_pagado);
                      setAmountInput(sActual.toString());
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-500"
                >
                  {pendingCuotas.map((c) => {
                    const sActual = Math.max(0, c.monto - c.monto_pagado);
                    const isParcial = c.monto_pagado > 0;
                    return (
                      <option key={c.id} value={c.id}>
                        Cuota #{c.numero} — Saldo Actual: {formatCurrency(sActual)}{' '}
                        {isParcial ? `(Abonado prev: ${formatCurrency(c.monto_pagado)})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedCuota && (
                <div className="p-3 bg-white border border-indigo-100 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Cuota seleccionada:</span>
                    <span className="font-bold text-slate-900">Cuota #{selectedCuota.numero}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>Monto original:</span>
                    <span>{formatCurrency(selectedCuota.monto)}</span>
                  </div>
                  {selectedCuota.monto_pagado > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-indigo-700 font-medium">
                      <span>Abonado anteriormente:</span>
                      <span>-{formatCurrency(selectedCuota.monto_pagado)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-700">Saldo actual de esta cuota:</span>
                    <span className="font-black text-indigo-700 text-sm">
                      {formatCurrency(selectedCuotaSaldoActual)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Monto del Abono / Amortización
              </label>
              <span className="text-[11px] text-slate-500">
                Máximo permitido:{' '}
                <strong className="text-indigo-700">{formatCurrency(maxAllowedAmount)}</strong>
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-base">
                $
              </span>
              <input
                id="amortization-amount-input"
                type="number"
                step="0.5"
                min="1"
                max={maxAllowedAmount}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-white border-2 border-indigo-200 rounded-xl font-bold text-lg text-slate-900 focus:outline-hidden focus:border-indigo-600"
                placeholder="0.00"
              />
            </div>

            {/* Quick amount shortcuts */}
            <div className="flex flex-wrap gap-2 mt-2">
              {amortMode === 'SPECIFIC_CUOTA' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAmountInput(selectedCuotaSaldoActual.toString())}
                    className="px-2.5 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Liquidar Cuota ({formatCurrency(selectedCuotaSaldoActual)})
                  </button>
                  {selectedCuotaSaldoActual > 10 && (
                    <button
                      type="button"
                      onClick={() => setAmountInput((Math.round(selectedCuotaSaldoActual / 2)).toString())}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      50% ({formatCurrency(Math.round(selectedCuotaSaldoActual / 2))})
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAmountInput(singleCuotaAmount.toString())}
                    className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    1 Cuota ({formatCurrency(singleCuotaAmount)})
                  </button>
                  {pendingCuotas.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => setAmountInput((singleCuotaAmount * 2).toString())}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      2 Cuotas ({formatCurrency(singleCuotaAmount * 2)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAmountInput((Math.round(currentTotalDebt / 2)).toString())}
                    className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    50% Deuda
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Amortization Strategy (General mode) */}
          {amortMode === 'GENERAL' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Método de Aplicación del Abono
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div
                  onClick={() => setStrategy('FROM_START')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    strategy === 'FROM_START'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Abonar a Próximas Cuotas</span>
                    {strategy === 'FROM_START' && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Adelanta y amortiza el saldo de las cuotas inmediatamente siguientes.
                  </p>
                </div>

                <div
                  onClick={() => setStrategy('FROM_END')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    strategy === 'FROM_END'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Reducir Cuotas Finales</span>
                    {strategy === 'FROM_END' && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Liquida las últimas cuotas del cronograma, reduciendo el plazo total.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Simulation Preview Card showing Saldo Actual */}
          {validAmount && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-emerald-700" />
                  Saldo Actual tras la Amortización:
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                  Abono: {formatCurrency(amount)}
                </span>
              </div>

              {/* Loan level balances */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-200/80">
                <div>
                  <span className="text-slate-500 text-[11px] block">Nuevo Saldo del Crédito:</span>
                  <div className="flex items-center gap-1 font-bold text-slate-900 mt-0.5">
                    <span className="line-through text-slate-400 text-xs">
                      {formatCurrency(currentTotalDebt)}
                    </span>
                    <ArrowRight className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-800 font-extrabold text-sm">
                      {formatCurrency(simulation.remainingDebt)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">Cuotas Restantes:</span>
                  <div className="flex items-center gap-1 font-bold text-slate-900 mt-0.5">
                    <span className="line-through text-slate-400 text-xs">
                      {pendingCuotas.length}
                    </span>
                    <ArrowRight className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-800 font-extrabold text-sm">
                      {simulation.newRemainingCuotas} cuota(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Cuota level breakdown showing each cuota's saldo actual */}
              {simulation.affectedCuotas.length > 0 && (
                <div className="pt-2 border-t border-emerald-200/80 space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-900 block">
                    Detalle de Saldo por Cuota:
                  </span>
                  <div className="space-y-1 bg-white/70 rounded-xl p-2 border border-emerald-200/50 max-h-36 overflow-y-auto">
                    {simulation.affectedCuotas.map((ac) => (
                      <div
                        key={ac.id}
                        className="flex items-center justify-between text-[11px] py-0.5"
                      >
                        <div>
                          <span className="font-bold text-slate-800">Cuota #{ac.numero}</span>
                          <span className="text-slate-500 text-[10px] ml-1.5">
                            (Abono: {formatCurrency(ac.montoAbonado)})
                          </span>
                        </div>
                        <div className="text-right">
                          {ac.saldoActual === 0 ? (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                              CANCELADA AL 100%
                            </span>
                          ) : (
                            <span className="font-bold text-indigo-700">
                              Saldo actual: {formatCurrency(ac.saldoActual)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {amount > maxAllowedAmount && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                El monto no puede ser mayor que el saldo disponible ({formatCurrency(maxAllowedAmount)}).
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            id="confirm-amortization-btn"
            disabled={!validAmount}
            onClick={handleConfirm}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            Registrar Amortización de {formatCurrency(validAmount ? amount : 0)}
          </button>
        </div>
      </div>
    </div>
  );
};
