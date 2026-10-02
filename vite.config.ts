import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    shapeSyncPlugin(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    // Permite abrir el proyecto desde localhost, 127.0.0.1
    // y también desde otros dispositivos de la misma red.
    host: '0.0.0.0',

    // Lo dejamos fijo porque TouchDesigner usa este puerto.
    port: 5180,

    // Si 8443 está ocupado, queremos que Vite avise
    // en vez de cambiar automáticamente a 8443.
    strictPort: true,

    watch: {
      ignored: ['**/.figma/**'],
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})

/**
 * Sincroniza los settings de la figura entre:
 *
 * http://localhost:8443/
 *
 * y
 *
 * http://127.0.0.1:8443/projection
 *
 * La página principal manda los cambios y la página
 * de projection recibe exactamente los mismos settings.
 */
function shapeSyncPlugin(): Plugin {
  let latestSettings: unknown = null

  return {
    name: 'shape-sync',

    apply: 'serve',

    configureServer(server) {
      // La página principal manda nuevos settings.
      server.ws.on('shape-sync:update', (data) => {
        latestSettings = data

        // Mandamos los settings a todos los clientes conectados,
        // incluyendo /projection.
        server.ws.send('shape-sync:update', data)
      })

      // Cuando /projection se abre, pide los settings más recientes.
      server.ws.on('shape-sync:request', (_data, client) => {
        if (latestSettings !== null) {
          client.send('shape-sync:update', latestSettings)
        }
      })
    },
  }
}