/* 「한 권으로 끝내는 N3」 — 규칙. 화면은 이걸 그리기만 한다.
 *
 * ★ 기존 기록을 그대로 쓴다 ★
 *   숙련도(NEW → LEARNING → REVIEW → MASTER)와 복습 예정일은 회독 저장소(review)에
 *   그대로 적는다 — 단어는 단어 id로, 문법은 g:…, 한자는 k:漢로. 그래서 여기서
 *   외운 단어는 앱의 오늘 학습·복습·약점에 그대로 이어지고, 기기 동기화도
 *   회독 저장소가 하는 대로 따라간다. 간격은 review.js의 규칙(1·3·7·30·90일)이다.
 *
 *   코스만의 것(레슨 완료·오늘의 N3 계획·문제별 정답률·오답 노트·시험 결과)은
 *   progress.n3에 둔다. progress는 이미 백업과 동기화에 실린다 — 새 저장 열쇠를
 *   만들지 않는다. 합치는 규칙은 mergeN3.
 *
 * ★ 열었다고 완료가 아니다 ★
 *   레슨은 문제까지 풀어야 done이고, 숙련도는 문제를 맞힌 결과(판정)로만 오른다.
 *   준비도는 진도율과 다른 숫자다 — 실제로 맞힌 결과에서만 나온다. */
import {
  GRAMMAR_LESSONS, GRAMMAR_CHAPTERS, GRAMMAR_GROUPS, GRAMMAR_QUESTIONS, grammarById, grammarOfChapter,
} from '../data/n3/grammar.js';
import { KANJI_LESSONS, KANJI_ITEMS, kanjiByChar, kanjiLessonById } from '../data/n3/kanji.js';
import { VOCAB_LESSONS, VOCAB_WORDS, VOCAB_TOPICS, vocabLessonById, vocabWordById } from '../data/n3/vocab.js';
import { READING_PASSAGES, READING_QUESTIONS, READING_LEVELS, readingById } from '../data/n3/reading.js';
import { LISTENING_ITEMS, LISTENING_QUESTIONS, LISTENING_LEVELS, listeningById } from '../data/n3/listening.js';
import { EXAM_MOJI, EXAM_NARABE, EXAM_BUNSHOU, EXAM_BUNSHOU_QUESTIONS, EXAM_QUESTIONS } from '../data/n3/exam.js';
import { stateOf, isMastered, isDue, todayKey, dueCards, addDays, BOX, MASTER_STREAK } from './review.js';
import { normalizeN3 } from './n3progress.js';

/* ── 섞기 (검사에서 고정할 수 있게 난수를 받는다) ── */
export function shuffle(list, rnd = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = (list, n, rnd) => shuffle(list, rnd).slice(0, n);

/* ═══════════ 진도 모양 — lib/n3progress.js (자료를 안 불러오는 얇은 조각) ═══════════ */
export { N3_VERSION, emptyN3, normalizeN3, mergeN3 } from './n3progress.js';

/* ═══════════ 커리큘럼 ═══════════ */
export const TRACKS = ['grammar', 'vocab', 'kanji', 'reading', 'listening'];
export const TRACK_LABEL = { grammar: '문법', vocab: '어휘', kanji: '한자', reading: '독해', listening: '청해' };

export function trackOf(id) {
  if (id.startsWith('g:')) return 'grammar';
  if (id.startsWith('v:')) return 'vocab';
  if (id.startsWith('k:')) return 'kanji';
  if (id.startsWith('r:')) return 'reading';
  if (id.startsWith('l:')) return 'listening';
  return null;
}

/* 갈래별 레슨 순서 — 오늘의 N3는 이 순서대로 다음 것을 집는다 */
export const LESSON_ORDER = {
  grammar: GRAMMAR_LESSONS.map((l) => l.id),
  vocab: VOCAB_LESSONS.map((l) => l.id),
  kanji: KANJI_LESSONS.map((l) => l.id),
  reading: READING_PASSAGES.map((p) => p.id),
  listening: LISTENING_ITEMS.map((l) => l.id),
};

export const CURRICULUM = [
  ...GRAMMAR_CHAPTERS.map((c) => ({
    id: c.id, kind: 'grammar', title: c.title, sub: c.sub, emoji: c.emoji,
    lessons: grammarOfChapter(c.id).map((l) => l.id),
    groups: c.id === 'ch2' ? GRAMMAR_GROUPS.map((g) => ({ ...g, lessons: GRAMMAR_LESSONS.filter((l) => l.group === g.id).map((l) => l.id) })) : null,
    test: `t:${c.id}`,
  })),
  {
    id: 'ch3', kind: 'vocab', title: 'N3 어휘', sub: `주제별 ${VOCAB_TOPICS.length}묶음 · ${VOCAB_WORDS.length}단어`, emoji: '🗂️',
    lessons: LESSON_ORDER.vocab,
    groups: VOCAB_TOPICS.map((t) => ({ id: t.id, title: `${t.emoji} ${t.title}`, lessons: VOCAB_LESSONS.filter((l) => l.topic === t.id).map((l) => l.id) })),
    test: 't:vocab',
  },
  {
    id: 'ch4', kind: 'kanji', title: 'N3 한자', sub: `${KANJI_LESSONS.length}과 · ${KANJI_ITEMS.length}자 — 한국 한자와 잇기`, emoji: '㊙️',
    lessons: LESSON_ORDER.kanji, test: 't:kanji',
  },
  {
    id: 'ch5', kind: 'reading', title: '독해 훈련', sub: '두세 문장 → 안내문 → 단문 → 중문 → 실전', emoji: '📖',
    lessons: LESSON_ORDER.reading,
    groups: READING_LEVELS.map((lv) => ({ id: `rl${lv.level}`, title: `Level ${lv.level} · ${lv.title}`, sub: lv.sub, lessons: READING_PASSAGES.filter((p) => p.level === lv.level).map((p) => p.id) })),
  },
  {
    id: 'ch6', kind: 'listening', title: '청해 훈련', sub: '듣기 → 문제 → 스크립트 → 분석 → 섀도잉', emoji: '🎧',
    lessons: LESSON_ORDER.listening,
    groups: LISTENING_LEVELS.map((lv) => ({ id: `ll${lv.level}`, title: `Level ${lv.level} · ${lv.title}`, sub: lv.sub, lessons: LISTENING_ITEMS.filter((p) => p.level === lv.level).map((p) => p.id) })),
  },
  {
    id: 'ch7', kind: 'exam', title: 'N3 실전 모드', sub: '문자·어휘 · 문법 · 독해 · 청해 모의고사', emoji: '📝',
    lessons: [], test: 'exam',
  },
];

export const TEST_TITLES = {
  't:ch0': 'N4 진단 테스트', 't:ch1': 'Chapter 1 확인 테스트', 't:ch2': 'Chapter 2 확인 테스트',
  't:vocab': '어휘 확인 테스트', 't:kanji': '한자 확인 테스트', exam: 'N3 모의고사',
};

export function lessonOf(id) {
  const t = trackOf(id);
  if (t === 'grammar') return grammarById(id);
  if (t === 'vocab') return vocabLessonById(id);
  if (t === 'kanji') return kanjiLessonById(id);
  if (t === 'reading') return readingById(id);
  if (t === 'listening') return listeningById(id);
  return null;
}

export function lessonTitle(id) {
  if (TEST_TITLES[id]) return TEST_TITLES[id];
  const l = lessonOf(id);
  if (!l) return id;
  if (trackOf(id) === 'kanji') return `한자 ${l.id.slice(2)}과 · ${l.title}`;
  return l.title;
}

/* ── 완료 ── */
const seenIds = (review, ids) => ids.filter((id) => stateOf(review, id).lastSeen);

export function isLessonDone(n3, review, id) {
  if (n3.lessons[id]?.done || n3.skip[id]) return true;
  const t = trackOf(id);
  /* 어휘·한자 레슨은 그 안의 것을 전부 한 번이라도 판정했으면 끝난 것 —
     레슨 화면 밖(오늘의 N3)에서도 낱개로 배우기 때문이다 */
  if (t === 'vocab') { const l = vocabLessonById(id); return Boolean(l) && seenIds(review, l.words.map((w) => w.id)).length >= l.words.length; }
  if (t === 'kanji') { const l = kanjiLessonById(id); return Boolean(l) && seenIds(review, l.kanji.map((k) => k.id)).length >= l.kanji.length; }
  return false;
}

export function nextLesson(n3, review, track) {
  return LESSON_ORDER[track].find((id) => !isLessonDone(n3, review, id)) || null;
}

/* 아직 안 본 것 — 어휘·한자 갈래에서 오늘 몫을 집을 때 */
export function unseenOfLesson(review, id) {
  const t = trackOf(id);
  if (t === 'vocab') return vocabLessonById(id).words.map((w) => w.id).filter((x) => !stateOf(review, x).lastSeen);
  if (t === 'kanji') return kanjiLessonById(id).kanji.map((k) => k.id).filter((x) => !stateOf(review, x).lastSeen);
  return [];
}

export function progressOf(n3, review) {
  const per = {};
  let done = 0; let total = 0;
  for (const t of TRACKS) {
    const ids = LESSON_ORDER[t];
    const d = ids.filter((id) => isLessonDone(n3, review, id)).length;
    per[t] = { done: d, total: ids.length, pct: ids.length ? Math.round((d / ids.length) * 100) : 0 };
    done += d; total += ids.length;
  }
  return { ...per, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* ═══════════ 숙련도 ═══════════ */
export const MASTERY = ['new', 'learning', 'review', 'master'];
export const MASTERY_LABEL = { new: 'NEW', learning: 'LEARNING', review: 'REVIEW', master: 'MASTER' };

export function masteryOf(st) {
  if (!st?.lastSeen) return 'new';
  if (isMastered(st)) return 'master';
  if (st.box < BOX.KNOWN || (st.level || 0) < 1) return 'learning';
  return 'review';
}

/* 준비도에 쓰는 무게 — 맞힌 결과(level)에서만 나온다. 자가 신고(selfKnown)는 반만 */
export function readinessWeight(st) {
  if (!st?.lastSeen) return 0;
  if (st.selfKnown) return 0.5;
  if (isMastered(st)) return 1;
  const lv = st.level || 0;
  if (lv >= 3) return 0.85;
  if (lv === 2) return 0.65;
  if (lv === 1) return st.box >= BOX.KNOWN ? 0.45 : 0.25;
  return st.box >= BOX.KNOWN ? 0.3 : 0.15;
}

const N3_GRAMMAR_IDS = GRAMMAR_LESSONS.filter((l) => l.ch !== 'ch0').map((l) => l.id);
const VOCAB_IDS = VOCAB_WORDS.map((w) => w.id);
const KANJI_IDS = KANJI_ITEMS.map((k) => k.id);

function meanWeight(review, ids) {
  if (!ids.length) return 0;
  let s = 0;
  for (const id of ids) s += readinessWeight(stateOf(review, id));
  return s / ids.length;
}
function meanTests(n3, ids) {
  if (!ids.length) return 0;
  let s = 0;
  for (const id of ids) { const t = n3.tests[id]; if (t && t.total) s += (t.best ?? t.right / t.total); }
  return s / ids.length;
}

export const READINESS_WEIGHTS = { vocab: 0.25, kanji: 0.15, grammar: 0.25, reading: 0.2, listening: 0.15 };

export function readinessOf(n3, review) {
  const r = {
    vocab: meanWeight(review, VOCAB_IDS),
    kanji: meanWeight(review, KANJI_IDS),
    grammar: meanWeight(review, N3_GRAMMAR_IDS),
    reading: meanTests(n3, LESSON_ORDER.reading),
    listening: meanTests(n3, LESSON_ORDER.listening),
  };
  const total = TRACKS.reduce((s, t) => s + r[t] * READINESS_WEIGHTS[t], 0);
  const pct = (x) => Math.round(x * 100);
  return { vocab: pct(r.vocab), kanji: pct(r.kanji), grammar: pct(r.grammar), reading: pct(r.reading), listening: pct(r.listening), total: pct(total) };
}

/* 갈래별 숙련도 분포 — 대시보드의 「어휘 42%」는 이걸로 그린다 */
export function masterySummary(review, ids) {
  const out = { new: 0, learning: 0, review: 0, master: 0, total: ids.length };
  for (const id of ids) out[masteryOf(stateOf(review, id))] += 1;
  return out;
}
export const TRACK_ITEM_IDS = { vocab: VOCAB_IDS, kanji: KANJI_IDS, grammar: N3_GRAMMAR_IDS };

/* ═══════════ 답 기록 ═══════════ */
export function verdictFor(right, total) {
  if (total <= 0) return null;
  if (right >= total) return 'known';
  if (right * 2 >= total) return 'vague';
  return 'unknown';
}

/* 문제 하나의 결과. 문제별 정답률·오답 노트·오늘 학습량을 한 번에 적는다.
   회독 판정은 여기서 하지 않는다 — 부르는 쪽이 applyVerdicts로 한 번에 넘긴다. */
export function recordAnswer(n3, { qid, ok, cat = 'grammar', ref = null, today = todayKey(), at = Date.now() }) {
  const p = normalizeN3(n3);
  const q = { ...(p.q[qid] || { r: 0, w: 0 }) };
  if (ok) q.r += 1; else q.w += 1;
  const wrong = { ...p.wrong };
  if (ok) {
    const w = wrong[qid];
    if (w) {
      const okc = (w.ok || 0) + 1;
      if (okc >= 2) delete wrong[qid];   // 두 번 이어 맞히면 오답 노트에서 뺀다
      else wrong[qid] = { ...w, ok: okc };
    }
  } else {
    const w = wrong[qid] || { c: 0 };
    wrong[qid] = { c: (w.c || 0) + 1, at, cat, ref, ok: 0 };
  }
  const day = { ...(p.days[today] || {}) };
  day.answered = (day.answered || 0) + 1;
  day.right = (day.right || 0) + (ok ? 1 : 0);
  day.at = at;
  return { ...p, q: { ...p.q, [qid]: q }, wrong, days: { ...p.days, [today]: day } };
}

export function markLesson(n3, id, { score = null, at = Date.now() } = {}) {
  const p = normalizeN3(n3);
  const prev = p.lessons[id] || {};
  return { ...p, lessons: { ...p.lessons, [id]: { done: true, at, score: score ?? prev.score ?? null, tries: (prev.tries || 0) + 1 } } };
}

export function recordTest(n3, id, { right, total, at = Date.now() }) {
  const p = normalizeN3(n3);
  const prev = p.tests[id] || {};
  const acc = total ? right / total : 0;
  return { ...p, tests: { ...p.tests, [id]: { best: Math.max(prev.best || 0, acc), last: acc, right, total, tries: (prev.tries || 0) + 1, at } } };
}

export function recordExam(n3, result) {
  const p = normalizeN3(n3);
  return { ...p, exams: [...p.exams, result].slice(-20) };
}

/* 진단(N4)의 결과 — 맞힌 꼭지는 건너뛴다 */
export function applyDiagnosis(n3, results) {
  const p = normalizeN3(n3);
  const skip = { ...p.skip };
  for (const [lessonId, ok] of Object.entries(results)) {
    if (ok) skip[lessonId] = true; else delete skip[lessonId];
  }
  return { ...p, skip };
}

/* ═══════════ 오늘의 N3 ═══════════ */
export const DAY_SIZES = { vocab: 8, kanji: 4, review: 10 };
export const STEP_LABEL = { vocab: '어휘', kanji: '한자', grammar: '문법', reading: '독해', listening: '청해', review: '오늘의 복습' };
export const STEP_MINUTES = { vocab: 6, kanji: 4, grammar: 7, reading: 5, listening: 5, review: 5 };

/* 코스에 든 모든 회독 id — 복습 단계가 여기서 오늘 것을 집는다 */
export const COURSE_CARD_IDS = [...GRAMMAR_LESSONS.map((l) => l.id), ...KANJI_IDS, ...VOCAB_IDS];

export function buildDayPlan(n3, review, today = todayKey()) {
  const p = normalizeN3(n3);
  const steps = [];

  const vLesson = nextLesson(p, review, 'vocab');
  if (vLesson) {
    const ids = unseenOfLesson(review, vLesson).slice(0, DAY_SIZES.vocab);
    if (ids.length) steps.push({ kind: 'vocab', lesson: vLesson, ids, done: false });
  }
  const kLesson = nextLesson(p, review, 'kanji');
  if (kLesson) {
    const ids = unseenOfLesson(review, kLesson).slice(0, DAY_SIZES.kanji);
    if (ids.length) steps.push({ kind: 'kanji', lesson: kLesson, ids, done: false });
  }
  const gLesson = nextLesson(p, review, 'grammar');
  if (gLesson) steps.push({ kind: 'grammar', lesson: gLesson, done: false });

  /* 독해와 청해는 하루씩 번갈아. 한쪽이 다 끝났으면 남은 쪽 */
  const dayIndex = Object.keys(p.days).filter((d) => d < today).length;
  const order = dayIndex % 2 === 0 ? ['reading', 'listening'] : ['listening', 'reading'];
  for (const t of order) {
    const id = nextLesson(p, review, t);
    if (id) { steps.push({ kind: t, lesson: id, done: false }); break; }
  }

  const due = dueCards(COURSE_CARD_IDS, review, today, DAY_SIZES.review);
  if (due.length) steps.push({ kind: 'review', ids: due, done: false });

  return { date: today, steps, at: Date.now() };
}

/* 오늘 계획이 없으면 짠다. 있으면 그대로 — 다시 짜면 하던 게 사라진다. */
export function ensureDayPlan(n3, review, today = todayKey()) {
  const p = normalizeN3(n3);
  const cur = p.days[today];
  if (cur?.steps?.length || cur?.built) return { n3: p, plan: cur };
  const plan = buildDayPlan(p, review, today);
  const day = { ...(cur || {}), steps: plan.steps, built: plan.at, answered: cur?.answered || 0, right: cur?.right || 0 };
  return { n3: { ...p, days: { ...p.days, [today]: day } }, plan: day };
}

export function markStep(n3, today, index, done = true) {
  const p = normalizeN3(n3);
  const day = p.days[today];
  if (!day?.steps?.[index]) return p;
  const steps = day.steps.map((s, i) => (i === index ? { ...s, done } : s));
  return { ...p, days: { ...p.days, [today]: { ...day, steps } } };
}

export function dayStatus(day) {
  const steps = day?.steps || [];
  const done = steps.filter((s) => s.done).length;
  const minutes = steps.filter((s) => !s.done).reduce((m, s) => m + (STEP_MINUTES[s.kind] || 4), 0);
  return { total: steps.length, done, left: steps.length - done, minutes, finished: steps.length > 0 && done >= steps.length, next: steps.findIndex((s) => !s.done) };
}

export function todayAmount(n3, today = todayKey()) {
  const d = normalizeN3(n3).days[today];
  return { answered: d?.answered || 0, right: d?.right || 0 };
}
export function weekAmount(n3, today = todayKey()) {
  const p = normalizeN3(n3);
  const from = addDays(today, -6);
  let answered = 0; let right = 0; let days = 0;
  for (const [d, v] of Object.entries(p.days)) {
    if (d < from || d > today) continue;
    if ((v.answered || 0) > 0) days += 1;
    answered += v.answered || 0; right += v.right || 0;
  }
  return { answered, right, days };
}

/* ═══════════ 문제 만들기 ═══════════ */
const KANA = /^[\u3040-\u30ff・ー]+$/;

/* 단어 문제 — 뜻 고르기(jp→ko) / 일본어 고르기(ko→jp) / 읽기 고르기(kanji→kana). 보기 셋.
   보기는 같은 주제에서 먼저 뽑고 모자라면 전체에서. 뜻이 같은 것은 보기에 안 넣는다. */
export function vocabQuestion(word, type, rnd = Math.random) {
  const same = VOCAB_WORDS.filter((w) => w.id !== word.id && w.topic === word.topic);
  const pool = same.length >= 6 ? same : VOCAB_WORDS.filter((w) => w.id !== word.id);
  const others = [];
  for (const w of shuffle(pool, rnd)) {
    if (others.length >= 2) break;
    if (type === 'ko' && (w.mean === word.mean || others.some((o) => o.mean === w.mean))) continue;
    if (type === 'kana' && (w.kana === word.kana || others.some((o) => o.kana === w.kana))) continue;
    if (type === 'jp' && (w.kanji === word.kanji || others.some((o) => o.kanji === w.kanji))) continue;
    others.push(w);
  }
  const all = shuffle([word, ...others], rnd);
  if (type === 'kana') {
    return { id: `vq:${word.id}:kana`, kind: 'vocab', cat: 'vocab', ref: word.id, refTitle: word.kanji, type: 'choice',
      q: `【${word.kanji}】の読み方は？`, sub: word.mean, options: all.map((w) => w.kana), answer: word.kana,
      why: Object.fromEntries(others.map((w) => [w.kana, `「${w.kana}」는 ${w.kanji}(${w.mean})의 읽기예요.`])), expl: `${word.kanji} = ${word.kana}`, speak: word.kana, d: 1 };
  }
  if (type === 'jp') {
    return { id: `vq:${word.id}:jp`, kind: 'vocab', cat: 'vocab', ref: word.id, refTitle: word.kanji, type: 'choice',
      q: `「${word.mean}」는 일본어로?`, options: all.map((w) => w.kanji), optionSubs: all.map((w) => w.kana), answer: word.kanji,
      why: Object.fromEntries(others.map((w) => [w.kanji, `${w.kanji}(${w.kana})는 「${w.mean}」이에요.`])), expl: `${word.kanji}(${word.kana}) = ${word.mean}`, speakAfter: word.kana, d: 1 };
  }
  return { id: `vq:${word.id}:ko`, kind: 'vocab', cat: 'vocab', ref: word.id, refTitle: word.kanji, type: 'choice',
    q: word.kanji, sub: word.kana, options: all.map((w) => w.mean), answer: word.mean,
    why: Object.fromEntries(others.map((w) => [w.mean, `「${w.mean}」는 ${w.kanji}(${w.kana})예요.`])), expl: `${word.kanji}(${word.kana}) = ${word.mean}${word.exampleKo ? `\n${word.example} — ${word.exampleKo}` : ''}`, speak: word.kana, d: 1 };
}

const VOCAB_TYPES = ['ko', 'jp', 'kana'];
export function vocabQuestions(wordIds, rnd = Math.random) {
  return wordIds.map((id, i) => {
    const w = vocabWordById(id);
    if (!w) return null;
    let type = VOCAB_TYPES[i % VOCAB_TYPES.length];
    if (type === 'kana' && (KANA.test(w.kanji) || w.kanji === w.kana)) type = 'ko';   // 가나뿐이면 읽기 문제가 안 된다
    return vocabQuestion(w, type, rnd);
  }).filter(Boolean);
}

/* 한자 문제 — 그 한자가 든 단어의 읽기를 고른다. 보기는 다른 한자의 단어 읽기. */
export function kanjiQuestion(k, rnd = Math.random, which = 0) {
  const word = k.words[which % k.words.length];
  const others = [];
  const pool = shuffle(KANJI_ITEMS.filter((x) => x.k !== k.k), rnd);
  for (const o of pool) {
    if (others.length >= 2) break;
    const w = o.words[Math.floor(rnd() * o.words.length)];
    if (w[1] === word[1] || others.some((x) => x[1] === w[1])) continue;
    others.push(w);
  }
  const all = shuffle([word, ...others], rnd);
  return { id: `kq:${k.k}:${which % k.words.length}`, kind: 'kanji', cat: 'kanji', ref: k.id, refTitle: k.k, type: 'choice',
    q: `【${word[0]}】の読み方は？`, sub: `${k.k} — ${k.kh}`, options: all.map((w) => w[1]), answer: word[1],
    why: Object.fromEntries(others.map((w) => [w[1], `「${w[1]}」는 ${w[0]}(${w[2]})예요.`])), expl: `${word[0]}(${word[1]}) = ${word[2]} · ${k.k}: ${k.on}${k.kun && k.kun !== '—' ? ` / ${k.kun}` : ''}`, speak: word[1], d: 1 };
}
export function kanjiQuestions(kanjiIds, rnd = Math.random) {
  return kanjiIds.map((id, i) => { const k = kanjiByChar(id.slice(2)); return k ? kanjiQuestion(k, rnd, i) : null; }).filter(Boolean);
}

export function grammarQuestionsOf(lessonId) {
  return GRAMMAR_QUESTIONS.filter((q) => q.ref === lessonId).map((q) => ({ ...q, type: 'choice' }));
}

/* 복습 단계 — 회독 id 하나를 문제 하나로 */
export function questionForCard(id, rnd = Math.random) {
  const t = trackOf(id);
  if (t === 'grammar') { const qs = grammarQuestionsOf(id); return qs.length ? qs[Math.floor(rnd() * qs.length)] : null; }
  if (t === 'kanji') { const k = kanjiByChar(id.slice(2)); return k ? kanjiQuestion(k, rnd, Math.floor(rnd() * k.words.length)) : null; }
  const w = vocabWordById(id);
  if (!w) return null;
  const type = rnd() < 0.5 ? 'ko' : (KANA.test(w.kanji) ? 'jp' : 'kana');
  return vocabQuestion(w, type, rnd);
}
export function reviewQuestions(ids, rnd = Math.random) {
  return ids.map((id) => questionForCard(id, rnd)).filter(Boolean);
}

/* 모든 고정 문제(문법·독해·청해·실전)를 id로. 단어·한자 문제는 id에서 다시 만든다. */
const FIXED = new Map([...GRAMMAR_QUESTIONS, ...READING_QUESTIONS, ...LISTENING_QUESTIONS, ...EXAM_QUESTIONS].map((q) => [q.id, q]));
export function questionById(id, rnd = Math.random) {
  const f = FIXED.get(id);
  if (f) return { type: f.type || 'choice', ...f };
  if (id.startsWith('vq:')) {
    const [, wid, type] = id.split(':');
    const w = vocabWordById(wid);
    return w ? vocabQuestion(w, type, rnd) : null;
  }
  if (id.startsWith('kq:')) {
    const [, ch, which] = id.split(':');
    const k = kanjiByChar(ch);
    return k ? kanjiQuestion(k, rnd, Number(which) || 0) : null;
  }
  return null;
}

/* ═══════════ 확인 테스트 · 진단 · 모의고사 ═══════════ */
export function checkTest(id, n3, review, rnd = Math.random) {
  if (id === 't:ch0') {
    /* 진단 — 꼭지마다 한 문제. 맞히면 그 꼭지는 건너뛴다 */
    return grammarOfChapter('ch0').map((l) => { const qs = grammarQuestionsOf(l.id); return qs[Math.floor(rnd() * qs.length)]; });
  }
  if (id === 't:ch1' || id === 't:ch2') {
    const ch = id.slice(2);
    const lessons = shuffle(grammarOfChapter(ch), rnd);
    const out = [];
    for (const l of lessons) { if (out.length >= 20) break; const qs = grammarQuestionsOf(l.id); out.push(qs[Math.floor(rnd() * qs.length)]); }
    return out;
  }
  if (id === 't:vocab') {
    const seen = VOCAB_IDS.filter((x) => stateOf(review, x).lastSeen);
    const ids = pick(seen.length >= 10 ? seen : VOCAB_IDS, 20, rnd);
    return ids.map((x, i) => vocabQuestion(vocabWordById(x), VOCAB_TYPES[i % 3] === 'kana' && KANA.test(vocabWordById(x).kanji) ? 'ko' : VOCAB_TYPES[i % 3], rnd));
  }
  if (id === 't:kanji') {
    const seen = KANJI_IDS.filter((x) => stateOf(review, x).lastSeen);
    return kanjiQuestions(pick(seen.length >= 10 ? seen : KANJI_IDS, 20, rnd), rnd);
  }
  return [];
}

export const EXAM_PLAN = { yomi: 8, hyoki: 4, bunmyaku: 6, iikae: 4, youhou: 3, bunpo1: 13, narabe: 5, bunshou: 1, reading: { 3: 2, 4: 1, 5: 1 }, listening: { 1: 2, 2: 2, 3: 2 } };

export function mockExam(rnd = Math.random) {
  const sec = (s, n) => pick(EXAM_MOJI.filter((q) => q.sec === `moji-${s}`), n, rnd).map((q) => ({ type: 'choice', ...q }));
  const moji = [...sec('yomi', EXAM_PLAN.yomi), ...sec('hyoki', EXAM_PLAN.hyoki), ...sec('bunmyaku', EXAM_PLAN.bunmyaku), ...sec('iikae', EXAM_PLAN.iikae), ...sec('youhou', EXAM_PLAN.youhou)];
  const bunpo1 = pick(GRAMMAR_QUESTIONS.filter((q) => !q.ref.startsWith('g:') || grammarById(q.ref)?.ch !== 'ch0'), EXAM_PLAN.bunpo1, rnd).map((q) => ({ type: 'choice', ...q, sec: 'bunpo-1' }));
  const narabe = pick(EXAM_NARABE, EXAM_PLAN.narabe, rnd);
  const bunshou = pick(EXAM_BUNSHOU, EXAM_PLAN.bunshou, rnd).flatMap((p) => EXAM_BUNSHOU_QUESTIONS.filter((q) => q.ref === p.id).map((q) => ({ type: 'choice', ...q })));
  const reading = Object.entries(EXAM_PLAN.reading).flatMap(([lv, n]) => pick(READING_PASSAGES.filter((p) => p.level === Number(lv)), n, rnd));
  const listening = Object.entries(EXAM_PLAN.listening).flatMap(([lv, n]) => pick(LISTENING_ITEMS.filter((p) => p.level === Number(lv)), n, rnd));
  return { moji, bunpo: [...bunpo1, ...narabe, ...bunshou], reading, listening };
}

/* ═══════════ 오답 노트 · 약점 ═══════════ */
export const WRONG_CATS = [
  { id: 'vocab', label: '어휘' }, { id: 'kanji', label: '한자' }, { id: 'grammar', label: '문법' },
  { id: 'particle', label: '조사' }, { id: 'reading', label: '독해' }, { id: 'listening', label: '청해' },
];

export function wrongNotes(n3) {
  const p = normalizeN3(n3);
  const list = Object.entries(p.wrong).map(([qid, w]) => ({ qid, ...w })).sort((a, b) => (b.at || 0) - (a.at || 0));
  const byCat = {};
  for (const c of WRONG_CATS) byCat[c.id] = [];
  for (const w of list) (byCat[w.cat] || (byCat[w.cat] = [])).push(w);
  return { list, byCat };
}

/* 반복해서 틀리는 유형 — 문제의 ref(레슨·단어·한자)별로 틀린 수를 모은다 */
export function weakPatterns(n3, limit = 5) {
  const p = normalizeN3(n3);
  const agg = {};
  for (const [qid, s] of Object.entries(p.q)) {
    const fq = questionById(qid);
    const ref = fq?.ref || p.wrong[qid]?.ref;
    if (!ref) continue;
    const a = agg[ref] || (agg[ref] = { ref, r: 0, w: 0 });
    a.r += s.r || 0; a.w += s.w || 0;
  }
  return Object.values(agg)
    .filter((a) => a.w >= 2 && a.w > a.r * 0.5)
    .sort((a, b) => (b.w - a.w) || ((b.w / (b.r + b.w)) - (a.w / (a.r + a.w))))
    .slice(0, limit)
    .map((a) => ({ ...a, title: refTitle(a.ref), rate: Math.round((a.w / (a.r + a.w)) * 100) }));
}

export function refTitle(ref) {
  if (!ref) return '';
  const t = trackOf(ref);
  if (t === 'grammar' || t === 'reading' || t === 'listening' || t === 'kanji') {
    const l = lessonOf(ref);
    if (l) return t === 'kanji' && !ref.match(/^k:\d+$/) ? `${l.k} (${l.kh})` : l.title;
    const k = kanjiByChar(ref.slice(2));
    if (k) return `${k.k} (${k.kh})`;
  }
  const w = vocabWordById(ref);
  if (w) return `${w.kanji} (${w.mean})`;
  if (ref.startsWith('x:')) return '실전 · 글의 문법';
  return ref;
}

/* 약점만 공부하기 — 오답 노트의 문제 + 약한 유형의 다른 문제. 최근 것부터. */
export function weakSession(n3, limit = 12, rnd = Math.random) {
  const p = normalizeN3(n3);
  const out = []; const used = new Set();
  const add = (q) => { if (q && !used.has(q.id)) { used.add(q.id); out.push(q); } };
  for (const w of wrongNotes(p).list) { if (out.length >= limit) break; add(questionById(w.qid, rnd)); }
  for (const pat of weakPatterns(p, 8)) {
    if (out.length >= limit) break;
    const t = trackOf(pat.ref);
    if (t === 'grammar') for (const q of shuffle(grammarQuestionsOf(pat.ref), rnd)) { if (out.length >= limit) break; add(q); }
    else add(questionForCard(pat.ref, rnd));
  }
  return { questions: shuffle(out, rnd), patterns: weakPatterns(p, 5) };
}

/* 코스 안의 오늘 복습감 — 「복습」 버튼이 몇 개인지 미리 적는다 */
export function dueInCourse(review, today = todayKey()) {
  return dueCards(COURSE_CARD_IDS, review, today, 200);
}

/* 화면에서 쓰는 이름 몇 개 */
export { GRAMMAR_CHAPTERS, GRAMMAR_GROUPS, MASTER_STREAK };
export const COUNTS = {
  grammar: GRAMMAR_LESSONS.length, vocab: VOCAB_WORDS.length, vocabLessons: VOCAB_LESSONS.length,
  kanji: KANJI_ITEMS.length, reading: READING_PASSAGES.length, listening: LISTENING_ITEMS.length,
  questions: GRAMMAR_QUESTIONS.length + READING_QUESTIONS.length + LISTENING_QUESTIONS.length + EXAM_QUESTIONS.length,
};
export const isDueCard = (review, id, today = todayKey()) => isDue(stateOf(review, id), today);
