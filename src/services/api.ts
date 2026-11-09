import { Cliente, Prestamo, Cuota, Pago, UsuarioConfig, ReciboGenerado, User } from '../types';
import { getStoredUser } from '../utils/storage';

export interface DbStatusResponse {
  success: boolean;
  connected: boolean;
  database?: string;
  host?: string;
  port?: number;
  user?: string;
  pingMs?: number;
  tablesCount?: number;
  counts?: {
    clientes: number;
    prestamos: number;
    cuotas: number;
    pagos: number;
  };
  error?: string;
}

export interface RealDataResponse {
  success: boolean;
  source?: string;
  isAdmin?: boolean;
  userId?: number | null;
  filterApplied?: boolean;
  timestamp?: string;
  data?: {
    clientes: Cliente[];
    prestamos: Prestamo[];
    cuotas: Cuota[];
    pagos: Pago[];
    config: UsuarioConfig;
  };
  error?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  error?: string;
}

export interface UsuariosResponse {
  success: boolean;
  data?: User[];
  error?: string;
}

export interface PagosEstadisticas {
  totalPagos: number;
  pagosHoy: number;
  montoRecaudadoHoy: number;
  cuotasVencidas: number;
  montoTotalCobrado: number;
}

export interface ProcessPagoDirectPayload {
  prestamoId: string;
  clienteDni: string;
  fechaPago?: string;
  pagos: Array<{
    cuotaId: number;
    cuotaNumero: number;
    monto: number;
    mora: number;
    diasAtraso?: number;
    fechaVencimiento?: string;
  }>;
  usarSaldo?: boolean;
}

export function buildApiUrl(endpoint: string, queryParams?: Record<string, any>): string {
  const base = (import.meta as any).env?.VITE_API_URL || '/api';
  const searchParams = new URLSearchParams();
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    }
  }

  const cleanBase = base.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return `${cleanBase}/${cleanEndpoint}${qs}`;
}

async function parseApiResponse(res: Response): Promise<any> {
  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch {
    if (res.headers.get('content-type')?.includes('text/html') || body.trimStart().startsWith('<')) {
      throw new Error(
        `El servidor devolvió una página HTML en lugar de JSON (HTTP ${res.status}). ` +
        'Configura VITE_API_URL con la URL pública del backend API y vuelve a compilar la app.'
      );
    }
    throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${res.status}).`);
  }
}

function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getStoredUser()?.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export const api = {
  // Autenticación de Usuario
  async login(credentials: { usuario: string; password: string }): Promise<LoginResponse> {
    try {
      const res = await fetch(buildApiUrl('login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await parseApiResponse(res);
      if (data.success && data.user && data.token) {
        data.user.token = data.token;
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error de conexión con el servidor',
      };
    }
  },

  // Obtener lista de usuarios activos
  async getUsuarios(): Promise<UsuariosResponse> {
    try {
      const res = await authenticatedFetch(buildApiUrl('usuarios'));
      return await parseApiResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 1. Obtener estado de la conexión a Supabase
  async getStatus(): Promise<DbStatusResponse> {
    try {
      const res = await authenticatedFetch(buildApiUrl('status'));
      const data = await parseApiResponse(res);
      if (!res.ok) {
        return {
          success: false,
          connected: false,
          error: data.error || `Error HTTP ${res.status}: ${res.statusText}`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        connected: false,
        error: err.message || 'No se pudo contactar con el backend API',
      };
    }
  },

  // 2. Extraer datos de Supabase con filtro según empresa, rol y usuario
  async fetchRealData(): Promise<RealDataResponse> {
    try {
      const res = await authenticatedFetch(buildApiUrl('data'));
      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || `Error HTTP ${res.status}: ${res.statusText}`);
      }
      return data;
    } catch (err: any) {
      console.error('Error al obtener datos reales de Supabase:', err);
      return {
        success: false,
        error: err.message || 'Error al conectar con la base de datos',
      };
    }
  },

  // 3. Obtener listado de pagos (con filtro opcional de usuario)
  async getPagosList(): Promise<{ success: boolean; data?: Pago[]; error?: string }> {
    try {
      const url = buildApiUrl('pagos', {
        action: 'list',
        sub_action: 'list',
      });
      const res = await authenticatedFetch(url);
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al obtener pagos');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 4. Obtener pagos de un préstamo específico
  async getPagosByPrestamo(prestamoId: string): Promise<{ success: boolean; data?: Pago[]; error?: string }> {
    try {
      const url = buildApiUrl('pagos', {
        action: 'byPrestamo',
        sub_action: 'byPrestamo',
        id: prestamoId,
      });
      const res = await authenticatedFetch(url);
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al obtener pagos del préstamo');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 5. Obtener pagos por fecha
  async getPagosByFecha(fecha: string): Promise<{ success: boolean; data?: Pago[]; error?: string }> {
    try {
      const url = buildApiUrl('pagos', {
        action: 'byFecha',
        sub_action: 'byFecha',
        fecha: fecha,
      });
      const res = await authenticatedFetch(url);
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al obtener pagos por fecha');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 6. Obtener estadísticas de pagos y cobranzas
  async getPagosEstadisticas(): Promise<{ success: boolean; data?: PagosEstadisticas; error?: string }> {
    try {
      const url = buildApiUrl('pagos', {
        action: 'estadisticas',
        sub_action: 'estadisticas',
      });
      const res = await authenticatedFetch(url);
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al obtener estadísticas de pagos');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 7. Procesar pago directo usando formato nativo de pagos.php
  async processPagoDirect(payload: ProcessPagoDirectPayload): Promise<{ success: boolean; terminado?: boolean; data?: { terminado: boolean }; message?: string; error?: string }> {
    try {
      const res = await authenticatedFetch(buildApiUrl('pagos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al procesar pago');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 8. Registrar pago / cuota en Supabase (soporta objeto de recibo completo)
  async recordPayment(payload: {
    recibo: ReciboGenerado;
    updatedCuotas: Cuota[];
    updatedCliente: Cliente;
    updatedPrestamo: Prestamo;
  }): Promise<{ success: boolean; terminado?: boolean; message?: string; error?: string }> {
    try {
      const res = await authenticatedFetch(buildApiUrl('pagos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al registrar pago');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 9. Registrar amortización en Supabase
  async recordAmortization(payload: {
    recibo: ReciboGenerado;
    updatedCuotas: Cuota[];
    updatedCliente: Cliente;
    updatedPrestamo: Prestamo;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await authenticatedFetch(buildApiUrl('amortizacion'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al registrar amortización');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 10. Anular préstamo en Supabase
  async cancelLoan(
    prestamo_id: string,
    motivo: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await authenticatedFetch(buildApiUrl('anular-prestamo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestamo_id, motivo }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al anular préstamo');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 11. Guardar cliente en Supabase
  async saveCliente(
    cliente: Partial<Cliente>
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await authenticatedFetch(buildApiUrl('clientes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al guardar cliente');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // 12. Guardar configuración corporativa en Supabase
  async saveConfig(
    config: UsuarioConfig
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await authenticatedFetch(buildApiUrl('config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Error al guardar configuración');
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
