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
  mergeVideos, pickSyncedSettings,
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

export async function pushMerged(userId, merged) {
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

/* 한 번의 동기화 = 내려받아 합치고 다시 올린다.
 * 합친 결과를 돌려주면 화면이 그걸 그대로 상태에 반영한다. */
export async function syncNow(userId, localData) {
  const remote = await fetchRemote(userId);

  const merged = {
    review: mergeReview(localData.review, remote?.review),
    progress: mergeProgress(localData.progress, remote?.progress),
    stats: mergeStats(localData.stats, remote?.stats),
    streak: mergeStreak(localData.streak, remote?.streak),
    customWords: mergeCustomWords(localData.customWords, remote?.custom_words),
    memos: mergeMemos(localData.memos, remote?.memos),
    videos: mergeVideos(localData.videos, remote?.videos),
    settings: { ...(remote?.settings || {}), ...pickSyncedSettings(localData.settings) },
    // 암호문 봉투는 합칠 수 없다(내용을 볼 수 없으므로). 새로 올릴 게 있으면 그것을,
    // 없으면 서버에 있던 것을 그대로 둔다.
    gttsKeyEnc: localData.gttsKeyEnc ?? remote?.gtts_key_enc ?? null,
  };

  const { videoColumnMissing } = await pushMerged(userId, merged);
  /* 칸이 없으면 서버엔 영상이 안 올라갔다. 합친 결과를 그대로 돌려주되(이 기기
     것은 살아 있다) 왜 다른 기기에 안 보이는지는 말해 준다. */
  return { ...merged, videoNote: (videoColumnMissing || remote?.videoColumnMissing) ? VIDEO_COLUMN_HINT : null };
}
