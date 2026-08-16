/* 영상 자막을 학습자료로 바꾸는 튜터.
 *
 * 자막 전체를 번역하거나 통째로 외우게 하지 않는다. 지금 수준에서 실제로
 * 쓸 값이 있는 것만 골라 낸다 — 새 문법 1~3개, 단어 5~10개가 한 번의 한계다.
 * 그 이상은 배운 게 아니라 읽은 것이 된다.
 *
 * 호출은 브라우저에서 바로 한다. 키는 사용자가 설정에 넣은 자기 키이고
 * 기기 밖으로 나가지 않는다 — 음성 키와 같은 방식이다. */

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_MODEL = 'claude-sonnet-5';

/* 제미나이 모델 이름은 자주 바뀐다. 여기 적어 둔 값이 낡으면 404가 나는데,
 * 그때 "왜 안 되지"로 끝나면 안 되니 키로 목록을 직접 받아 고를 수 있게 해 둔다
 * (listGeminiModels). 여기 값은 그 전까지 쓰는 첫 후보일 뿐이다. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const PROVIDERS = { CLAUDE: 'claude', GEMINI: 'gemini' };

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
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('JSON을 읽지 못했어요');
  }
}

function userText({ title, channel, script }) {
  const head = [title && `제목: ${title}`, channel && `채널: ${channel}`].filter(Boolean).join('\n');
  return `${head ? `[영상 정보]\n${head}\n\n` : ''}[자막]\n${script.trim()}`;
}

/* 어느 쪽이 실패했는지 알 수 있게 오류를 그대로 꺼내 준다. "실패했어요"만 뜨면
 * 키가 틀린 건지, 모델 이름이 낡은 건지, 한도를 넘은 건지 알 수가 없다. */
async function failure(res, who) {
  let msg = `${who} HTTP ${res.status}`;
  try {
    const body = await res.json();
    const detail = body?.error?.message;
    if (detail) msg += ` — ${detail}`;
  } catch { /* 본문 파싱 실패는 무시 */ }
  return new Error(msg);
}

/* 이 키로 실제로 쓸 수 있는 모델을 받아 온다. 내가 적어 둔 이름이 맞는지
 * 짐작하지 않고 물어보는 쪽이 확실하다. */
export async function listGeminiModels(apiKey) {
  if (!apiKey) throw new Error('구글 API 키가 필요해요');
  const res = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw await failure(res, 'Gemini');
  const data = await res.json();
  return (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name).replace(/^models\//, ''))
    .sort();
}

async function analyzeWithGemini({ apiKey, model, title, channel, script }) {
  const name = model || DEFAULT_GEMINI_MODEL;
  const res = await fetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(name)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userText({ title, channel, script }) }] }],
        // JSON으로 달라고 형식을 직접 지정한다 — 펜스나 앞말이 붙지 않는다.
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
      }),
    },
  );
  if (!res.ok) throw await failure(res, 'Gemini');
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error('Gemini가 빈 응답을 보냈어요');
  return parseAnalysis(text);
}

export async function analyzeScript({ provider, apiKey, model, title, channel, script }) {
  if (!apiKey) throw new Error('API 키가 필요해요');
  if (!script?.trim()) throw new Error('자막을 먼저 붙여넣어 주세요');
  if (provider === PROVIDERS.GEMINI) {
    return analyzeWithGemini({ apiKey, model, title, channel, script });
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userText({ title, channel, script }) }],
    }),
  });

  if (!res.ok) throw await failure(res, 'Claude');

  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseAnalysis(text);
}

/* 설정에서 실제로 쓸 제공처와 키를 정한다.
 *
 * Gemini 키는 음성(TTS/STT) 키와 같은 구글 API 키 형식이라, 따로 넣지 않았으면
 * 그 키를 그대로 쓴다 — 키를 두 번 넣게 하지 않는다. 다만 그 키가 붙은 구글
 * 프로젝트에서 Generative Language API가 켜져 있어야 통한다. */
export function resolveProvider(settings = {}) {
  const provider = settings.aiProvider === PROVIDERS.CLAUDE ? PROVIDERS.CLAUDE : PROVIDERS.GEMINI;
  if (provider === PROVIDERS.CLAUDE) {
    return { provider, apiKey: settings.claudeKey || '', model: settings.claudeModel || '' };
  }
  return {
    provider,
    apiKey: settings.geminiKey || settings.gttsKey || '',
    model: settings.geminiModel || '',
    borrowed: !settings.geminiKey && Boolean(settings.gttsKey),
  };
}

/* 유튜브 주소에서 영상 id만 뽑는다. youtu.be, watch?v=, shorts, embed 모두 받는다. */
export function youtubeId(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : '';
}
