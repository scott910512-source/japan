/* 배포 뒤 옛 화면 파일 404 — 한 번 자동 새로고침 (2026-11-17 QA B04) */
import assert from 'node:assert/strict';
import { reloadForNewVersion } from '../../src/components/ScreenSlot.jsx';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
check('★ 화면 파일을 못 받으면 한 번 새로 불러온다 ★', () => {
  let n = 0; const st = mem();
  assert.equal(reloadForNewVersion(new Error('Failed to fetch dynamically imported module: /japan/assets/StudyHub-x.js'), { now: 1000, storage: st, reload: () => n++ }), true);
  assert.equal(n, 1);
});
check('★ 1분 안에 또 실패하면 되풀이하지 않는다(무한 새로고침 ×) ★', () => {
  let n = 0; const st = mem();
  reloadForNewVersion(new Error('Importing a module script failed.'), { now: 1000, storage: st, reload: () => n++ });
  assert.equal(reloadForNewVersion(new Error('Importing a module script failed.'), { now: 30000, storage: st, reload: () => n++ }), false);
  assert.equal(n, 1);
  assert.equal(reloadForNewVersion(new Error('Importing a module script failed.'), { now: 70000, storage: st, reload: () => n++ }), true);
});
check('다른 오류(코드 고장)는 새로고침하지 않는다', () => {
  let n = 0;
  assert.equal(reloadForNewVersion(new TypeError("Cannot read properties of undefined (reading 'x')"), { now: 1, storage: mem(), reload: () => n++ }), false);
  assert.equal(n, 0);
});
console.log(`통과 ${pass} / 실패 0`);
