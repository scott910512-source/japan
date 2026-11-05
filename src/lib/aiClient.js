/* AI를 부르는 자리. 어느 화면이든 여기로만 나간다.
 *
 * 호출은 브라우저에서 바로 한다. 키는 사용자가 설정에 넣은 자기 키이고
 * 선택한 AI 제공처에 인증할 때만 보낸다.
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
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const PROVIDERS = { CLAUDE: 'claude', GEMINI: 'gemini' };

/* 어느 쪽이 실패했는지 알 수 있게 오류를 그대로 꺼내 준다. "실패했어요"만 뜨면
 * 키가 틀린 건지, 모델 이름이 낡은 건지, 한도를 넘은 건지 알 수가 없다. */
export async function failure(res, who) {
  let msg = `${who} HTTP ${res.status}`;
  let detail = '';
  let reasons = [];
  try {
    const body = await res.json();
    detail = body?.error?.message || '';
    reasons = (Array.isArray(body?.error?.details) ? body.error.details : []).map((item) => item.reason);
    if (detail) msg += ` — ${detail}`;
  } catch { /* 본문 파싱 실패는 무시 */ }
  const blocked = who === 'Gemini' && res.status === 403
    && (reasons.includes('API_KEY_SERVICE_BLOCKED') || /Requests to this API[\s\S]*are blocked/i.test(detail));
  if (blocked) msg = 'Gemini HTTP 403 — 현재 키에 Gemini 문장 첨삭 API 호출 권한이 없어요. Google AI Studio에서 Gemini 전용 키를 만들어 설정 → 학습 도구 → Gemini API 키에 넣어 주세요. 음성 키는 그대로 두세요.';
  const error = new Error(msg);
  error.status = res.status;
  if (who === 'Gemini' && res.status === 503) {
    error.code = 'GEMINI_BUSY';
    error.message = 'Gemini HTTP 503 — Gemini 서버에 요청이 몰려 잠시 응답하지 못했어요. 잠시 후 다시 시도해 주세요. 계속되면 설정 → 학습 도구의 ‘쓸 수 있는 모델 보기’에서 다른 모델을 선택할 수 있어요.';
  }
  if (who === 'Gemini' && res.status === 404) {
    error.code = 'GEMINI_MODEL_UNAVAILABLE';
    error.message = `Gemini HTTP 404 — 선택한 모델을 이 키로 사용할 수 없어요. 설정 → 학습 도구에서 모델을 ${DEFAULT_GEMINI_MODEL}로 바꾸거나 ‘쓸 수 있는 모델 보기’에서 골라 주세요.`;
  }
  if (blocked) error.code = 'GEMINI_SERVICE_BLOCKED';
  return error;
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

/* 모델이 계속 혼잡(503)할 때 갈아탈 후보 — 내 키로 쓸 수 있는 flash 계열을 새것부터, 작은 모델(lite)은 뒤로.
 * 이미지·음성·실험용처럼 글 답에 안 맞는 것은 뺀다. */
const FALLBACK_SKIP = /(image|tts|live|audio|thinking|exp|vision|embed|aqa|learnlm|gemma)/i;
export function pickFallbackModels(list = [], current = '', max = 2) {
  const ok = list.filter((n) => /flash/i.test(n) && !FALLBACK_SKIP.test(n) && n !== current).sort().reverse();
  return [...ok.filter((n) => !/lite/i.test(n)), ...ok.filter((n) => /lite/i.test(n))].slice(0, max);
}

/* Gemini에 몸통을 그대로 보내고 답을 통째로 받는다.
   영상처럼 특별한 모양을 실어야 할 때 쓴다. */
export async function geminiGenerate({ apiKey, model, body }) {
  if (!apiKey) throw new Error('구글 API 키가 필요해요');
  const name = String(model || DEFAULT_GEMINI_MODEL).trim().replace(/^models\//, '') || DEFAULT_GEMINI_MODEL;
  const request = (requestedModel) => fetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(requestedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  let currentModel = name;
  let retries = 0;
  let fellBack = false;
  for (;;) {
    const res = await request(currentModel);
    // 저장된 2.5 모델 접근이 막힌 경우에만 현재 기본 모델로 바꾼다.
    if (res.status === 404 && /^gemini-2\.5-/.test(currentModel)) {
      currentModel = DEFAULT_GEMINI_MODEL;
      continue;
    }
    // 서버가 혼잡하다고 명시한 503만 최대 두 번 다시 요청한다.
    // 권한·한도·네트워크 오류에는 중복 생성 요청을 보내지 않는다.
    if (res.status === 503 && retries < 2) {
      let delay = 1000 * (2 ** retries) + Math.floor(Math.random() * 250);
      const retryAfter = res.headers.get('retry-after');
      if (retryAfter) {
        const seconds = Number(retryAfter);
        const wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
        if (Number.isFinite(wait)) delay = Math.max(delay, wait);
      }
      // 긴 대기를 요구하면 일찍 재요청하지 않고 사용자가 나중에 다시 시도하게 한다.
      if (delay <= 10000) {
        retries += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
    /* ★ 끝까지 혼잡하면 다른 모델로 한 번씩 ★
       503은 구글 서버가 바쁘다는 말이고, 같은 모델을 계속 두드려도 안 풀릴 때가 많다.
       내 키로 쓸 수 있는 다른 flash 모델에 한 번씩만 시도한다(아직 답을 만든 적이 없어서 중복 생성이 아니다).
       목록을 못 받거나 다 막혀 있으면 처음 오류 그대로 알려 준다. */
    if (res.status === 503 && !fellBack) {
      fellBack = true;
      const busy = await failure(res, 'Gemini');
      try {
        for (const alt of pickFallbackModels(await listGeminiModels(apiKey), currentModel)) {
          const r2 = await request(alt);
          if (r2.ok) return r2.json();
        }
      } catch { /* 후보를 못 찾아도 처음 오류를 그대로 */ }
      throw busy;
    }
    if (!res.ok) throw await failure(res, 'Gemini');
    return res.json();
  }
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

/* 생성용 Gemini 키와 읽기용 TTS 키는 섞지 않는다. */
export function resolveProvider(settings = {}) {
  const provider = settings.aiProvider === PROVIDERS.CLAUDE ? PROVIDERS.CLAUDE : PROVIDERS.GEMINI;
  if (provider === PROVIDERS.CLAUDE) {
    return { provider, apiKey: settings.claudeKey || '', model: settings.claudeModel || '' };
  }
  return {
    provider,
    apiKey: String(settings.geminiKey || '').trim(),
    model: settings.geminiModel || '',
  };
}
