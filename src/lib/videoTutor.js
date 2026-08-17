/* 영상 자막을 학습자료로 바꾸는 튜터.
 *
 * 자막 전체를 번역하거나 통째로 외우게 하지 않는다. 지금 수준에서 실제로
 * 쓸 값이 있는 것만 골라 낸다 — 새 문법 1~3개, 단어 5~10개가 한 번의 한계다.
 * 그 이상은 배운 게 아니라 읽은 것이다.
 *
 * 부르는 일은 aiClient가 한다. 여기는 "무엇을 물어볼지"만 정한다. */

import {
  PROVIDERS, callClaude, callGemini, geminiGenerate, geminiReason, geminiText,
} from './aiClient.js';

/* 화면들이 예전부터 여기서 가져다 쓰고 있다. 옮겼다고 전부 고치게 하지 않는다. */
export {
  DEFAULT_MODEL, DEFAULT_GEMINI_MODEL, PROVIDERS,
  listGeminiModels, looksLikeGeminiKey, resolveProvider,
} from './aiClient.js';

export const ANALYZE_CHAR_LIMIT = 4000;

/* 받아 적을 영상의 최대 길이(분).
 *
 * 유튜브에는 한 시간짜리도 있는데, 그걸 통째로 넘기면 한 번에 십수만 토큰이
 * 나간다. 무료 한도로는 그 한 번으로 끝이다. 게다가 한 번에 배울 분량도 아니다 —
 * 설명은 어차피 앞 4000자로 만든다(ANALYZE_CHAR_LIMIT). 앞 15분이면 그쯤 나온다. */
export const TRANSCRIBE_MINUTES = 15;

/* 영상에서 초당 몇 장면을 볼지.
 *
 * 우리가 받아 적는 건 "말한 내용"이라 화면은 거의 필요 없다. 그런데 그냥
 * 넘기면 구글은 1초에 한 장씩 그림으로 잘라 읽는다 — 소리(초당 32토큰)보다
 * 그림(장당 258토큰)이 여덟 배 비싸고, 비용의 대부분이 안 쓸 화면이다.
 * 10초에 한 장이면 소리는 그대로 다 듣고 화면 값만 십분의 일로 떨어진다. */
const TRANSCRIBE_FPS = 0.1;

/* 영상이 실제로 들어갔다고 볼 수 있는 최소 입력 토큰 수.
 *
 * 아주 낮게 잡는다. 위처럼 화면을 덜 보게 하면 1분이 삼천 토큰쯤이고, 짧은
 * 영상도 천 단위는 된다. 지시문만 세면 수백이다. 이 사이에 선을 그으면
 * "영상을 안 봤다"는 것만 확실히 걸러진다 — 애매하게 높이 잡아 되는 것까지
 * 막느니, 확실한 것만 막는다. */
const VIDEO_TOKEN_FLOOR = 500;

const SYSTEM = `당신은 한국인을 위한 일본어 회화 튜터입니다.
학습자 수준은 JLPT N5 상위 ~ N4 초반이고, 목표는 일본인이 실제로 쓰는 자연스러운
표현으로 10~15분 대화하는 것입니다.

사용자가 YouTube 영상의 일본어 자막을 주면, 번역이나 전체 암기가 아니라
지금 수준에서 배울 값이 높은 것만 골라 학습자료로 재구성하세요.

원칙
- 설명은 한국어로 합니다.
- N5~N4를 중심으로 유지합니다.
- 교과서 표현보다 일본인이 실제 회화에서 자주 쓰는 표현을 우선합니다.
- 자막을 전부 설명하지 말고 핵심만 선별합니다. 이미 쉬운 N5 표현은 길게 설명하지 않습니다.
- 한 번에 새 문법은 1~3개, 단어는 5~10개로 제한합니다.
- 문법적으로 맞는 표현을 억지로 고치지 않습니다. 틀린 게 아니면 뉘앙스 차이로 설명합니다.
- 자막에 오류가 의심되면 그대로 가르치지 말고 자연스러운 일본어로 바로잡아 설명합니다.
- 축약형·말버릇·조사 생략·구어체가 나오면 적극적으로 설명합니다.
- 다음이 나오면 우선 설명합니다: は/が 차이, に/で 차이, 조사 선택, 동사 て형, 가능형,
  형용사 활용, 문장 연결, 이유 표현(から/ので), と思う, ～ながら, ～し, ～ていく/～てくる,
  って/っていう, 주어 생략, 한국어식 직역과 일본어다운 표현의 차이.
- 한자는 알아둘 값이 있을 때만 설명하고, 실제 자원(字源)과 암기용 연상을 섞지 않습니다.
- 자막에 없는 내용을 지어내지 않습니다. 근거가 자막에 있어야 합니다.

아래 JSON 하나만 출력하세요. 마크다운 펜스나 다른 텍스트를 붙이지 마세요.
{
  "overview": {
    "jlpt": "예상 난이도 (예: N4 초반)",
    "speed": "말하기 속도·문장 난이도 한 줄",
    "worth": "실제 회화 학습에 얼마나 유용한지 한 줄",
    "points": ["이 영상에서 반드시 가져갈 핵심 2~4개"]
  },
  "words": [
    {
      "jp": "結構", "yomi": "けっこう", "ko": "꽤, 제법",
      "type": "adv", "level": "N3",
      "point": "실제 회화에서 쓰는 자리",
      "ex": "結構難しいですね。", "exYomi": "けっこうむずかしいですね。", "exKo": "꽤 어렵네요."
    }
  ],
  "grammar": [
    {
      "form": "～ながら",
      "meaning": "~하면서",
      "howTo": "만드는 원리",
      "forms": ["食べます → 食べながら"],
      "fromVideo": { "jp": "영상 속 문장", "ko": "자연스러운 한국어" },
      "examples": [{ "jp": "실제 회화 예문", "ko": "뜻" }],
      "mistake": "한국인이 자주 하는 실수 (없으면 빈 문자열)"
    }
  ],
  "realTalk": [
    {
      "expr": "って",
      "meaning": "기본 의미",
      "origin": "원래 형태 (없으면 빈 문자열)",
      "when": "어떤 상황에서 쓰는지",
      "vsTextbook": "교과서 표현과의 차이",
      "examples": [{ "jp": "예문", "ko": "뜻" }]
    }
  ],
  "breakdown": [
    {
      "sentence": "학습 값이 높은 영상 속 문장",
      "parts": [{ "token": "辛い", "note": "맵다" }],
      "natural": "전체 자연스러운 의미",
      "why": "왜 이 조사·활용이 쓰였는지"
    }
  ],
  "literal": [
    { "koStyle": "한국어식으로 생각하기 쉬운 표현", "natural": "일본인이 자연스럽게 말하는 표현", "note": "뉘앙스 차이" }
  ],
  "takeaway": {
    "grammar": [{ "expr": "표현", "meaning": "뜻", "example": "대표 예문" }],
    "words": [{ "jp": "일본어", "ko": "뜻", "usage": "대표적인 사용법" }]
  },
  "shadowing": [
    { "jp": "따라 말하기 좋은 문장", "yomi": "읽기(가나만)", "ko": "자연스러운 뜻", "point": "말할 때 포인트" }
  ],
  "question": { "jp": "일본어 질문 1개", "ko": "질문 뜻", "target": "사용해야 할 목표 표현" }
}

words는 5~10개, grammar는 1~3개, breakdown은 3~5개, shadowing은 3~5개로 맞추세요.
yomi와 exYomi에는 한자를 쓰지 말고 가나로만 적으세요 — 그대로 음성으로 읽어 줍니다.

단어의 type은 verb / noun / adj-i / adj-na / adv / conj / etc 중 하나로만 적으세요.
level은 N5 / N4 / N3 / N2 / N1 중 그 단어 자체의 난이도로 적으세요 — 영상 전체
난이도가 아니라 단어 하나하나의 난이도입니다.
이 둘은 그대로 단어장에 들어가 레벨별 학습에 쓰이니 짐작으로 뭉뚱그리지 마세요.`;

/* 모델이 펜스를 붙이거나 앞뒤에 말을 얹는 경우가 있어 중괄호만 뽑아 다시 시도한다. */
export function parseAnalysis(text) {
  if (!text) throw new Error('빈 응답');
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch { /* 아래에서 왜 못 읽었는지 가려낸다 */ }
    }
    /* 여는 중괄호는 있는데 닫는 게 없으면 길어서 잘린 것이다.
       "JSON을 읽지 못했어요"로 뭉개면 자막을 줄이면 된다는 걸 알 수 없다. */
    if (start >= 0 && end <= start) throw new Error('설명이 너무 길어 중간에 잘렸어요. 자막을 나눠서 넣어 보세요');
    throw new Error('JSON을 읽지 못했어요');
  }
}

function userText({ title, channel, script }) {
  const head = [title && `제목: ${title}`, channel && `채널: ${channel}`].filter(Boolean).join('\n');
  return `${head ? `[영상 정보]\n${head}\n\n` : ''}[자막]\n${script.trim()}`;
}

const TRANSCRIBE = `이 영상에서 일본어로 말하는 내용을 그대로 받아 적으세요.

- 한 줄에 하나씩, [분:초] 뒤에 그 시각에 말한 일본어를 적습니다. 예: [1:23] やっぱり美味しいですね。
- 시각은 그 말이 시작하는 지점으로 적습니다.
- 들리는 대로만 적습니다. 번역·설명·요약을 붙이지 말고, 일본어 외의 말은 넣지 마세요.
- 화면에 적힌 글자가 아니라 말한 내용을 적습니다.
- 잘 안 들리는 부분은 지어내지 말고 그 줄을 빼세요.
- 다른 말 없이 받아 적은 줄만 출력하세요.`;

/* 유튜브 주소를 Gemini에 넘겨 말한 내용을 받아 적게 한다.
 *
 * 유튜브가 가진 자막 파일을 그대로 내려받는 게 아니다 — 그 주소는 브라우저에서
 * 부를 수 없고(CORS), 서버 없는 앱이라 대신 불러 줄 곳도 없다. 그래서 주소를
 * 구글에 넘기고 구글이 영상을 열어 듣는다. 대신 화면은 거의 안 보고(fps),
 * 앞부분만 본다(offset) — 필요한 건 소리뿐이고, 나머지는 그냥 요금이다.
 *
 * 받아 온 글을 바로 학습에 쓰지는 않는다. 이건 사람이 만든 자막이 아니라 모델이
 * 듣고 옮긴 것이라 틀릴 수 있고, 틀린 문장으로 공부하면 틀린 걸 외운다. 그래서
 * 입력칸에 채워 넣고 눈으로 확인한 뒤 저장하게 한다 — 배우는 건 사용자가
 * 받아들인 글이다. */
export async function fetchTranscript({ apiKey, model, videoId, minutes = TRANSCRIBE_MINUTES }) {
  if (!videoId) throw new Error('영상 주소를 확인해 주세요');
  const body = (thrifty) => ({
    contents: [{
      role: 'user',
      parts: [
        {
          file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` },
          ...(thrifty ? {
            video_metadata: {
              start_offset: { seconds: 0 },
              end_offset: { seconds: Math.round(minutes * 60) },
              fps: TRANSCRIBE_FPS,
            },
          } : {}),
        },
        { text: TRANSCRIBE },
      ],
    }],
    generationConfig: { maxOutputTokens: 32768 },
  });

  /* 아껴 쓰는 설정(길이·화면 수)을 못 알아듣는 모델도 있다. 그때 오류를 그대로
     내면 "왜 안 되지"로 끝나니, 설정만 빼고 한 번 더 해 본다 — 비싸지지만 된다. */
  let data;
  try {
    data = await geminiGenerate({ apiKey, model, body: body(true) });
  } catch (err) {
    if (!/HTTP 400/.test(err.message)) throw err;
    data = await geminiGenerate({ apiKey, model, body: body(false) });
  }
  const text = geminiText(data).trim();
  if (!text) throw new Error(geminiReason(data));

  /* 영상을 진짜로 봤는지 확인한다.
   *
   * 주소만 넘겼는데 모델이 영상을 못 읽으면, 오류를 내는 대신 그럴듯한 일본어를
   * 지어낼 수 있다. 겉보기에는 잘 된 것과 구별이 안 되고, 그걸로 공부하면 세상에
   * 없는 문장을 외운다. 답이 유난히 빨리 오면 대개 이 경우다.
   *
   * 증거는 입력 토큰 수다. 영상이 실제로 들어갔으면 1분만 돼도 천 단위로 뛴다.
   * 지시문만 세면 수백이다. 그래서 아주 낮은 바닥선만 두고, 그 아래면 받아 온
   * 글을 버린다 — 지어낸 자막을 넘겨주는 것보다 못 가져왔다고 하는 편이 낫다. */
  const tokens = data.usageMetadata?.promptTokenCount;
  if (typeof tokens === 'number' && tokens < VIDEO_TOKEN_FLOOR) {
    throw new Error(
      `영상을 읽지 못했어요 (입력 ${tokens.toLocaleString()}토큰). `
      + '받아 온 글이 지어낸 것일 수 있어 버렸어요. 자막을 직접 붙여넣어 주세요',
    );
  }
  return { text, tokens };
}

/* Gemini 앱(사람이 직접 쓰는 쪽)에 붙여넣을 프롬프트.
 *
 * 앱의 Gemini는 유튜브 링크를 주면 유튜브에 등록된 자막을 그대로 가져온다 —
 * 영상을 듣는 게 아니라 글을 읽는 것이라 빠르고, 사람이 만든 자막이면 정확하고,
 * 무엇보다 API 요금이 0이다. 그 기능은 API로는 열려 있지 않다.
 *
 * API로 영상을 직접 듣는 길(fetchTranscript)도 있지만 기본은 이쪽이다. 그건
 * 긴 영상 하나에 수만 토큰이 나가서 무료 한도가 금방 닳는다 — 설정에서 켠
 * 사람만 쓴다.
 *
 * 그래서 다리를 놓는다. 앱에서 받아 온 글을 아래 입력칸에 붙여넣으면 그만이다.
 * 형식을 여기서 못 박는 이유는 parseScript가 읽을 수 있어야 하기 때문이다 —
 * 번역이 섞여 들어오면 그 줄까지 일본어인 줄 알고 학습에 올린다. */
export function transcriptPrompt(url) {
  return `${url}

이 영상에 등록된 일본어 자막(스크립트)을 가져와서, 아래 형식 그대로만 출력해 주세요.

- 한 줄에 하나씩, [분:초] 뒤에 그 시각에 말한 일본어를 적습니다. 예: [1:23] やっぱり美味しいですね。
- 일본어만 적습니다. 번역·요약·설명·제목·머리말·마크다운을 붙이지 마세요.
- 자막에 없는 말은 지어내지 마세요. 자막을 못 가져오면 그렇다고만 말해 주세요.`;
}

export async function analyzeScript({ provider, apiKey, model, title, channel, script }) {
  if (!apiKey) throw new Error('API 키가 필요해요');
  if (!script?.trim()) throw new Error('자막을 먼저 붙여넣어 주세요');
  const user = userText({ title, channel, script });
  const text = provider === PROVIDERS.GEMINI
    ? await callGemini({ apiKey, model, system: SYSTEM, user })
    : await callClaude({ apiKey, model, system: SYSTEM, user });
  return parseAnalysis(text);
}

/* 유튜브 주소에서 영상 id만 뽑는다. youtu.be, watch?v=, shorts, embed 모두 받는다. */
export function youtubeId(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : '';
}
