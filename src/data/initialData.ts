import { Cliente, Prestamo, Cuota, Pago, UsuarioConfig } from '../types';

export const INITIAL_CONFIG: UsuarioConfig = {
  user_id: 1,
  nombre_marca: 'CREDI-FÁCIL FINANZAS',
  telefono: '+51 987 654 321',
  direccion: 'Av. El Sol 450, Ofic. 201 - Centro',
  representante: 'Carlos Morales Gómez',
  dni_representante: '44892150',
  logo_base64: null,
};

export const INITIAL_CLIENTES: Cliente[] = [
  {
    codigo: 'CLI-001',
    user_id: 1,
    dni: '45892110',
    nombres: 'Juan Carlos',
    apellidos: 'Pérez Quispe',
    direccion: 'Jr. Huancavelica 342, El Tambo',
    telefono: '+51987112233',
    estado: 'ACTIVO',
    fecha_registro: '2026-08-01 10:30:00',
    saldo_a_favor: 0.0,
  },
  {
    codigo: 'CLI-002',
    user_id: 1,
    dni: '70234561',
    nombres: 'María Elena',
    apellidos: 'Rodríguez Castillo',
    direccion: 'Av. Los Próceres 1205, Mz F Lote 12',
    telefono: '+51976543210',
    estado: 'ACTIVO',
    fecha_registro: '2026-08-10 14:15:00',
    saldo_a_favor: 20.0,
  },
  {
    codigo: 'CLI-003',
    user_id: 1,
    dni: '10459823',
    nombres: 'Roberto Carlos',
    apellidos: 'Vega Alarcón',
    direccion: 'Calle Las Orquídeas 210, Urb. Jardín',
    telefono: '+51912345678',
    estado: 'ACTIVO',
    fecha_registro: '2026-08-15 09:00:00',
    saldo_a_favor: 0.0,
  },
  {
    codigo: 'CLI-004',
    user_id: 1,
    dni: '48920134',
    nombres: 'Ana Sofía',
    apellidos: 'Mendoza Flores',
    direccion: 'Mercado Modelo Puesto #45',
    telefono: '+51965874123',
    estado: 'ACTIVO',
    fecha_registro: '2026-08-20 16:40:00',
    saldo_a_favor: 50.0,
  },
];

export const INITIAL_PRESTAMOS: Prestamo[] = [
  {
    id: 'PR-2026-001',
    user_id: 1,
    solicitud_id: 101,
    cliente_dni: '45892110',
    monto: 1200.0,
    interes: 0.2, // 20% total = 1440.00
    plazo: 24, // 24 cuotas diarias de 60.00
    tipo_credito: 'DIARIO',
    condicion: 'NUEVO',
    fecha_desembolso: '2026-08-20',
    dias_pago: 'Lunes a Sábado',
    estado: 'ACTIVO',
    fecha_creacion: '2026-08-20 08:00:00',
  },
  {
    id: 'PR-2026-002',
    user_id: 1,
    solicitud_id: 102,
    cliente_dni: '70234561',
    monto: 2500.0,
    interes: 0.15, // 15% total = 2875.00
    plazo: 10, // 10 cuotas semanales de 287.50
    tipo_credito: 'SEMANAL',
    condicion: 'REPRESTAMO',
    fecha_desembolso: '2026-08-15',
    dias_pago: 'Todos los Viernes',
    estado: 'ACTIVO',
    fecha_creacion: '2026-08-15 11:20:00',
  },
  {
    id: 'PR-2026-003',
    user_id: 1,
    solicitud_id: 103,
    cliente_dni: '10459823',
    monto: 3000.0,
    interes: 0.18, // 18% total = 3540.00
    plazo: 6, // 6 cuotas quincenales de 590.00
    tipo_credito: 'QUINCENAL',
    condicion: 'NUEVO',
    fecha_desembolso: '2026-08-01',
    dias_pago: 'Quincenal (15 y 30)',
    estado: 'ACTIVO',
    fecha_creacion: '2026-08-01 15:45:00',
  },
  {
    id: 'PR-2026-004',
    user_id: 1,
    solicitud_id: 104,
    cliente_dni: '48920134',
    monto: 4000.0,
    interes: 0.25, // 25% total = 5000.00
    plazo: 5, // 5 cuotas mensuales de 1000.00
    tipo_credito: 'MENSUAL',
    condicion: 'NUEVO',
    fecha_desembolso: '2026-07-15',
    dias_pago: '15 de cada mes',
    estado: 'ACTIVO',
    fecha_creacion: '2026-07-15 10:00:00',
  },
];

// Helper to generate initial cuotas for the prestamos
function generateInitialCuotas(): Cuota[] {
  const cuotas: Cuota[] = [];
  let idCounter = 1;

  // PR-2026-001: 24 cuotas de 60.00. Cuotas 1 a 4 PAGADO, cuota 5 VENCIDO, 6-24 PENDIENTE
  for (let i = 1; i <= 24; i++) {
    const isPaid = i <= 4;
    const isVencido = i === 5;
    const dayOffset = i;
    // Calculate dates around 2026-09-12
    const dueDate = new Date(2026, 7, 21); // Aug 21, 2026
    dueDate.setDate(dueDate.getDate() + dayOffset);
    const dateStr = dueDate.toISOString().split('T')[0];

    cuotas.push({
      id: idCounter++,
      user_id: 1,
      prestamo_id: 'PR-2026-001',
      numero: i,
      fecha_vencimiento: dateStr,
      monto: 60.0,
      monto_pagado: isPaid ? 60.0 : 0.0,
      mora: isVencido ? 5.0 : 0.0,
      dias_atraso: isVencido ? 3 : 0,
      estado: isPaid ? 'PAGADO' : isVencido ? 'VENCIDO' : 'PENDIENTE',
      fecha_pago_real: isPaid ? '2026-08-25' : null,
    });
  }

  // PR-2026-002: 10 cuotas de 287.50. Cuota 1 y 2 PAGADO, cuota 3 PENDIENTE (hoy), rest PENDIENTE
  for (let i = 1; i <= 10; i++) {
    const isPaid = i <= 2;
    const dueDate = new Date(2026, 7, 22); // Aug 22, 2026
    dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
    const dateStr = dueDate.toISOString().split('T')[0];

    cuotas.push({
      id: idCounter++,
      user_id: 1,
      prestamo_id: 'PR-2026-002',
      numero: i,
      fecha_vencimiento: dateStr,
      monto: 287.5,
      monto_pagado: isPaid ? 287.5 : 0.0,
      mora: 0.0,
      dias_atraso: 0,
      estado: isPaid ? 'PAGADO' : 'PENDIENTE',
      fecha_pago_real: isPaid ? '2026-08-29' : null,
    });
  }

  // PR-2026-003: 6 cuotas de 590.00. Cuota 1 PAGADO, cuota 2 VENCIDO con mora 15.00, cuotas 3-6 PENDIENTE
  for (let i = 1; i <= 6; i++) {
    const isPaid = i === 1;
    const isVencido = i === 2;
    const dueDate = new Date(2026, 7, 15);
    dueDate.setDate(dueDate.getDate() + (i - 1) * 15);
    const dateStr = dueDate.toISOString().split('T')[0];

    cuotas.push({
      id: idCounter++,
      user_id: 1,
      prestamo_id: 'PR-2026-003',
      numero: i,
      fecha_vencimiento: dateStr,
      monto: 590.0,
      monto_pagado: isPaid ? 590.0 : 0.0,
      mora: isVencido ? 15.0 : 0.0,
      dias_atraso: isVencido ? 6 : 0,
      estado: isPaid ? 'PAGADO' : isVencido ? 'VENCIDO' : 'PENDIENTE',
      fecha_pago_real: isPaid ? '2026-08-16' : null,
    });
  }

  // PR-2026-004: 5 cuotas de 1000.00. Cuota 1 PAGADO, 2-5 PENDIENTE
  for (let i = 1; i <= 5; i++) {
    const isPaid = i === 1;
    const dueDate = new Date(2026, 6, 15);
    dueDate.setMonth(dueDate.getMonth() + i);
    const dateStr = dueDate.toISOString().split('T')[0];

    cuotas.push({
      id: idCounter++,
      user_id: 1,
      prestamo_id: 'PR-2026-004',
      numero: i,
      fecha_vencimiento: dateStr,
      monto: 1000.0,
      monto_pagado: isPaid ? 1000.0 : 0.0,
      mora: 0.0,
      dias_atraso: 0,
      estado: isPaid ? 'PAGADO' : 'PENDIENTE',
      fecha_pago_real: isPaid ? '2026-08-15' : null,
    });
  }

  return cuotas;
}

export const INITIAL_CUOTAS: Cuota[] = generateInitialCuotas();

export const INITIAL_PAGOS: Pago[] = [
  {
    id: 'PAG-20260825-001',
    user_id: 1,
    prestamo_id: 'PR-2026-001',
    cuota_id: 1,
    cuota_numero: 1,
    cliente_dni: '45892110',
    monto: 60.0,
    mora: 0.0,
    fecha_pago: '2026-08-25',
    fecha_vencimiento: '2026-08-22',
    fecha_registro: '2026-08-25 11:30:00',
    usado_saldo_a_favor: 0,
    tipo_operacion: 'CUOTA',
  },
  {
    id: 'PAG-20260825-002',
    user_id: 1,
    prestamo_id: 'PR-2026-001',
    cuota_id: 2,
    cuota_numero: 2,
    cliente_dni: '45892110',
    monto: 60.0,
    mora: 0.0,
    fecha_pago: '2026-08-25',
    fecha_vencimiento: '2026-08-23',
    fecha_registro: '2026-08-25 11:30:00',
    usado_saldo_a_favor: 0,
    tipo_operacion: 'CUOTA',
  },
  {
    id: 'PAG-20260829-001',
    user_id: 1,
    prestamo_id: 'PR-2026-002',
    cuota_id: 25,
    cuota_numero: 1,
    cliente_dni: '70234561',
    monto: 287.5,
    mora: 0.0,
    fecha_pago: '2026-08-29',
    fecha_vencimiento: '2026-08-22',
    fecha_registro: '2026-08-29 16:10:00',
    usado_saldo_a_favor: 0,
    tipo_operacion: 'CUOTA',
  },
];
