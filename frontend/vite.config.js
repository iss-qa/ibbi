import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    strictPort: true, // não pular para 4174/4175; o stop-dev libera a porta
    host: '0.0.0.0',
  },
});
