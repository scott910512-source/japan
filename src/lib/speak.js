/* 말하기 연습 — 문장을 보고(듣고) 스스로 말해 본 뒤 정답을 듣는다.
 *
 * ★ 마이크를 안 쓴다 ★
 *   듣기처럼 틀어 두면 저절로 흘러간다: 뜻 → 생각하고 말할 시간 → 정답(일본어) → 따라 말할 시간 → 다음 문장.
 *   말한 것을 채점하지 않는다 — 그래서 회독 기록(복습 간격)도 약점 장부도 건드리지 않는다. 활동 칸에만 적는다.
 *
 * ★ 문장은 두 군데서 온다 ★
 *   배운 문장   상황별 회화 중 이미 본 것(회독 기록이 있는 문장 카드)
 *   AI 문장     주제를 적으면 AI가 만들어 준 것. progress.speak에 저장하고 계정으로 동기화한다.
 *               한 번 만들 때마다 한 회차로 묶인다 — 회차를 골라 연습하거나 섞어서 연습한다
 *
 * 이 파일은 순수 함수와 AI 부르는 자리만 둔다. 화면은 screens/SpeakPractice.jsx. */
import { callClaude, callGemini, PROVIDERS, resolveProvider } from './aiClient.js';

export const SPEAK_DIR = { KO_JP: 'ko-jp', JP_KO: 'jp-ko' };
export const THINK_SECONDS = [3, 5, 8];
export const SPEAK_COUNTS = [10, 20, 30];
export const SPEAK_SOURCE = { MIX: 'mix', AI: 'ai', LEARNED: 'learned' };
export const MAX_SAVED = 300;        // 저장하는 AI 문장 상한 — 오래된 것부터 밀려난다
export const GEN_COUNT = 10;         // 한 번에 만드는 수
export const MAX_TOPIC_CHARS = 60;

const JP = /[぀-ヿ一-鿿]/;
const KANA_ONLY = /^[぀-ヿー・、。！？!?\s「」〜~…,.0-9０-９]+$/;
const HANGUL = /[가-힣]/;

/* 같은 문장인지 가릴 때 쓰는 모양 — 공백 · 문장부호를 뺀다 */
const keyOf = (jp) => String(jp || '').replace(/[\s、。！？!?「」,.…〜~]/g, '');

/* 짧은 안정 해시(id용). 같은 문장은 어느 기기에서 만들어도 같은 id가 된다 — 합칠 때 겹치지 않는다 */
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* AI가 준 한 줄을 쓸 수 있는 모양으로. 못 쓰면 null — 틀린 모양을 그대로 저장하지 않는다 */
export function shapeSentence(raw, { topic = '', level = '', at = Date.now(), batch = '' } = {}) {
  const jp = String(raw?.jp || '').trim();
  const ko = String(raw?.ko || '').trim();
  let kana = String(raw?.kana || '').trim();
  if (!jp || !ko || !JP.test(jp) || !HANGUL.test(ko)) return null;
  if (jp.length > 80 || ko.length > 120) return null;
  /* 읽기는 가나여야 한다. 한자가 섞여 왔으면 버리고 원문으로 읽게 둔다(틀린 읽기를 보여 주는 것보다 낫다) */
  if (kana && !KANA_ONLY.test(kana)) kana = '';
  const out = { id: `sp:${hash(keyOf(jp))}`, jp, kana, ko, topic: String(topic || '').slice(0, MAX_TOPIC_CHARS), level: String(level || ''), at };
  if (batch) out.batch = String(batch);      // 몇 번째로 만든 묶음인지(회차) — 한 번 만들 때 나온 문장은 같은 값
  return out;
}

/* 모델이 펜스를 붙이거나 앞뒤에 말을 얹는 경우가 있다 */
export function parseSentences(text, meta = {}) {
  if (!text) throw new Error('빈 응답');
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try { data = JSON.parse(trimmed); } catch {
    const m = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) throw new Error('답을 읽지 못했어요');
    data = JSON.parse(m[0]);
  }
  const list = Array.isArray(data) ? data : (Array.isArray(data?.sentences) ? data.sentences : []);
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = shapeSentence(raw, meta);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

/* ── 저장소: progress.speak = { items: { id: 문장 }, gone: { id: 지운 시각 } } ── */
export function emptySpeak() { return { items: {}, gone: {} }; }

export function normalizeSpeak(raw) {
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  return { items: obj(raw?.items), gone: obj(raw?.gone) };
}

export function savedSentences(store) {
  const s = normalizeSpeak(store);
  return Object.values(s.items).filter((x) => x && x.id && x.jp && !s.gone[x.id]).sort((a, b) => (b.at || 0) - (a.at || 0));
}

/* 새 문장을 더한다. 이미 있는 문장은 다시 넣지 않고, 상한을 넘으면 오래된 것부터 뺀다. { store, added } */
export function addSentences(store, list = [], max = MAX_SAVED) {
  const s = normalizeSpeak(store);
  const items = { ...s.items };
  const gone = { ...s.gone };
  let added = 0;
  for (const it of list) {
    if (!it?.id || !it.jp) continue;
    if (items[it.id] && !gone[it.id]) continue;
    items[it.id] = it;
    delete gone[it.id];       // 지웠던 문장을 다시 만들었으면 되살린다
    added += 1;
  }
  const alive = Object.values(items).filter((x) => !gone[x.id]).sort((a, b) => (b.at || 0) - (a.at || 0));
  for (const old of alive.slice(max)) delete items[old.id];
  return { store: added ? { items, gone } : store, added };
}

export function removeSentence(store, id, at = Date.now()) {
  const s = normalizeSpeak(store);
  if (!s.items[id]) return store;
  const items = { ...s.items };
  delete items[id];
  return { items, gone: { ...s.gone, [id]: at } };
}

/* 기기 두 대 — 문장은 합집합, 지운 것은 어느 쪽에서 지웠든 지운 것이다(지운 뒤에 다시 만든 것은 살린다) */
export function mergeSpeak(a, b) {
  const x = normalizeSpeak(a); const y = normalizeSpeak(b);
  const gone = { ...x.gone };
  for (const [id, at] of Object.entries(y.gone)) gone[id] = Math.max(gone[id] || 0, at || 0);
  const items = {};
  for (const it of [...Object.values(x.items), ...Object.values(y.items)]) {
    if (!it?.id) continue;
    if (gone[it.id] && (it.at || 0) <= gone[it.id]) continue;
    if (!items[it.id] || (it.at || 0) > (items[it.id].at || 0)) items[it.id] = it;
  }
  for (const id of Object.keys(gone)) if (items[id]) delete gone[id];
  return { items, gone };
}

/* ── 회차: 한 번 만들 때 나온 문장 묶음 ──
 *   새로 만든 문장은 batch 값이 같다. 회차 기능이 생기기 전에 만든 문장은 batch가 없어서,
 *   주제가 같고 만든 시각이 붙어 있는 것끼리 한 회차로 본다(한 번에 만든 문장은 시각이 몇 ms밖에 안 벌어진다).
 *   번호는 만든 순서다(1회차가 가장 오래된 것). */
const OLD_BATCH_GAP_MS = 2000;
export function speakBatches(saved = []) {
  const asc = [...saved].filter((x) => x?.id).sort((a, b) => (a.at || 0) - (b.at || 0));
  const byId = new Map();
  let open = null;
  for (const it of asc) {
    let id = it.batch;
    if (!id) {
      const topic = it.topic || '';
      if (open && open.topic === topic && (it.at || 0) - open.last <= OLD_BATCH_GAP_MS) { id = open.id; open.last = it.at || 0; }
      else { id = `old:${it.at || 0}:${hash(topic)}`; open = { id, topic, last: it.at || 0 }; }
    }
    if (!byId.has(id)) byId.set(id, { id, topic: it.topic || '', level: it.level || '', at: it.at || 0, items: [] });
    byId.get(id).items.push(it);
  }
  return [...byId.values()].sort((a, b) => a.at - b.at).map((g, i) => ({ ...g, no: i + 1 }));
}

/* 고른 회차만 남긴다. 아무것도 안 골랐거나 고른 회차가 이제 없으면 전부다(지운 회차 때문에 연습이 막히지 않게) */
export function pickBatches(batches = [], ids = []) {
  const want = new Set(Array.isArray(ids) ? ids : []);
  const hit = batches.filter((b) => want.has(b.id));
  return hit.length ? hit : batches;
}
export const batchSentences = (batches = []) => batches.flatMap((b) => b.items);
export const batchLabel = (b, max = 14) => {
  const topic = b?.topic || '일상 회화';
  return `${b?.no}회차 · ${topic.length > max ? `${topic.slice(0, max)}…` : topic}`;
};

/* ── 한 판에 낼 문장 ── */
const fromCard = (c) => ({ id: c.id, jp: c.kanji, kana: c.kana && c.kana !== c.kanji ? c.kana : '', ko: String(c.mean || '').split(';')[0].trim(), topic: c.place || '', learned: true });

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* 배운 문장 — 회독 기록이 있는 문장 카드 */
export function learnedSentences(sentenceCards = [], review = {}) {
  return sentenceCards.filter((c) => c?.kanji && c.mean && review?.[c.id]?.lastSeen).map(fromCard);
}

export function speakCounts({ saved = [], sentenceCards = [], review = {} } = {}) {
  const ai = saved.length; const learned = learnedSentences(sentenceCards, review).length;
  return { ai, learned, mix: ai + learned };
}

/* 한 판. 섞어서(mix)는 AI 문장과 배운 문장을 번갈아 고르게 넣는다 — 한쪽이 많다고 그쪽만 나오지 않게 */
export function buildSpeakQueue({ source = SPEAK_SOURCE.MIX, saved = [], sentenceCards = [], review = {}, count = 10, rng = Math.random } = {}) {
  const ai = shuffle(saved, rng);
  const learned = shuffle(learnedSentences(sentenceCards, review), rng);
  if (source === SPEAK_SOURCE.AI) return ai.slice(0, count);
  if (source === SPEAK_SOURCE.LEARNED) return learned.slice(0, count);
  const out = []; const seen = new Set();
  for (let i = 0; out.length < count && (i < ai.length || i < learned.length); i += 1) {
    for (const it of [ai[i], learned[i]]) {
      if (!it || out.length >= count) continue;
      const k = keyOf(it.jp);
      if (seen.has(k)) continue;
      seen.add(k); out.push(it);
    }
  }
  return out;
}

/* ── 한 문장이 흘러가는 걸음 ──
 *   뜻 → 일본어   prompt(뜻을 보고 듣는다) → think(말해 본다) → answer(정답을 듣는다) → repeat(따라 말한다)
 *   일본어 → 뜻   prompt(일본어를 듣는다) → think(따라 말한다) → answer(뜻을 확인하고 한 번 더 듣는다) → repeat(뜻을 알고 한 번 더 말한다)
 *   마지막 repeat(정답을 들은 뒤 한 번 더 말하기)는 설정에서 끌 수 있다 — again: false */
export function speakSteps(dir, { again = true } = {}) {
  const base = ['prompt', 'think', 'answer'];
  return again ? [...base, 'repeat'] : base;
}

/* 읽는 데 걸리는 시간 어림(ms). 끝났다는 신호가 안 오는 기기가 있어 글자 수로 상한을 둔다(듣기와 같은 규칙) */
export function speechMs(text, perChar = 130, base = 900, cap = 7000) {
  return Math.min(cap, base + String(text || '').length * perChar);
}

/* 걸음마다 머무는 시간(ms) — 화면과 검사가 같은 값을 본다 */
export function stepMs(step, item, { dir = SPEAK_DIR.KO_JP, think = 5 } = {}) {
  const jpMs = speechMs(item?.kana || item?.jp);
  const koMs = speechMs(item?.ko, 120, 600, 4000);
  if (dir === SPEAK_DIR.JP_KO) {
    if (step === 'prompt') return jpMs + 300;
    if (step === 'think' || step === 'repeat') return Math.max(think * 1000, jpMs + 500);   // 내가 말할 차례
    return jpMs + 1200;
  }
  if (step === 'prompt') return koMs + 200;
  if (step === 'think') return think * 1000;
  if (step === 'answer') return jpMs + 600;
  return jpMs + 1200;      // repeat — 따라 말할 시간
}

/* ── AI로 문장 만들기 ── */
export const SYSTEM = `당신은 한국인 학습자를 가르치는 일본어 회화 선생님입니다.
학습자가 소리 내어 말하는 연습에 쓸 일본어 문장을 만듭니다.

지키세요.
- 일본인이 실제로 말하는 자연스러운 회화 문장만 만듭니다. 교과서에만 나오는 어색한 문장은 만들지 마세요.
- 한 문장은 짧게(일본어 8~30자). 한 번에 말할 수 있는 길이여야 합니다.
- 요청한 수준(JLPT)에 맞는 단어와 문법을 씁니다. 수준을 넘는 표현은 피합니다.
- 문장마다 장면과 문형을 다르게 합니다. 묻는 말, 대답, 부탁, 감상, 제안을 섞으세요. 비슷한 문장을 반복하지 마세요.
- kana는 문장 전체의 읽는 법입니다. 히라가나(외래어는 가타카나)로만 적고 한자를 쓰지 마세요.
- ko는 자연스러운 한국어 번역입니다. 직역 투를 피하세요.
- 확실하지 않은 표현은 넣지 마세요. 틀린 일본어를 가르치는 것이 제일 나쁩니다.
- [이미 있는 문장]과 같은 문장은 만들지 마세요.

아래 JSON 하나만 출력하세요. 마크다운 펜스나 다른 텍스트를 붙이지 마세요.
{ "sentences": [ { "jp": "ここに座ってもいいですか。", "kana": "ここにすわってもいいですか。", "ko": "여기 앉아도 될까요?" } ] }`;

export function userText({ topic = '', level = 'N4', count = GEN_COUNT, avoid = [] } = {}) {
  const lines = [
    `[주제] ${String(topic || '').trim().slice(0, MAX_TOPIC_CHARS) || '일상 회화(주제 자유)'}`,
    `[수준] JLPT ${level}`,
    `[개수] ${count}`,
  ];
  if (avoid.length) lines.push(`[이미 있는 문장]\n${avoid.slice(0, 40).map((s) => `- ${s}`).join('\n')}`);
  return lines.join('\n');
}

export async function generateSentences({ topic = '', level = 'N4', count = GEN_COUNT, avoid = [] } = {}, settings = {}) {
  const { provider, apiKey, model } = resolveProvider(settings);
  if (!apiKey) throw new Error('설정에서 AI 키를 넣어 주세요');
  const args = { apiKey, model, system: SYSTEM, user: userText({ topic, level, count, avoid }) };
  const raw = provider === PROVIDERS.CLAUDE
    ? await callClaude({ ...args, maxTokens: 3000 })
    : await callGemini({ ...args, maxTokens: 16384 });
  const at = Date.now();
  const list = parseSentences(raw, { topic, level, at, batch: `b${at.toString(36)}` });   // 이번에 만든 문장은 한 회차
  if (!list.length) throw new Error('쓸 수 있는 문장이 오지 않았어요. 다시 해 봐 주세요');
  return list;
}
