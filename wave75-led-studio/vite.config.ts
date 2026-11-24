import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { wave75AutoDriverPlugin } from './wave75DriverPlugin.mjs';

export default defineConfig({
  plugins: [react(), tailwindcss(), wave75AutoDriverPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
