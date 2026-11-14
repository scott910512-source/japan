/* 이야기 연속 듣기 — 긴 글(영상 스크립트 같은 것)을 처음부터 끝까지 이어서 듣는다.
 *
 * ★ 글은 앱에 담아 두지 않는다 ★
 * 스크립트는 남의 저작물이다. 저장소에 넣으면 누구에게나 공개된다(영상 자막을 안 담는 것과 같은 이유 —
 * data/videos.js). 사용자가 파일로 불러온 것만 그 사람의 기기와 계정에 남긴다.
 * 계정에는 영상 묶음(videos 칸)에 실려 올라간다 — 본인만 읽는 줄이라(RLS) 다른 사람에게는 안 보이고,
 * 한 기기에서 한 번 불러오면 로그인한 다른 기기에도 뜬다. 지운 것은 지운 시각을 남겨 되살아나지 않게 한다.
 * 어디까지 들었는지(자리)와 듣기 설정은 기기마다 따로 둔다.
 *
 * 불러오는 파일은 두 가지다.
 *   .json  — { format: 'jp-hunter-stories', stories: [...] }. 문장마다 해석(ko)이 붙어 있을 수 있다.
 *   .txt   — 글 그대로. 위에 「제목: · 채널: · URL:」 줄과 ==== 줄이 있으면 읽고, 【…】 줄은 구간 이름으로 쓴다.
 *            해석은 없다 — 여기서 지어내지 않는다. */

import { CLOUD_VOICES } from './voices.js';

export const STORY_FORMAT = 'jp-hunter-stories';
const LIST_KEY = 'jp_manabu_stories_v1';
const REMOVED_KEY = 'jp_manabu_story_removed_v1';
const POS_KEY = 'jp_manabu_story_pos_v1';
const PREF_KEY = 'jp_story_prefs_v1';
export const STORY_LIMIT = 40;                  // 이야기 수
export const STORY_CHAR_LIMIT = 400000;         // 전체 글자 수(일본어 + 해석) — 기기 저장 공간을 다 쓰지 않게

/* ── 듣기 설정 ── */
export const STORY_RATES = [
  { v: 0.6, label: '아주 천천히' },
  { v: 0.75, label: '천천히' },
  { v: 0.9, label: '조금 천천히' },
  { v: 1, label: '보통' },
];
export const STORY_REPEATS = [1, 2, 3];
export const STORY_KO = { OFF: 'off', TEXT: 'text', VOICE: 'voice' };
/* 글자 크기 — 듣는 화면은 화면을 통째로 쓰고 글을 크게 보여 준다 */
export const STORY_SIZES = [
  { v: 'm', label: '보통' },
  { v: 'l', label: '크게' },
  { v: 'xl', label: '아주 크게' },
];
/* 이야기를 읽을 목소리 — 비우면 설정 → 음성에서 고른 목소리다. 긴 글은 회화형이 덜 딱딱해서 여기서 따로 고를 수 있게 둔다
   (낱말 카드는 또박또박한 낭독형으로 두고 이야기만 회화형으로 들을 수 있다) */
export const STORY_VOICES = [{ v: '', label: '설정과 같게' }, ...CLOUD_VOICES.filter((x) => x.talk).map((x) => ({ v: x.id, label: x.trait ? `${x.label} · ${x.trait}` : x.label }))];
export const DEFAULT_STORY_PREFS = { rate: 0.75, repeat: 1, ko: STORY_KO.TEXT, loop: false, size: 'l', voice: '' };

export function cleanStoryPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    rate: STORY_RATES.some((r) => r.v === p.rate) ? p.rate : DEFAULT_STORY_PREFS.rate,
    repeat: STORY_REPEATS.includes(p.repeat) ? p.repeat : DEFAULT_STORY_PREFS.repeat,
    ko: Object.values(STORY_KO).includes(p.ko) ? p.ko : DEFAULT_STORY_PREFS.ko,
    loop: p.loop === true,
    size: STORY_SIZES.some((x) => x.v === p.size) ? p.size : DEFAULT_STORY_PREFS.size,
    voice: STORY_VOICES.some((x) => x.v === p.voice) ? p.voice : DEFAULT_STORY_PREFS.voice,
  };
}

/* ── 글을 문장으로 ── */
const END = /[^。！？!?]+[。！？!?]+[」』）)]*|[^。！？!?]+$/g;
export function splitSentences(paragraph) {
  return (String(paragraph || '').match(END) || []).map((s) => s.trim()).filter(Boolean);
}

const text = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const HTTP = /^https?:\/\/[^\s]+$/i;

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* 한 이야기를 앱이 쓰는 모양으로. 모양이 틀린 것은 버린다(문장이 하나도 없으면 null) */
export function cleanStory(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  const sections = [];
  for (const sec of Array.isArray(raw.sections) ? raw.sections : []) {
    const paras = [];
    for (const para of Array.isArray(sec?.paras) ? sec.paras : []) {
      const lines = [];
      for (const line of Array.isArray(para) ? para : []) {
        const jp = text(typeof line === 'string' ? line : line?.jp, 600);
        if (!jp) continue;
        const ko = text(typeof line === 'string' ? '' : line?.ko, 900);
        lines.push(ko ? { jp, ko } : { jp });
      }
      if (lines.length) paras.push(lines);
    }
    if (paras.length) sections.push({ title: text(sec?.title, 120), titleKo: text(sec?.titleKo, 160), paras });
  }
  if (!sections.length) return null;
  const first = sections[0].paras[0][0].jp;
  const title = text(raw.title, 120) || text(raw.titleOrig, 120) || first.slice(0, 24);
  const url = text(raw.url, 300);
  return {
    id: text(raw.id, 80) || `s-${hash(`${title}|${first}`)}`,
    title,
    titleOrig: text(raw.titleOrig, 200),
    level: text(raw.level, 20),
    source: text(raw.source, 120),
    url: HTTP.test(url) ? url : '',
    addedAt: Number(raw.addedAt) > 0 ? Number(raw.addedAt) : now,
    ...(Number(raw.updatedAt) > 0 ? { updatedAt: Number(raw.updatedAt) } : {}),   // 같은 이야기를 새 파일로 바꾼 시각
    sections,
  };
}

/* 글 파일(.txt) 하나 → 이야기. 파일 이름은 제목이 없을 때만 쓴다 */
export function parseStoryText(raw, fileName = '', now = Date.now()) {
  const all = String(raw || '').replace(/\r/g, '');
  const cut = all.search(/^={8,}\s*$/m);
  const head = cut >= 0 ? all.slice(0, cut) : '';
  const body = cut >= 0 ? all.slice(cut).replace(/^=+\s*$/m, '') : all;
  const meta = {};
  for (const line of head.split('\n')) {
    const m = line.trim().match(/^(제목|채널|게시일|URL|title|channel|url)\s*[:：]\s*(.+)$/i);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }
  const sections = [];
  let cur = { title: '', paras: [] };
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = line.match(/^【(.+)】$/);
    if (h) {
      if (cur.paras.length) sections.push(cur);
      cur = { title: h[1].trim(), paras: [] };
      continue;
    }
    const lines = splitSentences(line);
    if (lines.length) cur.paras.push(lines);
  }
  if (cur.paras.length) sections.push(cur);
  const fullTitle = meta['제목'] || meta.title || '';
  const level = (fullTitle.match(/N[1-5](?:\s*-\s*N[1-5])?/i) || [''])[0].replace(/\s+/g, '').toUpperCase();
  /* 「[N5 - N4] 80-minute simple Japanese listening | 진짜 제목」 꼴이면 진짜 제목만 남긴다 */
  const parts = fullTitle.replace(/^\[[^\]]*\]\s*/, '').split('|').map((x) => x.trim()).filter(Boolean);
  const shortTitle = parts.filter((x) => !/\d+\s*-?\s*minute/i.test(x)).join(' · ') || parts[0] || '';
  const url = meta.url || '';
  const yt = url.match(/[?&]v=([\w-]{6,})/);
  return cleanStory({
    id: yt ? `yt-${yt[1]}` : '',
    title: shortTitle || String(fileName || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim(),
    titleOrig: fullTitle,
    level,
    source: meta['채널'] || meta.channel || '',
    url,
    sections,
  }, now);
}

/* 파일 하나(이름 · 내용) → 이야기 목록. 못 읽으면 빈 목록 */
export function storiesFromFile(name, content, now = Date.now()) {
  const body = String(content || '').replace(/^﻿/, '');
  if (/\.json$/i.test(name) || /^\s*[{[]/.test(body)) {
    try {
      const data = JSON.parse(body);
      const list = Array.isArray(data) ? data : (Array.isArray(data?.stories) ? data.stories : [data]);
      return list.map((s) => cleanStory(s, now)).filter(Boolean);
    } catch { return []; }
  }
  const one = parseStoryText(body, name, now);
  return one ? [one] : [];
}

/* ── 문장을 한 줄로 펴기 ── */
export function flatStory(story) {
  const out = [];
  (story?.sections || []).forEach((sec, s) => {
    sec.paras.forEach((para, p) => {
      para.forEach((line, i) => out.push({ jp: line.jp, ko: line.ko || '', sec: s, para: p, last: i === para.length - 1 }));
    });
  });
  return out;
}
export const storyHasKo = (story) => flatStory(story).some((l) => l.ko);
export function storyStats(story) {
  const flat = flatStory(story);
  const chars = flat.reduce((n, l) => n + [...l.jp].length, 0);
  return { sentences: flat.length, chars, hasKo: flat.some((l) => l.ko) };
}
/* 대강 몇 분 — 일본어는 보통 속도로 1분에 330자쯤. 속도 · 반복 · 해석 읽기를 넣어 어림한다 */
export function storyMinutes(story, prefs = DEFAULT_STORY_PREFS) {
  const { sentences, chars, hasKo } = storyStats(story);
  const p = cleanStoryPrefs(prefs);
  const jp = (chars / 330 / p.rate) * p.repeat + (sentences * p.repeat * 0.5) / 60;
  const ko = p.ko === STORY_KO.VOICE && hasKo ? chars / 330 : 0;
  return Math.max(1, Math.round(jp + ko));
}
/* 구간이 시작하는 문장 번호 */
export function sectionStarts(story) {
  const starts = []; let n = 0;
  for (const sec of story?.sections || []) {
    starts.push(n);
    for (const para of sec.paras) n += para.length;
  }
  return starts;
}

/* 다음에 읽을 자리. 끝이면 null(되풀이면 처음으로) */
export function nextStoryAt(at, total, loop = false) {
  if (at + 1 < total) return at + 1;
  return loop && total > 0 ? 0 : null;
}

/* ── 문장 속 낱말 풀이 ──
   문장을 누르면 해석과 함께, 앱의 낱말 사전에 있는 낱말을 찾아 뜻을 붙여 준다. 형태소를 가르는 것이 아니라 글자를 맞춰 보는
   것이라, 틀리게 붙이지 않는 쪽으로만 맞춘다 — 못 찾는 것은 괜찮지만 엉뚱한 뜻을 붙이면 그걸 외운다.
     · 한자가 든 두 글자 이상의 낱말은 그대로 들어 있을 때(仕事 · 天気)
     · 동사 · い형용사는 끝 글자를 뗀 줄기가 두 글자 이상이면 줄기로(食べ · 涼し)
     · 줄기가 한자 한 글자면(行く · 見る · 高い) 뒤에 올 수 있는 활용 글자가 붙고 앞이 한자가 아닐 때만(銀行에 行く를 붙이지 않게)
     · 한자 한 글자짜리 낱말(窓 · 空 · 秋)은 앞뒤가 모두 한자가 아닐 때만
   가나로만 된 낱말은 붙이지 않는다(조사 · 어미와 겹친다). */
const KANJI = /[\u3400-\u9fff々]/;
const GODAN = { く: 'かきくけこい', ぐ: 'がぎぐげごい', す: 'さしすせそ', つ: 'たちつてとっ', ぬ: 'なにぬねのん', ぶ: 'ばびぶべぼん', む: 'まみむめもん', る: 'らりるれろっ', う: 'わいうえおっ' };
const ICHIDAN = 'るてたまなよられず';
export function buildGlossIndex(words = []) {
  const whole = new Map();     // 그대로 맞추는 꼴 → 낱말
  const stems = new Map();     // 두 글자 이상 줄기 → 낱말
  const single = new Map();    // 한자 한 글자 줄기 → [{ next, word }]
  const alone = new Map();     // 한자 한 글자짜리 낱말 → 낱말
  for (const w of words) {
    const form = String(w?.kanji || '');
    if (!form || !KANJI.test(form) || !w.mean) continue;
    const mean = String(w.mean).split(';')[0].trim();
    const entry = { id: w.id, jp: form, kana: w.kana || '', mean };
    const inflects = w.type === 'verb' || w.type === 'adj-i';
    if (!inflects) {
      if ([...form].length >= 2) { if (!whole.has(form)) whole.set(form, entry); } else if (!alone.has(form)) alone.set(form, entry);
      continue;
    }
    /* 〜する 동사는 앞의 한자말로 찾는다(勉強しています → 勉強する). 같은 꼴의 명사가 있으면 명사가 먼저다 */
    if (form.endsWith('する') && [...form].length >= 4) {
      const noun = form.slice(0, -2);
      if (KANJI.test(noun) && !stems.has(noun)) stems.set(noun, entry);
      continue;
    }
    const chars = [...form]; const last = chars[chars.length - 1]; const stem = chars.slice(0, -1).join('');
    if (!stem || !KANJI.test(stem)) continue;
    if ([...stem].length >= 2) { if (!stems.has(stem)) stems.set(stem, entry); continue; }
    let next = '';
    if (w.type === 'adj-i') next = 'いくかけさ';
    else if (form === '来る') next = 'るてたまなよられい';
    else if (String(w.group) === '2') next = ICHIDAN;
    else if (String(w.group) === '1') next = (GODAN[last] || '') + (form === '行く' ? 'っ' : '');
    if (!next) continue;
    single.set(stem, [...(single.get(stem) || []), { next, word: entry }]);
  }
  return { whole, stems, single, alone, max: Math.max(2, ...[...whole.keys(), ...stems.keys()].map((k) => [...k].length)) };
}
/* 문장에서 찾은 낱말 — 나오는 차례대로, 많아야 max개. 긴 것을 먼저 맞춰 겹치지 않게 한다 */
export function glossSentence(sentence, index, max = 6) {
  const chars = [...String(sentence || '')];
  const out = []; const seen = new Set();
  if (!index) return out;
  for (let i = 0; i < chars.length && out.length < max; i += 1) {
    if (!KANJI.test(chars[i])) continue;
    let hit = null; let len = 0;
    for (let n = Math.min(index.max, chars.length - i); n >= 2 && !hit; n -= 1) {
      const piece = chars.slice(i, i + n).join('');
      hit = index.whole.get(piece) || index.stems.get(piece) || null;
      len = n;
    }
    if (!hit) {
      const prev = chars[i - 1] || ''; const nxt = chars[i + 1] || '';
      if (!KANJI.test(prev)) {
        const cand = (index.single.get(chars[i]) || []).find((c) => nxt && c.next.includes(nxt));
        if (cand) { hit = cand.word; len = 1; }
        else if (!KANJI.test(nxt) && index.alone.has(chars[i])) { hit = index.alone.get(chars[i]); len = 1; }
      }
    }
    if (!hit) continue;
    if (!seen.has(hit.id)) { seen.add(hit.id); out.push(hit); }
    i += len - 1;
  }
  return out;
}

/* ── 목록 합치기 · 빼기 ── */
const sizeOf = (list) => list.reduce((n, s) => n + flatStory(s).reduce((m, l) => m + l.jp.length + l.ko.length, 0), 0);

/* 불러온 것을 목록에 넣는다. 같은 id는 새 것으로 바꾼다(해석이 붙은 파일을 다시 불러오면 해석이 들어온다).
   돌려주는 것: { list, added, replaced, rejected } — 한도를 넘으면 넘는 것부터 안 받는다 */
export function addStories(list = [], incoming = [], now = Date.now()) {
  const out = [...list];
  let added = 0; let replaced = 0; let rejected = 0;
  for (const s of incoming) {
    const at = out.findIndex((x) => x.id === s.id);
    const next = at >= 0 ? out.map((x, i) => (i === at ? { ...s, addedAt: x.addedAt, updatedAt: now } : x)) : [...out, s];
    if (next.length > STORY_LIMIT || sizeOf(next) > STORY_CHAR_LIMIT) { rejected += 1; continue; }
    out.splice(0, out.length, ...next);
    if (at >= 0) replaced += 1; else added += 1;
  }
  return { list: out, added, replaced, rejected };
}
export const removeStory = (list = [], id) => list.filter((s) => s.id !== id);

/* ── 기기끼리 합치기 ──
   묶음은 { list, removed }. 같은 id는 나중에 넣거나 바꾼 쪽이 남고, 지운 시각이 그보다 늦으면 뺀다.
   다시 불러온 것은 넣은 시각이 지운 시각보다 늦으니 돌아온다. */
const stamp = (s) => Math.max(Number(s?.updatedAt) || 0, Number(s?.addedAt) || 0);
const TOMB_LIMIT = 200;
export function mergeStoryStore(local = {}, remote = {}, now = Date.now()) {
  const removed = {};
  for (const src of [remote?.removed, local?.removed]) {
    for (const [id, at] of Object.entries(src && typeof src === 'object' && !Array.isArray(src) ? src : {})) {
      const n = Number(at) || 0;
      if (n > (removed[id] || 0)) removed[id] = n;
    }
  }
  const byId = new Map();
  for (const src of [remote?.list, local?.list]) {
    for (const raw of Array.isArray(src) ? src : []) {
      const s = cleanStory(raw, now);
      if (!s) continue;
      const had = byId.get(s.id);
      if (!had || stamp(s) > stamp(had)) byId.set(s.id, s);
    }
  }
  const alive = [...byId.values()]
    .filter((s) => !(removed[s.id] >= stamp(s)))
    .sort((a, b) => a.addedAt - b.addedAt || a.id.localeCompare(b.id));
  const list = [];
  for (const s of alive) {                       // 한도는 먼저 넣은 것부터 채운다
    if (list.length >= STORY_LIMIT || sizeOf([...list, s]) > STORY_CHAR_LIMIT) continue;
    list.push(s);
  }
  const tombs = Object.entries(removed).sort((a, b) => b[1] - a[1]).slice(0, TOMB_LIMIT);
  return { list, removed: Object.fromEntries(tombs) };
}
/* 내용이 같은 묶음인가 — 같으면 화면 상태를 갈아 끼우지 않는다 */
export function sameStoryStore(a, b) {
  const sig = (st) => JSON.stringify([(st?.list || []).map((s) => [s.id, stamp(s), s.title]), Object.entries(st?.removed || {}).sort()]);
  return sig(a) === sig(b);
}

/* ── 기기에 남기기 ── */
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function loadStories(s = store()) {
  try {
    const raw = JSON.parse(s?.getItem(LIST_KEY) || '[]');
    return (Array.isArray(raw) ? raw : []).map((x) => cleanStory(x)).filter(Boolean);
  } catch { return []; }
}
/* 저장에 실패하면(공간 부족) false — 부른 쪽이 알린다 */
export function saveStories(list, s = store()) {
  try { s?.setItem(LIST_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export function loadStoryRemoved(s = store()) {
  try {
    const raw = JSON.parse(s?.getItem(REMOVED_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
export function saveStoryRemoved(removed, s = store()) {
  try { s?.setItem(REMOVED_KEY, JSON.stringify(removed || {})); } catch { /* 못 적으면 다음 동기화에 되살아날 수 있다 — 듣기는 된다 */ }
}
export function loadStoryPos(s = store()) {
  try {
    const raw = JSON.parse(s?.getItem(POS_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
export function saveStoryPos(pos, s = store()) {
  try { s?.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* 자리를 못 적어도 듣기는 된다 */ }
}
/* 이어 들을 자리 — 범위를 벗어난 값(글이 바뀌었다)은 처음으로 */
export function resumeAt(pos, id, total) {
  const at = Number(pos?.[id]);
  return Number.isInteger(at) && at > 0 && at < total ? at : 0;
}
export function loadStoryPrefs(s = store()) {
  try { return cleanStoryPrefs(JSON.parse(s?.getItem(PREF_KEY) || '{}')); } catch { return { ...DEFAULT_STORY_PREFS }; }
}
export function saveStoryPrefs(prefs, s = store()) {
  try { s?.setItem(PREF_KEY, JSON.stringify(cleanStoryPrefs(prefs))); } catch { /* 이번 판은 된다 */ }
}
