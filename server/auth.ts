import { createHmac, createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { pool, RowDataPacket } from './db';
import type { DatabaseConnection } from './db';

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_SECRET = process.env.APP_SESSION_SECRET;

if (!SESSION_SECRET || Buffer.byteLength(SESSION_SECRET) < 32) {
  throw new Error('Configura APP_SESSION_SECRET con al menos 32 caracteres aleatorios.');
}

export interface AuthContext {
  userId: number;
  companyId: number;
  roleId: number;
  roleName: string;
  permissions: string[];
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function getSigningKey(): Buffer {
  return createHash('sha256').update(`prestamos-session-v1:${SESSION_SECRET}`).digest();
}

function sign(payload: string): string {
  return createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
}

export function createSessionToken(userId: number, companyId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, company: companyId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string): { userId: number; companyId: number } | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  const expected = Buffer.from(sign(payload), 'base64url');
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      !Number.isSafeInteger(claims.sub) ||
      claims.sub <= 0 ||
      !Number.isSafeInteger(claims.company) ||
      claims.company <= 0 ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { userId: claims.sub, companyId: claims.company };
  } catch {
    return null;
  }
}

export function hasPermission(auth: AuthContext, ...modules: string[]): boolean {
  return modules.some((module) => auth.permissions.includes(module));
}

export function isCompanyAdmin(auth: AuthContext): boolean {
  return /admin/i.test(auth.roleName);
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.header('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const claims = token ? readSessionToken(token) : null;
  if (!claims) {
    res.status(401).json({ success: false, error: 'Sesión inválida o vencida. Inicia sesión nuevamente.' });
    return;
  }

  let connection: DatabaseConnection | undefined;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT u.id, u.empresa_id, u.rol_id, u.usuario, u.permisos_modulos,
              r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
       JOIN empresas e ON e.id = u.empresa_id
       WHERE u.id = ? AND u.empresa_id = ?
         AND u.estado::text = 'activo' AND u.deleted_at IS NULL
         AND (u.bloqueado_hasta IS NULL OR u.bloqueado_hasta <= NOW())
         AND r.estado::text = 'activo' AND r.deleted_at IS NULL
         AND e.estado::text = 'activo' AND e.activo = TRUE AND e.deleted_at IS NULL`,
      [claims.userId, claims.companyId]
    );
    const user = rows[0];
    if (!user) {
      res.status(401).json({ success: false, error: 'La cuenta o empresa está inactiva. Inicia sesión nuevamente.' });
      return;
    }

    let permissions: unknown = user.permisos_modulos;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch {
        permissions = [];
      }
    }

    req.auth = {
      userId: Number(user.id),
      companyId: Number(user.empresa_id),
      roleId: Number(user.rol_id),
      roleName: String(user.rol_nombre),
      username: String(user.usuario),
      permissions: Array.isArray(permissions)
        ? permissions.filter((permission): permission is string => typeof permission === 'string')
        : [],
    };
    next();
  } catch (error) {
    next(error);
  } finally {
    connection?.release();
  }
}
