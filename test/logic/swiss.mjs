/* 스위스 독일어 맛보기 — 자료가 성한가, 맞혀 보기가 제대로 내는가.
 *
 * 곁가지라도 자료가 비면 화면이 빈다. 낱말 하나에 다섯 칸이 다 있어야 하고
 * (소리 · 표준 · 뜻 · 한글 소리 · 묶음), 묶음마다 셋 이상이어야 「셋 중 고르기」가
 * 된다. 맞혀 보기는 정답이 보기 안에 꼭 있어야 하고, 같은 묶음에서만 섞는다 —
 * 숫자 문제에 「고양이」가 보기로 나오면 맞히는 게 아니라 거르는 게 된다. */
import { SWISS_GROUPS, SWISS_ITEMS, swissByGroup, swissQuiz } from '../../src/data/swiss.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 자료가 성하다 ]');
{
  ok('묶음이 다섯', SWISS_GROUPS.length === 5, SWISS_GROUPS.map((g) => g.label).join(' · '));
  ok('낱말이 마흔 넘게', SWISS_ITEMS.length >= 40, `${SWISS_ITEMS.length}개`);

  const need = ['id', 'g', 'sw', 'hd', 'ko', 'han'];
  const broken = SWISS_ITEMS.filter((it) => need.some((k) => !String(it[k] ?? '').trim()));
  ok('★ 낱말마다 칸이 다 차 있다 ★', broken.length === 0, broken.map((b) => b.id || '?').join(',') || '없음');

  const ids = new Set(SWISS_ITEMS.map((it) => it.id));
  ok('id가 안 겹친다', ids.size === SWISS_ITEMS.length, `${ids.size} / ${SWISS_ITEMS.length}`);

  const known = new Set(SWISS_GROUPS.map((g) => g.id));
  const stray = SWISS_ITEMS.filter((it) => !known.has(it.g));
  ok('없는 묶음에 든 낱말이 없다', stray.length === 0, stray.map((s) => s.id).join(','));

  /* 셋 중 고르기가 되려면 묶음마다 셋은 있어야 한다 */
  for (const g of SWISS_GROUPS) {
    const n = swissByGroup(g.id).length;
    ok(`${g.label} 묶음에 셋 이상`, n >= 3, `${n}개`);
  }

  /* 한글 소리는 한글이어야 한다 — 로마자가 섞이면 「읽는 법」이 아니다 */
  const notHangul = SWISS_ITEMS.filter((it) => !/^[가-힣\s·]+$/.test(it.han));
  ok('한글 소리는 한글로만', notHangul.length === 0, notHangul.map((x) => `${x.id}:${x.han}`).join(',') || '없음');

  /* 숫자는 1부터 10까지 순서대로 — 유치원에서 세는 법 그대로 */
  const nums = swissByGroup('num').map((it) => it.ko.split(' ')[0]);
  ok('숫자가 1~10 차례로', nums.join(',') === '1,2,3,4,5,6,7,8,9,10', nums.join(','));
}

console.log('\n[ 맞혀 보기 ]');
{
  const fixed = () => 0.5;   // 흔들림 없이 보려고 난수를 고정한다
  const q = swissQuiz('animal', 0, fixed);
  ok('문제가 나온다', Boolean(q));
  ok('보기가 셋', q.options.length === 3, `${q.options.length}`);
  ok('★ 정답이 보기 안에 있다 ★', q.options.some((o) => o.id === q.answer.id));
  ok('보기가 서로 다르다', new Set(q.options.map((o) => o.id)).size === 3);
  ok('★ 같은 묶음에서만 섞는다 ★', q.options.every((o) => o.g === 'animal'),
    q.options.map((o) => `${o.sw}(${o.g})`).join(','));

  /* 번호를 넘기면 다음 낱말 — 한 바퀴 돌면 처음으로 */
  const pool = swissByGroup('animal');
  ok('번호대로 낱말이 바뀐다', swissQuiz('animal', 1, fixed).answer.id === pool[1].id);
  ok('끝을 넘기면 처음으로', swissQuiz('animal', pool.length, fixed).answer.id === pool[0].id);

  /* 난수를 바꾸면 순서가 바뀐다 — 늘 같은 자리에 정답이 오면 자리를 외운다 */
  let seen = new Set();
  for (let s = 0; s < 40; s += 1) {
    let x = s + 1;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const qq = swissQuiz('num', 3, rnd);
    seen.add(qq.options.findIndex((o) => o.id === qq.answer.id));
  }
  ok('정답 자리가 골고루 바뀐다', seen.size === 3, [...seen].sort().join(','));

  ok('없는 묶음이면 없다고 한다', swissQuiz('없음', 0, fixed) === null);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
