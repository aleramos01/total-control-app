import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildTime = Date.now();

export default defineConfig({
  server: {
    port: 3000,
    host: '127.0.0.1',
  },
  define: {
    // Bakes the build timestamp into the JS bundle so the app knows its own version
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    {
      // Writes public/version.json at build time so the deployed server can serve it.
      // The app polls this file every 60s; a changed buildTime triggers an auto-reload.
      name: 'write-version-json',
      buildStart() {
        const publicDir = path.resolve(__dirname, 'public');
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(
          path.join(publicDir, 'version.json'),
          JSON.stringify({ buildTime }),
        );
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
