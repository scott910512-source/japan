/* 여행 일본어 코스 — 자료와 규칙.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 이 코스의 값은 「직원이 먼저 하는 말」에 있다. 자료가 그쪽으로 기울어 있어야
 * 하고(레슨마다 직원 줄이 있어야 듣기 문제가 선다), 소리는 늘 읽기(kana)로
 * 내니 읽기가 빠진 줄이 하나라도 있으면 그 줄에서 엉뚱한 소리가 난다.
 * 문제는 세 보기 중 하나인데 보기가 같은 쪽(직원/나)에서 와야 「거르기」가
 * 아니라 「알아듣기」가 된다. */
import {
  TRAVEL_ITEMS, TRAVEL_LESSONS, TRAVEL_UNITS, itemsOfLesson, itemsOfUnit, lessonById, unitById,
} from '../../src/data/travel.js';
import {
  buildExercises, courseSummary, emptyProgress, isUnlocked, nextLesson, normalizeProgress,
  recordLesson, travelListenCards,
} from '../../src/lib/travelCourse.js';
import { SCOPES, pickListen, scopeCounts } from '../../src/lib/listen.js';
import { cardsForQueue } from '../../src/lib/cards.js';
import { MENUS } from '../../src/lib/menu.js';
import { DEFAULT_SETTINGS } from '../../src/lib/storage.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const KANA = /^[ぁ-ゖァ-ヺー〇〜、。！？!?・\s0-9０-９A-Za-z\-]+$/;
const HANGUL = /[가-힣]/;

console.log('\n[ 자료 ]');
{
  ok('단원 여섯 — 공항 · 이동 · 호텔 · 식당 · 가게 · 곤란할 때',
    TRAVEL_UNITS.map((u) => u.title).join(' · ') === '공항 · 이동 · 호텔 · 식당 · 가게 · 곤란할 때');
  ok('레슨 열여섯', TRAVEL_LESSONS.length === 16, `${TRAVEL_LESSONS.length}`);
  ok('줄 150개 넘게', TRAVEL_ITEMS.length >= 150, `${TRAVEL_ITEMS.length}`);
  const ids = TRAVEL_ITEMS.map((it) => it.id);
  ok('id가 겹치지 않는다', new Set(ids).size === ids.length);
  ok('전부 tr- 로 시작 — 단어장·상황 문장 id와 안 섞인다', ids.every((id) => id.startsWith('tr-')));
  ok('누가 말하는지 전부 적혀 있다', TRAVEL_ITEMS.every((it) => it.who === 'staff' || it.who === 'me'));
  ok('★ 읽기(kana)가 빠진 줄이 없다 — 소리는 늘 읽기로 낸다 ★', TRAVEL_ITEMS.every((it) => it.kana && it.kana.length > 0));
  const badKana = TRAVEL_ITEMS.filter((it) => !KANA.test(it.kana));
  ok('읽기에 한자가 없다', badKana.length === 0, badKana.slice(0, 3).map((it) => `${it.id}:${it.kana}`).join(' | ') || '없음');
  ok('읽기에 한글이 없다 — 한글이 섞이면 일본어 음성이 깨진다', TRAVEL_ITEMS.every((it) => !HANGUL.test(it.kana) && !HANGUL.test(it.jp)));
  ok('뜻이 전부 한국어', TRAVEL_ITEMS.every((it) => HANGUL.test(it.ko)));
  const staff = TRAVEL_ITEMS.filter((it) => it.who === 'staff').length;
  ok('★ 직원 줄이 절반 넘는다 — 알아듣기 코스다 ★', staff / TRAVEL_ITEMS.length >= 0.5, `${staff} / ${TRAVEL_ITEMS.length}`);
  ok('레슨마다 직원 줄과 내 줄이 둘 다 있다', TRAVEL_LESSONS.every((l) => {
    const its = itemsOfLesson(l.id);
    return its.some((it) => it.who === 'staff') && its.some((it) => it.who === 'me');
  }));
  ok('레슨마다 여덟 줄 넘게', TRAVEL_LESSONS.every((l) => itemsOfLesson(l.id).length >= 8));
  ok('찾기 — 레슨·단원', lessonById('hotel-2')?.unitTitle === '호텔' && unitById('food')?.lessons.length === 3 && itemsOfUnit('air').length >= 30);
  ok('「한 번 더 부탁합니다」가 들어 있다 — 제일 중요한 한 줄', TRAVEL_ITEMS.some((it) => it.jp === 'もう一度お願いします。'));
}

console.log('\n[ 문제 ]');
{
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (const l of TRAVEL_LESSONS) {
    const ex = buildExercises(l.id, rnd);
    const its = itemsOfLesson(l.id);
    const covered = new Set(ex.map((e) => e.item.id));
    if (!its.every((it) => covered.has(it.id))) { ok(`${l.id} — 줄마다 문제 하나는 만난다`, false); break; }
    if (ex.length < 8) { ok(`${l.id} — 여덟 문제는 된다`, false, `${ex.length}`); break; }
    const badType = ex.find((e) => (e.item.who === 'staff' ? !['hear', 'read'].includes(e.type) : e.type !== 'say'));
    if (badType) { ok(`${l.id} — 직원 줄은 듣기(hear/read), 내 줄은 말하기(say)`, false, badType.type); break; }
    const badOpt = ex.find((e) => e.options.length !== 3 || !e.options.some((o) => o.id === e.answerId) || e.options.some((o) => o.who !== e.item.who));
    if (badOpt) { ok(`${l.id} — 보기는 셋, 답이 들어 있고, 같은 쪽에서 온다`, false, badOpt.item.id); break; }
  }
  ok('모든 레슨의 문제가 성하다 (줄마다 하나 · 여덟 이상 · 쪽이 맞는 보기 셋)', fail === 0);
  const hear = buildExercises('air-1', rnd).filter((e) => e.type === 'hear').length;
  ok('공항 첫 레슨은 듣기 문제가 여섯 넘는다', hear >= 6, `${hear}`);
  ok('없는 레슨은 빈손', buildExercises('nope').length === 0);
}

console.log('\n[ 진도 ]');
{
  const p0 = emptyProgress();
  ok('처음엔 비어 있다', courseSummary(p0).done === 0 && courseSummary(p0).total === 16);
  ok('★ 레슨은 안 잠근다 — 여행은 차례대로 안 온다 ★', TRAVEL_LESSONS.every((l) => isUnlocked(p0, l.id)));
  ok('다음은 첫 레슨', nextLesson(p0) === 'air-1');
  const r1 = recordLesson(p0, 'hotel-1', { mistakes: 0, total: 10, wrongIds: [], now: 1 });
  ok('호텔부터 해도 적힌다 — 별 셋 · XP 15', r1.stars === 3 && r1.gained === 15 && r1.lessons['hotel-1'].stars === 3);
  ok('다음은 여전히 공항 첫 레슨 (안 한 것 중 첫째)', nextLesson(r1) === 'air-1');
  const r2 = recordLesson(r1, 'hotel-1', { mistakes: 5, total: 10, wrongIds: ['tr-ht-004'], now: 2 });
  ok('다시 하면 별은 제일 좋았던 것, XP는 쌓인다', r2.lessons['hotel-1'].stars === 3 && r2.lessons['hotel-1'].last === 1 && r2.xp === 25);
  ok('틀린 줄은 약점 주머니에', r2.weak.includes('tr-ht-004'));
  ok('깨진 진도도 읽는다', normalizeProgress({ lessons: 'x', xp: 'y', weak: [1, 'a'] }).weak.join() === 'a');
}

console.log('\n[ 자동 듣기 · 메뉴 · 설정 ]');
{
  const cards = travelListenCards();
  ok('코스 전체가 문장 카드로 — kanji·kana·mean', cards.length === TRAVEL_ITEMS.length && cards.every((c) => c.kanji && c.kana && c.mean && c.kind === 'sentence'));
  ok('차례는 자료 차례 — 공항이 먼저', cards[0].unitId === 'air' && cards[cards.length - 1].unitId === 'help');
  ok('범위에 「여행 일본어」가 있다', SCOPES.some((s) => s.id === 'tour'));
  const pool = cards.map((c) => ({ id: c.id, kind: 'sentence' }));
  const today = '2026-10-09';
  ok('범위 수가 줄 수와 같다', scopeCounts(pool, {}, { today, tour: pool }).tour === cards.length);
  ok('목록을 안 주면 빈손', scopeCounts(pool, {}, { today }).tour === 0);
  const first = pickListen(pool, {}, { scope: 'tour', count: 20, today, tour: pool, order: 'block', blocks: [0] });
  ok('1구간은 공항 첫 스무 줄', first.length === 20 && first[0].id === 'tr-air-001');
  ok('★ 큐가 카드로 풀린다 ★', cardsForQueue(first, [], [], cards).length === 20);
  ok('학습 메뉴에 「여행 일본어」', MENUS.some((m) => m.id === 'travel' && m.group === 'content'));
  ok('기본 설정에서 켜져 있다', DEFAULT_SETTINGS.menus.travel === true);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
