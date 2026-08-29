/* 카드를 보다가 떠오른 걸 물어보는 자리.
 *
 * 「食べる가 나왔네. 그럼 食べている는 뭐지?」 — 공부하다 보면 카드에 없는 게
 * 궁금해진다. 지금까지는 앱을 나가서 찾아봐야 했고, 나갔다가 안 돌아온다.
 *
 * 답을 알려주는 도구가 아니다. 곁가지를 물어보는 도구다. 그래서 화면에서는
 * 카드를 뒤집은 뒤에만 열린다(예문 보기와 같은 규칙) — 「이거 뜻이 뭐야」로
 * 우회하는 길을 막아 두면 시험 점수가 실력을 재는 숫자로 남는다.
 *
 * 부르는 건 aiClient가 한다. 여기는 무엇을 물어볼지와, 받은 걸 어떤 모양으로
 * 넘길지만 정한다. */

import { PROVIDERS, callClaude, callGemini, resolveProvider } from './aiClient.js';

export const MAX_QUESTION_CHARS = 200;
export const MAX_ITEMS = 4;
export const KEEP_ASKS = 40;   // 최근 것만 남긴다. 학습 기록을 밀어내면 안 된다

/* 제일 나쁜 건 틀린 일본어를 자신 있게 가르치는 것이다. 그걸 그대로 외우면
 * 앱이 도움이 아니라 손해가 된다. 그래서 프롬프트가 제일 힘주는 곳은
 * 「모르면 모른다고 해라」다.
 *
 * 두 번째로 힘주는 곳은 길이다. 공부하다 잠깐 곁길로 새는 거라, 화면 세 번
 * 넘기는 글이 오면 안 읽고 닫는다. */
export const SYSTEM = `당신은 한국인 일본어 학습자를 돕는 선생님입니다.
학습자가 단어 카드를 공부하다가 떠오른 걸 물어봅니다.

지키세요.
- 한국어로 답합니다.
- 짧게. answer는 세 문장을 넘기지 마세요. 사전을 베끼지 말고, 물어본 것만 답합니다.
- 확실하지 않으면 확실하지 않다고 적으세요. 그럴듯하게 지어내지 마세요.
  틀린 일본어를 자신 있게 가르치는 것이 제일 나쁩니다.
- 학습자는 지금 공부 중입니다. 인사말·격려·"좋은 질문이에요" 같은 말은 빼고
  바로 답만 합니다.
- 일본어나 일본 생활과 관계없는 질문이면, answer에 한 줄로 그렇게 말하고
  items는 비웁니다.

items에는 답에 나온 일본어 표현만 담습니다. 0개여도 됩니다.
- 물어본 표현, 비교 대상, 예문 — 학습자가 눈으로 보고 소리로 들어야 하는 것만.
- 설명하려고 꺼낸 말을 전부 나열하지 마세요. 많아야 ${MAX_ITEMS}개입니다.
- kana는 그 표현 전체의 읽는 법입니다. 한자마다 쪼개지 마세요.

아래 JSON 하나만 출력하세요. 마크다운 펜스나 다른 텍스트를 붙이지 마세요.
{
  "answer": "食べている는 食べる의 진행형이에요. 「먹고 있다」처럼 지금 하는 중인 동작을 나타냅니다. 회화에서는 줄여서 食べてる라고도 해요.",
  "items": [
    { "jp": "食べている", "kana": "たべている", "ko": "먹고 있다", "note": "지금 먹는 중" },
    { "jp": "食べてる", "kana": "たべてる", "ko": "먹고 있어", "note": "회화에서 줄인 말" }
  ]
}`;

/* 무엇을 보고 물어보는지 같이 보낸다.
 *
 * 이게 없으면 「이거 언제 써?」 같은 말이 안 통한다. 카드를 보면서 묻는 건데
 * 카드를 안 보내면 학습자만 아는 걸 물어보는 셈이 된다. */
export function userText(question, card = {}) {
  const lines = [];
  if (card.kanji || card.kana) {
    lines.push(`[지금 보는 카드] ${card.kanji || card.kana}` +
      `${card.kana && card.kana !== card.kanji ? ` (${card.kana})` : ''}` +
      `${card.mean ? ` — ${card.mean}` : ''}` +
      `${card.level ? ` · ${card.level}` : ''}`);
    if (card.example) lines.push(`[카드 예문] ${card.example}${card.exampleKo ? ` / ${card.exampleKo}` : ''}`);
    lines.push('');
  }
  lines.push(`[질문] ${String(question).trim()}`);
  return lines.join('\n');
}

/* 모델이 펜스를 붙이거나 앞뒤에 말을 얹는 경우가 있다 — 번역기에서 겪은 그대로다. */
export function parseAsk(text) {
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
  return shapeAsk(data);
}

/* 모양을 여기서 고정한다. 빠진 칸이 있으면 화면에서 매번 확인해야 하고,
   한 군데라도 빠뜨리면 흰 화면이 된다. */
export function shapeAsk(data = {}) {
  const seen = new Set();
  const items = (Array.isArray(data.items) ? data.items : [])
    .filter((it) => it && it.jp && !seen.has(it.jp) && seen.add(it.jp))
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      jp: String(it.jp),
      kana: String(it.kana || it.jp),
      ko: String(it.ko || ''),
      note: String(it.note || ''),
    }));
  return { answer: String(data.answer || '').trim(), items };
}

/* 같은 걸 두 번 물어보면 요금만 두 번 나간다. 그리고 비행기 모드에서도
   아까 받은 건 다시 볼 수 있어야 한다 — 번역기와 같은 이유다. */
export function askKey(cardId, question) {
  return `${cardId || '-'}|${String(question).trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export function findAsk(history = [], cardId, question) {
  const key = askKey(cardId, question);
  return history.find((h) => h.key === key) || null;
}

export function rememberAsk(history = [], entry) {
  const rest = history.filter((h) => h.key !== entry.key);
  return [entry, ...rest].slice(0, KEEP_ASKS);
}

/* 물어본다. 어느 제공처든 같은 모양으로 돌려준다. */
export async function ask(question, card, settings = {}) {
  const q = String(question || '').trim();
  if (!q) throw new Error('궁금한 걸 적어 주세요');
  if (q.length > MAX_QUESTION_CHARS) {
    throw new Error(`질문이 너무 길어요 (${MAX_QUESTION_CHARS}자까지)`);
  }

  const { provider, apiKey, model } = resolveProvider(settings);
  if (!apiKey) throw new Error('더보기 → 설정에서 AI 키를 넣어 주세요');

  const args = { apiKey, model, system: SYSTEM, user: userText(q, card) };
  const text = provider === PROVIDERS.CLAUDE
    ? await callClaude({ ...args, maxTokens: 1200 })
    /* 답은 짧지만 Gemini 2.5는 생각하는 토큰도 이 한도에서 깎아 먹는다.
       빠듯하게 잡으면 생각하다 한도를 다 써서 빈 답이 온다. */
    : await callGemini({ ...args, maxTokens: 8192 });

  const shaped = parseAsk(text);
  if (!shaped.answer) throw new Error('답이 비어서 왔어요. 다시 물어봐 주세요');
  return shaped;
}
