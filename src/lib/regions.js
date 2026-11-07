/* 성장 지도 — 지역마다 「무엇을 하면 클리어인가」를 한곳에 둔다.
 *
 * ★ 이 파일이 하는 일 ★
 *   · 지역의 학습 목표, 필수 수련 항목(실제 기록에서 세는 것), 승급시험(조건 · 통과 기준)을 정한다
 *   · 기존 기록으로 달성 상태를 계산한다 — 따로 세는 숫자를 만들지 않는다
 *   · 화면(HunterDashboard)과 승급시험 진입(App)이 같은 정의를 본다
 *
 * ★ 세 가지는 서로 다른 말이다 ★
 *   헌터 XP · 레벨   학습 활동의 보상(lib/hunter.js). 여기와 상관없다 — XP가 높다고 지역이 클리어되지 않는다
 *   지역 승급         이 파일. 필수 수련을 채우고 승급시험을 통과해야 한다
 *   N3 준비도         영역별 학습·평가 기록(lib/n3.js readinessOf). 지역 클리어와 같은 수치가 아니다
 *
 * ★ 「한 번 봤다」는 완료가 아니다 ★
 *   단어는 날짜를 두고 확인된 것(level ≥ 1 — 다른 날 다시 만나 맞혔다)이거나 외운 것(마스터)만 센다.
 *   「이미 안다」고 직접 누른 것(selfKnown)은 세지 않는다. 카드를 열어 봤다는 이유로 달성이 오르지 않는다.
 *
 * ★ 평가 데이터가 없으면 「실력 확인 전」이다 ★
 *   수련을 채웠어도 승급시험을 안 봤으면 실력을 알 수 없다. 완료도 실력도 지어내지 않는다.
 *   승급시험은 기존 N3 확인 테스트(progress.n3.tests)를 그대로 쓰고, N3 테스트가 없는 N5·N4 지역은
 *   지역 확인 퀴즈(progress.regions[id].exam)를 둔다 — 본 낱말 중에서 낸다.
 *
 * ★ 이미 충족한 것을 다시 시키지 않는다 ★
 *   업데이트 전에 쌓은 기록으로 바로 계산한다. 예전에 합격한 N3 확인 테스트도 그대로 통과로 센다. */
import { todayKey } from './review.js';

export const PASS_RATIO = 0.8;

/* kind별 필수 항목:
 *   words    — level 등급의 확인된 단어 target개
 *   grammar  — 기초 문법 꼭지(progress.grammarDone) target개 완료
 *   rpg      — 상황 대화 스테이지 target개 클리어
 *   chapter  — N3 코스의 chapter 문법 레슨 전부 완료(코스 자료가 필요해 n3meta로 받는다)
 *   track    — N3 코스의 track(reading 등) 레슨 target개 완료
 * 승급시험(exam):
 *   source 'n3'     — progress.n3.tests[testId].best (0~1). 응시는 N3 코스의 테스트 화면
 *   source 'region' — progress.regions[지역].exam. 응시는 본 낱말로 내는 지역 확인 퀴즈(count문제, level 등급) */
export const REGION_RULES = [
  {
    id: 'kukuroo', level: 'N5',
    goal: 'N5 첫 단어를 날짜를 두고 확인하고, 기초 문법을 시작해요',
    reqs: [
      { id: 'w', kind: 'words', level: 'N5', target: 30, label: '확인한 N5 단어', unit: '개', go: { menu: 'words' } },
      { id: 'g', kind: 'grammar', target: 3, label: '기초 문법', unit: '꼭지', go: { menu: 'grammar' } },
    ],
    exam: { source: 'region', label: '쿠쿠루 확인 퀴즈', level: 'N5', count: 15 },
  },
  {
    id: 'whale', level: 'N5',
    goal: 'N5 단어를 폭넓게 확인하고, 상황 대화를 한 번 통과해요',
    reqs: [
      { id: 'w', kind: 'words', level: 'N5', target: 100, label: '확인한 N5 단어', unit: '개', go: { menu: 'kiju' } },
      { id: 'r', kind: 'rpg', target: 1, label: '통과한 상황 대화', unit: '개', go: { menu: 'rpg' } },
    ],
    exam: { source: 'region', label: '기린섬 확인 퀴즈', level: 'N5', count: 20 },
  },
  {
    id: 'heavens', level: 'N4',
    goal: 'N4 기초 문법(Chapter 0)을 끝내고 N4 단어를 확인해요',
    reqs: [
      { id: 'c', kind: 'chapter', chapter: 'ch0', label: 'N4 기초 문법 레슨', unit: '개', go: { menu: 'n3', view: { kind: 'curriculum', chapter: 'ch0' } } },
      { id: 'w', kind: 'words', level: 'N4', target: 60, label: '확인한 N4 단어', unit: '개', go: { menu: 'words' } },
    ],
    exam: { source: 'n3', testId: 't:ch0', label: 'N4 진단 테스트' },
  },
  {
    id: 'exam', level: 'N4',
    goal: 'N4 단어를 넓게 확인하고 상황 대화로 응용해요',
    reqs: [
      { id: 'w', kind: 'words', level: 'N4', target: 150, label: '확인한 N4 단어', unit: '개', go: { menu: 'stream' } },
      { id: 'r', kind: 'rpg', target: 3, label: '통과한 상황 대화', unit: '개', go: { menu: 'rpg' } },
    ],
    exam: { source: 'region', label: '헌터시험장 확인 퀴즈', level: 'N4', count: 20 },
  },
  {
    id: 'yorknew', level: 'N3',
    goal: 'N3 핵심 문법(Chapter 1)을 끝내고 독해를 시작해요',
    reqs: [
      { id: 'c', kind: 'chapter', chapter: 'ch1', label: 'N3 핵심 문법 레슨', unit: '개', go: { menu: 'n3', view: { kind: 'curriculum', chapter: 'ch1' } } },
      { id: 't', kind: 'track', track: 'reading', target: 3, label: 'N3 독해 레슨', unit: '개', go: { menu: 'n3', view: { kind: 'curriculum', chapter: 'ch5' } } },
    ],
    exam: { source: 'n3', testId: 't:ch1', label: 'Chapter 1 확인 테스트' },
  },
  {
    id: 'greed', level: 'N3',
    goal: 'N3 코스 레슨을 절반 이상 끝내고 모의고사에 도전해요',
    reqs: [
      { id: 'o', kind: 'n3all', target: 50, label: 'N3 코스 진도', unit: '%', go: { menu: 'n3', view: { kind: 'today' } } },
    ],
    exam: { source: 'n3', testId: 'exam', label: 'N3 모의고사', pass: 0.6 },
  },
];

/* 확인된 단어인가 — 다른 날 다시 만나 맞혔다(level ≥ 1: 복습일에만, 하루에 한 칸만 오른다). 직접 「안다」고 누른 것은 아니다 */
export function isConfirmedWord(st) {
  if (!st || !st.lastSeen || st.selfKnown) return false;
  return (st.level || 0) >= 1;     // 외운 것(마스터)도 level ≥ 4라 여기 들어 있다
}

/* 지금 보기만 한 단어(확인 전) — 「학습 진행」을 보여 줄 때 쓴다 */
function seenWord(st) { return Boolean(st && st.lastSeen && !st.selfKnown); }

function levelWords(words, level) {
  return words.filter((w) => String(w.level).toUpperCase() === level);
}

/* 항목 하나를 센다. null이면 아직 못 센다(N3 코스 자료를 불러오는 중). */
function measure(req, ctx) {
  const { words = [], review = {}, progress = {}, n3meta = null } = ctx;
  if (req.kind === 'words') {
    const pool = levelWords(words, req.level);
    const done = pool.filter((w) => isConfirmedWord(review[w.id])).length;
    const seen = pool.filter((w) => seenWord(review[w.id])).length;
    return { done, total: req.target, seen, poolSize: pool.length };
  }
  if (req.kind === 'grammar') {
    return { done: Object.values(progress.grammarDone || {}).filter((n) => n > 0).length, total: req.target };
  }
  if (req.kind === 'rpg') {
    return { done: Object.values(progress.rpg?.stages || {}).filter((s) => s?.cleared > 0).length, total: req.target };
  }
  if (!n3meta) return null;
  if (req.kind === 'chapter') {
    const c = n3meta.chapters?.[req.chapter];
    return c ? { done: c.done, total: c.total } : null;
  }
  if (req.kind === 'track') {
    const t = n3meta.tracks?.[req.track];
    return t ? { done: Math.min(t.done, req.target), total: Math.min(req.target, t.total || req.target), actual: t.done } : null;
  }
  if (req.kind === 'n3all') {
    const o = n3meta.overall;
    return o ? { done: Math.min(o.pct, req.target), total: req.target, actual: o.pct } : null;
  }
  return null;
}

/* 승급시험 상태.
 *   unmeasured  아직 응시 기록이 없다(실력 확인 전)
 *   failed      응시했지만 기준 미달(최고 점수 있음)
 *   passed      통과 */
function examOf(rule, progress) {
  const ex = rule.exam;
  const pass = ex.pass ?? PASS_RATIO;
  let best = null; let tries = 0; let last = null; let at = 0;
  if (ex.source === 'n3') {
    const t = progress?.n3?.tests?.[ex.testId];
    if (t && t.total > 0) { best = Number.isFinite(t.best) ? t.best : (t.right / t.total); tries = t.tries || 1; last = Number.isFinite(t.last) ? t.last : best; at = t.at || 0; }
  } else {
    const t = progress?.regions?.[rule.id]?.exam;
    if (t && t.total > 0) { best = t.best; tries = t.tries || 1; last = t.last; at = t.at || 0; }
  }
  const state = best == null ? 'unmeasured' : best >= pass ? 'passed' : 'failed';
  return { ...ex, pass, best, last, tries, at, state };
}

/* 한 지역의 달성 상태 */
export function evaluateRegion(rule, ctx) {
  const reqs = rule.reqs.map((req) => {
    const m = measure(req, ctx);
    return { ...req, measured: m !== null, done: m?.done ?? 0, total: m?.total ?? req.target ?? 0, seen: m?.seen, ok: Boolean(m) && m.done >= m.total, poolSize: m?.poolSize };
  });
  const loading = reqs.some((r) => !r.measured);
  const reqsDone = reqs.filter((r) => r.ok).length;
  const allReqs = !loading && reqsDone === reqs.length;
  const exam = examOf(rule, ctx.progress);
  /* 지역 클리어 = 필수 수련 완료 + 승급시험 통과. 시험을 먼저 본 기록도 인정한다(이미 충족한 것을 다시 시키지 않는다) */
  const cleared = allReqs && exam.state === 'passed';
  /* 응시 조건: 필수 수련을 다 채운 뒤. 이미 통과한 시험은 다시 볼 수 있다 */
  const examOpen = allReqs || exam.state === 'passed';
  const next = reqs.find((r) => r.measured && !r.ok) || null;
  return {
    id: rule.id, level: rule.level, goal: rule.goal, reqs, reqsDone, reqsTotal: reqs.length, loading,
    exam, examOpen, cleared,
    phase: loading ? 'loading' : cleared ? 'cleared' : allReqs ? (exam.state === 'failed' ? 'retry' : 'exam') : 'train',
    next,
  };
}

export function evaluateRegions(ctx) {
  return REGION_RULES.map((rule) => evaluateRegion(rule, ctx));
}

/* 다음에 추천하는 지역의 순서 — 아직 클리어 안 한 첫 지역. 다 했으면 null */
export function recommendedRegion(states) {
  const i = states.findIndex((s) => !s.cleared);
  return i < 0 ? null : i;
}

/* 남은 수련 한 줄 — 단위를 항목마다 따로 적는다(서로 다른 단위를 합치지 않는다) */
export function leftText(state) {
  return state.reqs.filter((r) => r.measured && !r.ok).map((r) => `${r.label} ${r.total - r.done}${r.unit} 더`).join(' · ');
}

/* 지역 확인 퀴즈를 낼 낱말 id — 본 낱말(확인 전 포함) 중에서. 모자라면 있는 만큼(10개 미만이면 응시 불가) */
export const REGION_QUIZ_MIN = 10;
export function regionQuizIds(rule, words = [], review = {}, rng = Math.random) {
  const ex = rule.exam;
  const pool = levelWords(words, ex.level).filter((w) => seenWord(review[w.id])).map((w) => w.id);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, ex.count);
}

/* 지역 확인 퀴즈 결과를 적는다. 같은 응시를 두 번 적지 않게 key(응시 시각)를 같이 본다. */
export function noteRegionExam(regions = {}, id, { right, total }, at = Date.now(), today = todayKey()) {
  if (!id || !(total > 0)) return regions;
  const cur = regions?.[id]?.exam;
  if (cur && cur.at === at) return regions;
  const ratio = right / total;
  const exam = {
    best: Math.max(cur?.best ?? 0, ratio), last: ratio, right, total,
    tries: (cur?.tries || 0) + 1, at, day: today,
  };
  return { ...(regions || {}), [id]: { ...(regions?.[id] || {}), exam } };
}

/* 두 기기 합치기 — 최고 점수와 응시 횟수는 큰 쪽(더하면 합칠 때마다 불어난다), 마지막 결과는 나중 것 */
export function mergeRegions(a = {}, b = {}) {
  a = a || {}; b = b || {};
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id]?.exam; const y = b[id]?.exam;
    if (!x || !y) { out[id] = a[id] || b[id]; continue; }
    const latest = (x.at || 0) >= (y.at || 0) ? x : y;
    out[id] = { ...(a[id] || {}), ...(b[id] || {}), exam: { ...latest, best: Math.max(x.best || 0, y.best || 0), tries: Math.max(x.tries || 0, y.tries || 0) } };
  }
  return out;
}
