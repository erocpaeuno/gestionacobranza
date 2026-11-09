import React, { useState, useMemo } from 'react';
import {
  Search,
  User,
  Phone,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Filter,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Cliente, Prestamo, Cuota, User as AuthUser } from '../types';
import { formatCurrency } from '../utils/storage';
import { cleanPhoneNumber } from '../utils/whatsapp';

interface ClientsDashboardProps {
  clientes: Cliente[];
  prestamos: Prestamo[];
  cuotas: Cuota[];
  currentUser?: AuthUser | null;
  usuarios?: AuthUser[];
  canCollect?: boolean;
  onSelectCliente: (cliente: Cliente) => void;
  onQuickPay: (cliente: Cliente, prestamo: Prestamo) => void;
}

export const ClientsDashboard: React.FC<ClientsDashboardProps> = ({
  clientes,
  prestamos,
  cuotas,
  currentUser,
  usuarios = [],
  canCollect = false,
  onSelectCliente,
  onQuickPay,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'OVERDUE' | 'ACTIVE'>('ALL');
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<number | 'ALL'>('ALL');

  const isAdmin = currentUser?.rol === 'admin';

  // Map of client stats
  const clientStats = useMemo(() => {
    return clientes.map((cliente) => {
      const clientLoans = prestamos.filter((p) => p.cliente_dni === cliente.dni);
      const activeLoan = clientLoans.find((p) => p.estado === 'ACTIVO') || clientLoans[0];
      const activeLoans = clientLoans.filter((p) => p.estado === 'ACTIVO');
      const loansForStats = activeLoans.length > 0 ? activeLoans : activeLoan ? [activeLoan] : [];
      const loanIdsForStats = new Set(loansForStats.map((loan) => Number(loan.id)));

      if (!activeLoan) {
        return {
          cliente,
          clientLoans,
          activeLoan: null,
          totalCuotas: 0,
          paidCuotasCount: 0,
          overdueCuotasCount: 0,
          pendingDebt: 0,
          hasOverdue: false,
        };
      }

      const loanCuotas = cuotas.filter((c) => loanIdsForStats.has(Number(c.prestamo_id)));
      const paid = loanCuotas.filter((c) => c.estado === 'PAGADO');
      const overdue = loanCuotas.filter((c) => c.estado === 'VENCIDO');
      const pendingDebt = loanCuotas
        .filter((c) => c.estado !== 'PAGADO')
        .reduce((acc, c) => acc + (c.monto - c.monto_pagado) + c.mora, 0);

      return {
        cliente,
        clientLoans,
        activeLoan,
        totalCuotas: loanCuotas.length,
        paidCuotasCount: paid.length,
        overdueCuotasCount: overdue.length,
        pendingDebt,
        hasOverdue: overdue.length > 0,
      };
    });
  }, [clientes, prestamos, cuotas]);

  // Overall dashboard metrics
  const totalOverdueClients = clientStats.filter((c) => c.hasOverdue).length;
  const totalGlobalDebt = clientStats.reduce((acc, c) => acc + c.pendingDebt, 0);

  // Filter clients
  const filteredList = useMemo(() => {
    return clientStats.filter(({ cliente, clientLoans, hasOverdue, activeLoan }) => {
      // Role & Advisor filter for admin
      if (isAdmin && selectedAdvisorId !== 'ALL') {
        const assignedToAdvisor =
          Number(cliente.user_id) === selectedAdvisorId ||
          clientLoans.some((loan) => Number(loan.user_id) === selectedAdvisorId);
        if (!assignedToAdvisor) return false;
      }

      const matchSearch =
        String(cliente.nombres || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(cliente.apellidos || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(cliente.dni || '').includes(searchTerm) ||
        String(cliente.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activeLoan && String(activeLoan.id || '').toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (filterMode === 'OVERDUE') return hasOverdue;
      if (filterMode === 'ACTIVE') return activeLoan?.estado === 'ACTIVO';
      return true;
    });
  }, [clientStats, searchTerm, filterMode, isAdmin, selectedAdvisorId]);

  return (
    <div className="space-y-3 pb-20">
      {/* Role Notice & Advisor Switcher for Admin */}
      {isAdmin ? (
        <div className="p-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-900/50 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Modo Administrador • Vista Global</span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
              Todos los créditos
            </span>
          </div>

          {usuarios.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              <span className="text-[11px] text-slate-400 shrink-0 font-medium">Filtrar:</span>
              <button
                onClick={() => setSelectedAdvisorId('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedAdvisorId === 'ALL'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                Todos ({clientes.length})
              </button>
              {usuarios.map((u) => {
                const count = clientStats.filter(
                  (c) =>
                    Number(c.cliente.user_id) === u.id ||
                    c.clientLoans.some((loan) => Number(loan.user_id) === u.id)
                ).length;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedAdvisorId(u.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                      selectedAdvisorId === u.id
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{u.usuario}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-emerald-950/40 text-emerald-200 border border-emerald-800/40 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">
              Créditos de: <strong className="text-white">{currentUser?.nombre || currentUser?.usuario}</strong>
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
            {clientes.length} clientes
          </span>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Cartera por Cobrar
          </span>
          <span className="text-xl font-black text-emerald-400 block mt-0.5">
            {formatCurrency(totalGlobalDebt)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {filteredList.length} clientes en ruta
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Alertas de Mora
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-xl font-black ${totalOverdueClients > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {totalOverdueClients}
            </span>
            <span className="text-xs text-slate-600 font-medium">con atraso</span>
          </div>
          <span className="text-[10px] text-rose-600 font-medium mt-1 block">
            {totalOverdueClients > 0 ? 'Requiere gestión hoy' : 'Sin clientes en mora'}
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          id="search-client-input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nombre, DNI o N° crédito..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 shadow-2xs"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setFilterMode('ALL')}
          className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
            filterMode === 'ALL'
              ? 'bg-slate-800 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          Todos ({clientStats.length})
        </button>
        <button
          onClick={() => setFilterMode('OVERDUE')}
          className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
            filterMode === 'OVERDUE'
              ? 'bg-rose-600 text-white'
              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Con Vencidas ({totalOverdueClients})
        </button>
        <button
          onClick={() => setFilterMode('ACTIVE')}
          className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
            filterMode === 'ACTIVE'
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          Préstamos Activos
        </button>
      </div>

      {/* Clients Cards List */}
      <div className="space-y-2.5">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
            <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">No se encontraron clientes</p>
            <p className="text-xs text-slate-400 mt-0.5">Prueba con otro término de búsqueda.</p>
          </div>
        ) : (
          filteredList.map(({ cliente, activeLoan, totalCuotas, paidCuotasCount, overdueCuotasCount, pendingDebt, hasOverdue }) => {
            return (
              <div
                key={cliente.codigo}
                onClick={() => onSelectCliente(cliente)}
                className={`bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-xs cursor-pointer p-3.5 space-y-2.5 ${
                  hasOverdue ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top Row: Name, DNI, Status badge */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {cliente.nombres || cliente.apellidos
                          ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()
                          : 'Cliente sin nombre registrado'}
                      </h4>
                      {hasOverdue && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold text-[10px] rounded-md">
                          Mora ({overdueCuotasCount})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      DNI: {cliente.dni} • Cod: {cliente.codigo}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 block">
                      {formatCurrency(pendingDebt)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Saldo pendiente
                    </span>
                  </div>
                </div>

                {/* Loan status summary */}
                {activeLoan ? (
                  <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">
                        {activeLoan.id}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600 font-medium">
                        {activeLoan.tipo_credito}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-emerald-700">
                        {paidCuotasCount}/{totalCuotas} cuotas
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sin préstamo activo</p>
                )}

                {/* Advisor chip if admin */}
                {isAdmin && (
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg w-fit">
                    <User className="w-3 h-3 text-indigo-500" />
                    <span>Asignado a:</span>
                    <strong className="text-slate-800">
                      {activeLoan?.owner_name || cliente.owner_name || 'Sin asignar'}
                    </strong>
                    <span className="text-slate-400 font-mono">
                      (@{activeLoan?.owner_username || cliente.owner_username || 'sin-usuario'})
                    </span>
                  </div>
                )}

                {/* Card Quick Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {cliente.telefono && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const clean = cleanPhoneNumber(cliente.telefono);
                          if (clean) window.open(`https://api.whatsapp.com/send?phone=${clean}`, '_blank');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 p-1 rounded-md hover:bg-emerald-50"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canCollect && activeLoan && activeLoan.estado === 'ACTIVO' && pendingDebt > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickPay(cliente, activeLoan);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 active:scale-95"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Cobrar
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCliente(cliente);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-0.5"
                    >
                      Detalle
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
