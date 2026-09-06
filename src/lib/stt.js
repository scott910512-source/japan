/* 일본어 음성 인식.
 *
 * 1순위는 Google Cloud Speech-to-Text — TTS와 같은 API 키를 쓴다.
 * MediaRecorder는 iOS에서 AAC로 떨어져 서버가 못 읽으므로, WebAudio로 원시 PCM을
 * 직접 받아 16kHz/16bit로 줄여 보낸다.
 * 키가 없으면 브라우저 내장 SpeechRecognition으로 넘어간다. */

const STT_ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize';

let config = { gttsKey: '', useCloud: true };

export function configureSTT(patch) {
  config = { ...config, ...patch };
}

export function cloudSTTReady() {
  return Boolean(config.useCloud && config.gttsKey && navigator.mediaDevices?.getUserMedia);
}

export function browserSTTSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function sttAvailable() {
  return cloudSTTReady() || browserSTTSupported();
}

/* ── 녹음 상태 ── */

const rec = {
  active: false,
  chunks: null,
  ctx: null,
  proc: null,
  stream: null,
  timer: null,
  spoke: false,
  lastVoice: 0,
  began: 0,
  autoStopped: false,
};

const SILENCE_AFTER_SPEECH_MS = 2500; // 말한 뒤 이만큼 조용하면 끝난 것으로 본다
const NO_SPEECH_TIMEOUT_MS = 7000;    // 아무 말도 없으면 그냥 종료
const HARD_LIMIT_MS = 15000;
const VOICE_RMS = 0.015;

/* 마이크 스트림은 카드마다 새로 열지 않고 한 번 열어 두고 재사용한다.
 * 매번 여닫으면 기기에 따라 권한을 다시 묻거나, 사용자 제스처 없이는 아예 안 열린다.
 * 학습 화면을 나갈 때 releaseMic()으로 실제로 끈다 — 그래야 녹음 표시등도 꺼진다. */
let sharedStream = null;

function streamLive() {
  return sharedStream?.getTracks().some((t) => t.readyState === 'live');
}

export async function acquireMic() {
  if (streamLive()) return sharedStream;
  sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return sharedStream;
}

export function releaseMic() {
  try { sharedStream?.getTracks().forEach((t) => t.stop()); } catch { /* 무시 */ }
  sharedStream = null;
}

// 권한을 이미 받아 뒀는지. 자동으로 켜도 되는지 판단할 때 쓴다.
export function micReady() {
  return streamLive();
}

export async function startRecording(onAutoStop) {
  rec.stream = await acquireMic();
  const AC = window.AudioContext || window.webkitAudioContext;
  rec.ctx = new AC();
  const src = rec.ctx.createMediaStreamSource(rec.stream);
  rec.proc = rec.ctx.createScriptProcessor(4096, 1, 1);
  rec.chunks = [];
  rec.spoke = false;
  rec.autoStopped = false;
  rec.began = Date.now();
  rec.lastVoice = Date.now();

  rec.proc.onaudioprocess = (e) => {
    if (!rec.active) return;
    const data = e.inputBuffer.getChannelData(0);
    rec.chunks.push(new Float32Array(data));

    // 16 샘플마다 훑어 음량을 재고 침묵을 감지한다 — 전부 훑을 필요는 없다
    let sum = 0;
    for (let i = 0; i < data.length; i += 16) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / (data.length / 16));

    const now = Date.now();
    if (rms > VOICE_RMS) { rec.spoke = true; rec.lastVoice = now; }
    if (rec.autoStopped || !onAutoStop) return;

    if (rec.spoke && now - rec.lastVoice > SILENCE_AFTER_SPEECH_MS) {
      rec.autoStopped = true;
      onAutoStop();
    } else if (!rec.spoke && now - rec.began > NO_SPEECH_TIMEOUT_MS) {
      rec.autoStopped = true;
      onAutoStop();
    }
  };

  src.connect(rec.proc);
  rec.proc.connect(rec.ctx.destination);
  rec.active = true;

  rec.timer = setTimeout(() => {
    if (rec.active && !rec.autoStopped && onAutoStop) {
      rec.autoStopped = true;
      onAutoStop();
    }
  }, HARD_LIMIT_MS);
}

export function isRecording() {
  return rec.active;
}

function teardown() {
  rec.active = false;
  clearTimeout(rec.timer);
  try { rec.proc?.disconnect(); } catch { /* 이미 끊겼으면 무시 */ }
  // 스트림은 끄지 않는다 — 다음 카드에서 그대로 다시 쓴다
}

// 녹음을 멈추고 16kHz PCM을 base64로 만든다. 말한 게 없으면 빈 문자열.
function drainPCM() {
  const sampleRate = rec.ctx?.sampleRate || 48000;
  const chunks = rec.chunks || [];
  try { rec.ctx?.close(); } catch { /* 무시 */ }

  let len = 0;
  for (const c of chunks) len += c.length;
  if (!len) return '';

  const all = new Float32Array(len);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }

  const ratio = sampleRate / 16000;
  const n = Math.floor(all.length / ratio);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    pcm[i] = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)])) * 0x7fff;
  }

  let bin = '';
  const bytes = new Uint8Array(pcm.buffer);
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

// hints: 지금 기대되는 문장·단어. 넘겨주면 인식률이 눈에 띄게 올라간다.
export async function stopRecordingAndRecognize(hints = []) {
  if (!rec.active) return '';
  teardown();

  const content = drainPCM();
  if (!content) return '';

  const body = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ja-JP',
      enableAutomaticPunctuation: true,
      model: 'latest_short',
      useEnhanced: true,
    },
    audio: { content },
  };
  if (hints.length) {
    body.config.speechContexts = [{ phrases: hints.slice(0, 40), boost: 12 }];
  }

  // 응답이 없으면 버튼이 "알아듣는 중"에 갇힌다 — 반드시 끊어 준다.
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 12000);

  let res;
  try {
    res = await fetch(`${STT_ENDPOINT}?key=${encodeURIComponent(config.gttsKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(err.name === 'AbortError' ? '응답이 너무 늦어요' : '네트워크에 연결할 수 없어요');
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error?.message) msg += ` — ${err.error.message}`;
    } catch { /* 무시 */ }
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }

  const data = await res.json();
  const alts = data.results?.[0]?.alternatives || [];
  return alts[0]?.transcript || '';
}

export function cancelRecording() {
  if (!rec.active) return;
  teardown();
  try { rec.ctx?.close(); } catch { /* 무시 */ }
}

/* ── 브라우저 내장 인식 (키가 없을 때) ── */

let browserRec = null;

export function listenWithBrowser(onResult, onEnd) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  browserRec = new SR();
  browserRec.lang = 'ja-JP';
  browserRec.interimResults = false;
  browserRec.maxAlternatives = 1;
  browserRec.onresult = (e) => onResult(e.results[0][0].transcript);
  browserRec.onend = () => onEnd();
  browserRec.onerror = (e) => onEnd(e.error);
  browserRec.start();
  return browserRec;
}

export function stopBrowserListening() {
  try { browserRec?.stop(); } catch { /* 무시 */ }
}

/* ── 발음 채점 ──
 * 인식 결과와 정답을 비교한다. 표기 흔들림(가타카나·구두점·띄어쓰기)은 무시하고
 * 글자 단위 편집 거리로 얼마나 가까운지만 본다. 엄밀한 발음 평가가 아니라,
 * "통했는지" 알려주는 용도다. */

import { soundDiff } from './jptext.js';

export function normalizeJa(text) {
  if (!text) return '';
  return text
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)) // 가타카나 → 히라가나
    .replace(/[。、．，!！?？…・「」『』\s]/g, '')
    .trim();
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/* ★ 이건 발음 점수가 아니다 ★
 *
 * 여기서 하는 일은 「음성 인식이 받아 적은 글자」와 「목표 문장」을 견주는
 * 것뿐이다. 발음이 좋은지 억양이 맞는지는 보지 않는다 — 볼 수단이 없다.
 * 그런데 이름이 scoreSpeech이고 0~1짜리 score를 돌려주니, 화면이 그걸
 * 「발음 85점」처럼 보여 주게 된다. 그건 없는 능력을 있다고 말하는 것이다.
 *
 * 그래서 「인식 결과」라고 부른다. 돌려주는 것도 점수가 아니라
 *   match   글자가 얼마나 겹쳤나 (인식 정확도이지 발음 점수가 아니다)
 *   verdict same | near | differ | none
 *   diff    의미가 달라지는 차이가 있으면 무엇인지
 *
 * 인식이 아예 안 됐을 때(none)는 틀린 게 아니다. 마이크·소음·브라우저 문제일
 * 수 있어서, 학습자의 오답으로 기록하면 안 된다. */
export function recognizeResult(said, expectedList) {
  const heard = normalizeJa(said);
  if (!heard) return { match: 0, verdict: 'none', heard: '', target: '' };

  let best = 0;
  let bestDist = Infinity;
  let bestLen = 0;
  let bestTarget = '';

  for (const exp of (expectedList || []).filter(Boolean)) {
    const target = normalizeJa(exp);
    if (!target) continue;
    const dist = editDistance(heard, target);
    const m = Math.max(0, 1 - dist / Math.max(heard.length, target.length));
    if (m > best) { best = m; bestDist = dist; bestLen = target.length; bestTarget = exp; }
  }

  /* 비율만 보면 긴 문장에서 한 글자 틀린 것도 같은 말이 된다.
     낱말은 정확히 맞아야 하고, 긴 문장은 인식 오차를 한 글자까지 봐준다. */
  const same = bestDist === 0 || (bestDist <= 1 && bestLen >= 12);

  /* 의미가 달라지는 차이는 「거의 맞음」으로 넘기면 안 된다.
     장음·촉음이 다르면 다른 낱말이고, 부정이나 수가 다르면 뜻이 뒤집힌다. */
  const diff = same ? null : soundDiff(bestTarget, said);
  const flipped = !same && sensesFlip(heard, normalizeJa(bestTarget));

  const verdict = same ? 'same' : (diff || flipped) ? 'differ' : best >= 0.6 ? 'near' : 'differ';
  return { match: best, verdict, heard: said, target: bestTarget, diff, flipped };
}

/* 부정·수량처럼 뜻이 뒤집히는 차이인가 */
function sensesFlip(a, b) {
  const neg = (s) => /ない|ません|ぬ$|なく/.test(s);
  if (neg(a) !== neg(b)) return true;
  const num = (s) => (s.match(/[0-9０-９]|ひとつ|ふたつ|みっつ|いち|に|さん|よん|ご/) || [])[0] || '';
  return num(a) !== num(b);
}

/* 옛 이름 — 부르는 곳이 남아 있어 이어 준다.
   새로 쓰는 곳은 recognizeResult를 쓴다. */
export function scoreSpeech(said, expectedList) {
  const r = recognizeResult(said, expectedList);
  const verdict = r.verdict === 'same' ? 'good' : r.verdict === 'near' ? 'close' : r.verdict === 'none' ? 'none' : 'off';
  return { ...r, score: r.match, verdict };
}
