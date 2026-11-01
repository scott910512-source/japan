import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 프로젝트 사이트(https://<user>.github.io/japan/)에 올리므로 base가 필요하다.
const base = process.env.VITE_BASE ?? '/japan/';

// 지금 기기가 어느 버전을 보고 있는지 설정 화면에서 알 수 있어야
// "고쳤다는데 왜 안 보이지"를 확인할 수 있다.
const buildStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

/* 이 앱이 만든 캐시임을 알아볼 이름. 앱 코드도 이 값을 봐야 하니 define으로 넘긴다 —
   양쪽에 따로 적어 두면 한쪽만 고쳐서 아무것도 못 지우는 날이 온다. */
const CACHE_ID = 'js-japanese';

export default defineConfig({
  base,
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp),
    __CACHE_ID__: JSON.stringify(CACHE_ID),
    __BASE_PATH__: JSON.stringify(base),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: '日本語 HUNTER — 매일 성장하는 일본어',
        short_name: '日本語 HUNTER',
        description: '일일 퀘스트와 오답 수련으로 N5부터 N3까지 성장하는 일본어 앱',
        lang: 'ko',
        scope: base,
        start_url: base,
        display: 'standalone',
        background_color: '#102b35',
        theme_color: '#102b35',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: `${base}index.html`,
        /* ★ 이 앱의 캐시에 이름표를 붙인다 ★
           설정의 「최신 버전 받기」가 caches.keys()로 가져온 것을 전부 지우고
           있었다. 같은 GitHub Pages 출처에 다른 앱도 올라가니, 남의 캐시까지
           지울 수 있는 구조다. 이름표가 있으면 우리 것만 골라 지운다. */
        cacheId: CACHE_ID,
        // 새 서비스워커가 기다리지 않고 바로 넘겨받게 한다.
        // 안 그러면 탭을 전부 닫기 전까지 옛 화면이 계속 나온다.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
