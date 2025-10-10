import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  root: 'src',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
