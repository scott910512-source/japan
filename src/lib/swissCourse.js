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
  SWISS_LESSONS, SWISS_ITEMS, SWISS_TRACKS, itemsOfLesson, itemsOfUnit, lessonById, tokensOf,
} from '../data/swiss.js';
import { editDistance } from './quiz.js';
import { todayKey, stateOf } from './review.js';
import { dueIds, memoryOf, mergeMemory, preReviewIds, seedMemory, stageOf, itemById } from './swissMemory.js';

export const XP_PER_LESSON = 10;
export const XP_PERFECT_BONUS = 5;
const WEAK_CAP = 60;

/* ── 섞기 (난수를 받아서 검사에서 고정할 수 있게) ── */
export function shuffle(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 보기 셋. 같은 레슨에서 둘을 더 고르고, 모자라면 같은 단원에서 채운다 —
   숫자 문제에 「고양이」가 보기로 나오면 맞히는 게 아니라 거르는 게 된다. */
export function optionsFor(item, lesson, rnd) {
  const same = itemsOfLesson(lesson.id).filter((it) => it.id !== item.id);
  let pool = same;
  if (pool.length < 2) pool = itemsOfUnit(lesson.unitId).filter((it) => it.id !== item.id);
  const others = shuffle(pool, rnd).slice(0, 2);
  return shuffle([item, ...others], rnd);
}

/* 조립 문제의 낱말 조각. 정답 조각에 같은 단원 다른 문장의 조각 둘을 섞는다.
   조각마다 번호를 붙인다 — 같은 낱말이 두 번 나오는 문장이 있어서 글자로는 못 가른다. */
export function buildTokens(item, lesson, rnd) {
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
  return { lessons: {}, xp: 0, weak: [], mem: {} };
}

export function normalizeProgress(p) {
  const src = p && typeof p === 'object' ? p : {};
  return {
    lessons: src.lessons && typeof src.lessons === 'object' ? src.lessons : {},
    xp: Number(src.xp) || 0,
    weak: Array.isArray(src.weak) ? src.weak.filter((x) => typeof x === 'string') : [],
    /* 낱말마다 언제 다시 볼까(lib/swissMemory.js). 없던 옛 진도에는 빈 칸으로 읽는다 —
       끝낸 레슨의 낱말은 seedMemory가 그 자리에서 채운다 */
    mem: src.mem && typeof src.mem === 'object' ? src.mem : {},
  };
}

export function lessonOrder() {
  return SWISS_LESSONS.map((l) => l.id);
}

/* 열렸는가. 갈래(기초 단어 · 여행 회화)마다 첫 레슨은 늘 열려 있고, 그다음부터는 같은 갈래의 바로 앞
   레슨을 한 번이라도 끝냈으면 열린다. 별 개수는 안 본다 — 겨우 통과해도 다음으로 갈 수 있어야 막히지 않는다.
   갈래끼리는 서로 잠그지 않는다: 여행 회화를 하던 사람이 기초를 안 했다고 막히지 않는다. */
export function isUnlocked(progress, lessonId) {
  const lesson = lessonById(lessonId);
  if (!lesson) return false;
  const track = SWISS_LESSONS.filter((l) => l.track === lesson.track);
  const i = track.findIndex((l) => l.id === lessonId);
  if (i <= 0) return i === 0;
  const prev = normalizeProgress(progress).lessons[track[i - 1].id];
  return Boolean(prev && prev.stars >= 1);
}

/* 다음에 할 레슨. 가장 최근에 한 레슨이 속한 갈래를 먼저 이어 가고(여행 회화를 하던 사람은 거기서 계속),
   기록이 없으면 기초 단어부터. 그 갈래가 끝났으면 다른 갈래에서 찾는다. */
export function nextLesson(progress) {
  const p = normalizeProgress(progress);
  let recent = null; let at = -1;
  for (const [id, st] of Object.entries(p.lessons)) {
    const l = lessonById(id);
    if (l && (st?.at || 0) >= at) { at = st?.at || 0; recent = l.track; }
  }
  const tracks = SWISS_TRACKS.map((t) => t.id);
  const order = recent ? [recent, ...tracks.filter((t) => t !== recent)] : tracks;
  for (const track of order) {
    const hit = SWISS_LESSONS.find((l) => l.track === track && isUnlocked(p, l.id) && !p.lessons[l.id]);
    if (hit) return hit.id;
  }
  return null;
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
    mem: p.mem,
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
  return {
    lessons, xp: Math.max(x.xp, y.xp), weak: [...new Set([...x.weak, ...y.weak])].slice(-WEAK_CAP),
    mem: mergeMemory(x.mem, y.mem),
  };
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
  /* 복습일이 된 것 — 복습 화면에서 풀기 전에 귀로 한 번 훑는 길 */
  if (scope === 'due') return dueIds(p).map(itemById).filter(Boolean);
  if (scope === 'learned') {
    const done = new Set(Object.keys(p.lessons).filter((id) => (p.lessons[id]?.stars || 0) >= 1));
    return SWISS_ITEMS.filter((it) => done.has(it.lessonId));
  }
  return itemsOfUnit(scope);
}


/* ── 쓰기 채점 ──
 *
 * 독일어 철자는 키보드가 문제다. ä ö ü ß가 없는 자판으로 쓴 「Tschuss」「Gruezi」를 틀렸다고 하면
 * 철자를 모르는 게 아니라 자판을 못 찾은 것을 벌주는 것이다. 그래서 움라우트는 「ä=a=ae · ö=o=oe ·
 * ü=u=ue」, ß=ss로 같은 글자로 맞춰 놓고 양쪽을 견준다(정답도 같은 식으로 바꾼다). 대소문자·문장부호·
 * 여러 칸 공백은 무시한다. 명사의 대문자는 독일어의 규칙이지만 여행 회화에서 소문자로 쓴 것을
 * 틀렸다고 하지는 않는다.
 *
 * 한두 글자 다르면 close — 오타일 수 있다. 맞게 쳐 주되 정답 철자를 보여 준다. */
export function normalizeDe(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function judgeGerman(item, input) {
  const mine = normalizeDe(input);
  const want = normalizeDe(item?.de);
  if (!mine) return { verdict: 'wrong', expected: item?.de };
  if (mine === want) return { verdict: 'correct', expected: item.de };
  /* 공백만 다른 것(Auf Wiedersehen / Aufwiedersehen)은 같은 말이다 */
  if (mine.replace(/ /g, '') === want.replace(/ /g, '')) return { verdict: 'correct', expected: item.de };
  /* 명사는 관사까지 한 덩어리로 외우지만, 관사를 빼고 쓴 것(Hund)은 철자는 안 것이다 — 틀렸다고 하지 않고
     「관사도 같이」라고 알려 준다(close). 엉뚱한 관사를 붙인 것은 아래 철자 거리로 가린다. */
  const stripped = want.replace(/^(der|die|das) /, '');
  if (stripped !== want && mine === stripped) return { verdict: 'close', expected: item.de, article: true };
  const limit = want.length >= 12 ? 2 : (want.length >= 5 ? 1 : 0);
  if (limit > 0 && editDistance(mine, want) <= limit) return { verdict: 'close', expected: item.de };
  return { verdict: 'wrong', expected: item.de };
}

/* ── 복습 세션 ──
 *
 * 복습일이 된 낱말을 먼저, 모자라면(fill) 약한 순서로 미리 복습할 낱말을 채운다. 문제 유형은 낱말이
 * 얼마나 굳었는지에 따라 다르다 — 처음엔 보기가 있는 문제로, 굳을수록 보기 없이 직접 쓰게. 같은 유형만
 * 계속 나오면 낱말이 아니라 버튼 자리를 외우게 된다. */
export const REVIEW_SIZE = 12;
const SPAN = { learning: ['choose-ko', 'choose-sw', 'listen'], known: ['choose-sw', 'listen', 'write'], mastered: ['write', 'dictate'] };

export function typeFor(item, st, i) {
  const stage = stageOf(st) || 'learning';
  if (item.kind === 'sentence') return stage === 'mastered' && i % 2 === 1 ? 'write' : 'build';
  return SPAN[stage][i % SPAN[stage].length];
}

export function buildReview(progress, { size = REVIEW_SIZE, fill = false, today = todayKey(), rnd = Math.random } = {}) {
  const seeded = seedMemory(normalizeProgress(progress), today);
  const mem = memoryOf(seeded);
  const due = dueIds(seeded, today);
  const picked = due.slice(0, size);
  if (picked.length < size && fill) {
    for (const id of preReviewIds(seeded, today)) { if (picked.length >= size) break; picked.push(id); }
  }
  const items = shuffle(picked.map(itemById).filter(Boolean), rnd);
  const out = [];
  items.forEach((item, i) => {
    const lesson = lessonById(item.lessonId);
    const type = typeFor(item, stateOf(mem, item.id), i);
    if (type === 'build') out.push({ type, item, ...buildTokens(item, lesson, rnd) });
    else if (type === 'write' || type === 'dictate') out.push({ type, item });
    else out.push({ type, item, options: optionsFor(item, lesson, rnd), answerId: item.id });
  });
  const pairable = items.filter((it) => it.kind === 'word');
  if (pairable.length >= 4) out.push({ type: 'match', pairs: shuffle(pairable, rnd).slice(0, 4) });
  return { exercises: out, ids: items.map((it) => it.id), dueCount: due.length, extra: Math.max(0, items.length - Math.min(due.length, size)) };
}
