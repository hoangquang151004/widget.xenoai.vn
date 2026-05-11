import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WidgetChatbotUI',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Phải external cả jsx-runtime: Rollup coi "react/jsx-runtime" khác module "react".
      // Nếu không, Vite nhúng bản jsx-runtime (vd. từ React 18 trong packages/ui) vào dist
      // → xung đột React 19 của Next → TypeError ReactCurrentOwner trên SSR (vd. /dashboard/settings).
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
})