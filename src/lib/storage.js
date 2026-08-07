const KEYS = {
  customWords: 'jp_manabu_custom_words_v1',
  progress: 'jp_manabu_progress_v1',
  settings: 'jp_manabu_settings_v1',
  streak: 'jp_manabu_streak_v1',
  review: 'jp_manabu_review_v1',   // 회독 상태 { cardId: {box, streak, lastSeen, ...} }
  session: 'jp_manabu_session_v1', // 진행 중 세션 (이어하기)
  stats: 'jp_manabu_stats_v1',     // 일별 학습 집계
  vault: 'jp_manabu_vault_v1',     // 계정 비밀번호에서 파생한 금고 열쇠 (비밀번호 자체는 저장하지 않는다)
  seen: 'jp_manabu_signed_in_v1',  // 이 기기에서 로그인한 적이 있는지 (오프라인 잠김 방지)
  memos: 'jp_manabu_memos_v1',     // 단어별 암기 메모 { 카드id: { text, at } }
};

// 저장 실패를 조용히 삼키면 사용자가 학습 기록이 날아간 걸 모른다.
// 화면에서 이 콜백을 받아 토스트로 알린다.
let onWriteError = null;
export function setStorageErrorHandler(fn) {
  onWriteError = fn;
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    const full = err?.name === 'QuotaExceededError' || err?.code === 22;
    onWriteError?.(full ? '저장 공간이 가득 찼어요. 설정에서 백업 후 정리해 주세요.' : '학습 기록을 저장하지 못했어요.');
    return false;
  }
}

export function loadCustomWords() {
  return read(KEYS.customWords, []);
}
export function saveCustomWords(words) {
  write(KEYS.customWords, words);
}

const DEFAULT_PROGRESS = { known: [], unknown: [], grammarDone: {}, sentenceDone: {}, bookmarks: [] };
export function loadProgress() {
  return { ...DEFAULT_PROGRESS, ...read(KEYS.progress, {}) };
}
export function saveProgress(progress) {
  write(KEYS.progress, progress);
}

/* ── 회독 상태 ── */

export function loadReview() {
  return read(KEYS.review, {});
}
export function saveReview(review) {
  write(KEYS.review, review);
}

/* ── 진행 중 세션 (이어하기) ── */

export function loadSession() {
  return read(KEYS.session, null);
}
export function saveSession(session) {
  if (session) write(KEYS.session, session);
  else {
    try { localStorage.removeItem(KEYS.session); } catch { /* 무시 */ }
  }
}

/* ── 일별 집계 (최근 60일만 유지) ── */

export function loadStats() {
  return read(KEYS.stats, {});
}
export function saveStats(stats) {
  const days = Object.keys(stats).sort();
  const trimmed = days.length > 60
    ? Object.fromEntries(days.slice(-60).map((d) => [d, stats[d]]))
    : stats;
  write(KEYS.stats, trimmed);
}

/* ── 단어 메모 ──
 * "스베루 → 미끄러졌다" 같은 개인 연상법. 남이 만든 설명보다 자기가 붙인 게 잘 붙는다.
 * 기기 두 대에서 각각 고쳤을 때 어느 쪽을 남길지 알아야 해서 고친 시각을 함께 담는다. */

export function loadMemos() {
  return read(KEYS.memos, {});
}
export function saveMemos(memos) {
  write(KEYS.memos, memos);
}

/* ── 금고 열쇠 ──
 * 계정 비밀번호에서 만든 파생 열쇠. 비밀번호 원문은 어디에도 남기지 않는다.
 * 이 기기는 어차피 API 키 원문을 갖고 있어야 하므로, 열쇠를 함께 두는 것이
 * 노출을 늘리지 않는다. 지키려는 대상은 서버에 쌓인 데이터다. */

export function loadVaultKey() {
  try { return localStorage.getItem(KEYS.vault) || null; } catch { return null; }
}
export function saveVaultKey(rawBase64) {
  try {
    if (rawBase64) localStorage.setItem(KEYS.vault, rawBase64);
    else localStorage.removeItem(KEYS.vault);
  } catch { /* 무시 */ }
}

/* 이 기기에서 로그인한 적이 있는지. 세션이 만료됐는데 오프라인이라
 * 갱신을 못 할 때, 학습이 통째로 잠기는 것을 막는 용도다. */
export function markSignedInOnce() {
  try { localStorage.setItem(KEYS.seen, '1'); } catch { /* 무시 */ }
}
export function hasSignedInOnce() {
  try { return localStorage.getItem(KEYS.seen) === '1'; } catch { return false; }
}

/* ── 설정 ── */

export const DEFAULT_SETTINGS = {
  onboarded: false,

  // 온보딩 2문항
  canReadKana: null,  // true면 한자 앞면, false면 히라가나+한글 발음 앞면
  tripDay: null,      // 'd3' | 'd7' | 'd14' | 'none'

  // 홈 허브에 노출할 메뉴 (설정에서 개별 on/off)
  menus: {
    basics: true,     // 완전기초
    grammar: true,    // 기초문법
    words: true,      // 단어암기
    sentences: true,  // 상황별 문장암기
    rpg: false,       // 실전연습(여행 RPG) — 아직 이관 전이라 기본 off
  },

  // 학습 기능
  autoTTS: true,      // 카드가 뜨면 자동으로 읽어주기
  showKana: false,    // 앞면에 히라가나 함께 표시
  showExample: true,  // 뒷면에 예문 표시
  hangulPron: false,  // 한글 근사 발음 표기

  // 하루 분량 — 복습 섞기 + 신규로 끊어서 학습한다
  newPerDay: 50,      // 하루에 새로 볼 단어 수
  reviewMix: 15,      // 그날 함께 섞을 복습(틀린 것) 수
  levels: ['N5'],     // 학습할 JLPT 레벨. 비우면 전체

  dailyGoal: 20,      // 남겨 둔 예전 설정 (복습 덱·취약 덱에서 쓴다)
  shuffle: true,
  direction: 'kanji-mean', // 'kanji-mean' | 'mean-kanji' | 'kanji-kana'

  speechRate: 0.9,
  gttsVoice: 'ja-JP-Neural2-B',  // 클라우드 목소리
  deviceVoiceURI: '',            // 기기 내장 음성 중 고른 것
  gttsKey: '',        // Google Cloud TTS 키 (기존 앱에서 쓰던 키를 그대로 물려받는다)
  useCloudTTS: true,

  theme: 'dark',      // 'system' | 'light' | 'dark'
  notifications: true,
  level: 'basic',
};

// 기존 여행 RPG 앱(jtrip_settings)에 저장해 둔 Google TTS 키를 그대로 가져온다.
// 사용자가 키를 다시 입력하지 않아도 되게 하기 위한 1회성 승계.
function inheritLegacyTTSKey() {
  try {
    const raw = localStorage.getItem('jtrip_settings');
    if (!raw) return '';
    const legacy = JSON.parse(raw);
    return typeof legacy?.gttsKey === 'string' ? legacy.gttsKey : '';
  } catch {
    return '';
  }
}

export function loadSettings() {
  const saved = read(KEYS.settings, {});
  const merged = {
    ...DEFAULT_SETTINGS,
    ...saved,
    menus: { ...DEFAULT_SETTINGS.menus, ...(saved.menus || {}) },
  };
  if (!merged.gttsKey) merged.gttsKey = inheritLegacyTTSKey();
  return merged;
}

export function saveSettings(settings) {
  write(KEYS.settings, settings);
}

/* ── 스트릭 ── */

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 앱 시작 시 1회 호출 — 오늘 처음 방문이면 스트릭을 갱신한다.
// 하루 빠졌다고 0으로 되돌리지 않고 이틀까지는 봐준다(하루 놓치면 접어버리는 것을 막는다).
export function touchStreak() {
  const s = read(KEYS.streak, { count: 0, lastDate: null });
  const today = todayKey();
  if (s.lastDate === today) return s;

  let gap = Infinity;
  if (s.lastDate) {
    const [y1, m1, d1] = s.lastDate.split('-').map(Number);
    const [y2, m2, d2] = today.split('-').map(Number);
    gap = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  }

  const next = { count: gap <= 2 ? s.count + 1 : 1, lastDate: today };
  write(KEYS.streak, next);
  return next;
}

export function loadStreak() {
  return read(KEYS.streak, { count: 0, lastDate: null });
}

/* ── 백업 / 복원 ──
 * localStorage가 유일한 저장소라 브라우저가 데이터를 비우면 학습 기록이 전부 사라진다.
 * iOS Safari는 앱을 오래 안 쓰면 사이트 데이터를 지우므로 백업은 부가 기능이 아니라 방어선이다. */

export const BACKUP_FORMAT = 'js-japanese-backup';

export function exportBackup() {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      customWords: read(KEYS.customWords, []),
      progress: read(KEYS.progress, {}),
      settings: read(KEYS.settings, {}),
      streak: read(KEYS.streak, { count: 0, lastDate: null }),
      review: read(KEYS.review, {}),
      stats: read(KEYS.stats, {}),
      memos: read(KEYS.memos, {}),
    },
  };
}

export function backupSummary(backup) {
  const d = backup?.data || {};
  const reviewed = Object.keys(d.review || {}).length;
  const days = Object.keys(d.stats || {}).sort();
  return {
    customWords: (d.customWords || []).length,
    reviewed,
    streak: d.streak?.count || 0,
    lastDate: days.length ? days[days.length - 1] : null,
  };
}

// 부분 병합은 충돌 규칙이 배보다 커진다 — 전체 교체만 지원한다.
export function importBackup(backup) {
  if (backup?.format !== BACKUP_FORMAT || !backup?.data) {
    throw new Error('이 파일은 JS일본어 백업 파일이 아니에요.');
  }
  const d = backup.data;
  write(KEYS.customWords, d.customWords || []);
  write(KEYS.progress, { ...DEFAULT_PROGRESS, ...(d.progress || {}) });
  write(KEYS.settings, d.settings || {});
  write(KEYS.streak, d.streak || { count: 0, lastDate: null });
  write(KEYS.review, d.review || {});
  write(KEYS.stats, d.stats || {});
  write(KEYS.memos, d.memos || {});
  saveSession(null);
}

export function clearAll() {
  for (const key of Object.values(KEYS)) {
    try { localStorage.removeItem(key); } catch { /* 무시 */ }
  }
}
