/* N3 코스 진도의 모양과 합치기 — 자료(문법·한자·독해…)를 안 불러오는 얇은 조각.
 *
 * merge.js가 동기화 때 여기를 부른다. lib/n3.js 통째로 불러오면 코스 자료가
 * 메인 번들에 딸려 들어와 앱을 켤 때마다 받게 된다 — 규칙과 자료는 n3.js에,
 * 모양과 합치기만 여기 둔다. */
export const N3_VERSION = 1;

export function emptyN3() {
  return { v: N3_VERSION, lessons: {}, skip: {}, days: {}, q: {}, wrong: {}, tests: {}, exams: [] };
}

export function normalizeN3(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  return {
    v: N3_VERSION,
    lessons: obj(s.lessons),   // { 레슨id: { done, at, score, tries } }
    skip: obj(s.skip),         // { 레슨id: true } — 진단으로 건너뜀
    days: obj(s.days),         // { YYYY-MM-DD: { steps: [...], built, answered, right, at } }
    q: obj(s.q),               // { 문제id: { r, w } } — 문제별 정답률
    wrong: obj(s.wrong),       // { 문제id: { c, at, cat, ref, ok } } — 오답 노트
    tests: obj(s.tests),       // { 테스트id: { best, last, tries, right, total, at } }
    exams: Array.isArray(s.exams) ? s.exams.slice(-20) : [],
  };
}

/* 기기 두 대. 레슨 완료는 OR, 정답률·시험은 큰 쪽, 오답 노트는 나중 쪽.
   더하지 않는다 — 같은 기기에서 동기화를 두 번 눌러도 숫자가 안 불어나야 한다. */
export function mergeN3(a, b) {
  const x = normalizeN3(a); const y = normalizeN3(b);
  const lessons = {};
  for (const id of new Set([...Object.keys(x.lessons), ...Object.keys(y.lessons)])) {
    const l = x.lessons[id]; const r = y.lessons[id];
    if (!l) { lessons[id] = r; continue; } if (!r) { lessons[id] = l; continue; }
    lessons[id] = { done: Boolean(l.done || r.done), at: Math.max(l.at || 0, r.at || 0), score: Math.max(l.score ?? 0, r.score ?? 0), tries: Math.max(l.tries || 0, r.tries || 0) };
  }
  const skip = { ...y.skip, ...x.skip };
  const days = {};
  for (const d of new Set([...Object.keys(x.days), ...Object.keys(y.days)])) {
    const l = x.days[d]; const r = y.days[d];
    if (!l) { days[d] = r; continue; } if (!r) { days[d] = l; continue; }
    const ld = (l.steps || []).filter((s) => s.done).length; const rd = (r.steps || []).filter((s) => s.done).length;
    const base = rd > ld ? r : l;
    days[d] = { ...base, answered: Math.max(l.answered || 0, r.answered || 0), right: Math.max(l.right || 0, r.right || 0), at: Math.max(l.at || 0, r.at || 0) };
  }
  const q = {};
  for (const id of new Set([...Object.keys(x.q), ...Object.keys(y.q)])) {
    q[id] = { r: Math.max(x.q[id]?.r || 0, y.q[id]?.r || 0), w: Math.max(x.q[id]?.w || 0, y.q[id]?.w || 0) };
  }
  const wrong = {};
  for (const id of new Set([...Object.keys(x.wrong), ...Object.keys(y.wrong)])) {
    const l = x.wrong[id]; const r = y.wrong[id];
    if (!l) { wrong[id] = r; continue; } if (!r) { wrong[id] = l; continue; }
    /* 같은 시각이면 더 많이 틀린 쪽 — 순서를 바꿔도 같은 답이 나와야 한다 */
    const later = (l.at || 0) !== (r.at || 0) ? ((l.at || 0) > (r.at || 0) ? l : r) : ((l.c || 0) >= (r.c || 0) ? l : r);
    wrong[id] = { ...later, c: Math.max(l.c || 0, r.c || 0), ok: Math.max(l.ok || 0, r.ok || 0) };
  }
  const tests = {};
  for (const id of new Set([...Object.keys(x.tests), ...Object.keys(y.tests)])) {
    const l = x.tests[id]; const r = y.tests[id];
    if (!l) { tests[id] = r; continue; } if (!r) { tests[id] = l; continue; }
    const later = (l.at || 0) !== (r.at || 0) ? ((l.at || 0) > (r.at || 0) ? l : r) : ((l.last || 0) >= (r.last || 0) ? l : r);
    tests[id] = { ...later, best: Math.max(l.best || 0, r.best || 0), tries: Math.max(l.tries || 0, r.tries || 0) };
  }
  const seen = new Set(); const exams = [];
  for (const e of [...x.exams, ...y.exams].sort((p1, p2) => (p1.at || 0) - (p2.at || 0))) {
    const k = String(e.at || '');
    if (seen.has(k)) continue; seen.add(k); exams.push(e);
  }
  return { v: N3_VERSION, lessons, skip, days, q, wrong, tests, exams: exams.slice(-20) };
}
