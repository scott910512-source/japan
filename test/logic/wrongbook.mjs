/* 오답노트 한 곳 — 숫자를 한 번만 센다 */
import { wrongTotals } from '../../src/lib/wrongbook.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const row = (id, source, extra = {}) => ({ id, source, wrong: 1, due: '2000-01-01', resolved: false, lastWrongAt: 1, ...extra });

console.log('\n[ 오답 합계 ]');
{
  const empty = wrongTotals({}, 0);
  ok('아무것도 없으면 0', empty.total === 0 && empty.fresh === 0 && empty.n3Only === 0);
  ok('망가진 입력도 견딘다', wrongTotals(null, undefined).total === 0 && wrongTotals(undefined, 'x').total === 0);

  const book = { a: row('word:1', 'word'), b: row('n3:q1', 'n3'), c: row('compose:1', 'compose') };
  const t = wrongTotals(book, 0);
  ok('새 오답노트만 있으면 그 개수', t.fresh === 3 && t.n3Only === 0 && t.total === 3);

  const both = wrongTotals(book, 1);
  ok('★ N3 문제는 두 군데에 적혀도 한 번만 센다 ★', both.total === 3 && both.n3Only === 0, JSON.stringify(both));

  const legacy = wrongTotals(book, 4);
  ok('★ 코스에만 남은 것(옛 기록)은 더해 센다 ★', legacy.n3Only === 3 && legacy.total === 6 && legacy.n3All === 4, JSON.stringify(legacy));

  const onlyLegacy = wrongTotals({}, 5);
  ok('새 쪽이 비어도 옛 N3 오답은 센다', onlyLegacy.total === 5 && onlyLegacy.fresh === 0);

  const resolved = { r: row('word:9', 'word', { resolved: true, due: '2999-01-01' }) };
  ok('복습을 마친 오답(미래 복습일)은 안 센다', wrongTotals(resolved, 0).fresh === 0);

  ok('합계 = 새 오답노트 + N3 코스에만 남은 것', [0, 1, 2, 7].every((n) => { const x = wrongTotals(book, n); return x.total === x.fresh + x.n3Only; }));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
