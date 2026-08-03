/* 「처음 가는 일본」 서비스 워커
 * 앱 셸: cache-first / api.anthropic.com: network-only(캐싱 절대 금지)
 */
const CACHE_VERSION = 'jtrip-v14';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './npc-engine.js',
  './data.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Claude API: 절대 캐싱하지 않는다 (network-only)
  if (url.hostname === 'api.anthropic.com') {
    e.respondWith(fetch(e.request));
    return;
  }

  if (e.request.method !== 'GET') return;

  // 구글 폰트: cache-first (실패 시 시스템 폰트 폴백은 CSS가 담당)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit || fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, clone));
          return res;
        }).catch(() => new Response('', { status: 408 }))
      )
    );
    return;
  }

  // 앱 셸(동일 출처): cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((hit) =>
        hit || fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, clone));
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
  }
});
