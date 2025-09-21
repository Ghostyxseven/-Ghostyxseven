import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Redireciona qualquer chamada que comece com /api
      '/api': {
        target: 'http://localhost:4000', // O endereço do seu servidor back-end
        changeOrigin: true, // Necessário para o redirecionamento funcionar
        rewrite: (path) => path.replace(/^\/api/, ''), // Remove /api do caminho final
      }
    }
  }
})