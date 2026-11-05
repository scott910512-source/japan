import assert from 'node:assert/strict';
import { DEFAULT_GEMINI_MODEL, failure, geminiGenerate, resolveProvider } from '../../src/lib/aiClient.js';
let pass = 0;
try {
  assert.equal(resolveProvider({ gttsKey: 'VOICE-ONLY' }).apiKey, ''); pass++;
  assert.equal(resolveProvider({ gttsKey: 'VOICE-ONLY', geminiKey: ' GEMINI-ONLY ' }).apiKey, 'GEMINI-ONLY'); pass++;
  assert.equal(resolveProvider({ geminiKey: '   ', gttsKey: 'VOICE-ONLY' }).apiKey, ''); pass++;
  assert.equal(resolveProvider({ aiProvider: 'claude', claudeKey: 'CLAUDE', geminiKey: 'GEMINI' }).apiKey, 'CLAUDE'); pass++;
  const exact = await failure(new Response(JSON.stringify({ error: { message: 'Requests to this API generativelanguage.googleapis.com method google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent are blocked.' } }), { status: 403 }), 'Gemini');
  assert.equal(exact.code, 'GEMINI_SERVICE_BLOCKED'); pass++;
  assert.match(exact.message, /Google AI Studio.*Gemini 전용 키/); pass++;
  assert.match(exact.message, /음성 키는 그대로/); pass++;
  const structured = await failure(new Response(JSON.stringify({ error: { message: '접근이 차단됨', details: [{ reason: 'API_KEY_SERVICE_BLOCKED' }] } }), { status: 403 }), 'Gemini');
  assert.equal(structured.code, 'GEMINI_SERVICE_BLOCKED'); pass++;
  const other = await failure(new Response(JSON.stringify({ error: { message: 'Region not supported' } }), { status: 403 }), 'Gemini');
  assert.match(other.message, /Region not supported/); assert.equal(other.code, undefined); pass++;
  const claude = await failure(new Response(JSON.stringify({ error: { message: 'Denied' } }), { status: 403 }), 'Claude');
  assert.match(claude.message, /Claude HTTP 403.*Denied/); pass++;
  const originalFetch = globalThis.fetch;
  const requests = [];
  let status = 404;
  const body = { contents: [{ role: 'user', parts: [{ text: '日本語' }] }] };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    const legacy = url.includes('gemini-2.5-flash:');
    return new Response(JSON.stringify(legacy || status !== 404
      ? { error: { message: 'This model is no longer available to new users.' } }
      : { candidates: [{ content: { parts: [{ text: 'OK' }] } }] }), { status: legacy ? status : (status === 404 ? 200 : status) });
  };
  try {
    await geminiGenerate({ apiKey: 'GENERATION-KEY', body });
    assert.match(requests[0].url, /models\/gemini-flash-latest:generateContent/); pass++;
    requests.length = 0;
    const result = await geminiGenerate({ apiKey: 'GENERATION-KEY', model: 'models/gemini-2.5-flash', body });
    assert.equal(requests.length, 2); assert.ok(requests[1].url.includes(DEFAULT_GEMINI_MODEL)); pass++;
    assert.equal(requests[0].options.body, requests[1].options.body);
    assert.ok(requests.every((r) => r.url.includes('GENERATION-KEY')));
    assert.equal(result.candidates[0].content.parts[0].text, 'OK'); pass++;
    for (status of [403, 429]) {
      requests.length = 0;
      await assert.rejects(geminiGenerate({ apiKey: 'GENERATION-KEY', model: 'gemini-2.5-flash', body }), (e) => e.status === status);
      assert.equal(requests.length, 1); pass++;
    }
    status = 404;
    const missing = await failure(new Response('{}', { status: 404 }), 'Gemini');
    assert.match(missing.message, /gemini-flash-latest.*쓸 수 있는 모델 보기/); pass++;
    globalThis.fetch = async (url) => {
      requests.push({ url });
      return new Response('{}', { status: 404 });
    };
    requests.length = 0;
    await assert.rejects(geminiGenerate({ apiKey: 'GENERATION-KEY', model: DEFAULT_GEMINI_MODEL, body }), (e) => e.code === 'GEMINI_MODEL_UNAVAILABLE');
    assert.equal(requests.length, 1); pass++;
    requests.length = 0;
    await assert.rejects(geminiGenerate({ apiKey: 'GENERATION-KEY', model: 'gemini-2.5-flash', body }), (e) => e.status === 404);
    assert.equal(requests.length, 2); pass++;
  } finally { globalThis.fetch = originalFetch; }
} catch (error) { console.error(error); console.log(`통과 ${pass} / 실패 1`); process.exit(1); }
console.log(`통과 ${pass} / 실패 0`); process.exit(0);
