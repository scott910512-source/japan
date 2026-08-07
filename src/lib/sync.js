import { supabase } from './supabase.js';
import {
  mergeReview, mergeProgress, mergeStats, mergeStreak, mergeCustomWords, pickSyncedSettings,
} from './merge.js';

/* ── 서버 왕복 ── */

export async function fetchRemote(userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('review, progress, settings, stats, custom_words, streak, gtts_key_enc, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
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
      ...(merged.gttsKeyEnc !== undefined ? { gtts_key_enc: merged.gttsKeyEnc } : {}),
    }, { onConflict: 'user_id' });

  if (error) throw new Error(error.message);
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
    settings: { ...(remote?.settings || {}), ...pickSyncedSettings(localData.settings) },
    // 암호문 봉투는 합칠 수 없다(내용을 볼 수 없으므로). 새로 올릴 게 있으면 그것을,
    // 없으면 서버에 있던 것을 그대로 둔다.
    gttsKeyEnc: localData.gttsKeyEnc ?? remote?.gtts_key_enc ?? null,
  };

  await pushMerged(userId, merged);
  return merged;
}
