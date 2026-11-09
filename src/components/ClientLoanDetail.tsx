import React, { useState } from 'react';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  TrendingDown,
  Award,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { Cliente, Prestamo, Cuota } from '../types';
import { formatCurrency, formatDate } from '../utils/storage';
import { cleanPhoneNumber } from '../utils/whatsapp';

interface ClientLoanDetailProps {
  cliente: Cliente;
  prestamos: Prestamo[];
  cuotas: Cuota[];
  canPay: boolean;
  canAmortize: boolean;
  canCancel: boolean;
  onBack: () => void;
  onOpenPayCuotas: (prestamo: Prestamo) => void;
  onOpenAmortization: (prestamo: Prestamo) => void;
  onOpenCancellation: (prestamo: Prestamo) => void;
}

export const ClientLoanDetail: React.FC<ClientLoanDetailProps> = ({
  cliente,
  prestamos,
  cuotas,
  canPay,
  canAmortize,
  canCancel,
  onBack,
  onOpenPayCuotas,
  onOpenAmortization,
  onOpenCancellation,
}) => {
  // Client's loans
  const clientLoans = prestamos.filter((p) => p.cliente_dni === cliente.dni);
  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    clientLoans.length > 0 ? clientLoans[0].id : ''
  );

  const activeLoan = clientLoans.find((p) => p.id === selectedLoanId) || clientLoans[0];

  // Cuotas for selected loan
  const loanCuotas = activeLoan
    ? cuotas
        .filter((c) => c.prestamo_id === activeLoan.id)
        .sort((a, b) => a.numero - b.numero)
    : [];

  const paidCuotas = loanCuotas.filter((c) => c.estado === 'PAGADO');
  const pendingCuotas = loanCuotas.filter((c) => c.estado !== 'PAGADO');
  const overdueCuotas = loanCuotas.filter((c) => c.estado === 'VENCIDO');

  const totalLoanAmount = loanCuotas.reduce((acc, c) => acc + c.monto, 0);
  const totalPaidAmount = loanCuotas.reduce((acc, c) => acc + c.monto_pagado, 0);
  const remainingDebt = totalLoanAmount - totalPaidAmount;
  const progressPercent = totalLoanAmount > 0 ? Math.round((totalPaidAmount / totalLoanAmount) * 100) : 0;

  const handleWhatsAppChat = () => {
    const clean = cleanPhoneNumber(cliente.telefono);
    if (clean) {
      window.open(`https://api.whatsapp.com/send?phone=${clean}`, '_blank');
    }
  };

  const handleCall = () => {
    if (cliente.telefono) {
      window.location.href = `tel:${cliente.telefono}`;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            {cliente.nombres} {cliente.apellidos}
          </h2>
          <p className="text-xs text-slate-500 font-mono">DNI: {cliente.dni} • Cod: {cliente.codigo}</p>
        </div>
      </div>

      {/* Client Quick Info Card */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 truncate max-w-[210px]">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{cliente.direccion || 'Sin dirección registrada'}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleWhatsAppChat}
              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              title="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              onClick={handleCall}
              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              title="Llamar"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>
        </div>

        {cliente.saldo_a_favor > 0 && (
          <div className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs text-indigo-900">
            <span className="flex items-center gap-1 font-medium">
              <Coins className="w-3.5 h-3.5 text-indigo-600" />
              Saldo a favor del cliente:
            </span>
            <span className="font-bold">{formatCurrency(cliente.saldo_a_favor)}</span>
          </div>
        )}
      </div>

      {/* Loan Selector Tabs if multiple */}
      {clientLoans.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
          {clientLoans.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLoanId(l.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                l.id === activeLoan?.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {l.id} ({l.tipo_credito})
            </button>
          ))}
        </div>
      )}

      {/* Selected Loan Card */}
      {activeLoan ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Loan Card Header */}
          <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">
                  Préstamo {activeLoan.tipo_credito}
                </span>
                <h3 className="text-xl font-extrabold tracking-tight">{activeLoan.id}</h3>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  activeLoan.estado === 'ACTIVO'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {activeLoan.estado}
              </span>
            </div>

            {/* Loan Numbers Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-700/60">
              <div>
                <span className="text-slate-400 text-[10px] block">Monto Capital</span>
                <span className="font-bold">{formatCurrency(activeLoan.monto)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Interés</span>
                <span className="font-bold">{(activeLoan.interes * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Total Crédito</span>
                <span className="font-bold">{formatCurrency(totalLoanAmount)}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">
                  {paidCuotas.length} de {loanCuotas.length} cuotas pagadas
                </span>
                <span className="font-bold text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Pending Debt & Overdue Alert */}
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block font-medium">Saldo actual de la deuda:</span>
                <span className="text-xl font-black text-slate-900">
                  {formatCurrency(remainingDebt)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Total préstamo: {formatCurrency(totalLoanAmount)} • Total pagado/amortizado: {formatCurrency(totalPaidAmount)}
                </span>
              </div>
              {overdueCuotas.length > 0 ? (
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 font-bold text-xs rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {overdueCuotas.length} vencida(s)
                  </span>
                </div>
              ) : (
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Al día
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Core Action Buttons */}
          {activeLoan.estado === 'ACTIVO' && remainingDebt > 0 ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white">
              {/* Pagar Cuota(s) */}
              {canPay && <button
                id="open-pay-cuotas-btn"
                onClick={() => onOpenPayCuotas(activeLoan)}
                className="w-full py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Pagar Cuota(s)
              </button>}

              {/* Amortización */}
              {canAmortize && <button
                id="open-amortization-btn"
                onClick={() => onOpenAmortization(activeLoan)}
                className="w-full py-3 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <TrendingDown className="w-4 h-4" />
                Amortización
              </button>}

              {/* Cancelación */}
              {canCancel && <button
                id="open-cancellation-btn"
                onClick={() => onOpenCancellation(activeLoan)}
                className="w-full py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                Cancelar Préstamo
              </button>}
            </div>
          ) : (
            <div className="p-4 text-center bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              Este préstamo está completamente CANCELADO / TERMINADO
            </div>
          )}

          {/* Schedule / Cronograma Header */}
          <div className="px-4 py-3 bg-slate-100/70 border-t border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Cronograma de Pagos ({loanCuotas.length} Cuotas)
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Restan {pendingCuotas.length} cuotas
            </span>
          </div>

          {/* Installment List */}
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {loanCuotas.map((cuota) => {
              const isPaid = cuota.estado === 'PAGADO';
              const isOverdue = cuota.estado === 'VENCIDO';
              const isAmortizada = cuota.monto_pagado > 0 && cuota.estado !== 'PAGADO';
              const saldoActualCuota = Math.max(0, cuota.monto - cuota.monto_pagado);

              return (
                <div
                  key={cuota.id}
                  className={`p-3 flex items-center justify-between text-xs transition-colors ${
                    isPaid
                      ? 'bg-slate-50/50'
                      : isAmortizada
                      ? 'bg-indigo-50/40'
                      : isOverdue
                      ? 'bg-rose-50/40'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-700'
                          : isAmortizada
                          ? 'bg-indigo-100 text-indigo-700'
                          : isOverdue
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isPaid ? <CheckCircle2 className="w-4 h-4" /> : `#${cuota.numero}`}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          Cuota #{cuota.numero}
                        </span>
                        {isPaid && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            PAGADA
                          </span>
                        )}
                        {isAmortizada && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            AMORTIZADA (-{formatCurrency(cuota.monto_pagado)})
                          </span>
                        )}
                        {isOverdue && !isAmortizada && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            VENCIDA ({cuota.dias_atraso}d)
                          </span>
                        )}
                        {!isPaid && !isOverdue && !isAmortizada && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            Pendiente
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isPaid
                          ? `Pagado el: ${formatDate(cuota.fecha_pago_real || '')}`
                          : `Vence: ${formatDate(cuota.fecha_vencimiento)}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {isAmortizada ? (
                      <div>
                        <span className="text-[10px] text-slate-400 block line-through">
                          Orig: {formatCurrency(cuota.monto)}
                        </span>
                        <div className="font-black text-indigo-700 text-sm">
                          Saldo actual: {formatCurrency(saldoActualCuota)}
                        </div>
                      </div>
                    ) : isPaid ? (
                      <div>
                        <div className="font-bold text-slate-700">
                          {formatCurrency(cuota.monto)}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-semibold block">
                          Pagada 100%
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900">
                          {formatCurrency(cuota.monto)}
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Saldo actual: {formatCurrency(cuota.monto)}
                        </span>
                      </div>
                    )}

                    {isOverdue && cuota.mora > 0 && (
                      <div className="text-[10px] font-semibold text-rose-600">
                        +Mora: {formatCurrency(cuota.mora)}
                      </div>
                    )}
                    {canPay && !isPaid && activeLoan.estado === 'ACTIVO' && (
                      <button
                        onClick={() => onOpenPayCuotas(activeLoan)}
                        className="mt-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5"
                      >
                        Cobrar <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl text-center text-slate-500 border border-slate-200">
          <CreditCard className="w-10 h-10 mx-auto text-slate-400 mb-2" />
          <p className="font-semibold text-slate-700">Sin préstamos registrados</p>
          <p className="text-xs text-slate-400">Este cliente aún no tiene un préstamo asignado.</p>
        </div>
      )}
    </div>
  );
};
