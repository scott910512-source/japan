/* 현지에서 바로 쓰는 번역기.
 *
 * 학습용 번역이 아니라 "지금 이 자리에서 말해야 하는" 번역이다. 그래서
 * 사전처럼 여러 뜻을 늘어놓지 않고, 실제로 입 밖에 낼 한 문장을 준다.
 *
 * 한 번에 세 가지가 필요하다.
 *   1) 지금 말할 문장 — 존댓말/반말을 상황에 맞게
 *   2) 어떻게 읽는지 — 여행 중에는 가나를 읽을 틈이 없다. 한글 발음이 있어야
 *      바로 말한다. 그건 우리가 kanaToHangul로 만든다(AI에게 안 맡긴다 —
 *      지어내면 틀린 발음을 그대로 말하게 된다)
 *   3) 왜 그렇게 말하는지 한 줄 — 다음에 혼자 응용하려면 필요하다
 *
 * 사투리는 있을 때만 준다. 여행지가 오사카면 「ありがとう」보다 「おおきに」가
 * 실제로 들리는 말이고, 그걸 알아듣는 것만으로도 다르다. 없으면 억지로 만들지
 * 않는다 — 지어낸 사투리를 말하면 안 통한다. */

import { PROVIDERS, callClaude, callGemini } from './aiClient.js';

/* 답이 길면 여행 중에 못 읽는다. 짧게 받는 대신 자주 물어보는 게 낫다. */
export const MAX_INPUT_CHARS = 200;

const SYSTEM = `당신은 일본 여행 중인 한국인 옆에 있는 통역사입니다.
사용자가 한국어로 말하면, 지금 그 자리에서 바로 말할 수 있는 일본어를 알려 주세요.

원칙
- 사전 나열이 아니라 "이 상황에서 실제로 이렇게 말한다" 한 문장을 줍니다.
- 기본은 처음 만난 사람에게 쓰는 정중체(です·ます)입니다. 사용자가 반말로
  적었거나 친구에게 하는 말이 분명하면 그에 맞춥니다.
- 상황이 애매하면 가장 흔한 쪽 하나만 고르고, 다른 쪽은 alt에 넣습니다.
- yomi에는 한자를 쓰지 말고 가나로만 적되, 글자가 아니라 소리 나는 대로 적으세요.
  조사 は는 わ로, 조사 へ는 え로 적습니다. (これは → これわ / 学校へ → がっこうえ)
  이 글자가 그대로 발음 표기와 음성이 되기 때문에, 글자대로 적으면 「코레하」처럼
  실제로 안 쓰는 소리를 말하게 됩니다.
- 사투리(dialect)는 그 지역에서 실제로 그렇게 말할 때만 넣으세요.
  표준어와 같으면 넣지 마세요. 없으면 빈 배열로 두세요. 지어내지 마세요.
- note는 한 줄입니다. 언제 쓰는지, 조심할 게 있으면 그것만.
- words에는 이 문장에서 따로 외워 둘 값이 있는 단어만 2~5개 담습니다.
  문장 전체를 쪼개 나열하지 마세요.

아래 JSON 하나만 출력하세요. 마크다운 펜스나 다른 텍스트를 붙이지 마세요.
{
  "jp": "すみません、これはいくらですか。",
  "yomi": "すみません、これはいくらですか。",
  "ko": "실례합니다, 이거 얼마예요?",
  "politeness": "정중체",
  "note": "가게에서 값을 물을 때 가장 무난한 말투예요.",
  "alt": [
    { "jp": "これ、いくら？", "yomi": "これ、いくら？", "when": "친구 사이나 편한 자리" }
  ],
  "dialect": [
    { "area": "오사카", "jp": "これなんぼ？", "yomi": "これなんぼ？", "note": "간사이에서는 いくら 대신 なんぼ를 씁니다" }
  ],
  "words": [
    { "jp": "いくら", "yomi": "いくら", "ko": "얼마", "type": "noun", "level": "N5" }
  ]
}

단어의 type은 verb / noun / adj-i / adj-na / adv / conj / etc 중 하나로만,
level은 N5 / N4 / N3 / N2 / N1 중 그 단어 자체의 난이도로 적으세요.
이 둘은 그대로 단어장에 들어갑니다.`;

/* 모델이 펜스를 붙이거나 앞뒤에 말을 얹는 경우가 있어 중괄호만 뽑아 다시 시도한다. */
export function parseTranslation(text) {
  if (!text) throw new Error('빈 응답');
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { data = JSON.parse(trimmed.slice(start, end + 1)); } catch { /* 아래에서 처리 */ }
    }
    if (!data) {
      if (start >= 0 && end <= start) throw new Error('답이 중간에 잘렸어요. 짧게 나눠서 물어봐 주세요');
      throw new Error('답을 읽지 못했어요');
    }
  }
  if (!data.jp) throw new Error('일본어가 안 왔어요');

  /* 모양을 여기서 고정한다. 빠진 칸이 있으면 화면에서 매번 확인해야 하고,
     한 군데라도 빠뜨리면 흰 화면이 된다. */
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    jp: String(data.jp),
    yomi: String(data.yomi || data.jp),
    ko: String(data.ko || ''),
    politeness: String(data.politeness || ''),
    note: String(data.note || ''),
    alt: list(data.alt).filter((a) => a?.jp).map((a) => ({
      jp: String(a.jp), yomi: String(a.yomi || a.jp), when: String(a.when || ''),
    })),
    dialect: list(data.dialect).filter((d) => d?.jp).map((d) => ({
      area: String(d.area || '사투리'), jp: String(d.jp),
      yomi: String(d.yomi || d.jp), note: String(d.note || ''),
    })),
    words: list(data.words).filter((w) => w?.jp).map((w) => ({
      jp: String(w.jp), yomi: String(w.yomi || w.jp), ko: String(w.ko || ''),
      type: String(w.type || 'etc'), level: String(w.level || 'N4'),
    })),
  };
}

function userText(korean, place) {
  const where = place?.trim();
  return `${where ? `[지금 있는 곳] ${where}\n\n` : ''}[한국어] ${korean.trim()}`;
}

/* 한국어 한 줄 → 지금 말할 일본어.
 * place는 "오사카"처럼 지역을 적어 두면 그쪽 사투리를 같이 봐 준다(선택). */
export async function translate({
  provider, apiKey, model, korean, place,
}) {
  if (!apiKey) throw new Error('API 키가 필요해요');
  if (!korean?.trim()) throw new Error('번역할 말을 적어 주세요');
  if (korean.length > MAX_INPUT_CHARS) {
    throw new Error(`한 번에 ${MAX_INPUT_CHARS}자까지예요. 나눠서 물어봐 주세요`);
  }

  const text = provider === PROVIDERS.GEMINI
    ? await callGemini({ apiKey, model, system: SYSTEM, user: userText(korean, place), maxTokens: 4096 })
    : await callClaude({ apiKey, model, system: SYSTEM, user: userText(korean, place), maxTokens: 2000 });

  return parseTranslation(text);
}
