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

let settings = Store.get('settings', { apiKey: '', model: '', level: 1, furigana: 'auto', subtitle: 'auto', rate: 1, name: 'キム', voiceURI: '', gttsKey: '' });
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
  stop() {
    if (this.audio) { try { this.audio.pause(); } catch (e) {} this.audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  },
  speak(text, rate) {
    if (!text) return;
    this.lastText = text;
    this.stop();
    // 억양이 살도록 말줄임표·괄호를 쉼표/무음으로 정리
    const clean = text.replace(/……|…/g, '、').replace(/[（）()]/g, ' ');
    const r = rate || Number(settings.rate) || 1;
    if (settings.gttsKey) {
      this.cloudSpeak(clean, r).catch(() => this.localSpeak(clean, r)); // 실패 시 기기 음성 폴백
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
  // Google Cloud TTS (Neural2): 월 100만 자 무료. 같은 문장은 메모리 캐시로 재사용해 호출 절약
  async cloudSpeak(clean, r) {
    const key = clean + '|' + r;
    let b64 = this.cloudCache.get(key);
    if (!b64) {
      const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(settings.gttsKey), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: { text: clean },
          voice: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: r }
        })
      });
      if (!res.ok) throw new Error('gtts ' + res.status);
      b64 = (await res.json()).audioContent;
      if (!b64) throw new Error('gtts empty');
      if (this.cloudCache.size > 300) this.cloudCache.clear();
      this.cloudCache.set(key, b64);
    }
    this.audio = new Audio('data:audio/mp3;base64,' + b64);
    await this.audio.play();
  },
  slow() { if (this.lastText) this.speak(this.lastText, 0.7); },
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
const SCREENS = ['title', 'map', 'scene', 'result', 'lodging', 'collection', 'settings'];
let currentScreen = 'title';
let settingsReturnTo = 'title';

function show(name) {
  SCREENS.forEach(s => $('screen-' + s).classList.toggle('hidden', s !== name));
  currentScreen = name;
  if (name === 'map') renderMap();
  if (name === 'lodging') renderLodging();
  if (name === 'collection') renderCollection('cards');
  if (name === 'settings') fillSettings();
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
  show('scene');
  presentStep();
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

// NPC 대사 표시 + TTS
function npcSay(step, lineObj, mood, actionText) {
  const ch = currentChapter();
  const npc = stepNpc(step);
  $('scene-bg').innerHTML = sceneBgSVG(ch.bg, step.bgVariant);
  $('npc-figure').innerHTML = npcSVG(step.npc, mood || 'normal');
  const act = actionText != null ? actionText : step.action;
  $('scene-action').classList.toggle('hidden', !act);
  if (act) $('scene-action').textContent = act;

  $('npc-name').textContent = npc.role;
  const jpEl = $('npc-line');
  const showFuri = settings.furigana === 'on' || (settings.furigana === 'auto' && settings.level <= 2);
  typeLine(jpEl, showFuri ? lineObj.jp : plain(lineObj.jp), showFuri);
  // AI 모드: 후리가나가 별도 문자열로 오면 대괄호 표기가 없으므로 작은 줄로 표시
  const furiEl = $('npc-furi');
  const aiFuri = showFuri && lineObj.furigana && !/\[/.test(lineObj.jp) && plain(lineObj.furigana) !== plain(lineObj.jp);
  furiEl.textContent = aiFuri ? plain(lineObj.furigana) : '';
  furiEl.classList.toggle('hidden', !aiFuri);
  Scene.lastNpc = lineObj;

  const koEl = $('npc-ko');
  const alwaysKo = settings.subtitle === 'on' || (settings.subtitle === 'auto' && settings.level === 1);
  koEl.textContent = lineObj.ko || '';
  koEl.classList.toggle('hidden', !alwaysKo);
  const koBtnVisible = !alwaysKo && settings.subtitle !== 'off' && (settings.level <= 3 || settings.subtitle === 'on');
  $('btn-show-ko').classList.toggle('hidden', !koBtnVisible || !lineObj.ko);

  Scene.log.push({ role: 'npc', text: plain(lineObj.jp) });
  // 대사 표시와 동시에 TTS 재생 (§1.5)
  const jaText = plain(lineObj.jp).replace(/（[^）]*）/g, '');
  if (jaText && !/^\(/.test(jaText)) Voice.speak(jaText);
  $('quest-hint').classList.add('hidden');
}

function presentStep() {
  const step = curStep();
  if (!step) { endScene(); return; }
  Scene.failCount = 0;
  npcSay(step, step.ask, 'normal');
  if (Scene.mode === 'ai') Scene.history.push({ role: 'assistant', content: plain(step.ask.jp) });
  renderChunks(step);
}

/* ── L1 문장 조합 UI ── */
function setupInputUI() {
  const l1 = settings.level === 1;
  $('chunk-area').classList.toggle('hidden', !l1);
  $('btn-mic').classList.toggle('hidden', !Voice.sttSupported());
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
  chunks.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chunk';
    const ord = document.createElement('span');
    ord.className = 'chunk-ord';
    b.appendChild(ord);
    b.appendChild(document.createTextNode(c));
    b._text = c;
    b._reading = readingFor(c, map);
    b.addEventListener('click', () => {
      const idx = chunkSeq.indexOf(b);
      if (idx >= 0) {
        chunkSeq.splice(idx, 1);
        b.classList.remove('sel');
      } else {
        chunkSeq.push(b);
        b.classList.add('sel');
        Voice.speak(b._reading); // 누른 카드를 바로 읽어준다
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
  const el = $('correction-toast');
  el.innerHTML = `<div class="ct-head">✏️ 이렇게 말하면 더 잘 통해요 (탭하면 자세히)</div>
    <div><span class="ct-mine">${esc(plain(corr.mine))}</span></div>
    <div class="ct-better">→ ${rubyHTML(corr.better)}</div>
    <div class="ct-detail hidden">${esc(corr.ko || '')}\n${esc(corr.reason || '')}${corr.simple ? '\n더 쉽게: ' + esc(plain(corr.simple)) : ''}</div>`;
  el.classList.remove('hidden');
  el.onclick = () => el.querySelector('.ct-detail').classList.toggle('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.querySelector('.ct-detail').classList.contains('hidden') && el.classList.add('hidden'); }, 8000);
}

function showPlayerBubble(text) {
  const area = document.querySelector('.dialog-area');
  const old = area.querySelector('.player-bubble');
  if (old) old.remove();
  const div = document.createElement('div');
  div.className = 'player-bubble'; div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

/* ── 플레이어 입력 처리 ── */
async function handleInput(raw) {
  const input = raw.trim();
  if (!input || Scene.ended || Scene.transitioning) return;
  $('player-input').value = '';
  clearChunkSelection(false);
  showPlayerBubble(input);
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
    npcSay(step, step.ok, 'happy', step.ok.action || null);
    advanceStep();
  } else if (step.free) {
    // 자유 답변 스텝: 오답 개념이 없다. 일본어 발화만 부드럽게 유도하고, 그래도 어려우면 대화를 잇는다
    Scene.retries++; Scene.failCount++;
    if (Scene.failCount === 1) {
      npcSay(step, { jp: '日本語[にほんご]で、ゆっくりで大丈夫[だいじょうぶ]ですよ！', ko: '일본어로, 천천히 말해도 괜찮아요!' }, 'normal', null);
      const qh = $('quest-hint');
      qh.textContent = '💡 정답은 없어요. 아는 일본어 단어로 자유롭게! (예: ' + (step.model ? plain(step.model.jp) : '') + ')';
      qh.classList.remove('hidden');
    } else {
      npcSay(step, step.ok, 'normal', '(상대가 미소 지으며 고개를 끄덕였다)');
      advanceStep();
    }
  } else {
    Scene.retries++; Scene.failCount++;
    if (Scene.failCount === 1) {
      npcSay(step, step.retry || { jp: 'すみません、もう一度[いちど]いいですか？', ko: '죄송해요, 한 번 더요?' }, 'confused', null);
      const qh = $('quest-hint');
      qh.textContent = '💡 목표: ' + (step.model ? step.model.ko : '');
      qh.classList.remove('hidden');
    } else if (Scene.failCount === 2) {
      // 2회 실패 → major 교정 카드 + 오답 노트 저장
      addMistake({
        type: 'major', mine: input, better: step.model.jp, simple: '',
        ko: step.model.ko, reason: step.reason || '핵심 단어가 전달되지 않았어요.', tag: step.tag || 'other'
      });
      showCorrectionToast({ mine: input, better: step.model.jp, ko: step.model.ko, reason: step.reason, simple: '' });
      npcSay(step, step.retry || step.ask, 'confused', null);
    } else {
      // 3회째 → 의미가 통한 것으로 하고 대화를 잇는다 (게임은 멈추지 않는다)
      npcSay(step, step.ok, 'normal', '(상대가 상황을 짐작하고 이해해 주었다)');
      advanceStep();
    }
  }
}

function advanceStep() {
  Scene.idx++;
  Scene.transitioning = true;
  if (Scene.idx >= Scene.steps.length) {
    setTimeout(() => { Scene.transitioning = false; endScene(); }, 1600);
  } else {
    setTimeout(() => { Scene.transitioning = false; presentStep(); }, 1900);
  }
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
    if (resp.nextHint) {
      const qh = $('quest-hint');
      qh.textContent = '💡 ' + resp.nextHint;
      qh.classList.remove('hidden');
    }
    if (resp.questStepClear) {
      if (step && step.reviewOf) { step.reviewOf.retried = true; saveAll(); }
      if (step && step.profileKey && (step.free || step.profileFromAnswer) && !resp.profileUpdate) { profile[step.profileKey] = extractProfileValue(step.profileKey, input); saveAll(); }
      Scene.idx++;
      Scene.aiCleared++;
      renderChunks(curStep()); // L1: 다음 스텝의 문장 조합 카드로 갱신
    }
    if (Scene.idx >= Scene.steps.length) Scene.aiTurnsAfterClear++;
    if (resp.sceneEnd || Scene.aiTurnsAfterClear > 5) {
      setTimeout(() => endScene(), 1800);
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
            ${Voice.sttSupported() ? `<button class="btn-mic retry-mic" data-i="${i}">🎤</button>` : ''}
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
    btn.addEventListener('click', () => {
      btn.classList.add('rec');
      Voice.listen(text => {
        $('lodging-body').querySelector(`.retry-input[data-i="${btn.dataset.i}"]`).value = text;
      }, () => btn.classList.remove('rec'));
    });
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
    body.querySelectorAll('.song-play').forEach(b => b.addEventListener('click', () => Voice.speak(b.dataset.say)));
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
  fillVoiceSelect();
}
document.querySelectorAll('.seg').forEach(seg => {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
});

/* ───────── 이벤트 바인딩 ───────── */
function bind() {
  $('btn-start').addEventListener('click', () => {
    if (Object.keys(progress.cleared).length && !confirm('처음부터 시작하면 지도 진행 상황은 유지되고, 챕터 1부터 다시 플레이합니다. 계속할까요?')) return;
    startScene('ch1');
  });
  $('btn-continue').addEventListener('click', () => show('map'));
  $('btn-title-settings').addEventListener('click', () => { settingsReturnTo = 'title'; show('settings'); });
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nav === 'settings') settingsReturnTo = currentScreen;
    show(b.dataset.nav);
  }));
  $('btn-settings-back').addEventListener('click', () => show(settingsReturnTo));
  $('btn-scene-exit').addEventListener('click', () => {
    if (confirm('장면을 나갈까요? 진행 중인 대화는 사라집니다.')) { speechSynthesis && speechSynthesis.cancel(); show('map'); }
  });

  // 씬: 전송/마이크
  $('btn-send').addEventListener('click', () => handleInput($('player-input').value));
  $('player-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleInput($('player-input').value); });
  $('btn-mic').addEventListener('click', () => {
    const btn = $('btn-mic');
    btn.classList.add('rec');
    Voice.listen(text => { $('player-input').value = text; }, () => btn.classList.remove('rec'));
  });
  // L1 문장 조합: 지우기 = 선택만 초기화 (카드는 그대로)
  $('btn-chunk-clear').addEventListener('click', () => clearChunkSelection(true));

  // 대화 도구
  $('btn-replay').addEventListener('click', () => Voice.lastText && Voice.speak(Voice.lastText));
  $('btn-slow').addEventListener('click', () => Voice.slow());
  $('btn-show-ko').addEventListener('click', () => {
    const koEl = $('npc-ko');
    koEl.classList.toggle('hidden');
    if (!koEl.classList.contains('hidden') && settings.level >= 3) { Scene.koViews++; if (Scene.koViews === 1) Scene.hintsUsed++; }
  });

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
        $('npc-ko').classList.remove('hidden');
        Scene.log.push({ role: 'player', text: 'どういう意味ですか？' });
        if (settings.level >= 3) Scene.hintsUsed++;
        break;
      }
      case 'keyword': {
        if (!step) break;
        const qh = $('quest-hint');
        qh.textContent = '🔑 핵심 단어: ' + (step.hintWord || plain(step.model.jp).slice(0, 6));
        qh.classList.remove('hidden');
        Scene.hintsUsed++;
        break;
      }
      case 'korean': {
        if (!step) break;
        if (Scene.koHintUsed) { alert('한국어 힌트는 장면당 1회예요!'); break; }
        Scene.koHintUsed = true; Scene.hintsUsed++;
        const qh = $('quest-hint');
        qh.textContent = '🇰🇷 ' + (step.hintKo || (step.model ? step.model.ko : ''));
        qh.classList.remove('hidden');
        break;
      }
    }
  });

  // 결과 화면
  $('btn-result-map').addEventListener('click', () => show('map'));
  $('btn-result-lodging').addEventListener('click', () => show('lodging'));

  // 도감 탭
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => renderCollection(t.dataset.tab)));

  // 목소리 미리 듣기 (선택 중인 보이스·클라우드 키 반영)
  $('btn-voice-test').addEventListener('click', () => {
    settings.voiceURI = $('set-voice').value;
    settings.gttsKey = $('set-gtts').value.trim();
    Voice.pick();
    Voice.speak('こんにちは。ようこそ、日本へ！良い旅を。');
  });

  // 설정 저장
  $('btn-save-settings').addEventListener('click', () => {
    const segVal = id => { const b = document.querySelector(`#${id} button.on`); return b ? b.dataset.v : null; };
    settings.level = Number(segVal('set-level') || settings.level);
    settings.furigana = segVal('set-furigana') || settings.furigana;
    settings.subtitle = segVal('set-subtitle') || settings.subtitle;
    settings.rate = segVal('set-rate') || settings.rate;
    settings.name = $('set-name').value.trim() || settings.name;
    settings.apiKey = $('set-apikey').value.trim();
    settings.model = $('set-model').value.trim();
    settings.voiceURI = $('set-voice').value;
    settings.gttsKey = $('set-gtts').value.trim();
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
