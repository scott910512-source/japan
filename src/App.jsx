import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import BottomSheet from './components/BottomSheet.jsx';
import Onboarding from './components/Onboarding.jsx';
import Today from './screens/Today.jsx';
import StudyHub from './screens/StudyHub.jsx';
import Log from './screens/Log.jsx';
import Listen from './screens/Listen.jsx';
import Study from './screens/Study.jsx';
import ReviewTab from './screens/ReviewTab.jsx';
import Settings from './screens/Settings.jsx';
import Basics from './screens/Basics.jsx';
import WordManager from './screens/WordManager.jsx';
import WordDeck, { filterByLevel } from './screens/WordDeck.jsx';
import Situations from './screens/Situations.jsx';
import Quiz from './screens/Quiz.jsx';
import Conjugate from './screens/Conjugate.jsx';
import Jlpt from './screens/Jlpt.jsx';
import Videos from './screens/Videos.jsx';
import Translate from './screens/Translate.jsx';
import GrammarHub from './screens/GrammarHub.jsx';
import Gate from './screens/Gate.jsx';
import NewPassword from './screens/NewPassword.jsx';
import { IconArrowLeft } from './components/Icons.jsx';
import { ALL_WORDS } from './data/allWords.js';
import { ALL_SITUATIONS as SITUATIONS } from './data/allSituations.js';
import { allSentenceCards, dailyPool, cardsForQueue } from './lib/cards.js';
import { buildDailyStudyQueue } from './lib/daily.js';
import {
  loadCustomWords, saveCustomWords,
  loadProgress, saveProgress,
  loadSettings, saveSettings,
  loadReview, saveReview,
  loadSession, saveSession,
  loadStats, saveStats,
  touchStreak, loadStreak, setStorageErrorHandler,
  loadVaultKey, saveVaultKey, markSignedInOnce, hasSignedInOnce,
  loadMemos, saveMemos,
  loadVideos, saveVideos, loadVideoAnalyses, saveVideoAnalyses,
  loadVideoScripts, saveVideoScripts, loadVideoProgress, saveVideoProgress,
  loadVideoRemoved, saveVideoRemoved,
  loadTranslations, saveTranslations, loadTrends, saveTrends,
} from './lib/storage.js';
import { audioUnlocked, configureTTS, setTTSErrorHandler, unlockAudio } from './lib/tts.js';
import { configureSTT } from './lib/stt.js';
import { dueCards, todayKey, weakCards } from './lib/review.js';
import { supabase, supabaseConfigured } from './lib/supabase.js';
import { syncNow, pushMerged } from './lib/sync.js';
import { useToday } from './lib/useToday.js';
import { pickSyncedSettings } from './lib/merge.js';
import { SEED_VIDEOS } from './data/videos.js';
import { encryptWithVaultKey, decryptWithVaultKey } from './lib/crypto.js';

const SUB_TITLES = {
  basics: '완전기초',
  grammar: '기초문법',
  sentences: '상황별 문장암기',
  translate: '번역기',
  manage: '내 단어장',
  worddeck: '단어암기',
  quiz: '단어 시험',
  conjugate: '동사 활용',
  listen: '듣기 · 따라 말하기',
  jlpt: 'JLPT 단어',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [videosSeen, setVideosSeen] = useState(false); // 영상 탭에 한 번이라도 들어갔는지
  const [sub, setSub] = useState(null);
  const [deck, setDeck] = useState(null); // 학습 중인 덱 (있으면 회독 화면이 전체를 덮는다)

  const [customWords, setCustomWords] = useState(() => loadCustomWords());
  const [progress, setProgress] = useState(() => loadProgress());
  const [settings, setSettings] = useState(() => loadSettings());
  const [review, setReview] = useState(() => loadReview());
  const [session, setSession] = useState(() => loadSession());
  const [stats, setStats] = useState(() => loadStats());
  const [memos, setMemos] = useState(() => loadMemos());
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
  const [streak, setStreak] = useState({ count: 0, lastDate: null });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [authSession, setAuthSession] = useState(null);
  const [syncState, setSyncState] = useState({ busy: false, at: null, error: null });
  const [remoteKeyEnvelope, setRemoteKeyEnvelope] = useState(null);
  const [vaultKey, setVaultKey] = useState(() => loadVaultKey());
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [offlinePass, setOfflinePass] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    setStorageErrorHandler(showToast);
    setTTSErrorHandler(showToast);
    /* 연속일은 여기서 올리지 않는다 — 앱을 켠 것과 공부한 것은 다르다.
       올리는 자리는 오늘 첫 판정(applyReview)이다. */
    setStreak(loadStreak());
    setOnboardingOpen(!loadSettings().onboarded);

    // iOS는 첫 사용자 제스처에서만 오디오를 열어준다.
    // 한 번에 성공하지 못할 수 있어 열릴 때까지 계속 시도한다.
    const unlock = () => {
      unlockAudio();
      if (audioUnlocked()) window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, [showToast]);

  useEffect(() => saveCustomWords(customWords), [customWords]);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveReview(review), [review]);
  useEffect(() => saveSession(session), [session]);
  useEffect(() => saveStats(stats), [stats]);
  useEffect(() => saveMemos(memos), [memos]);
  useEffect(() => saveVideos(videos), [videos]);
  useEffect(() => saveVideoAnalyses(videoAnalyses), [videoAnalyses]);
  useEffect(() => saveVideoScripts(videoScripts), [videoScripts]);
  useEffect(() => saveVideoProgress(videoProgress), [videoProgress]);
  useEffect(() => saveVideoRemoved(videoRemoved), [videoRemoved]);
  useEffect(() => saveTranslations(translations), [translations]);
  useEffect(() => { if (trends) saveTrends(trends); }, [trends]);

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

  // 음성 인식도 같은 Google API 키를 쓴다
  useEffect(() => {
    configureTTS({
      gttsKey: settings.gttsKey,
      useCloud: settings.useCloudTTS,
      voice: settings.gttsVoice,
      deviceVoiceURI: settings.deviceVoiceURI,
    });
    configureSTT({ gttsKey: settings.gttsKey, useCloud: settings.useCloudTTS });
  }, [settings.gttsKey, settings.useCloudTTS, settings.gttsVoice, settings.deviceVoiceURI]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const words = useMemo(() => [...ALL_WORDS, ...customWords], [customWords]);
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  /* 오늘 날짜를 화면에 묶는다. 렌더 안에서 todayKey()를 부르기만 하면
     자정을 넘겨도 리액트가 다시 안 그려서, 복습 배지가 어제 값에 머문다. */
  const today = useToday();
  const due = useMemo(() => dueCards(wordIds, review, today), [wordIds, review, today]);

  const sentenceIds = useMemo(
    () => SITUATIONS.flatMap((s) => s.parts.flatMap((p) => p.items.map((i) => i.id))),
    [],
  );
  const sentenceDue = useMemo(
    () => dueCards(sentenceIds, review, today).length,
    [sentenceIds, review, today],
  );

  const patchSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  /* ── 계정 · 기기 간 동기화 ── */

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setAuthSession(next);
      // 재설정 메일 링크로 돌아온 경우다. 세션만 열고 끝내면 비밀번호는 안 바뀐다.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const runSync = useCallback(async (silent = false) => {
    if (!authSession?.user) return;
    setSyncState((s) => ({ ...s, busy: true }));
    try {
      const merged = await syncNow(authSession.user.id, {
        review, progress, settings, stats, streak, customWords, memos, videos: videoBundle,
      });
      setReview(merged.review);
      setProgress((p) => ({ ...p, ...merged.progress }));
      setStats(merged.stats);
      setStreak(merged.streak);
      setCustomWords(merged.customWords);
      setMemos(merged.memos);
      applyVideoBundle(merged.videos);
      // 서버에서 온 설정은 학습 범위만 들어 있다 — 기기별 설정은 덮지 않는다
      setSettings((s) => ({ ...s, ...merged.settings }));
      setRemoteKeyEnvelope(merged.gttsKeyEnc || null);
      /* 안내(note)와 오류(error)를 나눈다. 영상 칸이 없는 건 나머지가 다 올라간
         상태라, 이걸 오류 자리에 넣으면 "동기화가 안 되고 있어요"로 읽힌다. */
      setSyncState({
        busy: false,
        error: null,
        note: merged.videoNote || null,
        at: new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }),
      });
      if (!silent) showToast(merged.videoNote ? '동기화했어요 (영상 제외)' : '동기화했어요');
    } catch (err) {
      // 토스트는 2초 뒤 사라져서 왜 안 되는지 확인할 방법이 없다. 계정 칸에 남긴다.
      setSyncState((s) => ({ ...s, busy: false, error: err.message }));
      if (!silent) showToast('동기화에 실패했어요');
    }
  }, [authSession, review, progress, settings, stats, streak, customWords, memos, videoBundle, applyVideoBundle, showToast]);

  const saveRemoteKey = useCallback(async (envelope) => {
    if (!authSession?.user) throw new Error('로그인이 필요해요');
    await pushMerged(authSession.user.id, {
      review, progress, settings: pickSyncedSettings(settings), stats, streak,
      customWords, memos, gttsKeyEnc: envelope,
    });
    setRemoteKeyEnvelope(envelope);
  }, [authSession, review, progress, settings, stats, streak, customWords, memos]);

  const rememberVaultKey = useCallback((raw) => {
    setVaultKey(raw);
    saveVaultKey(raw);
  }, []);

  /* API 키를 계정에 자동으로 잠가 두고, 새 기기에서는 자동으로 풀어 온다.
   * 사용자가 따로 누를 게 없어야 한다 — 눌러야 하면 안 누른다. */
  useEffect(() => {
    if (!authSession?.user || !vaultKey) return;

    // 이 기기에 키가 없고 서버에 봉투가 있으면 → 풀어서 가져온다
    if (!settings.gttsKey && remoteKeyEnvelope) {
      decryptWithVaultKey(remoteKeyEnvelope, vaultKey).then((key) => {
        if (key) {
          patchSettings({ gttsKey: key });
          showToast('음성 키를 계정에서 가져왔어요');
        } else {
          // 비밀번호를 바꿨으면 예전 봉투는 못 연다
          showToast('계정에 보관된 음성 키를 열지 못했어요. 키를 다시 넣어 주세요');
        }
      });
      return;
    }

    // 이 기기에 키가 있으면 → 서버 봉투를 이 키로 맞춰 둔다
    if (settings.gttsKey) {
      decryptWithVaultKey(remoteKeyEnvelope, vaultKey).then(async (stored) => {
        if (stored === settings.gttsKey) return; // 이미 같은 키가 올라가 있다
        const envelope = await encryptWithVaultKey(settings.gttsKey, vaultKey);
        try {
          await saveRemoteKey(envelope);
        } catch { /* 다음 동기화에서 다시 시도한다 */ }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, vaultKey, settings.gttsKey, remoteKeyEnvelope]);

  /* 공부한 걸 자동으로 올린다.
   * 로그인할 때와 버튼을 누를 때만 올리면, 메모를 적고 다른 기기를 열었을 때 없다.
   * 매 판정마다 올리면 너무 잦으니 손을 멈춘 뒤 잠깐 기다렸다 한 번에 보낸다.
   * 앱을 덮거나 탭을 떠날 때도 밀어 넣는다 — 그때 안 보내면 영영 못 보낸다.
   *
   * 다만 기다리기만 하면 안 된다. 회독은 손이 계속 움직이는 일이라 12초가
   * 도무지 안 오고, 그 사이 앱이 죽으면 한 세션이 통째로 날아간다. 그래서
   * 마지막으로 올린 지 2분이 넘으면 손이 움직이는 중이라도 한 번 올린다. */
  const PUSH_IDLE_MS = 12000;
  const PUSH_MAX_MS = 120000;
  const dirty = useRef(false);
  const pushTimer = useRef(null);
  const pushedAt = useRef(Date.now());

  useEffect(() => {
    if (!authSession?.user || syncedFor.current !== authSession.user.id) return undefined;
    dirty.current = true;
    const send = () => {
      if (!dirty.current) return;
      dirty.current = false;
      pushedAt.current = Date.now();
      runSync(true);
    };
    clearTimeout(pushTimer.current);
    const waited = Date.now() - pushedAt.current;
    pushTimer.current = setTimeout(send, Math.max(0, Math.min(PUSH_IDLE_MS, PUSH_MAX_MS - waited)));
    return () => clearTimeout(pushTimer.current);
  }, [review, memos, progress, stats, customWords, videoBundle]);

  useEffect(() => {
    const flush = () => {
      if (!dirty.current || !authSession?.user) return;
      dirty.current = false;
      pushedAt.current = Date.now();
      clearTimeout(pushTimer.current);
      runSync(true);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [authSession, runSync]);

  // 로그인 직후 한 번은 자동으로 맞춘다. 사용자가 버튼을 눌러야만 이어지면 잊는다.
  const syncedFor = useRef(null);
  useEffect(() => {
    if (!authSession?.user || syncedFor.current === authSession.user.id) return;
    syncedFor.current = authSession.user.id;
    markSignedInOnce();
    runSync(true);
  }, [authSession, runSync]);

  /* ── 회독 ── */

  const applyReview = useCallback((nextReview, verdict) => {
    setReview(nextReview);
    if (!verdict) return;
    const day = todayKey();
    // 오늘 처음 판정한 순간에 연속일이 오른다. 같은 날 두 번째부터는 그대로 둔다.
    setStreak((prev) => (prev.lastDate === day ? prev : touchStreak()));
    setStats((prev) => {
      const cur = prev[day] || { studied: 0, known: 0, vague: 0, unknown: 0 };
      return {
        ...prev,
        [day]: {
          ...cur,
          studied: cur.studied + 1,
          known: cur.known + (verdict === 'known' || verdict === 'master' ? 1 : 0),
          vague: cur.vague + (verdict === 'vague' ? 1 : 0),
          unknown: cur.unknown + (verdict === 'unknown' ? 1 : 0),
        },
      };
    });
  }, []);

  const saveMemo = useCallback((id, text) => {
    setMemos((prev) => {
      if (!text) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { text, at: new Date().toISOString() } };
    });
  }, []);

  const toggleBookmark = useCallback((id) => {
    setProgress((p) => {
      const list = p.bookmarks || [];
      return {
        ...p,
        bookmarks: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
  }, []);

  // 오늘 학습 덱만 daily로 표시한다 — 복습 섞기 + 신규로 세션을 짜라는 뜻.
  /* 오늘의 학습 — 앱이 짜 준 큐 하나로 단어와 문장을 같이 돈다.
     문장은 카드 모양으로 감싸 두면 회독 화면이 그대로 받는다. */
  const sentenceCards = useMemo(() => allSentenceCards(), []);
  const todayPool = useMemo(
    () => dailyPool(filterByLevel(words, settings.levels), sentenceCards),
    [words, settings.levels, sentenceCards],
  );

  /* 세션 저장소가 한 칸이라, 새 판을 열면 하던 판이 말없이 사라진다.
     한 번 묻고 연다 — 「조용히 삼키지 말고」가 이 저장소가 정한 원칙이다.
     칸을 늘리지는 않는다. 그러면 완주 지점이 여러 개가 되어 더 나빠진다. */
  const [askSwap, setAskSwap] = useState(null);   // { run, from, left }

  const guardDeck = useCallback((run, deckId) => {
    const live = session?.deckId && session.queue?.length > 0 && session.date === todayKey();
    if (live && session.deckId !== deckId) {
      setAskSwap({ run, from: session.label || '하던 학습', left: session.queue.length });
      return;
    }
    run();
  }, [session]);

  const startToday = useCallback(() => {
    const built = buildDailyStudyQueue(todayPool, review, { goal: settings.dailyGoal || 20 });
    if (!built.queue.length) {
      showToast('지금 볼 게 없어요 — 학습 탭에서 골라 보세요');
      return;
    }
    const cards = cardsForQueue(built.queue, filterByLevel(words, settings.levels), sentenceCards);
    setSub(null);
    /* daily를 켜지 않는다 — 큐를 여기서 이미 짰다. 회독 화면이 또 짜면
       복습·약점 비율이 통째로 어긋난다. */
    setDeck({
      id: 'today',
      label: '오늘의 학습',
      cards,
      queue: built.queue.map((q) => q.id),
      /* 앱이 짜 준 판이니 방식도 앱이 정한다 — 맞힐수록 단서를 하나씩 뺀다.
         골라 들어간 판에서는 사용자가 정한 방향을 그대로 지킨다. */
      stepped: true,
      intro: { total: cards.length, review: built.review, weak: built.weak, fresh: built.fresh, minutes: built.minutes },
    });
  }, [todayPool, review, settings.dailyGoal, settings.levels, words, sentenceCards, showToast]);

  /* 하다 만 걸 이어서. 세션은 카드 id만 들고 있으니, 덱에는 단어와 문장을
     전부 실어 준다 — 어느 쪽에서 온 카드든 찾을 수 있어야 한다. */
  const resumeSession = useCallback(() => {
    if (!session?.deckId || !session.queue?.length) return;
    setSub(null);
    setDeck({
      id: session.deckId,
      label: session.label || '이어서 학습',
      cards: [...words, ...sentenceCards],
      /* 오늘의 학습은 회독마다 방식이 달라진다. 이어하기에 이 칸을 안 실어서,
         나갔다 들어온 순간부터 읽기·떠올리기·듣기 단계가 통째로 사라졌었다. */
      stepped: session.deckId === 'today',
    });
  }, [session, words, sentenceCards]);

  const startWordDeck = useCallback(() => {
    const pool = filterByLevel(words, settings.levels);
    if (pool.length === 0) {
      showToast('고른 레벨에 단어가 없어요');
      return;
    }
    setSub(null);
    setDeck({ id: 'words', label: '오늘 학습', cards: pool, daily: true });
  }, [words, settings.levels, showToast]);

  const startDueDeck = useCallback(() => {
    if (due.length === 0) {
      showToast('오늘 복습할 단어가 없어요');
      return;
    }
    setDeck({ id: 'due', label: '오늘 복습', cards: due.map((id) => byId.get(id)).filter(Boolean) });
  }, [due, byId, showToast]);

  const startWeakDeck = useCallback(() => {
    const weak = weakCards(wordIds, review);
    if (weak.length === 0) {
      showToast('취약 단어가 아직 없어요');
      return;
    }
    setDeck({ id: 'weak', label: '취약 단어', cards: weak.map((id) => byId.get(id)).filter(Boolean) });
  }, [wordIds, review, byId, showToast]);

  // JLPT 세트는 고른 100개만 도는 덱이다 — 오늘 학습 세션과 섞지 않는다.
  const startJlptSet = useCallback((cards, label, id) => {
    if (!cards?.length) return;
    setSub(null);
    setDeck({ id, label, cards });
  }, []);

  // 시험에서 틀린 단어를 바로 회독으로 넘긴다. 틀린 걸 확인만 하고 닫으면 남는 게 없다.
  const startQuizWrongDeck = useCallback((ids) => {
    const cards = ids.map((id) => byId.get(id)).filter(Boolean);
    if (!cards.length) return;
    setSub(null);
    setDeck({ id: `quizwrong-${ids.length}`, label: '시험 오답', cards });
  }, [byId]);

  const openMenu = useCallback((id) => {
    if (id === 'words') { setSub('worddeck'); return; }
    if (id === 'review') { setActiveTab('review'); return; }
    if (id === 'videos') { setVideosSeen(true); setActiveTab('videos'); return; }
    setSub(id);
  }, []);

  const finishOnboarding = (patch) => {
    patchSettings(patch);
    setOnboardingOpen(false);
  };

  /* 학습 탭은 예전엔 화면이 아니라 바로 회독으로 들어가는 통로였다.
     이제 「오늘」이 그 자리를 맡으니, 학습은 골라 들어가는 목록으로 돌린다. */
  const selectTab = (id) => {
    setSub(null);
    setActiveTab(id);
  };

  if (recovering && authSession) {
    return (
      <div className="app-shell">
        <div className="screens">
          <section className="screen active">
            <NewPassword
              session={authSession}
              onVaultKey={rememberVaultKey}
              onToast={showToast}
              onDone={() => setRecovering(false)}
            />
          </section>
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  /* 로그인해야 들어올 수 있다. 학습 기록을 계정에 남기는 게 목적이므로
   * 익명 사용은 열어 두지 않는다. 세션은 기기에 남아 다음부터는 이 화면을 건너뛴다. */
  if (supabaseConfigured && !authSession && !offlinePass) {
    if (!authReady) return <div className="app-shell" />;  // 세션 확인 전 깜빡임 방지
    return (
      <div className="app-shell">
        <div className="screens">
          <section className="screen active">
            <Gate
              onVaultKey={rememberVaultKey}
              onToast={showToast}
              signedInOnce={hasSignedInOnce()}
              onContinueOffline={() => setOfflinePass(true)}
            />
          </section>
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  if (deck) {
    return (
      <div className="app-shell">
        <div className="screens">
          <section className="screen active">
            <Study
              deck={deck}
              review={review}
              settings={settings}
              session={session}
              bookmarks={progress.bookmarks || []}
              memos={memos}
              onSaveMemo={saveMemo}
              onReviewChange={applyReview}
              onSessionChange={setSession}
              onSettingsChange={patchSettings}
              onBookmark={toggleBookmark}
              onToast={showToast}
              onClose={() => setDeck(null)}
            />
          </section>
        </div>
        {/* 회독 중에도 탭바를 남긴다. 없애 놨더니 다른 데로 가려면 위쪽 뒤로가기를
            찾아야 했는데, 그건 이 앱에서 여기 한 곳만 다른 규칙이었다.
            진도는 session에 남으니 나갔다 와도 이어진다. */}
        <TabBar
          active="today"
          onChange={(id) => { setDeck(null); selectTab(id); }}
          reviewCount={due.length + sentenceDue}
        />
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Onboarding open={onboardingOpen} onFinish={finishOnboarding} />

      <div className="screens">
        <section className={`screen${activeTab === 'today' && !sub ? ' active' : ''}`}>
          <Today
            pool={todayPool}
            review={review}
            settings={settings}
            stats={stats}
            streak={streak}
            session={session}
            resumeLabel={session?.label}
            onStart={startToday}
            onResume={resumeSession}
            onOpenReview={() => setActiveTab('review')}
          />
        </section>

        <section className={`screen${activeTab === 'study' && !sub ? ' active' : ''}`}>
          <StudyHub
            words={words}
            review={review}
            settings={settings}
            onOpen={openMenu}
          />
        </section>

        <section className={`screen${activeTab === 'log' && !sub ? ' active' : ''}`}>
          <Log
            words={words}
            review={review}
            stats={stats}
            streak={streak}
            onOpenReview={() => setActiveTab('review')}
          />
        </section>

        {/* 영상은 제 탭에서 산다. 홈 카드로 두면 단어 외우기 메뉴들 사이에 섞여
            버리는데, 보고 듣고 따라 말하는 일은 결이 다르다.

            탭은 숨겨져 있어도 화면에 붙어 있어서, 그대로 두면 앱을 켜자마자
            열지도 않은 탭이 유튜브에서 제목과 섬네일을 받아 온다. 한 번 들어간
            뒤부터 붙이고, 그 뒤로는 계속 붙여 둔다 — 보던 자리를 잃지 않게. */}
        <section className={`screen${activeTab === 'videos' && !sub ? ' active' : ''}`}>
          {videosSeen && (
          <Videos
            active={activeTab === 'videos' && !sub}
            settings={settings}
            words={words}
            onAddWord={(w) => setCustomWords((prev) => (
              prev.some((x) => x.id === w.id) ? prev : [...prev, w]
            ))}
            onStartSet={startJlptSet}
            onToast={showToast}
            signedIn={Boolean(authSession?.user)}
            videos={videos}
            setVideos={setVideos}
            analyses={videoAnalyses}
            setAnalyses={setVideoAnalyses}
            scripts={videoScripts}
            setScripts={setVideoScripts}
            progress={videoProgress}
            setProgress={setVideoProgress}
            onRemoveVideo={removeVideo}
            onBack={() => setActiveTab('study')}
          />
          )}
        </section>

        <section className={`screen${activeTab === 'review' && !sub ? ' active' : ''}`}>
          <ReviewTab
            words={words}
            review={review}
            streak={streak}
            stats={stats}
            onStartDeck={startDueDeck}
            onOpenWeak={startWeakDeck}
            onOpenSentences={() => setSub('sentences')}
            sentenceDue={sentenceDue}
          />
        </section>

        <section className={`screen${activeTab === 'more' && !sub ? ' active' : ''}`}>
          <Settings
            settings={settings}
            onChange={patchSettings}
            onReplayOnboarding={() => setOnboardingOpen(true)}
            onOpenWordManager={() => setSub('manage')}
            onToast={showToast}
            onReload={() => window.location.reload()}
            session={authSession}
            syncState={syncState}
            onSync={() => runSync(false)}
            onSignedOut={() => {
              setAuthSession(null); setRemoteKeyEnvelope(null); rememberVaultKey(null); setOfflinePass(false);
              syncedFor.current = null; showToast('로그아웃했어요');
            }}
            onVaultKey={rememberVaultKey}
            remoteKeyEnvelope={remoteKeyEnvelope}
            vaultReady={Boolean(vaultKey)}
          />
        </section>
      </div>

      {sub && (
        <div className="subscreen open">
          <div className="sub-header">
            {/* 메뉴는 이제 학습 탭에서 열린다. 「홈」이라고 적어 두면 안 맞는다. */}
            <button className="sub-back" onClick={() => setSub(null)}><IconArrowLeft /> 뒤로</button>
            <div className="sub-title">{SUB_TITLES[sub]}</div>
          </div>
          <div className="sub-body">
            {sub === 'worddeck' && (
              <WordDeck
                words={words}
                review={review}
                settings={settings}
                onChange={patchSettings}
                onStart={startWordDeck}
              />
            )}
            {sub === 'basics' && <Basics settings={settings} onToast={showToast} />}
            {sub === 'grammar' && (
              <GrammarHub
                words={words}
                progress={progress}
                onProgress={(moduleId, delta) => setProgress((p) => ({
                  ...p, grammarDone: { ...p.grammarDone, [moduleId]: (p.grammarDone[moduleId] || 0) + delta },
                }))}
                onPatternDone={(patternId) => setProgress((p) => ({
                  ...p, sentenceDone: { ...p.sentenceDone, [patternId]: true },
                }))}
              />
            )}
            {sub === 'sentences' && (
              <Situations
                review={review}
                settings={settings}
                onReviewChange={applyReview}
                onToast={showToast}
              />
            )}
            {sub === 'jlpt' && (
              <Jlpt
                words={words}
                review={review}
                onStartSet={startJlptSet}
                onToast={showToast}
              />
            )}
            {sub === 'translate' && (
              <Translate
                settings={settings}
                history={translations}
                onHistory={setTranslations}
                trends={trends}
                onTrends={setTrends}
                onAddWord={(w) => setCustomWords((prev) => (
                  prev.some((x) => x.id === w.id) ? prev : [...prev, w]
                ))}
                onToast={showToast}
              />
            )}
            {sub === 'quiz' && (
              <Quiz
                words={words}
                review={review}
                settings={settings}
                onChange={patchSettings}
                onToast={showToast}
                onRetryWrong={startQuizWrongDeck}
              />
            )}
            {sub === 'listen' && (
              <Listen
                pool={todayPool}
                words={words}
                sentences={sentenceCards}
                review={review}
                settings={settings}
                onClose={() => setSub(null)}
                onToast={showToast}
              />
            )}
            {sub === 'conjugate' && (
              <Conjugate
                words={words}
                progress={progress}
                settings={settings}
                onProgress={(conj) => setProgress((p) => ({ ...p, conj }))}
                onToast={showToast}
              />
            )}
            {sub === 'manage' && (
              <WordManager
                words={words}
                customWords={customWords}
                onAddWord={(w) => setCustomWords((prev) => [...prev, w])}
                onDeleteWord={(id) => setCustomWords((prev) => prev.filter((w) => w.id !== id))}
                onToast={showToast}
              />
            )}
          </div>
        </div>
      )}

      {/* 하던 판이 사라지기 전에 한 번 알린다 */}
      <BottomSheet open={Boolean(askSwap)} onClose={() => setAskSwap(null)}>
        {askSwap && (
          <div className="swapask">
            <h3>하던 학습을 접을까요?</h3>
            <p>
              «{askSwap.from}»이 {askSwap.left}개 남아 있어요.
              새로 시작하면 그 진행은 접히고, 푼 만큼은 기록에 남아요.
            </p>
            <div className="swapask-acts">
              <button className="ghost-btn" onClick={() => setAskSwap(null)}>그만두기</button>
              <button
                className="submit-btn"
                onClick={() => { const go = askSwap.run; setAskSwap(null); go(); }}
              >
                접고 새로 시작
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <TabBar
        active={activeTab === 'videos' ? 'study' : activeTab}
        onChange={selectTab}
        reviewCount={due.length + sentenceDue}
      />
      <Toast message={toast} />
    </div>
  );
}

function Toast({ message }) {
  return <div className={`toast${message ? ' show' : ''}`}>{message}</div>;
}
