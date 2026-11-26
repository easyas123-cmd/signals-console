import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static build. base './' so the bundle works at any mount point; every asset
// (fonts, geo basemap) is vendored under public/, so there is no CDN or runtime egress.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    target: 'es2022',
  },
});
