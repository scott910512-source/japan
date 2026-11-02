/* Cloud playback must finish at ended, rather than when play() starts. */
import assert from 'node:assert/strict';
class FakeAudio extends EventTarget {
  constructor() { super(); this.dataset = {}; FakeAudio.current = this; }
  play() { if (FakeAudio.rejectNext) { FakeAudio.rejectNext = false; return Promise.reject(new Error('play failed')); } return Promise.resolve(); }
  pause() {}
}
globalThis.Audio = FakeAudio;
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.window = { speechSynthesis: { getVoices: () => [], cancel() {}, speak(u) { setTimeout(() => { u.onstart?.(); u.onend?.(); }, 10); } } };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ audioContent: 'mock-audio' }) });
const { configureTTS, speakJapaneseAsync, stopSpeaking, onSpeaking } = await import('../../src/lib/tts.js');
configureTTS({ useCloud: true, gttsKey: 'TEST-NOT-A-REAL-KEY' });
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
let pass = 0;
try {
  let settled = false;
  const first = speakJapaneseAsync('はじめのぶんです。').then((r) => { settled = true; return r; });
  await tick();
  assert.equal(settled, false, 'play() resolves at the start; audio must still be playing'); pass++;
  FakeAudio.current.dispatchEvent(new Event('ended'));
  assert.equal(await first, 'cloud'); pass++;

  const notifications = []; const off = onSpeaking((event) => notifications.push(event));
  const interrupted = speakJapaneseAsync('とちゅうでとめます。', 0.9, { id: 'stop-test' });
  await tick(); stopSpeaking();
  assert.equal(await interrupted, 'interrupted'); pass++;
  FakeAudio.current.dispatchEvent(new Event('ended'));
  assert.equal(notifications.filter((event) => event.id === 'stop-test' && !event.active).length, 1); pass++;
  off();

  const old = speakJapaneseAsync('ふるいおと。'); await tick();
  const next = speakJapaneseAsync('あたらしいおと。'); await tick();
  assert.equal(await old, 'interrupted'); pass++;
  FakeAudio.current.dispatchEvent(new Event('ended'));
  assert.equal(await next, 'cloud'); pass++;

  FakeAudio.rejectNext = true;
  assert.equal(await speakJapaneseAsync('ききおんせいにきりかえ。'), 'device'); pass++;
} catch (e) { console.error(e); console.log(`통과 ${pass} / 실패 1`); process.exit(1); }
console.log(`통과 ${pass} / 실패 0`); process.exit(0);
