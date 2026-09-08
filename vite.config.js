import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // ★この行を追加してください（相対パスになります）
  server: {
    proxy: {
      '/api': {
        target: 'https://REPLACE-WITH-CONOHA-DOMAIN', // TODO: ConoHa WING の公開URLに変更
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    emptyOutDir: true, // ビルド時にdistフォルダをクリア
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          // React関連を分離
          'vendor-react': ['react', 'react-dom'],
          // アイコンライブラリを分離（大きい）
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})