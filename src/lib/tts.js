/* 일본어 음성 재생.
 * 1순위는 Google Cloud TTS(기존 여행 RPG 앱에서 쓰던 API 키를 그대로 승계해서 사용),
 * 키가 없거나 호출이 실패하면 브라우저 내장 speechSynthesis로 자동 폴백한다. */

import { addChars } from './usage.js';

const GTTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_VOICE = 'ja-JP-Neural2-B';
let deviceVoiceURI = '';   // 기기 내장 음성 중 사용자가 고른 것

let config = { gttsKey: '', useCloud: true, voice: DEFAULT_VOICE };

// 같은 문장은 다시 부르지 않는다 — 무료 한도를 아끼기 위한 메모리 캐시.
const cloudCache = new Map();
let audioEl = null;

/* 재생 세대 번호.
 * 클라우드 음성은 "요청 → 응답 → 재생" 사이에 시간이 걸린다. 그 사이에 다음 소리가
 * 시작되면, 늦게 도착한 예전 응답이 뒤늦게 울리거나 — 우리가 끊어서 생긴 중단 오류가
 * 실패로 오인돼 기기 음성 폴백까지 울린다. 그래서 두 번 들렸다.
 * 번호를 매겨 두고, 자기 차례가 지난 요청은 소리를 내지 않는다. */
let speakToken = 0;
let cloudDisabled = false; // 키가 잘못된 경우 매번 재시도하지 않도록 잠근다
let lastText = '';
let onCloudError = null;

export function configureTTS(patch) {
  const prevKey = config.gttsKey;
  const prevVoice = config.voice;
  if (patch.deviceVoiceURI !== undefined) deviceVoiceURI = patch.deviceVoiceURI || '';
  config = { ...config, ...patch };
  // 목소리를 바꿨으면 예전 목소리로 받아 둔 캐시를 쓰면 안 된다
  if (config.voice !== prevVoice) cloudCache.clear();
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
let cachedKoVoice = null;   // 뜻을 읽어 줄 한국어 음성

function pickJapaneseVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  // 고른 음성이 있으면 그것을, 없거나 기기에서 사라졌으면 아무 일본어 음성이나
  if (deviceVoiceURI) {
    const chosen = voices.find((v) => v.voiceURI === deviceVoiceURI);
    if (chosen) return chosen;
  }
  if (cachedVoice && voices.includes(cachedVoice)) return cachedVoice;
  cachedVoice = voices.find((v) => v.lang?.startsWith('ja')) || null;
  return cachedVoice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    cachedKoVoice = null;
  };
}

function speakLocal(text, rate) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = rate;
  const voice = pickJapaneseVoice();
  /* 음성을 못 붙여도 읽기는 한다. 목록이 이상한 브라우저에서 이 한 줄이
     던지면 화면이 통째로 죽는데, 그건 소리 하나 못 고른 값으로는 너무 크다 —
     lang만 맞춰 두면 기기가 알아서 고른다. */
  try { if (voice) utter.voice = voice; } catch { /* 기본 음성으로 읽는다 */ }
  window.speechSynthesis.speak(utter);
}

/* ── 한국어 (뜻 읽어 주기) ──
 *
 * 듣기 화면은 화면을 못 보는 동안 쓰라고 만든 자리인데, 뜻은 눈으로만
 * 보여 주고 있었다. 걸으면서 들으면 일본어가 나오고 그다음은 침묵이다 —
 * 절반이 안 들리는 셈이다.
 *
 * 클라우드를 안 쓰고 기기 음성으로만 낸다. 이유가 둘이다.
 *   · 뜻은 발음 품질이 중요하지 않다. 알아들으면 된다
 *   · 클라우드 몫은 일본어에 쓰는 유료 자원이다. 뜻을 읽느라 그걸 깎으면
 *     정작 배우려는 쪽을 못 듣게 된다
 *
 * 한국어 음성이 없는 기기면 그냥 소리가 안 난다. 뜻은 화면에도 떠 있으니
 * 못 들어도 학습이 막히지는 않는다 — 없는 걸 억지로 일본어 음성으로 읽으면
 * 알아들을 수 없는 소리가 난다. */
export function koreanVoiceReady() {
  const voices = window.speechSynthesis?.getVoices() || [];
  return voices.some((v) => v.lang?.startsWith('ko'));
}

function pickKoreanVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  if (cachedKoVoice && voices.includes(cachedKoVoice)) return cachedKoVoice;
  cachedKoVoice = voices.find((v) => v.lang?.startsWith('ko')) || null;
  return cachedKoVoice;
}

export function speakKorean(text, rate = 1) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
  const voice = pickKoreanVoice();
  if (!voice) return;   // 한국어 음성이 없으면 조용히 넘어간다
  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  utter.rate = rate;
  try { utter.voice = voice; } catch { /* 기본 음성으로 읽는다 */ }
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

async function speakCloud(text, rate, token) {
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
    // 서버까지 간 요청만 센다 — 캐시로 다시 튼 소리는 청구되지 않는다
    addChars([...text].length);
    if (cloudCache.size > 300) cloudCache.clear();
    cloudCache.set(cacheKey, b64);
  }

  if (token !== speakToken) return;   // 기다리는 사이에 다음 소리가 시작됐다

  const a = getAudioEl();
  a.src = `data:audio/mp3;base64,${b64}`;
  try {
    await a.play();
  } catch (err) {
    // 우리가 끊어서 난 중단은 실패가 아니다 — 여기서 폴백하면 두 번 들린다
    if (err?.name === 'AbortError' || token !== speakToken) return;
    throw err;
  }
}

/* ── 공개 API ── */

/* 소리로 낼 문자열을 고른다.
 *
 * 한자를 그대로 넘기면 읽는 법은 음성 엔진이 자기 마음대로 고른다. 그래서
 * 「開く(あく)」를 가르치는 카드가 예문 「ドアが開きます」를 ひらきます로 읽어 주는
 * 어긋남이 실제로 있었다. 학습 앱에서 화면의 읽기와 들리는 소리가 다른 것은
 * 틀린 발음을 가르치는 것과 같다.
 *
 * 우리 데이터는 모든 문장에 정답 읽기(kana·exampleKana)를 함께 갖고 있으니
 * 소리를 낼 때는 언제나 그쪽을 쓴다.
 * 「よん / し」처럼 대안을 병기한 읽기는 앞의 하나만 읽는다. */
export function readingText(kana, fallback) {
  const source = kana || fallback || '';
  const first = source.split(/\s*\/\s*/)[0].trim();
  return first || source;
}

export function speakJapanese(text, rate = 0.9) {
  if (!text) return;
  lastText = text;
  // 앞의 재생을 끊고 세대를 넘긴다. 이 뒤로 예전 요청은 소리를 내지 못한다.
  stopSpeaking();
  const token = speakToken;

  if (!cloudTTSReady()) {
    speakLocal(text, rate);
    return;
  }

  speakCloud(text, rate, token).catch((err) => {
    if (token !== speakToken) return;   // 이미 지난 요청 — 폴백까지 울리면 두 번이 된다
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
  speakToken += 1;   // 진행 중인 요청이 뒤늦게 울리지 못하게 한다
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
