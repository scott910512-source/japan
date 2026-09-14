/* 독일어 소리 — 목소리 고르기 · 목록 기다리기 · 겹침 · 읽는 중 알림.
 *
 * ★ 목소리는 첫 번째 것을 집지 않는다 ★
 * getVoices()의 첫 항목은 대개 영어다. 독일어 locale을 차례로 찾아야 한다.
 *   표준 독일어: de-DE → de-AT → de-CH → de-* → 없으면 lang만
 *   스위스 팁:   de-CH → de-DE → de-AT → de-*
 *
 * 그리고 셋. 목록이 아직 안 왔으면 voiceschanged를 잠깐 기다리고, 다른 문장을
 * 누르면 앞 것은 끊기며(약속이 「끊김」으로 끝난다), 읽는 중인지 알린다 —
 * 🔊 버튼이 그걸로 켜졌다 꺼진다. */

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* ── 기기 흉내 ── */
const spoken = [];
let voices = [];
const listeners = {};
class Utter { constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; } }
globalThis.SpeechSynthesisUtterance = Utter;
globalThis.Audio = class { constructor() { this.dataset = {}; this.currentTime = 0; } play() { return Promise.resolve(); } pause() {} };
const synth = {
  getVoices: () => voices,
  cancel: () => {},
  speak: (u) => { spoken.push(u); setTimeout(() => u.onstart?.(), 5); setTimeout(() => u.onend?.(), 60); },
  addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  onvoiceschanged: null,
};
const fireVoicesChanged = () => { synth.onvoiceschanged?.(); for (const fn of [...(listeners.voiceschanged || [])]) fn(); };
globalThis.window = { speechSynthesis: synth };
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
globalThis.fetch = () => Promise.reject(new Error('클라우드 없음'));

const tts = await import('../../src/lib/tts.js');
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const V = (lang, name = lang) => ({ lang, name, voiceURI: name });

console.log('\n[ ★ 독일어 목소리 고르기 — 첫 번째를 집지 않는다 ★ ]');
{
  const list = [V('en-US', 'Samantha'), V('ko-KR', 'Yuna'), V('de-CH', 'Petra'), V('de-AT', 'Michael'), V('de-DE', 'Anna')];
  ok('★ 표준 독일어는 de-DE ★', tts.pickVoice('de-DE', list)?.lang === 'de-DE', tts.pickVoice('de-DE', list)?.name);
  ok('★ 스위스 팁은 de-CH ★', tts.pickVoice('de-CH', list)?.lang === 'de-CH', tts.pickVoice('de-CH', list)?.name);
  ok('영어가 첫 자리여도 안 집는다', tts.pickVoice('de-DE', list)?.lang !== 'en-US');

  const noDE = [V('en-US'), V('de-AT', 'Michael'), V('de-CH', 'Petra')];
  ok('de-DE가 없으면 de-AT', tts.pickVoice('de-DE', noDE)?.lang === 'de-AT');
  const onlyCH = [V('en-US'), V('de-CH', 'Petra')];
  ok('그것도 없으면 de-CH', tts.pickVoice('de-DE', onlyCH)?.lang === 'de-CH');
  const generic = [V('en-US'), V('de', 'Generic')];
  ok('de 계열이면 그거라도', tts.pickVoice('de-DE', generic)?.lang === 'de');
  ok('독일어가 하나도 없으면 없다고 한다 (lang만 맞춰 기기에 맡긴다)', tts.pickVoice('de-DE', [V('en-US'), V('ja-JP')]) === null);

  /* 스위스 팁: de-CH가 없으면 de-DE로 */
  const noCH = [V('en-US'), V('de-AT', 'Michael'), V('de-DE', 'Anna')];
  ok('★ 팁에 de-CH가 없으면 de-DE ★', tts.pickVoice('de-CH', noCH)?.lang === 'de-DE');

  /* 'de_DE'·소문자로 적는 브라우저 */
  const odd = [V('en_US'), V('de_DE', 'Odd')];
  ok('밑줄·대소문자가 달라도 찾는다', tts.pickVoice('de-DE', odd)?.name === 'Odd');
  ok('차례가 문서와 같다', tts.germanVoiceOrder('de-DE').join(',') === 'de-de,de-at,de-ch' && tts.germanVoiceOrder('de-CH').join(',') === 'de-ch,de-de,de-at');
}

console.log('\n[ 실제로 넘길 때 ]');
{
  voices = [V('en-US', 'Samantha'), V('de-AT', 'Michael'), V('de-DE', 'Anna')];
  fireVoicesChanged();
  spoken.length = 0;
  const how = await tts.speakIn('Guten Tag', 'de-DE', 0.9, { id: 'a' });
  ok('기기 음성으로 끝난다', how === 'device', how);
  ok('lang은 de-DE', spoken[0]?.lang === 'de-DE', spoken[0]?.lang);
  ok('★ 목소리는 de-DE (첫 번째 영어가 아니라) ★', spoken[0]?.voice?.lang === 'de-DE', spoken[0]?.voice?.name);
  ok('넘긴 글자는 독일어뿐', spoken[0]?.text === 'Guten Tag' && !/[가-힣]/.test(spoken[0]?.text));

  spoken.length = 0;
  await tts.speakIn('Grüezi', 'de-CH', 0.9, { id: 'b' });
  ok('★ 스위스 팁은 de-CH가 없으면 de-DE 목소리로 ★', spoken[0]?.lang === 'de-CH' && spoken[0]?.voice?.lang === 'de-DE',
    `${spoken[0]?.lang} / ${spoken[0]?.voice?.lang}`);
}

console.log('\n[ ★ 목록이 아직 안 왔으면 잠깐 기다린다 ★ ]');
{
  voices = [];
  fireVoicesChanged();   // 캐시를 비운다
  spoken.length = 0;
  const p = tts.speakIn('Danke', 'de-DE', 0.9, { id: 'c' });
  await wait(50);
  ok('목록이 비었을 땐 아직 안 넘긴다', spoken.length === 0, `${spoken.length}`);
  voices = [V('en-US'), V('de-DE', 'Anna')];
  fireVoicesChanged();   // 이제 목록이 왔다
  await p;
  ok('★ 목록이 오면 그 목소리로 넘긴다 ★', spoken[0]?.voice?.lang === 'de-DE', spoken[0]?.voice?.name);
}

console.log('\n[ ★ 연속으로 누르면 앞 것은 끊긴다 ★ ]');
{
  voices = [V('de-DE', 'Anna')];
  fireVoicesChanged();
  spoken.length = 0;
  const states = [];
  const off = tts.onSpeaking((s) => states.push(`${s.id}:${s.active ? 'on' : 'off'}`));
  const first = tts.speakIn('Eins', 'de-DE', 0.9, { id: 'x' });
  const second = tts.speakIn('Zwei', 'de-DE', 0.9, { id: 'y' });
  const h1 = await first;
  const h2 = await second;
  off();
  ok('★ 앞 것은 「끊김」으로 끝난다 ★', h1 === 'interrupted', h1);
  ok('뒤 것은 끝까지 난다', h2 === 'device', h2);
  ok('★ 실제로 넘어간 건 뒤 것 하나 ★', spoken.length === 1 && spoken[0].text === 'Zwei', spoken.map((u) => u.text).join(','));
  ok('읽는 중 알림이 켜졌다 꺼진다', states[0] === 'x:on' && states.includes('x:off') && states.includes('y:on') && states.at(-1) === 'y:off', states.join(' '));
}

console.log('\n[ 빈 글은 안 넘긴다 ]');
{
  spoken.length = 0;
  const how = await tts.speakIn('', 'de-DE');
  ok('빈 글은 바로 끝', how === 'empty' && spoken.length === 0);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
