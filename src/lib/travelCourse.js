/* 여행 일본어 코스 — 문제 만들기 · 진도 · 듣기 목록.
 *
 * 화면이 아니라 규칙이다. 독일어 코스(swissCourse.js)와 같은 뼈대인데 문제의
 * 결이 다르다 — 거기는 낱말을 외우는 코스고, 여기는 **상대의 말을 알아듣는**
 * 코스다. 그래서 문제의 중심이 「직원 줄을 소리로 듣고 뜻을 고른다」이고,
 * 내 줄은 「뜻을 보고 일본어를 고른다」다. 둘 다 세 보기 중 하나.
 *
 * 진도는 일본어 회독 기록과 아예 다른 자리(storage의 travel)에 적는다.
 * 코스를 끝내도 단어 회독 진도는 안 움직인다 — 이건 「듣기」고 그건 「외우기」다. */
import { TRAVEL_ITEMS, TRAVEL_LESSONS, itemsOfLesson, itemsOfUnit, lessonById } from '../data/travel.js';
import { starsFor } from './swissCourse.js';

export { starsFor };
export const XP_PER_LESSON = 10;
export const XP_PERFECT_BONUS = 5;
const WEAK_CAP = 60;
const MIN_EXERCISES = 8;

function shuffle(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 보기 셋. 같은 쪽(직원이면 직원 줄)에서 같은 레슨 둘을 더 고르고, 모자라면
   같은 단원에서 채운다 — 「여권 부탁합니다」의 보기에 「거스름돈 500엔」이
   나오면 알아듣는 게 아니라 거르는 것이 된다. */
function optionsFor(item, lesson, rnd) {
  const sameSide = (list) => list.filter((it) => it.id !== item.id && it.who === item.who);
  let pool = sameSide(itemsOfLesson(lesson.id));
  if (pool.length < 2) pool = sameSide(itemsOfUnit(lesson.unitId));
  if (pool.length < 2) pool = sameSide(TRAVEL_ITEMS);
  const others = shuffle(pool, rnd).slice(0, 2);
  return shuffle([item, ...others], rnd);
}

/* ★ 레슨 하나 → 문제 목록 ★
 *
 *   hear  직원 줄 — 소리만 듣고 뜻을 고른다 (글자는 안 보여 준다). 이 코스의 핵심
 *   read  직원 줄 — 글자와 소리를 같이 두고 뜻을 고른다 (hear보다 쉽다)
 *   say   내 줄   — 뜻을 보고 일본어를 고른다 (맞히면 읽어 준다)
 *
 * 줄마다 문제 하나는 꼭 만난다. 직원 줄은 hear, 내 줄은 say. 여덟이 안 되면
 * 직원 줄의 read를 더해 여덟은 채운다 — 같은 줄을 두 번 만나는 쪽이 낫다. */
export function buildExercises(lessonId, rnd = Math.random) {
  const lesson = lessonById(lessonId);
  if (!lesson) return [];
  const items = itemsOfLesson(lessonId);
  const make = (item, type) => {
    const options = optionsFor(item, lesson, rnd);
    return { type, item, options, answerId: item.id };
  };
  const out = items.map((it) => make(it, it.who === 'staff' ? 'hear' : 'say'));
  const staff = items.filter((it) => it.who === 'staff');
  let i = 0;
  while (out.length < MIN_EXERCISES && staff.length) {
    out.push(make(staff[i % staff.length], 'read'));
    i += 1;
  }
  return shuffle(out, rnd);
}

/* ── 진도 ── */
export function emptyProgress() {
  return { lessons: {}, xp: 0, weak: [] };
}

export function normalizeProgress(p) {
  const src = p && typeof p === 'object' ? p : {};
  return {
    lessons: src.lessons && typeof src.lessons === 'object' ? src.lessons : {},
    xp: Number(src.xp) || 0,
    weak: Array.isArray(src.weak) ? src.weak.filter((x) => typeof x === 'string') : [],
  };
}

export function lessonOrder() {
  return TRAVEL_LESSONS.map((l) => l.id);
}

/* ★ 레슨은 안 잠근다 ★
 * 독일어 코스는 앞 레슨을 끝내야 다음이 열리는데, 여기는 전부 열어 둔다.
 * 여행은 차례대로 안 온다 — 내일 호텔 체크아웃이면 오늘은 그 레슨부터
 * 해야 한다. 「다음」은 안 한 것 중 첫 번째를 가리킬 뿐이다. */
export function isUnlocked() {
  return true;
}

export function nextLesson(progress) {
  const p = normalizeProgress(progress);
  return lessonOrder().find((id) => !(p.lessons[id]?.stars >= 1)) || null;
}

export function recordLesson(progress, lessonId, { mistakes = 0, total = 1, wrongIds = [], now = Date.now() } = {}) {
  const p = normalizeProgress(progress);
  const stars = starsFor(mistakes, total);
  const prev = p.lessons[lessonId] || { stars: 0, tries: 0 };
  const gained = XP_PER_LESSON + (stars === 3 ? XP_PERFECT_BONUS : 0);
  const weak = [...new Set([...p.weak, ...wrongIds])].slice(-WEAK_CAP);
  return {
    lessons: {
      ...p.lessons,
      [lessonId]: { stars: Math.max(prev.stars, stars), last: stars, tries: (prev.tries || 0) + 1, at: now },
    },
    xp: p.xp + gained,
    weak,
    gained,
    stars,
  };
}

export function courseSummary(progress) {
  const p = normalizeProgress(progress);
  const ids = lessonOrder();
  const done = ids.filter((id) => (p.lessons[id]?.stars || 0) >= 1).length;
  const stars = ids.reduce((n, id) => n + (p.lessons[id]?.stars || 0), 0);
  return { done, total: ids.length, stars, maxStars: ids.length * 3, xp: p.xp, weak: p.weak.length };
}

/* ── 자동 듣기 ──
 *
 * 코스 전체를 문장 카드로. 단원 → 레슨 차례 그대로라, 구간으로 끊어 들으면
 * 공항부터 곤란할 때까지 하루의 차례로 흐른다. 직원 줄과 내 줄이 번갈아
 * 나오니 「묻고 답하기」가 귀에 붙는다. */
export function travelListenCards() {
  return TRAVEL_ITEMS.map((it) => ({
    id: it.id,
    kanji: it.jp,
    kana: it.kana,
    mean: it.ko,
    type: 'sentence',
    kind: 'sentence',
    who: it.who,
    lessonId: it.lessonId,
    unitId: it.unitId,
  }));
}
