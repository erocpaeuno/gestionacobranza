import React, { useState } from 'react';
import { Printer, Share2, Check, X, Phone, Copy } from 'lucide-react';
import { ReciboGenerado, UsuarioConfig } from '../types';
import { formatCurrency } from '../utils/storage';
import { generateWhatsAppMessage, getWhatsAppUrl, cleanPhoneNumber } from '../utils/whatsapp';

interface ReceiptModalProps {
  recibo: ReciboGenerado | null;
  config: UsuarioConfig;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  recibo,
  config,
  onClose,
}) => {
  if (!recibo) return null;

  const [customPhone, setCustomPhone] = useState(
    recibo.cliente.telefono || ''
  );
  const [copied, setCopied] = useState(false);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);

  const messageText = generateWhatsAppMessage(recibo, config);
  const whatsappUrl = getWhatsAppUrl(customPhone, messageText);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      id="receipt-modal-container"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h3 className="font-bold text-sm tracking-wide">Comprobante de Pago</h3>
          </div>
          <button
            id="close-receipt-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-4 overflow-y-auto grow bg-slate-100/70">
          {/* Action Buttons for Mobile */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              id="print-receipt-btn"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              Imprimir Ticket
            </button>
            <button
              id="whatsapp-share-btn"
              onClick={handleOpenWhatsApp}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4 text-white" />
              Enviar WhatsApp
            </button>
          </div>

          {/* Quick Phone change for WhatsApp */}
          <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                Destino WhatsApp:
              </span>
              <button
                onClick={() => setShowPhoneEdit(!showPhoneEdit)}
                className="text-emerald-700 hover:underline font-semibold"
              >
                {showPhoneEdit ? 'Ocultar' : 'Cambiar N°'}
              </button>
            </div>
            {showPhoneEdit ? (
              <div className="mt-2 flex gap-2">
                <input
                  id="whatsapp-custom-phone-input"
                  type="text"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="Ej: +51987654321"
                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-800 font-mono text-xs focus:outline-emerald-500"
                />
                <button
                  onClick={() => setShowPhoneEdit(false)}
                  className="px-2.5 py-1.5 bg-emerald-600 text-white font-medium rounded-lg"
                >
                  OK
                </button>
              </div>
            ) : (
              <p className="text-slate-600 font-mono font-medium mt-0.5">
                {customPhone || 'Sin número registrado'}
              </p>
            )}
          </div>

          {/* The Physical Receipt Simulation (also print target) */}
          <div
            id="printable-receipt"
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm font-['JetBrains_Mono',monospace] text-slate-800 text-xs leading-relaxed"
          >
            {/* Header / Brand */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                {config.nombre_marca}
              </h2>
              {config.direccion && (
                <p className="text-[11px] text-slate-600 mt-0.5">{config.direccion}</p>
              )}
              {config.telefono && (
                <p className="text-[11px] text-slate-600">Tel: {config.telefono}</p>
              )}
              <div className="inline-block mt-1 px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-bold tracking-widest uppercase">
                {recibo.tipo_operacion === 'CUOTA'
                  ? 'RECIBO DE CUOTA'
                  : recibo.tipo_operacion === 'AMORTIZACION'
                  ? 'AMORTIZACIÓN'
                  : 'CANCELACIÓN TOTAL'}
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Recibo N°:</span>
                <span className="font-bold text-slate-900">{recibo.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha/Hora:</span>
                <span className="font-medium text-slate-800">{recibo.fecha_hora}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cobrador:</span>
                <span className="text-slate-800">{config.representante || 'Caja'}</span>
              </div>
            </div>

            {/* Client Info */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-900 text-right">
                  {recibo.cliente.nombres} {recibo.cliente.apellidos}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DNI:</span>
                <span className="font-medium text-slate-800">{recibo.cliente.dni}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Préstamo:</span>
                <span className="font-bold text-slate-900">
                  {recibo.prestamo.id} ({recibo.prestamo.tipo_credito})
                </span>
              </div>
            </div>

            {/* Breakdown of items */}
            <div className="py-3 border-b border-dashed border-slate-300">
              <div className="font-bold text-slate-900 mb-1.5 text-[11px] uppercase tracking-wider">
                Detalle de Operación
              </div>

              {recibo.tipo_operacion === 'CUOTA' ? (
                <div className="space-y-1.5">
                  {recibo.cuotas_afectadas.map((c) => (
                    <div
                      key={c.numero}
                      className="flex justify-between text-[11px] items-center"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          Cuota #{c.numero}
                        </span>
                        {c.mora > 0 && (
                          <span className="text-[10px] text-amber-600 block">
                            (Inc. Mora: {formatCurrency(c.mora)})
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(c.total)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : recibo.tipo_operacion === 'AMORTIZACION' ? (
                <div className="py-1 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium text-slate-700">Monto Amortizado:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(recibo.total_cobrado)}
                    </span>
                  </div>
                  {recibo.cuotas_afectadas && recibo.cuotas_afectadas.length > 0 && (
                    <div className="pt-1.5 border-t border-dashed border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-indigo-900 block">
                        Cuotas Amortizadas y Saldo Actual:
                      </span>
                      {recibo.cuotas_afectadas.map((c) => (
                        <div key={c.numero} className="flex justify-between text-[10px] text-slate-700 bg-slate-50 p-1.5 rounded">
                          <span>Cuota #{c.numero} (Abono: {formatCurrency(c.monto)})</span>
                          <span className="font-bold text-indigo-700">
                            {c.saldo_actual === 0 ? 'Liquidada (Saldo: $0.00)' : `Saldo actual: ${formatCurrency(c.saldo_actual || 0)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {recibo.observaciones && (
                    <p className="text-[10px] text-slate-500 mt-1 italic">
                      {recibo.observaciones}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium text-slate-700">Liquidación Total:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(recibo.total_cobrado)}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                    Préstamo cancelado en su totalidad.
                  </p>
                </div>
              )}
            </div>

            {/* Totals Summary */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              {recibo.total_mora > 0 && recibo.tipo_operacion === 'CUOTA' && (
                <div className="flex justify-between text-amber-700">
                  <span>Mora por atraso:</span>
                  <span className="font-medium">+{formatCurrency(recibo.total_mora)}</span>
                </div>
              )}
              {recibo.saldo_favor_usado > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Saldo a favor aplicado:</span>
                  <span className="font-medium">-{formatCurrency(recibo.saldo_favor_usado)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-black pt-1 text-slate-950 border-t border-slate-200">
                <span>TOTAL COBRADO:</span>
                <span className="text-base">{formatCurrency(recibo.total_cobrado)}</span>
              </div>
            </div>

            {/* Loan Status After Payment */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px] bg-slate-50/70 p-2 rounded my-2">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Saldo Actual del Crédito:</span>
                <span className="font-black text-slate-900">
                  {formatCurrency(recibo.saldo_restante_prestamo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Cuotas Pendientes:</span>
                <span className="font-semibold text-slate-800">
                  {recibo.cuotas_restantes} cuota(s)
                </span>
              </div>
              {recibo.proximo_vencimiento && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Próximo Vencimiento:</span>
                  <span className="font-semibold text-indigo-700">
                    {recibo.proximo_vencimiento}
                  </span>
                </div>
              )}
            </div>

            {/* Signatures */}
            <div className="pt-6 pb-2 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500">
              <div>
                <div className="border-t border-slate-400 pt-1">Firma Cobrador</div>
                <div className="text-[9px] text-slate-400">
                  {config.representante || 'Agente'}
                </div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1">Firma Cliente</div>
                <div className="text-[9px] text-slate-400">Conforme</div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-2 text-[10px] text-slate-500">
              <p>¡Gracias por su puntualidad!</p>
              <p className="text-[9px] text-slate-400 mt-0.5">
                Conserve este comprobante como constancia válida de pago.
              </p>
            </div>
          </div>

          {/* Copy plain text option */}
          <div className="mt-3 flex justify-center">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-medium shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">¡Texto copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar texto de recibo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
