import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 프로젝트 사이트(https://<user>.github.io/japan/)에 올리므로 base가 필요하다.
const base = process.env.VITE_BASE ?? '/japan/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'JS일본어 — 회독 일본어 학습',
        short_name: 'JS일본어',
        description: '회독으로 반복해서 외우는 한국인 학습자용 일본어 앱',
        lang: 'ko',
        scope: base,
        start_url: base,
        display: 'standalone',
        background_color: '#0A0D14',
        theme_color: '#0A0D14',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
