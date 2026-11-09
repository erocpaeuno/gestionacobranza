import React, { useState, useMemo } from 'react';
import { X, Award, Check, Percent, Coins, AlertCircle } from 'lucide-react';
import { Cliente, Prestamo, Cuota, ReciboGenerado } from '../types';
import { formatCurrency, getNowDateTimeString, getTodayDateString } from '../utils/storage';

interface CancelLoanModalProps {
  cliente: Cliente;
  prestamo: Prestamo;
  cuotas: Cuota[];
  onClose: () => void;
  onSuccess: (recibo: ReciboGenerado, updatedCuotas: Cuota[], updatedCliente: Cliente, updatedPrestamo: Prestamo) => void;
}

export const CancelLoanModal: React.FC<CancelLoanModalProps> = ({
  cliente,
  prestamo,
  cuotas,
  onClose,
  onSuccess,
}) => {
  const pendingCuotas = useMemo(() => {
    return cuotas
      .filter((c) => c.prestamo_id === prestamo.id && c.estado !== 'PAGADO')
      .sort((a, b) => a.numero - b.numero);
  }, [cuotas, prestamo.id]);

  // Total raw balance
  const rawBalance = useMemo(() => {
    return pendingCuotas.reduce((acc, c) => acc + (c.monto - c.monto_pagado) + c.mora, 0);
  }, [pendingCuotas]);

  // Optional discount (rebaja por pronto pago / condonación de intereses futuros)
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [useSaldoFavor, setUseSaldoFavor] = useState(cliente.saldo_a_favor > 0);

  const discount = Math.max(0, parseFloat(discountInput) || 0);
  const subtotalAfterDiscount = Math.max(0, rawBalance - discount);

  const appliedSaldoFavor = useMemo(() => {
    if (!useSaldoFavor || cliente.saldo_a_favor <= 0) return 0;
    return Math.min(cliente.saldo_a_favor, subtotalAfterDiscount);
  }, [useSaldoFavor, cliente.saldo_a_favor, subtotalAfterDiscount]);

  const finalAmountToPay = Math.max(0, subtotalAfterDiscount - appliedSaldoFavor);

  const handleConfirmCancellation = () => {
    const today = getTodayDateString();
    const nowDateTime = getNowDateTimeString();
    const receiptId = `REC-LIQ-${Date.now().toString().slice(-6)}`;

    // Mark all cuotas for this loan as PAGADO
    const updatedCuotas = cuotas.map((c) => {
      if (c.prestamo_id === prestamo.id && c.estado !== 'PAGADO') {
        return {
          ...c,
          monto_pagado: c.monto,
          estado: 'PAGADO' as const,
          fecha_pago_real: today,
        };
      }
      return c;
    });

    const updatedPrestamo: Prestamo = {
      ...prestamo,
      estado: 'TERMINADO',
      fecha_modificacion: `${today} ${new Date().toLocaleTimeString()}`,
    };

    const updatedCliente: Cliente = {
      ...cliente,
      saldo_a_favor: Math.max(0, cliente.saldo_a_favor - appliedSaldoFavor),
    };

    const recibo: ReciboGenerado = {
      id: receiptId,
      fecha_hora: nowDateTime,
      cliente: updatedCliente,
      prestamo: updatedPrestamo,
      tipo_operacion: 'CANCELACION',
      cuotas_afectadas: pendingCuotas.map((c) => ({
        id: c.id,
        numero: c.numero,
        monto: c.monto,
        mora: c.mora,
        total: c.monto,
      })),
      total_cuotas: rawBalance,
      total_mora: 0,
      saldo_favor_usado: appliedSaldoFavor,
      total_cobrado: finalAmountToPay,
      saldo_restante_prestamo: 0,
      cuotas_restantes: 0,
      proximo_vencimiento: null,
      observaciones: discount > 0 ? `Descuento por liquidación aplicado: ${formatCurrency(discount)}` : 'Cancelación total definitiva',
    };

    onSuccess(recibo, updatedCuotas, updatedCliente, updatedPrestamo);
  };

  return (
    <div
      id="cancel-loan-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Cancelación Total / Liquidación
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
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Cuotas por liquidar:</span>
              <span className="font-bold text-slate-900 text-sm">
                {pendingCuotas.length} cuotas pendientes
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Deuda total insoluta:</span>
              <span className="font-black text-slate-900 text-base">
                {formatCurrency(rawBalance)}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 pt-1 border-t border-emerald-200">
              Al confirmar, todas las cuotas quedarán 100% liquidadas y el estado del préstamo pasará a <strong>TERMINADO</strong>.
            </p>
          </div>

          {/* Discount input (pronto pago) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-slate-500" />
                Descuento Especial / Rebaja de Interés (Opcional):
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                step="5"
                min="0"
                max={rawBalance}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-base focus:outline-hidden focus:border-emerald-600"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Premia la cancelación anticipada rebajando parte del interés.
            </p>
          </div>

          {/* Saldo a favor option */}
          {cliente.saldo_a_favor > 0 && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-indigo-900 block">
                    Saldo a favor: {formatCurrency(cliente.saldo_a_favor)}
                  </span>
                  <span className="text-indigo-700 text-[11px]">
                    Descontar de la liquidación
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

          {/* Detailed Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Saldo total sin descuento:</span>
              <span className="font-medium text-slate-900">{formatCurrency(rawBalance)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Rebaja por pronta liquidación:</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            {appliedSaldoFavor > 0 && (
              <div className="flex justify-between text-indigo-700 font-semibold">
                <span>Saldo a favor aplicado:</span>
                <span>-{formatCurrency(appliedSaldoFavor)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-slate-200 text-slate-900">
              <span>MONTO FINAL A LIQUIDAR:</span>
              <span className="text-lg text-emerald-600">
                {formatCurrency(finalAmountToPay)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            id="confirm-cancel-loan-btn"
            onClick={handleConfirmCancellation}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            Liquidar y Cancelar Préstamo ({formatCurrency(finalAmountToPay)})
          </button>
        </div>
      </div>
    </div>
  );
};
