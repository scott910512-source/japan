/* 콘텐츠 보안 정책(csp.config.js) — 코드가 부르는 외부 주소가 다 허용돼 있는가, 위험한 허용이 없는가.
 * 새 외부 API를 붙이고 CSP에 안 더하면 배포한 앱에서만 조용히 막힌다 — 그걸 여기서 먼저 잡는다. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CSP, cspString, SUPABASE_HOST } from '../../csp.config.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(js|jsx)$/.test(n) ? [p] : [];
});
const files = walk('src').filter((f) => !f.includes(`${join('src', 'data')}`));
const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');
/* 링크로 여는 주소(새 탭)는 CSP 대상이 아니다 */
const LINK_ONLY = new Set(['aistudio.google.com', 'console.cloud.google.com', 'cloud.google.com', 'console.anthropic.com', 'supabase.com', 'youtu.be', 'www.youtube.com/watch']);
const hosts = new Set([...src.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase()));

check('앱이 부르는 외부 주소는 모두 connect · frame · img 중 하나에 허용돼 있다', () => {
  const allowed = [...CSP['connect-src'], ...CSP['frame-src'], ...CSP['img-src']].join(' ');
  const missing = [...hosts].filter((h) => !LINK_ONLY.has(h) && !allowed.includes(`https://${h}`));
  assert.deepEqual(missing, [], `CSP에 없는 주소: ${missing.join(', ')}`);
});
check('Supabase 주소는 src/lib/supabase.js와 같다', () => {
  assert.ok(readFileSync('src/lib/supabase.js', 'utf8').includes(`https://${SUPABASE_HOST}`));
});
check('스크립트는 이 앱 파일만 — inline · eval · 외부 스크립트 금지', () => {
  assert.deepEqual(CSP['script-src'], ["'self'"]);
  assert.ok(!cspString().includes('unsafe-eval'));
});
check('object · base · form은 막혀 있다', () => {
  assert.deepEqual(CSP['object-src'], ["'none'"]);
  assert.deepEqual(CSP['base-uri'], ["'self'"]);
  assert.deepEqual(CSP['form-action'], ["'self'"]);
});
check('와일드카드(*)는 어디에도 없다', () => assert.ok(!/\s\*(\s|;|$)|https:\/\/\*/.test(cspString())));
console.log(`통과 ${pass} / 실패 0`);
