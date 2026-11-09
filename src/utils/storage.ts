import {
  Cliente,
  Prestamo,
  Cuota,
  Pago,
  UsuarioConfig,
  ReciboGenerado,
  User,
} from '../types';
import {
  INITIAL_CLIENTES,
  INITIAL_PRESTAMOS,
  INITIAL_CUOTAS,
  INITIAL_PAGOS,
  INITIAL_CONFIG,
} from '../data/initialData';

const STORAGE_KEYS = {
  CLIENTES: 'gp_clientes_v1',
  PRESTAMOS: 'gp_prestamos_v1',
  CUOTAS: 'gp_cuotas_v1',
  PAGOS: 'gp_pagos_v1',
  CONFIG: 'gp_config_v1',
  RECIBOS: 'gp_recibos_historial_v1',
};

function scopedStorageKeys(user: User | null) {
  if (!user) return STORAGE_KEYS;
  const suffix = `_company_${user.empresa_id || 0}_user_${user.id}`;
  return Object.fromEntries(
    Object.entries(STORAGE_KEYS).map(([key, value]) => [key, `${value}${suffix}`])
  ) as typeof STORAGE_KEYS;
}

function emptyUserData(user: User) {
  return {
    clientes: [] as Cliente[],
    prestamos: [] as Prestamo[],
    cuotas: [] as Cuota[],
    pagos: [] as Pago[],
    config: {
      user_id: user.empresa_id || user.id,
      nombre_marca: user.empresa_nombre || 'GESTIÓN DE PRÉSTAMOS',
      telefono: null,
      direccion: null,
      representante: null,
      dni_representante: null,
      logo_base64: null,
    } as UsuarioConfig,
    recibos: [] as ReciboGenerado[],
  };
}

export function getStoredData(user: User | null = getStoredUser()) {
  if (user) {
    const keys = scopedStorageKeys(user);
    const empty = emptyUserData(user);
    const get = <T>(key: string, fallback: T): T => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      } catch {
        return fallback;
      }
    };

    return {
      clientes: get<Cliente[]>(keys.CLIENTES, empty.clientes),
      prestamos: get<Prestamo[]>(keys.PRESTAMOS, empty.prestamos),
      cuotas: get<Cuota[]>(keys.CUOTAS, empty.cuotas),
      pagos: get<Pago[]>(keys.PAGOS, empty.pagos),
      config: get<UsuarioConfig>(keys.CONFIG, empty.config),
      recibos: get<ReciboGenerado[]>(keys.RECIBOS, empty.recibos),
    };
  }

  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  return {
    clientes: INITIAL_CLIENTES,
    prestamos: INITIAL_PRESTAMOS,
    cuotas: INITIAL_CUOTAS,
    pagos: INITIAL_PAGOS,
    config: INITIAL_CONFIG,
    recibos: [],
  };
}

export function saveStoredData(data: {
  clientes?: Cliente[];
  prestamos?: Prestamo[];
  cuotas?: Cuota[];
  pagos?: Pago[];
  config?: UsuarioConfig;
  recibos?: ReciboGenerado[];
}, user: User | null = getStoredUser()) {
  const keys = scopedStorageKeys(user);
  if (data.clientes) localStorage.setItem(keys.CLIENTES, JSON.stringify(data.clientes));
  if (data.prestamos) localStorage.setItem(keys.PRESTAMOS, JSON.stringify(data.prestamos));
  if (data.cuotas) localStorage.setItem(keys.CUOTAS, JSON.stringify(data.cuotas));
  if (data.pagos) localStorage.setItem(keys.PAGOS, JSON.stringify(data.pagos));
  if (data.config) localStorage.setItem(keys.CONFIG, JSON.stringify(data.config));
  if (data.recibos) localStorage.setItem(keys.RECIBOS, JSON.stringify(data.recibos));
}

export function resetDatabase(user: User | null = getStoredUser()) {
  const keys = scopedStorageKeys(user);
  Object.values(keys).forEach((key) => localStorage.removeItem(key));
  if (!user) {
    localStorage.setItem(STORAGE_KEYS.CLIENTES, JSON.stringify(INITIAL_CLIENTES));
    localStorage.setItem(STORAGE_KEYS.PRESTAMOS, JSON.stringify(INITIAL_PRESTAMOS));
    localStorage.setItem(STORAGE_KEYS.CUOTAS, JSON.stringify(INITIAL_CUOTAS));
    localStorage.setItem(STORAGE_KEYS.PAGOS, JSON.stringify(INITIAL_PAGOS));
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(INITIAL_CONFIG));
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const parts = dateString.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNowDateTimeString(): string {
  const now = new Date();
  return `${formatDate(now.toISOString())} ${now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

const USER_STORAGE_KEY = 'gestion_prestamos_auth_user';

export function getStoredUser(): import('../types').User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: import('../types').User): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Error saving user to localStorage:', e);
  }
}

export function removeStoredUser(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (e) {
    console.error('Error removing user from localStorage:', e);
  }
}
