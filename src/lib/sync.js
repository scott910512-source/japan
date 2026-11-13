import { supabase } from './supabase.js';

/* PostgREST 오류를 사람이 읽고 조치할 수 있는 말로 바꾼다.
 * 특히 "칸이 없다"는 오류는 SQL을 아직 안 돌렸다는 뜻이라 그대로 알려줘야 한다. */
function readableDbError(error) {
  const msg = error?.message || '';
  const missing = msg.match(/Could not find the '(\w+)' column/);
  if (missing) {
    return `데이터베이스에 '${missing[1]}' 칸이 없어요. Supabase SQL Editor에서 docs/supabase.sql을 다시 실행해 주세요`;
  }
  if (error?.code === '42P01' || msg.includes('does not exist')) {
    return '데이터베이스 표가 아직 없어요. Supabase SQL Editor에서 docs/supabase.sql을 실행해 주세요';
  }
  if (msg.includes('JWT') || msg.includes('policy') || error?.code === '42501') {
    return '권한이 없어요. 로그아웃했다가 다시 로그인해 주세요';
  }
  if (msg.toLowerCase().includes('failed to fetch')) return '인터넷에 연결되어 있는지 확인해 주세요';
  return msg || '알 수 없는 오류';
}
import {
  mergeReview, mergeProgress, mergeStats, mergeStreak, mergeCustomWords, mergeMemos,
  mergeVideos, mergeSettingsByTime, mergeGone,
} from './merge.js';

/* videos 칸은 나중에 생겼다. SQL을 아직 안 돌린 계정에서도 나머지는 동기화돼야
 * 한다 — 영상 하나 때문에 회독 기록이 안 올라가면 그게 더 큰 손해다.
 * 칸이 없다는 오류일 때만 영상을 빼고 한 번 더 하고, 사실대로 알린다. */
const NO_VIDEO_COLUMN = /Could not find the 'videos' column|column .*videos.* does not exist/i;
export const VIDEO_COLUMN_HINT = '영상만 아직 계정에 안 올라가요. Supabase → SQL Editor에서 아래 한 줄을 실행하면 켜집니다.';
// 화면에서 그대로 복사해 붙여넣을 수 있게 따로 둔다 — 파일 경로만 알려 주면 찾아야 한다.
export const VIDEO_COLUMN_SQL = "alter table public.user_data add column if not exists videos jsonb not null default '{}'::jsonb;";

/* ── 서버 왕복 ── */

export async function fetchRemote(userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('review, progress, settings, stats, custom_words, streak, memos, videos, gtts_key_enc, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (!NO_VIDEO_COLUMN.test(error.message || '')) throw new Error(readableDbError(error));
    const plain = await supabase
      .from('user_data')
      .select('review, progress, settings, stats, custom_words, streak, memos, gtts_key_enc, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (plain.error) throw new Error(readableDbError(plain.error));
    return plain.data ? { ...plain.data, videoColumnMissing: true } : null;
  }
  return data || null;
}

/* 두 값의 내용이 같은가 — 열쇠 순서는 안 본다(서버의 jsonb는 열쇠 순서를 바꿔서 돌려준다) */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])]));
  return v;
}
export function sameJson(a, b) {
  if (a === undefined || b === undefined || a === null || b === null) return false;
  try { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); } catch { return false; }
}

/* keepVideos: 영상 칸이 서버 것과 내용이 같으면 그 칸은 보내지 않는다.
   영상 묶음에는 자막과 이야기 글이 들어 있어 크다 — 카드 한 장 넘길 때마다 다시 올릴 이유가 없다. */
export async function pushMerged(userId, merged, { keepVideos = false } = {}) {
  if (keepVideos) {
    const { videos: _same, ...rest } = merged;
    merged = rest;
  }
  const { error } = await supabase
    .from('user_data')
    .upsert({
      user_id: userId,
      review: merged.review,
      progress: merged.progress,
      settings: merged.settings,
      stats: merged.stats,
      custom_words: merged.customWords,
      streak: merged.streak,
      memos: merged.memos,
      ...(merged.videos !== undefined ? { videos: merged.videos } : {}),
      ...(merged.gttsKeyEnc !== undefined ? { gtts_key_enc: merged.gttsKeyEnc } : {}),
    }, { onConflict: 'user_id' });

  if (!error) return { videoColumnMissing: false };
  if (!NO_VIDEO_COLUMN.test(error.message || '')) throw new Error(readableDbError(error));

  const { videos: _drop, ...withoutVideos } = merged;
  const retry = await supabase
    .from('user_data')
    .upsert({
      user_id: userId,
      review: withoutVideos.review,
      progress: withoutVideos.progress,
      settings: withoutVideos.settings,
      stats: withoutVideos.stats,
      custom_words: withoutVideos.customWords,
      streak: withoutVideos.streak,
      memos: withoutVideos.memos,
      ...(withoutVideos.gttsKeyEnc !== undefined ? { gtts_key_enc: withoutVideos.gttsKeyEnc } : {}),
    }, { onConflict: 'user_id' });
  if (retry.error) throw new Error(readableDbError(retry.error));
  return { videoColumnMissing: true };
}

/* 키 봉투만 올린다. 다른 칸은 안 건드린다.
 * 전에는 봉투를 올리면서 이 기기의 기록을 통째로(합치지 않고) 같이 올렸다 — 앱을 켜자마자 봉투를 올리는 기기가
 * 다른 기기가 방금 올린 더 새 기록을 덮을 수 있었다. 줄이 아직 없으면 나머지 칸은 기본값으로 생긴다. */
export async function pushKeyEnvelope(userId, envelope) {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, gtts_key_enc: envelope }, { onConflict: 'user_id' });
  if (error) throw new Error(readableDbError(error));
}

/* 한 번의 동기화 = 내려받아 합치고 다시 올린다.
 * 합친 결과를 돌려주면 화면이 그걸 그대로 상태에 반영한다. */
/* ★ 계정을 초기화 · 복원한 시각 ★ (progress.resetAt · resetUser · syncUser)
 *
 * 합치기는 합집합이라, 로그인한 채 「학습 기록 초기화」나 「복원」을 해도 서버에 있던 기록이 그대로 다시 내려왔다.
 * 서버 줄을 비워도 소용없다 — 다른 기기가 자기 기록을 합쳐서 다시 올린다. 그래서 「이 계정은 이때 초기화했다」를 적는다.
 *
 *   이 기기의 시각이 더 나중   이 기기에서 방금 초기화 · 복원했다. 서버 것과 합치지 않고 이 기기 것으로 바꿔 올린다
 *   서버의 시각이 더 나중      다른 기기에서 초기화 · 복원했다. 이 기기의 기록은 그 전 것이라 버리고 서버 것을 받는다
 *   같다                       평소대로 합친다
 *
 * 두 가지 안전장치:
 *   resetUser  초기화한 계정. 다른 계정으로 로그인했을 때 이 기기의 초기화 시각이 그 계정을 덮지 않게 한다
 *   syncUser   이 기기의 기록이 맞춰진 적 있는 계정. 처음 로그인한 기기(손님으로 쓰던 기록)는 「서버 것을 받는다」로
 *              가지 않고 평소대로 합친다 — 그러지 않으면 한 번이라도 초기화했던 계정에 로그인할 때 손님 기록을 잃는다 */
export function resetOrder(userId, localProgress, remoteProgress) {
  const mine = localProgress || {};
  const local = mine.resetUser === userId ? Number(mine.resetAt) || 0 : 0;
  const server = Number(remoteProgress?.resetAt) || 0;
  if (local > server) return 'replace';
  if (server > local && mine.syncUser === userId) return 'adopt';
  return 'merge';
}

export async function syncNow(userId, localData, { defaults = {} } = {}) {
  const remote = await fetchRemote(userId);
  const order = remote ? resetOrder(userId, localData.progress, remote.progress) : 'merge';
  const settings = mergeSettingsByTime(localData.settings, remote?.settings, defaults);
  const gttsKeyEnc = localData.gttsKeyEnc ?? remote?.gtts_key_enc ?? null;

  let merged;
  if (order === 'replace') {
    /* 이 기기에서 초기화 · 복원했다 — 서버 것을 섞지 않는다 */
    merged = {
      review: localData.review || {}, progress: localData.progress || {}, stats: localData.stats || {}, streak: localData.streak || {},
      customWords: localData.customWords || [], memos: localData.memos || {}, videos: localData.videos,
      settings, gttsKeyEnc,
    };
  } else if (order === 'adopt') {
    /* 다른 기기에서 초기화 · 복원했다 — 이 기기의 옛 기록을 섞지 않는다 */
    merged = {
      review: remote.review || {}, progress: remote.progress || {}, stats: remote.stats || {}, streak: remote.streak || {},
      customWords: remote.custom_words || [], memos: remote.memos || {}, videos: remote.videos ?? localData.videos,
      settings, gttsKeyEnc,
    };
  } else {
    merged = {
      review: mergeReview(localData.review, remote?.review),
      progress: mergeProgress(localData.progress, remote?.progress),
      stats: mergeStats(localData.stats, remote?.stats),
      streak: mergeStreak(localData.streak, remote?.streak),
      customWords: mergeCustomWords(localData.customWords, remote?.custom_words, mergeGone(localData.progress?.wordsGone, remote?.progress?.wordsGone)),
      memos: mergeMemos(localData.memos, remote?.memos),
      videos: mergeVideos(localData.videos, remote?.videos),
      /* 올려도 되는 칸만(키는 없다), 칸마다 나중에 바꾼 쪽 — 규칙은 merge.js mergeSettingsByTime.
         서버 줄에 키가 들어 있어도(옛 버전이 올린 것 · 손으로 고친 것) 받지도 다시 올리지도 않는다. */
      settings,
      // 암호문 봉투는 합칠 수 없다(내용을 볼 수 없으므로). 새로 올릴 게 있으면 그것을,
      // 없으면 서버에 있던 것을 그대로 둔다.
      gttsKeyEnc,
    };
  }
  /* 초기화 시각은 이 계정 것만, 큰 쪽으로. 이 기기의 기록이 이 계정과 맞춰졌다고 적는다 */
  const mine = localData.progress || {};
  const resetAt = Math.max(mine.resetUser === userId ? Number(mine.resetAt) || 0 : 0, Number(remote?.progress?.resetAt) || 0);
  const { resetAt: _a, resetUser: _u, ...rest } = merged.progress;
  merged.progress = { ...rest, syncUser: userId, ...(resetAt ? { resetAt, resetUser: userId } : {}) };

  const { videoColumnMissing } = await pushMerged(userId, merged, { keepVideos: Boolean(remote) && !remote.videoColumnMissing && sameJson(merged.videos, remote.videos) });
  /* 칸이 없으면 서버엔 영상이 안 올라갔다. 합친 결과를 그대로 돌려주되(이 기기
     것은 살아 있다) 왜 다른 기기에 안 보이는지는 말해 준다. */
  return { ...merged, videoNote: (videoColumnMissing || remote?.videoColumnMissing) ? VIDEO_COLUMN_HINT : null };
}
