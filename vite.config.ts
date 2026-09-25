import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import tenant from './src/config/tenant.config';

/**
 * `base`: use "/" para domínio/subdomínio próprio (ex.: arena.meusite.com.br)
 * ou "/nome-do-repo/" para GitHub Pages em subcaminho.
 * Pode ser definido sem editar este arquivo: VITE_BASE=/nome-do-repo/ pnpm build
 */
const base = process.env.VITE_BASE ?? './';

/** Injeta nome e cor do tenant no index.html (título e theme-color). */
function tenantHtml(): Plugin {
  return {
    name: 'tenant-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('%TENANT_NAME%', escapeHtml(tenant.courtName))
        .replaceAll('%TENANT_COLOR%', tenant.colors.primary);
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export default defineConfig({
  base,
  // atalho de import "@/…" = src/… (padrão do shadcn/ui)
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  plugins: [
    react(),
    tailwindcss(),
    tenantHtml(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: `agenda-quadra-${tenant.tenantId}`,
        name: `${tenant.courtName} · Agenda`,
        short_name: tenant.shortName,
        description: `Agenda de horários da ${tenant.courtName}`,
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        theme_color: tenant.colors.primary,
        background_color: '#ffffff',
        icons: [
          { src: tenant.icons.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: tenant.icons.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: tenant.icons.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
