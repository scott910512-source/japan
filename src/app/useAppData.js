import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadCustomWords, saveCustomWords,
  loadProgress, saveProgress,
  loadSettings, saveSettings,
  loadReview, saveReview,
  loadSession, saveSession,
  loadStats, saveStats,
  loadPlan, savePlan,
  loadMemos, saveMemos,
  loadAsks, saveAsks,
  loadVideos, saveVideos,
  loadVideoAnalyses, saveVideoAnalyses,
  loadVideoScripts, saveVideoScripts,
  loadVideoProgress, saveVideoProgress,
  loadVideoRemoved, saveVideoRemoved,
  loadTranslations, saveTranslations,
  loadTrends, saveTrends
} from '../lib/storage.js';
import { SEED_VIDEOS } from '../data/videos.js';

// 저장 키와 파일 형식은 storage.js에 유지한다. 화면은 상태와 명령만 사용한다.
export function useAppData() {
  const [customWords, setCustomWords] = useState(() => loadCustomWords());
  const [progress, setProgress] = useState(() => loadProgress());
  /* 오늘의 계획. 부를 때마다 새로 계산하지 않고 하루치를 적어 둔다 —
     그래야 신규 20개를 끝냈을 때 「남은 0」이 되고, 완료 수가 판정 횟수로
     부풀지 않는다. */
  const [plan, setPlan] = useState(() => loadPlan());
  const [settings, setSettings] = useState(() => loadSettings());
  const [review, setReview] = useState(() => loadReview());
  const [session, setSession] = useState(() => loadSession());
  const [stats, setStats] = useState(() => loadStats());
  const [memos, setMemos] = useState(() => loadMemos());
  const [asks, setAsks] = useState(() => loadAsks());   // 공부하다 물어본 것
  /* 영상은 화면이 아니라 여기서 들고 있다 — 기기 간 동기화에 실어야 한다.
     처음 켠 사람에게만 기본 영상을 넣는다. 전부 뺀 사람에게 다시 넣으면
     지운 게 돌아오는 셈이다(loadVideos가 그래서 null을 돌려준다). */
  const [videos, setVideos] = useState(() => loadVideos() ?? SEED_VIDEOS);
  const [videoAnalyses, setVideoAnalyses] = useState(() => loadVideoAnalyses());
  const [videoScripts, setVideoScripts] = useState(() => loadVideoScripts());
  const [videoProgress, setVideoProgress] = useState(() => loadVideoProgress());
  const [videoRemoved, setVideoRemoved] = useState(() => loadVideoRemoved());
  // 번역기에서 받아 둔 것 — 비행기 모드에서도 다시 봐야 해서 기기에 남긴다
  const [translations, setTranslations] = useState(() => loadTranslations());
  const [trends, setTrends] = useState(() => loadTrends());
  /* 동기화에 실을 영상 묶음. 묘비(removed)까지 같이 올려야 한 기기에서 뺀
     영상이 다른 기기에서 되살아나지 않는다. */
  const videoBundle = useMemo(() => ({
    list: videos, removed: videoRemoved,
    scripts: videoScripts, analyses: videoAnalyses, progress: videoProgress,
  }), [videos, videoRemoved, videoScripts, videoAnalyses, videoProgress]);

  const applyVideoBundle = useCallback((b) => {
    if (!b) return;
    setVideos(b.list || []);
    setVideoRemoved(b.removed || {});
    setVideoScripts(b.scripts || {});
    setVideoAnalyses(b.analyses || {});
    setVideoProgress(b.progress || {});
  }, []);

  // 뺀 영상은 묘비를 남긴다. 남기지 않으면 다음 동기화에 서버에서 다시 내려온다.
  const removeVideo = useCallback((id) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    setVideoRemoved((prev) => ({ ...prev, [id]: Date.now() }));
    setVideoAnalyses((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setVideoScripts((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setVideoProgress((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  return {
    customWords,
    setCustomWords,
    progress,
    setProgress,
    plan,
    setPlan,
    settings,
    setSettings,
    review,
    setReview,
    session,
    setSession,
    stats,
    setStats,
    memos,
    setMemos,
    asks,
    setAsks,
    videos,
    setVideos,
    videoAnalyses,
    setVideoAnalyses,
    videoScripts,
    setVideoScripts,
    videoProgress,
    setVideoProgress,
    videoRemoved,
    setVideoRemoved,
    translations,
    setTranslations,
    trends,
    setTrends,
    videoBundle,
    applyVideoBundle,
    removeVideo
  };
}

// App의 오류 핸들러가 등록된 다음 호출하여 첫 저장 실패도 화면에 남긴다.
export function usePersistAppData({ customWords, progress, settings, review, session, stats, plan, memos, asks, videos, videoAnalyses, videoScripts, videoProgress, videoRemoved, translations, trends }) {
  useEffect(() => saveCustomWords(customWords), [customWords]);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveReview(review), [review]);
  useEffect(() => saveSession(session), [session]);
  useEffect(() => saveStats(stats), [stats]);
  useEffect(() => { if (plan) savePlan(plan); }, [plan]);
  useEffect(() => saveMemos(memos), [memos]);
  useEffect(() => saveAsks(asks), [asks]);
  useEffect(() => saveVideos(videos), [videos]);
  useEffect(() => saveVideoAnalyses(videoAnalyses), [videoAnalyses]);
  useEffect(() => saveVideoScripts(videoScripts), [videoScripts]);
  useEffect(() => saveVideoProgress(videoProgress), [videoProgress]);
  useEffect(() => saveVideoRemoved(videoRemoved), [videoRemoved]);
  useEffect(() => saveTranslations(translations), [translations]);
  useEffect(() => { if (trends) saveTrends(trends); }, [trends]);

}
