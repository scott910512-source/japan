/* 클라우드 음성 사용량 집계.
 *
 * Google Cloud는 요청 수가 아니라 "합성한 글자 수"로 계산한다. 그런데 콘솔의
 * 측정항목 화면에는 요청 수만 나오고, 글자 수는 결제 보고서에 하루쯤 늦게 뜬다.
 * 그래서 앱이 보낸 글자를 직접 세어 둔다 — 콘솔에 들어가지 않아도 남은 무료분을 안다.
 *
 * 캐시로 다시 튼 소리는 서버에 안 가므로 세지 않는다. 그래야 청구서와 눈금이 맞는다. */

const KEY = 'jp_manabu_tts_usage_v1';   // { '2026-08': 12345 }
const KEEP_MONTHS = 6;

// 목소리 등급별 월 무료 한도(글자). 등급이 섞이면 각각 따로 계산되지만,
// 우리는 한 번에 한 목소리만 쓰므로 지금 고른 목소리 기준으로 보여준다.
export const FREE_LIMITS = {
  standard: 4_000_000,
  wavenet: 1_000_000,
  neural2: 1_000_000,
  studio: 100_000,
};

export function tierOfVoice(voice = '') {
  const v = String(voice).toLowerCase();
  if (v.includes('studio')) return 'studio';
  if (v.includes('neural')) return 'neural2';
  if (v.includes('wavenet')) return 'wavenet';
  return 'standard';
}

export function freeLimitOf(voice) {
  return FREE_LIMITS[tierOfVoice(voice)];
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// 오래된 달은 버린다 — 저장 공간이 학습 기록을 밀어내면 안 된다.
export function trimUsage(store = {}, keep = KEEP_MONTHS) {
  const months = Object.keys(store).sort().slice(-keep);
  const out = {};
  for (const m of months) out[m] = store[m];
  return out;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 무시 */ }
}

export function addChars(count, month = monthKey()) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return read();
  const store = read();
  const next = trimUsage({ ...store, [month]: (store[month] || 0) + n });
  write(next);
  return next;
}

export function usedThisMonth(month = monthKey()) {
  return read()[month] || 0;
}

export function usageHistory() {
  return read();
}

export function resetUsage() {
  write({});
}

/* 화면에 그대로 쓸 수 있는 요약. */
export function usageSummary(voice, month = monthKey()) {
  const used = usedThisMonth(month);
  const limit = freeLimitOf(voice);
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return {
    used,
    limit,
    tier: tierOfVoice(voice),
    percent: Math.round(pct * 10) / 10,
    left: Math.max(0, limit - used),
    over: used > limit,
  };
}

// 12345 → "1만 2,345". 큰 수는 만 단위로 끊어야 한눈에 들어온다.
export function formatChars(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v < 10000) return v.toLocaleString('ko-KR');
  const man = Math.floor(v / 10000);
  const rest = v % 10000;
  return rest ? `${man.toLocaleString('ko-KR')}만 ${String(rest).padStart(4, '0')}` : `${man.toLocaleString('ko-KR')}만`;
}
