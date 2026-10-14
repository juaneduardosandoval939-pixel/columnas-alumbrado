import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Permite abrir la versión de prueba desde la dirección de GitHub Codespaces
  server: { allowedHosts: ['.app.github.dev'] },
})
