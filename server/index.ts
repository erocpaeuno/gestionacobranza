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
