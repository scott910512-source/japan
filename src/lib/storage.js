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
  plan: 'jp_manabu_plan_v1',                    // 오늘의 계획 — 배정과 완료를 날짜별로 적어 둔다
};

// 저장 실패를 조용히 삼키면 사용자가 학습 기록이 날아간 걸 모른다.
// 화면에서 이 콜백을 받아 토스트로 알린다.
let onWriteError = null;
export function setStorageErrorHandler(fn) {
  onWriteError = fn;
}

/* ★ 성공도 알려야 한다 ★
 *
 * 저장 실패를 잠깐 뜨는 토스트로만 알렸다. 두 걸음 걷고 나면 사라지는데,
 * 그 사이 기록은 계속 저장되지 않는다 — 공간이 찬 기기에서는 그날 공부한
 * 것이 전부 날아간다. 그래서 실패를 화면에 남겨 두기로 했는데, 남기려면
 * 언제 내려야 하는지도 알아야 한다. 성공 신호가 그 답이다. */
let onWriteOk = null;
export function setStorageOkHandler(fn) {
  onWriteOk = fn;
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
    /* 자주 불리는 자리다 — 받는 쪽이 「지금 표시가 켜져 있을 때만」 끄도록
       해서 이 신호가 화면을 다시 그리게 하지 않는다. */
    onWriteOk?.();
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

/* ── 오늘의 계획 ──
 * 부를 때마다 새로 계산하면 신규 20개를 끝내도 다음 20개가 곧바로 채워서
 * 「오늘 할 것」이 끝이 없는 목록이 된다. 하루치를 한 번 정해서 적어 둔다. */
export function loadPlan() {
  return read(KEYS.plan, null);
}
export function savePlan(plan) {
  if (plan) write(KEYS.plan, plan);
  else { try { localStorage.removeItem(KEYS.plan); } catch { /* 무시 */ } }
}

export function loadCustomWords() {
  return read(KEYS.customWords, []);
}
export function saveCustomWords(words) {
  write(KEYS.customWords, words);
}

const DEFAULT_PROGRESS = {
  known: [], unknown: [], grammarDone: {}, sentenceDone: {}, bookmarks: [],
  // 일상문법 빈칸 채우기 — { 묶음id: { right, total, at } }
  dailyGrammar: {},
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
    dailyGrammar: saved?.dailyGrammar || {},
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

/* ── 일별 집계 ──
 *
 * 최근 이만큼만 남긴다. 기록 화면의 달력은 얼마든지 과거로 갈 수 있어서,
 * 이 숫자를 화면도 알아야 한다 — 모르면 버린 달을 「안 한 달」로 그린다. */
export const STATS_KEEP_DAYS = 60;

export function loadStats() {
  return read(KEYS.stats, {});
}
export function saveStats(stats) {
  const days = Object.keys(stats).sort();
  const trimmed = days.length > STATS_KEEP_DAYS
    ? Object.fromEntries(days.slice(-STATS_KEEP_DAYS).map((d) => [d, stats[d]]))
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

  // 온보딩
  canReadKana: null,  // true면 한자 앞면, false면 히라가나+한글 발음 앞면
  /* ★ 무엇을 하려고 배우나 ★
     'jlpt' 시험 | 'trip' 여행 | 'talk' 회화.
     무엇을 먼저 배정할지를 정한다(lib/purpose.js). 기록은 안 건드린다 —
     목적을 바꿨다고 외운 게 사라지면 아무도 못 바꾼다. */
  purpose: 'talk',
  /* 실제 출발일(YYYY-MM-DD). 없으면 null.
     예전엔 「3일 이내」 같은 선택을 tripDay에 넣어 두고 날짜처럼 썼다.
     그건 고른 날의 이야기라 사흘이 지나면 거짓말이 된다. */
  tripDate: null,
  tripDay: null,      // (옛 설정) 'd3' | 'd7' | 'd14' | 'none' — 읽기만 한다

  /* 학습 탭에 노출할 메뉴 (설정에서 개별 on/off).
     묶음은 lib/menu.js가 정한다 — 배우기 · 연습하기 · 반복하기. */
  menus: {
    // 배우기
    words: true,      // 단어 — 회독으로 반복해서 외우기
    grammar: true,    // 문법 — 기초문법 · 일상문법 · 문형 연습
    sentences: true,  // 상황회화 — 이동 · 식당 · 일상
    basics: true,     // 완전기초 — 히라가나 · 숫자 · 인사
    // 연습하기
    quiz: true,       // 단어 시험
    conjugate: true,  // 동사 활용 — 기초 시제
    adverb: true,     // 부사 연습 — 빈칸 채우기
    match: true,      // 짝 맞추기 — 게임으로
    rpg: true,        // 실전 연습 — 상황을 통째로
    // 반복하기
    repeat: true,     // 회독 학습 — 배운 걸 등급별로 다시
    weak: true,       // 약점 복습 — 세 번 넘게 틀린 것만
  },

  // 학습 기능
  autoTTS: true,      // 카드가 뜨면 자동으로 읽어주기
  listenSayKo: true,  // 듣기 화면에서 뜻도 소리로 (기기 한국어 음성)
  listenDir: 'jp-ko',     // 'jp-ko' 듣고 뜻 떠올리기 | 'ko-jp' 뜻 듣고 일본어로 말하기
  listenScope: 'today',   // 'today' | 'seen' | 'weak' | 'all' — 무엇을 들을지
  listenSayAnswer: true,  // 뒤집은 판에서 정답(일본어)도 소리로 낼지
  listenGap: 2,       // 문장 사이 뜸 (초)
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
  /* 문장에는 아직 레벨이 안 붙어 있다. 근거 없이 붙이지 않기로 했으니
     「미분류」로 남는데, 그걸 새 학습에 넣을지 말지는 고를 수 있어야 한다.
     기본은 넣는 쪽 — 빼면 지금 자료로는 문장이 통째로 사라진다. */
  sentenceScope: 'all',   // 'all' 미분류도 포함 | 'level' 레벨이 맞는 것만
  /* 답을 보기 전에도 판정할 수 있게 할까.
   *
   * 기본은 끈다. 답을 보기 전에 판정하면 「떠올렸나」가 아니라 「떠올린 것
   * 같나」를 적게 되고, 그러면 회독 기록이 실력을 안 재게 된다.
   *
   * 대신 끄지는 않는다. 아는 것만 많은 회독에서는 카드마다 한 번 더 두드리는
   * 게 전부 마찰이라, 익숙해진 사람은 켜서 예전처럼 쓸 수 있다. */
  quickJudge: false,

  // 시험 — 회독과 따로 돈다. 마지막에 고른 설정을 기억해 둔다.
  quizCount: 20,
  quizType: 'choice',   // 'choice' | 'typing' | 'mix'
  quizDir: 'jp-ko',     // 'jp-ko' | 'ko-jp' | 'mix'
  quizScope: 'all',     // 'all' | 'seen' | 'weak'

  /* 하루 목표. 갈래마다 따로 센다 — 복습이 밀렸다고 새로 배우는 걸 뺏지 않는다.
     dailyGoal은 옛 이름이다. 읽을 때 goals로 펴 주고, 화면은 goals만 본다. */
  /* 총 스무 장. 셋을 각각 20으로 두었더니 자료가 쌓인 뒤 하루가 예순 장이
     됐다 — 처음 쓰는 사람이 첫날에 접는 양이다. 갈래 배분은 daily.js가 정한다.
     이미 저장된 목표가 있으면 아래 loadSettings가 그걸 쓴다. */
  goals: { fresh: 8, review: 9, weak: 3 },
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
 * 접어버리는 게 이 숫자가 막으려는 일이다.
 *
 * ★ 그런데 화면이 이 관용을 「하루도 안 빠지고」라고 불렀다 ★
 *
 * 규칙은 그대로 둔다. 하루 놓친 사람을 0으로 되돌리는 게 이 숫자의 목적이
 * 아니고, 지금 이어 가는 사람의 기록을 규칙을 바꿔 끊을 이유도 없다.
 * 대신 규칙을 그대로 말한다 — 관대한 것과 거짓은 다르다. */

/* 며칠까지 쉬어도 이어 주나. 화면 문구도 이 값에서 만든다. */
export const STREAK_GRACE_DAYS = 1;
export const STREAK_RULE = '하루 쉬어도 이어져요 · 이틀 쉬면 처음부터';

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

  const next = { count: gap <= STREAK_GRACE_DAYS + 1 ? s.count + 1 : 1, lastDate: today };
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
export const BACKUP_VERSION = 2;

/* ★ 「전체 백업」이라고 부르면 전체여야 한다 ★
 *
 * 여태 스무 개 칸 중 일곱 개만 담았다. 담아 둔 영상, 붙여넣은 자막, 영상별
 * 진도, 받아 둔 번역, 공부하다 물어본 것, 요즘 일본어, 오늘의 계획이 빠졌다.
 * 빠진 걸 모르고 「현재 기록을 완전히 교체」라고 안내했으니, 브라우저가
 * 사이트 데이터를 비운 뒤에야 없다는 걸 알게 되는 구조였다.
 *
 * 그래서 무엇을 담는지 여기 한 줄씩 적어 둔다. 새 칸을 만들면 이 표에도
 * 넣어야 한다 — 표에 없으면 백업에도 없다. 화면은 이 표를 그대로 읽어
 * 내보내기 전에 「무엇이 들어가는지」를 보여 준다. */
const BACKUP_ITEMS = [
  { key: 'customWords', label: '내가 넣은 단어', fallback: [] },
  { key: 'review', label: '회독 기록', fallback: {} },
  { key: 'progress', label: '학습 진도', fallback: {} },
  { key: 'stats', label: '일별 활동 기록', fallback: {} },
  { key: 'streak', label: '연속 학습일', fallback: { count: 0, lastDate: null } },
  { key: 'memos', label: '단어 메모', fallback: {} },
  { key: 'settings', label: '설정', fallback: {} },
  /* videos와 trends는 「아직 없음」과 「비어 있음」이 다르다. 없을 때 null로
     두는 쪽이 loadVideos·loadTrends의 규칙이라 여기서도 null로 맞춘다 —
     []로 적어 두면 「한 번도 안 담았다」가 「전부 뺐다」로 바뀐다. */
  { key: 'videos', label: '담아 둔 영상', fallback: null },
  { key: 'videoScripts', label: '붙여넣은 자막', fallback: {} },
  { key: 'videoAnalyses', label: '영상 설명 자료', fallback: {} },
  { key: 'videoProgress', label: '영상 학습 진도', fallback: {} },
  { key: 'videoRemoved', label: '뺀 영상 표시', fallback: {} },
  { key: 'translations', label: '받아 둔 번역', fallback: [] },
  { key: 'trends', label: '요즘 일본어', fallback: null },
  { key: 'asks', label: '물어본 것', fallback: [] },
  { key: 'plan', label: '오늘의 계획', fallback: null },
];

/* ★ 비밀값은 백업 파일에 넣지 않는다 ★
 *
 * 백업은 사용자가 메일로 보내고 드라이브에 올리고 메신저로 옮기는 파일이다.
 * 그런데 settings를 통째로 담고 있었고, settings에는 음성·AI API 키가
 * 평문으로 들어 있다. 키가 든 JSON이 그렇게 돌아다니면 요금은 남이 쓰고
 * 청구는 주인에게 간다.
 *
 * 동기화 쪽은 이미 이 구분을 하고 있다(merge.js의 SYNCED_SETTINGS — 「음성
 * API 키는 자격 증명이라 서버에 올리지 않는다」). 백업만 안 하고 있었다.
 * 기기 사이로 키를 옮기는 길은 그대로 있다 — 계정 동기화가 암호화한 봉투로
 * 보낸다. 파일로 내보내는 길만 막는다. */
const SECRET_SETTINGS = ['gttsKey', 'geminiKey'];

/* 백업에 안 담는 것과 그 이유. 화면이 이걸 그대로 보여 준다 —
   무엇이 빠지는지 내보내기 전에 알아야 뒤늦게 없다는 걸 알지 않는다. */
export const BACKUP_EXCLUDED = [
  {
    label: '음성 · AI API 키',
    why: '백업 파일에 비밀값을 넣지 않아요. 계정 동기화로 옮기거나 기기마다 다시 넣어 주세요.',
  },
  {
    label: '진행 중이던 학습(이어하기)',
    why: '복원한 기기에서는 새로 시작해요. 회독 기록은 그대로 남습니다.',
  },
  {
    label: '로그인 상태 · 금고 열쇠',
    why: '기기마다 다른 값이라 옮기지 않아요.',
  },
];

/* 백업에 실제로 담긴 것을 항목별로 센다. 내보내기 전에도(exportBackup의
   결과를 넣어서), 복원 전에도(받은 파일을 넣어서) 같은 함수로 보여 준다. */
export function backupContents(backup) {
  const d = backup?.data || {};
  return BACKUP_ITEMS.map(({ key, label }) => {
    const v = d[key];
    let n = null;
    if (Array.isArray(v)) n = v.length;
    else if (v && typeof v === 'object') n = Object.keys(v).length;
    return { key, label, count: n, present: v !== undefined && v !== null };
  });
}

export function exportBackup() {
  const data = {};
  for (const { key, fallback } of BACKUP_ITEMS) {
    data[key] = read(KEYS[key], fallback);
  }
  /* 설정은 담되 비밀값만 뺀다. 설정을 통째로 빼면 학습 범위·음성 속도까지
     잃으니, 뺄 것만 뺀다. */
  if (data.settings && typeof data.settings === 'object') {
    const clean = { ...data.settings };
    for (const k of SECRET_SETTINGS) delete clean[k];
    data.settings = clean;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
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

/* 복원할 값을 만든다. 저장하기 전에 다 만들어 둬야 반쯤 쓰다 마는 일이 없다. */
function restorePayload(d) {
  const out = [];
  for (const { key, fallback } of BACKUP_ITEMS) {
    let value = d[key];
    if (value === undefined || value === null) {
      /* 옛 백업에는 없던 칸이다. 없는 칸을 기본값으로 덮어써 지우지 않는다 —
         v1 백업으로 복원했다고 이 기기의 영상·자막이 사라지면 안 된다. */
      if (fallback === null) continue;
      if (!Object.prototype.hasOwnProperty.call(d, key)) continue;
      value = fallback;
    }
    if (key === 'progress') value = { ...DEFAULT_PROGRESS, ...(value || {}) };
    if (key === 'settings') {
      /* ★ 백업에 키가 없다고 이 기기의 키를 지우면 안 된다 ★
         비밀값을 백업에서 뺀 결과로 복원이 키를 날려 버리면, 새는 곳을
         막으려다 쓰던 기능을 끄는 셈이다. 이 기기 값을 남긴다. */
      const mine = read(KEYS.settings, {});
      const merged = { ...(value || {}) };
      for (const k of SECRET_SETTINGS) {
        if (!merged[k] && mine?.[k]) merged[k] = mine[k];
      }
      value = merged;
    }
    out.push([KEYS[key], value]);
  }
  return out;
}

/* 부분 병합은 충돌 규칙이 배보다 커진다 — 전체 교체만 지원한다.
 *
 * ★ 다 저장된 것을 확인하고서 성공이라고 한다 ★
 *
 * 여태 write()를 열 번 부르고 성공 여부를 한 번도 안 봤다. write는 실패하면
 * false를 주고 토스트를 띄우는데, 부르는 쪽이 그걸 버렸다. 그래서 저장 공간이
 * 가득 찬 기기에서 앞의 몇 개만 저장되고도 화면은 「복원했어요」라고 했다 —
 * 사용자는 기록이 돌아온 줄 알고 원본 파일을 지울 수 있다.
 *
 * 이제 쓰기 전에 지금 값을 떠 두고, 하나라도 실패하면 떠 둔 값으로 되돌린다.
 * 반쯤 덮인 상태로 남기지 않는다 — 그게 원래 기록도 백업도 아닌 제일 나쁜 칸이다. */
export function importBackup(backup) {
  if (backup?.format !== BACKUP_FORMAT || !backup?.data) {
    throw new Error('이 파일은 JS일본어 백업 파일이 아니에요.');
  }
  const payload = restorePayload(backup.data);
  if (!payload.length) {
    throw new Error('이 백업에는 되돌릴 기록이 없어요.');
  }

  // 되돌릴 때 쓸 지금 값. 없던 칸은 null로 적어 둬야 「지우기」로 되돌린다.
  const before = payload.map(([key]) => {
    let raw = null;
    try { raw = localStorage.getItem(key); } catch { raw = null; }
    return [key, raw];
  });
  const rollback = () => {
    for (const [key, raw] of before) {
      try {
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch { /* 되돌리기까지 막히면 더 할 수 있는 게 없다 */ }
    }
  };

  for (const [key, value] of payload) {
    if (!write(key, value)) {
      rollback();
      throw new Error('기록을 저장하지 못해 되돌렸어요. 저장 공간을 비우고 다시 시도해 주세요.');
    }
  }
  saveSession(null);
}

export function clearAll() {
  for (const key of Object.values(KEYS)) {
    try { localStorage.removeItem(key); } catch { /* 무시 */ }
  }
}
