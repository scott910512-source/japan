/* 일상문법 — 자료와 규칙.
 *
 * ★ 답이 하나만 되게 문장을 짠다 ★
 * 이게 빈칸 채우기의 전부다. 보기 셋 중 둘도 말이 되면 그건 문제가 아니라
 * 함정이고, 배우는 게 아니라 찍는 게 된다.
 *
 * 그리고 틀린 보기마다 왜 틀렸는지가 적혀 있어야 한다. 정답만 알려 주면
 * 다음에 또 틀린다 — 조사는 특히 그렇다. */
import { DAILY_GRAMMAR_SETS, ALL_DAILY_GRAMMAR } from '../../src/data/grammar-daily.js';
import { ADVERB_SETS } from '../../src/data/adverbs.js';
import { auditSets, BLANK, filled, splitBlank } from '../../src/lib/blank.js';
import { buildSet, recordOf, setStats, scoreOf } from '../../src/lib/dailygrammar.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 자료가 성한가 ]');
const bad = auditSets(DAILY_GRAMMAR_SETS);
ok('일상문법 자료에 구멍이 없다', bad.length === 0, bad.slice(0, 4).join(' | ') || '깨끗');
/* 같은 검사를 부사에도 건다 — 규칙을 한 곳으로 모은 김에 둘 다 지킨다 */
const badAdv = auditSets(ADVERB_SETS);
ok('부사 자료에도 구멍이 없다', badAdv.length === 0, badAdv.slice(0, 4).join(' | ') || '깨끗');

ok('묶음이 여섯', DAILY_GRAMMAR_SETS.length === 6,
  DAILY_GRAMMAR_SETS.map((s) => s.label).join(' / '));
ok('문제가 서른여섯', ALL_DAILY_GRAMMAR.length === 36, `${ALL_DAILY_GRAMMAR.length}개`);
ok('묶음마다 무엇을 배우는지 적혀 있다',
  DAILY_GRAMMAR_SETS.every((s) => s.intro?.length > 20));
ok('보기는 늘 셋', ALL_DAILY_GRAMMAR.every((it) => it.options.length === 3));

/* 조사를 다루는 판에 조사 아닌 보기가 섞이면 무엇을 배우는 판인지 흐려진다 */
const particle = DAILY_GRAMMAR_SETS.find((s) => s.id === 'particle');
ok('조사 판은 조사만 묻는다',
  particle.items.every((it) => it.options.every((o) => o.length <= 3)),
  particle.items.flatMap((it) => it.options).join(' '));

/* ★ 제일 많이 틀리는 자리 ★ 한국어가 「전철을」이라 を를 쓰게 된다 */
const noru = particle.items.find((it) => it.jp.includes('のります'));
ok('乗る는 に로 받는다', noru.answer === 'に');
ok('を가 왜 틀렸는지 적혀 있다', noru.why['を'].includes('を'), noru.why['を']);
ok('한국어에 끌려간다는 걸 짚어 준다',
  noru.note.includes('한국어') || noru.why['を'].includes('한국어'));

console.log('\n[ 빈칸 다루기 ]');
const one = ALL_DAILY_GRAMMAR[0];
const { head, tail } = splitBlank(one.jp);
ok('빈칸을 앞뒤로 쪼갠다', !head.includes(BLANK) && !tail.includes(BLANK));
ok('쪼갠 걸 도로 붙이면 원래 문장', `${head}${BLANK}${tail}` === one.jp);
ok('답을 넣으면 완성된다', filled(one) === `${head}${one.answer}${tail}`);
ok('빈칸이 없으면 통째로 앞', splitBlank('빈칸없음').head === '빈칸없음');

console.log('\n[ 한 판 짜기 ]');
const items = buildSet('particle');
ok('묶음 하나를 통째로 돈다', items.length === particle.items.length);
ok('문제 순서는 안 섞는다', items[0].id === particle.items[0].id);
ok('보기 순서는 섞는다',
  [0, 1, 2, 3, 4].some(() => buildSet('particle').some(
    (it, i) => it.options.join() !== particle.items[i].options.join(),
  )));
ok('안 섞을 수도 있다',
  buildSet('particle', { shuffle: false })[0].options.join() === particle.items[0].options.join());
ok('없는 묶음은 빈손', buildSet('없다').length === 0);

console.log('\n[ 진도 ]');
const answers = {};
items.forEach((it, i) => { answers[it.id] = { good: i < 4, opt: it.answer }; });
const s = scoreOf(answers, items);
ok('몇 개 맞혔는지 센다', s.right === 4 && s.total === 6, `${s.right}/${s.total}`);

let done = recordOf({}, 'particle', s, '2026-08-30');
ok('처음이면 그대로 남는다', done.particle.right === 4);
/* ★ 잘한 판만 남긴다 ★ 두 번째에 못 봤다고 처음 잘한 게 지워지면 진도가 뒤로 간다 */
done = recordOf(done, 'particle', { right: 2, total: 6 }, '2026-08-31');
ok('못 본 판은 안 덮는다', done.particle.right === 4, `${done.particle.right}`);
done = recordOf(done, 'particle', { right: 6, total: 6 }, '2026-09-01');
ok('잘 본 판은 덮는다', done.particle.right === 6);

const stats = setStats(done);
ok('묶음마다 진도가 보인다', stats.length === 6);
ok('다 맞힌 묶음에 표시가 붙는다', stats.find((x) => x.id === 'particle').cleared === true);
ok('안 푼 묶음은 0', stats.find((x) => x.id === 'ask').right === 0);
ok('안 푼 묶음은 다 맞힌 게 아니다', stats.find((x) => x.id === 'ask').cleared === false);
ok('빈 진도로도 안 죽는다', setStats().length === 6);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
