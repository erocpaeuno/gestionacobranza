import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { defineConfig } from 'vite';
import { apiRouter } from './server/routes';

// Protección para que errores de socket o DNS externos no cierren el proceso
process.on('unhandledRejection', (reason: any) => {
  console.warn('[Vite Server - Error de Promesa capturado]:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.warn('[Vite Server - Excepción no capturada]:', err?.message || err);
});

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'supabase-api-middleware',
        configureServer(server) {
          const app = express();
          app.use(cors());
          app.use(express.json({ limit: '50mb' }));
          app.use(express.urlencoded({ extended: true, limit: '50mb' }));
          app.use('/api', apiRouter);
          server.middlewares.use(app);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
