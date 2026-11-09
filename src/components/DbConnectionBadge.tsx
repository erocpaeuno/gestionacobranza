import React from 'react';
import { Database, RefreshCw, AlertCircle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { DbStatusResponse } from '../services/api';

interface DbConnectionBadgeProps {
  status: DbStatusResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenModal: () => void;
}

export const DbConnectionBadge: React.FC<DbConnectionBadgeProps> = ({
  status,
  loading,
  onRefresh,
  onOpenModal,
}) => {
  const isConnected = status?.connected ?? false;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenModal}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm ${
          isConnected
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
        }`}
        title="Clic para ver detalles de la conexión a la Base de Datos"
      >
        <span className="relative flex h-2 w-2">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          ></span>
        </span>

        <Database className="w-3.5 h-3.5" />

        <div className="flex items-center gap-1.5">
          <span className="font-semibold tracking-wide">
            {isConnected ? 'gestion_prestamos' : 'BD Desconectada'}
          </span>
          {isConnected && status?.pingMs !== undefined && (
            <span className="text-[10px] opacity-75 hidden sm:inline bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {status.pingMs}ms
            </span>
          )}
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRefresh();
        }}
        disabled={loading}
        className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all disabled:opacity-50"
        title="Sincronizar y recargar datos desde Supabase"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
      </button>
    </div>
  );
};
