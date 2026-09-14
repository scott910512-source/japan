/* 스위스 독일어 코스 — 문제 만들기 · 진도 · 별.
 *
 * 화면이 아니라 규칙이다. 레슨 하나를 어떤 문제 몇 개로 바꾸는지, 어느 레슨이
 * 열리는지, 별을 몇 개 주는지가 전부 여기 있다. 화면은 이걸 그리기만 한다 —
 * 그래야 검사가 화면 없이 규칙을 통째로 볼 수 있다.
 *
 * 진도는 일본어 회독 기록과 아예 다른 자리(storage의 swiss)에 적는다. 서로
 * 손댈 일이 없다. 이 진도는 기기에 남고 백업에 들어가지만, 아직 계정 동기화는
 * 안 탄다 — 동기화 표에 칸을 더하려면 서버 쪽 표도 같이 바꿔야 해서 따로 간다. */
import {
  SWISS_LESSONS, SWISS_ITEMS, itemsOfLesson, itemsOfUnit, lessonById, tokensOf,
} from '../data/swiss.js';

export const XP_PER_LESSON = 10;
export const XP_PERFECT_BONUS = 5;
const WEAK_CAP = 60;

/* ── 섞기 (난수를 받아서 검사에서 고정할 수 있게) ── */
function shuffle(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 보기 셋. 같은 레슨에서 둘을 더 고르고, 모자라면 같은 단원에서 채운다 —
   숫자 문제에 「고양이」가 보기로 나오면 맞히는 게 아니라 거르는 게 된다. */
function optionsFor(item, lesson, rnd) {
  const same = itemsOfLesson(lesson.id).filter((it) => it.id !== item.id);
  let pool = same;
  if (pool.length < 2) pool = itemsOfUnit(lesson.unitId).filter((it) => it.id !== item.id);
  const others = shuffle(pool, rnd).slice(0, 2);
  return shuffle([item, ...others], rnd);
}

/* 조립 문제의 낱말 조각. 정답 조각에 같은 단원 다른 문장의 조각 둘을 섞는다.
   조각마다 번호를 붙인다 — 같은 낱말이 두 번 나오는 문장이 있어서 글자로는 못 가른다. */
function buildTokens(item, lesson, rnd) {
  const target = tokensOf(item);
  const unitSentences = itemsOfUnit(lesson.unitId).filter((it) => it.kind === 'sentence' && it.id !== item.id);
  const spare = shuffle(
    [...new Set(unitSentences.flatMap(tokensOf))].filter((t) => !target.includes(t)),
    rnd,
  ).slice(0, 2);
  const pieces = [...target, ...spare].map((text, i) => ({ id: `${item.id}-${i}`, text }));
  return { tokens: shuffle(pieces, rnd), answer: target };
}

/* ★ 레슨 하나 → 문제 목록 ★
 *
 * 낱말마다 문제 하나는 꼭 만난다. 유형은 돌아가며 준다 — 같은 유형만 열 개면
 * 낱말을 배우는 게 아니라 버튼 자리를 배운다.
 *   낱말: 듣고 뜻 고르기 → 뜻 보고 고르기 → 소리만 듣고 고르기
 *   문장: 조립 (뜻을 보고 낱말 조각으로 만든다)
 * 여덟 개가 안 되면 「소리만 듣고 고르기」를 더 넣어 여덟은 채운다.
 * 마지막은 짝 맞추기 — 오늘 만난 것을 한 판에 다시 본다. */
const WORD_TYPES = ['choose-ko', 'choose-sw', 'listen'];

export function buildExercises(lessonId, rnd = Math.random) {
  const lesson = lessonById(lessonId);
  if (!lesson) return [];
  const items = shuffle(itemsOfLesson(lessonId), rnd);
  const out = [];
  let w = 0;
  for (const item of items) {
    if (item.kind === 'sentence') {
      out.push({ type: 'build', item, ...buildTokens(item, lesson, rnd) });
    } else {
      const type = WORD_TYPES[w % WORD_TYPES.length];
      w += 1;
      out.push({ type, item, options: optionsFor(item, lesson, rnd), answerId: item.id });
    }
  }
  const words = items.filter((it) => it.kind === 'word');
  for (let i = 0; out.length < 8 && i < words.length; i += 1) {
    const item = words[i];
    out.push({ type: 'listen', item, options: optionsFor(item, lesson, rnd), answerId: item.id });
  }
  const body = shuffle(out, rnd);
  if (items.length >= 4) {
    body.push({ type: 'match', pairs: shuffle(items, rnd).slice(0, 4) });
  }
  return body;
}

/* 별. 하나도 안 틀리면 셋, 다섯에 하나꼴까지는 둘, 그 밖은 하나.
   끝까지 갔으면 하나는 준다 — 0개는 「안 했다」와 구별이 안 된다. */
export function starsFor(mistakes, total) {
  if (mistakes <= 0) return 3;
  if (mistakes <= Math.ceil(total * 0.2)) return 2;
  return 1;
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
  return SWISS_LESSONS.map((l) => l.id);
}

/* 열렸는가. 맨 첫 레슨은 늘 열려 있고, 그다음부터는 바로 앞 레슨을 한 번이라도
   끝냈으면 열린다. 별 개수는 안 본다 — 겨우 통과해도 다음으로 갈 수 있어야
   막히지 않는다. */
export function isUnlocked(progress, lessonId) {
  const order = lessonOrder();
  const i = order.indexOf(lessonId);
  if (i < 0) return false;
  if (i === 0) return true;
  const prev = normalizeProgress(progress).lessons[order[i - 1]];
  return Boolean(prev && prev.stars >= 1);
}

export function nextLesson(progress) {
  return lessonOrder().find((id) => isUnlocked(progress, id) && !normalizeProgress(progress).lessons[id]) || null;
}

/* 레슨을 끝냈다. 별은 제일 좋았던 것을 남기고, 경험치는 매번 쌓인다 —
   다시 해도 보람이 있어야 다시 한다. 틀린 낱말은 약점 주머니에 넣는다. */
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

/* 기기 두 대의 진도를 합친다 (나중에 동기화가 붙을 때 그대로 쓴다).
   별은 큰 쪽, 경험치도 큰 쪽 — 더하면 재동기화마다 불어난다. 약점은 합집합. */
export function mergeSwiss(a, b) {
  const x = normalizeProgress(a);
  const y = normalizeProgress(b);
  const lessons = {};
  for (const id of new Set([...Object.keys(x.lessons), ...Object.keys(y.lessons)])) {
    const l = x.lessons[id]; const r = y.lessons[id];
    if (!l) { lessons[id] = r; continue; }
    if (!r) { lessons[id] = l; continue; }
    lessons[id] = {
      stars: Math.max(l.stars || 0, r.stars || 0),
      last: (l.at || 0) >= (r.at || 0) ? l.last : r.last,
      tries: Math.max(l.tries || 0, r.tries || 0),
      at: Math.max(l.at || 0, r.at || 0),
    };
  }
  return { lessons, xp: Math.max(x.xp, y.xp), weak: [...new Set([...x.weak, ...y.weak])].slice(-WEAK_CAP) };
}

/* 자동재생에 무엇을 들려줄까.
   learned — 끝낸 레슨의 낱말만 (기본. 모르는 말을 흘려보내는 건 듣기가 아니다)
   weak    — 틀렸던 것만
   단원 id — 그 단원 전부 (아직 안 배운 것도)
   all     — 전부 */
export function listenPool(progress, scope = 'learned') {
  const p = normalizeProgress(progress);
  if (scope === 'all') return SWISS_ITEMS;
  if (scope === 'weak') return SWISS_ITEMS.filter((it) => p.weak.includes(it.id));
  if (scope === 'learned') {
    const done = new Set(Object.keys(p.lessons).filter((id) => (p.lessons[id]?.stars || 0) >= 1));
    return SWISS_ITEMS.filter((it) => done.has(it.lessonId));
  }
  return itemsOfUnit(scope);
}
