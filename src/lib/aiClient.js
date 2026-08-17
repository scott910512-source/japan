/* AI를 부르는 자리. 어느 화면이든 여기로만 나간다.
 *
 * 호출은 브라우저에서 바로 한다. 키는 사용자가 설정에 넣은 자기 키이고
 * 기기 밖으로 나가지 않는다 — 음성 키와 같은 방식이다.
 *
 * 이 파일이 하는 일은 "부르고, 글자를 꺼내고, 안 되면 왜 안 됐는지 말하는 것"
 * 까지다. 무엇을 물어볼지(프롬프트)는 각자 자기 파일에서 정한다. */

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_MODEL = 'claude-sonnet-5';

/* 제미나이 모델 이름은 자주 바뀐다. 여기 적어 둔 값이 낡으면 404가 나는데,
 * 그때 "왜 안 되지"로 끝나면 안 되니 키로 목록을 직접 받아 고를 수 있게 해 둔다
 * (listGeminiModels). 여기 값은 그 전까지 쓰는 첫 후보일 뿐이다. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const PROVIDERS = { CLAUDE: 'claude', GEMINI: 'gemini' };

/* 어느 쪽이 실패했는지 알 수 있게 오류를 그대로 꺼내 준다. "실패했어요"만 뜨면
 * 키가 틀린 건지, 모델 이름이 낡은 건지, 한도를 넘은 건지 알 수가 없다. */
export async function failure(res, who) {
  let msg = `${who} HTTP ${res.status}`;
  try {
    const body = await res.json();
    const detail = body?.error?.message;
    if (detail) msg += ` — ${detail}`;
  } catch { /* 본문 파싱 실패는 무시 */ }
  return new Error(msg);
}

/* 글이 안 왔을 때 왜 안 왔는지 말해 준다.
 *
 * "빈 응답"만 뜨면 막힌 건지, 길어서 잘린 건지, 모델이 이상한 건지 알 수가
 * 없다. 구글이 이유를 finishReason으로 알려 주니 그대로 옮긴다. */
export function geminiReason(data) {
  const blocked = data?.promptFeedback?.blockReason;
  if (blocked) return `안전 필터에 걸렸어요 (${blocked})`;
  const why = data?.candidates?.[0]?.finishReason;
  if (why === 'MAX_TOKENS') return '답이 너무 길어 잘렸어요. 짧게 나눠서 해 보세요';
  if (why === 'SAFETY' || why === 'PROHIBITED_CONTENT') return `안전 필터에 걸렸어요 (${why})`;
  if (why === 'RECITATION') return '저작물로 판단돼 거절됐어요 (RECITATION)';
  return why ? `Gemini가 글을 못 만들었어요 (${why})` : 'Gemini가 빈 응답을 보냈어요';
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

/* Gemini에 몸통을 그대로 보내고 답을 통째로 받는다.
   영상처럼 특별한 모양을 실어야 할 때 쓴다. */
export async function geminiGenerate({ apiKey, model, body }) {
  if (!apiKey) throw new Error('구글 API 키가 필요해요');
  const name = model || DEFAULT_GEMINI_MODEL;
  const res = await fetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(name)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw await failure(res, 'Gemini');
  return res.json();
}

export function geminiText(data) {
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

/* 지시문 + 본문 → 글자. JSON으로 달라고 형식을 직접 지정한다.
 *
 * 한도를 넉넉히 잡는다. Gemini 2.5부터는 생각하는 토큰도 이 한도에서 깎아
 * 먹어서, 빠듯하게 잡으면 생각하다 한도를 다 써서 답이 중간에 잘린다. */
export async function callGemini({
  apiKey, model, system, user, maxTokens = 32768, json = true,
}) {
  const data = await geminiGenerate({
    apiKey,
    model,
    body: {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        ...(json ? { responseMimeType: 'application/json' } : {}),
        maxOutputTokens: maxTokens,
      },
    },
  });
  const text = geminiText(data);
  if (!text) throw new Error(geminiReason(data));
  return text;
}

export async function callClaude({
  apiKey, model, system, user, maxTokens = 8000,
}) {
  if (!apiKey) throw new Error('API 키가 필요해요');
  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw await failure(res, 'Claude');
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

/* AI Studio에서 받은 Gemini 키인지 본다.
 *
 * 음성(Cloud TTS)과 Gemini는 둘 다 구글이지만 키가 다르다. Cloud 키는 AIza로
 * 시작하고, AI Studio 키는 AQ.로 시작한다. 생김새가 비슷해서 음성 칸에 Gemini
 * 키를 넣는 일이 실제로 일어나는데, 그러면 구글이 "Expected OAuth2 access
 * token…"이라는 알 수 없는 말로 거절한다. 넣는 순간 알려 주는 게 낫다.
 *
 * AIza로 시작하는 키는 양쪽 다 가능해서 판단하지 않는다 — 확실할 때만 말한다. */
export function looksLikeGeminiKey(key = '') {
  return /^AQ\./.test(String(key).trim());
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
