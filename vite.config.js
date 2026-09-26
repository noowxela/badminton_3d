import { defineConfig } from 'vite';

export default defineConfig({
  base: '/badminton_3d/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
