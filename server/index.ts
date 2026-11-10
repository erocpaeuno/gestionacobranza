import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { apiRouter } from './routes';
import { testDbConnection } from './db';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Registrar rutas de la API
app.use('/api', apiRouter);

// Ruta raíz (evita "Cannot GET /" y muestra el estado del servidor)
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>API Gestión de Cobranzas</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; box-sizing: border-box; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2.5rem 2rem; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
          .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 12px; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
          .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
          h1 { margin: 0 0 0.5rem; font-size: 1.5rem; color: #ffffff; }
          p { color: #94a3b8; font-size: 0.95rem; margin: 0 0 1.5rem; line-height: 1.5; }
          .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.875rem; transition: background 0.2s; }
          .btn:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge"><span class="dot"></span> Servidor API Activo</div>
          <h1>Gestión de Cobranzas y Pagos</h1>
          <p>El backend Express en Render está ejecutándose correctamente y listo para recibir peticiones de la app móvil.</p>
          <a class="btn" href="/api/status" target="_blank">Verificar estado de Base de Datos (/api/status)</a>
        </div>
      </body>
      </html>
    `);
  }
  res.json({
    status: 'online',
    message: 'Servidor API de Gestión de Cobranzas y Pagos activo',
    healthCheck: '/api/status',
  });
});

// Inicio del servidor
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor API Gestión Préstamos activo en puerto ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}/api`);
  console.log(`====================================================`);

  const status = await testDbConnection();
  if (status.connected) {
    console.log(`✅ Conexión exitosa a Supabase PostgreSQL: [${status.database}] en ${status.host}:${status.port}`);
  } else {
    console.error(`❌ Error al conectar a Supabase: ${status.error}`);
    console.warn(`⚠️ Verifica SUPABASE_DATABASE_URL y que existan las tablas requeridas en Supabase.`);
  }
});

export default app;
