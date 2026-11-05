import assert from 'node:assert/strict';
import { DEFAULT_GEMINI_MODEL, geminiGenerate, pickFallbackModels } from '../../src/lib/aiClient.js';

const original = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, random: Math.random, now: Date.now };
let pass = 0;
let requests = []; let delays = [];
const body = { contents: [{ role: 'user', parts: [{ text: '私は学生です。' }] }] };
const models = (names) => new Response(JSON.stringify({ models: names.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) }), { status: 200 });
const response = (status, headers) => new Response(JSON.stringify(status === 200
  ? { candidates: [{ content: { parts: [{ text: 'OK' }] } }] }
  : { error: { message: 'This model is currently experiencing high demand.' } }), { status, headers });
function setup(sequence) {
  requests = []; delays = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    assert.ok(sequence.length, 'unexpected extra request');
    const next = sequence.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}
const generate = (model) => geminiGenerate({ apiKey: 'FAKE-GENERATION-KEY', model, body });
try {
  globalThis.setTimeout = (fn, delay) => { delays.push(delay); queueMicrotask(fn); return 0; };
  Math.random = () => 0;

  setup([response(503), response(200)]);
  assert.equal((await generate()).candidates[0].content.parts[0].text, 'OK');
  assert.deepEqual(delays, [1000]); assert.equal(requests.length, 2); pass++;
  assert.equal(requests[0].url, requests[1].url);
  assert.equal(requests[0].options.body, requests[1].options.body); pass++;

  setup([response(503), response(503), response(200)]);
  await generate(); assert.deepEqual(delays, [1000, 2000]); pass++;

  /* 세 번 다 혼잡하고 모델 목록도 못 받으면(여기서는 응답이 더 없다) 처음 오류 그대로 */
  setup([response(503), response(503), response(503)]);
  await assert.rejects(generate(), (e) => e.code === 'GEMINI_BUSY' && /잠시 후 다시 시도/.test(e.message));
  assert.equal(requests.length, 4); assert.deepEqual(delays, [1000, 2000]); pass++;

  /* ★ 끝까지 혼잡하면 다른 모델로 갈아탄다 ★ */
  const LIST = [DEFAULT_GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash-image', 'gemini-live-2.5-flash'];
  setup([response(503), response(503), response(503), models(LIST), response(200)]);
  assert.equal((await generate()).candidates[0].content.parts[0].text, 'OK');
  assert.equal(requests.length, 5); assert.ok(requests[3].url.includes('/models?key='), '모델 목록을 받는다');
  assert.ok(requests[4].url.includes('gemini-2.5-flash:generateContent'), '작은(lite) 모델보다 일반 flash가 먼저'); pass++;
  assert.equal(requests[4].options.body, requests[0].options.body); pass++;

  setup([response(503), response(503), response(503), models(LIST), response(503), response(200)]);
  await generate();
  assert.ok(requests[5].url.includes('gemini-2.5-flash-lite:generateContent'), '첫 후보도 막히면 둘째 후보'); pass++;

  setup([response(503), response(503), response(503), models(LIST), response(503), response(503)]);
  await assert.rejects(generate(), (e) => e.code === 'GEMINI_BUSY');
  assert.equal(requests.length, 6); pass++;

  setup([response(503), response(503), response(503), models([DEFAULT_GEMINI_MODEL, 'gemini-2.5-pro'])]);
  await assert.rejects(generate(), (e) => e.code === 'GEMINI_BUSY');
  assert.equal(requests.length, 4, '갈아탈 flash가 없으면 더 안 부른다'); pass++;

  assert.deepEqual(pickFallbackModels(LIST, DEFAULT_GEMINI_MODEL), ['gemini-2.5-flash', 'gemini-2.5-flash-lite']); pass++;
  assert.deepEqual(pickFallbackModels(['a-pro', 'b-flash-image', 'c-flash-tts'], 'x'), []); pass++;

  setup([response(503, { 'Retry-After': '3' }), response(200)]);
  await generate(); assert.deepEqual(delays, [3000]); pass++;

  setup([response(503, { 'Retry-After': '60' })]);
  await assert.rejects(generate(), (e) => e.status === 503);
  assert.equal(requests.length, 2, '긴 대기를 요구하면 같은 모델은 안 두드리고 후보만 찾아본다(목록 한 번)'); assert.deepEqual(delays, []); pass++;

  Date.now = () => Date.parse('2026-11-02T13:00:00Z');
  setup([response(503, { 'Retry-After': 'Mon, 02 Nov 2026 13:00:04 GMT' }), response(200)]);
  await generate(); assert.deepEqual(delays, [4000]); pass++;
  Date.now = original.now;

  for (const status of [400, 403, 429]) {
    setup([response(status)]);
    await assert.rejects(generate(), (e) => e.status === status);
    assert.equal(requests.length, 1); assert.deepEqual(delays, []); pass++;
  }
  setup([new TypeError('Failed to fetch')]);
  await assert.rejects(generate(), /Failed to fetch/);
  assert.equal(requests.length, 1); assert.deepEqual(delays, []); pass++;

  setup([response(404), response(503), response(200)]);
  await generate('gemini-2.5-flash');
  assert.equal(requests.length, 3);
  assert.ok(requests.slice(1).every((r) => r.url.includes(DEFAULT_GEMINI_MODEL)));
  assert.deepEqual(delays, [1000]); pass++;
} catch (e) { console.error(e); console.log(`통과 ${pass} / 실패 1`); process.exitCode = 1; }
finally {
  globalThis.fetch = original.fetch; globalThis.setTimeout = original.setTimeout;
  Math.random = original.random; Date.now = original.now;
}
if (!process.exitCode) console.log(`통과 ${pass} / 실패 0`);
