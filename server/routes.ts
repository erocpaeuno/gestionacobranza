import { Router } from 'express';
import { pool, testDbConnection, RowDataPacket } from './db';
import type { DatabaseConnection } from './db';
import bcrypt from 'bcryptjs';
import { authenticateRequest, optionalAuthenticateRequest, createSessionToken, hasPermission, isCompanyAdmin } from './auth';

export const apiRouter = Router();

// 1.1 Autenticación / Login de Usuarios
apiRouter.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({
      success: false,
      error: 'Por favor ingresa usuario y contraseña',
    });
  }

  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT u.id, CONCAT_WS(' ', u.nombres, u.apellidos) AS nombre, u.usuario,
              u.password, r.id AS rol_id, r.nombre AS rol_nombre, u.estado::text AS estado,
              u.permisos_modulos, u.created_at AS fecha_creacion, u.empresa_id,
              COALESCE(e.nombre_comercial, e.razon_social) AS empresa_nombre
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
       JOIN empresas e ON e.id = u.empresa_id
       WHERE LOWER(u.usuario) = LOWER(?) AND u.estado::text = 'activo'
         AND u.deleted_at IS NULL AND (u.bloqueado_hasta IS NULL OR u.bloqueado_hasta <= NOW())
         AND r.estado::text = 'activo' AND r.deleted_at IS NULL
         AND e.estado::text = 'activo' AND e.activo = TRUE AND e.deleted_at IS NULL
       ORDER BY u.id
       LIMIT 2`,
      [String(usuario).trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos',
      });
    }
    if (rows.length > 1) {
      return res.status(409).json({
        success: false,
        error: 'El usuario existe en más de una empresa. Solicita al administrador un usuario único.',
      });
    }

    const user = rows[0];

    // El hash de PHP $2y$ es compatible con bcryptjs cambiando a $2a$
    const rawHash = user.password || '';
    const normalizedHash = rawHash.replace(/^\$2y\$/, '$2a$');
    let isMatch = false;

    try {
      isMatch = bcrypt.compareSync(password, normalizedHash);
    } catch (error) {
      console.error('[API /login] Hash de contraseña inválido:', error);
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña incorrectos',
      });
    }

    const permissions = Array.isArray(user.permisos_modulos) ? user.permisos_modulos : [];
    const roleName = String(user.rol_nombre);
    const rol = isCompanyAdmin({
      userId: Number(user.id),
      companyId: Number(user.empresa_id),
      roleId: Number(user.rol_id),
      roleName,
      permissions,
      username: user.usuario,
    }) ? 'admin' : 'usuario';
    const token = createSessionToken(Number(user.id), Number(user.empresa_id));
    console.log(`[API /login] ✅ Sesión iniciada: ${user.usuario} (${roleName}) - Empresa ${user.empresa_id}`);

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: Number(user.id),
        empresa_id: Number(user.empresa_id),
        nombre: user.nombre,
        usuario: user.usuario,
        rol,
        nombre_rol: roleName,
        permisos_modulos: permissions.filter((permission: unknown) => typeof permission === 'string'),
        empresa_nombre: user.empresa_nombre,
        fecha_creacion: user.fecha_creacion,
      },
    });
  } catch (error: any) {
    console.error('[API /login] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno al procesar el inicio de sesión',
    });
  } finally {
    if (connection) connection.release();
  }
});

// 1.2 Estado de conexión con Supabase PostgreSQL (Healthcheck para Render / Monitor de Conexión)
apiRouter.get('/status', optionalAuthenticateRequest, async (req, res) => {
  try {
    const companyId = req.auth && isCompanyAdmin(req.auth) ? req.auth.companyId : undefined;
    const status = await testDbConnection(companyId);
    res.json({ success: true, ...status });
  } catch (error: any) {
    console.error('[API /status] Error:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message || 'Error al verificar conexión',
    });
  }
});

apiRouter.use(authenticateRequest);

// 1.2 Listado de Usuarios (para filtros y asignación)
apiRouter.get('/usuarios', async (req, res) => {
  if (!req.auth || !isCompanyAdmin(req.auth) || !hasPermission(req.auth, 'usuarios')) {
    return res.status(403).json({ success: false, error: 'No tienes permiso para consultar usuarios.' });
  }
  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const companyId = req.auth.companyId;
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT u.id, u.empresa_id, CONCAT_WS(' ', u.nombres, u.apellidos) AS nombre,
              u.usuario, r.nombre AS rol_nombre, u.created_at AS fecha_creacion
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
       WHERE u.empresa_id = ? AND u.estado::text = 'activo' AND u.deleted_at IS NULL
         AND r.estado::text = 'activo' AND r.deleted_at IS NULL
       ORDER BY nombre ASC`,
      [companyId]
    );
    res.json({
      success: true,
      data: rows.map((u) => ({
        id: Number(u.id),
        empresa_id: Number(u.empresa_id),
        nombre: u.nombre,
        usuario: u.usuario,
        rol: /admin/i.test(String(u.rol_nombre)) ? 'admin' : 'usuario',
        nombre_rol: u.rol_nombre,
        activo: true,
        fecha_creacion: u.fecha_creacion,
      })),
    });
  } catch (error: any) {
    console.error('[API /usuarios] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 2. Extracción de datos reales con control de acceso según rol
apiRouter.get('/data', async (req, res) => {
  if (!req.auth || !hasPermission(req.auth, 'prestamos_clientes', 'prestamos_creditos', 'prestamos_pagos', 'prestamos_cobranza_diaria')) {
    return res.status(403).json({ success: false, error: 'Tu rol no tiene acceso al módulo de préstamos.' });
  }
  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const { userId, companyId } = req.auth;
    const isAdmin = isCompanyAdmin(req.auth);

    try {
      const shouldFilterByUser = !isAdmin;
      const clientUserFilter = shouldFilterByUser
        ? `AND (c.asesor_id = ? OR EXISTS (
               SELECT 1 FROM prestamos_creditos assigned
               WHERE assigned.cliente_id = c.id AND assigned.empresa_id = c.empresa_id
                 AND assigned.usuario_id = ?
             ))`
        : '';
      const loanUserFilter = shouldFilterByUser ? 'AND p.usuario_id = ?' : '';
      const scheduleUserFilter = shouldFilterByUser ? 'AND p.usuario_id = ?' : '';
      const paymentUserFilter = shouldFilterByUser ? 'AND p.usuario_id = ?' : '';

      const [clientesRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(c.codigo_cliente, c.id::text) AS codigo,
                COALESCE(c.asesor_id, 0) AS user_id,
                c.numero_documento AS dni,
                COALESCE(NULLIF(BTRIM(c.apellidos), ''), '') AS apellidos,
                COALESCE(NULLIF(BTRIM(c.nombres), ''), NULLIF(BTRIM(c.nombres_razon_social), ''), '') AS nombres,
                c.direccion, c.telefono,
                CASE WHEN c.estado::text = 'activo' THEN 'ACTIVO' ELSE 'INACTIVO' END AS estado,
                c.created_at AS fecha_registro, c.updated_at AS fecha_modificacion,
                COALESCE(n.saldo_a_favor, 0)::double precision AS saldo_a_favor,
                CONCAT_WS(' ', u.nombres, u.apellidos) AS owner_name, u.usuario AS owner_username
         FROM clientes c
         LEFT JOIN usuarios u ON c.asesor_id = u.id AND u.empresa_id = c.empresa_id
         LEFT JOIN LATERAL (
           SELECT SUM(saldo_disponible) AS saldo_a_favor
           FROM prestamos_notas_credito
           WHERE empresa_id = c.empresa_id AND cliente_id = c.id AND saldo_disponible > 0
         ) n ON TRUE
         WHERE c.empresa_id = ? AND c.deleted_at IS NULL
           AND EXISTS (
             SELECT 1 FROM prestamos_creditos related_loan
             WHERE related_loan.cliente_id = c.id
               AND related_loan.empresa_id = c.empresa_id
           )
           ${clientUserFilter}
         ORDER BY c.created_at DESC`,
        shouldFilterByUser ? [companyId, userId, userId] : [companyId]
      );

      const [prestamosRows] = await connection.query<RowDataPacket[]>(
        `SELECT p.id::text AS id, p.usuario_id AS user_id, NULL::bigint AS solicitud_id,
                c.numero_documento AS cliente_dni,
                p.monto_credito::double precision AS monto,
                p.tasa_interes::double precision AS interes, p.plazo_credito AS plazo,
                UPPER(p.tipo_credito) AS tipo_credito, p.condicion_credito AS condicion,
                p.fecha_desembolso, p.dias_pago,
                CASE
                  WHEN p.estado_credito IN ('VIGENTE', 'VENCIDO') THEN 'ACTIVO'
                  WHEN p.estado_credito = 'CANCELADO' AND p.motivo_anulacion IS NOT NULL THEN 'ANULADO'
                  WHEN p.estado_credito = 'CANCELADO' THEN 'TERMINADO'
                  WHEN p.estado_credito = 'ANULADO' THEN 'ANULADO'
                  ELSE p.estado_credito
                END AS estado,
                p.created_at AS fecha_creacion, p.updated_at AS fecha_modificacion,
                p.motivo_anulacion AS observacion_anulacion,
                CONCAT_WS(' ', u.nombres, u.apellidos) AS owner_name, u.usuario AS owner_username
         FROM prestamos_creditos p
         JOIN clientes c ON c.id = p.cliente_id AND c.empresa_id = p.empresa_id
         LEFT JOIN usuarios u ON p.usuario_id = u.id AND u.empresa_id = p.empresa_id
         WHERE p.empresa_id = ? ${loanUserFilter}
         ORDER BY p.created_at DESC`,
        shouldFilterByUser ? [companyId, userId] : [companyId]
      );

      // Normalizar interés si se guardó como porcentaje (ej. 12 -> 0.12)
      const prestamos = prestamosRows.map((p) => ({
        ...p,
        user_id: Number(p.user_id || 0),
        interes: p.interes > 1 ? p.interes / 100 : p.interes,
      }));

      const [cuotasResult] = await connection.query<RowDataPacket[]>(
        `SELECT s.id, p.usuario_id AS user_id, s.credito_id::text AS prestamo_id,
                s.num_cuota AS numero, s.fecha_vencimiento,
                s.monto_cuota::double precision AS monto,
                s.monto_pagado::double precision AS monto_pagado,
                s.mora::double precision AS mora,
                CASE
                  WHEN LOWER(s.estado) = 'pagado' THEN 0
                  WHEN s.fecha_vencimiento::date < CURRENT_DATE
                    THEN GREATEST(
                      COALESCE(s.dias_atraso_pago, 0),
                      CURRENT_DATE - s.fecha_vencimiento::date
                    )
                  ELSE COALESCE(s.dias_atraso_pago, 0)
                END AS dias_atraso,
                CASE
                  WHEN LOWER(s.estado) = 'pagado' THEN 'PAGADO'
                  WHEN s.fecha_vencimiento::date < CURRENT_DATE THEN 'VENCIDO'
                  ELSE 'PENDIENTE'
                END AS estado,
                s.fecha_pago AS fecha_pago_real
         FROM prestamos_cronogramas s
         JOIN prestamos_creditos p ON p.id = s.credito_id AND p.empresa_id = s.empresa_id
         WHERE s.empresa_id = ? ${scheduleUserFilter}
         ORDER BY s.credito_id ASC, s.num_cuota ASC`,
        shouldFilterByUser ? [companyId, userId] : [companyId]
      );

      const cuotasRows = cuotasResult.map((schedule) => ({
        ...schedule,
        id: Number(schedule.id),
        user_id: Number(schedule.user_id || 0),
        numero: Number(schedule.numero),
        dias_atraso: Number(schedule.dias_atraso || 0),
      }));

      const [pagosRows] = await connection.query<RowDataPacket[]>(
        `SELECT p.id::text AS id, p.usuario_id AS user_id, p.credito_id::text AS prestamo_id,
                p.cronograma_id AS cuota_id, p.num_cuota AS cuota_numero,
                c.numero_documento AS cliente_dni,
                p.monto_pagado::double precision AS monto, p.mora::double precision AS mora,
                p.fecha_pago::date AS fecha_pago, s.fecha_vencimiento,
                p.created_at AS fecha_registro,
                (LOWER(p.metodo_pago) LIKE '%saldo a favor%') AS usado_saldo_a_favor,
                p.metodo_pago, p.observacion AS nota
         FROM prestamos_pagos p
         JOIN clientes c ON c.id = p.cliente_id AND c.empresa_id = p.empresa_id
         LEFT JOIN prestamos_cronogramas s ON s.id = p.cronograma_id AND s.empresa_id = p.empresa_id
         WHERE p.empresa_id = ? ${paymentUserFilter}
         ORDER BY p.created_at DESC`,
        shouldFilterByUser ? [companyId, userId] : [companyId]
      );

      const [configRows] = await connection.query<RowDataPacket[]>(
        `SELECT e.id AS user_id,
                COALESCE(e.nombre_comercial, e.razon_social, 'GESTIÓN DE PRÉSTAMOS') AS nombre_marca,
                e.telefono,
                e.direccion, e.administrador_nombre AS representante, e.logo AS logo_base64,
                COALESCE(ec.configuracion_extra->>'dni_representante', '') AS dni_representante
         FROM empresas e
         LEFT JOIN empresas_config ec ON ec.empresa_id = e.id
         WHERE e.id = ? AND e.deleted_at IS NULL
         LIMIT 1`,
        [companyId]
      );

      const config = configRows[0] || {
        user_id: companyId,
        nombre_marca: 'GESTIÓN DE PRÉSTAMOS',
        telefono: '',
        direccion: '',
        representante: '',
        dni_representante: '',
        logo_base64: null,
      };

      res.json({
        success: true,
        source: 'Supabase PostgreSQL',
        isAdmin,
        userId,
        filterApplied: shouldFilterByUser,
        timestamp: new Date().toISOString(),
        data: {
          clientes: clientesRows,
          prestamos: prestamos,
          cuotas: cuotasRows,
          pagos: pagosRows,
          config: config,
        },
      });
    } finally {
      if (connection) connection.release();
    }
  } catch (error: any) {
    console.error('[API /data] Error al extraer datos de Supabase:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al consultar la base de datos',
    });
  }
});

// Helper function to map pagos fields to frontend formats
function mapPagos(rows: RowDataPacket[] | any[]) {
  return rows.map((r) => {
    const method = String(r.metodo_pago || '').toLowerCase();
    return {
      ...r,
      prestamoId: r.prestamo_id,
      cuotaNumero: Number(r.cuota_numero),
      clienteDni: r.cliente_dni,
      monto: Number(r.monto),
      mora: Number(r.mora || 0),
      fechaPago: r.fecha_pago,
      fechaVencimiento: r.fecha_vencimiento,
      fechaRegistro: r.fecha_registro,
      usadoSaldoAFavor: Boolean(r.usado_saldo_a_favor),
      tipo_operacion: method.includes('amort')
        ? 'AMORTIZACION'
        : method.includes('cancel')
          ? 'CANCELACION'
          : 'CUOTA',
    };
  });
}

function generatePagoId(prefix = 'PAG'): string {
  const timestamp = Date.now();
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${timestamp}-${random}`;
}

interface AvailableCreditNote {
  id: number;
  saldo_disponible: number;
}

function currencyToCents(value: number): number {
  return Math.round(value * 100);
}

async function loadAvailableCreditNotes(
  connection: DatabaseConnection,
  companyId: number,
  clientId: number
): Promise<AvailableCreditNote[]> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id, saldo_disponible
     FROM prestamos_notas_credito
     WHERE empresa_id = ? AND cliente_id = ? AND estado = 'DISPONIBLE'
       AND saldo_disponible > 0
     ORDER BY fecha_emision ASC, id ASC
     FOR UPDATE`,
    [companyId, clientId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    saldo_disponible: Number(row.saldo_disponible),
  }));
}

async function consumeCreditNotes(
  connection: DatabaseConnection,
  notes: AvailableCreditNote[],
  amount: number,
  paymentId: number | null
): Promise<number> {
  let remainingCents = currencyToCents(amount);
  let consumedCents = 0;

  for (const note of notes) {
    if (remainingCents <= 0) break;
    const availableCents = currencyToCents(note.saldo_disponible);
    const appliedCents = Math.min(availableCents, remainingCents);
    if (appliedCents <= 0) continue;

    const applied = appliedCents / 100;
    const newBalanceCents = availableCents - appliedCents;
    const newBalance = newBalanceCents / 100;
    const isExhausted = newBalanceCents === 0;
    await connection.query(
      `UPDATE prestamos_notas_credito
       SET saldo_disponible = ?,
           estado = CASE WHEN ? THEN 'APLICADA' ELSE estado END,
           fecha_aplicacion = CASE WHEN ? THEN NOW() ELSE fecha_aplicacion END,
           pago_aplicado_id = CASE
             WHEN ? AND ? > 0 THEN ?
             ELSE pago_aplicado_id
           END
       WHERE id = ?`,
      [
        newBalance,
        isExhausted,
        isExhausted,
        isExhausted,
        paymentId || 0,
        paymentId || 0,
        note.id,
      ]
    );
    note.saldo_disponible = newBalance;
    remainingCents -= appliedCents;
    consumedCents += appliedCents;
  }

  return consumedCents / 100;
}

async function setAvailableCreditBalance(
  connection: DatabaseConnection,
  companyId: number,
  clientId: number,
  creditId: number,
  userId: number,
  targetBalance: number
): Promise<void> {
  const notes = await loadAvailableCreditNotes(connection, companyId, clientId);
  const currentBalanceCents = notes.reduce(
    (sum, note) => sum + currencyToCents(note.saldo_disponible),
    0
  );
  const differenceCents = currencyToCents(Math.max(targetBalance, 0)) - currentBalanceCents;

  if (differenceCents > 0) {
    const difference = differenceCents / 100;
    await connection.query(
      `INSERT INTO prestamos_notas_credito
         (empresa_id, cliente_id, credito_origen_id, codigo_nota, monto, saldo_disponible,
          motivo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        clientId,
        creditId,
        generatePagoId('NC'),
        difference,
        difference,
        'Saldo a favor generado por amortización',
        userId,
      ]
    );
  } else if (differenceCents < 0) {
    const amountToConsume = -differenceCents / 100;
    const consumed = await consumeCreditNotes(connection, notes, amountToConsume, null);
    if (currencyToCents(consumed) < currencyToCents(amountToConsume)) {
      throw new Error('No fue posible ajustar el saldo a favor existente.');
    }
  }
}

async function insertLoanPayment(
  connection: DatabaseConnection,
  payment: {
    companyId: number;
    creditId: number;
    scheduleId: number;
    clientId: number;
    userId: number;
    quotaNumber: number;
    date: string;
    quotaAmount: number;
    paidAmount: number;
    lateFee: number;
    method: string;
    note: string | null;
  }
): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `INSERT INTO prestamos_pagos
       (empresa_id, credito_id, cronograma_id, cliente_id, usuario_id, num_operacion,
        num_cuota, fecha_pago, monto_cuota, mora, monto_pagado, metodo_pago, observacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      payment.companyId,
      payment.creditId,
      payment.scheduleId,
      payment.clientId,
      payment.userId,
      generatePagoId(),
      payment.quotaNumber,
      payment.date,
      payment.quotaAmount,
      payment.lateFee,
      payment.paidAmount,
      payment.method,
      payment.note,
    ]
  );
  return Number(rows[0]?.id);
}

// 3. GET /pagos (list, byPrestamo, byFecha, estadisticas)
apiRouter.get('/pagos', async (req, res) => {
  const action = (req.query.action as string) || 'list';
  if (!req.auth || !hasPermission(req.auth, 'prestamos_pagos', 'prestamos_cobranza_diaria')) {
    return res.status(403).json({ success: false, error: 'Tu rol no tiene acceso al módulo de pagos.' });
  }
  const isAdmin = isCompanyAdmin(req.auth);
  const userId = isAdmin ? null : req.auth.userId;
  let connection: DatabaseConnection | undefined;

  try {
    connection = await pool.getConnection();
    const companyId = req.auth.companyId;

    const userFilter = userId === null ? '' : ' AND p.usuario_id = ?';
    const baseParams = userId === null ? [companyId] : [companyId, userId];
    const paymentSelect = `SELECT p.id::text AS id, p.usuario_id AS user_id,
                                  p.credito_id::text AS prestamo_id, p.cronograma_id AS cuota_id,
                                  p.num_cuota AS cuota_numero, c.numero_documento AS cliente_dni,
                                  p.monto_pagado::double precision AS monto,
                                  p.mora::double precision AS mora, p.fecha_pago::date AS fecha_pago,
                                  s.fecha_vencimiento, p.created_at AS fecha_registro,
                                  (LOWER(p.metodo_pago) LIKE '%saldo a favor%') AS usado_saldo_a_favor,
                                  p.metodo_pago, p.observacion AS nota,
                                  CONCAT_WS(' ', u.nombres, u.apellidos) AS owner_name
                           FROM prestamos_pagos p
                           JOIN clientes c ON c.id = p.cliente_id AND c.empresa_id = p.empresa_id
                           LEFT JOIN prestamos_cronogramas s ON s.id = p.cronograma_id AND s.empresa_id = p.empresa_id
                           LEFT JOIN usuarios u ON u.id = p.usuario_id AND u.empresa_id = p.empresa_id
                           WHERE p.empresa_id = ?`;

    switch (action) {
      case 'list': {
        const [rows] = await connection.query<RowDataPacket[]>(
          `${paymentSelect}${userFilter} ORDER BY p.created_at DESC`,
          baseParams
        );
        return res.json({ success: true, data: mapPagos(rows) });
      }

      case 'byPrestamo': {
        const prestamoId = (req.query.id as string) || '';
        if (!prestamoId) {
          return res.status(400).json({ success: false, error: 'Falta el ID de préstamo' });
        }
        const [rows] = await connection.query<RowDataPacket[]>(
          `${paymentSelect} AND p.credito_id = ?${userFilter} ORDER BY p.num_cuota ASC`,
          [companyId, prestamoId, ...(userId === null ? [] : [userId])]
        );
        return res.json({ success: true, data: mapPagos(rows) });
      }

      case 'byFecha': {
        const fecha = (req.query.fecha as string) || new Date().toISOString().slice(0, 10);
        const [rows] = await connection.query<RowDataPacket[]>(
          `${paymentSelect} AND p.fecha_pago::date = ?${userFilter} ORDER BY p.created_at ASC`,
          [companyId, fecha, ...(userId === null ? [] : [userId])]
        );
        return res.json({ success: true, data: mapPagos(rows) });
      }

      case 'estadisticas': {
        const [totalRows] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS total FROM prestamos_pagos p
           WHERE p.empresa_id = ?${userFilter}`,
          baseParams
        );
        const total = totalRows[0]?.total || 0;

        const hoy = new Date().toISOString().slice(0, 10);
        const [hoyRows] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS count, COALESCE(SUM(p.monto_pagado), 0) AS "montoHoy"
           FROM prestamos_pagos p
           WHERE p.empresa_id = ? AND p.fecha_pago::date = ?
             AND p.metodo_pago NOT ILIKE '%saldo a favor%'${userFilter}`,
          [companyId, hoy, ...(userId === null ? [] : [userId])]
        );
        const pagosHoy = hoyRows[0]?.count || 0;
        const montoHoy = hoyRows[0]?.montoHoy || 0;

        const userCuotaFilter = userId === null ? '' : 'AND pr.usuario_id = ?';
        const [vencidasRows] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS count
           FROM prestamos_cronogramas c
           JOIN prestamos_creditos pr ON c.credito_id = pr.id AND c.empresa_id = pr.empresa_id
           WHERE c.empresa_id = ? AND c.estado = 'pendiente'
             AND c.fecha_vencimiento < ?
             AND pr.estado_credito IN ('VIGENTE', 'VENCIDO') ${userCuotaFilter}`,
          [companyId, hoy, ...(userId === null ? [] : [userId])]
        );
        const cuotasVencidas = vencidasRows[0]?.count || 0;

        const [montoTotalRows] = await connection.query<RowDataPacket[]>(
          `SELECT COALESCE(SUM(p.monto_pagado), 0) AS "montoTotal"
           FROM prestamos_pagos p
           WHERE p.empresa_id = ? AND p.metodo_pago NOT ILIKE '%saldo a favor%'${userFilter}`,
          baseParams
        );
        const montoTotal = montoTotalRows[0]?.montoTotal || 0;

        return res.json({
          success: true,
          data: {
            totalPagos: Number(total),
            pagosHoy: Number(pagosHoy),
            montoRecaudadoHoy: Number(montoHoy),
            cuotasVencidas: Number(cuotasVencidas),
            montoTotalCobrado: Number(montoTotal),
          },
        });
      }

      default:
        return res.status(400).json({ success: false, error: 'Acción no válida' });
    }
  } catch (error: any) {
    console.error('[API /pagos] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Sub-rutas específicas para conveniencia
apiRouter.get('/pagos/list', async (req, res) => {
  req.query.action = 'list';
  (apiRouter as any).handle(req, res);
});

apiRouter.get('/pagos/estadisticas', async (req, res) => {
  req.query.action = 'estadisticas';
  (apiRouter as any).handle(req, res);
});

apiRouter.get('/pagos/prestamo/:id', async (req, res) => {
  req.query.action = 'byPrestamo';
  req.query.id = req.params.id;
  (apiRouter as any).handle(req, res);
});

apiRouter.get('/pagos/fecha/:fecha', async (req, res) => {
  req.query.action = 'byFecha';
  req.query.fecha = req.params.fecha;
  (apiRouter as any).handle(req, res);
});

// 4. POST /pagos - Procesar Pago (Lógica completa de pagos.php con soporte para payload directo o de frontend)
apiRouter.post('/pagos', async (req, res) => {
  if (!req.auth || !hasPermission(req.auth, 'prestamos_pagos', 'prestamos_cobranza_diaria')) {
    return res.status(403).json({ success: false, error: 'Tu rol no tiene permiso para registrar pagos.' });
  }
  const body = req.body;
  let connection: DatabaseConnection | undefined;

  try {
    connection = await pool.getConnection();
    const { companyId, userId } = req.auth;
    await connection.beginTransaction();

    let prestamoId = '';
    let clienteDni = '';
    let fechaPago = new Date().toISOString().slice(0, 10);
    let itemsPagos: Array<{
      cuotaId: number;
      cuotaNumero: number;
      monto: number;
      mora: number;
      diasAtraso?: number;
      fechaVencimiento?: string;
    }> = [];
    let usarSaldo = false;
    let paymentMethod = 'Efectivo';
    let paymentNote: string | null = null;

    if (body.prestamoId && body.clienteDni && Array.isArray(body.pagos)) {
      prestamoId = String(body.prestamoId).trim();
      clienteDni = String(body.clienteDni).trim();
      fechaPago = body.fechaPago ? String(body.fechaPago).trim() : fechaPago;
      itemsPagos = body.pagos;
      usarSaldo = Boolean(body.usarSaldo);
    } else if (body.recibo && body.updatedCliente && body.updatedPrestamo) {
      prestamoId = String(body.updatedPrestamo.id).trim();
      clienteDni = String(body.updatedCliente.dni).trim();
      usarSaldo = (body.recibo.saldo_favor_usado || 0) > 0;
      paymentMethod = body.recibo.metodo_pago || paymentMethod;
      paymentNote = body.recibo.observaciones || null;

      if (Array.isArray(body.recibo.cuotas_afectadas) && body.recibo.cuotas_afectadas.length > 0) {
        itemsPagos = body.recibo.cuotas_afectadas.map((c: any) => ({
          cuotaId: Number(c.id || 0),
          cuotaNumero: Number(c.numero || 0),
          monto: Number(c.monto || 0),
          mora: Number(c.mora || 0),
          diasAtraso: 0,
          fechaVencimiento: undefined,
        }));
      }
    }

    if (!prestamoId || !clienteDni || itemsPagos.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Faltan datos para procesar el pago' });
    }
    if (
      itemsPagos.some((item) => {
        const amount = Number(item.monto);
        const lateFee = Number(item.mora);
        return (
          (!Number.isSafeInteger(Number(item.cuotaId)) || Number(item.cuotaId) < 0) ||
          (!Number.isSafeInteger(Number(item.cuotaNumero)) || Number(item.cuotaNumero) < 0) ||
          !Number.isFinite(amount) ||
          !Number.isFinite(lateFee) ||
          amount < 0 ||
          lateFee < 0 ||
          (Number(item.cuotaId) === 0 && Number(item.cuotaNumero) === 0) ||
          (amount === 0 && lateFee === 0)
        );
      })
    ) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Los datos de las cuotas no son válidos' });
    }

    const [loanRows] = await connection.query<RowDataPacket[]>(
      `SELECT p.id, p.empresa_id, p.cliente_id, p.usuario_id, p.estado_credito,
              c.numero_documento AS cliente_dni
       FROM prestamos_creditos p
       JOIN clientes c ON c.id = p.cliente_id AND c.empresa_id = p.empresa_id
       WHERE p.id = ? AND p.empresa_id = ? ${isCompanyAdmin(req.auth) ? '' : 'AND p.usuario_id = ?'}
       FOR UPDATE OF p`,
      isCompanyAdmin(req.auth) ? [prestamoId, companyId] : [prestamoId, companyId, userId]
    );
    const loan = loanRows[0];
    if (!loan || loan.cliente_dni !== clienteDni) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Préstamo o cliente no encontrado en esta empresa' });
    }

    const notes = usarSaldo
      ? await loadAvailableCreditNotes(connection, companyId, Number(loan.cliente_id))
      : [];
    let saldoDisponibleCents = notes.reduce(
      (sum, note) => sum + currencyToCents(note.saldo_disponible),
      0
    );

    for (const p of itemsPagos) {
      const cuotaId = Number(p.cuotaId || 0);
      const cuotaNumero = Number(p.cuotaNumero || 0);
      const montoTotal = Number(p.monto || 0);
      const mora = Number(p.mora || 0);
      const diasAtraso = Number(p.diasAtraso || 0);
      let vencimiento = p.fechaVencimiento ? String(p.fechaVencimiento).trim() : '';

      // Obtener información exacta de la cuota para evitar errores de FK
      let cRow: RowDataPacket | undefined;
      if (cuotaId > 0) {
        const [cRows] = await connection.query<RowDataPacket[]>(
          `SELECT id, credito_id, num_cuota, fecha_vencimiento, monto_cuota,
                  monto_pagado, mora
           FROM prestamos_cronogramas
           WHERE id = ? AND credito_id = ? AND empresa_id = ?
           FOR UPDATE`,
          [cuotaId, loan.id, companyId]
        );
        cRow = cRows[0];
      }

      if (!cRow && cuotaNumero > 0) {
        const [cRows] = await connection.query<RowDataPacket[]>(
          `SELECT id, credito_id, num_cuota, fecha_vencimiento, monto_cuota,
                  monto_pagado, mora
           FROM prestamos_cronogramas
           WHERE credito_id = ? AND num_cuota = ? AND empresa_id = ?
           FOR UPDATE`,
          [loan.id, cuotaNumero, companyId]
        );
        cRow = cRows[0];
      }

      if (!cRow) {
        await connection.rollback();
        return res.status(404).json({ success: false, error: `No se encontró la cuota ${cuotaNumero}` });
      }

      const actualCuotaId = Number(cRow.id);
      const actualNumero = Number(cRow.num_cuota);
      const montoCuota = Number(cRow.monto_cuota);
      if (!vencimiento) {
        vencimiento = cRow.fecha_vencimiento || fechaPago;
      }

      const montoTotalCents = currencyToCents(montoTotal);
      const montoDeSaldoCents = Math.min(montoTotalCents, saldoDisponibleCents);
      const montoDeSaldo = montoDeSaldoCents / 100;
      const montoEfectivo = (montoTotalCents - montoDeSaldoCents) / 100;
      saldoDisponibleCents -= montoDeSaldoCents;

      if (montoDeSaldo > 0) {
        const paymentId = await insertLoanPayment(connection, {
          companyId,
          creditId: Number(loan.id),
          scheduleId: actualCuotaId,
          clientId: Number(loan.cliente_id),
          userId,
          quotaNumber: actualNumero,
          date: fechaPago,
          quotaAmount: montoCuota,
          paidAmount: montoDeSaldo,
          lateFee: 0,
          method: 'Saldo a favor',
          note: paymentNote,
        });
        await consumeCreditNotes(connection, notes, montoDeSaldo, paymentId);
      }

      if (montoEfectivo > 0 || (montoTotal <= 0 && mora > 0)) {
        await insertLoanPayment(connection, {
          companyId,
          creditId: Number(loan.id),
          scheduleId: actualCuotaId,
          clientId: Number(loan.cliente_id),
          userId,
          quotaNumber: actualNumero,
          date: fechaPago,
          quotaAmount: montoCuota,
          paidAmount: montoEfectivo,
          lateFee: mora,
          method: paymentMethod,
          note: paymentNote,
        });
      }

      const nuevoMontoPagado =
        (currencyToCents(Number(cRow.monto_pagado)) + currencyToCents(montoTotal)) / 100;
      const cuotaPagada = nuevoMontoPagado >= montoCuota;
      await connection.query(
        `UPDATE prestamos_cronogramas
         SET monto_pagado = ?, mora = mora + ?, dias_atraso_pago = ?,
             registro_atraso = ?, saldo_restante = GREATEST(monto_cuota - ?, 0),
             estado = CASE WHEN ? THEN 'pagado' ELSE estado END,
             fecha_pago = CASE WHEN ? THEN ?::timestamp ELSE fecha_pago END
         WHERE id = ? AND credito_id = ? AND empresa_id = ?`,
        [
          nuevoMontoPagado,
          mora,
          diasAtraso,
          diasAtraso > 0,
          nuevoMontoPagado,
          cuotaPagada,
          cuotaPagada,
          fechaPago,
          actualCuotaId,
          loan.id,
          companyId,
        ]
      );
    }

    const [pendingRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM prestamos_cronogramas
       WHERE credito_id = ? AND empresa_id = ? AND estado <> 'pagado'`,
      [loan.id, companyId]
    );

    const terminado = Number(pendingRows[0]?.count || 0) === 0;
    const [balanceRows] = await connection.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(saldo_restante), 0) AS balance
       FROM prestamos_cronogramas
       WHERE credito_id = ? AND empresa_id = ?`,
      [loan.id, companyId]
    );
    await connection.query(
      `UPDATE prestamos_creditos
       SET saldo_restante = ?,
           estado_credito = CASE WHEN ? THEN 'CANCELADO' ELSE estado_credito END,
           updated_at = NOW()
       WHERE id = ? AND empresa_id = ?`,
      [Math.max(Number(balanceRows[0]?.balance || 0), 0), terminado, loan.id, companyId]
    );

    await connection.commit();
    console.log(`[API /pagos] ✅ Pagos procesados exitosamente para préstamo ${prestamoId}. Terminado: ${terminado}`);

    res.status(201).json({
      success: true,
      terminado,
      data: { terminado },
      message: 'Pago(s) procesado(s) correctamente',
    });
  } catch (error: any) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('[API /pagos] ❌ Error en transacción PostgreSQL:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 4. Registrar Amortización en PostgreSQL
apiRouter.post('/amortizacion', async (req, res) => {
  if (!req.auth || !hasPermission(req.auth, 'prestamos_pagos', 'prestamos_creditos')) {
    return res.status(403).json({ success: false, error: 'Tu rol no tiene permiso para amortizar préstamos.' });
  }
  const { recibo, updatedCuotas, updatedCliente, updatedPrestamo } = req.body;

  if (!recibo || !updatedCliente || !updatedPrestamo || !updatedCuotas) {
    return res.status(400).json({ success: false, error: 'Datos de amortización incompletos' });
  }

  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const { companyId, userId } = req.auth;
    await connection.beginTransaction();

    const [pRows] = await connection.query<RowDataPacket[]>(
      `SELECT p.id, p.empresa_id, p.cliente_id, p.usuario_id, p.estado_credito,
              p.saldo_restante,
              c.numero_documento AS cliente_dni
       FROM prestamos_creditos p
       JOIN clientes c ON c.id = p.cliente_id AND c.empresa_id = p.empresa_id
       WHERE p.id = ? AND p.empresa_id = ? ${isCompanyAdmin(req.auth) ? '' : 'AND p.usuario_id = ?'}
       FOR UPDATE OF p`,
      isCompanyAdmin(req.auth) ? [updatedPrestamo.id, companyId] : [updatedPrestamo.id, companyId, userId]
    );
    const dbPrestamo = pRows[0];
    if (!dbPrestamo || dbPrestamo.cliente_dni !== updatedCliente.dni) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Préstamo o cliente no encontrado en esta empresa' });
    }
    const [dbCuotas] = await connection.query<RowDataPacket[]>(
      `SELECT id, credito_id, num_cuota, fecha_vencimiento, monto_cuota, monto_pagado,
              mora, estado, saldo_restante
       FROM prestamos_cronogramas
       WHERE credito_id = ? AND empresa_id = ?
       ORDER BY num_cuota`,
      [dbPrestamo.id, companyId]
    );
    const cuotaByNumero = new Map<number, RowDataPacket>(
      dbCuotas.map((c) => [Number(c.num_cuota), c])
    );
    const cuotaById = new Map<number, RowDataPacket>(
      dbCuotas.map((c) => [Number(c.id), c])
    );

    const todayDate = new Date().toISOString().slice(0, 10);
    let updatedSchedules = 0;

    for (const cuota of updatedCuotas) {
      if (cuota.prestamo_id === updatedPrestamo.id) {
        const matchedDbCuota =
          cuotaById.get(Number(cuota.id)) || cuotaByNumero.get(Number(cuota.numero));
        if (matchedDbCuota) {
          const paid = Number(cuota.monto_pagado || 0);
          const amount = Number(cuota.monto || 0);
          const estado = cuota.estado === 'PAGADO' ? 'pagado' : 'pendiente';
          await connection.query(
            `UPDATE prestamos_cronogramas
             SET monto_cuota = ?, monto_pagado = ?, mora = ?, estado = ?, fecha_pago = ?,
                 saldo_restante = GREATEST(? - ?, 0), dias_atraso_pago = ?,
                 registro_atraso = ?
             WHERE id = ? AND credito_id = ? AND empresa_id = ?`,
            [
              amount,
              paid,
              cuota.mora,
              estado,
              cuota.fecha_pago_real || (estado === 'pagado' ? todayDate : null),
              amount,
              paid,
              Number(cuota.dias_atraso || 0),
              Number(cuota.dias_atraso || 0) > 0,
              matchedDbCuota.id,
              dbPrestamo.id,
              companyId,
            ]
          );
          updatedSchedules += 1;
        }
      }
    }

    if (updatedSchedules === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'No se encontró ninguna cuota para actualizar' });
    }

    const loanStatus =
      updatedPrestamo.estado === 'TERMINADO'
        ? 'CANCELADO'
        : dbPrestamo.estado_credito === 'VENCIDO'
          ? 'VENCIDO'
          : 'VIGENTE';
    const requestedBalance = Number(recibo.saldo_restante_prestamo);
    const remainingBalance = Number.isFinite(requestedBalance)
      ? Math.max(requestedBalance, 0)
      : Number(dbPrestamo.saldo_restante);
    await connection.query(
      `UPDATE prestamos_creditos
       SET estado_credito = ?, saldo_restante = ?, updated_at = NOW()
       WHERE id = ? AND empresa_id = ?`,
      [loanStatus, remainingBalance, dbPrestamo.id, companyId]
    );

    await setAvailableCreditBalance(
      connection,
      companyId,
      Number(dbPrestamo.cliente_id),
      Number(dbPrestamo.id),
      userId,
      Number(updatedCliente.saldo_a_favor || 0)
    );

    const refCuota = dbCuotas.find((c) => c.estado !== 'pagado') || dbCuotas[0];
    if (!refCuota) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'El préstamo no tiene cuotas registradas' });
    }
    await insertLoanPayment(connection, {
      companyId,
      creditId: Number(dbPrestamo.id),
      scheduleId: Number(refCuota.id),
      clientId: Number(dbPrestamo.cliente_id),
      userId,
      quotaNumber: Number(refCuota.num_cuota),
      date: todayDate,
      quotaAmount: Number(refCuota.monto_cuota),
      paidAmount: Number(recibo.total_cobrado || 0),
      lateFee: Number(recibo.total_mora || 0),
      method: recibo.metodo_pago || 'Efectivo',
      note: recibo.observaciones || 'Pago por amortización',
    });

    await connection.commit();
    console.log(`[API /amortizacion] ✅ Amortización registrada con éxito para préstamo ${updatedPrestamo.id}, monto: ${recibo.total_cobrado}`);
    res.json({ success: true, message: 'Amortización guardada exitosamente en Supabase' });
  } catch (error: any) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('[API /amortizacion] ❌ Error en amortización PostgreSQL:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 5. Anular Préstamo en PostgreSQL
apiRouter.post('/anular-prestamo', async (req, res) => {
  if (!req.auth || !hasPermission(req.auth, 'prestamos_creditos')) {
    return res.status(403).json({ success: false, error: 'Tu rol no tiene permiso para anular préstamos.' });
  }
  const { prestamo_id, motivo } = req.body;

  if (!prestamo_id) {
    return res.status(400).json({ success: false, error: 'ID de préstamo requerido' });
  }

  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const { companyId, userId } = req.auth;
    const ownerFilter = isCompanyAdmin(req.auth) ? '' : 'AND usuario_id = ?';
    const values = isCompanyAdmin(req.auth)
      ? [motivo || 'Anulado por usuario', prestamo_id, companyId]
      : [motivo || 'Anulado por usuario', prestamo_id, companyId, userId];
    await connection.beginTransaction();

    const [updated] = await connection.query<RowDataPacket[]>(
      `UPDATE prestamos_creditos
       SET estado_credito = 'CANCELADO', motivo_anulacion = ?, fecha_anulacion = NOW(),
           updated_at = NOW()
       WHERE id = ? AND empresa_id = ? AND estado_credito IN ('VIGENTE', 'VENCIDO') ${ownerFilter}
       RETURNING id`,
      values
    );
    if (!updated.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Préstamo activo no encontrado en esta empresa' });
    }

    await connection.commit();
    console.log(`[API /anular-prestamo] ✅ Préstamo ${prestamo_id} anulado en Supabase`);
    res.json({ success: true, message: 'Préstamo anulado exitosamente en Supabase' });
  } catch (error: any) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('[API /anular-prestamo] ❌ Error al anular préstamo PostgreSQL:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 6. Crear o Actualizar Cliente en PostgreSQL
apiRouter.post('/clientes', async (req, res) => {
  if (!req.auth || !hasPermission(req.auth, 'prestamos_clientes')) {
    return res.status(403).json({ success: false, error: 'Tu rol no tiene permiso para gestionar clientes.' });
  }
  const cliente = req.body;
  if (!cliente || !cliente.dni || !cliente.nombres || !cliente.apellidos) {
    return res.status(400).json({ success: false, error: 'Datos de cliente incompletos' });
  }

  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const { companyId, userId } = req.auth;
    const advisorId = isCompanyAdmin(req.auth) ? Number(cliente.user_id || userId) : userId;
    if (!Number.isSafeInteger(advisorId) || advisorId <= 0) {
      return res.status(400).json({ success: false, error: 'Debe asignar un asesor válido al cliente' });
    }
    await connection.beginTransaction();
    const [advisorRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM usuarios
       WHERE id = ? AND empresa_id = ? AND estado::text = 'activo' AND deleted_at IS NULL`,
      [advisorId, companyId]
    );
    if (!advisorRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'El asesor no pertenece a esta empresa o está inactivo' });
    }

    const estado = String(cliente.estado || 'ACTIVO').toUpperCase() === 'INACTIVO'
      ? 'inactivo'
      : 'activo';
    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, asesor_id FROM clientes
       WHERE empresa_id = ? AND numero_documento = ?
       ORDER BY deleted_at NULLS FIRST, id
       LIMIT 1
       FOR UPDATE`,
      [companyId, String(cliente.dni).trim()]
    );
    if (
      existingRows.length &&
      !isCompanyAdmin(req.auth) &&
      Number(existingRows[0].asesor_id) !== userId
    ) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: 'El cliente no está asignado a tu usuario.' });
    }
    const codigo = cliente.codigo || `C${Math.floor(10000 + Math.random() * 90000)}`;

    if (existingRows.length) {
      await connection.query(
        `UPDATE clientes
         SET codigo_cliente = ?, nombres_razon_social = ?, nombres = ?, apellidos = ?,
             direccion = ?, telefono = ?, asesor_id = ?, estado = ?::estado_enum,
             deleted_at = NULL, updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [
          codigo,
          `${String(cliente.nombres).trim()} ${String(cliente.apellidos).trim()}`.trim(),
          String(cliente.nombres).trim(),
          String(cliente.apellidos).trim(),
          cliente.direccion || null,
          cliente.telefono || null,
          advisorId,
          estado,
          existingRows[0].id,
          companyId,
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO clientes
           (empresa_id, tipo_documento, numero_documento, nombres_razon_social, nombres,
            apellidos, direccion, telefono, estado, codigo_cliente, asesor_id)
         VALUES (?, 'DNI', ?, ?, ?, ?, ?, ?, ?::estado_enum, ?, ?)`,
        [
          companyId,
          String(cliente.dni).trim(),
          `${String(cliente.nombres).trim()} ${String(cliente.apellidos).trim()}`.trim(),
          String(cliente.nombres).trim(),
          String(cliente.apellidos).trim(),
          cliente.direccion || null,
          cliente.telefono || null,
          estado,
          codigo,
          advisorId,
        ]
      );
    }

    await connection.commit();
    console.log('[API /clientes] ✅ Cliente guardado en Supabase');
    res.json({ success: true, message: 'Cliente guardado en Supabase' });
  } catch (error: any) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('[API /clientes] ❌ Error al guardar cliente en Supabase:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 7. Guardar Configuración de Empresa en PostgreSQL
apiRouter.post('/config', async (req, res) => {
  if (!req.auth || !hasPermission(req.auth, 'configuracion')) {
    return res.status(403).json({ success: false, error: 'Tu rol no tiene permiso para cambiar la configuración.' });
  }
  const config = req.body;
  if (!config || !config.nombre_marca) {
    return res.status(400).json({ success: false, error: 'Configuración inválida' });
  }

  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const companyId = req.auth.companyId;
    await connection.beginTransaction();
    const [updatedCompanies] = await connection.query<RowDataPacket[]>(
      `UPDATE empresas
       SET nombre_comercial = ?, telefono = ?, direccion = ?, administrador_nombre = ?,
           logo = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL
       RETURNING id`,
      [
        config.nombre_marca,
        config.telefono || null,
        config.direccion || null,
        config.representante || null,
        config.logo_base64 || null,
        companyId,
      ]
    );
    if (!updatedCompanies.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'No se encontró la empresa configurada en Supabase' });
    }
    await connection.query(
      `UPDATE empresas_config
       SET configuracion_extra = COALESCE(configuracion_extra, '{}'::jsonb)
             || jsonb_build_object('dni_representante', ?::text),
           updated_at = NOW()
       WHERE empresa_id = ?`,
      [config.dni_representante || null, companyId]
    );

    await connection.commit();
    console.log(`[API /config] ✅ Configuración guardada en Supabase`);
    res.json({ success: true, message: 'Configuración guardada en Supabase' });
  } catch (error: any) {
    console.error('[API /config] ❌ Error al guardar configuración Supabase:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});
