import React from 'react';
import {
  Database,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Users,
  CreditCard,
  Layers,
  DollarSign,
  Activity,
  HardDrive,
  Info,
} from 'lucide-react';
import { DbStatusResponse } from '../services/api';

interface DbSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DbStatusResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const DbSettingsModal: React.FC<DbSettingsModalProps> = ({
  isOpen,
  onClose,
  status,
  loading,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const isConnected = status?.connected ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Conexión a Base de Datos
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {isConnected ? 'EN LÍNEA (SUPABASE)' : 'DESCONECTADA'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Sincronización en tiempo real con Supabase PostgreSQL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Connection Status Card */}
          <div
            className={`p-4 rounded-xl border ${
              isConnected
                ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                : 'bg-rose-950/20 border-rose-800/40 text-slate-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {isConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs space-y-1">
                <p className="font-semibold text-sm text-white">
                  {isConnected
                    ? 'Conexión activa con Supabase'
                    : 'No se pudo conectar a la base de datos'}
                </p>
                <p className="text-slate-300">
                  {isConnected
                    ? 'Todos los datos se están extrayendo y guardando directamente en Supabase.'
                    : status?.error ||
                      'Verifica la URL de conexión de Supabase y que la base de datos esté disponible.'}
                </p>
              </div>
            </div>
          </div>

          {/* Database Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block mb-1">Base de Datos</span>
              <span className="text-white font-mono font-bold text-sm flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                {status?.database || 'postgres'}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block mb-1">Host y Puerto</span>
              <span className="text-white font-mono font-bold text-sm flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-blue-400" />
                {status?.host || 'Supabase'}:{status?.port || 5432}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block mb-1">Usuario de base de datos</span>
              <span className="text-white font-mono font-semibold">
                {status?.user || 'Supabase'}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block mb-1">Latencia / Ping</span>
              <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                {status?.pingMs !== undefined ? `${status.pingMs} ms` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Live Records Counts in Supabase */}
          {isConnected && status?.counts && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Registros en Tiempo Real en Supabase
              </h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60 text-center">
                  <Users className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
                  <span className="text-lg font-bold text-white block">
                    {status.counts.clientes}
                  </span>
                  <span className="text-[10px] text-slate-400">Clientes</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60 text-center">
                  <CreditCard className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                  <span className="text-lg font-bold text-white block">
                    {status.counts.prestamos}
                  </span>
                  <span className="text-[10px] text-slate-400">Préstamos</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60 text-center">
                  <Layers className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                  <span className="text-lg font-bold text-white block">
                    {status.counts.cuotas}
                  </span>
                  <span className="text-[10px] text-slate-400">Cuotas</span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60 text-center">
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                  <span className="text-lg font-bold text-white block">
                    {status.counts.pagos}
                  </span>
                  <span className="text-[10px] text-slate-400">Pagos</span>
                </div>
              </div>
            </div>
          )}

          {/* Notice / Help Info */}
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3.5 text-xs text-indigo-200/90 flex gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Sincronización Automática</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Cualquier pago, cuota cobrada, anulación o amortización realizada se guarda
                directamente en las tablas de tu base de datos Supabase PostgreSQL.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <span className="text-[11px] text-slate-400">
            Motor: <strong className="text-slate-200">Supabase PostgreSQL</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Sincronizando...' : 'Sincronizar Datos Reales'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
