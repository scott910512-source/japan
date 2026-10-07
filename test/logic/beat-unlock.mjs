/* 달리기 박자 — iOS에서 소리가 나려면.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 삿포로를 들을 때는 박자가 났고 기출을 고를 때는 안 났다. 둘의 차이는
 * 범위가 아니라 「누가 켰나」였다. 처음엔 달리다가 손으로 켰고(제스처),
 * 다음엔 설정에 켜진 채로 재생을 시작했다(화면의 효과). iOS는 제스처 밖에서
 * 만든·깨운 AudioContext로는 소리를 안 낸다 — 버튼은 「170 BPM」인데 조용하다.
 *
 * 그래서 셋을 지킨다.
 *   · 제스처 자리에서 부르는 unlockBeat이 컨텍스트를 깨운다
 *   · 돌고 있는데 컨텍스트가 멈추면(말소리가 끼어든 iOS) 틱이 깨운다
 *   · 그래도 안 깨어나면 다음 터치에서 다시 깨운다
 *
 * 브라우저 없이 본다 — 가짜 AudioContext로 「resume이 불렸나」만 센다. */

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 가짜 AudioContext — iOS처럼 「suspended」로 태어나고 resume으로만 깨어난다.
   suspend()로 끼어듦을 흉내 낸다. */
class FakeAC {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = {};
    this.resumes = 0;
    this.buffers = 0;
    this.listeners = {};
    FakeAC.last = this;
  }
  addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); }
  fire(k) { for (const fn of this.listeners[k] || []) fn(); }
  resume() { this.resumes += 1; this.state = 'running'; this.fire('statechange'); return Promise.resolve(); }
  suspend() { this.state = 'interrupted'; this.fire('statechange'); return Promise.resolve(); }
  createBuffer() { this.buffers += 1; return {}; }
  createBufferSource() { return { connect() {}, start() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
}

const docListeners = {};
globalThis.window = { AudioContext: FakeAC };
globalThis.document = {
  addEventListener: (k, fn) => { (docListeners[k] ||= []).push(fn); },
  removeEventListener: (k, fn) => { docListeners[k] = (docListeners[k] || []).filter((f) => f !== fn); },
};
const touch = () => { for (const fn of [...(docListeners.pointerdown || [])]) fn(); };

const { beatAudioState, beatRunning, startBeat, stopBeat, unlockBeat } = await import('../../src/lib/metronome.js');
const tickWait = () => new Promise((r) => setTimeout(r, 300));

console.log('\n[ 제스처에서 깨운다 ]');
{
  ok('처음엔 컨텍스트가 없다', beatAudioState() === null);
  ok('unlockBeat이 컨텍스트를 만들고 깨운다', unlockBeat() === true && beatAudioState() === 'running');
  ok('빈 소리를 한 번 낸다 — 옛 iOS가 그래야 풀린다', FakeAC.last.buffers === 1);
  ok('resume이 불렸다', FakeAC.last.resumes === 1);
}

console.log('\n[ 효과에서 켜도 돌아는 간다 ]');
{
  const ac = FakeAC.last;
  ac.state = 'suspended';
  ok('박자를 켠다', startBeat(170) === true && beatRunning());
  ok('켤 때도 깨우려고 한다', ac.resumes >= 2 && ac.state === 'running', `${ac.resumes}번`);
}

console.log('\n[ ★ 말소리가 끼어들어 멈추면 틱이 깨운다 ★ ]');
{
  const ac = FakeAC.last;
  const before = ac.resumes;
  await ac.suspend();                       // iOS: 「interrupted」
  ok('멈췄다', ac.state !== 'running' || ac.resumes > before);
  await tickWait();
  ok('★ 틱이 다시 깨웠다 ★', ac.state === 'running' && ac.resumes > before, `${ac.resumes - before}번 더`);
}

console.log('\n[ 그래도 안 깨어나면 다음 터치에서 ]');
{
  const ac = FakeAC.last;
  /* resume이 먹히지 않는 iOS를 흉내 낸다 — 상태가 그대로다 */
  ac.resume = function () { this.resumes += 1; return Promise.resolve(); };
  ac.state = 'interrupted';
  ac.fire('statechange');
  await tickWait();
  ok('터치를 기다리는 귀가 걸려 있다', (docListeners.pointerdown || []).length === 1);
  const before = ac.resumes;
  /* 이번 터치는 먹힌다 */
  ac.resume = function () { this.resumes += 1; this.state = 'running'; return Promise.resolve(); };
  touch();
  ok('★ 터치에서 깨어난다 ★', ac.state === 'running' && ac.resumes > before);
  ok('귀는 한 번 쓰고 뗀다', (docListeners.pointerdown || []).length === 0);
}

console.log('\n[ 터치를 기다리는 동안은 더 안 건다 ]');
{
  const ac = FakeAC.last;
  ac.resume = function () { this.resumes += 1; return Promise.resolve(); };   // 안 먹는 iOS
  ac.state = 'interrupted';
  ac.fire('statechange');
  const before = ac.resumes;
  await tickWait(); await tickWait(); await tickWait();
  ok('★ 긴 끼어듦에도 resume이 쌓이지 않는다 ★', ac.resumes - before <= 1, `${ac.resumes - before}번`);
  /* 아예 안 거는 것도 아니다 — 앱 자신의 말소리 때문에 멈춘 것은 말이 끝나면
     resume이 먹는데, 안 걸면 폰을 꺼내 만질 때까지 박자가 없다. 3초에 한 번. */
  await new Promise((r) => setTimeout(r, 3300));
  ok('터치를 기다리는 동안에도 천천히는 다시 건다', ac.resumes - before >= 1, `${ac.resumes - before}번`);
  ac.resume = function () { this.resumes += 1; this.state = 'running'; return Promise.resolve(); };
  touch();
  ok('터치로 깨어난다', ac.state === 'running');
}

console.log('\n[ 꺼지면 깨우지 않는다 ]');
{
  const ac = FakeAC.last;
  stopBeat();
  ok('박자가 꺼졌다', !beatRunning());
  ac.state = 'interrupted';
  const before = ac.resumes;
  ac.fire('statechange');
  await tickWait();
  ok('꺼진 뒤의 멈춤은 그냥 둔다 — 안 쓰는 소리를 깨우지 않는다', ac.resumes === before);
  ok('터치 귀도 안 건다', (docListeners.pointerdown || []).length === 0);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
