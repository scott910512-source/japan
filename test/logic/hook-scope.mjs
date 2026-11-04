/* 화면 안의 함수가 쓰는 훅 값이 그 함수 안에서 정의됐는가 — 소스 모양 검사.
 *
 * `const { after } = useTimeouts()`를 위쪽 컴포넌트에만 두고 아래 하위 컴포넌트에서 `after(...)`를 부르면
 * 그 하위 화면이 열려 정답을 누르는 순간 ReferenceError가 난다. 빌드도 통과하고 눈으로도 안 보인다
 * (완전기초 가나 퀴즈 · 문장 학습에서 그랬고, 초보 50명 시험의 화면 오류로 처음 잡혔다).
 *
 * 최상위 함수 단위로 잘라서, `after(`를 부르는 함수는 자기 몸 안에 `useTimeouts(`가 있어야 한다. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : (/\.jsx?$/.test(n) ? [p] : []); });
const files = walk('src');

/* 최상위 함수(들여쓰기 없는 function / export default function)로 자른다 */
function topFunctions(src) {
  const re = /^(?:export\s+default\s+|export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm;
  const marks = []; let m;
  while ((m = re.exec(src))) marks.push({ name: m[1], at: m.index });
  return marks.map((x, i) => ({ name: x.name, body: src.slice(x.at, i + 1 < marks.length ? marks[i + 1].at : src.length) }));
}

console.log('\n[ after()를 부르는 함수는 자기 안에서 useTimeouts()를 받는다 ]');
let checked = 0; const bad = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!/\bafter\(/.test(src) || !/useTimeouts/.test(src)) continue;
  for (const fn of topFunctions(src)) {
    const body = fn.body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (!/(?<![.\w$])after\(/.test(body)) continue;
    checked += 1;
    if (!/useTimeouts\(/.test(body)) bad.push(`${f}:${fn.name}`);
  }
}
ok('검사한 함수가 있다', checked >= 4, `${checked}개`);
ok('★ 전부 자기 안에서 훅을 받는다 ★', bad.length === 0, bad.join(' · ') || '깨끗');

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
