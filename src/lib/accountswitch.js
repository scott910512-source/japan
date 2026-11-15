/* 계정을 바꿔 로그인할 때 — 이 기기의 기록을 새 계정에 섞지 않는다.
 *
 * ★ 왜 ★
 *   로그아웃해도 이 기기의 학습 기록은 남는다(로그인 상태만 끊는다). 그런데 다른 계정으로 로그인하면 첫 동기화가
 *   「이 기기의 기록 + 그 계정의 클라우드 기록」을 합쳐서 올렸다. 손님으로 쓰던 기록을 첫 로그인 때 계정으로 옮기려고
 *   만든 동작인데, 다른 계정의 기록인지는 가리지 않아서 — 기존 계정의 회독 · 진도 · 연속 학습일이 새 계정에 그대로 올라갔다.
 *   반대로 새 계정에서 공부한 뒤 기존 계정으로 돌아가면 그 기록이 기존 계정에 섞였다.
 *
 * ★ 어떻게 ★
 *   이 기기의 기록이 어느 계정 것인지는 진도의 syncUser가 안다(동기화할 때마다 적는다). 로그인한 계정과 다르면
 *     1) 이 기기의 기록을 그 계정의 보관함(stashKeyOf)에 통째로 옮겨 두고
 *     2) 들어온 계정의 보관함이 있으면 되살리고, 없으면 비운 채로 시작한다
 *     3) 다시 불러온다 — 비운(또는 되살린) 기록이 그 계정의 클라우드 기록과 평소대로 합쳐진다
 *   기존 계정으로 돌아오면 보관해 둔 기록이 되살아나서, 아직 못 올린 것까지 그 계정에 이어진다.
 *   처음 로그인하는 기기(손님 기록 · syncUser 없음)는 전처럼 그 계정에 합친다.
 *
 * API 키(음성 · AI)도 계정별이다. 다른 계정으로 바꾸면 이 기기의 키는 이전 계정 보관함으로 같이 옮기고 비운다 —
 * 안 비우면 새 계정의 키 보관함에 이전 계정의 키가 올라간다. 기기 설정(목소리 · 속도 · 화면)은 그대로 둔다.
 * 이 파일은 저장소(localStorage)만 다룬다. 화면 상태는 다시 불러와서 맞춘다. */
import { pickSyncedSettings } from './merge.js';

/* 계정마다 따로인 기록 — 동기화하는 것과, 기기에만 두지만 그 사람의 공부인 것(오늘의 계획 · 이어하기 · 물어본 것 …) */
export const ACCOUNT_DATA_KEYS = [
  'jp_manabu_custom_words_v1',
  'jp_manabu_progress_v1',
  'jp_manabu_streak_v1',
  'jp_manabu_review_v1',
  'jp_manabu_session_v1',
  'jp_manabu_stats_v1',
  'jp_manabu_memos_v1',
  'jp_manabu_plan_v1',
  'jp_manabu_asks_v1',
  'jp_manabu_translations_v1',
  'jp_manabu_swiss_v1',
  'jp_manabu_travel_v1',
  'jp_manabu_videos_v1',
  'jp_manabu_video_analyses_v1',
  'jp_manabu_video_scripts_v1',
  'jp_manabu_video_progress_v1',
  'jp_manabu_video_removed_v1',
  'jp_manabu_stories_v1',
  'jp_manabu_story_removed_v1',
  'jp_manabu_story_pos_v1',
  'jp_quiz_keep_v1',
];
const SETTINGS_KEY = 'jp_manabu_settings_v1';
/* 다시 불러온 뒤 이전 계정이 보던 화면(풀던 시험 등)으로 돌아가지 않게 지운다 — 기록이 아니라 되돌릴 것은 없다 */
const RESET_ONLY = ['jp_nav_v1'];
/* 보관함이 저장 공간을 못 얻으면 큰 것(영상 자막 · 설명)을 빼고 한 번 더 */
const HEAVY = ['jp_manabu_video_scripts_v1', 'jp_manabu_video_analyses_v1', 'jp_manabu_translations_v1'];
const SECRET = ['gttsKey', 'geminiKey', 'claudeKey'];

export const stashKeyOf = (userId) => `jp_manabu_stash_${userId}_v1`;

/* 이 기기의 기록이 다른 계정 것인가 — 그 계정 id, 아니면 null(같은 계정 · 손님 기록) */
export function switchedFrom(localProgress, userId) {
  const prev = localProgress?.syncUser;
  return prev && userId && prev !== userId ? prev : null;
}

/* 다른 계정으로 넘어온 기기의 기본 설정: 이 기기의 설정은 두되, API 키는 빼고, 칸마다 바꾼 시각을 지운다
   (시각이 남아 있으면 이전 계정이 고른 학습 설정이 「더 나중에 바꾼 것」이 되어 새 계정의 설정을 덮는다) */
export function settingsForNewAccount(raw) {
  let s;
  try { s = JSON.parse(raw || '{}') || {}; } catch { s = {}; }
  const out = { ...s };
  for (const k of SECRET) delete out[k];
  delete out.settingsAt;
  return out;
}

let switching = false;
/* 옮기는 중인가 — 다시 불러오기 전까지 동기화 · 올리기가 옛 화면 상태로 저장소를 다시 쓰지 않게 막는다 */
export const isSwitching = () => switching;

/* from 계정의 기록을 보관하고, to 계정의 보관함을 되살리거나 비운다. 결과: { stashed, restored } */
export function switchAccountStorage(from, to, storage = globalThis.localStorage, now = Date.now()) {
  switching = true;
  const items = {};
  for (const k of [...ACCOUNT_DATA_KEYS, SETTINGS_KEY]) {
    const v = storage.getItem(k);
    if (v !== null) items[k] = v;
  }
  const save = (body) => { try { storage.setItem(stashKeyOf(from), JSON.stringify({ v: 1, user: from, at: now, items: body })); return true; } catch { return false; } };
  let stashed = save(items);
  if (!stashed) {
    const light = { ...items };
    for (const k of HEAVY) delete light[k];
    stashed = save(light);
  }

  let incoming = null;
  try { incoming = JSON.parse(storage.getItem(stashKeyOf(to)) || 'null'); } catch { incoming = null; }
  const restore = incoming && incoming.user === to && incoming.items && typeof incoming.items === 'object' ? incoming.items : null;

  for (const k of [...ACCOUNT_DATA_KEYS, ...RESET_ONLY]) {
    try { storage.removeItem(k); } catch { /* 지우기는 공간을 안 쓴다 */ }
  }
  if (restore) {
    for (const k of ACCOUNT_DATA_KEYS) {
      if (typeof restore[k] === 'string') { try { storage.setItem(k, restore[k]); } catch { /* 넣다 막히면 그 칸은 클라우드에서 받는다 */ } }
    }
  }
  /* 설정: 돌아온 계정이면 그 사람의 설정(키 포함)을 되살리고, 처음 오는 계정이면 이 기기 설정에서 키와 시각만 뺀다 */
  try {
    const cur = storage.getItem(SETTINGS_KEY);
    if (restore && typeof restore[SETTINGS_KEY] === 'string') {
      /* 되살린 설정에 없는 기기 칸(목소리 · 화면)은 지금 것을 둔다 */
      const now0 = settingsForNewAccount(cur);
      const back = JSON.parse(restore[SETTINGS_KEY]);
      storage.setItem(SETTINGS_KEY, JSON.stringify({ ...now0, ...back }));
    } else {
      storage.setItem(SETTINGS_KEY, JSON.stringify(settingsForNewAccount(cur)));
    }
  } catch { /* 설정을 못 고치면 다음 동기화가 칸마다 맞춘다 */ }
  if (restore) { try { storage.removeItem(stashKeyOf(to)); } catch { /* 남아 있어도 다음에 같은 것을 되살릴 뿐이다 */ } }
  return { stashed, restored: Boolean(restore) };
}

/* 검사용 — 모듈 상태를 되돌린다 */
export function _resetSwitching() { switching = false; }

/* 학습 설정 중 계정으로 올라가는 칸 — 검사가 「시각만 지우고 값은 둔다」를 확인할 때 쓴다 */
export const syncedSettingKeys = (s) => Object.keys(pickSyncedSettings(s));
