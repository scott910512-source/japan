/* 여행 벼락치기 — 삿포로.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 이 목록은 급수로 고르지 않았다. 両替·免税·乗り換え는 N3도 N5도 아니지만
 * 공항에서 못 하면 그 자리에서 막히고, 시험에 자주 나오는 推測·検討는 나흘
 * 동안 한 번도 안 쓴다. 그래서 두 가지가 깨지기 쉽다.
 *
 *   · 레벨로 잘린다 — 기본 설정이 N5라, 거르는 규칙을 한 번만 잘못 통과하면
 *     70개가 스무 개로 준다. 기출에서 205개가 18개가 됐던 자리다.
 *   · 카드를 못 찾는다 — 목록은 표기로 단어장에 이어 붙인다. 표기를 한 글자
 *     틀리면 그 낱말은 조용히 사라진다.
 *
 * 그리고 낱말만 있으면 안 된다. 空港을 알아도 「JRの乗り場はどこですか」가
 * 안 나오면 공항에서 못 움직인다. */
import { ALL_WORDS } from '../../src/data/allWords.js';
import { SAPPORO_GROUPS, SAPPORO_LIST } from '../../src/data/sapporo.js';
import { SAPPORO_SITUATION } from '../../src/data/situations-sapporo.js';
import { NO_JLPT } from '../../src/data/words-sapporo.js';
import { ALL_SITUATIONS } from '../../src/data/allSituations.js';
import { allSentenceCards } from '../../src/lib/content.js';
import { tripLines, tripMissing, tripPool, tripStat, tripWords } from '../../src/lib/trip.js';
import { SCOPES, inScope, pickListen, scopeCounts } from '../../src/lib/listen.js';
import { emptyState, isDoneEnough, stateOf, todayKey } from '../../src/lib/review.js';
import { filterByLevel } from '../../src/lib/wordFilters.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const POOL = tripPool(ALL_WORDS);
const LINES = allSentenceCards();
const byId = new Map([...ALL_WORDS.map((w) => [w.id, w]), ...LINES.map((c) => [c.id, c])]);

console.log('\n[ 목록이 단어장에 전부 이어 붙는가 ]');
{
  /* 표기를 한 글자 틀리면 그 낱말이 조용히 사라진다 — 숫자가 맞는지만 보면
     못 잡는다(70개 중 하나가 빠져도 69개는 그럴듯하다). 그래서 빠진 표기를
     이름으로 꼽는다. */
  const miss = tripMissing(ALL_WORDS);
  ok('★ 빠진 표기가 없다 ★', miss.length === 0, miss.join(', ') || '없음');
  ok('목록은 70개', SAPPORO_LIST.length === 70, `${SAPPORO_LIST.length}개`);
  ok('낱말이 목록만큼 이어졌다', tripWords(ALL_WORDS).length === SAPPORO_LIST.length);

  const dupes = SAPPORO_LIST.map((e) => e.w).filter((w, i, a) => a.indexOf(w) !== i);
  ok('목록에 같은 표기가 두 번 없다', dupes.length === 0, dupes.join(',') || '없음');

  /* 같은 표기가 단어장에 두 벌 있어도 한 번만 집는다 — 둘 다 집으면 같은
     낱말이 듣기에서 두 번 나온다(기출에서 겪은 자리). */
  const ids = tripWords(ALL_WORDS).map((w) => w.id);
  ok('같은 낱말이 두 번 안 들어온다', new Set(ids).size === ids.length);
}

console.log('\n[ 읽기가 단어장과 어긋나지 않는가 ]');
{
  /* 목록에 적어 둔 읽기와 단어장의 읽기가 다르면 둘 중 하나가 틀린 것이다.
     듣기는 단어장 쪽을 읽어 주니, 어긋난 채로 두면 목록만 보고 외운 사람이
     다른 소리를 듣는다. */
  const have = new Map(ALL_WORDS.map((w) => [w.kanji, w]));
  const bad = SAPPORO_LIST
    .filter((e) => have.get(e.w) && have.get(e.w).kana !== e.k)
    .map((e) => `${e.w}: 목록 ${e.k} / 단어장 ${have.get(e.w).kana}`);
  ok('★ 읽기가 전부 같다 ★', bad.length === 0, bad.join(' · ') || '어긋난 것 없음');
}

console.log('\n[ 낱말과 문장이 같이 돈다 ]');
{
  const words = POOL.filter((x) => x.kind === 'word');
  const lines = POOL.filter((x) => x.kind === 'sentence');
  ok('낱말 70', words.length === 70, `${words.length}개`);
  ok('★ 짧은 문장도 70개 같이 있다 ★', lines.length === 70, `${lines.length}개`);
  ok('후보는 140', POOL.length === 140, `${POOL.length}개`);

  const unresolved = POOL.filter((x) => !byId.has(x.id));
  ok('★ 전부 실제 카드로 풀린다 ★', unresolved.length === 0,
    unresolved.map((x) => x.id).join(',') || '못 찾는 것 없음');
}

console.log('\n[ 차례는 하루의 차례다 ]');
{
  /* 벼락치기는 끝까지 못 가는 일이 흔하다. 앞에서 끊어도 공항은 넘긴
     상태가 되어야 쓸모가 있다. */
  const first = byId.get(POOL[0].id);
  ok('★ 맨 앞은 공항 ★', first.kanji === '空港', `${first.kanji} ${first.kana}`);

  // 묶음 안에서는 낱말이 먼저, 문장이 뒤 — 낱말을 모르는 채로 문장을 들으면 통째로 외운다
  const air = SAPPORO_LIST.filter((e) => e.g === 'air').length;
  const kinds = POOL.slice(0, air + 1).map((x) => x.kind);
  ok('★ 묶음 안에서 낱말이 먼저 ★', kinds.slice(0, air).every((k) => k === 'word') && kinds[air] === 'sentence',
    kinds.join(','));

  // 곤란할 때는 맨 뒤 — 급하지만 공항보다 뒤다
  const last = byId.get(POOL[POOL.length - 1].id);
  ok('맨 뒤는 곤란할 때', last.kanji === '大丈夫です。', last.kanji);

  ok('묶음은 일곱', SAPPORO_GROUPS.length === 7, SAPPORO_GROUPS.map((g) => g.label).join(' · '));
  ok('문장 묶음도 일곱', SAPPORO_SITUATION.parts.length === 7);
}

console.log('\n[ ★ 레벨로 안 잘린다 ★ ]');
{
  /* 기본 설정은 N5만 켜져 있다. 그 규칙을 여행에도 쓰면 70개가 스무 개로
     준다 — 기출에서 205개가 18개가 됐던 바로 그 자리다. 両替(N4)·免税(N3)·
     乗り換え(N3)는 급수로 고를 낱말이 아니다. */
  const n5only = filterByLevel(ALL_WORDS, ['N5']);
  const cut = tripPool(n5only).filter((x) => x.kind === 'word').length;
  ok('N5만 켜면 낱말이 줄긴 한다 — 단어장을 잘랐으니까', cut < 70, `${cut}개`);

  // 그런데 듣기는 잘린 목록을 안 본다. 여행 후보를 통째로 바꿔 끼운다
  const review = {};
  const got = pickListen(n5only.map((w) => ({ id: w.id, kind: 'word' })), review, {
    scope: 'trip', count: 100, trip: POOL, order: 'block', block: 0,
  });
  ok('★ 그래도 듣기에서는 안 잘린다 ★', got.length === 100, `${got.length}개`);

  const counts = scopeCounts(
    n5only.map((w) => ({ id: w.id, kind: 'word' })), review, todayKey(), null, false, null, POOL,
  );
  ok('★ 범위 숫자도 140 그대로 ★', counts.trip === 140, `${counts.trip}개`);
}

console.log('\n[ ★ JLPT 어휘 수를 안 건드린다 ★ ]');
{
  /* 札幌·小樽·市電은 JLPT 급수가 없다. 처음엔 레벨을 비워 뒀는데(null)
     단어장에 실릴 때 N5로 메워져서(allWords.js의 `|| 'N5'`) 「N5 어휘
     534개」가 542개가 됐다. 공부할 범위를 세는 숫자에 여행 낱말을 섞으면
     그 숫자가 무슨 뜻인지 알 수 없게 된다. */
  const byLevel = {};
  for (const w of ALL_WORDS) byLevel[w.level] = (byLevel[w.level] || 0) + 1;
  ok('★ N5는 534개 그대로 ★', byLevel.N5 === 534, `${byLevel.N5}개`);
  ok('N4도 그대로', byLevel.N4 === 613, `${byLevel.N4}개`);
  ok('N3도 그대로', byLevel.N3 === 1607, `${byLevel.N3}개`);
  ok('급수 밖이 따로 세어진다', byLevel[NO_JLPT] === 8, `${byLevel[NO_JLPT]}개`);
  ok('급수는 다섯 + 급수밖뿐', Object.keys(byLevel).sort().join(',') === ['N3', 'N4', 'N5', NO_JLPT].sort().join(','),
    Object.keys(byLevel).join(','));

  /* 레벨을 고른 사람에게는 안 보인다 — 그래야 「N5만 공부」가 참말이 된다 */
  const n5 = filterByLevel(ALL_WORDS, ['N5']);
  ok('★ N5를 고르면 札幌이 안 나온다 ★', !n5.some((w) => w.kanji === '札幌'));
  ok('전부 고르면 나온다', filterByLevel(ALL_WORDS, []).some((w) => w.kanji === '札幌'));

  /* 그래도 여행 듣기에는 나온다 — 후보 목록을 통째로 바꿔 끼우기 때문이다.
     표를 사려면 읽어야 하는 글자라, 여기서 빠지면 안 된다. */
  ok('★ 그래도 여행 듣기에는 있다 ★',
    POOL.some((x) => byId.get(x.id)?.kanji === '札幌'));
}

console.log('\n[ 듣기 범위에 자리가 있다 ]');
{
  ok('여행이 범위에 있다', SCOPES.some((s) => s.id === 'trip'),
    SCOPES.map((s) => s.id).join(' / '));
  ok('이름이 삿포로를 말한다', SCOPES.find((s) => s.id === 'trip').label.includes('삿포로'));
  ok('기출 바로 뒤에 선다 — 둘 다 「무엇이 필요한가」로 고르는 범위다',
    SCOPES.findIndex((s) => s.id === 'trip') === SCOPES.findIndex((s) => s.id === 'kiju') + 1);

  /* 회독 상태로 거르지 않는다 — 「떠나기 전에 들을 것인가」는 카드의 내력이
     아니라 목록이 답한다. 외운 것도 귀로는 낯설 수 있다. */
  ok('아직 안 본 것도 들어온다', inScope(emptyState(), 'trip') === true);
  const done = { ...emptyState(), lastSeen: '2026-01-01', level: 5, box: 3 };
  ok('졸업한 것도 들어온다', inScope(done, 'trip') === true);
}

console.log('\n[ 진도 ]');
{
  const review = {};
  for (const x of POOL.slice(0, 10)) review[x.id] = { ...emptyState(), lastSeen: '2026-01-01', level: 5, box: 3 };
  for (const x of POOL.slice(10, 25)) review[x.id] = { ...emptyState(), lastSeen: '2026-01-01', level: 1, box: 3 };
  const st = tripStat(POOL, (id) => stateOf(review, id), isDoneEnough);
  ok('전체를 센다', st.total === 140, `${st.total}개`);
  ok('본 것을 센다', st.seen === 25, `${st.seen}개`);
  ok('뗀 것을 센다', st.done === 10, `${st.done}개`);
  ok('남은 것은 전체 빼기 본 것', st.left === 115, `${st.left}개`);
}

console.log('\n[ 자료가 성한가 ]');
{
  const lines = SAPPORO_SITUATION.parts.flatMap((p) => p.items);
  ok('문장 70개', lines.length === 70, `${lines.length}개`);
  ok('전부 일본어·읽기·뜻이 있다',
    lines.every((i) => i.jp && i.kana && i.ko));
  ok('전부 일본어로 끝난다 — 。나 ？',
    lines.every((i) => /[。？]$/.test(i.jp)),
    lines.filter((i) => !/[。？]$/.test(i.jp)).map((i) => i.jp).join(',') || '전부 맞음');

  /* 짧아야 입에서 나온다. 길면 외워도 그 자리에서 안 나오고, 안 나오면
     없는 문장이다. 스무 자를 넘기지 않는다. */
  const long = lines.filter((i) => i.jp.length > 20);
  ok('★ 전부 짧다 (20자 이내) ★', long.length === 0,
    long.map((i) => `${i.jp}(${i.jp.length})`).join(' · ') || '전부 짧음');

  const ids = lines.map((i) => i.id);
  ok('문장 id가 안 겹친다', new Set(ids).size === ids.length);

  /* 상황 전체에서도 안 겹쳐야 한다 — 겹치면 회독 기록이 다른 문장에 붙는다 */
  const all = ALL_SITUATIONS.flatMap((s) => s.parts.flatMap((p) => p.items.map((i) => i.id)));
  ok('★ 기존 문장과도 id가 안 겹친다 ★', new Set(all).size === all.length,
    `전체 ${all.length}개`);

  ok('묶음 차례가 목록과 같다',
    tripLines().every((l) => l.rank >= 0 && l.rank < SAPPORO_GROUPS.length));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
