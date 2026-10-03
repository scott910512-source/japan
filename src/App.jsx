import { useAppData, usePersistAppData } from './app/useAppData.js';
import { useLayerNavigation } from './app/useLayerNavigation.js';
import FeatureScreen from './app/FeatureScreen.jsx';
import { StudyHub, Log, Study, Settings, Videos, NewPassword, ReviewHub } from './app/screens.js';
import { DeferredScreen, ScreenLoading, ScreenSlot } from './components/ScreenSlot.jsx';
import { filterByLevel } from './lib/wordFilters.js';
import { useAccountSync } from './app/useAccountSync.js';
import { useToast } from './app/useToast.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import { ensurePlan, markStudied, noteFreeStudy, planStatus, reviewLeftOf, unmarkStudied } from './lib/plan.js';
import { LANE_DECK, useStudyQueue } from './app/useStudyQueue.js';
import BottomSheet from './components/BottomSheet.jsx';
import Onboarding from './components/Onboarding.jsx';
import Today from './screens/Today.jsx';
import Gate from './screens/Gate.jsx';
import { IconArrowLeft } from './components/Icons.jsx';
import { dailyPool } from './lib/cards.js';
import { markBusy } from './lib/busy.js';
import { kijuIndex } from './lib/kiju.js';
import {
  touchStreak, loadStreak, setStorageErrorHandler, setStorageOkHandler,
  hasSignedInOnce,
} from './lib/storage.js';
import { addToDay, removeFromDay, noteActivity as noteActivityIn } from './lib/stats.js';
import { audioUnlocked, configureTTS, setTTSErrorHandler, unlockAudio } from './lib/tts.js';
import { configureSTT } from './lib/stt.js';
import { applyVerdict, dueCards, isSessionClear, stateOf, summarize, todayKey } from './lib/review.js';
import { forgetSpeed, noteWeak, relapseNotes, weakReasons, weakSummary } from './lib/weak.js';
import { roundSummary } from './lib/rounds.js';
import { supabaseConfigured } from './lib/supabase.js';
import { authGate } from './lib/authboot.js';
import { useToday } from './lib/useToday.js';
import { GRAMMAR_MODULES } from './data/grammar.js';

const SUB_TITLES = {
  basics: '완전기초',
  grammar: '문법',
  sentences: '문장 · 상황별 회화',
  translate: '번역기',
  manage: '내 단어장',
  worddeck: '단어',
  kiju: '기출 단어 · 한자읽기',
  quiz: '단어 시험',
  conjugate: '동사 활용',
  match: '짝 맞추기',
  rpg: '실전 연습',
  repeat: '전체 복습 · 회독 학습',
  adverb: '부사 연습',
  listenhub: '듣기',
  listen: '듣기 · 따라 말하기',
  videos: '영상으로 배우기',
  swiss: '독일어 여행 회화',
  n3: '한 권으로 끝내는 N3',
  settings: '설정',
};

export default function App() {
  /* 탭은 넷 — 홈 · 학습 · 복습 · 내 학습. 영상(videos)은 탭이 아니라 학습 탭
     안의 화면인데, 유튜브 플레이어를 품고 있어서 밀어 넣는 화면(sub)이 아니라
     탭 자리(ScreenSlot)에 산다 — 그래서 activeTab 값으로 남아 있다. */
  const [activeTab, setActiveTab] = useState('home');
  const [videosSeen, setVideosSeen] = useState(false); // 영상 화면에 한 번이라도 들어갔는지
  const [sub, setSub] = useState(null);
  /* N3 코스를 어느 자리에서 열지 — 학습 탭 「한자」는 한자 과정, 복습 탭
     「틀린 문제」는 오답노트. 코스가 열릴 때 한 번 읽는다. */
  const [n3View, setN3View] = useState(null);
  // 듣기에 어떤 방식으로 들어왔는지 — 자동 듣기냐 따라 말하기냐
  const [listenMode, setListenMode] = useState('listen');
  /* 듣기에서 시험으로 넘어갈 때 들고 가는 세트. 비어 있으면 시험은 평소대로
     제 설정(범위·개수)으로 문제를 짠다. */
  const [quizSet, setQuizSet] = useState(null);
  const [deck, setDeck] = useState(null); // 학습 중인 덱 (있으면 회독 화면이 전체를 덮는다)

  const appData = useAppData();
  const {
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
    translations,
    setTranslations,
    trends,
    setTrends,
    removeVideo
  } = appData;
  const [streak, setStreak] = useState({ count: 0, lastDate: null });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const { toast, showToast } = useToast();
  /* 저장이 막힌 상태. 해결될 때까지 남는다 — 토스트만으로는 못 알아챈다. */
  const [storeError, setStoreError] = useState(null);
  const [offlinePass, setOfflinePass] = useState(false);
  const {
    authSession,
    setAuthSession,
    syncState,
    remoteKeyEnvelope,
    setRemoteKeyEnvelope,
    vaultKey,
    authReady,
    recovering,
    setRecovering,
    rememberVaultKey,
    runSync,
    syncedFor,
    patchSettings
  } = useAccountSync({ data: appData, streak, setStreak, showToast });

  useEffect(() => {
    /* 저장 실패는 토스트로 끝내지 않는다 — 두 걸음 걷고 나면 사라지는데 그
       사이 기록은 계속 저장되지 않는다. 해결될 때까지 설정의 저장 상태에 남는다. */
    setStorageErrorHandler((msg) => { showToast(msg); setStoreError(msg); });
    // 켜져 있을 때만 끈다 — write가 성공할 때마다 화면을 다시 그리지 않게
    setStorageOkHandler(() => setStoreError((cur) => (cur ? null : cur)));
    setTTSErrorHandler(showToast);
    /* 새 버전이 준비됐는데 학습 중이라 미뤄 둔 경우(main.jsx). 조용히 미루면
       왜 안 바뀌는지 알 수 없으니 한 번 알린다 — 판을 끝내면 적용된다. */
    const onWaiting = (e) => showToast(
      e?.detail?.label || '새 버전이 준비됐어요 · 앱을 내려놨다 열면 적용돼요',
    );
    window.addEventListener('jp:update-waiting', onWaiting);
    /* 연속일은 여기서 올리지 않는다 — 앱을 켠 것과 공부한 것은 다르다.
       올리는 자리는 오늘 첫 판정(applyReview)이다. */
    setStreak(loadStreak());
    /* 온보딩은 여기서 열지 않는다. 로그인한 사람은 계정에 이미 답이 있는데,
       동기화가 내려오기 전에 물어보면 기기를 바꿀 때마다 「가타카나 읽을 줄
       아세요?」를 다시 답하게 된다. 아래 effect가 알 만해진 뒤에 정한다. */

    // iOS는 첫 사용자 제스처에서만 오디오를 열어준다.
    // 한 번에 성공하지 못할 수 있어 열릴 때까지 계속 시도한다.
    const unlock = () => {
      unlockAudio();
      if (audioUnlocked()) window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('jp:update-waiting', onWaiting);
    };
  }, [showToast]);

  useLayerNavigation({ deck, sub, setDeck, setSub });

  /* ★ 밀어 넣은 화면이 열려 있으면 새 버전으로 안 갈아끼운다 ★
   *
   * 화면마다 따로 알리게 해 두었더니 구멍이 남았다 — N3 코스는 문제를 푸는
   * 중에만 표시를 세웠고, 코스를 열어 놓고 무엇을 할지 고르는 동안(허브)은
   * 「끊길 게 없다」로 읽혔다. 거기가 바로 「N3 들어가서 공부하려고 할 때」다.
   * 기출 단어·단어·문법도 마찬가지로 비어 있었다.
   *
   * 화면을 하나씩 세는 방식이 틀렸다. 밀어 넣은 화면이 열려 있다는 것은 곧
   * 새로고침하면 그 화면이 닫히고 탭으로 돌아간다는 뜻이고, 그게 쓰는 사람에게
   * 「튕겼다」이다. 무엇을 하던 중인지는 따질 필요가 없다.
   *
   * 회독 판(deck)과 영상도 같이 본다. 판은 저장소에도 남지만 여기서 보면
   * 저장되기 전의 한 걸음까지 덮인다. */
  useEffect(() => {
    markBusy('sub', Boolean(sub));
    return () => markBusy('sub', false);
  }, [sub]);
  useEffect(() => {
    markBusy('deck', Boolean(deck));
    return () => markBusy('deck', false);
  }, [deck]);
  useEffect(() => {
    markBusy('videos', activeTab === 'videos');
    return () => markBusy('videos', false);
  }, [activeTab]);
  /* ★ 홈이 아닌 자리도 「하던 중」이다 ★
   *
   * 여태 이 표시는 판정하는 자리(듣기·시험·코스·회독)만 세웠다. 그런데
   * 갈아끼우기는 곧 새로고침이고, 이 앱은 주소가 없다 — 어느 탭에 있었든
   * 새로고침하면 홈이다. 학습 탭을 열어 둔 사람에게 그건 그냥 튕김이다.
   *
   * 홈에 그대로 있을 때는 세우지 않는다. 그 자리에서는 새로고침해도 다시
   * 홈이라 잃는 게 없고, 그 틈이 있어야 새 버전이 실제로 적용된다. */
  useEffect(() => {
    markBusy('tab', activeTab !== 'home');
    return () => markBusy('tab', false);
  }, [activeTab]);

  /* 온보딩을 열지 말지 정한다.
   *
   * 로그인한 사람은 첫 동기화가 끝날 때까지 기다린다 — 계정에 저장된 답이
   * 내려오면 물어볼 이유가 없다. 로그인을 안 했거나 서버를 안 쓰는 사람은
   * 기기에 있는 것만 보고 바로 정한다.
   *
   * 한 번 정하고 나면 다시 안 건드린다. 동기화가 두 번째로 돌 때 또 열리면
   * 공부하던 중에 온보딩이 튀어나온다. */
  const onboardingDecided = useRef(false);
  useEffect(() => {
    if (onboardingDecided.current) return;
    if (!authReady) return;                                   // 로그인 상태를 아직 모른다
    const signedIn = Boolean(authSession?.user);
    if (signedIn && syncedFor.current !== authSession.user.id) return;  // 동기화를 기다린다
    onboardingDecided.current = true;
    /* 답이 이미 있으면 끝난 것으로 본다. onboarded 표시가 옛 기기에만 있고
       계정에는 없을 수 있어서, 답(canReadKana)이 있는지도 같이 본다. */
    setOnboardingOpen(!settings.onboarded && settings.canReadKana == null);
  }, [authReady, authSession, settings.onboarded, settings.canReadKana, syncState.at]);

  usePersistAppData(appData);

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

  /* ★ 학습 자료는 따로 받는다 ★
     단어 2,674·상황 문장 600을 App이 정적으로 불러와서 첫 로딩 JS의 대부분이
     자료였다. lib/content.js를 import()로 열어 껍데기(탭·홈)가 먼저 뜨고, 자료가
     오면 계획을 짠다. 오프라인 사전 캐시가 이 청크도 미리 받아 둔다. */
  const [content, setContent] = useState(null);
  useEffect(() => {
    let alive = true;
    import('./lib/content.js').then((m) => { if (alive) setContent(m.getContent()); });
    return () => { alive = false; };
  }, []);
  const words = useMemo(() => [...(content?.words || []), ...customWords], [content, customWords]);
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  /* 오늘 날짜를 화면에 묶는다. 렌더 안에서 todayKey()를 부르기만 하면
     자정을 넘겨도 리액트가 다시 안 그려서, 복습 배지가 어제 값에 머문다. */
  const today = useToday();
  const due = useMemo(() => dueCards(wordIds, review, today), [wordIds, review, today]);

  const sentenceIds = useMemo(() => content?.sentenceIds || [], [content]);
  const sentenceDue = useMemo(
    () => dueCards(sentenceIds, review, today).length,
    [sentenceIds, review, today],
  );


  /* ── 회독 ── */

  const applyReview = useCallback((nextReview, verdict, cardId, opts) => {
    setReview(nextReview);

    /* ★ 「몇 번 눌렀나」와 「무엇을 끝냈나」는 다른 숫자다 ★
       아래 stats는 앞엣것(활동 통계), plan은 뒤엣것(고유 학습 완료)이다.
       한 카드를 세 번 만나면 stats는 3이 오르고 plan은 1이 오른다. */
    if (cardId) {
      /* ★ 「만났다」와 「끝냈다」는 다르다 ★
         몰라요를 누른 카드는 이번 판에서 다시 나온다. 그걸 완료로 세면
         「남은 0개」인데 화면에는 카드가 계속 나오는 꼴이 된다.
         이번 판에서 정리된 것(isSessionClear)만 완료로 센다. */
      const clear = isSessionClear(stateOf(nextReview, cardId));
      setPlan((prev) => (opts?.undo || !clear
        ? unmarkStudied(prev, cardId)
        : markStudied(prev, cardId)));
    }

    if (!verdict) return;

    /* 되돌릴 때는 그 판정이 적힌 날에서 뺀다. 오늘로 잡으면 자정을 넘겨
       되돌렸을 때 어제 올린 것을 오늘에서 빼게 된다. */
    const day = opts?.day || todayKey();

    /* ★ 되돌리면 활동 수도 물러야 한다 ★
     *
     * 여태 판정은 올리고 되돌리기는 안 뺐다. 그래서 잘못 눌러 되돌리고 다시
     * 누르면 카드 하나를 한 번 판정했는데 활동이 둘로 셌다. 화면에 「오늘 40개」가
     * 뜨는데 실제로 본 카드는 스무 장인 식이다 — 고칠 데를 찾으려고 기록을
     * 보는 사람에게 기록이 거짓말을 하면 볼 이유가 없다. */
    if (opts?.undo) {
      setStats((prev) => removeFromDay(prev, day, [verdict]));
      /* 연속일은 되돌리지 않는다. 「오늘 공부했나」는 판정 하나에 달린 게 아니고,
         한 장을 물렀다고 그 날 안 한 것이 되지도 않는다. 되돌릴 근거가 없다. */
      return;
    }

    // 오늘 처음 판정한 순간에 연속일이 오른다. 같은 날 두 번째부터는 그대로 둔다.
    setStreak((prev) => (prev.lastDate === day ? prev : touchStreak()));
    setStats((prev) => addToDay(prev, day, [verdict]));
  }, []);

  /* 회독 화면 밖에서 판정이 들어올 때 — 지금은 실전 연습이 유일하다.
   *
   * { 표현id: 판정 } 여러 개를 한꺼번에 받는다. 실전 한 판이 끝나야 결과가
   * 나오니 낱장으로 부를 자리가 없다. 여기를 거치면 그 표현은 회독 저장소에
   * 들어가고, 다음 날 오늘의 학습이 약점으로 집어 간다 — 별도 배선 없이.
   *
   * 연속일은 여기서 올린다. 실전도 공부다. 통계의 studied도 같이 센다. */
  const applyVerdicts = useCallback((map) => {
    const ids = Object.keys(map || {});
    if (!ids.length) return;
    const day = todayKey();
    /* ★ 잊어버림은 판정을 적용하기 전에 센다 ★
       적용하고 나면 기억 단계가 0으로 내려가서, 「외웠던 낱말이 무너졌다」는
       사실이 사라진다. 판정 뒤에 세면 전부 「그냥 모르는 낱말」로 보인다.

       ★ setReview 안에서 세지 않는다 ★
       그 안이 판정 직전의 상태를 쥐고 있어서 처음엔 거기서 셌는데, 갱신
       함수는 React가 두 번 부를 수 있다(StrictMode). 세는 일은 더하기라
       두 번 불리면 한 번 틀린 것이 두 번으로 적힌다. 그래서 바깥에서, 그릴
       때 담아 둔 회독 기록(reviewRef)으로 센다. */
    const relapses = relapseNotes(reviewRef.current, map, day);
    if (relapses.length) {
      setProgress((p) => ({ ...p, weak: noteWeak(p.weak, relapses) }));
    }
    setReview((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = applyVerdict(next[id], map[id], day);
      return next;
    });
    setStreak((prev) => (prev.lastDate === day ? prev : touchStreak()));
    /* 계획 밖 자유 학습이라도 계획의 같은 항목을 채웠으면 한 번만 반영한다.
       계획에 없는 카드면 여기서 계획 수를 늘리지 않는다 — 자유 학습으로
       오늘 목표가 저절로 커지면 「오늘 할 것」이 무슨 뜻인지 알 수 없게 된다. */
    setPlan((prev) => ids.reduce((pl, id) => noteFreeStudy(pl, id), prev));
    /* 여기도 같은 표를 쓴다. 손으로 세던 때는 known을 빼먹어서, 실전에서
       맞힌 것이 어느 칸에도 안 남았다. */
    setStats((prev) => addToDay(prev, day, ids.map((id) => map[id])));
  }, []);

  /* 판정이 아닌 활동(듣기·시험). 회독 진도는 올리지 않고 활동 칸에만 적는다 —
     들으면서 흘려보낸 것과 떠올려서 맞힌 것은 다른 일이다. 그래도 아무 데도
     안 남으면 한 시간 듣고도 기록이 그대로라, 노력한 내역은 보여 준다. */
  const noteActivity = useCallback((patch) => {
    setStats((prev) => noteActivityIn(prev, todayKey(), patch));
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
  const sentenceCards = useMemo(() => content?.sentenceCards || [], [content]);
  /* 목적에 따라 차례를 바꿀 때 문장이 어느 상황인지 알아야 한다 —
     「여행」이면 주문·결제·길 찾기·숙소를 먼저 배정한다. */
  const sentById = useMemo(() => new Map(sentenceCards.map((c) => [c.id, c])), [sentenceCards]);
  /* 이미 배운 문장 — 레벨을 좁혀도 복습에서 안 사라지게 넘긴다 */
  const seenIds = useMemo(() => {
    const out = new Set();
    for (const [id, st] of Object.entries(review)) if (st?.lastSeen) out.add(id);
    return out;
  }, [review]);
  /* 기출부터 배운다 — 열여섯 해 한자읽기에 나온 205개(lib/kiju.js).
     자료 차례가 아니라 「실제로 나온 적 있는가」가 새 단어의 순서를 정한다.
     레벨 필터는 그대로다. 고르지 않은 레벨의 기출까지 끌어오지는 않는다. */
  const kijuFirst = useMemo(() => new Set(kijuIndex(words).keys()), [words]);
  const todayPool = useMemo(
    () => dailyPool(filterByLevel(words, settings.levels), sentenceCards, {
      levels: settings.levels,
      seen: seenIds,
      includeUnleveled: settings.sentenceScope !== 'level',
      first: kijuFirst,
    }),
    [words, settings.levels, sentenceCards, seenIds, settings.sentenceScope, kijuFirst],
  );

  /* 날짜가 바뀌면 계획을 새로 짠다. 같은 날이면 있던 것을 그대로 쓴다 —
     여기서 다시 짜면 오늘 끝낸 게 사라진다.

     useToday(today)를 쓰기 때문에 자정을 넘겨도 화면을 켜 둔 채로 갱신된다. */
  useEffect(() => {
    if (!todayPool.length) return;
    setPlan((prev) => ensurePlan(prev, todayPool, review, {
      goals: settings.goals,
      today,
      purpose: settings.purpose,
      cardOf: (id) => sentById.get(id) || byId.get(id),
      /* 약점 장부. 시험에서 틀린 낱말·외웠다가 무너진 낱말이 오늘의 약점
         갈래로 들어오는 길이다 — 안 넘기면 회독 기록만 보던 예전 그대로다. */
      ledger: progress.weak,
    }));
    /* review를 같이 본다. 아침에 동기화가 끝나기 전 짠 「복습 0」짜리 계획이
       하루 종일 남는 것을 막기 위해서다. 손댄 뒤로는 ensurePlan이 얼린다.

       약점 장부(progress.weak)는 일부러 안 본다. 듣기가 한 장 넘길 때마다
       장부에 한 줄이 쌓이는데, 그걸 여기 넣으면 스무 장을 듣는 동안 계획을
       스무 번 다시 짠다. 장부는 계획을 짤 때 읽히고, 듣는 중에 쌓인 것은
       다음 계획에 반영된다 — 오늘 할 일이 듣는 중에 바뀌지도 않는다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, todayPool.length, settings.goals, settings.purpose, review]);

  /* 화면·큐·통계가 모두 이 하나를 본다 — 같은 정보를 여러 곳에서 다른
     숫자로 보여 주지 않으려면 셈하는 자리가 하나여야 한다. */
  const planNow = useMemo(() => planStatus(plan), [plan]);

  /* ★ 복습 탭 배지 · 홈 · 복습 탭이 같은 수를 본다 ★
     오늘 계획의 복습·약점 갈래에서 남은 것 — reviewLeftOf 한 곳에서. 밀린
     복습(backlog)은 배지에 더하지 않는다. 더했더니 배지는 「99+」인데 복습 탭은
     「11개」라 같은 화면에서 숫자가 달랐다. 밀린 것은 복습 탭 안에서만 말한다. */
  const reviewLeft = useMemo(() => reviewLeftOf(planNow).left, [planNow]);

  /* 약점 — 복습 탭·내 학습·취약 단어 덱이 한 군데를 본다.
   *
   * 여기서 보는 것은 회독 기록(review)과 약점 장부(progress.weak) 둘이다.
   * 회독만 보던 때는 시험에서 열 번 틀린 낱말이 약점 0이었다 — 시험·듣기가
   * 회독에 아무것도 안 쓰기 때문이다(그 판단은 그대로 둔다). 장부가 그
   * 빈자리를 채운다. 규칙은 lib/weak.js 한 군데에 있다. */
  const weakBook = useMemo(
    () => weakSummary(wordIds, review, progress.weak),
    [wordIds, review, progress.weak],
  );
  const weakWords = weakBook.total;

  /* 복습 탭이 그릴 줄 — 제일 약한 다섯 개와 왜 약한지.
     숫자만 보여 주면 무엇을 할지가 안 정해진다. 「시험에서 세 번 틀렸어요」와
     「쉰 번 들었어요」는 다음에 할 일이 다른 낱말이다. */
  const weakRows = useMemo(() => weakBook.top.map(({ id, st, rec }) => {
    const card = byId.get(id);
    return {
      id,
      kanji: card?.kanji || id,
      kana: card?.kana || '',
      mean: (card?.mean || '').split(';')[0].trim(),
      reasons: weakReasons(st, rec).slice(0, 3),
      speed: forgetSpeed(rec),
    };
  }), [weakBook, byId]);

  /* 회독 기록을 그릴 때마다 담아 둔다. 판정을 받는 함수(applyVerdicts)는
     의존성이 빈 배열이라 지금 상태를 모르는데, 「외웠던 낱말인가」를 알려면
     판정 직전의 기록이 필요하다. 의존성에 review를 넣으면 판정마다 함수가
     새로 생기고, 그걸 의존성으로 쓰는 효과(N3 코스)가 같이 다시 돈다. */
  const reviewRef = useRef(review);
  useEffect(() => { reviewRef.current = review; }, [review]);

  /* 약점 장부에 한 줄 적는다 — 시험과 듣기가 부른다.
     회독 저장소는 안 건드린다. 시험 때문에 복습 간격이 흔들리면 시험을
     마음 편히 못 보고, 듣기는 흘려들은 것까지 외운 것으로 세게 된다. */
  const noteWeakness = useCallback((notes) => {
    if (!notes?.length) return;
    setProgress((p) => {
      const weak = noteWeak(p.weak, notes);
      return weak === p.weak ? p : { ...p, weak };
    });
  }, []);
  /* 단어 회독 현황과 기억 단계 — 학습 탭·내 학습이 각자 세던 것을 한 번만 센다.
     review가 바뀔 때만 다시 센다(판정 한 번에 한 번). */
  const wordStat = useMemo(() => summarize(wordIds, review), [wordIds, review]);
  const rounds = useMemo(() => roundSummary(wordIds, review), [wordIds, review]);

  /* N3 오답노트 수 — 코스 자료를 안 불러오고 progress.n3.wrong만 센다.
     취약 문법은 같은 꼭지를 두 번 넘게 틀린 것. */
  const n3Wrong = useMemo(() => {
    const w = progress.n3?.wrong || {};
    let all = 0; const refs = {};
    for (const e of Object.values(w)) {
      all += 1;
      if ((e.cat === 'grammar' || e.cat === 'particle') && e.ref) refs[e.ref] = (refs[e.ref] || 0) + (e.c || 1);
    }
    return { all, grammar: Object.values(refs).filter((c) => c >= 2).length };
  }, [progress.n3?.wrong]);

  /* 아직 한 번도 안 본 문법 꼭지 수. 홈이 「오늘의 문법」에 적는다 —
     숫자가 없으면 눌러 보고 나서야 할 게 있는지 알게 된다. */
  const grammarLeft = useMemo(
    () => GRAMMAR_MODULES.filter((m) => !(progress.grammarDone?.[m.id] > 0)).length,
    [progress.grammarDone],
  );
  /* 오늘 볼 문법 꼭지 이름. 개수만 적으면 무엇을 배우는지 모른 채로 누른다 —
     「아직 안 본 것 3개」와 「て형」은 같은 정보가 아니다. */
  const grammarNext = useMemo(() => {
    const m = GRAMMAR_MODULES.find((x) => !(progress.grammarDone?.[x.id] > 0));
    return m ? `${m.title} · 짧은 테스트까지` : null;
  }, [progress.grammarDone]);

  /* 회독 판을 짜는 함수들은 app/useStudyQueue.js에 — 오늘의 학습·이어하기·
     단어·복습·취약·JLPT 세트·시험 오답. 동작은 App에 있던 그대로다. */
  const {
    askSwap, setAskSwap, guardDeck, learnMore,
    startToday, resumeSession, startWordDeck, startKijuDeck, startDueDeck, startWeakDeck, startJlptSet, startQuizWrongDeck,
  } = useStudyQueue({
    session, plan, planNow, setPlan, words, wordIds, byId, sentenceCards, review, settings, due, todayPool, today,
    setDeck, setSub, showToast,
    /* 약점 장부 — 취약 단어 판과 「10개 더」가 본다 */
    ledger: progress.weak,
  });

  /* 학습 메뉴를 연다.
     한자는 N3 코스의 한자 과정을, 듣기는 듣기 고르기(자동·따라·영상)를 연다.
     같은 자료·화면을 두 벌 두지 않는다 — 길만 여기서 정한다. */
  const openMenu = useCallback((id, opts = {}) => {
    /* 메뉴로 들어온 시험은 평소 시험이다 — 듣던 세트를 들고 가지 않는다.
       안 비우면 듣기를 한 번 쓴 뒤로 「단어 시험」이 영영 그 스무 개만 묻는다. */
    if (id !== 'quiz') setQuizSet(null);
    if (id === 'words') { setSub('worddeck'); return; }
    if (id === 'weak') { startWeakDeck(); return; }
    if (id === 'videos') { setVideosSeen(true); setSub(null); setActiveTab('videos'); return; }
    if (id === 'listen') { setSub('listenhub'); return; }
    if (id === 'kanji') { setN3View({ kind: 'curriculum', chapter: 'ch4' }); setSub('n3'); return; }
    if (id === 'n3') { setN3View(opts.view || null); setSub('n3'); return; }
    setSub(id);
  }, [startWeakDeck]);

  /* 듣기에서 무엇을 여는가. 자동 듣기와 따라 말하기는 같은 화면이고
     방식만 다르다 — 화면을 두 벌로 만들면 고친 게 한쪽에만 남는다. */
  const openListen = useCallback((id) => {
    if (id === 'videos') { setVideosSeen(true); setSub(null); setActiveTab('videos'); return; }
    setListenMode(id === 'shadow' ? 'shadow' : 'listen');
    setSub('listen');
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
            <DeferredScreen>
            <NewPassword
              session={authSession}
              onVaultKey={rememberVaultKey}
              onToast={showToast}
              onDone={() => setRecovering(false)}
            />
            </DeferredScreen>
          </section>
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  /* 로그인해야 들어올 수 있다. 학습 기록을 계정에 남기는 게 목적이므로
   * 익명 사용은 열어 두지 않는다. 세션은 기기에 남아 다음부터는 이 화면을 건너뛴다. */
  /* 로그인 문을 보여 줄지, 확인 중 화면을 둘지, 그냥 들어갈지.
     판단은 lib/authboot.js 한 곳에 있다 — 서버 확인이 깨지거나 끝내 안
     오더라도 사람이 고를 수 있는 자리까지는 가야 한다. 거기 갇힌 화면이
     한 번 있었다. */
  const gate = authGate({
    configured: supabaseConfigured, ready: authReady, session: authSession, offlinePass,
  });
  if (gate === 'loading') {
    return <div className="app-shell"><ScreenLoading label="학습 기록을 확인하고 있어요" /></div>;
  }
  if (gate === 'gate') {
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

  /* 자료가 아직 안 왔다 — 로그인 문은 위에서 이미 지났으니 여기서 잠깐 기다린다.
     같은 기기에서 두 번째부터는 사전 캐시에서 바로 온다. */
  if (!content) return <div className="app-shell"><ScreenLoading label="학습 자료를 여는 중" /></div>;

  if (deck) {
    return (
      <div className="app-shell">
        <div className="screens">
          <section className="screen active">
            <DeferredScreen>
            <Study
              deck={deck}
              review={review}
              settings={settings}
              session={session}
              bookmarks={progress.bookmarks || []}
              memos={memos}
              onSaveMemo={saveMemo}
              asks={asks}
              onAsks={setAsks}
              onAddWord={(w) => setCustomWords((prev) => (
                prev.some((x) => x.id === w.id) ? prev : [...prev, w]
              ))}
              onReviewChange={applyReview}
              onSessionChange={setSession}
              onSettingsChange={patchSettings}
              onBookmark={toggleBookmark}
              onToast={showToast}
              onNext={deck.next ? () => {
                if (deck.next.to === 'fresh') { startToday(['fresh']); return; }
                setDeck(null);
                setActiveTab('study');
                setSub('repeat');
              } : null}
              onClose={() => setDeck(null)}
              /* 판을 끝내고 「홈으로」 — 어디서 시작했든 홈에서 오른 진도를 본다 */
              onHome={() => { setDeck(null); selectTab('home'); }}
            />
            </DeferredScreen>
          </section>
        </div>
        {/* ★ 학습 중에는 탭바를 두지 않는다 ★
            문제와 카드에 집중하는 자리라, 다른 메뉴가 시선을 빼앗지 않게 한다.
            나가는 길은 화면 위 닫기와 브라우저 뒤로가기(useLayerNavigation)다.
            진도는 session에 남으니 나갔다 와도 홈의 「이어하기」로 그 자리다. */}
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Onboarding open={onboardingOpen} onFinish={finishOnboarding} />

      <div className="screens">
        <ScreenSlot active={activeTab === 'home' && !sub}>

          <Today
            plan={plan}
            planNow={planNow}
            settings={settings}
            streak={streak}
            session={session}
            resumeLabel={session?.label}
            grammarLeft={grammarLeft}
            grammarNext={grammarNext}
            /* ★ 주요 버튼 하나 ★ 갈래를 안 주면 배정된 것을 순서대로 다 돈다. */
            onStartAll={() => guardDeck(() => startToday(null), LANE_DECK(null))}
            onStartWords={() => guardDeck(() => startToday(['fresh']), LANE_DECK(['fresh']))}
            onStartReview={() => guardDeck(() => startToday(['review', 'weak']), LANE_DECK(['review', 'weak']))}
            onOpenGrammar={() => openMenu('grammar')}
            /* N3 코스로 가는 줄. 메뉴를 끈 사람에게는 안 보인다 */
            onOpenN3={settings.menus?.n3 ? () => openMenu('n3') : null}
            n3={progress.n3 || null}
            onResume={resumeSession}
            onOpenReview={() => selectTab('review')}
            onLearnMore={learnMore}
          />
        </ScreenSlot>

        <ScreenSlot active={activeTab === 'study' && !sub}>

          <StudyHub
            words={words}
            stat={wordStat}
            settings={settings}
            n3Summary={progress.n3?.summary || null}
            onOpen={openMenu}
            /* 바로가기 — 자주 쓰는 메뉴를 사람이 골라 맨 앞에 둔다 */
            onChange={patchSettings}
            onToast={showToast}
          />
        </ScreenSlot>

        {/* 복습 — 길이 하나다. 오늘 복습·틀린 문제·약점·전체 복습이 여기서 열린다 */}
        <ScreenSlot active={activeTab === 'review' && !sub}>

          <ReviewHub
            planNow={planNow}
            sentenceDue={sentenceDue}
            weakWords={weakWords}
            /* 약점 장부 — 어느 게 약한지, 금방 잊어버리는지 */
            weakBook={weakBook}
            weakRows={weakRows}
            wrongCount={n3Wrong.all}
            weakGrammar={n3Wrong.grammar}
            onStartReview={() => guardDeck(() => startToday(['review', 'weak']), LANE_DECK(['review', 'weak']))}
            onStartBacklog={startDueDeck}
            onOpenSentences={() => setSub('sentences')}
            onOpenWrong={() => openMenu('n3', { view: { kind: 'wrong' } })}
            onOpenWeakWords={startWeakDeck}
            onOpenWeakGrammar={() => openMenu('n3', { view: { kind: 'weak', from: 'hub' } })}
            onOpenRepeat={() => setSub('repeat')}
          />
        </ScreenSlot>

        <ScreenSlot active={activeTab === 'me' && !sub}>

          <Log
            words={words}
            review={review}
            stat={wordStat}
            rounds={rounds}
            stats={stats}
            streak={streak}
            /* 오늘 배정·완료 3칸은 홈이 보여 준다 — 내 학습에서는 뺐다 */
            grammarLeft={grammarLeft}
            n3Summary={progress.n3?.summary || null}
            weakWords={weakWords}
            showN3={Boolean(settings.menus?.n3)}
            onOpenStudy={() => selectTab('study')}
            onOpenReview={() => selectTab('review')}
            onOpenSettings={() => setSub('settings')}
          />
        </ScreenSlot>

        {/* 영상은 학습 탭 안의 화면이지만 탭 자리(ScreenSlot)에 산다 — 유튜브
            플레이어를 품고 있어서, 밀어 넣는 화면처럼 열고 닫을 때마다 다시
            만들면 보던 자리를 잃는다.

            숨겨져 있어도 화면에 붙어 있어서, 그대로 두면 앱을 켜자마자 열지도
            않은 화면이 유튜브에서 제목과 섬네일을 받아 온다. 한 번 들어간
            뒤부터 붙이고, 그 뒤로는 계속 붙여 둔다. */}
        <ScreenSlot active={activeTab === 'videos' && !sub}>

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
            onBack={() => { setActiveTab('study'); setSub('listenhub'); }}
          />
          )}
        </ScreenSlot>
      </div>

      {sub && (
        <div className="subscreen open">
          <div className="sub-header">
            <button className="sub-back" onClick={() => setSub(null)}><IconArrowLeft /> 뒤로</button>
            <div className="sub-title">{SUB_TITLES[sub]}</div>
          </div>
          <div className="sub-body">
            <DeferredScreen key={sub}>
              {/* 설정은 내 학습 탭에서 밀어 넣는 화면이다 — 여섯 묶음(학습 설정 ·
                  음성 · 계정 · 백업 · 도구 · 앱 정보)은 그 안에 그대로 있다. */}
              {sub === 'settings' ? (
                <Settings
                  settings={settings}
                  onChange={patchSettings}
                  onReplayOnboarding={() => setOnboardingOpen(true)}
                  onOpenWordManager={() => setSub('manage')}
                  onOpenTranslate={() => setSub('translate')}
                  onOpenSwiss={() => setSub('swiss')}
                  onToast={showToast}
                  onReload={() => window.location.reload()}
                  session={authSession}
                  syncState={syncState}
                  /* 저장이 막혔으면 그 표시는 해결될 때까지 남는다 — 잠깐 뜨는
                     토스트만으로는 그날 공부한 게 안 저장되는 걸 모른다. */
                  storeError={storeError}
                  onSync={() => runSync(false)}
                  onSignedOut={() => {
                    setAuthSession(null); setRemoteKeyEnvelope(null); rememberVaultKey(null); setOfflinePass(false);
                    syncedFor.current = null; showToast('로그아웃했어요');
                  }}
                  onVaultKey={rememberVaultKey}
                  remoteKeyEnvelope={remoteKeyEnvelope}
                  vaultReady={Boolean(vaultKey)}
                />
              ) : (
              <FeatureScreen
                sub={sub}
                words={words}
                review={review}
                settings={settings}
                patchSettings={patchSettings}
                startWordDeck={startWordDeck}
                startKijuDeck={startKijuDeck}
                startJlptSet={startJlptSet}
                showToast={showToast}
                progress={progress}
                setProgress={setProgress}
                applyReview={applyReview}
                translations={translations}
                setTranslations={setTranslations}
                trends={trends}
                setTrends={setTrends}
                setCustomWords={setCustomWords}
                startQuizWrongDeck={startQuizWrongDeck}
                noteActivity={noteActivity}
                /* 약점 장부 — 시험과 듣기가 한 줄씩 적는다 */
                noteWeakness={noteWeakness}
                listenMode={listenMode}
                quizSet={quizSet}
                onQuizSet={(cards) => { setQuizSet(cards); setSub('quiz'); }}
                todayPool={todayPool}
                sentenceCards={sentenceCards}
                setSub={setSub}
                streak={streak}
                stats={stats}
                startDueDeck={startDueDeck}
                startWeakDeck={startWeakDeck}
                sentenceDue={sentenceDue}
                applyVerdicts={applyVerdicts}
                customWords={customWords}
                openListen={openListen}
                n3View={n3View}
              />
              )}
            </DeferredScreen>
          </div>
        </div>
      )}

      {/* 하던 판이 사라지기 전에 한 번 알린다 */}
      <BottomSheet open={Boolean(askSwap)} onClose={() => setAskSwap(null)} label="하던 학습을 접을까요?">
        {askSwap && (
          <div className="swapask">
            <h3>하던 학습을 접을까요?</h3>
            <p>
              «{askSwap.from}»이 {askSwap.left}개 남아 있어요.
              새로 시작하면 그 진행은 접히고, 푼 만큼은 기록에 남아요.
            </p>
            <div className="swapask-acts">
              {/* 「그만두기」는 무엇을 그만두는지가 거꾸로 읽힌다 — 하던 학습을
                  그만두는 것처럼 보이는데 실제로는 새로 시작하는 것을 그만두는
                  버튼이다. 결과를 그대로 적는다. */}
              <button className="ghost-btn" onClick={() => setAskSwap(null)}>하던 학습 계속하기</button>
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
        reviewCount={reviewLeft}
      />
      <Toast message={toast} />
    </div>
  );
}

function Toast({ message }) {
  return <div role="status" aria-live="polite" aria-atomic="true" className={`toast${message ? ' show' : ''}`}>{message}</div>;
}
