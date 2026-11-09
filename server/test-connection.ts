import { testDbConnection } from './db';

async function main() {
  console.log('🔍 Probando conexión a Supabase PostgreSQL...');
  const res = await testDbConnection();
  if (res.connected) {
    console.log('✅ ¡Conexión exitosa a Supabase!');
    console.log(`📡 Base de datos: ${res.database} en ${res.host}:${res.port} (Ping: ${res.pingMs}ms)`);
    console.log(`📊 Tablas detectadas: ${res.tablesCount}`);
  } else {
    console.error('❌ Error de conexión:', res.error);
  }
  process.exit(0);
}

main();
