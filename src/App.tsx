import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Receipt,
  Settings,
  Smartphone,
  Maximize2,
  DollarSign,
  TrendingDown,
  Award,
  CheckCircle,
  Building2,
  Share2,
  Printer,
  RotateCcw,
  Database,
  RefreshCw,
  LogOut,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { Cliente, Prestamo, Cuota, Pago, UsuarioConfig, ReciboGenerado, User } from './types';
import {
  getStoredData,
  saveStoredData,
  resetDatabase,
  formatCurrency,
  getTodayDateString,
  getStoredUser,
  setStoredUser,
  removeStoredUser,
} from './utils/storage';
import { api, DbStatusResponse } from './services/api';
import { ClientsDashboard } from './components/ClientsDashboard';
import { ClientLoanDetail } from './components/ClientLoanDetail';
import { PayInstallmentsModal } from './components/PayInstallmentsModal';
import { AmortizationModal } from './components/AmortizationModal';
import { CancelLoanModal } from './components/CancelLoanModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ReceiptsHistory } from './components/ReceiptsHistory';
import { ConfigModal } from './components/ConfigModal';
import { DbConnectionBadge } from './components/DbConnectionBadge';
import { DbSettingsModal } from './components/DbSettingsModal';
import { LoginScreen } from './components/LoginScreen';

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [usuariosList, setUsuariosList] = useState<User[]>([]);

  // Local state initialized from cache/defaults
  const [data, setData] = useState(() => getStoredData(currentUser));
  const [activeTab, setActiveTab] = useState<'CLIENTS' | 'HISTORY' | 'SETTINGS'>('CLIENTS');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  // Database Connection State
  const [dbStatus, setDbStatus] = useState<DbStatusResponse | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);

  // Modals state
  const [activePayModal, setActivePayModal] = useState<{
    cliente: Cliente;
    prestamo: Prestamo;
  } | null>(null);

  const [activeAmortModal, setActiveAmortModal] = useState<{
    cliente: Cliente;
    prestamo: Prestamo;
  } | null>(null);

  const [activeCancelModal, setActiveCancelModal] = useState<{
    cliente: Cliente;
    prestamo: Prestamo;
  } | null>(null);

  const [currentReceipt, setCurrentReceipt] = useState<ReciboGenerado | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // View frame mode: smartphone container or full width
  const [isMobileFrame, setIsMobileFrame] = useState(true);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 🔄 Sincronización y Carga de Datos según Rol y Usuario
  const syncWithDatabase = useCallback(
    async (isInitial = false, userOverride?: User | null) => {
      const activeUser = userOverride !== undefined ? userOverride : currentUser;
      if (!activeUser) return;

      setDbLoading(true);
      try {
        const statusRes = await api.getStatus();
        setDbStatus(statusRes);

        if (statusRes.error?.includes('Sesión inválida') || statusRes.error?.includes('cuenta o empresa está inactiva')) {
          removeStoredUser();
          setCurrentUser(null);
          setData(getStoredData(null));
          setUsuariosList([]);
          setSelectedCliente(null);
          setCurrentReceipt(null);
          setActivePayModal(null);
          setActiveAmortModal(null);
          setActiveCancelModal(null);
          setActiveTab('CLIENTS');
          return;
        }

        if (statusRes.connected) {
          const realDataRes = await api.fetchRealData();
          if (realDataRes.success && realDataRes.data) {
            const dbData = realDataRes.data;

            setData((prev) => {
              const updated = {
                ...prev,
                clientes: dbData.clientes || prev.clientes,
                prestamos: dbData.prestamos || prev.prestamos,
                cuotas: dbData.cuotas || prev.cuotas,
                pagos: dbData.pagos || prev.pagos,
                config: dbData.config || prev.config,
              };
              saveStoredData(updated);
              return updated;
            });

            if (!isInitial) {
              showToast(`✅ Datos sincronizados para ${activeUser.empresa_nombre || activeUser.nombre_rol || activeUser.usuario}`);
            }
          } else if (!isInitial && realDataRes.error) {
            showToast(realDataRes.error);
          }

          // Si es admin, cargar la lista de todos los usuarios
          if (activeUser.rol === 'admin' && activeUser.permisos_modulos?.includes('usuarios')) {
            const usersRes = await api.getUsuarios();
            if (usersRes.success && usersRes.data) {
              setUsuariosList(usersRes.data);
            }
          }
        } else {
          if (!isInitial) {
            showToast(`⚠️ No conectado a Supabase: ${statusRes.error || 'Verifica la conexión'}`);
          }
        }
      } catch (err: any) {
        console.error('Error al sincronizar con BD:', err);
        if (!isInitial) {
          showToast('Error de comunicación con el servidor Supabase');
        }
      } finally {
        setDbLoading(false);
      }
    },
    [currentUser]
  );

  // Carga automática inicial al montar la aplicación si hay sesión activa
  useEffect(() => {
    if (currentUser) {
      syncWithDatabase(true, currentUser);
    }
  }, [currentUser, syncWithDatabase]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setStoredUser(user);
    setData(getStoredData(user));
    setUsuariosList([]);
    setSelectedCliente(null);
    setCurrentReceipt(null);
    setActivePayModal(null);
    setActiveAmortModal(null);
    setActiveCancelModal(null);
    setActiveTab('CLIENTS');
    showToast(`Bienvenido, ${user.nombre || user.usuario} · ${user.empresa_nombre || user.empresa_id}`);
    syncWithDatabase(false, user);
  };

  const handleLogout = () => {
    removeStoredUser();
    setCurrentUser(null);
    setData(getStoredData(null));
    setUsuariosList([]);
    setSelectedCliente(null);
    setCurrentReceipt(null);
    setActivePayModal(null);
    setActiveAmortModal(null);
    setActiveCancelModal(null);
    setActiveTab('CLIENTS');
    showToast('Has cerrado sesión.');
  };

  // Payment success handler (used for Cuotas, Amortization, and Cancellation)
  const handlePaymentSuccess = async (
    recibo: ReciboGenerado,
    updatedCuotas: Cuota[],
    updatedCliente: Cliente,
    updatedPrestamo: Prestamo
  ) => {
    // 1. Update cuotas
    const newCuotas = updatedCuotas;

    // 2. Update prestamos
    const newPrestamos = data.prestamos.map((p) =>
      p.id === updatedPrestamo.id ? updatedPrestamo : p
    );

    // 3. Update clientes
    const newClientes = data.clientes.map((c) =>
      c.dni === updatedCliente.dni ? updatedCliente : c
    );

    // 4. Update receipts history
    const newRecibos = [recibo, ...data.recibos];

    // 5. Add new Pago records for history sync
    const newPagos = [...data.pagos];
    if (recibo.tipo_operacion === 'CUOTA') {
      recibo.cuotas_afectadas.forEach((c) => {
        newPagos.unshift({
          id: `PAG-${Date.now()}-${c.numero}`,
          user_id: updatedPrestamo.user_id || 1,
          prestamo_id: updatedPrestamo.id,
          cuota_id: c.numero,
          cuota_numero: c.numero,
          cliente_dni: updatedCliente.dni,
          monto: c.monto,
          mora: c.mora,
          fecha_pago: getTodayDateString(),
          fecha_vencimiento: getTodayDateString(),
          fecha_registro: new Date().toISOString(),
          usado_saldo_a_favor: recibo.saldo_favor_usado > 0 ? 1 : 0,
          tipo_operacion: 'CUOTA',
        });
      });
    } else {
      newPagos.unshift({
        id: `PAG-${Date.now()}-SPEC`,
        user_id: updatedPrestamo.user_id || 1,
        prestamo_id: updatedPrestamo.id,
        cuota_id: 0,
        cuota_numero: 0,
        cliente_dni: updatedCliente.dni,
        monto: recibo.total_cobrado,
        mora: 0,
        fecha_pago: getTodayDateString(),
        fecha_vencimiento: getTodayDateString(),
        fecha_registro: new Date().toISOString(),
        usado_saldo_a_favor: 0,
        tipo_operacion: recibo.tipo_operacion,
      });
    }

    const nextState = {
      ...data,
      cuotas: newCuotas,
      prestamos: newPrestamos,
      clientes: newClientes,
      recibos: newRecibos,
      pagos: newPagos,
    };

    // Actualizar estado local inmediatamente para respuesta instantánea
    setData(nextState);
    saveStoredData(nextState);

    // Persistir directamente en Supabase
    if (dbStatus?.connected) {
      const persistAction =
        recibo.tipo_operacion === 'AMORTIZACION'
          ? api.recordAmortization({ recibo, updatedCuotas, updatedCliente, updatedPrestamo })
          : api.recordPayment({ recibo, updatedCuotas, updatedCliente, updatedPrestamo });

      persistAction
        .then((res) => {
          if (res.success) {
            console.log('✅ Pago guardado exitosamente en Supabase');
            api.getStatus().then(setDbStatus);
            showToast(`✅ Cobro guardado en BD: ${formatCurrency(recibo.total_cobrado)}`);
          } else {
            console.error('❌ Error devuelto por Supabase:', res.error);
            showToast(`⚠️ Error al guardar en BD: ${res.error || 'Error desconocido'}`);
          }
        })
        .catch((err) => {
          console.error('❌ Error de red al guardar en Supabase:', err);
          showToast(`⚠️ Error de red al guardar en BD: ${err.message}`);
        });
    } else {
      showToast(`Cobro registrado localmente: ${formatCurrency(recibo.total_cobrado)}`);
    }

    // Close any action modals
    setActivePayModal(null);
    setActiveAmortModal(null);
    setActiveCancelModal(null);

    // Open receipt modal for immediate Print / WhatsApp
    setCurrentReceipt(recibo);
  };

  const handleSaveConfig = async (newConfig: UsuarioConfig) => {
    const nextState = { ...data, config: newConfig };
    setData(nextState);
    saveStoredData({ config: newConfig });

    if (dbStatus?.connected) {
      await api.saveConfig(newConfig);
    }

    showToast('Configuración de recibos actualizada y guardada');
  };

  const handleResetData = () => {
    resetDatabase(currentUser);
    setData(getStoredData(currentUser));
    setSelectedCliente(null);
    showToast('Base de datos local restablecida');
  };

  // Quick pay trigger from dashboard
  const handleQuickPay = (cliente: Cliente, prestamo: Prestamo) => {
    setSelectedCliente(cliente);
    setActivePayModal({ cliente, prestamo });
  };

  // If not logged in, display the Login screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        appName="GESTIÓN DE PRÉSTAMOS"
      />
    );
  }

  const permissions = new Set(currentUser.permisos_modulos || []);
  const canCollect = permissions.has('prestamos_pagos') || permissions.has('prestamos_cobranza_diaria');
  const canAmortize = canCollect || permissions.has('prestamos_creditos');
  const canCancel = permissions.has('prestamos_creditos');
  const canConfigureCompany = permissions.has('configuracion');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] flex flex-col items-center justify-start p-0 sm:p-4 md:p-6 select-none">
      {/* Device Viewport Toggle Header (Desktop/Tablet helper) */}
      <header className="w-full max-w-md hidden sm:flex items-center justify-between py-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">{data.config.nombre_marca}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {isMobileFrame ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Pantalla Completa</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Vista Móvil</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container - styled as an elegant smartphone frame on desktop, fluid on mobile */}
      <main
        className={`w-full transition-all duration-300 bg-slate-100 flex flex-col overflow-hidden relative ${
          isMobileFrame
            ? 'max-w-md min-h-screen sm:min-h-[844px] sm:max-h-[92vh] sm:rounded-[36px] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] sm:border-8 sm:border-slate-800'
            : 'max-w-4xl min-h-screen rounded-2xl shadow-xl'
        }`}
      >
        {/* Smartphone Speaker Notch / Dynamic Island simulation on mobile frame */}
        {isMobileFrame && (
          <div className="hidden sm:flex justify-center pt-2 pb-1 bg-slate-900 shrink-0">
            <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-800"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-950"></div>
            </div>
          </div>
        )}

        {/* Mobile App Bar */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-xs gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-sm shrink-0">
              CP
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm tracking-tight leading-none text-white truncate">
                {data.config.nombre_marca}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide flex items-center gap-0.5 ${
                    currentUser.rol === 'admin'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {currentUser.nombre_rol || (currentUser.rol === 'admin' ? 'Administrador' : 'Usuario')}
                </span>
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-[120px]">
                  {currentUser.nombre || currentUser.usuario}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Live DB Connection Badge */}
            <DbConnectionBadge
              status={dbStatus}
              loading={dbLoading}
              onRefresh={() => syncWithDatabase(false)}
              onOpenModal={() => setShowDbModal(true)}
            />

            {canConfigureCompany && (
              <button
                id="settings-btn"
                onClick={() => setShowConfigModal(true)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Configuración de Empresa"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 grow overflow-y-auto">
          {activeTab === 'CLIENTS' && (
            selectedCliente ? (
              <ClientLoanDetail
                cliente={selectedCliente}
                prestamos={data.prestamos}
                cuotas={data.cuotas}
                canPay={canCollect}
                canAmortize={canAmortize}
                canCancel={canCancel}
                onBack={() => setSelectedCliente(null)}
                onOpenPayCuotas={(prestamo) =>
                  setActivePayModal({ cliente: selectedCliente, prestamo })
                }
                onOpenAmortization={(prestamo) =>
                  setActiveAmortModal({ cliente: selectedCliente, prestamo })
                }
                onOpenCancellation={(prestamo) =>
                  setActiveCancelModal({ cliente: selectedCliente, prestamo })
                }
              />
            ) : (
              <ClientsDashboard
                clientes={data.clientes}
                prestamos={data.prestamos}
                cuotas={data.cuotas}
                currentUser={currentUser}
                usuarios={usuariosList}
                canCollect={canCollect}
                onSelectCliente={(c) => setSelectedCliente(c)}
                onQuickPay={handleQuickPay}
              />
            )
          )}

          {activeTab === 'HISTORY' && (
            <ReceiptsHistory
              recibos={data.recibos}
              config={data.config}
              onSelectRecibo={(recibo) => setCurrentReceipt(recibo)}
            />
          )}

          {activeTab === 'SETTINGS' && (
            <div className="space-y-4 pb-20">
              {/* User Session Profile Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        currentUser.rol === 'admin'
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-slate-900">
                          {currentUser.nombre || currentUser.usuario}
                        </h3>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            currentUser.rol === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {currentUser.nombre_rol || (currentUser.rol === 'admin' ? 'Administrador' : 'Usuario')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        @{currentUser.usuario} • ID #{currentUser.id}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                    title="Cerrar Sesión"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Salir</span>
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-1">
                  {currentUser.rol === 'admin' ? (
                    <p className="text-purple-700 font-semibold">
                      👑 Acceso administrativo dentro de {currentUser.empresa_nombre || `la empresa #${currentUser.empresa_id}`}.
                    </p>
                  ) : (
                    <p className="text-emerald-700 font-semibold">
                      👤 Acceso limitado por rol a los clientes y créditos asignados en {currentUser.empresa_nombre || `la empresa #${currentUser.empresa_id}`}.
                    </p>
                  )}
                </div>
              </div>
              {/* Database Connection Card in Settings */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        dbStatus?.connected
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Base de Datos Supabase
                      </h3>
                      <p className="text-xs text-slate-500">
                        {dbStatus?.connected
                          ? `Conectado a gestion_prestamos (${dbStatus.pingMs}ms)`
                          : 'Desconectado'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowDbModal(true)}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    Detalles
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => syncWithDatabase(false)}
                    disabled={dbLoading}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`}
                    />
                    {dbLoading ? 'Sincronizando...' : 'Sincronizar Supabase'}
                  </button>

                  <button
                    onClick={() => setShowDbModal(true)}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Diagnóstico BD
                  </button>
                </div>
              </div>

              {/* Company Info Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {data.config.nombre_marca}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cobrador: {data.config.representante || 'No asignado'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600">
                  <p>
                    <strong>Teléfono:</strong> {data.config.telefono || 'Sin registrar'}
                  </p>
                  <p>
                    <strong>Dirección:</strong> {data.config.direccion || 'Sin registrar'}
                  </p>
                  <p>
                    <strong>DNI Cobrador:</strong>{' '}
                    {data.config.dni_representante || 'Sin registrar'}
                  </p>
                </div>

                {canConfigureCompany && (
                  <button
                    onClick={() => setShowConfigModal(true)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Editar Datos de Ticket y Cobrador
                  </button>
                )}
              </div>

              {/* Reset data */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                <h4 className="font-bold text-slate-900">Opciones Locales</h4>
                <p className="text-slate-500 text-[11px]">
                  Restablecer almacenamiento temporal local de la interfaz.
                </p>

                <div className="pt-2">
                  <button
                    onClick={handleResetData}
                    className="w-full py-2.5 px-3 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restablecer Cache Local
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar (Fixed for Mobile ergonomics) */}
        <nav
          aria-label="Navegación principal"
          className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-6 py-2.5 flex items-center justify-around z-40"
        >
          <button
            onClick={() => {
              setActiveTab('CLIENTS');
              setSelectedCliente(null);
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'CLIENTS'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Cobranzas</span>
          </button>

          {canCollect && (
            <button
              onClick={() => {
                setActiveTab('HISTORY');
                setSelectedCliente(null);
              }}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'text-emerald-600 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span className="text-[10px]">Recibos</span>
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab('SETTINGS');
              setSelectedCliente(null);
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'SETTINGS'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px]">Ajustes</span>
          </button>
        </nav>

        {/* Toast Popup */}
        {toastMessage && (
          <div className="absolute top-16 inset-x-4 z-50 p-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </main>

      {/* Modal: Diagnóstico y Estado de BD Supabase */}
      <DbSettingsModal
        isOpen={showDbModal}
        onClose={() => setShowDbModal(false)}
        status={dbStatus}
        loading={dbLoading}
        onRefresh={() => syncWithDatabase(false)}
      />

      {/* Modal 1: Pagar Cuotas */}
      {activePayModal && (
        <PayInstallmentsModal
          cliente={activePayModal.cliente}
          prestamo={activePayModal.prestamo}
          cuotas={data.cuotas}
          onClose={() => setActivePayModal(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Modal 2: Amortización Extraordinaria */}
      {activeAmortModal && (
        <AmortizationModal
          cliente={activeAmortModal.cliente}
          prestamo={activeAmortModal.prestamo}
          cuotas={data.cuotas}
          onClose={() => setActiveAmortModal(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Modal 3: Cancelación Total / Liquidación */}
      {activeCancelModal && (
        <CancelLoanModal
          cliente={activeCancelModal.cliente}
          prestamo={activeCancelModal.prestamo}
          cuotas={data.cuotas}
          onClose={() => setActiveCancelModal(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Printable & WhatsApp Receipt Modal */}
      {currentReceipt && (
        <ReceiptModal
          recibo={currentReceipt}
          config={data.config}
          onClose={() => setCurrentReceipt(null)}
        />
      )}

      {/* Company / Receipt Configuration Modal */}
      {showConfigModal && canConfigureCompany && (
        <ConfigModal
          config={data.config}
          onSave={handleSaveConfig}
          onResetDatabase={handleResetData}
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </div>
  );
}
