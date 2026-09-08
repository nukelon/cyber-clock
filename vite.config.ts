import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
export default defineConfig({
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  build: { cssCodeSplit: false, chunkSizeWarningLimit: 1800 },
  server: { host: '127.0.0.1' },
});
