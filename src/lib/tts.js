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
    // 키를 바꿨으면 한국어가 조용한 이유도 달라진다 — 다시 말해 줄 수 있게 놓는다
    koToldSilent = false;
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

/* 기기 음성으로 한국어를 내 봤다가 실패한 적이 있는가.
   한 번 실패한 기기는 다음 장부터 바로 클라우드로 간다 — 매 장마다 한 번씩
   조용히 실패하고 나서야 넘어가면 뜻이 들리다 말다 한다.
   쓰는 데(speakKorean)보다 위에 둔다 — 아래에 두면 읽는 순서에 걸린다. */
let koLocalBroken = false;
let koToldSilent = false;   // 조용한 이유는 한 번만 알린다

/* cancel() 뒤에 speak()을 얼마나 떼어 놓을지, 그리고 아무 기별이 없을 때
   얼마나 기다렸다 조용한 것으로 볼지.
   듣기의 뜻 차례는 대략 3.5초다(읽는 시간 + 간격). 0.12 + 0.8초면 클라우드로
   넘어가 받아서 트는 것까지 그 안에 든다 — 더 늘리면 다음 장이 잘라 버린다. */
const KO_AFTER_CANCEL_MS = 120;
const KO_SILENT_MS = 800;

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
    /* 음성이 새로 깔렸을 수 있다 — 「이 기기는 한국어가 안 된다」는 판단을 놓는다.
       목록이 늦게 채워지는 기기에서 첫 장만 실패하고 영구히 클라우드로 가면,
       공짜로 낼 수 있는 소리를 계속 돈 내고 받는다. */
    koLocalBroken = false;
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
 * 기기 음성을 먼저 쓴다. 이유가 둘이다.
 *   · 뜻은 발음 품질이 중요하지 않다. 알아들으면 된다
 *   · 클라우드 몫은 일본어에 쓰는 유료 자원이다. 뜻을 읽느라 그걸 깎으면
 *     정작 배우려는 쪽을 못 듣게 된다
 *
 * ★ 그런데 안 나면 그냥 조용했다 ★
 *
 * 「자동 듣기에서 한국어를 안 읽어준다」는 말이 나왔고, 재현해 보니 앱은 ko-KR로
 * 제대로 넘기고 있었다. 넘긴 뒤가 문제였다.
 *
 *   · 일본어는 클라우드 폴백이 있다. 키를 넣어 두면 기기에 일본어 음성이
 *     없어도 mp3를 받아서 튼다 — 그래서 일본어는 늘 들린다.
 *   · 한국어는 기기 음성밖에 없었다. requestCloud가 languageCode를 ja-JP로
 *     박아 두어서 클라우드를 쓸 수가 없었다.
 *   · 게다가 실패를 아무도 안 들었다. utter.onerror가 없어서 엔진이
 *     synthesis-failed를 돌려줘도 앱은 모르고, 사용자에게도 안 알렸다.
 *
 * 그래서 「일본어는 나오는데 한국어만 안 나오고, 왜 안 나오는지도 모른다」가 됐다.
 * 기기 음성을 먼저 쓰는 것은 그대로 두고, 실패하면 클라우드로 넘긴다. 클라우드도
 * 못 쓰면 그때는 조용한 이유를 말해 준다 — 조용한 것보다 나쁜 건 이유 없이
 * 조용한 것이다. */
/* 읽어 줄 수 있는 상태인가.
 *
 * ★ 목록이 비었다고 못 읽는 게 아니다 ★
 * 예전엔 여기서 「한국어 음성이 있는가」를 물었다. 그런데 안드로이드 크롬과
 * 웹뷰는 getVoices()가 []를 주면서도 소리는 멀쩡히 난다. 그 기기에서 일본어는
 * 나오고 한국어만 안 나왔다 — 일본어 쪽(speakLocal)은 음성을 못 찾아도 lang만
 * 맞춰서 그냥 읽는데, 한국어 쪽만 음성이 없다고 돌아섰기 때문이다.
 *
 * 두 언어를 다르게 다룰 이유가 없다. 목록이 비었으면 「모른다」이지 「없다」가
 * 아니다 — 모를 때는 시켜 보고, 안 나면 그때 사용자가 끄면 된다. */
export function speechReady() {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
}

/* 목록에 한국어가 실제로 잡혔는가. 「없다」고 단정하는 데는 못 쓰고,
   「있으니 확실히 된다」고 말할 때만 쓴다. */
export function koreanVoiceListed() {
  const voices = (typeof window !== 'undefined' && window.speechSynthesis?.getVoices()) || [];
  return voices.some((v) => v.lang?.startsWith('ko'));
}

// 옛 이름 — 부르는 곳이 있어 남겨 둔다
export const koreanVoiceReady = speechReady;

function pickKoreanVoice() {
  const voices = (typeof window !== 'undefined' && window.speechSynthesis?.getVoices()) || [];
  if (cachedKoVoice && voices.includes(cachedKoVoice)) return cachedKoVoice;
  cachedKoVoice = voices.find((v) => v.lang?.startsWith('ko')) || null;
  return cachedKoVoice;
}

/* 한국어를 클라우드로. 기기에서 안 될 때만 온다. */
function speakKoreanCloud(text, rate, token) {
  speakCloud(text, rate, token, 'ko').catch((err) => {
    if (token !== speakToken) return;   // 이미 다음 소리가 시작됐다
    if (err.status === 400 || err.status === 401 || err.status === 403) cloudDisabled = true;
    if (!koToldSilent) {
      koToldSilent = true;
      onCloudError?.(`한국어 뜻을 소리로 내지 못했어요 (${err.message}). 듣기 설정에서 「한국어 뜻도 소리로」를 꺼 두실 수 있어요.`);
    }
  });
}

export function speakKorean(text, rate = 1) {
  if (!text) return;
  stopSpeaking();
  const token = speakToken;

  /* 이 기기의 기기 음성이 이미 한 번 실패했다면 곧장 클라우드로 */
  if (koLocalBroken && cloudTTSReady()) { speakKoreanCloud(text, rate, token); return; }
  if (!speechReady()) {
    if (cloudTTSReady()) speakKoreanCloud(text, rate, token);
    return;
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  utter.rate = rate;
  /* 한국어 음성을 찾았으면 붙이고, 없으면 lang만 맞춰서 기기에 맡긴다.
     일본어가 이미 그렇게 하고 있다 — 목록이 이상한 브라우저에서도 소리는 난다. */
  const voice = pickKoreanVoice();
  try { if (voice) utter.voice = voice; } catch { /* 기본 음성으로 읽는다 */ }

  /* ★ 안 났다는 걸 알아내는 두 가지 길 ★
   *
   * 처음에는 onerror만 달았다. 그런데 아이폰에서는 여전히 조용했다 — 사파리는
   * 못 읽을 때 오류를 주는 게 아니라 그냥 아무 일도 안 한다. 오류도 start도
   * 안 오니 폴백이 걸릴 자리가 없었다.
   *
   * 그래서 둘을 같이 본다.
   *   onerror  — 엔진이 실패라고 말해 주는 기기
   *   시간초과 — 아무 말도 없이 조용한 기기 (아이폰)
   *
   * 어느 쪽이든 한 번만 내려간다. */
  let heard = false;
  const giveUp = () => {
    if (heard) return;
    heard = true;
    koLocalBroken = true;
    if (token !== speakToken) return;   // 지난 차례면 다시 내지 않는다
    if (cloudTTSReady()) { speakKoreanCloud(text, rate, token); return; }
    if (!koToldSilent) {
      koToldSilent = true;
      /* 「음성이 없어서」라고 단정하지 않는다 — 아이폰에는 한국어 음성이 있는데도
         기기가 안 읽어 주는 경우가 있다. 아는 것만 말한다: 소리가 안 났다는 것. */
      onCloudError?.('이 기기가 뜻을 소리로 읽어 주지 못했어요. 더보기 → 음성에서 클라우드 음성을 연결하면 뜻도 읽어 줘요.');
    }
  };
  utter.onstart = () => { heard = true; };
  utter.onend = () => { heard = true; };
  utter.onerror = (e) => {
    const why = e?.error;
    /* 우리가 끊어서 난 중단은 실패가 아니다 — 다음 장으로 넘어갈 때마다
       cancel을 부른다. 이걸 실패로 세면 멀쩡한 기기가 「안 된다」고 찍힌다. */
    if (why === 'interrupted' || why === 'canceled') { heard = true; return; }
    giveUp();
  };

  /* ★ cancel() 바로 뒤의 speak()는 사파리가 그냥 버린다 ★
   *
   * 위에서 stopSpeaking()이 cancel을 부른다. 같은 틱에서 speak을 부르면
   * 아이폰에서는 발화가 통째로 사라진다 — 일본어는 클라우드 오디오로 나가서
   * 이 자리를 안 지나니, 한국어만 조용했던 이유가 이것이다.
   * 한 틱 떼어서 넘긴다. */
  setTimeout(() => {
    if (token !== speakToken) return;   // 그새 다음 장으로 넘어갔다
    window.speechSynthesis.speak(utter);
    // 말을 시작했다는 기별이 없으면 조용한 것으로 본다
    setTimeout(giveUp, KO_SILENT_MS);
  }, KO_AFTER_CANCEL_MS);
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

/* 어느 말로 부를지.
 *
 * languageCode가 ja-JP로 박혀 있어서 클라우드는 일본어 전용이었다 — 한국어는
 * 기기 음성이 안 되면 낼 방법이 아예 없었다.
 *
 * 한국어에는 목소리 이름을 안 박는다. 이름을 적으면 그 목소리가 계정·지역에서
 * 안 되는 날 400이 나는데, 뜻은 누가 읽어도 알아들으면 되는 것이라 구글이
 * 고르게 두는 편이 안 끊긴다. */
function cloudVoiceFor(lang) {
  if (lang === 'ko') return { languageCode: 'ko-KR' };
  return { languageCode: 'ja-JP', name: config.voice || DEFAULT_VOICE };
}

async function requestCloud(text, rate, withRate, lang = 'ja') {
  const audioConfig = { audioEncoding: 'MP3' };
  if (withRate && rate !== 1) audioConfig.speakingRate = rate;

  const res = await fetch(`${GTTS_ENDPOINT}?key=${encodeURIComponent(config.gttsKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: cloudVoiceFor(lang),
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

/* lang은 캐시 열쇠에도 들어가야 한다. 안 넣으면 같은 글자를 두 말로 부를 때
   먼저 받은 소리가 다른 말 자리에서 다시 난다 — 한국어 자리에서 일본어가 난다. */
async function speakCloud(text, rate, token, lang = 'ja') {
  const cacheKey = `${lang}|${text}|${rate}|${lang === 'ko' ? 'ko' : config.voice}`;
  let b64 = cloudCache.get(cacheKey);

  if (!b64) {
    try {
      b64 = await requestCloud(text, rate, true, lang);
    } catch (err) {
      // 일부 보이스는 speakingRate를 받지 않는다 → 속도 옵션 없이 1회만 재시도
      if (err.status === 400 && rate !== 1) b64 = await requestCloud(text, rate, false, lang);
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
