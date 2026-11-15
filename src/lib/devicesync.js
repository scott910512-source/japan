/* 기기에만 두던 공부 기록을 계정에도 싣는다 — 오늘의 계획 · 이어하기 · 풀던 퀘스트 시험 · 이야기 듣던 자리 ·
 * 여행 · 독일어 코스 진도 · 곤에게 물어본 것 · 번역 기록.
 *
 * ★ 왜 ★
 *   컴퓨터에서 오늘 퀘스트를 반쯤 하고 폰을 열면 계획이 처음부터였고, 곤에게 물어본 답 · 번역해 둔 문장도 그 기기에만 있었다.
 *
 * ★ 어디에 ★
 *   영상 묶음(user_data.videos)에 extra 칸으로 싣는다. 이야기 글도 거기 실려 있다 — DB 칸을 새로 만들지 않아도 되고,
 *   계정 초기화 · 복원(replace / adopt) 규칙도 영상 묶음과 같이 따른다.
 *
 * ★ 어떻게 합치나 ★
 *   한 덩어리인 것(계획 · 이어하기 · 시험 자리 · 듣던 자리 · 코스 진도)은 나중에 바뀐 쪽을 통째로 쓴다.
 *   언제 바뀌었는지는 이 기기가 동기화할 때 알아낸다 — 지난번에 맞춘 글자(지문)와 지금 글자가 다르면 「지금 바뀌었다」.
 *   그래서 화면 코드는 하나도 안 고쳐도 된다. 처음 보는 빈 칸은 시각 0이라, 새 기기의 빈 칸이 계정 것을 지우지 않는다.
 *   목록(물어본 것 · 번역)은 두 기기 것을 합친다. 이 기기에서 지운 항목은 지운 시각을 남겨서 다른 기기에서 되살아나지 않게 한다.
 *
 * 이 파일은 저장소(localStorage)만 다룬다. 화면 상태는 applyExtra가 돌려준 이름을 보고 hook이 다시 읽는다. */

export const EXTRA_META_KEY = 'jp_manabu_extra_meta_v1';

/* 통째로 · 나중 것이 이긴다 */
export const EXTRA_WHOLE = {
  plan: 'jp_manabu_plan_v1',
  session: 'jp_manabu_session_v1',
  quizKeep: 'jp_quiz_keep_v1',
  storyPos: 'jp_manabu_story_pos_v1',
  travel: 'jp_manabu_travel_v1',
  swiss: 'jp_manabu_swiss_v1',
};
/* 목록 · 합친다 */
export const EXTRA_LISTS = {
  asks: { key: 'jp_manabu_asks_v1', id: 'key', keep: 40 },
  translations: { key: 'jp_manabu_translations_v1', id: 'id', keep: 50 },
};
const GONE_DAYS = 90;
const DAY = 86400000;

/* 짧은 지문 — 같은 글자인지만 보면 된다 */
export function fingerprint(text) {
  const s = String(text ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}:${h.toString(36)}`;
}

const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const readJson = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
function readMeta(storage) {
  const m = readJson(storage?.getItem(EXTRA_META_KEY), null);
  return { whole: { ...(m?.whole || {}) }, lists: { ...(m?.lists || {}) } };
}
function writeMeta(storage, meta) {
  try { storage?.setItem(EXTRA_META_KEY, JSON.stringify(meta)); } catch { /* 지문을 못 적으면 다음에 「바뀌었다」로 볼 뿐이다 */ }
}
const idOf = (item, field) => (item && typeof item === 'object' ? String(item[field] ?? '') : '');

/* 이 기기의 기록을 계정에 실을 묶음으로. 바뀐 칸에는 지금 시각을 찍는다 */
export function collectExtra(storage = store(), now = Date.now()) {
  if (!storage) return null;
  const meta = readMeta(storage);
  const whole = {};
  for (const [name, key] of Object.entries(EXTRA_WHOLE)) {
    const raw = storage.getItem(key);
    const fp = fingerprint(raw || '');
    const seen = meta.whole[name];
    let at;
    if (seen && seen.fp === fp) at = Number(seen.at) || 0;
    else if (!seen && !raw) at = 0;                 // 처음 보는 빈 칸 — 계정 것을 지우지 않는다
    else at = now;
    meta.whole[name] = { fp, at };
    whole[name] = { at, v: readJson(raw, null) };
  }
  const lists = {};
  for (const [name, spec] of Object.entries(EXTRA_LISTS)) {
    const items = readJson(storage.getItem(spec.key), []);
    const list = Array.isArray(items) ? items.filter((it) => idOf(it, spec.id)) : [];
    const ids = list.map((it) => idOf(it, spec.id));
    const before = meta.lists[name] || {};
    const gone = { ...(before.gone || {}) };
    const nowIds = new Set(ids);
    for (const id of before.ids || []) if (!nowIds.has(id)) gone[id] = now;     // 지난번엔 있었는데 없다 — 지웠다
    for (const id of Object.keys(gone)) if (now - gone[id] > GONE_DAYS * DAY) delete gone[id];
    meta.lists[name] = { ids, gone };
    lists[name] = { items: list, gone };
  }
  writeMeta(storage, meta);
  return { v: 1, whole, lists };
}

/* 두 묶음을 합친다(순수). 같은 시각이면 이 기기(local) 것 */
export function mergeExtra(local, remote) {
  if (!local && !remote) return undefined;
  if (!remote) return local;
  if (!local) return remote;
  const whole = {};
  for (const name of new Set([...Object.keys(local.whole || {}), ...Object.keys(remote.whole || {})])) {
    const l = local.whole?.[name]; const r = remote.whole?.[name];
    whole[name] = !r ? l : !l ? r : ((Number(r.at) || 0) > (Number(l.at) || 0) ? r : l);
  }
  const lists = {};
  for (const name of new Set([...Object.keys(local.lists || {}), ...Object.keys(remote.lists || {})])) {
    const spec = EXTRA_LISTS[name] || { id: 'id', keep: 50 };
    const l = local.lists?.[name] || {}; const r = remote.lists?.[name] || {};
    const gone = { ...(r.gone || {}) };
    for (const [id, t] of Object.entries(l.gone || {})) gone[id] = Math.max(gone[id] || 0, t);
    const byId = new Map();
    for (const it of [...(r.items || []), ...(l.items || [])]) {
      const id = idOf(it, spec.id);
      if (!id) continue;
      const had = byId.get(id);
      if (!had || (Number(it.at) || 0) >= (Number(had.at) || 0)) byId.set(id, it);
    }
    const items = [...byId.values()]
      .filter((it) => !(gone[idOf(it, spec.id)] >= (Number(it.at) || 0)))
      .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))
      .slice(0, spec.keep);
    lists[name] = { items, gone };
  }
  return { v: 1, whole, lists };
}

/* 합친 묶음을 이 기기에 얹는다. 바뀐 칸 이름을 돌려준다(화면 상태를 다시 읽을 것) */
export function applyExtra(merged, storage = store()) {
  const changed = [];
  if (!merged || !storage) return changed;
  const meta = readMeta(storage);
  for (const [name, key] of Object.entries(EXTRA_WHOLE)) {
    const got = merged.whole?.[name];
    if (!got) continue;
    const raw = got.v === null || got.v === undefined ? null : JSON.stringify(got.v);
    const cur = storage.getItem(key);
    /* 요청이 오가는 사이에 이 기기에서 또 바뀌었다 — 덮지 않는다. 다음 동기화가 「지금 바뀐 것」으로 올린다 */
    if (meta.whole[name] && fingerprint(cur || '') !== meta.whole[name].fp) continue;
    if ((cur || null) !== raw) {
      try {
        if (raw === null) storage.removeItem(key); else storage.setItem(key, raw);
        changed.push(name);
      } catch { /* 공간이 없으면 이 칸은 다음에 */ continue; }
    }
    meta.whole[name] = { fp: fingerprint(raw || ''), at: Number(got.at) || 0 };
  }
  for (const [name, spec] of Object.entries(EXTRA_LISTS)) {
    const got = merged.lists?.[name];
    if (!got) continue;
    const raw = JSON.stringify(got.items || []);
    const cur = storage.getItem(spec.key);
    const curIds = (Array.isArray(readJson(cur, [])) ? readJson(cur, []) : []).map((it) => idOf(it, spec.id)).filter(Boolean);
    if (meta.lists[name] && curIds.join('\n') !== (meta.lists[name].ids || []).join('\n')) continue;   // 그 사이에 더하거나 지웠다
    if ((cur || '[]') !== raw) {
      try { storage.setItem(spec.key, raw); changed.push(name); } catch { continue; }
    }
    meta.lists[name] = { ids: (got.items || []).map((it) => idOf(it, spec.id)), gone: got.gone || {} };
  }
  writeMeta(storage, meta);
  return changed;
}
