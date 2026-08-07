/* 일본어 음성 재생.
 * 1순위는 Google Cloud TTS(기존 여행 RPG 앱에서 쓰던 API 키를 그대로 승계해서 사용),
 * 키가 없거나 호출이 실패하면 브라우저 내장 speechSynthesis로 자동 폴백한다. */

const GTTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_VOICE = 'ja-JP-Neural2-B';

let config = { gttsKey: '', useCloud: true, voice: DEFAULT_VOICE };

// 같은 문장은 다시 부르지 않는다 — 무료 한도를 아끼기 위한 메모리 캐시.
const cloudCache = new Map();
let audioEl = null;
let cloudDisabled = false; // 키가 잘못된 경우 매번 재시도하지 않도록 잠근다
let lastText = '';
let onCloudError = null;

export function configureTTS(patch) {
  const prevKey = config.gttsKey;
  config = { ...config, ...patch };
  if (config.gttsKey !== prevKey) {
    cloudDisabled = false;
    cloudCache.clear();
  }
}

export function setTTSErrorHandler(fn) {
  onCloudError = fn;
}

export function cloudTTSReady() {
  return Boolean(config.useCloud && config.gttsKey && !cloudDisabled);
}

/* ── 브라우저 내장 음성 ── */

let cachedVoice = null;

function pickJapaneseVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices() || [];
  cachedVoice = voices.find((v) => v.lang?.startsWith('ja')) || null;
  return cachedVoice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
  };
}

function speakLocal(text, rate) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = rate;
  const voice = pickJapaneseVoice();
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

/* ── Google Cloud TTS ── */

// iOS는 사용자 제스처 없이 만든 audio 엘리먼트로는 재생을 막는다.
// 첫 탭에서 한 번 언락해 두고 같은 엘리먼트를 계속 재사용한다.
function getAudioEl() {
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

let localUnlocked = false;

export function audioUnlocked() {
  return localUnlocked && Boolean(audioEl?.dataset?.unlocked);
}

// 첫 사용자 제스처에서 호출한다. 성공할 때까지 계속 다시 불러도 된다.
export function unlockAudio() {
  const a = getAudioEl();
  if (!a.dataset.unlocked) {
    a.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA';
    a.play().then(
      () => { a.dataset.unlocked = '1'; },
      () => { /* 아직 제스처가 아니면 다음 탭에서 다시 시도 */ },
    );
  }

  // iOS는 speechSynthesis도 첫 발화가 사용자 제스처 안에서 나와야
  // 이후 자동 재생을 허용한다. 소리 없는 발화로 미리 열어 둔다.
  if (!localUnlocked && typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      const warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0;
      warm.lang = 'ja-JP';
      window.speechSynthesis.speak(warm);
      localUnlocked = true;
    } catch { /* 다음 제스처에서 다시 시도 */ }
  }
}

/* 지금 음성이 어떤 경로로 나가는지. 설정 화면에서 원인을 보여줄 때 쓴다. */
export function ttsStatus() {
  const voices = (typeof window !== 'undefined' && window.speechSynthesis?.getVoices()) || [];
  const jaVoices = voices.filter((v) => v.lang?.startsWith('ja'));
  if (cloudTTSReady()) return { mode: 'cloud', jaVoices: jaVoices.length, unlocked: localUnlocked };
  if (jaVoices.length > 0) return { mode: 'device', jaVoices: jaVoices.length, unlocked: localUnlocked };
  // 목록이 비어 있어도 실제로는 소리가 나는 기기가 있어 단정하지 않는다
  return { mode: voices.length ? 'device-nojp' : 'unknown', jaVoices: 0, unlocked: localUnlocked };
}

async function requestCloud(text, rate, withRate) {
  const audioConfig = { audioEncoding: 'MP3' };
  if (withRate && rate !== 1) audioConfig.speakingRate = rate;

  const res = await fetch(`${GTTS_ENDPOINT}?key=${encodeURIComponent(config.gttsKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ja-JP', name: config.voice || DEFAULT_VOICE },
      audioConfig,
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) msg += ` — ${body.error.message}`;
    } catch { /* 본문 파싱 실패는 무시 */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return (await res.json()).audioContent;
}

async function speakCloud(text, rate) {
  const cacheKey = `${text}|${rate}|${config.voice}`;
  let b64 = cloudCache.get(cacheKey);

  if (!b64) {
    try {
      b64 = await requestCloud(text, rate, true);
    } catch (err) {
      // 일부 보이스는 speakingRate를 받지 않는다 → 속도 옵션 없이 1회만 재시도
      if (err.status === 400 && rate !== 1) b64 = await requestCloud(text, rate, false);
      else throw err;
    }
    if (!b64) throw new Error('빈 응답');
    if (cloudCache.size > 300) cloudCache.clear();
    cloudCache.set(cacheKey, b64);
  }

  const a = getAudioEl();
  a.src = `data:audio/mp3;base64,${b64}`;
  await a.play();
}

/* ── 공개 API ── */

export function speakJapanese(text, rate = 0.9) {
  if (!text) return;
  lastText = text;

  if (!cloudTTSReady()) {
    speakLocal(text, rate);
    return;
  }

  speakCloud(text, rate).catch((err) => {
    // 인증·권한 오류는 키 문제이므로 잠그고 알린다. 그 외는 조용히 폴백만 한다.
    if (err.status === 400 || err.status === 401 || err.status === 403) {
      cloudDisabled = true;
      onCloudError?.(`클라우드 음성을 쓸 수 없어 기기 음성으로 재생해요 (${err.message})`);
    }
    speakLocal(text, rate);
  });
}

export function speakSlow(text) {
  speakJapanese(text ?? lastText, 0.7);
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* 무시 */ }
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
}

// 설정 화면에서 키를 확인할 때 쓴다. 성공하면 재생까지 한다.
export async function testCloudTTS(key, voice = DEFAULT_VOICE) {
  const prev = config;
  config = { ...config, gttsKey: key, voice, useCloud: true };
  cloudDisabled = false;
  try {
    await speakCloud('こんにちは', 1);
    return { ok: true };
  } catch (err) {
    config = prev;
    return { ok: false, message: err.message };
  }
}
