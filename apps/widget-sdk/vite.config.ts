import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/** Tên file IIFE tách khỏi `widget.js` legacy (vanilla / cache CDN) — bundle React + Shadow DOM. */
const EMBED_BUNDLE = 'chatbot-embed.js'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      mode === 'production' ? 'production' : 'development',
    ),
  },
  test: {
    environment: 'jsdom',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      name: 'WidgetChatbot',
      formats: ['iife'],
      fileName: () => EMBED_BUNDLE,
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@widget-chatbot/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
}))