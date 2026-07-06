import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { apiDevPlugin } from './vite-api-dev-plugin'

// `npm run dev:full` (mode "full") además sirve /api/* localmente contra
// Graph/SharePoint real — ver vite-api-dev-plugin.ts. `npm run dev` normal
// no lo incluye, así que sigue andando sin credenciales de Azure configuradas.
export default defineConfig(({ mode }) => {
  if (mode === 'full') {
    // Vite solo expone .env en import.meta.env (lado cliente, filtrado por
    // prefijo VITE_); los handlers de api/ leen process.env directo (como
    // hará Vercel en producción) — hay que volcarlo acá para el proceso de dev.
    const env = loadEnv(mode, process.cwd(), '');
    for (const [key, value] of Object.entries(env)) {
      if (!(key in process.env)) process.env[key] = value;
    }
  }

  return {
    plugins: [react(), tailwindcss(), ...(mode === 'full' ? [apiDevPlugin()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
})
