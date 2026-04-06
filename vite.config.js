import { defineConfig } from 'vite';

export default defineConfig({
  // Vercel handles the base path automatically for the root domain
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
