/* 새 버전을 앱이 정한 때에만 갈아끼우게 하는 설정 — 모양 검사.
 *
 * registerType이 autoUpdate면 새 서비스워커가 깔리자마자 라이브러리가 무조건 새로고침한다. 이 앱에는 주소가 없어서
 * 새로고침하면 늘 홈이다 — 오랜만에 열고 설정이나 다른 화면에 들어갔다가 몇 초 만에 홈으로 튕기는 일이 한 배포마다 한 번씩 났다.
 * 「보고 있는 화면이면 미룬다」(lib/swgate.js)는 autoUpdate에서 한 번도 못 쓰였다. 설정이 되돌아가지 않게 못 박아 둔다. */
import { readFileSync } from 'node:fs';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l); } else { fail++; console.log('  ✗', l, e ?? ''); } };

const cfg = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
ok('★ registerType이 prompt다(autoUpdate가 아니다) ★', /registerType:\s*'prompt'/.test(cfg) && !/autoUpdate/.test(cfg));
ok('★ skipWaiting이 꺼져 있다(새 버전이 스스로 넘겨받지 않는다) ★', /skipWaiting:\s*false/.test(cfg));

const main = readFileSync(new URL('../../src/main.jsx', import.meta.url), 'utf8');
ok('갈아끼우기를 시작한 뒤에만 새로고침한다(applying 표시)', /applying\s*=\s*true/.test(main) && /controllerchange[\s\S]{0,120}applying[\s\S]{0,60}reload/.test(main));

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
