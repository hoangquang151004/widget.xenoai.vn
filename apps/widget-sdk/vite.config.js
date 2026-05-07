import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      name: 'XenoAIWidget',
      fileName: () => 'widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        // Inline CSS vào JS (inject vào Shadow DOM, không dùng file riêng)
        inlineDynamicImports: true,
        extend: true,
      },
    },
    emptyOutDir: true,
    outDir: 'dist',
    minify: 'esbuild',
    // Không cần code splitting cho IIFE
    cssCodeSplit: false,
  },
});
