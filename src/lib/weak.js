/* 약점 장부 — 「어느 게 약한지, 금방 잊어버리는지」.
 *
 * ★ 회독 기록이 못 답하는 두 가지 ★
 *
 * 약점은 여태 회독 기록(review.js)에서만 셌다. 몰라요·애매해요를 세 번
 * 넘게 받은 낱말이 약점이었다. 그 규칙 자체는 맞는데, 두 군데가 비어 있었다.
 *
 *   · 시험과 듣기는 회독에 아무것도 안 쓴다. 일부러 그렇게 뒀다 — 시험
 *     때문에 복습 간격이 흔들리면 시험을 마음 편히 못 본다. 그 판단은
 *     그대로 둘 만한데, 대가가 있었다. 시험에서 열 번 틀린 낱말이
 *     「약점 0」이었고, 쉰 번 들어도 아무 데도 안 남았다.
 *   · 잊어버리는 속도를 안 센다. 틀린 횟수가 같아도, 어제 외운 걸 오늘
 *     틀린 낱말과 한 달 전에 외운 걸 오늘 틀린 낱말은 다른 낱말이다.
 *     앞엣것이 시험장에서 터진다.
 *
 * 그래서 장부를 따로 둔다. 세는 곳과 일정을 정하는 곳을 갈라 놓는 것이
 * 이 파일의 전부다 — 여기는 복습 간격을 안 건드린다. 시험을 봐도 복습일이
 * 안 밀리고, 그러면서 시험 성적이 약점에 쌓인다.
 *
 * ★ 왜 review.js 안이 아닌가 ★
 *
 * review.js는 순수 회독 엔진이고, 복습일을 정하는 규칙이 거기 있다. 시험
 * 점수를 그 안에 넣으면 다음에 누군가 그 값으로 간격을 계산한다 — 안 하기로
 * 정한 일이 저절로 일어나는 자리를 만들지 않는다.
 *
 * 저장은 progress.weak에 둔다. 새 열쇠를 안 만들면 백업·동기화에 저절로
 * 실린다(mergeProgress → mergeWeak). */
import {
  VERDICT, daysBetween, isDoneEnough, isWeak, stateOf, todayKey, WEAK_THRESHOLD,
} from './review.js';

/* 장부 한 줄.
 *
 *   quizWrong   시험에서 틀린 횟수
 *   quizRight   시험에서 맞힌 횟수 — 회복한 것을 목록 위에 안 남겨 두려고 센다
 *   listen      자동듣기에서 들은 횟수
 *   forgot      외웠다가 다시 틀린 횟수
 *   fastDays    그중 제일 짧은 간격(일) — 「며칠 만에 잊었나」
 *   at          마지막으로 적힌 시각 */
export function emptyWeak() {
  return { quizWrong: 0, quizRight: 0, listen: 0, forgot: 0, fastDays: null, at: 0 };
}

export function weakEntry(ledger, id) {
  const raw = ledger?.[id];
  if (!raw || typeof raw !== 'object') return emptyWeak();
  const fd = Number.isFinite(raw.fastDays) ? Math.max(0, Math.round(raw.fastDays)) : null;
  return {
    quizWrong: num(raw.quizWrong),
    quizRight: num(raw.quizRight),
    listen: num(raw.listen),
    forgot: num(raw.forgot),
    fastDays: fd,
    at: num(raw.at),
  };
}

function num(v) {
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/* ── 적기 ──
 *
 * 한 번에 여러 줄을 받는다. 시험 한 판이 끝나면 스무 줄이 한꺼번에 들어오고,
 * 그때마다 저장을 부르면 스무 번 쓴다.
 *
 * 아무것도 안 바뀌면 받은 장부를 그대로 돌려준다 — 새 객체를 만들면 화면이
 * 다시 그려지고 저장이 한 번 돈다. 모르는 종류가 들어왔을 때 조용히 그렇게
 * 되는 게 제일 찾기 어려운 쪽이라, 여기서 막는다. */
export const WEAK_KIND = {
  QUIZ_WRONG: 'quiz-wrong',
  QUIZ_RIGHT: 'quiz-right',
  LISTEN: 'listen',
  FORGOT: 'forgot',
};

export function noteWeak(ledger = {}, notes = [], at = Date.now()) {
  if (!Array.isArray(notes) || !notes.length) return ledger;
  const out = { ...(ledger || {}) };
  let touched = false;

  for (const n of notes) {
    if (!n?.id) continue;
    const cur = weakEntry(out, n.id);
    const next = { ...cur, at };

    if (n.kind === WEAK_KIND.QUIZ_WRONG) next.quizWrong = cur.quizWrong + 1;
    else if (n.kind === WEAK_KIND.QUIZ_RIGHT) next.quizRight = cur.quizRight + 1;
    else if (n.kind === WEAK_KIND.LISTEN) next.listen = cur.listen + 1;
    else if (n.kind === WEAK_KIND.FORGOT) {
      next.forgot = cur.forgot + 1;
      /* 간격은 제일 짧은 것을 남긴다. 평균을 내면 한 번 금방 잊은 사실이
         오래 버틴 횟수에 묻힌다 — 제일 빨리 무너진 때가 그 낱말의 실력이다. */
      const d = Number.isFinite(n.days) ? Math.max(0, Math.round(n.days)) : null;
      if (d != null) next.fastDays = cur.fastDays == null ? d : Math.min(cur.fastDays, d);
    } else continue;

    out[n.id] = next;
    touched = true;
  }

  return touched ? out : ledger;
}

/* ★ 잊어버린 것인가 ★
 *
 * 몰라요·애매해요를 받았다고 다 잊은 게 아니다. 처음 보는 낱말에 몰라요는
 * 그냥 「아직 안 배웠다」다 — 그걸 잊어버림으로 세면 새 낱말을 배울 때마다
 * 장부가 부풀고, 정작 무너진 낱말이 그 사이에 묻힌다.
 *
 * 그래서 「날짜를 두고 한 번이라도 확인된 것」만 센다(level ≥ 1). 기억 단계는
 * 복습일에만, 하루에 한 칸만 오르니 level 1은 「다른 날 다시 만나서 맞혔다」는
 * 뜻이다. 그게 무너지는 건 잊어버린 것이다.
 *
 * 간격은 마지막으로 올라간 날(promotedOn)부터 센다. lastSeen을 쓰면 복습일
 * 전에 미리 연습한 날이 끼어들어 간격이 0일로 찍힌다 — 미리 연습한 것으로는
 * 기억 단계가 안 오르니, 확인받은 날이 기준이어야 한다.
 *
 * 애매해요도 센다. 「긴가민가하다」는 아직 안 무너진 것 같지만, 외운 낱말이
 * 긴가민가해진 것은 시험장에서 틀리는 쪽이다. 세게 세고 나중에 줄이는 편이
 * 못 보고 지나치는 것보다 낫다. */
export function relapseOf(prev, verdict, today = todayKey()) {
  if (verdict !== VERDICT.UNKNOWN && verdict !== VERDICT.VAGUE) return null;
  const st = prev && typeof prev === 'object' ? prev : null;
  if (!st?.lastSeen) return null;
  if ((st.level || 0) < 1 && !isDoneEnough(st)) return null;
  const from = st.promotedOn || st.lastSeen;
  return { days: Math.max(0, daysBetween(from, today)) };
}

/* 판정 꾸러미에서 잊어버림만 골라 장부 줄로. 부르는 쪽(App)이 회독 저장소를
   건드리기 전에 한 번 부른다 — 적용한 뒤에 부르면 level이 이미 0이라
   「외웠던 것」이라는 사실이 사라진다. */
export function relapseNotes(review, map, today = todayKey()) {
  const out = [];
  for (const [id, verdict] of Object.entries(map || {})) {
    const hit = relapseOf(stateOf(review, id), verdict, today);
    if (hit) out.push({ id, kind: WEAK_KIND.FORGOT, days: hit.days });
  }
  return out;
}

/* ── 점수 ──
 *
 * 「약점이다/아니다」로는 목록을 못 만든다. 205개 중 40개가 약점이면 그 40개를
 * 어느 순서로 볼지가 남는다. 제일 약한 것부터 봐야 시간이 모자랄 때 남는 게
 * 있다.
 *
 * 무게는 「시험장에서 터질 확률」순이다.
 *
 *   금방 잊어버림   5 + 5   어제 외운 게 오늘 무너진 것. 제일 위험하다
 *   잊어버림        5       날짜를 두고 확인된 게 무너졌다
 *   회독 몰라요     3       떠올리지 못했다
 *   시험 오답       3       떠올리지 못했다 — 회독 몰라요와 같은 일이다
 *   회독 애매해요   1       긴가민가
 *   많이 들음       0~3     쉰 번 들었는데 아직 약점인 낱말은 더 약하다
 *   시험 정답      -1씩     회복 중인 것을 위에 안 남겨 둔다 (아래로 못 내려감)
 *
 * 듣기를 점수에만 넣고 약점 판정에는 안 넣는다. 많이 들은 것은 약점의
 * 「정도」지 「여부」가 아니다 — 안 그러면 쉰 번 들은 멀쩡한 낱말이 약점
 * 목록에 올라온다. */
const W = { fast: 5, forgot: 5, unknown: 3, quizWrong: 3, vague: 1, quizRight: 1 };

export function weakScore(st, rec) {
  const s = st || {};
  const r = rec || emptyWeak();
  let score = 0;
  score += (s.wrongCount || 0) * W.unknown;
  score += (s.vagueCount || 0) * W.vague;
  score += r.quizWrong * W.quizWrong;
  score += r.forgot * W.forgot;
  if (r.fastDays != null && r.fastDays <= 3) score += W.fast;
  // 많이 들어도 아직 틀리는 낱말 — 귀로는 익었는데 떠올리지 못하는 쪽이다
  score += Math.min(3, Math.floor(r.listen / 5));
  // 맞히기 시작한 것은 조금씩 내려간다. 0 밑으로는 안 간다
  score = Math.max(0, score - r.quizRight * W.quizRight);
  return score;
}

/* 약점인가 — 틀린 적이 있어야 약점이다.
 *
 * 회독 쪽 기준(isWeak)을 그대로 품는다. 거기 걸리던 것이 여기서 빠지면
 * 같은 이름이 두 숫자를 갖게 된다 — 이 앱에서 한 번 겪은 일이라, 더하기만
 * 한다. 시험 오답과 잊어버림이 그 더하는 몫이다. */
export function errorSignals(st, rec) {
  const s = st || {};
  const r = rec || emptyWeak();
  return (s.wrongCount || 0) + (s.vagueCount || 0)
    + r.quizWrong
    + r.forgot * 2
    + (r.fastDays != null && r.fastDays <= 3 ? 1 : 0);
}

export function isWeakNow(st, rec, threshold = WEAK_THRESHOLD) {
  if (!st) return false;
  if (isDoneEnough(st)) return false;
  if (isWeak(st, threshold)) return true;
  return errorSignals(st, rec) >= threshold;
}

/* ── 사람 말 ──
 *
 * 숫자만 보여 주면 왜 약점인지 모른다. 「시험에서 세 번 틀렸어요」까지 적혀
 * 있어야 다음에 무엇을 할지가 정해진다 — 시험에서 틀리는 낱말과 듣기만
 * 쉰 번 한 낱말은 할 일이 다르다. */
export function weakReasons(st, rec) {
  const s = st || {};
  const r = rec || emptyWeak();
  const out = [];
  if (r.forgot > 0) out.push(`외웠다가 다시 틀림 ${r.forgot}번`);
  if (s.wrongCount > 0) out.push(`회독 몰라요 ${s.wrongCount}번`);
  if (r.quizWrong > 0) out.push(`시험 오답 ${r.quizWrong}번`);
  if (s.vagueCount > 0) out.push(`애매해요 ${s.vagueCount}번`);
  if (r.listen > 0) out.push(`${r.listen}번 들었어요`);
  if (r.quizRight > 0) out.push(`시험 정답 ${r.quizRight}번`);
  return out;
}

/* 잊어버리는 속도. null이면 아직 무너진 적이 없다는 뜻 —
   「안 잊어버린다」가 아니라 「확인된 적이 없다」라서 아무 말도 안 한다. */
export function forgetSpeed(rec) {
  const r = rec || emptyWeak();
  if (!r.forgot || r.fastDays == null) return null;
  if (r.fastDays <= 1) return '하루 만에 잊어요';
  if (r.fastDays <= 3) return '사흘 안에 잊어요';
  if (r.fastDays <= 7) return '한 주 안에 잊어요';
  if (r.fastDays <= 30) return '한 달 안에 잊어요';
  return '오래 뒤에 잊어요';
}

/* ── 목록 ──
 *
 * 제일 약한 것부터. 점수가 같으면 최근에 틀린 것이 먼저다 — 오늘 틀린 것이
 * 반년 전에 틀린 것보다 급하다. */
export function weakRank(ids = [], review = {}, ledger = {}, { threshold = WEAK_THRESHOLD } = {}) {
  return ids
    .map((id) => {
      const st = stateOf(review, id);
      const rec = weakEntry(ledger, id);
      return { id, st, rec, score: weakScore(st, rec) };
    })
    .filter(({ st, rec }) => isWeakNow(st, rec, threshold))
    .sort((a, b) => (b.score - a.score) || (b.rec.at - a.rec.at));
}

export function weakIds(ids = [], review = {}, ledger = {}, opts = {}) {
  return weakRank(ids, review, ledger, opts).map(({ id }) => id);
}

/* 장부 전체를 한 줄로 — 복습 탭이 「시험 오답 12 · 금방 잊는 것 3」을 적는다. */
export function weakSummary(ids = [], review = {}, ledger = {}, opts = {}) {
  const rank = weakRank(ids, review, ledger, opts);
  let quizWrong = 0; let forgot = 0; let fast = 0; let listen = 0;
  for (const { rec } of rank) {
    quizWrong += rec.quizWrong;
    forgot += rec.forgot;
    if (rec.forgot > 0 && rec.fastDays != null && rec.fastDays <= 3) fast += 1;
    listen += rec.listen;
  }
  return { total: rank.length, quizWrong, forgot, fast, listen, top: rank.slice(0, 5) };
}

/* ── 기기 합치기 ──
 *
 * 횟수는 큰 쪽을 쓴다. 더하면 같은 기기에서 동기화를 두 번 눌러도 숫자가
 * 두 배가 된다 — 활용 성적(mergeConj)에서 겪은 자리라 같은 방식으로 둔다.
 *
 * 간격만 작은 쪽을 쓴다. 제일 빨리 무너진 때가 그 낱말의 실력이고, 작은 쪽을
 * 고르는 것은 몇 번 합쳐도 같은 답이 나온다. */
export function mergeWeak(local = {}, remote = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    const a = weakEntry(local, id);
    const b = weakEntry(remote, id);
    const fd = [a.fastDays, b.fastDays].filter((v) => v != null);
    out[id] = {
      quizWrong: Math.max(a.quizWrong, b.quizWrong),
      quizRight: Math.max(a.quizRight, b.quizRight),
      listen: Math.max(a.listen, b.listen),
      forgot: Math.max(a.forgot, b.forgot),
      fastDays: fd.length ? Math.min(...fd) : null,
      at: Math.max(a.at, b.at),
    };
  }
  return out;
}
