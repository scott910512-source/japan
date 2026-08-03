/* ═══════════════════════════════════════════════════════════
 * app.js — 게임 상태·라우팅·씬 엔진·음성·저장·복습
 * ═══════════════════════════════════════════════════════════ */
'use strict';

/* ───────── 저장 (localStorage, jtrip_ 접두어) ───────── */
const Store = {
  get(key, def) {
    try { const v = localStorage.getItem('jtrip_' + key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  },
  set(key, val) { try { localStorage.setItem('jtrip_' + key, JSON.stringify(val)); } catch (e) {} },
  del(key) { localStorage.removeItem('jtrip_' + key); }
};

const todayStr = () => new Date().toISOString().slice(0, 10);

let settings = Store.get('settings', { apiKey: '', model: '', level: 1, furigana: 'auto', subtitle: 'auto', rate: 1, name: 'キム', voiceURI: '', gttsKey: '', gttsVoice: '', gttsGender: 'auto', hangul: 'off', inputMode: 'choice' });
let progress = Store.get('progress', { cleared: {}, dayLog: { date: todayStr(), scenes: [], expressions: [] } });
let profile  = Store.get('profile', {});
let mistakes = Store.get('mistakes', []);
let cards    = Store.get('cards', []);
let weakTags = Store.get('weakTags', {});

function saveAll() {
  Store.set('settings', settings); Store.set('progress', progress);
  Store.set('profile', profile);   Store.set('mistakes', mistakes);
  Store.set('cards', cards);       Store.set('weakTags', weakTags);
}

/* ───────── 텍스트 유틸 ───────── */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// 「漢字[よみ]」 → <ruby>
function rubyHTML(s) {
  return esc(s).replace(/([一-龯々〆ヵヶ〇]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
}
function plain(s) { return String(s == null ? '' : s).replace(/\[[^\]]*\]/g, ''); }
function normalize(s) {
  return plain(s).normalize('NFKC').toLowerCase()
    .replace(/[\s、。・「」『』？！?!.,…〜~ー－\-()（）]/g, '');
}
/* ── 가나 → 한글 발음 표기 (일본어 완전 초보용) ── */
const KANA_H = {
  'あ':'아','い':'이','う':'우','え':'에','お':'오',
  'か':'카','き':'키','く':'쿠','け':'케','こ':'코','が':'가','ぎ':'기','ぐ':'구','げ':'게','ご':'고',
  'さ':'사','し':'시','す':'스','せ':'세','そ':'소','ざ':'자','じ':'지','ず':'즈','ぜ':'제','ぞ':'조',
  'た':'타','ち':'치','つ':'츠','て':'테','と':'토','だ':'다','ぢ':'지','づ':'즈','で':'데','ど':'도',
  'な':'나','に':'니','ぬ':'누','ね':'네','の':'노',
  'は':'하','ひ':'히','ふ':'후','へ':'헤','ほ':'호','ば':'바','び':'비','ぶ':'부','べ':'베','ぼ':'보',
  'ぱ':'파','ぴ':'피','ぷ':'푸','ぺ':'페','ぽ':'포',
  'ま':'마','み':'미','む':'무','め':'메','も':'모','や':'야','ゆ':'유','よ':'요',
  'ら':'라','り':'리','る':'루','れ':'레','ろ':'로','わ':'와','ゐ':'이','ゑ':'에','を':'오',
  'ぁ':'아','ぃ':'이','ぅ':'우','ぇ':'에','ぉ':'오','ゃ':'야','ゅ':'유','ょ':'요','ゔ':'부'
};
const KANA_DIGRAPH = {
  'きゃ':'캬','きゅ':'큐','きょ':'쿄','しゃ':'샤','しゅ':'슈','しょ':'쇼','ちゃ':'차','ちゅ':'추','ちょ':'초',
  'にゃ':'냐','にゅ':'뉴','にょ':'뇨','ひゃ':'햐','ひゅ':'휴','ひょ':'효','みゃ':'먀','みゅ':'뮤','みょ':'묘',
  'りゃ':'랴','りゅ':'류','りょ':'료','ぎゃ':'갸','ぎゅ':'규','ぎょ':'교','じゃ':'자','じゅ':'주','じょ':'조',
  'びゃ':'뱌','びゅ':'뷰','びょ':'뵤','ぴゃ':'퍄','ぴゅ':'퓨','ぴょ':'표','ふぁ':'화','ふぃ':'휘','ふぇ':'훼','ふぉ':'훠',
  'ちぇ':'체','しぇ':'셰','じぇ':'제','うぃ':'위','うぇ':'웨','うぉ':'워','てぃ':'티','でぃ':'디','とぅ':'투','どぅ':'두',
  'つぁ':'차','つぇ':'체','つぉ':'초','ゔぁ':'바','ゔぃ':'비','ゔぇ':'베','ゔぉ':'보'
};
function kanaToHangul(src) {
  if (!src) return '';
  let s = '';
  for (const ch of src) { // 가타카나 → 히라가나
    const c = ch.codePointAt(0);
    s += (c >= 0x30A1 && c <= 0x30F6) ? String.fromCodePoint(c - 0x60) : ch;
  }
  // 조사 は→わ, へ→え 발음 보정: 인사말 + 단어 경계 마커(\u0000, 한자 읽기 뒤에 삽입됨) 뒤의 조사
  s = s.replace(/こんにちは/g, 'こんにちわ').replace(/こんばんは/g, 'こんばんわ');
  s = s.replace(/\u0000((?:に|で|と)?)は/g, '\u0000$1わ').replace(/\u0000へ/g, '\u0000え');
  s = s.replace(/\u0000/g, '');
  let out = '';
  const addJong = jong => { // 직전 한글 음절에 받침 붙이기 (ん→ㄴ, っ→ㅅ)
    const last = out[out.length - 1];
    if (!last) return false;
    const c = last.codePointAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 === 0) {
      out = out.slice(0, -1) + String.fromCodePoint(c + jong);
      return true;
    }
    return false;
  };
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (KANA_DIGRAPH[two]) { out += KANA_DIGRAPH[two]; i++; continue; }
    const ch = s[i];
    if (ch === 'ん') { if (!addJong(4)) out += '응'; continue; }
    if (ch === 'っ') { if (!addJong(19)) out += ''; continue; }
    if (ch === 'ー') { out += '-'; continue; }
    out += KANA_H[ch] !== undefined ? KANA_H[ch] : ch;
  }
  return out;
}
// 「漢字[よみ]」 표기를 전체 かな 문자열로 (한자 부분은 읽기로 치환, 뒤에 경계 마커 — 조사 は 보정용)
function lineKana(jp) {
  return String(jp == null ? '' : jp).replace(/([一-龯々〆ヵヶ〇]+)\[([^\]]+)\]/g, '$2\u0000');
}
function hangulEnabled() {
  // 기본은 끄기 — 가나를 읽을 줄 아는 학습자가 다수. 설정에서 'L1 자동' 또는 '항상'을 선택하면 표시
  return settings.hangul === 'on' || (settings.hangul === 'auto' && settings.level === 1);
}

// 바이그램 유사도 (다시 말하기 판정용)
function similarity(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  const grams = t => { const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
  const ga = grams(a), gb = grams(b);
  if (!gb.size) return a.includes(b) ? 1 : 0;
  let hit = 0; gb.forEach(g => { if (ga.has(g)) hit++; });
  return hit / gb.size;
}

/* ───────── 음성 (Web Speech API) ─────────
 * 기기에 설치된 일본어 보이스 중 최고 품질(고급/프리미엄/신경망 계열)을 자동 선택한다.
 * iOS: Kyoko(고급)·Siri 계열 / Android·Chrome: Google 日本語 / 설정에서 직접 선택도 가능.
 */
const Voice = {
  jaVoice: null, lastText: '',
  rank(v) {
    if (!v.lang || !v.lang.toLowerCase().startsWith('ja')) return -1;
    const n = (v.name + ' ' + (v.voiceURI || '')).toLowerCase();
    let s = 1;
    if (/enhanced|premium|プレミアム|拡張|super|natural|neural/.test(n)) s += 6;
    if (/siri/.test(n)) s += 5;
    if (/google/.test(n)) s += 4;
    if (/kyoko|otoya|o-?ren|hattori/.test(n)) s += 2;
    if (v.localService) s += 1;
    return s;
  },
  jaVoices() {
    if (!('speechSynthesis' in window)) return [];
    return speechSynthesis.getVoices()
      .filter(v => (v.lang || '').toLowerCase().startsWith('ja'))
      .sort((a, b) => this.rank(b) - this.rank(a));
  },
  pick() {
    const list = this.jaVoices();
    if (settings.voiceURI) {
      const chosen = list.find(v => v.voiceURI === settings.voiceURI);
      if (chosen) { this.jaVoice = chosen; return; }
    }
    this.jaVoice = list[0] || null;
  },
  init() {
    if (!('speechSynthesis' in window)) return;
    this.pick();
    speechSynthesis.onvoiceschanged = () => { this.pick(); fillVoiceSelect(); };
  },
  audio: null, cloudCache: new Map(),
  // 구글 클라우드 보이스: Chirp 3 HD가 최신·최고 자연스러움
  DEFAULT_GVOICE: 'ja-JP-Chirp3-HD-Aoede',
  // 여성 보이스 → 같은 세대의 남성 보이스 짝 (NPC 역할별 자동 남/여)
  MALE_PAIR: {
    'ja-JP-Chirp3-HD-Aoede': 'ja-JP-Chirp3-HD-Charon',
    'ja-JP-Chirp3-HD-Leda': 'ja-JP-Chirp3-HD-Fenrir',
    'ja-JP-Chirp3-HD-Kore': 'ja-JP-Chirp3-HD-Orus',
    'ja-JP-Chirp3-HD-Zephyr': 'ja-JP-Chirp3-HD-Puck',
    'ja-JP-Neural2-B': 'ja-JP-Neural2-C',
    'ja-JP-Wavenet-A': 'ja-JP-Wavenet-C',
    'ja-JP-Wavenet-B': 'ja-JP-Wavenet-D'
  },
  gvoiceFor(gender) {
    const base = settings.gttsVoice || this.DEFAULT_GVOICE;
    if (gender === 'male' && settings.gttsGender !== 'fixed') return this.MALE_PAIR[base] || base;
    return base;
  },
  stop() {
    if (this.audio) { try { this.audio.pause(); } catch (e) {} this.audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  },
  lastGender: '',
  speak(text, rate, gender) {
    if (!text) return;
    this.lastText = text;
    this.lastGender = gender || this.lastGender || '';
    this.stop();
    // 억양이 살도록 말줄임표·괄호를 쉼표/무음으로 정리
    const clean = text.replace(/……|…/g, '、').replace(/[（）()]/g, ' ');
    const r = rate || Number(settings.rate) || 1;
    if (settings.gttsKey) {
      this.cloudSpeak(clean, r, this.gvoiceFor(gender || this.lastGender)).catch(() => this.localSpeak(clean, r)); // 실패 시 기기 음성 폴백
    } else {
      this.localSpeak(clean, r);
    }
  },
  localSpeak(clean, r) {
    if (!('speechSynthesis' in window)) return;
    this.pick();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ja-JP';
    try { if (this.jaVoice) u.voice = this.jaVoice; } catch (e) { /* 보이스 목록 변동 시 무시 */ }
    u.rate = r;
    u.pitch = 1;
    try { speechSynthesis.speak(u); } catch (e) { /* TTS 실패가 게임을 멈추지 않게 */ }
  },
  // Google Cloud TTS: 같은 문장은 메모리 캐시로 재사용해 무료 한도 절약
  async gttsRequest(clean, r, voiceName, withRate) {
    const audioConfig = { audioEncoding: 'MP3' };
    if (withRate && r !== 1) audioConfig.speakingRate = r;
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(settings.gttsKey), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: { text: clean },
        voice: { languageCode: 'ja-JP', name: voiceName },
        audioConfig
      })
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); if (j.error && j.error.message) msg += ' — ' + j.error.message; } catch (e2) {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return (await res.json()).audioContent;
  },
  async cloudSpeak(clean, r, voiceName) {
    voiceName = voiceName || this.gvoiceFor('');
    const key = clean + '|' + r + '|' + voiceName;
    let b64 = this.cloudCache.get(key);
    if (!b64) {
      try {
        b64 = await this.gttsRequest(clean, r, voiceName, true);
      } catch (e) {
        // 일부 보이스는 speakingRate 미지원 → 속도 옵션 없이 1회 재시도
        if (e.status === 400 && r !== 1) b64 = await this.gttsRequest(clean, r, voiceName, false);
        else throw e;
      }
      if (!b64) throw new Error('gtts empty');
      if (this.cloudCache.size > 300) this.cloudCache.clear();
      this.cloudCache.set(key, b64);
    }
    this.audio = new Audio('data:audio/mp3;base64,' + b64);
    await this.audio.play();
  },
  slow() { if (this.lastText) this.speak(this.lastText, 0.7); },
  /* ── 클라우드 STT (Google Speech-to-Text, ja-JP) ──
   * 마이크 → 원시 PCM 수집 → 16kHz/16bit 다운샘플 → recognize REST 호출.
   * MediaRecorder 포맷 문제(iOS=AAC)를 피하려고 WebAudio로 직접 뽑는다. */
  recActive: false, _recBuf: null, _recCtx: null, _recProc: null, _recStream: null, _recTimer: null,
  _spoke: false, _lastVoice: 0, _recBegan: 0, _autoStopped: false,
  sttHints: [],
  cloudSttAvailable() { return !!(settings.gttsKey && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
  micAvailable() { return this.cloudSttAvailable() || this.sttSupported(); },
  async recStart(onAutoStop) {
    this._recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AC = window.AudioContext || window.webkitAudioContext;
    this._recCtx = new AC();
    const src = this._recCtx.createMediaStreamSource(this._recStream);
    this._recProc = this._recCtx.createScriptProcessor(4096, 1, 1);
    this._recBuf = [];
    this._spoke = false;
    this._autoStopped = false;
    this._recBegan = Date.now();
    this._lastVoice = Date.now();
    this._recProc.onaudioprocess = e => {
      if (!this.recActive) return;
      const data = e.inputBuffer.getChannelData(0);
      this._recBuf.push(new Float32Array(data));
      // 음량(RMS) 측정 → 침묵 감지
      let sum = 0;
      for (let i = 0; i < data.length; i += 16) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / (data.length / 16));
      const now = Date.now();
      if (rms > 0.015) { this._spoke = true; this._lastVoice = now; }
      if (!this._autoStopped && onAutoStop) {
        if (this._spoke && now - this._lastVoice > 3000) {
          // 말한 뒤 3초 침묵 → 자동 종료·인식
          this._autoStopped = true; onAutoStop();
        } else if (!this._spoke && now - this._recBegan > 7000) {
          // 7초간 아무 말 없음 → 종료
          this._autoStopped = true; onAutoStop();
        }
      }
    };
    src.connect(this._recProc);
    this._recProc.connect(this._recCtx.destination);
    this.recActive = true;
    this._recTimer = setTimeout(() => { if (this.recActive && !this._autoStopped && onAutoStop) { this._autoStopped = true; onAutoStop(); } }, 15000);
  },
  async recStop() {
    if (!this.recActive) return '';
    this.recActive = false;
    clearTimeout(this._recTimer);
    try { this._recProc.disconnect(); } catch (e) {}
    try { this._recStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    const sr = this._recCtx.sampleRate;
    const chunks = this._recBuf || [];
    try { this._recCtx.close(); } catch (e) {}
    let len = 0; chunks.forEach(c => { len += c.length; });
    if (!len) return '';
    const all = new Float32Array(len);
    let off = 0; chunks.forEach(c => { all.set(c, off); off += c.length; });
    const ratio = sr / 16000;
    const n = Math.floor(all.length / ratio);
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      pcm[i] = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)])) * 0x7FFF;
    }
    let bin = '';
    const bytes = new Uint8Array(pcm.buffer);
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    const config = {
      encoding: 'LINEAR16', sampleRateHertz: 16000, languageCode: 'ja-JP',
      enableAutomaticPunctuation: true, model: 'latest_short', useEnhanced: true
    };
    // 지금 장면에서 기대되는 문장·단어를 힌트로 → 인식 정확도 대폭 향상
    if (this.sttHints.length) config.speechContexts = [{ phrases: this.sttHints.slice(0, 40), boost: 12 }];
    const res = await fetch('https://speech.googleapis.com/v1/speech:recognize?key=' + encodeURIComponent(settings.gttsKey), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, audio: { content: btoa(bin) } })
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); if (j.error && j.error.message) msg += ' — ' + j.error.message; } catch (e2) {}
      throw new Error(msg);
    }
    const data = await res.json();
    const alt = ((data.results || [])[0] || {}).alternatives || [{}];
    return alt[0].transcript || '';
  },
  sttSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  listen(onResult, onEnd) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'ja-JP'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = e => onResult(e.results[0][0].transcript);
    r.onend = onEnd; r.onerror = onEnd;
    r.start();
    return r;
  }
};

/* ───────── 씬 배경·NPC SVG (전부 코드 생성, 외부 이미지 없음) ───────── */
function sceneBgSVG(bg, variant) {
  const sky = `<rect width="360" height="200" fill="#CDE4F2"/>`;
  const night = `<rect width="360" height="200" fill="#3D4A6B"/><circle cx="300" cy="35" r="14" fill="#F5E9C8"/>`;
  const floor = c => `<rect y="150" width="360" height="50" fill="${c}"/>`;
  const B = {
    airport: sky + floor('#E8E2D6') + `<rect x="20" y="40" width="320" height="70" rx="8" fill="#F4F1EA" stroke="#D8D2C4" stroke-width="3"/><rect x="40" y="55" width="90" height="26" rx="4" fill="#4A6B8A"/><text x="85" y="73" font-size="14" fill="#fff" text-anchor="middle">NARITA</text><path d="M250 60 l40 10 -40 10 8-10z" fill="#E85D5D"/><rect x="150" y="55" width="70" height="40" rx="4" fill="#D9E8F2"/>`,
    immigration: `<rect width="360" height="200" fill="#E9EDF2"/>` + floor('#D8DCE2') + `<rect x="120" y="45" width="120" height="105" rx="6" fill="#8FA6BC"/><rect x="132" y="58" width="96" height="55" rx="4" fill="#DCE8F2"/><rect x="145" y="20" width="70" height="18" rx="4" fill="#4A6B8A"/><text x="180" y="34" font-size="11" fill="#fff" text-anchor="middle">入国審査</text>`,
    lobby: sky + floor('#E8E2D6') + `<rect x="30" y="60" width="300" height="8" fill="#D8D2C4"/><rect x="110" y="80" width="140" height="70" rx="8" fill="#F2B84B"/><rect x="125" y="52" width="110" height="22" rx="6" fill="#E85D5D"/><text x="180" y="68" font-size="12" fill="#fff" text-anchor="middle">案内 INFORMATION</text>`,
    simshop: sky + floor('#E8E2D6') + `<rect x="100" y="55" width="160" height="95" rx="8" fill="#A8D8C8"/><rect x="118" y="35" width="124" height="24" rx="6" fill="#4CAF87"/><text x="180" y="52" font-size="13" fill="#fff" text-anchor="middle">SIM CARD</text><rect x="120" y="80" width="30" height="45" rx="3" fill="#fff"/><rect x="160" y="80" width="30" height="45" rx="3" fill="#fff"/><rect x="200" y="80" width="30" height="45" rx="3" fill="#fff"/>`,
    station: `<rect width="360" height="200" fill="#DCE8E4"/>` + floor('#C9D4CE') + `<rect x="40" y="30" width="280" height="40" rx="8" fill="#2E7D5B"/><text x="180" y="56" font-size="16" fill="#fff" text-anchor="middle">上野 Ueno</text><rect x="60" y="90" width="60" height="60" rx="4" fill="#8FA6BC"/><rect x="240" y="90" width="60" height="60" rx="4" fill="#8FA6BC"/><rect x="70" y="100" width="40" height="40" fill="#DCE8F2"/><rect x="250" y="100" width="40" height="40" fill="#DCE8F2"/>`,
    platform: `<rect width="360" height="200" fill="#D5DEE6"/>` + floor('#B8C2CA') + `<rect x="0" y="60" width="360" height="70" fill="#4A6B8A"/><rect x="15" y="72" width="80" height="46" rx="4" fill="#D9E8F2"/><rect x="140" y="72" width="80" height="46" rx="4" fill="#D9E8F2"/><rect x="265" y="72" width="80" height="46" rx="4" fill="#D9E8F2"/><rect y="145" width="360" height="8" fill="#F2B84B"/>`,
    street: sky + floor('#D8CFC0') + `<rect x="20" y="50" width="90" height="100" fill="#EAD9C8"/><rect x="35" y="65" width="25" height="25" fill="#B7D3E8"/><rect x="70" y="65" width="25" height="25" fill="#B7D3E8"/><rect x="250" y="40" width="90" height="110" fill="#D9C8B8"/><rect x="265" y="60" width="25" height="25" fill="#B7D3E8"/><rect x="300" y="60" width="25" height="25" fill="#B7D3E8"/><rect x="150" y="95" width="14" height="55" fill="#8A8177"/><circle cx="157" cy="85" r="12" fill="#F2B84B"/>`,
    hotel: `<rect width="360" height="200" fill="#F2EAE0"/>` + floor('#D9C8B8') + `<rect x="60" y="90" width="240" height="60" rx="6" fill="#A87850"/><rect x="60" y="82" width="240" height="12" rx="4" fill="#8A5F3C"/><rect x="130" y="25" width="100" height="26" rx="6" fill="#E85D5D"/><text x="180" y="43" font-size="13" fill="#fff" text-anchor="middle">FRONT</text><circle cx="90" cy="50" r="10" fill="#F2B84B"/><circle cx="270" cy="50" r="10" fill="#F2B84B"/>`,
    phone: `<rect width="360" height="200" fill="#EAE2D6"/>` + floor('#D8CFC0') + `<rect x="130" y="30" width="100" height="120" rx="10" fill="#F7F3EC" stroke="#D8D2C4" stroke-width="3"/><circle cx="180" cy="70" r="22" fill="#B7D3E8"/><path d="M168 70 a12 12 0 0 1 24 0" fill="none" stroke="#4A6B8A" stroke-width="5" stroke-linecap="round"/><rect x="158" y="100" width="44" height="10" rx="5" fill="#D8D2C4"/><rect x="158" y="118" width="44" height="10" rx="5" fill="#D8D2C4"/>`,
    restaurant: night + `<rect y="140" width="360" height="60" fill="#5C4A38"/><rect x="40" y="60" width="280" height="85" rx="6" fill="#7A6248"/><rect x="55" y="45" width="110" height="35" fill="#C0392B"/><text x="110" y="69" font-size="17" fill="#fff" text-anchor="middle">ラーメン</text><circle cx="250" cy="80" r="16" fill="#F5E9C8"/><rect x="50" y="130" width="260" height="12" rx="4" fill="#A8845C"/><ellipse cx="120" cy="126" rx="24" ry="8" fill="#F4F1EA"/><ellipse cx="120" cy="123" rx="20" ry="6" fill="#E8B04B"/>`,
    entrance: night + `<rect y="140" width="360" height="60" fill="#5C4A38"/><rect x="110" y="40" width="140" height="105" fill="#7A6248"/><rect x="122" y="55" width="116" height="60" fill="#C0392B"/><text x="180" y="92" font-size="15" fill="#fff" text-anchor="middle">のれん</text><circle cx="90" cy="60" r="12" fill="#F5E9C8"/><circle cx="270" cy="60" r="12" fill="#F5E9C8"/>`,
    store: `<rect width="360" height="200" fill="#EAF3F0"/>` + floor('#D6E2DC') + `<rect x="30" y="30" width="300" height="24" rx="5" fill="#4CAF87"/><text x="180" y="47" font-size="13" fill="#fff" text-anchor="middle">コンビニ</text><rect x="40" y="70" width="85" height="80" rx="4" fill="#fff" stroke="#C9D4CE" stroke-width="3"/><rect x="140" y="70" width="85" height="80" rx="4" fill="#fff" stroke="#C9D4CE" stroke-width="3"/><rect x="240" y="70" width="85" height="80" rx="4" fill="#fff" stroke="#C9D4CE" stroke-width="3"/><rect x="48" y="80" width="69" height="14" fill="#F8C8C8"/><rect x="148" y="80" width="69" height="14" fill="#B7D3E8"/><rect x="248" y="80" width="69" height="14" fill="#F2B84B"/>`,
    clothes: `<rect width="360" height="200" fill="#F7EFE7"/>` + floor('#E2D5C6') + `<rect x="40" y="40" width="280" height="8" rx="4" fill="#A87850"/><path d="M80 48 v16 l-18 14 h36z" fill="#E85D5D"/><path d="M150 48 v16 l-18 14 h36z" fill="#B7D3E8"/><path d="M220 48 v16 l-18 14 h36z" fill="#A8D8C8"/><path d="M290 48 v16 l-18 14 h36z" fill="#F2B84B"/><rect x="120" y="110" width="120" height="40" rx="6" fill="#D9C8B8"/>`,
    shrine: sky + `<rect y="150" width="360" height="50" fill="#9CB89C"/><circle cx="60" cy="130" r="28" fill="#5C8A5C"/><circle cx="300" cy="125" r="34" fill="#5C8A5C"/><path d="M70 60 c30-16 190-16 220 0 l-8 16 H78z" fill="#C0392B"/><rect x="95" y="86" width="170" height="10" fill="#C0392B"/><rect x="108" y="76" width="14" height="80" fill="#A93226"/><rect x="238" y="76" width="14" height="80" fill="#A93226"/>`,
    police: sky + floor('#D8D2C4') + `<rect x="110" y="55" width="140" height="95" rx="6" fill="#F4F1EA" stroke="#C9C2B4" stroke-width="3"/><rect x="128" y="30" width="104" height="24" rx="5" fill="#4A6B8A"/><text x="180" y="47" font-size="13" fill="#fff" text-anchor="middle">交番</text><circle cx="180" cy="42" r="0" fill="#E85D5D"/><rect x="150" y="95" width="60" height="55" fill="#8FA6BC"/><circle cx="80" cy="70" r="9" fill="#E85D5D"/><rect x="76" y="79" width="8" height="70" fill="#8A8177"/>`,
    taxi: night + `<rect y="140" width="360" height="60" fill="#4A4238"/><rect x="70" y="85" width="220" height="55" rx="16" fill="#F2B84B"/><rect x="110" y="65" width="130" height="35" rx="10" fill="#F2B84B"/><rect x="120" y="72" width="45" height="24" rx="4" fill="#B7D3E8"/><rect x="180" y="72" width="45" height="24" rx="4" fill="#B7D3E8"/><circle cx="110" cy="142" r="16" fill="#3D3630"/><circle cx="250" cy="142" r="16" fill="#3D3630"/><rect x="160" y="55" width="40" height="14" rx="4" fill="#E85D5D"/>`
  };
  const body = B[variant] || B[bg] || B.street;
  return `<svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice">${body}</svg>`;
}

function npcSVG(personaKey, mood) {
  const outfits = {
    officer:   { c: '#4A6B8A', hat: '#3A5570' }, stationman: { c: '#2E7D5B', hat: '#236248' },
    guide:     { c: '#E85D5D', scarf: '#F2B84B' }, simseller: { c: '#4CAF87' },
    passerby:  { c: '#B7855C' }, frontdesk: { c: '#3D3630', tie: '#E85D5D' },
    waiter:    { c: '#C0392B', band: '#fff' }, clerk: { c: '#4CAF87', stripe: '#fff' },
    shopstaff: { c: '#8A6BAF' }, taxi: { c: '#5C6B8A', hat: '#3D4A6B' },
    tourist:   { c: '#E89B4B' }, police: { c: '#34495E', hat: '#2C3E50' }
  };
  const o = outfits[personaKey] || { c: '#8A8177' };
  const eyes = mood === 'happy'
    ? `<path d="M42 40 q4 -5 8 0" stroke="#3D3630" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M58 40 q4 -5 8 0" stroke="#3D3630" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    : mood === 'confused'
    ? `<circle cx="46" cy="40" r="3" fill="#3D3630"/><circle cx="62" cy="40" r="3" fill="#3D3630"/><path d="M40 30 q6 -4 12 -1" stroke="#3D3630" stroke-width="2" fill="none"/><text x="76" y="26" font-size="14" fill="#8A8177">?</text>`
    : `<circle cx="46" cy="40" r="3" fill="#3D3630"/><circle cx="62" cy="40" r="3" fill="#3D3630"/>`;
  const mouth = mood === 'happy'
    ? `<path d="M48 52 q6 6 12 0" stroke="#3D3630" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    : `<path d="M50 53 h8" stroke="#3D3630" stroke-width="2.5" stroke-linecap="round"/>`;
  const hat = o.hat ? `<path d="M32 24 q22 -14 44 0 l0 6 -44 0z" fill="${o.hat}"/><rect x="28" y="28" width="52" height="6" rx="3" fill="${o.hat}"/>` : '';
  const band = o.band ? `<rect x="34" y="18" width="40" height="8" rx="4" fill="${o.band}" stroke="#D8D2C4"/>` : '';
  const tie = o.tie ? `<path d="M52 72 l4 12 -4 12 -4 -12z" fill="${o.tie}"/>` : '';
  const stripe = o.stripe ? `<rect x="34" y="82" width="40" height="7" fill="${o.stripe}" opacity=".7"/>` : '';
  const scarf = o.scarf ? `<rect x="38" y="66" width="32" height="8" rx="4" fill="${o.scarf}"/>` : '';
  return `<svg viewBox="0 0 108 120">
    <ellipse cx="54" cy="116" rx="34" ry="5" fill="rgba(61,54,48,.12)"/>
    <rect x="30" y="66" width="48" height="50" rx="14" fill="${o.c}"/>
    <circle cx="54" cy="40" r="26" fill="#F5D5B8"/>
    <path d="M28 36 a26 26 0 0 1 52 0 q-8 -12 -26 -12 t-26 12z" fill="#5C4632"/>
    ${hat}${band}${eyes}${mouth}${scarf}${tie}${stripe}
  </svg>`;
}

/* ───────── 화면 라우팅 ───────── */
const $ = id => document.getElementById(id);
const SCREENS = ['title', 'map', 'scene', 'result', 'lodging', 'collection', 'settings', 'training', 'basics'];
let currentScreen = 'title';
let settingsReturnTo = 'title';

function show(name) {
  SCREENS.forEach(s => $('screen-' + s).classList.toggle('hidden', s !== name));
  currentScreen = name;
  if (name === 'map') renderMap();
  if (name === 'lodging') renderLodging();
  if (name === 'collection') renderCollection('cards');
  if (name === 'settings') fillSettings();
  if (name === 'training') renderTraining();
  if (name === 'basics') renderBasics();
  if (name === 'title') $('btn-continue').classList.toggle('hidden', !Object.keys(progress.cleared).length && !progress.current);
}

/* ───────── 지도 허브 ───────── */
function isUnlocked(ch) {
  if (ch.num === 1) return true;
  const prev = CHAPTERS.find(c => c.num === ch.num - 1);
  return !!progress.cleared[prev.id];
}
function renderMap() {
  const wrap = $('map-nodes');
  wrap.innerHTML = '';
  CHAPTERS.forEach(ch => {
    const unlocked = isUnlocked(ch);
    const clear = progress.cleared[ch.id];
    const btn = document.createElement('button');
    btn.className = 'map-node' + (unlocked ? '' : ' locked') + (clear ? ' cleared' : '');
    btn.style.left = ch.mapX + '%';
    btn.style.top = ch.mapY + '%';
    btn.innerHTML = `<span class="node-icon">${unlocked ? ch.icon : '🔒'}</span>
      <span class="node-label">${ch.num}. ${esc(ch.title)}</span>
      ${clear ? `<span class="node-stars">${'★'.repeat(clear.stars)}${'☆'.repeat(3 - clear.stars)}</span>` : ''}`;
    btn.addEventListener('click', () => {
      if (!unlocked) { alert('이전 챕터를 먼저 클리어하세요!'); return; }
      startScene(ch.id);
    });
    wrap.appendChild(btn);
  });
}

/* ═════════════════ 씬 엔진 ═════════════════ */
const Scene = {
  ch: null, steps: [], idx: 0, mode: 'script',
  history: [],        // AI용 [{role, content}]
  log: [],            // 평가용 [{role:'npc'|'player', text}]
  hintsUsed: 0, retries: 0, failCount: 0, koHintUsed: false, koViews: 0,
  aiTurnsAfterClear: 0, aiCleared: 0,
  usedExpressions: new Set(), newMistakes: [], minorQueue: [],
  lastNpc: null, ended: false, transitioning: false
};

function currentChapter() { return CHAPTERS.find(c => c.id === Scene.chId); }

function buildSteps(ch) {
  // 스크립트 스텝 + 돌발 이벤트 삽입 + 어제 오답 복습 + 스몰토크
  let steps = ch.quest.steps.slice();
  (ch.quest.events || []).forEach(ev => {
    if (Math.random() < ev.chance) {
      steps = steps.slice(0, ev.afterStep).concat([ev], steps.slice(ev.afterStep));
    }
  });
  // 어제 오답 복습: 다른 상황(현재 챕터) 속 재도전 스텝을 앞부분에 삽입
  const yesterday = getYesterdayMistakes();
  if (yesterday.length && ch.id !== 'ch1') {
    const m = yesterday[0];
    const firstNpc = steps[0].npc;
    steps = [{
      npc: firstNpc, isReviewStep: true, reviewOf: m,
      action: `📔 ${esc(ch.place)}로 가는 길, 여행 수첩을 펼쳤다. 어제 배운 표현을 여기서 써먹어 보자`,
      ask: { jp: `（어제의 메모: 「${m.ko || ''}」— 이걸 일본어로 말해 보자）`, ko: `어제 표현 복습: ${m.ko || ''}` },
      expectBetter: m.better,
      model: { jp: m.better, ko: m.ko || '' },
      chunks: null,
      hintKo: `어제 교정받은 문장이에요: ${plain(m.better)}`,
      hintWord: plain(m.better).slice(0, 6) + '…',
      ok: { jp: 'いいですね、その調子[ちょうし]！', ko: '좋아요, 그 느낌이에요!' },
      retry: { jp: 'もう一度[いちど]、ゆっくり思[おも]い出[だ]してみましょう。', ko: '한 번 더, 천천히 떠올려 보세요.' },
      tag: m.tag
    }].concat(steps);
  }
  // 스몰토크: 프로필 기반 후속 질문(다른 NPC가 이전 답을 기억) 또는 새 질문
  if (ch.id !== 'ch7' && Math.random() < SMALLTALK_CHANCE + 0.25) {
    const lastNpcKey = steps[steps.length - 1].npc;
    const known = SMALLTALK.filter(s => profile[s.key]);
    const unknown = SMALLTALK.filter(s => !profile[s.key]);
    if (known.length && Math.random() < 0.6) {
      const s = known[Math.floor(Math.random() * known.length)];
      const f = s.followup(profile[s.key]);
      steps = steps.concat([{
        npc: lastNpcKey, free: true, isSmalltalk: true,
        action: '💬 볼일이 끝나자, 상대가 문득 이야기를 꺼낸다',
        ask: { jp: f.jp, ko: f.ko },
        model: { jp: 'そうなんです', ko: '맞아요 (자유롭게 답하세요)' },
        hintKo: '정답은 없어요. 자유롭게 이어가 보세요!',
        hintWord: '自由に!',
        ok: { jp: 'いいですね！では、良[よ]い旅[たび]を！', ko: '좋네요! 그럼, 좋은 여행 되세요!' }
      }]);
    } else if (unknown.length) {
      const s = unknown[Math.floor(Math.random() * unknown.length)];
      steps = steps.concat([{
        npc: lastNpcKey, free: true, isSmalltalk: true, profileKey: s.key,
        action: '💬 볼일이 끝나자, 상대가 가볍게 말을 건다',
        ask: { jp: s.jp, ko: s.ko },
        model: { jp: '（自由[じゆう]に答[こた]えましょう）', ko: '(자유롭게 답하세요)' },
        hintKo: '정답은 없어요. 아는 단어로 자유롭게!',
        hintWord: '自由に!',
        ok: { jp: 'そうなんですね！では、良[よ]い旅[たび]を！', ko: '그렇군요! 그럼, 좋은 여행 되세요!' }
      }]);
    }
  }
  return steps;
}

function getYesterdayMistakes() {
  const today = todayStr();
  return mistakes.filter(m => m.date < today && !m.retried).slice(-3);
}

function startScene(chId) {
  const ch = CHAPTERS.find(c => c.id === chId);
  Scene.chId = chId;
  Scene.steps = buildSteps(ch);
  Scene.idx = 0;
  Scene.history = []; Scene.log = [];
  Scene.hintsUsed = 0; Scene.retries = 0; Scene.failCount = 0;
  Scene.koHintUsed = false; Scene.koViews = 0;
  Scene.aiTurnsAfterClear = 0; Scene.aiCleared = 0;
  Scene.usedExpressions = new Set(); Scene.newMistakes = []; Scene.minorQueue = [];
  Scene.ended = false;
  Scene.mode = (settings.apiKey && navigator.onLine) ? 'ai' : 'script';
  progress.current = { ch: chId }; saveAll();

  $('scene-location').textContent = ch.place;
  $('scene-goal-text').textContent = ch.quest.title + ' — ' + ch.goal;
  updateModeBadge();
  setupInputUI();
  clearChat();
  setStageCollapsed(!!Store.get('stageCollapsed', 0));
  show('scene');
  appendAction('🎬 ' + ch.quest.intro);
  presentStep();
  // 첫 실행이면 조작법 안내
  if (!Store.get('onboarded')) $('onboard').classList.remove('hidden');
}

function updateModeBadge() {
  const b = $('mode-badge');
  b.textContent = Scene.mode === 'ai' ? 'AI 모드' : '스크립트';
  b.classList.toggle('ai', Scene.mode === 'ai');
}

function curStep() { return Scene.steps[Scene.idx]; }

function stepNpc(step) {
  const ch = currentChapter();
  return ch.npcs[step.npc] || PERSONAS[step.npc] || { role: '현지인', personality: '', style: '' };
}

// 타이핑 효과: 「漢字[よみ]」 토큰 단위로 순차 표시 (XSS 안전: textContent 사용)
function typeLine(el, jp, showFuri) {
  clearInterval(el._ti);
  el.innerHTML = '';
  const tokens = [];
  const re = /([一-龯々〆ヵヶ〇]+)\[([^\]]+)\]/g;
  let last = 0, m;
  while ((m = re.exec(jp))) {
    for (const ch of jp.slice(last, m.index)) tokens.push({ t: ch });
    tokens.push({ t: m[1], r: m[2] });
    last = re.lastIndex;
  }
  for (const ch of jp.slice(last)) tokens.push({ t: ch });
  let i = 0;
  el._ti = setInterval(() => {
    if (i >= tokens.length) { clearInterval(el._ti); return; }
    const tk = tokens[i++];
    if (tk.r && showFuri) {
      const r = document.createElement('ruby');
      r.textContent = tk.t;
      const rt = document.createElement('rt');
      rt.textContent = tk.r;
      r.appendChild(rt);
      el.appendChild(r);
    } else {
      el.appendChild(document.createTextNode(tk.t));
    }
  }, 35);
}

// 남성 목소리를 쓰는 NPC 역할 (클라우드 TTS의 역할별 자동 남/여)
const MALE_NPCS = new Set(['officer', 'stationman', 'taxi', 'police']);

/* ── 대화 로그: 모든 메시지가 시간 순서대로 쌓인다 ── */
function chatEl() { return $('chat-log'); }
function scrollChat() { const el = chatEl(); if (el) el.scrollTop = el.scrollHeight; }
function clearChat() { const el = chatEl(); if (el) el.innerHTML = ''; }
function appendMsg(cls, build) {
  const d = document.createElement('div');
  d.className = cls;
  build(d);
  chatEl().appendChild(d);
  scrollChat();
  return d;
}
function appendAction(text) {
  if (!text) return null;
  return appendMsg('msg-action', d => { d.textContent = text; });
}
function appendHint(text) {
  return appendMsg('msg-hint', d => { d.textContent = text; });
}
// 최신 NPC 대사가 항상 #npc-line 등을 갖도록 이전 메시지의 id를 회수
const NPC_IDS = ['npc-name', 'npc-line', 'npc-furi', 'npc-hangul', 'npc-ko'];
function releaseNpcIds() {
  NPC_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.removeAttribute('id'); });
}
// 내 차례 표시 (아닐 때 입력부 잠금 → 오작동 방지)
function setTurn(playerTurn) {
  const area = document.querySelector('.input-area');
  if (area) area.classList.toggle('waiting', !playerTurn);
}
// 무대(배경) 접기 — 작은 화면에서 대화에 집중
function setStageCollapsed(collapsed) {
  const stage = $('scene-stage');
  stage.classList.toggle('collapsed', collapsed);
  Store.set('stageCollapsed', collapsed ? 1 : 0);
  let show = document.getElementById('stage-show');
  if (collapsed) {
    if (!show) {
      show = document.createElement('button');
      show.id = 'stage-show';
      show.className = 'stage-show';
      show.textContent = '🖼 배경 보기';
      show.addEventListener('click', () => setStageCollapsed(false));
      $('screen-scene').insertBefore(show, stage);
    }
  } else if (show) {
    show.remove();
  }
}

function renderStepBar() {
  const bar = $('step-bar');
  if (!bar) return;
  bar.innerHTML = Scene.steps.map((s, i) =>
    `<span class="step-dot ${i < Scene.idx ? 'done' : i === Scene.idx ? 'now' : ''}"></span>`).join('');
}

// NPC 대사 표시 + TTS
function npcSay(step, lineObj, mood, actionText) {
  const ch = currentChapter();
  const npc = stepNpc(step);
  $('scene-bg').innerHTML = sceneBgSVG(ch.bg, step.bgVariant);
  $('npc-figure').innerHTML = npcSVG(step.npc, mood || 'normal');
  const act = actionText != null ? actionText : step.action;
  appendAction(act);

  releaseNpcIds();
  const wrap = appendMsg('msg msg-npc', d => {
    d.innerHTML =
      `<div class="npc-name" id="npc-name">${esc(npc.role)}</div>` +
      `<div class="npc-line" id="npc-line"></div>` +
      `<div class="npc-furi hidden" id="npc-furi"></div>` +
      `<div class="npc-hangul hidden" id="npc-hangul"></div>` +
      `<div class="npc-ko hidden" id="npc-ko"></div>` +
      `<div class="dialog-tools">` +
      `<button class="chip m-play" title="다시 듣기">🔊</button>` +
      `<button class="chip m-slow" title="천천히">🐢 ゆっくり</button>` +
      `<button class="chip m-ko">한국어 보기</button></div>`;
  });
  const jpEl = wrap.querySelector('.npc-line');
  const showFuri = settings.furigana === 'on' || (settings.furigana === 'auto' && settings.level <= 2);
  typeLine(jpEl, showFuri ? lineObj.jp : plain(lineObj.jp), showFuri);
  // AI 모드: 후리가나가 별도 문자열로 오면 대괄호 표기가 없으므로 작은 줄로 표시
  const furiEl = $('npc-furi');
  const aiFuri = showFuri && lineObj.furigana && !/\[/.test(lineObj.jp) && plain(lineObj.furigana) !== plain(lineObj.jp);
  furiEl.textContent = aiFuri ? plain(lineObj.furigana) : '';
  furiEl.classList.toggle('hidden', !aiFuri);
  // 한글 발음 표기 (완전 초보용)
  const hangulEl = $('npc-hangul');
  if (hangulEnabled()) {
    const kanaSrc = (!/\[/.test(lineObj.jp) && lineObj.furigana) ? lineObj.furigana : lineKana(lineObj.jp);
    const h = kanaToHangul(plain(kanaSrc).replace(/（[^）]*）/g, ''));
    hangulEl.textContent = h ? '🔈 ' + h : '';
    hangulEl.classList.toggle('hidden', !h);
  } else {
    hangulEl.classList.add('hidden');
  }
  Scene.lastNpc = lineObj;

  const koEl = wrap.querySelector('.npc-ko');
  const alwaysKo = settings.subtitle === 'on' || (settings.subtitle === 'auto' && settings.level === 1);
  koEl.textContent = lineObj.ko || '';
  koEl.classList.toggle('hidden', !alwaysKo);
  const koBtn = wrap.querySelector('.m-ko');
  const koBtnVisible = settings.subtitle !== 'off' && lineObj.ko;
  koBtn.classList.toggle('hidden', !koBtnVisible);
  koBtn.textContent = alwaysKo ? '한국어 숨기기' : '한국어 보기';

  Scene.log.push({ role: 'npc', text: plain(lineObj.jp) });
  const jaText = plain(lineObj.jp).replace(/（[^）]*）/g, '');
  // L1은 자동으로 10% 느리게 (초보 배려)
  const npcRate = (Number(settings.rate) || 1) * (settings.level === 1 ? 0.9 : 1);
  const gender = MALE_NPCS.has(step.npc) ? 'male' : 'female';
  // 메시지별 도구: 이 대사만 다시 듣기·천천히·번역 (과거 메시지도 언제든 다시 들을 수 있다)
  wrap.querySelector('.m-play').addEventListener('click', () => Voice.speak(jaText, npcRate, gender));
  wrap.querySelector('.m-slow').addEventListener('click', () => Voice.speak(jaText, 0.65, gender));
  koBtn.addEventListener('click', () => {
    const nowHidden = koEl.classList.toggle('hidden');
    koBtn.textContent = nowHidden ? '한국어 보기' : '한국어 숨기기';
    if (!nowHidden && settings.level >= 3) { Scene.koViews++; if (Scene.koViews === 1) Scene.hintsUsed++; }
  });
  // 대사 표시와 동시에 TTS 재생 (§1.5)
  if (jaText && !/^\(/.test(jaText)) Voice.speak(jaText, npcRate, gender);
  return wrap;
}

function presentStep() {
  const step = curStep();
  if (!step) { endScene(); return; }
  Scene.failCount = 0;
  hideNextButton();
  renderStepBar();
  npcSay(step, step.ask, 'normal');
  if (Scene.mode === 'ai') Scene.history.push({ role: 'assistant', content: plain(step.ask.jp) });
  applyInputMode();
  setTurn(true);
  appendMsg('turn-cue', d => { d.textContent = '👇 이제 당신 차례예요'; });
  $('player-input').focus({ preventScroll: true });
}

/* ── 📋 보기(선택지) 입력 — L1 (기획서 §7: L1 입력 = 선택지·문장 조합) ──
 * 오답 보기는 같은 챕터의 다른 문장에서 뽑아 "그럴듯하지만 상황에 안 맞는" 선택지를 만든다.
 * 보기를 누르면 발음을 들려주고 입력창에 채운다 → 전송은 직접 눌러 "내가 말한다"는 감각을 유지. */
function buildChoices(step) {
  const correct = step.model ? step.model.jp : '';
  if (!correct) return [];
  const ch = currentChapter();
  const pool = [];
  Scene.steps.forEach(s => { if (s !== step && s.model && s.model.jp !== correct) pool.push({ jp: s.model.jp, ko: s.model.ko }); });
  (ch.expressions || []).forEach(e => { if (e.jp !== correct) pool.push({ jp: e.jp, ko: e.ko }); });
  const seen = new Set([normalize(correct)]);
  const distractors = [];
  for (const p of pool.sort(() => Math.random() - 0.5)) {
    const key = normalize(p.jp);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(p);
    if (distractors.length === 2) break;
  }
  const all = [{ jp: correct, ko: step.model.ko }].concat(distractors);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

function renderChoices(step) {
  const area = $('choice-area');
  if (!area) return;
  area.innerHTML = '';
  if (inputMode() !== 'choice' || !step || !step.model) return;
  const showKo = settings.subtitle !== 'off';
  const showFuri = settings.furigana !== 'off';
  buildChoices(step).forEach(opt => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.innerHTML = (showFuri ? rubyHTML(opt.jp) : esc(plain(opt.jp))) +
      (showKo ? `<span class="c-ko">${esc(opt.ko || '')}</span>` : '');
    b.addEventListener('click', () => {
      area.querySelectorAll('.choice').forEach(x => x.classList.remove('picked'));
      b.classList.add('picked');
      const text = plain(opt.jp);
      $('player-input').value = text;
      Voice.speak(text, undefined, 'female'); // 고른 문장을 귀로 확인
    });
    area.appendChild(b);
  });
  const tip = document.createElement('div');
  tip.className = 'choice-tip';
  tip.textContent = '보기를 누르면 읽어줘요 → 소리 내어 따라 말하고 전송!';
  area.appendChild(tip);
}

function inputMode() {
  if (settings.level !== 1) return 'type';
  return settings.inputMode || 'choice';
}
function applyInputMode() {
  const l1 = settings.level === 1;
  const mode = inputMode();
  $('mode-switch').classList.toggle('hidden', !l1);
  $('choice-area').classList.toggle('hidden', mode !== 'choice');
  $('chunk-area').classList.toggle('hidden', mode !== 'chunk');
  document.querySelectorAll('#mode-switch button').forEach(b =>
    b.classList.toggle('on', b.dataset.imode === mode));
  const step = curStep();
  if (mode === 'choice') renderChoices(step);
  if (mode === 'chunk') renderChunks(step);
}

/* ── L1 문장 조합 UI ── */
/* 마이크: 한 번 누르면 녹음 시작 → 말이 끝나고 3초 침묵이면 자동 인식·자동 처리.
 * onText가 있으면 인식 결과를 그 콜백으로(자동 전송), 없으면 입력창에 채움. */
function buildSttHints() {
  const hints = [];
  if (currentScreen === 'scene') {
    const step = curStep();
    if (step) {
      if (step.model) hints.push(plain(step.model.jp));
      (step.expect || []).forEach(g => g.forEach(k => hints.push(plain(String(k)))));
    }
    const ch = currentChapter();
    if (ch) ch.expressions.forEach(e => hints.push(plain(e.jp)));
  } else if (currentScreen === 'training' && Training.queue[Training.idx]) {
    const q = Training.queue[Training.idx];
    if (q.jp) hints.push(plain(q.jp));
  } else if (currentScreen === 'lodging') {
    mistakes.filter(m => m.date === todayStr()).forEach(m => hints.push(plain(m.better)));
  }
  return hints.filter(h => h && h.length >= 2);
}

async function micFinish(btn, inputEl, onText) {
  btn.classList.remove('rec');
  const ph = inputEl.dataset.ph || '日本語で話してみましょう…';
  inputEl.placeholder = '認識中…';
  try {
    const text = await Voice.recStop();
    inputEl.placeholder = ph; // 플레이스홀더는 항상 원래대로 복구
    if (text) {
      if (onText) onText(text); else inputEl.value = text;
    } else if (currentScreen === 'scene') {
      appendHint('🙉 소리가 잘 안 들렸어요. 🎤를 다시 눌러 조금 크게 말해 보세요.');
    }
  } catch (e) {
    inputEl.placeholder = ph;
    alert('음성 인식 실패: ' + e.message + '\n\nAPI 키의 "API 제한사항"에 Cloud Speech-to-Text API가 포함돼 있는지 확인하세요.');
  }
}

async function handleMic(btn, inputEl, onText) {
  if (Voice.cloudSttAvailable()) {
    if (Voice.recActive) {
      micFinish(btn, inputEl, onText); // 수동 종료도 가능
    } else {
      try {
        Voice.sttHints = buildSttHints();
        // 원래 플레이스홀더는 최초 1회만 저장 (안내 문구가 덮어써지지 않도록)
        if (!inputEl.dataset.ph) inputEl.dataset.ph = inputEl.placeholder;
        await Voice.recStart(() => micFinish(btn, inputEl, onText)); // 침묵 3초 → 자동 종료·인식
        btn.classList.add('rec');
        inputEl.placeholder = '🎤 말하세요… 멈추면 자동 인식';
      } catch (e) {
        alert('마이크를 사용할 수 없어요: ' + e.message);
      }
    }
  } else {
    btn.classList.add('rec');
    Voice.listen(t => { if (onText) onText(t); else inputEl.value = t; }, () => btn.classList.remove('rec'));
  }
}

function setupInputUI() {
  applyInputMode();
  $('btn-mic').classList.toggle('hidden', !Voice.micAvailable());
  // 레벨별 헬퍼 노출 (§7: 레벨이 오를수록 힌트 축소)
  document.querySelectorAll('.helper').forEach(b => {
    const h = b.dataset.helper;
    let visible = true;
    if (settings.level >= 3 && (h === 'korean')) visible = false;
    if (settings.level >= 4 && (h === 'keyword' || h === 'meaning' || h === 'korean')) visible = false;
    b.classList.toggle('hidden', !visible);
  });
}

/* L1 문장 조합: 카드는 제자리에 고정. 누르면 ① 그 카드의 읽기를 TTS로 재생
 * ② 누른 순서대로 문장이 입력창에 조합된다. 다시 누르면 선택 해제. 전송은 공용 전송 버튼. */
let chunkSeq = [];
// 모범 문장의 「漢字[よみ]」 쌍으로 카드별 읽기(かな)를 만든다 → 카드 단독 TTS도 정확하게
function chunkReadingMap(step) {
  const map = [];
  const jp = step && step.model ? step.model.jp : '';
  const re = /([一-龯々〆ヵヶ〇]+)\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(jp))) map.push([m[1], m[2]]);
  return map;
}
function readingFor(text, map) {
  let r = text;
  map.forEach(([k, v]) => { r = r.split(k).join(v); });
  return r;
}
// 한글 발음용: 읽기 뒤에 경계 마커(공백)를 넣어 조사 は→와 보정이 작동하게
function readingForMarked(text, map) {
  let r = text;
  map.forEach(([k, v]) => { r = r.split(k).join(v + '\u0000'); });
  return r;
}
function syncChunkInput() {
  $('player-input').value = chunkSeq.map(b => b._text).join('');
}
function updateChunkOrds() {
  chunkSeq.forEach((b, i) => { b.querySelector('.chunk-ord').textContent = i + 1; });
}
function clearChunkSelection(alsoInput) {
  chunkSeq.forEach(b => b.classList.remove('sel'));
  chunkSeq = [];
  if (alsoInput) $('player-input').value = '';
}
function renderChunks(step) {
  if (settings.level !== 1 || !step || !step.model) return;
  const pool = $('chunk-pool');
  pool.innerHTML = '';
  chunkSeq = [];
  const map = chunkReadingMap(step);
  const chunks = (step.chunks || [plain(step.model.jp)]).map(plain);
  for (let i = chunks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [chunks[i], chunks[j]] = [chunks[j], chunks[i]]; }
  const showFuri = settings.furigana === 'on' || (settings.furigana === 'auto' && settings.level <= 2);
  const showHangul = hangulEnabled();
  chunks.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chunk';
    b._text = c;
    b._reading = readingFor(c, map);
    // 카드에도 후리가나(루비)와 한글 발음을 붙여 초보자가 읽을 수 있게
    let annotated = c;
    if (showFuri) map.forEach(([k, v]) => {
      if (!annotated.includes(k + '[')) annotated = annotated.split(k).join(k + '[' + v + ']');
    });
    b.innerHTML = '<span class="chunk-ord"></span>' + (showFuri ? rubyHTML(annotated) : esc(c)) +
      (showHangul ? '<span class="chunk-hangul">' + esc(kanaToHangul(readingForMarked(c, map))) + '</span>' : '');
    b.addEventListener('click', () => {
      const idx = chunkSeq.indexOf(b);
      if (idx >= 0) {
        chunkSeq.splice(idx, 1);
        b.classList.remove('sel');
      } else {
        chunkSeq.push(b);
        b.classList.add('sel');
        Voice.speak(b._reading, undefined, 'female'); // 누른 카드를 바로 읽어준다 (기본 보이스)
      }
      updateChunkOrds();
      syncChunkInput();
    });
    pool.appendChild(b);
  });
}

/* ── 판정 ── */
const hasJapanese = s => /[ぁ-ゖァ-ヶ一-龯ー]/.test(s);
// 프로필 값 추출: 문장 전체가 아니라 핵심 어구만 저장 (후속 스몰토크 문장에 자연스럽게 끼워 넣기 위해)
function extractProfileValue(key, input) {
  const t = input.trim().replace(/^(?:はい[、,]?\s*)?(?:明日|あした|今日|きょう|次|つぎ|来週)[はにも、\s]+/, '');
  if (key === 'stay') {
    const m = t.match(/([0-9０-９一二三四五六七八九十]+\s*(?:日間|週間|か月|ヶ月|泊|日))/);
    if (m) return m[1];
  }
  // 조사·술어 앞부분의 명사구만 남기기 (예: 「ラーメンが一番好きです」→「ラーメン」)
  const m2 = t.match(/^(?:はい[、,]?\s*)?(.+?)(?:が|を|に|は|から|で)\s*(?:一番|大好|好き|来ました|行き|です)/);
  if (m2 && m2[1].length <= 20) return m2[1];
  return t.slice(0, 40);
}
function judgeScript(step, input) {
  if (step.free) return hasJapanese(input) && normalize(input).length >= 2; // 자유 답변도 일본어로 말하게 유도
  if (step.expectBetter) return similarity(input, step.expectBetter) >= 0.45;
  const n = normalize(input);
  return (step.expect || []).every(group => group.some(k => n.includes(normalize(k))));
}

function trackExpressionUse(input) {
  const ch = currentChapter();
  const n = normalize(input);
  ch.expressions.forEach(ex => {
    const core = normalize(ex.jp);
    if (core && (n.includes(core) || similarity(input, ex.jp) >= 0.8)) {
      Scene.usedExpressions.add(ex.jp);
      const card = cards.find(c => c.jp === ex.jp);
      if (card && card.masteryCount < 3) { card.masteryCount++; }
    }
  });
}

function addMistake(corr) {
  const m = {
    mine: corr.mine, better: corr.better, simple: corr.simple || '',
    ko: corr.ko || '', reason: corr.reason || '', tag: corr.tag || 'other',
    date: todayStr(), retried: false, type: corr.type || 'major'
  };
  mistakes.push(m);
  Scene.newMistakes.push(m);
  if (corr.tag) weakTags[corr.tag] = (weakTags[corr.tag] || 0) + 1;
  saveAll();
}

function showCorrectionToast(corr) {
  const el = appendMsg('correction-toast', d => {
    d.innerHTML = `<div class="ct-head">✏️ 이렇게 말하면 더 잘 통해요 (탭하면 자세히)</div>
      <div><span class="ct-mine">${esc(plain(corr.mine))}</span></div>
      <div class="ct-better">→ ${rubyHTML(corr.better)}</div>
      <div class="ct-detail hidden">${esc(corr.ko || '')}\n${esc(corr.reason || '')}${corr.simple ? '\n더 쉽게: ' + esc(plain(corr.simple)) : ''}</div>`;
  });
  el.addEventListener('click', e => {
    if (e.target.closest('ruby')) return; // 단어 사전 탭은 그대로
    el.querySelector('.ct-detail').classList.toggle('hidden');
  });
}

// 내 발화는 항상 대화 로그의 그 시점에 남는다 (지워지지 않음)
function showPlayerBubble(text, viaVoice) {
  appendMsg('player-bubble', d => {
    if (viaVoice) {
      const tag = document.createElement('span');
      tag.className = 'pb-tag';
      tag.textContent = '🎤 내가 말한 것';
      d.appendChild(tag);
    }
    d.appendChild(document.createTextNode(text));
  });
}

/* ── 발음 피드백: 음성 입력이 빗나갔을 때 무엇이 어떻게 들렸는지 알려준다 ── */
function voiceFeedback(step, input) {
  let msg = `🎙 이렇게 들렸어요: 「${plain(input)}」`;
  const missing = [];
  (step.expect || []).forEach(g => {
    if (!g.some(k => normalize(input).includes(normalize(String(k))))) missing.push(plain(String(g[0])));
  });
  const sim = step.model ? similarity(input, step.model.jp) : 0;
  if (sim >= 0.45) msg += '\n발음은 비슷했는데 다른 단어로 인식됐어요!';
  if (missing.length) msg += `\n핵심 단어 「${missing.join('・')}」${step.hintWord ? ` (${step.hintWord})` : ''}가 잘 들리게 또박또박 말해 보세요.`;
  else if (sim < 0.45) msg += '\n조금 다른 이야기로 들렸어요. 목표: ' + (step.model ? step.model.ko : '');
  return msg;
}

/* ── 플레이어 입력 처리 ── */
async function handleInput(raw, fromVoice) {
  const input = raw.trim();
  if (!input || Scene.ended || Scene.transitioning) return;
  Scene.lastFromVoice = !!fromVoice;
  // 카드 조합으로 만든 입력인지 기억 (어순 교정용)
  Scene.lastFromChunks = chunkSeq.length > 0 && input === chunkSeq.map(b => b._text).join('');
  $('player-input').value = '';
  clearChunkSelection(false);
  hideNextButton();
  showPlayerBubble(input, fromVoice);
  setTurn(false); // 답변 처리 중에는 입력 잠금
  Scene.log.push({ role: 'player', text: input });
  trackExpressionUse(input);

  if (Scene.mode === 'ai') {
    Scene.transitioning = true; // 응답 대기 중 중복 입력 방지
    let ok = false;
    try { ok = await handleAI(input); } finally { Scene.transitioning = false; }
    if (ok) return; // AI가 처리함
    Scene.mode = 'script'; updateModeBadge(); // 실패 → 이번 턴부터 스크립트 폴백
  }
  handleScript(input);
}

function handleScript(input) {
  const step = curStep();
  if (!step) return;
  const pass = judgeScript(step, input);

  if (pass) {
    if (step.profileKey && (step.free || step.profileFromAnswer) && !step.reviewOf) {
      profile[step.profileKey] = extractProfileValue(step.profileKey, input); saveAll();
    }
    if (step.reviewOf) { step.reviewOf.retried = true; saveAll(); }
    // 카드를 틀린 순서로 조합했어도 뜻이 통하면 진행하되, 올바른 어순을 알려준다
    if (Scene.lastFromChunks && step.model && !step.free &&
        normalize(input) !== normalize(plain(step.model.jp))) {
      showCorrectionToast({
        mine: input, better: step.model.jp, ko: step.model.ko,
        reason: '뜻은 통했어요! 카드 순서만 이렇게 바꾸면 자연스러운 문장이 됩니다.', simple: ''
      });
      addMistake({
        type: 'minor', mine: input, better: step.model.jp, simple: '',
        ko: step.model.ko, reason: '어순 연습: 카드 순서를 다시 확인해 보세요', tag: step.tag || 'word_order'
      });
    }
    npcSay(step, step.ok, 'happy', step.ok.action || null);
    advanceStep();
  } else if (step.free) {
    // 자유 답변 스텝: 오답 개념이 없다. 일본어 발화만 부드럽게 유도하고, 그래도 어려우면 대화를 잇는다
    Scene.retries++; Scene.failCount++;
    if (Scene.failCount === 1) {
      npcSay(step, { jp: '日本語[にほんご]で、ゆっくりで大丈夫[だいじょうぶ]ですよ！', ko: '일본어로, 천천히 말해도 괜찮아요!' }, 'normal', null);
      appendHint('💡 정답은 없어요. 아는 일본어 단어로 자유롭게! (예: ' + (step.model ? plain(step.model.jp) : '') + ')');
      setTurn(true);
    } else {
      npcSay(step, step.ok, 'normal', '(상대가 미소 지으며 고개를 끄덕였다)');
      advanceStep();
    }
  } else {
    Scene.retries++; Scene.failCount++;
    if (Scene.failCount === 1) {
      npcSay(step, step.retry || { jp: 'すみません、もう一度[いちど]いいですか？', ko: '죄송해요, 한 번 더요?' }, 'confused', null);
      appendHint(Scene.lastFromVoice
        ? voiceFeedback(step, input)
        : '💡 목표: ' + (step.model ? step.model.ko : ''));
      setTurn(true);
    } else if (Scene.failCount === 2) {
      // 2회 실패 → major 교정 카드 + 오답 노트 저장
      addMistake({
        type: 'major', mine: input, better: step.model.jp, simple: '',
        ko: step.model.ko, reason: step.reason || '핵심 단어가 전달되지 않았어요.', tag: step.tag || 'other'
      });
      showCorrectionToast({ mine: input, better: step.model.jp, ko: step.model.ko, reason: step.reason, simple: '' });
      npcSay(step, step.retry || step.ask, 'confused', null);
      setTurn(true);
    } else {
      // 3회째 → 의미가 통한 것으로 하고 대화를 잇는다 (게임은 멈추지 않는다)
      npcSay(step, step.ok, 'normal', '(상대가 상황을 짐작하고 이해해 주었다)');
      advanceStep();
    }
  }
}

/* 다음 스텝은 자동으로 넘어가지 않는다 — NPC의 말을 다 듣고 「다음 ▶」을 눌러야 진행 */
function showNextButton(label, cb) {
  hideNextButton();
  setTurn(false); // 다음을 누르기 전까지 입력부 잠금
  const b = document.createElement('button');
  b.className = 'btn btn-primary btn-next';
  b.id = 'btn-next';
  b.textContent = label;
  b.addEventListener('click', () => { b.remove(); cb(); });
  chatEl().appendChild(b);
  scrollChat();
}
function hideNextButton() {
  const b = $('btn-next');
  if (b) b.remove();
}
function advanceStep() {
  Scene.idx++;
  Scene.transitioning = true; // 다음을 누르기 전에는 입력을 받지 않는다
  renderStepBar();
  const isLast = Scene.idx >= Scene.steps.length;
  showNextButton(isLast ? '🏁 결과 보기' : '다음 ▶', () => {
    Scene.transitioning = false;
    if (isLast) endScene(); else presentStep();
  });
}

/* ── AI 모드 ── */
function buildAIContext() {
  const ch = currentChapter();
  const step = curStep() || {};
  const topWeak = Object.entries(weakTags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  return {
    scene: ch.place + ' — ' + (step.action || ch.quest.intro),
    npc: stepNpc(step),
    quest: {
      goal: ch.goal,
      currentStep: Scene.idx,
      steps: Scene.steps.map(s => (s.model ? s.model.ko : '')),
      stepGoal: step.free ? '자유로운 스몰토크 (정답 없음)' : (step.model ? step.model.ko : ch.goal),
      requiredExpressions: ch.expressions.map(e => plain(e.jp))
    },
    player: {
      level: settings.level, weakTags: topWeak, profile,
      yesterdayMistakes: getYesterdayMistakes().map(m => ({ better: plain(m.better), ko: m.ko }))
    }
  };
}

async function handleAI(input) {
  const step = curStep();
  try {
    const resp = await NPCEngine.chat(settings, buildAIContext(), Scene.history, input);
    Scene.history.push({ role: 'user', content: input });
    Scene.history.push({ role: 'assistant', content: resp.jp || '' });
    Scene.history = Scene.history.slice(-16);

    npcSay(step || Scene.steps[Scene.steps.length - 1],
      { jp: resp.jp || '', ko: resp.ko || '' },
      resp.understood === false ? 'confused' : (resp.questStepClear ? 'happy' : 'normal'),
      resp.action || null);

    if (resp.correction) {
      if (resp.correction.type === 'major') {
        addMistake(resp.correction);
        showCorrectionToast(resp.correction);
      } else {
        Scene.minorQueue.push(resp.correction);
        addMistake(resp.correction);
      }
    }
    if (resp.profileUpdate && typeof resp.profileUpdate === 'object') {
      Object.assign(profile, resp.profileUpdate); saveAll();
    }
    if (resp.nextHint) appendHint('💡 ' + resp.nextHint);
    if (resp.questStepClear) {
      if (step && step.reviewOf) { step.reviewOf.retried = true; saveAll(); }
      if (step && step.profileKey && (step.free || step.profileFromAnswer) && !resp.profileUpdate) { profile[step.profileKey] = extractProfileValue(step.profileKey, input); saveAll(); }
      Scene.idx++;
      Scene.aiCleared++;
      renderStepBar();
      applyInputMode(); // L1: 다음 스텝의 보기·조합 카드로 갱신
    }
    if (Scene.idx >= Scene.steps.length) Scene.aiTurnsAfterClear++;
    if (resp.sceneEnd || Scene.aiTurnsAfterClear > 5) {
      Scene.transitioning = true;
      showNextButton('🏁 결과 보기', () => { Scene.transitioning = false; endScene(); });
    } else {
      setTurn(true); // AI 모드는 같은 대화 안에서 계속 이어진다
    }
    return true;
  } catch (e) {
    console.warn('AI 모드 실패 → 스크립트 폴백:', e);
    return false;
  }
}

/* ── 장면 종료 · 평가 ── */
async function endScene() {
  if (Scene.ended) return;
  Scene.ended = true;
  const ch = currentChapter();

  // 표현 카드·한자 카드 획득
  const newCards = [];
  ch.expressions.forEach(ex => {
    if (!cards.find(c => c.jp === ex.jp)) {
      const card = { jp: ex.jp, furigana: '', ko: ex.ko, scene: ch.title, masteryCount: Scene.usedExpressions.has(ex.jp) ? 1 : 0, note: ex.note || '' };
      cards.push(card); newCards.push(card);
    }
  });

  // 평가
  let evalResult = null;
  if (Scene.mode === 'ai') {
    try {
      evalResult = await NPCEngine.evaluate(settings, {
        scene: ch.place, quest: { goal: ch.goal },
        player: { level: settings.level },
        hintsUsed: Scene.hintsUsed, retries: Scene.retries
      }, Scene.log);
    } catch (e) { /* 로컬 폴백 */ }
  }
  if (!evalResult) evalResult = localEvaluate();

  // addMistake에서 이미 센 태그는 이중 카운트하지 않는다
  const counted = new Set(Scene.newMistakes.map(m => m.tag));
  (evalResult.repeatedErrorTags || []).forEach(t => { if (!counted.has(t)) weakTags[t] = (weakTags[t] || 0) + 1; });

  // 별점: 힌트·재시도 반영
  let stars = 3;
  if (Scene.hintsUsed > 0) stars--;
  if (Scene.retries > 2) stars--;
  stars = Math.max(1, stars);

  const prev = progress.cleared[ch.id];
  progress.cleared[ch.id] = { stars: Math.max(stars, prev ? prev.stars : 0), date: todayStr() };
  if (progress.dayLog.date !== todayStr()) progress.dayLog = { date: todayStr(), scenes: [], expressions: [] };
  if (!progress.dayLog.scenes.includes(ch.id)) progress.dayLog.scenes.push(ch.id);
  Scene.usedExpressions.forEach(jp => { if (!progress.dayLog.expressions.includes(jp)) progress.dayLog.expressions.push(jp); });
  progress.current = null;
  saveAll();

  renderResult(ch, evalResult, stars, newCards);
  show('result');
}

function localEvaluate() {
  const r = Scene.retries, h = Scene.hintsUsed;
  const g = (bad) => bad <= 0 ? 'A' : bad <= 1 ? 'B+' : bad <= 3 ? 'B' : 'C+';
  return {
    grades: { communication: g(r - 1), grammar: g(Scene.newMistakes.length), listening: g(h), natural: g(r), smalltalk: profile && Object.keys(profile).length ? 'A' : 'B' },
    goodExpressions: Array.from(Scene.usedExpressions).map(plain).slice(0, 4),
    reviewExpressions: Scene.newMistakes.map(m => plain(m.better)).slice(0, 3),
    repeatedErrorTags: Scene.newMistakes.map(m => m.tag).filter((t, i, a) => t && a.indexOf(t) === i),
    comment: r <= 1 ? '멋져요! 현지인처럼 자연스럽게 해결했어요. 이 감각 그대로 다음 장소로 가 봐요.' : '조금 헤매도 결국 일본어로 해결해냈다는 게 중요해요. 숙소에서 오늘 표현만 한 번 되짚어 봐요!'
  };
}

function gradeCell(label, g) { return `<div class="grade-cell"><div class="g">${esc(g || '-')}</div><div class="l">${label}</div></div>`; }

function renderResult(ch, ev, stars, newCards) {
  const g = ev.grades || {};
  $('result-body').innerHTML = `
    <div class="stars-big">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    <div class="card"><h3>${esc(ch.icon)} ${esc(ch.title)} — ${esc(ch.quest.title)}</h3>
      <div class="grade-grid">
        ${gradeCell('의사소통', g.communication)}${gradeCell('문법', g.grammar)}${gradeCell('듣기', g.listening)}${gradeCell('자연스러움', g.natural)}${gradeCell('스몰토크', g.smalltalk)}
      </div>
      <p class="ko-small" style="margin-top:10px">${esc(ev.comment || '')}</p>
    </div>
    ${(ev.goodExpressions || []).length ? `<div class="card"><h3>👍 잘 말했어요</h3>${ev.goodExpressions.map(e => `<div class="jp-big">${esc(plain(e))}</div>`).join('')}</div>` : ''}
    ${(ev.reviewExpressions || []).length ? `<div class="card"><h3>🔁 복습하면 좋아요</h3>${ev.reviewExpressions.map(e => `<div class="jp-big">${esc(plain(e))}</div>`).join('')}</div>` : ''}
    ${Scene.minorQueue.length ? `<div class="card"><h3>✏️ 작은 다듬기 포인트</h3>${Scene.minorQueue.map(c => `<div style="margin-bottom:8px"><span class="ko-small">${esc(plain(c.mine))}</span><div class="jp-big">→ ${rubyHTML(c.better)}</div><div class="ko-small">${esc(c.reason || '')}</div></div>`).join('')}</div>` : ''}
    ${newCards.length ? `<div class="card"><h3>🎴 새 표현 카드 ${newCards.length}장</h3>${newCards.map(c => `<div style="margin-bottom:6px"><div class="jp-big">${rubyHTML(c.jp)}</div><div class="ko-small">${esc(c.ko)}</div></div>`).join('')}</div>` : ''}
  `;
}

/* ───────── 숙소(복습) 화면 ───────── */
function renderLodging() {
  const day = progress.dayLog && progress.dayLog.date === todayStr() ? progress.dayLog : { scenes: [], expressions: [] };
  const todayMistakes = mistakes.filter(m => m.date === todayStr());
  const retryTargets = todayMistakes.filter(m => !m.retried).slice(0, 3);
  const sceneList = day.scenes.map(id => CHAPTERS.find(c => c.id === id)).filter(Boolean);
  const todayKanji = sceneList.flatMap(c => KANJI[c.id] || []);
  const nextCh = CHAPTERS.find(c => !progress.cleared[c.id]);

  $('lodging-body').innerHTML = `
    <div class="card"><h3>🗺 오늘 만난 상황</h3>
      ${sceneList.length ? sceneList.map(c => `<div>${c.icon} ${esc(c.title)} — ${esc(c.place)}</div>`).join('') : '<p class="ko-small">오늘 플레이한 장면이 아직 없어요.</p>'}
    </div>
    <div class="card"><h3>💬 오늘 사용한 표현</h3>
      ${day.expressions.length ? day.expressions.map(jp => {
        const c = cards.find(x => x.jp === jp);
        return `<div style="margin-bottom:6px"><div class="jp-big">${rubyHTML(jp)}</div><div class="ko-small">${esc(c ? c.ko : '')} · ${esc(c ? c.scene : '')}</div></div>`;
      }).join('') : '<p class="ko-small">기록된 표현이 없어요.</p>'}
    </div>
    <div class="card"><h3>⚖️ 내 문장 vs 자연스러운 표현</h3>
      ${todayMistakes.length ? todayMistakes.map(m => `
        <div style="margin-bottom:10px">
          <div class="ko-small" style="text-decoration:line-through">${esc(plain(m.mine))}</div>
          <div class="jp-big">→ ${rubyHTML(m.better)}</div>
          <div class="ko-small">${esc(m.ko)} · ${esc(m.reason)}</div>
          ${m.simple ? `<div class="ko-small">더 쉽게: ${esc(plain(m.simple))}</div>` : ''}
        </div>`).join('') : '<p class="ko-small">오늘은 교정받은 문장이 없어요. 완벽!</p>'}
    </div>
    ${todayKanji.length ? `<div class="card"><h3>🈁 새 한자 카드</h3>
      ${todayKanji.map(k => `<div style="margin-bottom:10px">
        <div class="jp-big">${esc(k.kanji)} <span class="ko-small">${esc(k.yomi)} · ${esc(k.mean)}</span></div>
        <div class="ko-small">한국 한자음: ${esc(k.hanja)} / 구성: ${esc(k.parts)}</div>
        <div class="ko-small">💡 ${esc(k.tip)}</div>
        <div class="ko-small">예: ${esc(k.example)}</div>
      </div>`).join('')}</div>` : ''}
    <div class="card"><h3>🎙 다시 말하기 — 오늘 틀린 문장 재도전</h3>
      ${retryTargets.length ? retryTargets.map((m, i) => `
        <div style="margin-bottom:12px">
          <div class="ko-small">${esc(m.ko || plain(m.better))}</div>
          <div class="ko-small">힌트: ${esc(plain(m.better).slice(0, 3))}…</div>
          <div class="retry-box">
            ${Voice.micAvailable() ? `<button class="btn-mic retry-mic" data-i="${i}">🎤</button>` : ''}
            <input type="text" lang="ja" class="retry-input" data-i="${i}" placeholder="일본어로 다시 말해 보세요">
            <button class="btn btn-primary btn-small retry-check" data-i="${i}">확인</button>
          </div>
          <div class="retry-result" data-i="${i}"></div>
        </div>`).join('') : '<p class="ko-small">재도전할 문장이 없어요. 오늘 하루 완벽했네요!</p>'}
    </div>
    <div class="card"><h3>🌅 내일 예고</h3>
      ${nextCh ? `<div>${nextCh.icon} <b>${esc(nextCh.title)}</b> — ${esc(nextCh.place)}</div><p class="ko-small">${esc(nextCh.situation)}</p>` : '<p class="ko-small">모든 챕터를 클리어했어요! 축하합니다 🎉</p>'}
    </div>`;

  const targets = retryTargets;
  $('lodging-body').querySelectorAll('.retry-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.i;
      const input = $('lodging-body').querySelector(`.retry-input[data-i="${i}"]`).value;
      const res = $('lodging-body').querySelector(`.retry-result[data-i="${i}"]`);
      if (similarity(input, targets[i].better) >= 0.5) {
        targets[i].retried = true; saveAll();
        res.innerHTML = `<span class="retry-ok">⭕ 좋아요! ${esc(plain(targets[i].better))}</span>`;
        Voice.speak(plain(targets[i].better));
      } else {
        res.innerHTML = `<span class="ko-small">🤏 조금 달라요. 정답: ${esc(plain(targets[i].better))} — 한 번 더!</span>`;
      }
    });
  });
  $('lodging-body').querySelectorAll('.retry-mic').forEach(btn => {
    const input = $('lodging-body').querySelector(`.retry-input[data-i="${btn.dataset.i}"]`);
    const checkBtn = $('lodging-body').querySelector(`.retry-check[data-i="${btn.dataset.i}"]`);
    btn.addEventListener('click', () => handleMic(btn, input, text => {
      input.value = text;
      checkBtn.click(); // 인식되면 자동 채점
    }));
  });
}

/* ───────── 도감 ───────── */
function renderCollection(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const body = $('collection-body');
  if (tab === 'cards') {
    body.innerHTML = cards.length ? cards.map(c => `
      <div class="card"><div class="jp-big">${rubyHTML(c.jp)}</div>
        <div class="ko-small">${esc(c.ko)} · ${esc(c.scene)}</div>
        <div class="mastery-dots meta">숙달 ${'<span class="on">●</span>'.repeat(Math.min(3, c.masteryCount))}${'<span class="off">●</span>'.repeat(Math.max(0, 3 - c.masteryCount))} ${c.masteryCount >= 3 ? '✨ 숙달!' : ''}</div>
        ${c.note ? `<div class="ko-small" style="white-space:pre-wrap;margin-top:6px">${esc(c.note)}</div>` : ''}
      </div>`).join('') : '<p class="ko-small">퀘스트를 클리어하면 표현 카드가 모여요.</p>';
  } else if (tab === 'mistakes') {
    body.innerHTML = mistakes.length ? mistakes.slice().reverse().map(m => `
      <div class="card">
        <div class="ko-small" style="text-decoration:line-through">${esc(plain(m.mine))}</div>
        <div class="jp-big">→ ${rubyHTML(m.better)}</div>
        <div class="ko-small">${esc(m.ko)}</div>
        <div class="ko-small">${esc(m.reason)}</div>
        <div class="meta">${esc(m.date)} · ${esc(m.tag)} ${m.retried ? '· ✅ 재도전 완료' : ''}</div>
      </div>`).join('') : '<p class="ko-small">아직 오답이 없어요.</p>';
  } else if (tab === 'kana') {
    const ROWS = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの',
      'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わ を ん',
      'がぎぐげご', 'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ'];
    const kataMode = body.dataset.kata === '1';
    const toKata = ch => { const c = ch.codePointAt(0); return (c >= 0x3041 && c <= 0x3096) ? String.fromCodePoint(c + 0x60) : ch; };
    body.innerHTML = `
      <div class="seg" style="margin-bottom:12px">
        <button id="kana-hira" class="${kataMode ? '' : 'on'}">ひらがな</button>
        <button id="kana-kata" class="${kataMode ? 'on' : ''}">カタカナ</button>
      </div>
      <p class="ko-small" style="margin-bottom:10px">글자를 누르면 발음을 들려줘요. 파란 글씨는 한글 발음이에요.</p>
      <div class="kana-grid">
        ${ROWS.map(row => Array.from(row).map(ch => {
          if (ch === ' ') return '<span class="kana-cell empty"></span>';
          const disp = kataMode ? toKata(ch) : ch;
          return `<button class="kana-cell" data-k="${esc(ch)}"><span class="k">${esc(disp)}</span><span class="h">${esc(kanaToHangul(ch))}</span></button>`;
        }).join('')).join('')}
      </div>`;
    body.querySelector('#kana-hira').addEventListener('click', () => { body.dataset.kata = '0'; renderCollection('kana'); });
    body.querySelector('#kana-kata').addEventListener('click', () => { body.dataset.kata = '1'; renderCollection('kana'); });
    body.querySelectorAll('.kana-cell[data-k]').forEach(b => b.addEventListener('click', () => Voice.speak(b.dataset.k, undefined, 'female')));
  } else if (tab === 'songs') {
    body.innerHTML = SONGS.map(s => `
      <div class="card">
        <h3>🎵 ${esc(s.title)} — ${esc(s.artist)}</h3>
        <div class="ko-small">「${esc(s.titleKo)}」</div>
        <div class="jp-big" style="margin-top:10px">${rubyHTML(s.hook.jp)}</div>
        <div class="ko-small">${esc(s.hook.ko)}</div>
        <button class="chip song-play" data-say="${esc(s.hook.read)}" style="margin-top:6px">🔊 이 구절 듣기</button>
      </div>
      <div class="card"><h3>단어</h3>
        ${s.vocab.map(v => `<div style="margin-bottom:9px"><span class="jp-big">${rubyHTML(v.jp)}</span> <button class="chip song-play" data-say="${esc(v.read)}">🔊</button><div class="ko-small">${esc(v.ko)}</div></div>`).join('')}
      </div>
      <div class="card"><h3>문법 포인트</h3>
        ${s.grammar.map(g => `<div style="margin-bottom:12px"><b style="font-size:.9rem">${esc(g.title)}</b><div class="ko-small" style="white-space:pre-wrap;margin-top:3px">${esc(g.body)}</div></div>`).join('')}
      </div>
      <p class="set-note">전체 가사는 저작권 보호 대상이라 싣지 않았어요. 스트리밍 앱에서 곡을 들으며 위 구절을 따라 불러 보세요!</p>`).join('');
    body.querySelectorAll('.song-play').forEach(b => b.addEventListener('click', () => Voice.speak(b.dataset.say, undefined, 'female')));
  } else {
    const learned = Object.keys(progress.cleared);
    const list = learned.flatMap(id => KANJI[id] || []);
    body.innerHTML = list.length ? list.map(k => `
      <div class="card"><div class="jp-big" style="font-size:1.6rem">${esc(k.kanji)}</div>
        <div class="ko-small">${esc(k.yomi)} · ${esc(k.mean)} · 한국음 ${esc(k.hanja)}</div>
        <div class="ko-small">구성: ${esc(k.parts)}</div>
        <div class="ko-small">💡 ${esc(k.tip)}</div>
        <div class="meta">예: ${esc(k.example)}</div>
      </div>`).join('') : '<p class="ko-small">챕터를 클리어하면 한자 카드가 열려요.</p>';
  }
}

/* ───────── 📚 기초 학습 코스 ───────── */
let basicsReturnTo = 'title';
const Quiz = { lesson: null, queue: [], idx: 0, ok: 0 };

function renderBasics() {
  const done = Store.get('basics', {});
  $('basics-body').innerHTML = `
    <p class="ko-small" style="margin-bottom:12px">게임 전에 짚고 가면 훨씬 수월해요. 항목을 누르면 발음을 들려줍니다.</p>
    ${BASICS.map(l => {
      const d = done[l.id];
      return `<button class="card lesson-card" data-lesson="${esc(l.id)}" style="width:100%;text-align:left;font-family:inherit;cursor:pointer;border-width:2px">
        <h3 style="margin-bottom:4px">${esc(l.icon)} ${esc(l.title)} ${d && d.done ? '<span style="color:var(--good)">✓</span>' : ''}</h3>
        <div class="ko-small">${esc(l.sub)}</div>
        <div class="meta">${l.items.length}개 표현${d && d.best ? ` · 퀴즈 최고 ${d.best}/${l.items.length}` : ''}</div>
      </button>`;
    }).join('')}`;
  $('basics-body').querySelectorAll('.lesson-card').forEach(b =>
    b.addEventListener('click', () => openLesson(b.dataset.lesson)));
}

function openLesson(id) {
  const l = BASICS.find(x => x.id === id);
  if (!l) return;
  $('basics-body').innerHTML = `
    <div class="card"><h3>${esc(l.icon)} ${esc(l.title)}</h3>
      <p class="ko-small">${esc(l.point)}</p>
    </div>
    ${l.items.map((it, i) => `
      <div class="card lesson-item" data-i="${i}" style="cursor:pointer">
        <div class="jp-big">${rubyHTML(it.jp)} <span class="chip" style="pointer-events:none">🔊</span></div>
        <div class="ko-small">${esc(it.ko)}</div>
        <div class="meta">💡 ${esc(it.tip)}</div>
      </div>`).join('')}
    <div style="display:flex;gap:8px;margin-bottom:20px">
      <button class="btn btn-secondary btn-small" id="lesson-back" style="flex:1">← 목록</button>
      <button class="btn btn-primary btn-small" id="lesson-quiz" style="flex:1">📝 퀴즈 풀기</button>
    </div>`;
  $('basics-body').querySelectorAll('.lesson-item').forEach(el =>
    el.addEventListener('click', e => {
      if (e.target.closest('ruby')) return; // 단어 사전 탭 우선
      Voice.speak(l.items[+el.dataset.i].read, undefined, 'female');
    }));
  $('lesson-back').addEventListener('click', renderBasics);
  $('lesson-quiz').addEventListener('click', () => startBasicsQuiz(l));
  const done = Store.get('basics', {});
  done[l.id] = Object.assign({}, done[l.id], { done: true });
  Store.set('basics', done);
}

function startBasicsQuiz(lesson) {
  Quiz.lesson = lesson;
  Quiz.queue = shuffleArr(lesson.items);
  Quiz.idx = 0; Quiz.ok = 0;
  basicsQuizStep();
}

function basicsQuizStep() {
  const q = Quiz;
  if (q.idx >= q.queue.length) {
    const done = Store.get('basics', {});
    const prev = (done[q.lesson.id] || {}).best || 0;
    done[q.lesson.id] = Object.assign({}, done[q.lesson.id], { done: true, best: Math.max(prev, q.ok) });
    Store.set('basics', done);
    $('basics-body').innerHTML = `
      <div class="card" style="text-align:center">
        <h3>📝 ${esc(q.lesson.title)} 퀴즈 결과</h3>
        <div class="stars-big">${q.ok} / ${q.queue.length}</div>
        <p class="ko-small">${q.ok === q.queue.length ? '완벽해요! 실전에서 바로 써먹을 수 있겠어요 🎉' : '좋아요! 틀린 것만 다시 보면 금방 익숙해져요.'}</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
          <button class="btn btn-primary btn-small" id="quiz-retry">한 번 더</button>
          <button class="btn btn-secondary btn-small" id="quiz-back">강의로</button>
        </div>
      </div>`;
    $('quiz-retry').addEventListener('click', () => startBasicsQuiz(q.lesson));
    $('quiz-back').addEventListener('click', () => openLesson(q.lesson.id));
    return;
  }
  const it = q.queue[q.idx];
  const others = shuffleArr(q.lesson.items.filter(x => x.ko !== it.ko)).slice(0, 3);
  const opts = shuffleArr([it].concat(others));
  $('basics-body').innerHTML = `
    <div class="card">
      <div class="meta">${q.idx + 1} / ${q.queue.length} · 이 표현의 뜻은?</div>
      <div style="text-align:center;margin:16px 0">
        <div class="jp-big" style="font-size:1.5rem">${rubyHTML(it.jp)}</div>
        <button class="chip" id="bq-say" style="margin-top:8px">🔊 듣기</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${opts.map(o => `<button class="btn btn-secondary btn-small bq-opt" data-ko="${esc(o.ko)}" style="text-align:left">${esc(o.ko)}</button>`).join('')}
      </div>
      <div id="bq-result" style="margin-top:10px"></div>
    </div>`;
  Voice.speak(it.read, undefined, 'female');
  $('bq-say').addEventListener('click', () => Voice.speak(it.read, undefined, 'female'));
  $('basics-body').querySelectorAll('.bq-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const correct = btn.dataset.ko === it.ko;
      if (correct) q.ok++;
      $('basics-body').querySelectorAll('.bq-opt').forEach(b => {
        b.disabled = true;
        if (b.dataset.ko === it.ko) { b.style.borderColor = 'var(--good)'; b.style.background = '#E3F0E9'; }
        else if (b === btn) b.style.borderColor = 'var(--bad)';
      });
      $('bq-result').innerHTML = `${correct ? '<span class="retry-ok">⭕ 정답!</span>' : '<span class="ko-small">✖ 정답은 초록색!</span>'}
        <span class="ko-small"> ${esc(it.tip)}</span>
        <button class="btn btn-primary btn-small" id="bq-next" style="margin-top:8px;width:100%">다음 ▶</button>`;
      $('bq-next').addEventListener('click', () => { q.idx++; basicsQuizStep(); });
    });
  });
}

/* ───────── 🏋️ 특훈 센터 (실전 연습 드릴) ───────── */
const Training = { mode: null, queue: [], idx: 0, ok: 0 };

function shuffleArr(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function renderTraining() {
  const words = Store.get('words', []);
  const mastered = cards.filter(c => c.masteryCount >= 3).length;
  const stat = (n, l) => `<div class="grade-cell"><div class="g">${n}</div><div class="l">${l}</div></div>`;
  $('training-body').innerHTML = `
    <div class="card"><h3>📊 내 실력</h3>
      <div class="grade-grid" style="grid-template-columns:repeat(4,1fr)">
        ${stat(cards.length, '배운 표현')}${stat(mastered, '숙달')}${stat(mistakes.length, '오답')}${stat(words.length, '단어장')}
      </div>
    </div>
    <div class="card"><h3>🎧 섀도잉 — 듣고 따라 말하기</h3>
      <p class="ko-small">문장을 귀로만 듣고 그대로 말해 보세요. 실전 청취력 + 발화 연습. 성공하면 숙달 게이지가 올라요.</p>
      <button class="btn btn-primary btn-small" data-drill="shadow" style="margin-top:8px">시작</button>
    </div>
    <div class="card"><h3>🃏 플래시카드 — 한국어 → 일본어</h3>
      <p class="ko-small">한국어 뜻을 보고 일본어로 말해 보세요. 여행 중 머릿속에서 일어나는 그 과정 그대로!</p>
      <button class="btn btn-primary btn-small" data-drill="flash" style="margin-top:8px">시작</button>
    </div>
    <div class="card"><h3>📖 단어 퀴즈 — 내 단어장 (${words.length}개)</h3>
      <p class="ko-small">대사에서 탭해 모은 한자 단어로 4지선다 퀴즈를 풀어요.</p>
      <button class="btn btn-primary btn-small" data-drill="quiz" style="margin-top:8px" ${words.length < 4 ? 'disabled' : ''}>시작</button>
      ${words.length < 4 ? '<p class="set-note" style="margin-top:6px">대화 중 한자 단어를 4개 이상 탭해서 모으면 열려요!</p>' : ''}
    </div>`;
  $('training-body').querySelectorAll('[data-drill]').forEach(b =>
    b.addEventListener('click', () => startDrill(b.dataset.drill)));
}

function startDrill(mode) {
  if (mode === 'quiz') { startWordQuiz(); return; }
  if (!cards.length) { alert('먼저 퀘스트를 클리어해서 표현 카드를 모아 보세요!'); return; }
  // 숙달 안 된 표현 우선
  const pool = shuffleArr(cards).sort((a, b) => (a.masteryCount || 0) - (b.masteryCount || 0));
  Training.mode = mode;
  Training.queue = pool.slice(0, 8);
  Training.idx = 0;
  Training.ok = 0;
  drillStep();
}

function drillFinish() {
  const t = Training;
  saveAll(); // masteryCount 반영
  $('training-body').innerHTML = `
    <div class="card" style="text-align:center">
      <h3>${t.mode === 'quiz' ? '📖 단어 퀴즈' : t.mode === 'shadow' ? '🎧 섀도잉' : '🃏 플래시카드'} 결과</h3>
      <div class="stars-big">${t.ok} / ${t.queue.length}</div>
      <p class="ko-small">${t.ok === t.queue.length ? '완벽해요! 실전에서도 문제없겠는데요? 🎉' : t.ok >= t.queue.length / 2 ? '좋아요! 틀린 것만 한 번 더 돌면 완성이에요.' : '처음엔 다 그래요. 한 번 더 도전!'}</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
        <button class="btn btn-primary btn-small" id="drill-again">한 번 더</button>
        <button class="btn btn-secondary btn-small" id="drill-home">특훈 홈</button>
      </div>
    </div>`;
  $('drill-again').addEventListener('click', () => startDrill(Training.mode));
  $('drill-home').addEventListener('click', () => renderTraining());
}

function drillStep() {
  const t = Training;
  if (t.idx >= t.queue.length) { drillFinish(); return; }
  const c = t.queue[t.idx];
  const jpPlain = plain(c.jp);
  $('training-body').innerHTML = `
    <div class="card">
      <div class="meta">${t.idx + 1} / ${t.queue.length} · ${t.mode === 'shadow' ? '🎧 듣고 그대로 따라 말하기' : '🃏 한국어를 보고 일본어로'}</div>
      ${t.mode === 'shadow'
        ? `<div class="jp-big" id="drill-jp" style="filter:blur(7px);user-select:none;margin-top:8px">${rubyHTML(c.jp)}</div>
           <div class="ko-small">${esc(c.ko)}</div>
           <div class="dialog-tools">
             <button class="chip" id="drill-play">🔊 다시 듣기</button>
             <button class="chip" id="drill-slow">🐢 천천히</button>
             <button class="chip" id="drill-reveal">👀 문장 보기</button>
           </div>`
        : `<div class="jp-big" style="margin-top:8px">${esc(c.ko)}</div>
           <div class="ko-small">『${esc(c.scene)}』에서 배운 표현</div>`}
      <div class="input-row" style="margin-top:14px">
        ${Voice.micAvailable() ? '<button class="btn-mic" id="drill-mic">🎤</button>' : ''}
        <input id="drill-input" type="text" lang="ja" placeholder="日本語で…" autocomplete="off">
        <button class="btn btn-primary" id="drill-check">확인</button>
      </div>
      <div id="drill-result" style="margin-top:12px"></div>
    </div>`;
  if (t.mode === 'shadow') Voice.speak(jpPlain, undefined, 'female');
  if ($('drill-play')) $('drill-play').addEventListener('click', () => Voice.speak(jpPlain, undefined, 'female'));
  if ($('drill-slow')) $('drill-slow').addEventListener('click', () => Voice.speak(jpPlain, 0.7, 'female'));
  if ($('drill-reveal')) $('drill-reveal').addEventListener('click', () => { $('drill-jp').style.filter = 'none'; });
  const check = () => {
    if ($('drill-check').disabled) return;
    const input = $('drill-input').value.trim();
    if (!input) return;
    const wasVoice = $('drill-input').dataset.voice === '1';
    delete $('drill-input').dataset.voice;
    const sim = similarity(input, c.jp);
    const res = $('drill-result');
    if (sim >= 0.55) {
      t.ok++;
      c.masteryCount = Math.min(3, (c.masteryCount || 0) + 1);
      res.innerHTML = `<div class="retry-ok">⭕ ${esc(jpPlain)}</div>` +
        (c.masteryCount >= 3 ? '<div class="ko-small">✨ 이 표현은 이제 숙달!</div>' : '');
    } else {
      res.innerHTML = (wasVoice ? `<div class="ko-small">🎙 이렇게 들렸어요: 「${esc(plain(input))}」${sim >= 0.4 ? ' — 발음이 비슷한데 조금 달라요!' : ''}</div>` : '') +
        `<div class="ko-small">🤏 정답:</div><div class="jp-big">${rubyHTML(c.jp)}</div>`;
      Voice.speak(jpPlain, undefined, 'female');
    }
    res.innerHTML += '<button class="btn btn-primary btn-small" id="drill-next" style="margin-top:10px">다음 ▶</button>';
    $('drill-next').addEventListener('click', () => { t.idx++; drillStep(); });
    $('drill-check').disabled = true;
  };
  if ($('drill-mic')) $('drill-mic').addEventListener('click', () => handleMic($('drill-mic'), $('drill-input'), text => {
    $('drill-input').value = text;
    $('drill-input').dataset.voice = '1';
    check(); // 인식되면 자동 채점
  }));
  $('drill-check').addEventListener('click', check);
  $('drill-input').addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
}

function startWordQuiz() {
  const words = Store.get('words', []);
  if (words.length < 4) return;
  Training.mode = 'quiz';
  Training.queue = shuffleArr(words).slice(0, 10);
  Training.idx = 0;
  Training.ok = 0;
  quizStep();
}

function quizStep() {
  const t = Training;
  if (t.idx >= t.queue.length) { drillFinish(); return; }
  const w = t.queue[t.idx];
  // 보기: 정답 + 다른 단어 뜻 3개
  const allMeans = Object.values(WORDS).filter(m => m !== w.m);
  const options = shuffleArr([w.m].concat(shuffleArr(allMeans).slice(0, 3)));
  $('training-body').innerHTML = `
    <div class="card">
      <div class="meta">${t.idx + 1} / ${t.queue.length} · 📖 이 단어의 뜻은?</div>
      <div style="text-align:center;margin:14px 0">
        <span class="wp-word" style="font-size:2rem">${esc(w.k)}</span>
        <span class="wp-read">${esc(w.r || '')}</span>
        <button class="chip" id="quiz-say">🔊</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${options.map(o => `<button class="btn btn-secondary btn-small quiz-opt" data-m="${esc(o)}" style="text-align:left">${esc(o)}</button>`).join('')}
      </div>
      <div id="quiz-result" style="margin-top:10px"></div>
    </div>`;
  $('quiz-say').addEventListener('click', () => Voice.speak(w.r || w.k, undefined, 'female'));
  $('training-body').querySelectorAll('.quiz-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const correct = btn.dataset.m === w.m;
      if (correct) t.ok++;
      $('training-body').querySelectorAll('.quiz-opt').forEach(b => {
        b.disabled = true;
        if (b.dataset.m === w.m) { b.style.borderColor = 'var(--good)'; b.style.background = '#E3F0E9'; }
        else if (b === btn) { b.style.borderColor = 'var(--bad)'; }
      });
      $('quiz-result').innerHTML = `${correct ? '<span class="retry-ok">⭕ 정답!</span>' : '<span class="ko-small">✖ 정답은 위 초록색!</span>'}
        <button class="btn btn-primary btn-small" id="quiz-next" style="margin-left:8px">다음 ▶</button>`;
      $('quiz-next').addEventListener('click', () => { t.idx++; quizStep(); });
    });
  });
}

/* ───────── 설정 ───────── */
function fillVoiceSelect() {
  const sel = $('set-voice');
  if (!sel) return;
  const list = Voice.jaVoices();
  const cur = settings.voiceURI || '';
  sel.innerHTML = '<option value="">자동 (최고 품질 선택)</option>' +
    list.map(v => `<option value="${esc(v.voiceURI)}"${v.voiceURI === cur ? ' selected' : ''}>${esc(v.name)}${Voice.rank(v) >= 7 ? ' ⭐고품질' : ''}</option>`).join('');
}
function fillSettings() {
  $('set-name').value = settings.name || '';
  $('set-apikey').value = settings.apiKey || '';
  $('set-model').value = settings.model || '';
  $('set-gtts').value = settings.gttsKey || '';
  const seg = (id, val) => document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('on', b.dataset.v == val));
  seg('set-level', settings.level);
  seg('set-furigana', settings.furigana);
  seg('set-subtitle', settings.subtitle);
  seg('set-rate', settings.rate);
  seg('set-hangul', settings.hangul || 'off');
  seg('set-gender', settings.gttsGender || 'auto');
  $('set-gvoice').value = settings.gttsVoice || Voice.DEFAULT_GVOICE;
  fillVoiceSelect();
}
document.querySelectorAll('.seg').forEach(seg => {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
});

/* ── 탭 단어 사전 팝업: 화면의 <ruby> 한자 단어를 누르면 뜻 표시 + 단어장 자동 수집 ── */
function showWordPop(base, reading) {
  const pop = $('word-pop');
  const mean = (typeof WORDS !== 'undefined' && WORDS[base]) || '';
  const h = hangulEnabled() && reading ? ' · ' + kanaToHangul(reading) : '';
  // 내 단어장에 자동 수집
  let savedNow = false;
  if (mean) {
    const ws = Store.get('words', []);
    if (!ws.find(w => w.k === base)) {
      ws.push({ k: base, r: reading, m: mean, date: todayStr() });
      Store.set('words', ws);
      savedNow = true;
    }
  }
  pop.innerHTML = `<span class="wp-word">${esc(base)}</span><span class="wp-read">${esc(reading)}${esc(h)}</span>` +
    `<button class="chip" id="wp-say">🔊 듣기</button>` +
    (savedNow ? '<span class="wp-saved">📥 단어장 저장!</span>' : '') +
    `<div class="wp-mean">${mean ? esc(mean) : '이 단어의 뜻 정보가 아직 없어요.'}</div>`;
  // 씬에서는 대화 영역 안에 인라인으로 붙여 다른 UI를 가리지 않는다
  const inline = currentScreen === 'scene';
  pop.classList.toggle('inline', inline);
  if (inline) {
    const area = document.querySelector('.dialog-area');
    area.appendChild(pop);
    pop.classList.remove('hidden');
    area.scrollTop = area.scrollHeight;
  } else {
    $('app').appendChild(pop);
    pop.classList.remove('hidden');
  }
  $('wp-say').addEventListener('click', ev => {
    ev.stopPropagation();
    Voice.speak(reading || base, undefined, 'female');
  });
  clearTimeout(pop._t);
  pop._t = setTimeout(() => pop.classList.add('hidden'), 8000);
}

/* ───────── 이벤트 바인딩 ───────── */
function bind() {
  // 한자 단어 탭 → 사전 팝업 (조합 카드 안의 루비는 제외 — 카드는 선택 동작)
  document.addEventListener('click', e => {
    const pop = $('word-pop');
    const r = e.target.closest ? e.target.closest('ruby') : null;
    if (r && !e.target.closest('.chunk') && !e.target.closest('#word-pop')) {
      const rt = r.querySelector('rt');
      const reading = rt ? rt.textContent : '';
      const base = Array.from(r.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (base) { showWordPop(base, reading); return; }
    }
    if (!e.target.closest('#word-pop')) pop.classList.add('hidden');
  });
  $('btn-start').addEventListener('click', () => {
    if (Object.keys(progress.cleared).length && !confirm('처음부터 시작하면 지도 진행 상황은 유지되고, 챕터 1부터 다시 플레이합니다. 계속할까요?')) return;
    startScene('ch1');
  });
  $('btn-continue').addEventListener('click', () => show('map'));
  $('btn-title-settings').addEventListener('click', () => { settingsReturnTo = 'title'; show('settings'); });
  $('btn-title-basics').addEventListener('click', () => { basicsReturnTo = 'title'; show('basics'); });
  $('btn-basics-back').addEventListener('click', () => show(basicsReturnTo));
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nav === 'settings') settingsReturnTo = currentScreen;
    if (b.dataset.nav === 'basics') basicsReturnTo = currentScreen;
    show(b.dataset.nav);
  }));
  // 입력 방식 전환 (보기 / 조합 / 직접)
  $('mode-switch').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    settings.inputMode = b.dataset.imode;
    saveAll();
    applyInputMode();
  });
  $('btn-settings-back').addEventListener('click', () => show(settingsReturnTo));
  $('btn-scene-exit').addEventListener('click', () => {
    if (confirm('장면을 나갈까요? 진행 중인 대화는 사라집니다.')) { speechSynthesis && speechSynthesis.cancel(); show('map'); }
  });

  // 씬: 전송/마이크
  $('btn-send').addEventListener('click', () => handleInput($('player-input').value));
  $('player-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleInput($('player-input').value); });
  // 씬 마이크: 인식되면 자동 전송 (음성 출신 표시 → 발음 피드백)
  $('btn-mic').addEventListener('click', () => handleMic($('btn-mic'), $('player-input'), text => {
    $('player-input').value = text;
    handleInput(text, true);
  }));
  $('btn-onboard-ok').addEventListener('click', () => {
    $('onboard').classList.add('hidden');
    Store.set('onboarded', 1);
  });
  // L1 문장 조합: 지우기 = 선택만 초기화 (카드는 그대로)
  $('btn-chunk-clear').addEventListener('click', () => clearChunkSelection(true));
  // 전송 후 보기 선택 표시도 초기화
  $('btn-send').addEventListener('click', () => {
    const a = $('choice-area');
    if (a) a.querySelectorAll('.choice').forEach(x => x.classList.remove('picked'));
  });

  // 대화 도구
  // 무대 접기/펼치기 (대화에 집중하고 싶을 때)
  $('btn-stage-toggle').addEventListener('click', () => setStageCollapsed(true));

  // 보조 버튼 (§2)
  $('helper-row').addEventListener('click', e => {
    const b = e.target.closest('.helper'); if (!b) return;
    const step = curStep();
    switch (b.dataset.helper) {
      case 'again':
        if (Voice.lastText) Voice.speak(Voice.lastText);
        Scene.log.push({ role: 'player', text: 'もう一度お願いします' });
        break;
      case 'slow':
        Voice.slow();
        Scene.log.push({ role: 'player', text: 'もう少しゆっくり話してください' });
        break;
      case 'meaning': {
        const koEl = $('npc-ko');
        if (koEl) {
          koEl.classList.remove('hidden');
          const btn = koEl.parentElement.querySelector('.m-ko');
          if (btn) btn.textContent = '한국어 숨기기';
          scrollChat();
        }
        Scene.log.push({ role: 'player', text: 'どういう意味ですか？' });
        if (settings.level >= 3) Scene.hintsUsed++;
        break;
      }
      case 'keyword': {
        if (!step || !step.model) break;
        appendHint('🔑 핵심 단어: ' + (step.hintWord || plain(step.model.jp).slice(0, 6)));
        Scene.hintsUsed++;
        break;
      }
      case 'korean': {
        if (!step) break;
        if (Scene.koHintUsed) { appendHint('🇰🇷 한국어 힌트는 장면당 1회예요! 이미 사용했어요.'); break; }
        Scene.koHintUsed = true; Scene.hintsUsed++;
        appendHint('🇰🇷 ' + (step.hintKo || (step.model ? step.model.ko : '')));
        break;
      }
    }
  });

  // 결과 화면
  $('btn-result-map').addEventListener('click', () => show('map'));
  $('btn-result-lodging').addEventListener('click', () => show('lodging'));

  // 도감 탭
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => renderCollection(t.dataset.tab)));

  // 목소리 미리 듣기 (선택 중인 보이스·클라우드 키 반영, 클라우드 실패 시 원인 표시)
  $('btn-voice-test').addEventListener('click', async () => {
    settings.voiceURI = $('set-voice').value;
    settings.gttsKey = $('set-gtts').value.trim();
    settings.gttsVoice = $('set-gvoice').value;
    Voice.pick();
    const sample = 'こんにちは。ようこそ、日本へ！良い旅を。';
    if (settings.gttsKey) {
      try {
        Voice.lastText = sample;
        Voice.stop();
        await Voice.cloudSpeak(sample, Number(settings.rate) || 1);
        return; // 클라우드 성공
      } catch (e) {
        alert('⚠️ 구글 클라우드 TTS 실패\n\n' + e.message +
          '\n\n흔한 원인:\n· 프로젝트에 결제 계정 미연결 (무료 한도라도 연결 필요)\n· 키의 웹사이트 제한 주소 오타\n· 제한 변경 후 반영 대기(약 5분)\n\n기기 내장 음성으로 대신 재생합니다.');
        Voice.localSpeak(sample, Number(settings.rate) || 1);
        return;
      }
    }
    Voice.speak(sample);
  });

  // 설정 저장
  $('btn-save-settings').addEventListener('click', () => {
    const segVal = id => { const b = document.querySelector(`#${id} button.on`); return b ? b.dataset.v : null; };
    settings.level = Number(segVal('set-level') || settings.level);
    settings.furigana = segVal('set-furigana') || settings.furigana;
    settings.subtitle = segVal('set-subtitle') || settings.subtitle;
    settings.rate = segVal('set-rate') || settings.rate;
    settings.hangul = segVal('set-hangul') || settings.hangul || 'off';
    settings.name = $('set-name').value.trim() || settings.name;
    settings.apiKey = $('set-apikey').value.trim();
    settings.model = $('set-model').value.trim();
    settings.voiceURI = $('set-voice').value;
    settings.gttsKey = $('set-gtts').value.trim();
    settings.gttsVoice = $('set-gvoice').value;
    settings.gttsGender = segVal('set-gender') || 'auto';
    Voice.pick();
    saveAll();
    alert('저장했어요!');
    show(settingsReturnTo);
  });
  $('btn-reset-data').addEventListener('click', () => {
    if (!confirm('진행·오답·도감 데이터를 모두 삭제할까요? (설정은 유지)')) return;
    ['progress', 'profile', 'mistakes', 'cards', 'weakTags'].forEach(k => Store.del(k));
    progress = { cleared: {}, dayLog: { date: todayStr(), scenes: [], expressions: [] } };
    profile = {}; mistakes = []; cards = []; weakTags = {};
    alert('초기화했어요.');
    show('title');
  });
}

/* ───────── PWA: SW 등록 + 설치 배너 ───────── */
let deferredPrompt = null;
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    $('install-banner').classList.remove('hidden');
  });
  $('btn-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('install-banner').classList.add('hidden');
  });
  $('btn-install-close').addEventListener('click', () => $('install-banner').classList.add('hidden'));
  window.addEventListener('online', () => { if (currentScreen === 'scene' && settings.apiKey && !Scene.ended) { Scene.mode = 'ai'; updateModeBadge(); } });
  window.addEventListener('offline', () => { if (currentScreen === 'scene') { Scene.mode = 'script'; updateModeBadge(); } });
}

/* ───────── 부팅 ───────── */
window.addEventListener('DOMContentLoaded', () => {
  Voice.init();
  bind();
  setupPWA();
  show('title');
});
