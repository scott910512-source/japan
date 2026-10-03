/* 달리기 박자 — 듣기와 같이 흐르는 메트로놈.
 *
 * ★ 왜 듣기 화면에 박자가 붙나 ★
 *
 * 이 화면은 손이 안 비는 시간에 쓰라고 만든 자리다. 걷는 중, 지하철, 설거지.
 * 달리기도 그중 하나인데, 달릴 때는 귀가 두 가지를 동시에 받는다 — 외우려는
 * 일본어와, 발을 맞출 박자다. 둘을 다른 앱으로 틀면 한쪽이 다른 쪽을 끊는다
 * (특히 iOS는 뒤에서 나는 소리를 하나로 줄이려 든다).
 *
 * 160·170·180은 달리기 피치(분당 걸음 수)다. 170~180은 발이 땅에 닿는 시간을
 * 줄여 주고, 160은 몸을 푸는 쪽이다. 그래서 세 칸만 둔다 — 1씩 고르게 하면
 * 달리면서 못 맞춘다.
 *
 * ★ 말소리와 안 싸우게 ★
 *
 * 음성(speechSynthesis)과 Web Audio는 다른 길이라 같이 난다. 다만 소리 크기를
 * 낮게 둔다 — 박자가 일본어를 덮으면 둘 다 못 듣는다. 네 박자마다 한 번만
 * 높은 소리를 내서, 소리가 작아도 어디가 첫 박인지 알게 한다.
 *
 * ★ 시간은 setInterval로 재지 않는다 ★
 *
 * setInterval은 화면이 꺼지면 늦어지거나 멈춘다. 그러면 박자가 흔들리는데,
 * 흔들리는 박자는 없느니만 못하다 — 발이 그걸 따라가려다 리듬을 잃는다.
 * 그래서 소리는 오디오 시계에 미리 예약한다. 예약을 거는 일(틱)만 타이머가
 * 하고, 한 번에 앞으로 1.5초치를 걸어 둔다. 타이머가 한 번 늦어도 이미 걸어
 * 둔 소리는 제때 난다.
 *
 * 시간 계산은 소리와 떼어 두었다 — 브라우저 없이 검사할 수 있어야 「느려진
 * 타이머」 같은 걸 눌러 보지 않고도 지킬 수 있다. */

/* 달리기 피치. 세 칸뿐인 이유는 위에. */
export const BPMS = [160, 170, 180];
export const DEFAULT_BPM = 170;

/* 몇 박자마다 센 소리를 낼까. 네 박이면 왼발-오른발 두 쌍이라 발에 붙는다. */
export const ACCENT_EVERY = 4;

/* 앞으로 얼마치를 미리 걸어 둘까(초). 길수록 타이머가 늦어져도 버티고,
   짧을수록 박자를 바꿨을 때 빨리 반영된다. 1.5초면 170bpm에서 네 박이다. */
export const LOOKAHEAD = 1.5;

/* 예약을 거는 간격(초). 미리 걸어 두는 길이보다 충분히 짧아야 빈틈이 안 생긴다. */
export const TICK = 0.25;

export function clampBpm(bpm) {
  const n = Math.round(Number(bpm) || DEFAULT_BPM);
  return Math.min(240, Math.max(40, n));
}

export function beatInterval(bpm) {
  return 60 / clampBpm(bpm);
}

/* 이번 틱에서 걸어야 할 박자들.
 *
 *   cursor  다음에 울릴 시각(오디오 시계 기준)
 *   now     지금 시각
 *   count   여태 울린 박자 수 — 몇 번째가 센 박인지 세는 데 쓴다
 *
 * 돌려주는 것: { beats: [{ at, accent }], cursor, count }
 *
 * ★ 밀린 박자는 버린다 ★
 * 화면이 꺼져 타이머가 3초 늦게 돌아오면, 지나간 박자가 여덟 개 쌓여 있다.
 * 그걸 다 울리면 「따다다다닥」 하고 한꺼번에 터진다 — 달리는 사람에게는
 * 박자가 아니라 사고다. 지나간 것은 버리고 지금부터 다시 맞춘다. */
export function dueBeats(cursor, now, bpm, count = 0, lookahead = LOOKAHEAD) {
  const step = beatInterval(bpm);
  let at = cursor;
  let n = count;

  // 지나간 박자는 버리고 현재로 당긴다
  if (at < now) {
    const missed = Math.ceil((now - at) / step);
    at += missed * step;
    n += missed;
  }

  const beats = [];
  const until = now + lookahead;
  /* 한 틱에 거는 수를 막아 둔다. bpm을 아주 크게 넣거나 lookahead를 길게
     잡으면 수백 개가 한 번에 걸린다 — 그건 소리가 아니라 잡음이다. */
  while (at <= until && beats.length < 64) {
    beats.push({ at, accent: n % ACCENT_EVERY === 0 });
    at += step;
    n += 1;
  }
  return { beats, cursor: at, count: n };
}

/* 다음 박자 칸. 달리면서 한 손가락으로 돌리는 자리라 끄기까지 한 바퀴다.
   null이면 꺼짐. */
export function nextBpm(cur) {
  if (cur == null) return BPMS[0];
  const i = BPMS.indexOf(clampBpm(cur));
  if (i < 0) return BPMS[0];
  return i + 1 < BPMS.length ? BPMS[i + 1] : null;
}

/* ── 소리 ──
 *
 * 여기부터는 브라우저가 필요하다. 위의 계산과 갈라 둔 이유가 그것이다. */

let ctx = null;
let timer = null;
let state = null;   // { bpm, cursor, count, gain }

function audio() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

/* 딱 소리 하나. 짧고 마른 소리여야 발에 붙는다 — 길게 울리면 어디가 박자인지
   흐려진다. 센 박은 한 옥타브 위로 올려서, 소리가 작아도 구별된다. */
function click(at, accent, volume) {
  const c = ctx;
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1600 : 1000;
  /* 소리를 세웠다 바로 줄인다. 네모파를 그냥 켜고 끄면 「퍽」 하는 잡음이
     같이 난다(파형이 0이 아닌 데서 끊겨서). */
  const v = Math.max(0, Math.min(1, volume)) * (accent ? 1 : 0.65);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.06);
}

function tick() {
  if (!state || !ctx) return;
  const got = dueBeats(state.cursor, ctx.currentTime, state.bpm, state.count);
  for (const b of got.beats) click(b.at, b.accent, state.gain);
  state.cursor = got.cursor;
  state.count = got.count;
}

/* 박자를 시작한다. 이미 돌고 있으면 빠르기만 바꾼다 — 끊고 다시 시작하면
   첫 박이 어긋나서, 달리는 중에 발이 한 번 꼬인다.
   볼륨 기본값이 낮은 이유는 위에(말소리를 덮으면 둘 다 못 듣는다). */
export function startBeat(bpm, { volume = 0.1 } = {}) {
  const c = audio();
  if (!c) return false;
  c.resume?.().catch(() => {});
  if (state) {
    state.bpm = clampBpm(bpm);
    state.gain = volume;
    return true;
  }
  state = { bpm: clampBpm(bpm), cursor: c.currentTime + 0.12, count: 0, gain: volume };
  tick();
  timer = setInterval(tick, TICK * 1000);
  return true;
}

export function stopBeat() {
  clearInterval(timer);
  timer = null;
  state = null;
  /* 컨텍스트는 안 닫는다. 닫으면 다시 켤 때 새로 만들어야 하고, iOS는 그때
     또 사용자 제스처를 요구한다 — 달리다가 켠 박자가 안 나는 쪽이 더 나쁘다. */
  ctx?.suspend?.().catch(() => {});
}

export function beatRunning() {
  return Boolean(state);
}

/* 검사에서 쓰려고 열어 둔다 — 소리 쪽을 눌러 보지 않고 상태만 확인한다. */
export function beatState() {
  return state ? { bpm: state.bpm, count: state.count } : null;
}
