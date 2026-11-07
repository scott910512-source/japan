/* Cloud playback must finish at ended, rather than when play() starts. */
import assert from 'node:assert/strict';
class FakeAudio extends EventTarget {
  constructor() { super(); this.dataset = {}; this.src = ''; this.paused = true; this.ended = false; this.error = null; FakeAudio.current = this; }
  play() { if (FakeAudio.rejectNext) { FakeAudio.rejectNext = false; return Promise.reject(new Error('play failed')); } this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
globalThis.Audio = FakeAudio;
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
const deviceSpoke = [];
globalThis.window = { speechSynthesis: { getVoices: () => [], cancel() {}, speak(u) { deviceSpoke.push(u.text); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 10); } } };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ audioContent: 'mock-audio' }) });
const { configureTTS, speakJapaneseAsync, stopSpeaking, onSpeaking, unlockAudio } = await import('../../src/lib/tts.js');
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

  /* ★ AI 음성이 나오는 중에 화면 어디를 눌러도(열기 시도) 소리가 끊기거나 기기 음성이 같은 문장을 다시 읽지 않는다 ★ */
  deviceSpoke.length = 0;
  const playing = speakJapaneseAsync('ながれているあいだ。'); await tick();
  const realSrc = FakeAudio.current.src;
  unlockAudio();                                   // 다른 곳을 눌렀을 때 불리는 것
  assert.equal(FakeAudio.current.src, realSrc, '재생 중인 파일을 무음 파일로 갈아 끼우면 안 된다'); pass++;
  FakeAudio.current.dispatchEvent(new Event('ended'));
  assert.equal(await playing, 'cloud'); pass++;
  assert.equal(deviceSpoke.length, 0, '기기 음성이 울리면 안 된다'); pass++;
  assert.equal(FakeAudio.current.dataset.unlocked, '1', '진짜 소리가 났으면 열린 것으로 친다'); pass++;

  /* 같은 엘리먼트를 쓰는 다른 파일이 뒤늦게 보내는 오류는 우리 소리의 실패가 아니다 */
  deviceSpoke.length = 0;
  const stale = speakJapaneseAsync('늦은오류무시。'); await tick();
  FakeAudio.current.error = null;
  FakeAudio.current.dispatchEvent(new Event('error'));        // 오류 정보가 없는(다른 파일의) 기별
  await tick();
  assert.equal(deviceSpoke.length, 0, '남의 오류로 기기 음성이 울리면 안 된다'); pass++;
  FakeAudio.current.dispatchEvent(new Event('ended'));
  assert.equal(await stale, 'cloud'); pass++;

  /* 진짜 재생 오류는 그대로 기기 음성으로 넘어간다 */
  const broken = speakJapaneseAsync('진짜오류。'); await tick();
  FakeAudio.current.error = { code: 4 };
  FakeAudio.current.dispatchEvent(new Event('error'));
  assert.equal(await broken, 'device'); pass++;
} catch (e) { console.error(e); console.log(`통과 ${pass} / 실패 1`); process.exit(1); }
console.log(`통과 ${pass} / 실패 0`); process.exit(0);
