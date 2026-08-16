/* 붙여넣은 자막을 학습할 수 있는 줄로 쪼갠다.
 *
 * 여기서 뜻을 지어내지 않는다. 사용자가 넣은 글자만 쓴다 — 없는 번역을 만들어
 * 붙이면 틀린 걸 외우게 된다. 뜻과 문법 설명은 따로(설명 만들기) 붙일 일이고,
 * 이 파일이 하는 일은 "몇 초에 무슨 말이 나오는가"를 정리하는 것뿐이다.
 *
 * 유튜브에서 복사한 자막은 대개 이런 모양들이다.
 *   [00:12] やっぱり外で食べる…      한 줄에 시간과 말
 *   0:12                            시간과 말이 두 줄로
 *   やっぱり外で食べる…
 *   00:01:12,340 --> 00:01:15,000   srt/vtt
 *   시간 없이 본문만
 */

const TIME_ONLY = /^\[?(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?\]?$/;
const LEAD_TIME = /^\[?\s*((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?\s*\]?\s*[-–—)\]]?\s*/;
const CUE_RANGE = /^\[?\s*((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?\s*-+>/;
const NOISE = /^(WEBVTT|Kind:|Language:|\d+)$/i;

export function toSeconds(stamp) {
  const parts = String(stamp).split(':').map((n) => parseInt(n, 10));
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export function formatTime(sec) {
  if (sec == null) return '';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}

/* 자막 한 덩어리 → [{ at, jp }].
 * at은 초(모르면 null), jp는 그 시각에 나오는 일본어 한 줄. */
export function parseScript(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [];
  let pending = null; // 시간만 나온 줄을 들고 있다가 다음 본문에 붙인다

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || NOISE.test(line)) continue;

    const cue = line.match(CUE_RANGE);
    if (cue) { pending = toSeconds(cue[1]); continue; }

    if (TIME_ONLY.test(line)) {
      pending = toSeconds(line.replace(/[[\]]/g, '').split(/[.,]/)[0]);
      continue;
    }

    const lead = line.match(LEAD_TIME);
    let at = pending;
    let body = line;
    if (lead) {
      at = toSeconds(lead[1]);
      body = line.slice(lead[0].length).trim();
    }
    pending = null;
    if (!body) continue;

    // 같은 시각에 이어지는 줄은 한 문장으로 합친다 — 자막은 화면 폭 때문에
    // 문장 가운데서 끊겨 있을 때가 많은데, 끊긴 조각으로는 따라 말할 수 없다.
    const prev = out[out.length - 1];
    if (prev && at == null && prev.at != null && !/[。？！?!」）)]$/.test(prev.jp)) {
      prev.jp = `${prev.jp}${body}`;
      continue;
    }
    out.push({ at: at ?? null, jp: body });
  }

  return out;
}

/* 줄마다 몇 초짜리인지 — 다음 줄이 시작할 때까지. 마지막 줄은 알 수 없으니
 * 넉넉히 잡는다(모자라면 문장이 중간에 끊긴다). */
export function withDurations(lines, tail = 6) {
  return lines.map((l, i) => {
    const next = lines.slice(i + 1).find((n) => n.at != null);
    const dur = l.at != null && next ? Math.max(1, next.at - l.at) : tail;
    return { ...l, dur };
  });
}

export function hasTimes(lines) {
  return lines.some((l) => l.at != null);
}

/* 자막의 분량. 시각 표기는 빼고 실제 말한 글자만 센다 — API에 실리는 것도,
 * 공부할 거리도 그쪽이다. */
export function scriptChars(text) {
  return parseScript(text).reduce((n, l) => n + l.jp.length, 0);
}

/* 설명을 만들 때 쓸 앞부분만 잘라 낸다.
 *
 * 길다고 좋은 자료가 나오지 않는다. 튜터는 단어 5~10개, 문법 1~3개만 뽑는데
 * 500문장을 통째로 주면 고를 거리만 늘고 결과는 오히려 흐려진다. 게다가 답이
 * 길어져 중간에 잘리기도 한다. API도 그만큼 더 쓴다.
 *
 * 줄 중간에서 자르지 않는다 — 끊긴 문장으로는 설명을 만들 수 없다. 첫 줄이
 * 한도보다 길어도 그 줄은 통째로 남긴다(빈손으로 보내는 것보다 낫다). */
export function clipScript(text, limit) {
  const all = parseScript(text);
  const kept = [];
  let chars = 0;
  for (const line of all) {
    if (kept.length && chars + line.jp.length > limit) break;
    kept.push(line);
    chars += line.jp.length;
  }
  return {
    text: kept.map((l) => (l.at != null ? `[${formatTime(l.at)}] ${l.jp}` : l.jp)).join('\n'),
    chars,
    lines: kept.length,
    total: all.length,
    clipped: kept.length < all.length,
  };
}
