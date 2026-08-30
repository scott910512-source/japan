import { shapeTranslation } from './translate.js';
import { normalizeGoals } from './daily.js';

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
  videos: 'jp_manabu_videos_v1',   // 영상으로 배우기 — 담아 둔 영상 목록
  videoAnalyses: 'jp_manabu_video_analyses_v1', // 영상별 설명 자료 (있을 때만)
  videoScripts: 'jp_manabu_video_scripts_v1',   // 붙여넣은 자막 — 이걸로 학습하니 기기에 남긴다
  videoProgress: 'jp_manabu_video_progress_v1', // 영상별 학습 진도 — 어디까지 했는지
  videoRemoved: 'jp_manabu_video_removed_v1',   // 뺀 영상의 묘비 — 아래 설명 참고
  translations: 'jp_manabu_translations_v1',    // 번역기에서 받아 둔 것 — 현지에서 다시 본다
  trends: 'jp_manabu_trends_v1',                // 요즘 일본어 — 받아 둔 목록과 받은 날
  asks: 'jp_manabu_asks_v1',                    // 공부하다 물어본 것 — 비행기 모드에서도 다시 본다
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

/* 담아 둔 영상 목록.
 *
 * 한 번도 저장한 적이 없으면 null을 돌려준다 — 처음 켠 사람과 전부 빼 버린
 * 사람을 구별해야 한다. []로 뭉개면 마지막 영상을 뺀 순간 기본 영상이 되살아난다. */
export function loadVideos() {
  return read(KEYS.videos, null);
}
export function saveVideos(list) {
  write(KEYS.videos, list);
}
export function loadVideoAnalyses() {
  return read(KEYS.videoAnalyses, {});
}
export function saveVideoAnalyses(map) {
  write(KEYS.videoAnalyses, map);
}
export function loadVideoScripts() {
  return read(KEYS.videoScripts, {});
}
export function saveVideoScripts(map) {
  write(KEYS.videoScripts, map);
}
export function loadVideoProgress() {
  return read(KEYS.videoProgress, {});
}
export function saveVideoProgress(map) {
  write(KEYS.videoProgress, map);
}

/* 뺀 영상의 묘비 { 영상id: 뺀 시각 }.
 *
 * 기기 두 대를 합칠 때 목록을 그냥 합치면, 아이폰에서 뺀 영상이 아이패드에
 * 남아 있다가 다음 동기화에 되살아난다. "뺐다"도 기록해야 사라진 채로 있는다.
 * 다시 담으면 addedAt이 묘비보다 새로워져서 되살아난다. */
/* 번역기에서 받아 둔 것.
 *
 * 여행 중에는 인터넷이 끊기거나 아까운 데이터를 아껴야 할 때가 있다. 한 번
 * 받아 둔 건 비행기 모드에서도 다시 볼 수 있어야 한다. 오래된 것부터 버려서
 * 저장 공간이 넘치지 않게 한다 — 여행 하루치면 충분하다. */
const TRANSLATION_KEEP = 50;

export function loadTranslations() {
  /* 옛날에 받아 둔 것은 지금 화면이 기대하는 칸이 없을 수 있다. 읽을 때
     맞춰 준다 — 안 그러면 기능을 더할 때마다 옛 기록이 화면을 죽인다. */
  return read(KEYS.translations, []).map(shapeTranslation);
}
export function saveTranslations(list) {
  write(KEYS.translations, list.slice(0, TRANSLATION_KEEP));
}

/* 요즘 일본어. { at: 받은시각, items: [...] }
 *
 * 언제 받았는지를 같이 남긴다 — 유행어는 낡는다. 석 달 전에 받은 걸
 * 오늘 것처럼 보여 주면 안 알려 주느니만 못하다. */
export function loadTrends() {
  return read(KEYS.trends, null);
}
export function saveTrends(data) {
  write(KEYS.trends, data);
}

export function loadVideoRemoved() {
  return read(KEYS.videoRemoved, {});
}
export function saveVideoRemoved(map) {
  write(KEYS.videoRemoved, map);
}

export function loadCustomWords() {
  return read(KEYS.customWords, []);
}
export function saveCustomWords(words) {
  write(KEYS.customWords, words);
}

const DEFAULT_PROGRESS = {
  known: [], unknown: [], grammarDone: {}, sentenceDone: {}, bookmarks: [],
  // 동사 활용 성적 — forms는 그룹×모양별, words는 동사별
  conj: { forms: {}, words: {} },
  /* 실전 연습 — EXP와 스테이지별 기록.
     표현의 숙련도는 여기 안 넣는다. 그건 회독 저장소에 들어간다 —
     두 벌로 갈라 놓으면 반드시 어긋난다. */
  rpg: { exp: 0, stages: {} },
};
export function loadProgress() {
  const saved = read(KEYS.progress, {});
  /* 활용 성적은 나중에 생겼다. 그 전에 저장된 기록에는 칸이 없거나 반만 있어서,
     화면에서 바로 꺼내 쓰면 터진다 — 번역기에서 똑같이 당했다. */
  return {
    ...DEFAULT_PROGRESS,
    ...saved,
    conj: { forms: saved?.conj?.forms || {}, words: saved?.conj?.words || {} },
    rpg: { exp: saved?.rpg?.exp || 0, stages: saved?.rpg?.stages || {} },
  };
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

/* ── 공부하다 물어본 것 ──
 * 같은 걸 두 번 물으면 요금만 두 번 나가고, 비행기 안에서도 아까 받은 답은
 * 다시 볼 수 있어야 한다. 최근 것만 남긴다(ask.js의 KEEP_ASKS). */
export function loadAsks() {
  const v = read(KEYS.asks, []);
  return Array.isArray(v) ? v : [];
}
export function saveAsks(asks) {
  write(KEYS.asks, asks);
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
    repeat: true,     // 회독 학습 — 배운 걸 등급별로 다시
    jlpt: true,       // JLPT 레벨별 단어
    sentences: true,  // 상황별 문장암기
    quiz: true,       // 단어 시험
    conjugate: true,  // 동사 활용 — 기초 시제
    match: true,      // 짝 맞추기 — 게임으로
    rpg: true,        // 실전 연습 — 상황을 통째로
    translate: true,  // 번역기 — 현지에서 바로 쓰는 것
  },

  // 학습 기능
  autoTTS: true,      // 카드가 뜨면 자동으로 읽어주기
  speakOnJudge: false, // 답을 고를 때 그 단어를 한 번 더 읽어주기
  // 영상 설명을 만들 곳. 키는 모두 이 기기에만 저장하고 서버로 보내지 않는다.
  aiProvider: 'gemini', // gemini | claude
  videoTranscribe: false, // 영상을 직접 듣게 할지 — 요금이 많이 들어 기본은 끔
  tripPlace: '',      // 어디로 가는지 (예: 오사카) — 번역기가 그 지역 사투리도 봐 준다
  geminiKey: '',        // 비워 두면 음성 키(gttsKey)를 그대로 쓴다 — 같은 형식이다
  geminiModel: '',      // 비우면 기본값, 설정에서 목록을 받아 고를 수 있다
  claudeKey: '',
  claudeModel: '',     // 비우면 기본 모델
  showKana: false,    // 앞면에 히라가나 함께 표시
  showExample: true,  // 뒷면에 예문 표시
  hangulPron: false,  // 한글 근사 발음 표기
  autoMic: false,     // 뜻을 연 순간 마이크를 자동으로 켜기 (권한을 한 번 준 뒤부터)

  // 하루 분량 — 복습 섞기 + 신규로 끊어서 학습한다
  levels: ['N5'],     // 학습할 JLPT 레벨. 비우면 전체

  // 시험 — 회독과 따로 돈다. 마지막에 고른 설정을 기억해 둔다.
  quizCount: 20,
  quizType: 'choice',   // 'choice' | 'typing' | 'mix'
  quizDir: 'jp-ko',     // 'jp-ko' | 'ko-jp' | 'mix'
  quizScope: 'all',     // 'all' | 'seen' | 'weak'

  /* 하루 목표. 갈래마다 따로 센다 — 복습이 밀렸다고 새로 배우는 걸 뺏지 않는다.
     dailyGoal은 옛 이름이다. 읽을 때 goals로 펴 주고, 화면은 goals만 본다. */
  goals: { fresh: 20, review: 20, weak: 20 },
  dailyGoal: 20,      // (옛 설정) 숫자 하나였던 시절
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
    /* 목표가 셋으로 갈라지기 전에 저장된 기록에는 goals 칸이 없다. 그때 쓰던
       숫자 하나를 세 갈래에 그대로 펴 준다 — 20장 하던 사람이 갑자기 60장이
       되지 않게, 자기가 정한 값을 그대로 쓴다. */
    goals: normalizeGoals(saved.goals ?? saved.dailyGoal ?? DEFAULT_SETTINGS.goals),
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

/* 오늘 첫 판정 때 부른다 — 앱을 켠 것만으로는 안 오른다.
 *
 * 예전엔 앱 시작에서 무조건 불렀다. 기록을 전부 비우고 앱만 켜도 10일째가
 * 11일째가 됐다. 화면 셋이 "하루 한 장이라도 하면 이어져요"라고 적어 두고
 * 한 장도 안 한 사람에게 했다고 말한 것이다. 관대한 것과 거짓은 다르다.
 *
 * 하루 빠졌다고 0으로 되돌리진 않는다. 이틀까지는 봐준다 — 하루 놓쳤다고
 * 접어버리는 게 이 숫자가 막으려는 일이다. */
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
