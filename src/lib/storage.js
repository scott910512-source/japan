const KEYS = {
  customWords: 'jp_manabu_custom_words_v1',
  progress: 'jp_manabu_progress_v1',
  settings: 'jp_manabu_settings_v1',
  streak: 'jp_manabu_streak_v1',
};

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
  } catch {
    // storage unavailable (private mode, quota) — fail silently, in-memory state still works
  }
}

export function loadCustomWords() {
  return read(KEYS.customWords, []);
}
export function saveCustomWords(words) {
  write(KEYS.customWords, words);
}

const DEFAULT_PROGRESS = { known: [], unknown: [], grammarDone: {}, sentenceDone: {} };
export function loadProgress() {
  return { ...DEFAULT_PROGRESS, ...read(KEYS.progress, {}) };
}
export function saveProgress(progress) {
  write(KEYS.progress, progress);
}

const DEFAULT_SETTINGS = {
  onboarded: false,
  level: 'basic', // 'beginner' | 'basic' | 'grammar'
  dailyGoal: 10,
  notifications: true,
  speechRate: 0.82,
  theme: 'dark', // 'system' | 'light' | 'dark' — dark is the designed-for default
};
export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}
export function saveSettings(settings) {
  write(KEYS.settings, settings);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// 앱 시작 시 1회 호출 — 오늘 처음 방문이면 스트릭을 갱신한다
export function touchStreak() {
  const s = read(KEYS.streak, { count: 0, lastDate: null });
  const today = todayKey();
  if (s.lastDate === today) return s;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

  const next = {
    count: s.lastDate === yKey ? s.count + 1 : 1,
    lastDate: today,
  };
  write(KEYS.streak, next);
  return next;
}

export function loadStreak() {
  return read(KEYS.streak, { count: 0, lastDate: null });
}
