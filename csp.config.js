/* ★ 콘텐츠 보안 정책(CSP) ★ (보안 감사 추가 B, 2026-11-24)
 *
 * 이 앱은 사용자가 넣은 API 키(음성 · AI)와 로그인 토큰을 브라우저 저장소에 둔다. 화면 어디선가 남의 스크립트가 돌면
 * 그대로 빠져나간다. CSP는 「이 앱 파일과 아래 적은 곳 말고는 스크립트를 돌리지도, 통신하지도 마라」를 브라우저에 알린다.
 *
 * 배포 빌드에만 넣는다(vite.config.js). 개발 서버는 React 새로고침용 인라인 스크립트를 써서 막히기 때문이다.
 * 새 외부 주소를 부르면 여기에 더한다 — test/logic/csp.mjs가 코드에 적힌 외부 주소가 다 허용됐는지 본다. */
export const SUPABASE_HOST = 'ifjgngkkozsiyoafhlkb.supabase.co';

export const CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  /* React는 style 속성을 쓰고, 빌드 CSS는 파일이다 */
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
  'font-src': ["'self'", 'data:'],
  /* 음성은 data: 주소로 받은 mp3를 튼다(lib/tts.js) · 녹음은 blob: */
  'media-src': ["'self'", 'data:', 'blob:'],
  'connect-src': [
    "'self'",
    `https://${SUPABASE_HOST}`, `wss://${SUPABASE_HOST}`,   // 로그인 · 동기화
    'https://api.anthropic.com',                              // Claude (사용자 키)
    'https://generativelanguage.googleapis.com',              // Gemini (사용자 키)
    'https://texttospeech.googleapis.com',                    // 음성 (사용자 키)
    'https://speech.googleapis.com',                          // 말하기 채점 (사용자 키)
    'https://www.youtube.com',                                // 영상 제목(oEmbed)
  ],
  'frame-src': ['https://www.youtube-nocookie.com'],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export const cspString = (policy = CSP) => Object.entries(policy).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');

/* 빌드한 index.html의 <head> 맨 앞(charset 다음)에 넣는 vite 플러그인 */
export function cspPlugin() {
  return {
    name: 'jp-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${cspString()}" />`;
      return html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${tag}`);
    },
  };
}
