/* 이야기 연속 듣기 — 긴 글(영상 스크립트 같은 것)을 처음부터 끝까지 이어서 듣는다.
 *
 * ★ 글은 앱에 담아 두지 않는다 ★
 * 스크립트는 남의 저작물이다. 저장소에 넣으면 누구에게나 공개된다(영상 자막을 안 담는 것과 같은 이유 —
 * data/videos.js). 사용자가 자기 기기에서 파일로 불러온 것만 그 기기에 남긴다.
 * 학습 기록이 아니라서 초기화 · 백업 · 동기화가 건드리지 않는다(크기도 커서 올릴 때마다 실리면 안 된다).
 *
 * 불러오는 파일은 두 가지다.
 *   .json  — { format: 'jp-hunter-stories', stories: [...] }. 문장마다 해석(ko)이 붙어 있을 수 있다.
 *   .txt   — 글 그대로. 위에 「제목: · 채널: · URL:」 줄과 ==== 줄이 있으면 읽고, 【…】 줄은 구간 이름으로 쓴다.
 *            해석은 없다 — 여기서 지어내지 않는다. */

export const STORY_FORMAT = 'jp-hunter-stories';
const LIST_KEY = 'jp_manabu_stories_v1';
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
export const DEFAULT_STORY_PREFS = { rate: 0.75, repeat: 1, ko: STORY_KO.TEXT, loop: false };

export function cleanStoryPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    rate: STORY_RATES.some((r) => r.v === p.rate) ? p.rate : DEFAULT_STORY_PREFS.rate,
    repeat: STORY_REPEATS.includes(p.repeat) ? p.repeat : DEFAULT_STORY_PREFS.repeat,
    ko: Object.values(STORY_KO).includes(p.ko) ? p.ko : DEFAULT_STORY_PREFS.ko,
    loop: p.loop === true,
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

/* ── 목록 합치기 · 빼기 ── */
const sizeOf = (list) => list.reduce((n, s) => n + flatStory(s).reduce((m, l) => m + l.jp.length + l.ko.length, 0), 0);

/* 불러온 것을 목록에 넣는다. 같은 id는 새 것으로 바꾼다(해석이 붙은 파일을 다시 불러오면 해석이 들어온다).
   돌려주는 것: { list, added, replaced, rejected } — 한도를 넘으면 넘는 것부터 안 받는다 */
export function addStories(list = [], incoming = []) {
  const out = [...list];
  let added = 0; let replaced = 0; let rejected = 0;
  for (const s of incoming) {
    const at = out.findIndex((x) => x.id === s.id);
    const next = at >= 0 ? out.map((x, i) => (i === at ? { ...s, addedAt: x.addedAt } : x)) : [...out, s];
    if (next.length > STORY_LIMIT || sizeOf(next) > STORY_CHAR_LIMIT) { rejected += 1; continue; }
    out.splice(0, out.length, ...next);
    if (at >= 0) replaced += 1; else added += 1;
  }
  return { list: out, added, replaced, rejected };
}
export const removeStory = (list = [], id) => list.filter((s) => s.id !== id);

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
