import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,   // expose to local network so mobile can access
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true, ws: true },
    },
  },
});
