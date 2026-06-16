import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâA?A?A"file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true' ? {
        // Use port 24780 (far from Vite's default 24678) to avoid conflicts
        // with other dev servers the user may be running.
        port: 24780,
        clientPort: 24780,
      } : false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // Ignore the data/ directory so writes to manual-image-overrides.json
        // and other data files don't trigger a full page reload.
        ignored: ['**/data/**'],
      },
    },
  };
});
