import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // サブディレクトリ配置（例: /performance-board/）でも動くよう相対パスで出力する
  base: './',
  // 開発サーバーの proxy は置いていない。Vite は PHP を実行できないため、
  // PHP を含む動作確認は `npm run build && php -S 127.0.0.1:8090 -t dist` で行う（README 参照）。
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