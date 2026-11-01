import { callClaude, callGemini, PROVIDERS, resolveProvider } from './aiClient.js';

/* 내 문장 첨삭 — 내가 만든 일본어 문장을 AI가 고쳐 준다.
 *
 * 부르는 자리는 aiClient.js 하나다(키는 설정에 넣은 내 키, 기기 밖으로 안 나간다). 여기는 무엇을
 * 물을지(프롬프트)와 답을 읽는 일만 한다 — ask.js와 같은 짜임새다.
 *
 * ★ 프롬프트가 제일 힘주는 곳 ★
 * 틀린 일본어를 자신 있게 가르치는 것이 제일 나쁘다. 그래서 「확실하지 않으면 그렇게 말하라」가
 * 먼저고, 이미 자연스러운 문장은 건드리지 않는다. 그리고 교과서 일본어가 아니라 일본인이 실제
 * 회화에서 쓰는 자연스러운 표현을 우선한다 — 학습자는 한국인 초급자다. */

export const MAX_SENTENCE_CHARS = 120;

export const SYSTEM = `당신은 한국인 초급자를 가르치는 일본어 선생님입니다.
학습자가 만든 일본어 문장을 보고 고쳐 줍니다.

지키세요.
- 한국어로 설명합니다. 짧게. reason은 세 문장을 넘기지 마세요.
- 이미 자연스러운 문장은 고치지 마세요. 억지로 다른 표현을 만들지 마세요.
- 일본인이 실제 회화에서 자주 쓰는 자연스러운 표현을 우선하세요. 교과서에만 나오는 딱딱한 말은 피합니다.
- 확실하지 않으면 확실하지 않다고 적으세요. 틀린 일본어를 자신 있게 가르치는 것이 제일 나쁩니다.
- 인사말·격려·"잘 썼어요" 같은 말은 빼고 바로 본론만.
- 일본어와 관계없는 입력이면 verdict를 "wrong"으로 하고 reason에 한 줄로 그렇게 적으세요.

verdict는 셋 중 하나입니다.
- "good": 문법도 표현도 자연스럽다
- "okay": 뜻은 통하지만 조금 어색하거나 더 자연스러운 말이 있다
- "wrong": 문법이 틀렸거나 뜻이 달라진다

natural에는 더 자연스러운 말이나 회화체를 0~2개만 담습니다(good이면 비워도 됩니다).
kana는 문장 전체의 읽는 법(히라가나)입니다. 한자마다 쪼개지 마세요.

아래 JSON 하나만 출력하세요. 마크다운 펜스나 다른 텍스트를 붙이지 마세요.
{
  "verdict": "okay",
  "corrected": "駅まで歩いて行きました。",
  "kana": "えきまであるいていきました。",
  "reason": "「歩く」는 「歩いて」로 이어야 해요. 「駅に」보다 「駅まで」가 가는 범위를 나타내서 자연스러워요.",
  "natural": [
    { "jp": "駅まで歩いて行ったよ。", "kana": "えきまであるいていったよ。", "ko": "역까지 걸어갔어.", "note": "친구에게 하는 말" }
  ]
}`;

export function userText({ ko, mine, expected } = {}) {
  const lines = [];
  if (ko) lines.push(`[만들려던 뜻] ${String(ko).trim()}`);
  lines.push(`[학습자가 쓴 문장] ${String(mine || '').trim()}`);
  if (expected) lines.push(`[참고용 정답 한 가지] ${String(expected).trim()} (다른 말로 써도 맞을 수 있습니다)`);
  return lines.join('\n');
}

/* 모델이 펜스를 붙이거나 앞뒤에 말을 얹는 경우가 있다 — 번역기·질문에서 겪은 그대로다. */
export function parseCorrection(text) {
  if (!text) throw new Error('빈 응답');
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { data = JSON.parse(trimmed.slice(start, end + 1)); } catch { /* 아래에서 */ }
    }
    if (!data) throw new Error('답을 읽지 못했어요');
  }
  return shapeCorrection(data);
}

/* 모양을 여기서 고정한다. 빠진 칸이 있으면 화면이 매번 확인해야 하고, 한 군데라도 빠뜨리면
   흰 화면이 된다. 모르는 verdict는 「okay」로 — 틀렸다고도 맞다고도 단정하지 않는다. */
export function shapeCorrection(data = {}) {
  const verdict = ['good', 'okay', 'wrong'].includes(data.verdict) ? data.verdict : 'okay';
  const seen = new Set();
  const natural = (Array.isArray(data.natural) ? data.natural : [])
    .filter((n) => n && n.jp && !seen.has(n.jp) && seen.add(n.jp))
    .slice(0, 2)
    .map((n) => ({ jp: String(n.jp), kana: String(n.kana || n.jp), ko: String(n.ko || ''), note: String(n.note || '') }));
  return {
    verdict,
    corrected: String(data.corrected || '').trim(),
    kana: String(data.kana || '').trim(),
    reason: String(data.reason || '').trim(),
    natural,
  };
}

export const hasAiKey = (settings = {}) => Boolean(resolveProvider(settings).apiKey);

export async function correctSentence({ ko, mine, expected }, settings = {}) {
  const text = String(mine || '').trim();
  if (!text) throw new Error('문장을 먼저 써 주세요');
  if (text.length > MAX_SENTENCE_CHARS) throw new Error(`문장이 너무 길어요 (${MAX_SENTENCE_CHARS}자까지)`);
  const { provider, apiKey, model } = resolveProvider(settings);
  if (!apiKey) throw new Error('내 학습 → 설정에서 AI 키를 넣어 주세요');
  const args = { apiKey, model, system: SYSTEM, user: userText({ ko, mine: text, expected }) };
  const raw = provider === PROVIDERS.CLAUDE
    ? await callClaude({ ...args, maxTokens: 1500 })
    : await callGemini({ ...args, maxTokens: 8192 });
  const shaped = parseCorrection(raw);
  if (!shaped.reason && !shaped.corrected) throw new Error('답이 비어서 왔어요. 다시 해 봐 주세요');
  return shaped;
}
