import { defineConfig } from 'vite';

export default defineConfig({
  // './' permite rodar no GitHub Pages (subpasta /ludo3d/), no Electron e no Capacitor
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  }
});
