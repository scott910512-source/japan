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
  mergeReview, mergeProgress, mergeStats, mergeStreak, mergeCustomWords, mergeMemos, pickSyncedSettings,
} from './merge.js';

/* ── 서버 왕복 ── */

export async function fetchRemote(userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('review, progress, settings, stats, custom_words, streak, memos, gtts_key_enc, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(readableDbError(error));
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
      ...(merged.gttsKeyEnc !== undefined ? { gtts_key_enc: merged.gttsKeyEnc } : {}),
    }, { onConflict: 'user_id' });

  if (error) throw new Error(readableDbError(error));
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
    settings: { ...(remote?.settings || {}), ...pickSyncedSettings(localData.settings) },
    // 암호문 봉투는 합칠 수 없다(내용을 볼 수 없으므로). 새로 올릴 게 있으면 그것을,
    // 없으면 서버에 있던 것을 그대로 둔다.
    gttsKeyEnc: localData.gttsKeyEnc ?? remote?.gtts_key_enc ?? null,
  };

  await pushMerged(userId, merged);
  return merged;
}
