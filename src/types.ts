export type TipoCredito = 'DIARIO' | 'SEMANAL' | 'QUINCENAL' | 'AL VENCIMIENTO' | 'MENSUAL';
export type EstadoPrestamo = 'ACTIVO' | 'TERMINADO' | 'ANULADO';
export type EstadoCuota = 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
export type EstadoCliente = 'ACTIVO' | 'INACTIVO';

export interface User {
  id: number;
  empresa_id?: number;
  nombre: string;
  usuario: string;
  rol: 'admin' | 'usuario';
  nombre_rol?: string;
  permisos_modulos?: string[];
  empresa_nombre?: string;
  token?: string;
  activo?: number;
  fecha_creacion?: string;
}

export interface Cliente {
  codigo: string;
  user_id: number;
  dni: string;
  apellidos: string;
  nombres: string;
  direccion: string;
  telefono: string;
  estado: EstadoCliente;
  fecha_registro: string;
  fecha_modificacion?: string | null;
  saldo_a_favor: number;
  owner_name?: string;
  owner_username?: string;
}

export interface Prestamo {
  id: string; // varchar(20), ej: "PR-2026-001"
  user_id: number;
  solicitud_id?: number | null;
  cliente_dni: string;
  monto: number; // capital prestado
  interes: number; // e.g. 0.20 = 20%
  plazo: number; // cantidad de cuotas / plazo
  tipo_credito: TipoCredito;
  condicion: string;
  fecha_desembolso: string;
  dias_pago: string;
  estado: EstadoPrestamo;
  fecha_creacion: string;
  fecha_modificacion?: string | null;
  observacion_anulacion?: string | null;
  owner_name?: string;
  owner_username?: string;
}

export interface Cuota {
  id: number;
  user_id: number;
  prestamo_id: string;
  numero: number;
  fecha_vencimiento: string;
  monto: number;
  monto_pagado: number;
  mora: number;
  dias_atraso: number;
  estado: EstadoCuota;
  fecha_pago_real: string | null;
}

export interface Pago {
  id: string; // varchar(50)
  user_id: number;
  prestamo_id: string;
  cuota_id: number;
  cuota_numero: number;
  cliente_dni: string;
  monto: number;
  mora: number;
  fecha_pago: string;
  fecha_vencimiento: string;
  fecha_registro: string;
  usado_saldo_a_favor: number; // 0 or 1
  tipo_operacion?: 'CUOTA' | 'AMORTIZACION' | 'CANCELACION';
  nota?: string;
}

export interface UsuarioConfig {
  user_id: number;
  nombre_marca: string;
  telefono: string | null;
  direccion: string | null;
  representante: string | null;
  dni_representante: string | null;
  logo_base64?: string | null;
}

export interface ReciboGenerado {
  id: string;
  fecha_hora: string;
  cliente: Cliente;
  prestamo: Prestamo;
  tipo_operacion: 'CUOTA' | 'AMORTIZACION' | 'CANCELACION';
  cuotas_afectadas: Array<{
    id?: number;
    numero: number;
    monto: number;
    mora: number;
    total: number;
    saldo_actual?: number; // Saldo restante de la cuota tras la operación
  }>;
  total_cuotas: number;
  total_mora: number;
  saldo_favor_usado: number;
  total_cobrado: number;
  saldo_restante_prestamo: number;
  cuotas_restantes: number;
  proximo_vencimiento?: string | null;
  metodo_pago?: string;
  observaciones?: string;
}
