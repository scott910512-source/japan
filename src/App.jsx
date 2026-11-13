import { useAppData, usePersistAppData } from './app/useAppData.js';
import FeatureScreen from './app/FeatureScreen.jsx';
import HunterAppHeader from './components/HunterAppHeader.jsx';
import { StudyHub, Log, Study, Settings, Videos, NewPassword, ReviewHub } from './app/screens.js';
import { DeferredScreen, ScreenLoading, ScreenSlot } from './components/ScreenSlot.jsx';
import { filterByLevel } from './lib/wordFilters.js';
import { useAccountSync } from './app/useAccountSync.js';
import { useAppNavigation } from './app/useAppNavigation.js';
import { useAppBoot } from './app/useAppBoot.js';
import { useVerdicts } from './app/useVerdicts.js';
import { useAppNumbers } from './app/useAppNumbers.js';
import { useToast } from './app/useToast.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import { ensurePlan, MORE_STEP } from './lib/plan.js';
import { LANE_DECK, useStudyQueue } from './app/useStudyQueue.js';
import BottomSheet from './components/BottomSheet.jsx';
import GonAsk from './components/GonAsk.jsx';
import Onboarding from './components/Onboarding.jsx';
import Today from './screens/Today.jsx';
import Gate from './screens/Gate.jsx';
import { IconArrowLeft } from './components/Icons.jsx';
import { dailyPool } from './lib/cards.js';
import { kijuIndex } from './lib/kiju.js';
import { hasSignedInOnce, isGuest, setGuest } from './lib/storage.js';
import { wrongTotals } from './lib/wrongbook.js';
import { applyAttempt } from './lib/retestlink.js';
import { MemoContext } from './lib/memoContext.js';
import { REGION_RULES, REGION_QUIZ_MIN, regionQuizIds, noteRegionExam, PASS_RATIO } from './lib/regions.js';
import { weakIds, WEAK_KIND } from './lib/weak.js';
import { noteWeakQuiz, weakQuizState, weakQuizOf } from './lib/weakquiz.js';
import { MIN_POOL as STREAM_MIN_POOL } from './lib/stream.js';
import { questsOf, sealQuests, sealedProgress, noteQuest, streamQuestState, randomQuestState, sentenceQuestState, planSentenceQuest, skipSentenceQuest, pickNewSentences, SENTENCE_QUEST_SIZE } from './lib/quests.js';
import { readQuizKeep, clearQuizKeep } from './lib/quizkeep.js';
import { FLOW, FLOW_LABEL, nextStep, stepOfDeck, randomTestIds, n3Open, RANDOM_TEST_SIZE, RANDOM_TEST_MIN } from './lib/dayflow.js';
import { todayKey } from './lib/review.js';
import { supabaseConfigured } from './lib/supabase.js';
import { authGate } from './lib/authboot.js';
import { useToday } from './lib/useToday.js';
import { useN3Summary } from './hooks/useN3Summary.js';
import { goalOf, n3Included, withinGoal } from './lib/goal.js';

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
  rpg: '상황 대화',
  drill: '퀴즈',
  stream: '쭉 퀴즈',
  compose: '문장 만들기',
  speak: '말하기 연습',
  repeat: '전체 복습 · 회독 학습',
  adverb: '부사 연습',
  listenhub: '듣기',
  listen: '듣기 · 따라 말하기',
  story: '이야기 연속 듣기',
  videos: '영상으로 배우기',
  swiss: '독일어 여행 회화',
  travel: '여행 일본어',
  n3: '한 권으로 끝내는 N3',
  review: '복습',
  wrongbook: '복습',
  weakbook: '복습',
};

export default function App() {
  /* 어디에 있나 — 탭 · 밀어 넣은 화면 · 회독 판, 그리고 뒤로가기 연동과
     「지금 갈아끼우면 잃는 게 있나」 표시까지 app/useAppNavigation.js가 쥔다.
     주소가 없는 앱이라 「지금 어느 화면인가」가 전부 상태값이고, 그게 일곱
     개로 흩어져 있으면 한 자리를 열 때 함께 할 일을 빼먹는다. */
  const nav = useAppNavigation({ validSubs: Object.keys(SUB_TITLES) });
  const {
    activeTab, sub, deck, n3View, swissView, listenMode, quizSet, videosSeen,
    setActiveTab, setSub, setDeck, setQuizSet, selectTab, openListen, closeSub, openSub,
  } = nav;

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
    removeVideo,
    storyStore,
    setStoryStore,
  } = appData;
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  /* 내 학습의 「계정과 동기화」「기록 백업」 줄이 설정의 그 묶음을 바로 연다 */
  const [settingsGroup, setSettingsGroup] = useState(null);
  /* 설정 탭을 열 때마다 새로 만든다 — 「계정」 같은 묶음으로 바로 들어가거나, 탭을 다시 눌러 목록으로 돌아올 때 */
  const [settingsNonce, setSettingsNonce] = useState(0);
  const [composeStart, setComposeStart] = useState(null);
  const [homeResetKey, setHomeResetKey] = useState(0);
  const selectAppTab = (id) => {
    selectTab(id);
    if (id === 'home') setHomeResetKey((key) => key + 1);
    if (id === 'settings') { setSettingsGroup(null); setSettingsNonce((n) => n + 1); }
  };
  const { toast, showToast } = useToast();
  /* 앱을 켤 때 브라우저와 맞추는 일들 — 저장 실패를 받는 손, 음성 오류,
     「새 버전이 준비됐다」 알림, iOS 오디오 열기, 연속일, 테마, 음성 설정.
     전부 바깥 시스템과 맞추는 일이라 app/useAppBoot.js에 모았다. */
  const { storeError, streak, setStreak } = useAppBoot({ settings, showToast });
  const [offlinePass, setOfflinePass] = useState(() => isGuest());
  const {
    authSession,
    setAuthSession,
    syncState,
    remoteKeyEnvelope,
    setRemoteKeyEnvelope,
    vaultKey,
    authReady,
    authTimedOut,
    authFailed,
    recovering,
    setRecovering,
    rememberVaultKey,
    runSync,
    syncedFor,
    patchSettings
  } = useAccountSync({ data: appData, streak, setStreak, showToast });

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
    /* 첫 동기화가 끝날 때까지(성공이든 실패든) 기다린다. 전에는 「동기화를 시작했나」만 봐서, 시작하자마자 —
       계정의 답이 내려오기 전에 — 처음 화면을 띄웠다. 새 기기에서 로그인할 때마다 질문이 다시 나왔다. */
    if (signedIn && (syncedFor.current !== authSession.user.id || (!syncState.at && !syncState.error))) return;
    onboardingDecided.current = true;
    /* 답이 이미 있으면 끝난 것으로 본다. onboarded 표시가 옛 기기에만 있고
       계정에는 없을 수 있어서, 답(canReadKana)이 있는지도 같이 본다. */
    setOnboardingOpen(!settings.onboarded && settings.canReadKana == null);
  }, [authReady, authSession, settings.onboarded, settings.canReadKana, syncState.at, syncState.error]);

  usePersistAppData(appData);

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
  const sentenceIds = useMemo(() => content?.sentenceIds || [], [content]);


  /* ── 회독 ── */

  /* 판정이 들어올 때 무엇을 적는가 — 회독 기록 · 계획 · 활동 통계 · 약점
     장부 네 군데가 각자 다른 셈법을 쓴다. 되돌리기까지 app/useVerdicts.js에
     모았다(되돌릴 때 활동 수를 안 빼면 카드 하나가 둘로 세어진다). */
  const {
    applyReview, applyVerdicts, noteActivity, noteWeakness, saveMemo, toggleBookmark,
  } = useVerdicts({
    review, setReview, setPlan, setProgress, setStats, setStreak, setMemos,
  });

  /* 퀘스트·복습으로 N3 단어·한자·문법 기록이 올라가면 오늘 탭의 「JLPT N3 ○%」도 따라 오른다 */
  useN3Summary({ review, progress, setProgress, enabled: n3Included(goalOf(settings)) });

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

  /* 화면들이 보여 주는 숫자 — app/useAppNumbers.js 한 군데서만 센다.
     복습 탭 배지는 「99+」인데 열어 보면 「11개」인 적이 있었다. 같은 화면에서
     숫자가 다르면 쓰는 사람은 둘 다 안 믿는다. */
  const {
    due, sentenceDue, planNow, reviewLeft,
    weakBook, weakWords, weakRows, wordStat, rounds, n3Wrong, grammarLeft, grammarNext,
  } = useAppNumbers({
    words, wordIds, byId, review, progress, plan, sentenceIds, today,
  });

  /* 지도에서 연 화면의 레벨 — 설정의 레벨 필터 대신 이 화면에서만 쓴다(설정 값은 그대로) */
  const [levelOverride, setLevelOverride] = useState(null);
  useEffect(() => { if (!sub && !deck) setLevelOverride(null); }, [sub, deck]);
  const effSettings = useMemo(() => (levelOverride ? { ...settings, levels: levelOverride } : settings), [settings, levelOverride]);
  /* 지도에서 연 화면에서 레벨 칩을 눌러도 저장된 설정은 안 바꾼다 — 그 화면의 레벨만 바뀐다 */
  const patchSettingsEff = useCallback((patch) => {
    if (levelOverride && patch && 'levels' in patch) {
      const { levels, ...rest } = patch;
      setLevelOverride(Array.isArray(levels) ? levels : []);
      if (Object.keys(rest).length) patchSettings(rest);
      return;
    }
    patchSettings(patch);
  }, [levelOverride, patchSettings]);

  /* 회독 판을 짜는 함수들은 app/useStudyQueue.js에 — 오늘의 학습·이어하기·
     단어·복습·취약·JLPT 세트·시험 오답. 동작은 App에 있던 그대로다. */
  const {
    askSwap, setAskSwap, guardDeck, learnMore, learnMoreAndStart,
    startToday, resumeSession, startWordDeck, startKijuDeck, startDueDeck, startWeakDeck, startJlptSet, startQuizWrongDeck,
  } = useStudyQueue({
    session, plan, planNow, setPlan, words, wordIds, byId, sentenceCards, review, settings: effSettings, due, todayPool, today,
    setDeck, setSub, showToast,
    /* 약점 장부 — 취약 단어 판과 「10개 더」가 본다 */
    ledger: progress.weak,
  });

  /* 메뉴를 연다. 길은 app/useAppNavigation.js가 알고, 「약점」만 여기서
     가로챈다 — 그건 화면이 아니라 판이라서(회독 큐를 짜야 한다) 자리를
     정하는 쪽이 알 일이 아니다. */
  /* 복습으로 — 내 학습 탭 위에 연다. 닫으면 내 학습으로 돌아온다 */
  const wrongTotal = useMemo(() => wrongTotals(progress.mistakes, n3Wrong.all), [progress.mistakes, n3Wrong.all]);
  /* ★ 약점 퀴즈 ★ 지금 제일 약한 낱말로 단어 시험을 열고, 푼 낱말을 오늘 몫에 적는다.
     시험 화면은 그대로 쓴다 — 듣기에서 넘어오는 세트(quizSet)와 같은 길이다. */
  const weakAll = useMemo(() => weakIds(wordIds, review, progress.weak), [wordIds, review, progress.weak]);
  /* 오늘 복습 미션에서 이미 본 낱말은 약점 퀴즈에서 뺀다 — 같은 낱말을 한 바퀴에 또 묻지 않게 */
  const studiedToday = useMemo(() => new Set(Object.keys(plan?.done || {})), [plan]);
  const weakFresh = useMemo(() => weakAll.filter((id) => !studiedToday.has(id)), [weakAll, studiedToday]);
  /* 마친 퀘스트의 몫(seal) — 한 번 마친 줄은 뒤에서 몫이 늘어도 그날은 마친 것이다(lib/quests.js) */
  const seals = useMemo(() => questsOf(progress, today), [progress, today]);
  const weakQuiz = useMemo(() => weakQuizState(progress, weakFresh, today, undefined, seals.sealWeak), [progress, weakFresh, today, seals.sealWeak]);
  const laneNow = planNow?.lanes || {};
  const backAssigned = (laneNow.review?.assigned || 0) + (laneNow.weak?.assigned || 0);
  const backDone = (laneNow.review?.done || 0) + (laneNow.weak?.done || 0);
  const freshAssigned = laneNow.fresh?.assigned || 0;
  const freshDone = laneNow.fresh?.done || 0;
  useEffect(() => {
    const full = {};
    /* ★ 오늘 계획일 때만 ★ 날이 바뀐 뒤 첫 화면에서는 계획이 아직 어제 것이다. 어제 다 마친 계획의 몫을 오늘 것으로
       적으면(어제 1개 → 오늘 20개), 오늘 하나만 배워도 「1 / 1 마쳤어요」가 되고 흐름이 그 단계를 건너뛴다. */
    const planToday = plan?.date === today;
    if (planToday && backAssigned > 0 && backDone >= backAssigned) full.review = backAssigned;
    if (planToday && freshAssigned > 0 && freshDone >= freshAssigned) full.fresh = freshAssigned;
    if (weakQuiz.complete && weakQuiz.total > 0) full.weakquiz = weakQuiz.total;
    if (!Object.keys(full).length) return;
    setProgress((p) => { const next = sealQuests(p.quests, full, today); return next === p.quests ? p : { ...p, quests: next }; });
  }, [plan?.date, backAssigned, backDone, freshAssigned, freshDone, weakQuiz.complete, weakQuiz.total, today, setProgress]);
  const weakQuizOn = useRef(false);
  /* 화면에 말하려고 같은 값을 상태로도 둔다(결과 화면이 약점 퀴즈임을 알아야 한다) */
  const [weakQuizMode, setWeakQuizMode] = useState(false);
  /* 곤에게 물어보기 창 — 떠 있는 단추(오늘 화면)와 상단 곤 얼굴(그 밖의 화면)이 같이 연다 */
  const [gonOpen, setGonOpen] = useState(false);
  useEffect(() => { if (sub !== 'quiz') { weakQuizOn.current = false; setWeakQuizMode(false); clearQuizKeep(); } }, [sub]);   // 시험 화면을 닫았으면 풀던 자리도 지운다
  const startWeakQuiz = useCallback(() => {
    const cards = weakQuiz.ids.map((id) => byId.get(id)).filter(Boolean);
    if (!cards.length) { showToast('약점 퀴즈로 풀 낱말이 아직 없어요'); return; }
    setQuizSet(cards);
    weakQuizOn.current = true;
    setWeakQuizMode(true);
    setActiveTab('me');
    openSub('quiz');
  }, [weakQuiz, byId, showToast, setQuizSet, setActiveTab, openSub]);
  /* 시험이 적는 약점 장부 줄을 가로채서, 약점 퀴즈 중이면 푼 낱말을 오늘 몫에도 적는다 */
  const noteWeaknessQuiz = useCallback((notes) => {
    noteWeakness(notes);
    if (!weakQuizOn.current || !notes?.length) return;
    const ids = notes.filter((n) => n.kind === WEAK_KIND.QUIZ_RIGHT || n.kind === WEAK_KIND.QUIZ_WRONG).map((n) => n.id);
    if (!ids.length) return;
    setProgress((p) => {
      const next = noteWeakQuiz(p.weakQuiz, ids, today);
      return next === p.weakQuiz ? p : { ...p, weakQuiz: next };
    });
  }, [noteWeakness, setProgress, today]);
  /* ★ 쭉 퀴즈 퀘스트 ★ 스무 문제. 쭉 퀴즈가 한 문제 풀 때마다 오늘 몫에 적는다 */
  /* 풀 수 있을 때만 줄을 세운다 — 쭉 퀴즈는 외운 것이 MIN_POOL개는 돼야 보기를 만든다. 한두 개 외운 사람에게 줄을 세우면
     눌러도 「N개만 더 배우면 열려요」만 뜨고, 하루 흐름과 큰 버튼이 그 막힌 화면으로 보낸다. */
  const memorized = useMemo(() => Object.values(review).filter((st) => st?.lastSeen).length, [review]);
  const streamQuest = useMemo(() => streamQuestState(progress, memorized >= STREAM_MIN_POOL, today), [progress, memorized, today]);
  const onStreamAnswered = useCallback(() => {
    setProgress((p) => ({ ...p, quests: noteQuest(p.quests, 'stream', 1, today) }));
  }, [setProgress, today]);
  /* ★ 퀘스트로 들어온 쭉 퀴즈는 설정을 묻지 않고 바로 시작한다 ★
     약점 퀴즈에서 「다음: 쭉 퀴즈」로 넘어오면 문제가 아니라 「한 번에 몇 문제」를 고르는 화면이 떠서 흐름이 끊겼다.
     퀘스트 줄 · 하루 흐름으로 들어왔다는 표시를 달아 두고, 메뉴에서 연 쭉 퀴즈는 전처럼 설정부터 보여 준다. */
  const [streamAuto, setStreamAuto] = useState(false);
  useEffect(() => { if (sub !== 'stream') setStreamAuto(false); }, [sub]);
  const startStreamQuest = useCallback(() => { setStreamAuto(true); setActiveTab('me'); openSub('stream'); }, [setActiveTab, openSub]);

  /* ★ 오늘 랜덤 테스트 ★ 오늘 만난 낱말(오늘 계획 · 오늘 푼 약점 퀴즈)을 다 섞어서 쉰 문제. 모자라면 외운 낱말로 채운다.
     하루 흐름의 마지막 칸이라, 앞 단계를 다 하고 나서 한 번 본다. */
  const wordIdSet = useMemo(() => new Set(wordIds), [wordIds]);
  const randomToday = useMemo(
    () => [...(plan?.assigned || []).filter((x) => x.kind === 'word').map((x) => x.id), ...weakQuizOf(progress, today).ids],
    [plan, progress, today],
  );
  const randomSeen = useMemo(() => Object.keys(review).filter((id) => review[id]?.lastSeen), [review]);
  /* 쭉 퀴즈에서 뺄 것 — 오늘 복습 미션에서 본 것과 오늘 푼 약점 퀴즈 낱말 */
  const streamSeenToday = useMemo(() => new Set([...studiedToday, ...weakQuizOf(progress, today).ids]), [studiedToday, progress, today]);
  const randomOn = useRef(false);
  const [randomMode, setRandomMode] = useState(false);
  useEffect(() => { if (sub !== 'quiz') { randomOn.current = false; setRandomMode(false); } }, [sub]);
  const randomCount = useMemo(
    () => randomTestIds({ today: randomToday, seen: randomSeen, wordIds: wordIdSet, size: RANDOM_TEST_SIZE, rng: () => 0.5 }).length,
    [randomToday, randomSeen, wordIdSet],
  );
  const randomAvailable = randomCount >= RANDOM_TEST_MIN;
  /* 줄에 적는 문제 수는 실제로 낼 수 — 낼 낱말이 열일곱뿐인 날 「쉰 문제」라고 적어 놓고 「1 / 17」로 시작했다 */
  const randomQuest = useMemo(() => {
    const q = randomQuestState(progress, randomAvailable, today);
    return q ? { ...q, count: randomCount } : q;
  }, [progress, randomAvailable, randomCount, today]);
  const startRandomTest = useCallback(() => {
    const cards = randomTestIds({ today: randomToday, seen: randomSeen, wordIds: wordIdSet, size: RANDOM_TEST_SIZE })
      .map((id) => byId.get(id)).filter(Boolean);
    if (cards.length < RANDOM_TEST_MIN) { showToast('테스트에 낼 낱말이 아직 모자라요'); return; }
    setQuizSet(cards);
    weakQuizOn.current = false; setWeakQuizMode(false);
    randomOn.current = true; setRandomMode(true);
    setActiveTab('me');
    openSub('quiz');
  }, [randomToday, randomSeen, wordIdSet, byId, showToast, setQuizSet, setActiveTab, openSub]);
  /* ★ 풀던 퀘스트 시험을 잇는다 ★ 앱이 다시 떴을 때 「마지막에 있던 자리」가 시험 화면이면, 그게 약점 퀴즈였는지
     랜덤 테스트였는지와 그 시험의 낱말을 되살린다(lib/quizkeep.js). 안 되살리면 일반 「단어 시험」 설정 화면이 뜬다.
     문제 묶음과 낸 답은 시험 화면이 같은 곳에서 읽어 잇는다. 켤 때 한 번만 본다. */
  const keepBoot = useRef(false);
  useEffect(() => {
    if (keepBoot.current) return;
    /* 낱말 자료는 늦게 온다(따로 받는 조각이다) — 올 때까지 기다린다. 빈 채로 보면 낱말을 못 찾아 풀던 자리를 버리게 된다 */
    if (!content) return;
    keepBoot.current = true;
    const kept = sub === 'quiz' ? readQuizKeep() : null;
    if (!kept) return;
    const cards = kept.ids.map((id) => byId.get(id)).filter(Boolean);
    if (!cards.length) { clearQuizKeep(); return; }
    setQuizSet(cards);
    if (kept.mode === 'weak') { weakQuizOn.current = true; setWeakQuizMode(true); }
    else { randomOn.current = true; setRandomMode(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
  /* ★ 지역 승급시험 ★ 성장 지도에서 시작한다. N3 코스에 있는 시험(진단 · 확인 테스트 · 모의고사)은 그 화면으로 보내고,
     N5·N4 지역은 본 낱말 중에서 내는 확인 퀴즈를 단어 시험 화면으로 돈다. 결과는 progress.regions에 적는다. */
  const regionExamRef = useRef(null);
  const [regionExam, setRegionExam] = useState(null);
  useEffect(() => { if (sub !== 'quiz') { regionExamRef.current = null; setRegionExam(null); } }, [sub]);
  const startRegionExam = useCallback((id) => {
    const rule = REGION_RULES.find((r) => r.id === id);
    if (!rule) return;
    if (rule.exam.source === 'n3') {
      const tid = rule.exam.testId;
      nav.openMenu('n3', { view: tid === 'exam' ? { kind: 'exam', from: 'curriculum' } : { kind: 'test', id: tid, from: 'curriculum' } });
      return;
    }
    const cards = regionQuizIds(rule, words, review).map((wid) => byId.get(wid)).filter(Boolean);
    if (cards.length < REGION_QUIZ_MIN) { showToast(`본 낱말이 ${REGION_QUIZ_MIN}개 이상 있어야 승급시험을 낼 수 있어요`); return; }
    setQuizSet(cards);
    weakQuizOn.current = false; setWeakQuizMode(false);
    randomOn.current = false; setRandomMode(false);
    const info = { id, label: rule.exam.label, pass: rule.exam.pass ?? PASS_RATIO, stamp: Date.now() };
    regionExamRef.current = info;
    setRegionExam(info);
    setActiveTab('me');
    openSub('quiz');
  }, [words, review, byId, showToast, setQuizSet, setActiveTab, openSub, nav]);
  const onRegionDone = useCallback(({ correct, total } = {}) => {
    const info = regionExamRef.current;
    if (!info || !(total > 0)) return;
    setProgress((p) => {
      const regions = noteRegionExam(p.regions, info.id, { right: correct, total }, info.stamp, today);
      return regions === p.regions ? p : { ...p, regions };
    });
  }, [setProgress, today]);
  const onRandomDone = useCallback(() => {
    setProgress((p) => ({ ...p, quests: noteQuest(p.quests, 'random', 1, today) }));
  }, [setProgress, today]);

  /* ★ 문장 퀘스트 ★ 새 문장 다섯 개를 배우고(회독 한 판) 바로 이어서 문장 만들기(조립)로 연습한다.
     새로 배우기에서 문장 카드가 빠졌으니 새 문장은 여기로만 들어온다. 오늘은 건너뛸 수 있다(줄도 흐름도 빠진다). */
  const newSentenceCards = useMemo(
    () => sentenceCards.filter((c) => withinGoal(c.level, goalOf(settings)) && !review[c.id]?.lastSeen),
    [sentenceCards, review, settings],
  );
  const sentenceQuest = useMemo(
    () => sentenceQuestState(progress, review, newSentenceCards.length > 0, today),
    [progress, review, newSentenceCards.length, today],
  );
  const [composeFocus, setComposeFocus] = useState(null);   // { ids, target } — 조립 연습을 오늘 배운 문장으로 좁힌다
  useEffect(() => { if (sub !== 'compose') setComposeFocus(null); }, [sub]);
  const startSentenceQuest = useCallback(() => {
    const q = sentenceQuestState(progress, review, newSentenceCards.length > 0, today);
    /* 오늘 배울 문장은 처음 시작할 때 정해 둔다 — 중간에 나갔다 와도 같은 문장을 이어서 배운다 */
    let ids = q?.ids?.length ? q.ids : pickNewSentences(newSentenceCards, review, SENTENCE_QUEST_SIZE);
    if (!ids.length) { showToast('새로 배울 문장이 아직 없어요'); return; }
    if (!q?.ids?.length) setProgress((p) => ({ ...p, quests: planSentenceQuest(p.quests, ids, today) }));
    const left = ids.filter((id) => review[id]?.lastSeen !== today);
    if (!left.length) { startSentencePractice(ids); return; }
    setSub(null);
    setDeck({ id: 'quest:sentence', label: '새 문장', cards: [...words, ...sentenceCards], queue: left, stepped: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, review, newSentenceCards, today, words, sentenceCards, showToast, setProgress, setDeck, setSub]);
  const startSentencePractice = useCallback((idsArg) => {
    const ids = idsArg || sentenceQuest?.ids || [];
    setDeck(null);
    setComposeFocus({ ids, target: Math.min(SENTENCE_QUEST_SIZE, ids.length) });
    setComposeStart('build');
    nav.openMenu('compose', { mode: 'build' });
  }, [sentenceQuest, setDeck, nav]);
  const skipSentence = useCallback((skip = true) => {
    setProgress((p) => ({ ...p, quests: skipSentenceQuest(p.quests, skip, today) }));
  }, [setProgress, today]);

  /* ★ 하루 흐름 ★ 한 단계가 끝나면 다음 단계를 바로 내민다.
     복습 미션 → 약점 퀴즈 → 쭉 퀴즈 → 새로 배우기(끝에서 10개 더) → 문장 퀘스트 → 오늘 랜덤 테스트 → 오늘의 N3.
     할 게 없거나 이미 마친 단계는 건너뛴다(lib/dayflow.js). */
  const freshLeft = Math.max(0, (planNow?.lanes?.fresh?.assigned || 0) - (planNow?.lanes?.fresh?.done || 0));
  /* 오늘의 N3(N3 코스의 오늘 계획) — N3를 켠 사람에게만. 코스 자료는 안 불러오고 코스가 적어 둔 진도만 본다 */
  const n3FlowOn = Boolean(settings.menus?.n3) && n3Included(goalOf(settings));
  const n3FlowOpen = n3Open(n3FlowOn, progress.n3, today);
  const flowOpen = {
    /* 마친 줄은 뒤에서 몫이 늘어도 흐름이 다시 그리로 돌려보내지 않는다 */
    review: reviewLeft > 0 && !sealedProgress(backDone, backAssigned, seals.sealReview).complete,
    weakquiz: Boolean(weakQuiz && weakQuiz.total > 0 && !weakQuiz.complete),
    stream: Boolean(streamQuest && !streamQuest.complete),
    fresh: freshLeft > 0 && !sealedProgress(freshDone, freshAssigned, seals.sealFresh).complete,
    sentence: Boolean(sentenceQuest && !sentenceQuest.skipped && !sentenceQuest.complete),
    n3: n3FlowOpen,
    random: Boolean(randomQuest && !randomQuest.complete),
  };
  const goStep = useCallback((to) => {
    setDeck(null);
    if (to === 'weakquiz') startWeakQuiz();
    else if (to === 'stream') startStreamQuest();
    else if (to === 'fresh') startToday(['fresh']);
    else if (to === 'sentence') startSentenceQuest();
    else if (to === 'n3') nav.openMenu('n3', { view: { kind: 'today' } });
    else if (to === 'random') startRandomTest();
  }, [setDeck, startWeakQuiz, startStreamQuest, startToday, startSentenceQuest, startRandomTest, nav]);
  const flowAfter = (step) => {
    const n = nextStep(step, flowOpen);
    return n ? { ...n, go: () => goStep(n.to) } : null;
  };
  /* ★ 오늘 화면의 큰 버튼은 지금 차례인 퀘스트를 연다 ★
     큰 버튼은 「복습이 남았으면 복습, 아니면 새로 배우기」만 알았다. 복습과 약점 퀴즈를 마친 사람에게 퀘스트 줄은
     「3 쭉 퀴즈」를 가리키는데 큰 버튼은 새 단어를 열어서 순서가 어긋났다. 퀘스트 줄과 같은 순서(FLOW)에서
     아직 안 마친 첫 단계가 지금 차례다. 카드 판(복습 · 새로 배우기)은 하던 판이 있으면 접을지 묻고 연다. */
  const stepNow = FLOW.find((s) => flowOpen[s]) || null;
  const flowNow = stepNow ? {
    key: stepNow,
    label: FLOW_LABEL[stepNow],
    go: () => {
      if (stepNow === 'review') guardDeck(() => startToday(['review', 'weak']), LANE_DECK(['review', 'weak']));
      else if (stepNow === 'fresh') guardDeck(() => startToday(['fresh']), LANE_DECK(['fresh']));
      else goStep(stepNow);
    },
  } : null;
  /* ★ 틀린 단어를 카드로 외우는 판도 하루 흐름을 잇는다 ★
     약점 퀴즈(또는 오늘 랜덤 테스트)의 결과에서 「카드로 외우기」로 넘어가면 그 판이 끝난 뒤 「오늘로」만 남아서
     쭉 퀴즈로 이어지던 길이 끊겼다. 어느 단계에서 넘어왔는지 적어 두고, 판이 끝나면 그다음 단계를 내민다. */
  const [wrongFrom, setWrongFrom] = useState(null);
  const startQuizWrong = useCallback((ids) => {
    setWrongFrom(weakQuizOn.current ? 'weakquiz' : randomOn.current ? 'random' : null);
    startQuizWrongDeck(ids);
  }, [startQuizWrongDeck]);
  const deckStep = (id) => (String(id || '').startsWith('quizwrong-') ? wrongFrom : stepOfDeck(id));
  /* 하루 흐름의 끝 화면마다 「다음: ○○」 옆에 두는 「홈으로」 — 어디서 들어왔든 오늘 화면으로 간다 */
  const goHome = useCallback(() => { setDeck(null); selectTab('home'); }, [setDeck, selectTab]);
  const openReview = useCallback(() => { setActiveTab('me'); openSub('review'); }, [setActiveTab, openSub]);
  const openMenu = useCallback((id, opts = {}) => {
    /* 지도에서 N5 지역을 눌렀는데 설정의 레벨(N3 등)로 열리면 안 된다 — 그 화면에서만 레벨을 덮어쓴다(설정은 안 바꾼다) */
    setLevelOverride(opts.levels?.length ? opts.levels : null);
    if (id === 'compose') setComposeStart(opts.mode || null);
    if (id === 'weak') { startWeakDeck(); return; }
    nav.openMenu(id, opts);
  }, [startWeakDeck, nav.openMenu]);

  /* 틀린 문제를 적는 한 길. 오답노트의 「다시 풀기」(attempt.retest)는 약점 장부 · N3 오답에도 한 번씩 이어진다(lib/retestlink.js) */
  const recordAttempt = useCallback((attempt) => {
    setProgress((p) => applyAttempt(p, attempt, { wordIds: byId }));
  }, [setProgress, byId]);

  const learnMistake = useCallback((row) => {
    /* 다시 학습한 기록 — 「오답 → 다시 학습 → 다시 풀기」 순서가 오답 기록에 남는다 */
    setProgress((p) => {
      const cur = p.mistakes?.[row.id];
      return cur ? { ...p, mistakes: { ...p.mistakes, [row.id]: { ...cur, relearnedAt: Date.now(), relearned: (cur.relearned || 0) + 1 } } } : p;
    });
    const word = byId.get(row.ref);
    if (word) {
      guardDeck(() => startJlptSet([word], '틀린 단어 다시 학습', `mistake:${word.id}`), `mistake:${word.id}`);
    } else if (row.ref?.startsWith('k:')) openMenu('n3', { view: { kind: 'kanjicard', id: row.ref } });
    else if (/^[gvrl]:/.test(row.ref || '')) openMenu('n3', { view: { kind: 'lesson', id: row.ref } });
    else if (row.source === 'compose') openMenu('compose', { mode: row.id.includes(':cloze:') ? 'blank' : row.id.includes(':write:') ? 'write' : 'build' });
    else if (row.source === 'grammar') openMenu('grammar');
    else openMenu('sentences');
  }, [byId, guardDeck, startJlptSet, openMenu, setProgress]);

  const finishOnboarding = (patch) => {
    patchSettings(patch);
    setOnboardingOpen(false);
  };

  /* 단어 암기 메모 — 퀴즈 어디서든 쓰게 열어 둔다(components/WordMemo.jsx) */
  const memoCtx = useMemo(() => ({ memos, saveMemo }), [memos, saveMemo]);

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
              /* 와이파이는 잡혔는데 서버가 죽은 자리에서 갇히지 않게 —
                 확인이 시간초과·거절로 끝났거나 동기화가 실패했으면
                 「이 기기 기록으로 계속하기」를 띄운다 */
              serverDown={authTimedOut || authFailed || Boolean(syncState.error)}
              onContinueOffline={() => setOfflinePass(true)}
              onStartGuest={() => { setGuest(true); setOfflinePass(true); }}
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
      <MemoContext.Provider value={memoCtx}>
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
                prev.some((x) => x.id === w.id) ? prev : [...prev, { ...w, addedAt: Date.now() }]
              ))}
              onReviewChange={applyReview}
              onSessionChange={setSession}
              onSettingsChange={patchSettings}
              onBookmark={toggleBookmark}
              onToast={showToast}
              /* 하루 흐름의 판(복습 · 새 단어)이면 그 흐름의 다음 단계를, 아니면 덱이 정한 다음을 */
              flowNext={deck.id === 'quest:sentence' ? { to: 'practice', label: '문장 만들기 연습', go: () => startSentencePractice() } : deckStep(deck.id) ? flowAfter(deckStep(deck.id)) : undefined}
              onMore={stepOfDeck(deck.id) === 'fresh' ? () => learnMoreAndStart(MORE_STEP) : null}
              onNext={deck.id === 'quest:sentence'
                ? () => startSentencePractice()
                : deckStep(deck.id)
                ? (flowAfter(deckStep(deck.id))?.go || null)
                : (deck.next ? () => {
                  if (deck.next.to === 'fresh') { startToday(['fresh']); return; }
                  setDeck(null);
                  setActiveTab('study');
                  setSub('repeat');
                } : null)}
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
        {/* 곤에게 물어보기(AI)는 학습 중에도 떠 있다 — 카드의 「궁금해요」는 그 카드를 묻는 자리이고, 이건 그냥 궁금한 것을 묻는 자리다.
            아래 판정 단추를 가리면 접어 둘 수 있다(접은 상태는 어느 화면에서나 같다). */}
        <GonAsk
          settings={settings}
          asks={asks}
          onAsks={setAsks}
          onAddWord={(w) => setCustomWords((prev) => (
            prev.some((x) => x.id === w.id) ? prev : [...prev, { ...w, addedAt: Date.now() }]
          ))}
          onToast={showToast}
          placement="top"
        />
        <Toast message={toast} />
      </div>
      </MemoContext.Provider>
    );
  }

  return (
    <MemoContext.Provider value={memoCtx}>
    <div className="app-shell hunter-app">
      <Onboarding open={onboardingOpen} onFinish={finishOnboarding} />
      {(activeTab !== 'home' || sub) && <HunterAppHeader guideId={settings.hunterGuide} section={SUB_TITLES[sub] || { study: '학습 본부', me: '나의 헌터 기록', settings: '설정', videos: '영상 수련' }[activeTab]} onAsk={() => setGonOpen(true)} onHome={() => selectAppTab('home')} />}

      <div className="screens">
        <ScreenSlot active={activeTab === 'home' && !sub}>

          <Today
            homeResetKey={homeResetKey}
            onAsk={() => setGonOpen(true)}
            wrongCount={wrongTotal.total}
            onOpenWrong={() => openSub('wrongbook', 'home')}
            onStartRegionExam={startRegionExam}
            words={words}
            review={review}
            progress={progress}
            stats={stats}
            onOpen={openMenu}
            onSettings={patchSettings}
            plan={plan}
            planNow={planNow}
            settings={settings}
            streak={streak}
            session={session}
            resumeLabel={session?.label}
            flowNow={flowNow}
            sessionStep={stepOfDeck(session?.deckId)}
            grammarLeft={grammarLeft}
            grammarNext={grammarNext}
            /* ★ 주요 버튼 하나 ★ 갈래를 안 주면 배정된 것을 순서대로 다 돈다. */
            /* ★ 큰 버튼은 복습부터 ★ 새 단어는 「새로 배우기」 퀘스트에서만 배운다 — 예전엔 복습·약점·신규를 한 판에 섞어서,
               큰 버튼으로 하면 아래 퀘스트의 새로 배우기가 저절로 끝나 있었다. 복습이 없는 날만 새로 배우기부터 시작한다. */
            onStartAll={() => { const lanes = reviewLeft > 0 ? ['review', 'weak'] : ['fresh']; guardDeck(() => startToday(lanes), LANE_DECK(lanes)); }}
            onStartWords={() => guardDeck(() => startToday(['fresh']), LANE_DECK(['fresh']))}
            onStartReview={() => guardDeck(() => startToday(['review', 'weak']), LANE_DECK(['review', 'weak']))}
            onOpenGrammar={() => openMenu('grammar')}
            /* N3 코스로 가는 줄. 메뉴를 끈 사람에게는 안 보인다 */
            onOpenN3={settings.menus?.n3 ? () => openMenu('n3') : null}
            n3={progress.n3 || null}
            onResume={resumeSession}
            onOpenReview={openReview}
            weakQuiz={weakQuiz}
            questSeal={{ review: seals.sealReview, fresh: seals.sealFresh }}
            onStartWeakQuiz={startWeakQuiz}
            streamQuest={streamQuest}
            onStartStreamQuest={startStreamQuest}
            randomQuest={randomQuest}
            onStartRandomTest={startRandomTest}
            sentenceQuest={sentenceQuest}
            onStartSentenceQuest={() => guardDeck(() => startSentenceQuest(), 'quest:sentence')}
            onSkipSentenceQuest={() => skipSentence(true)}
            onUndoSkipSentenceQuest={() => skipSentence(false)}
            onOpenProgress={() => selectTab('me')}
            onLearnMore={learnMore}
          />
        </ScreenSlot>

        <ScreenSlot active={activeTab === 'study' && !sub}>

          <StudyHub
            settings={settings}
            onOpen={openMenu}
            /* 바로가기 — 자주 쓰는 메뉴를 사람이 골라 맨 앞에 둔다 */
            onChange={patchSettings}
            onToast={showToast}
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
            weakGrammar={n3Wrong.grammar}
            onOpenWeak={() => openSub('weakbook')}
            showN3={Boolean(settings.menus?.n3)}
            onOpenStudy={() => selectTab('study')}
            reviewLeft={reviewLeft}
            onOpenReview={openReview}
            wrongCount={wrongTotal.total}
            onOpenWrong={() => openSub('wrongbook')}
            onOpenQuiz={() => openSub('drill')}
          />
        </ScreenSlot>

        {/* 설정 — 큰 탭이다. 여섯 묶음(학습 설정 · 음성 · 계정 · 백업 · 도구 · 앱 정보)은 그 안에 그대로 있다 */}
        <ScreenSlot active={activeTab === 'settings' && !sub}>

          <Settings
            key={settingsNonce}
            initialGroup={settingsGroup}
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
            storeError={storeError}
            onSync={() => runSync(false)}
            onSignedOut={() => {
              setAuthSession(null); setRemoteKeyEnvelope(null); rememberVaultKey(null); setOfflinePass(false); setGuest(false);
              syncedFor.current = null; showToast('로그아웃했어요');
            }}
            onVaultKey={rememberVaultKey}
            remoteKeyEnvelope={remoteKeyEnvelope}
            vaultReady={Boolean(vaultKey)}
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
              prev.some((x) => x.id === w.id) ? prev : [...prev, { ...w, addedAt: Date.now() }]
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
            <button className="sub-back" onClick={closeSub}><IconArrowLeft /> 뒤로</button>
            <div className="sub-title">{SUB_TITLES[sub]}</div>
          </div>
          <div className="sub-body">
            <DeferredScreen key={sub}>
              {/* 복습은 내 학습 안에서 밀어 넣는 화면이다 — 오늘 복습 · 약점 · 틀린 문제 · 전체 복습 */}
              {sub === 'review' || sub === 'wrongbook' || sub === 'weakbook' ? (
                  <ReviewHub
                    initialSection={sub === 'wrongbook' ? 'wrong' : sub === 'weakbook' ? 'weak' : 'today'}
                    planNow={planNow}
                    sentenceDue={sentenceDue}
                    weakWords={weakWords}
                    weakGrammar={n3Wrong.grammar}
                    wrongCount={wrongTotal.total}
                    onStartReview={() => guardDeck(() => startToday(['review', 'weak']), LANE_DECK(['review', 'weak']))}
                    onStartBacklog={startDueDeck}
                    onOpenSentences={() => setSub('sentences')}
                    onOpenRepeat={() => setSub('repeat')}
                    wrongProps={{
                      book: progress.mistakes,
                      n3WrongCount: n3Wrong.all,
                      onAttempt: recordAttempt,
                      onLearn: learnMistake,
                      onOpenN3Wrong: () => openMenu('n3', { view: { kind: 'wrong' } }),
                    }}
                    weakProps={{
                      weakWords,
                      weakGrammar: n3Wrong.grammar,
                      weakBook,
                      weakRows,
                      quiz: weakQuiz,
                      onStartQuiz: startWeakQuiz,
                      onStartDeck: startWeakDeck,
                      onOpenGrammar: () => openMenu('n3', { view: { kind: 'weak', from: 'hub' } }),
                    }}
                  />
              ) : (
              <FeatureScreen
                storyStore={storyStore}
                setStoryStore={setStoryStore}
                asks={asks}
                setAsks={setAsks}
                composeStart={composeStart}
                onAttempt={recordAttempt}
                sub={sub}
                words={words}
                review={review}
                settings={effSettings}
                patchSettings={patchSettingsEff}
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
                startQuizWrongDeck={startQuizWrong}
                noteActivity={noteActivity}
                /* 약점 장부 — 시험과 듣기가 한 줄씩 적는다 */
                noteWeakness={noteWeaknessQuiz}
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
                swissView={swissView}
                /* 실전 연습 허브의 줄 — 쭉 퀴즈·상황 대화. 뒤로 가면 허브로 */
                onOpenDrill={(id) => openSub(id, 'drill')}
                onVerdicts={applyVerdicts}
                onExit={closeSub}
                onHome={goHome}
                weakQuiz={weakQuiz}
                weakQuizOn={weakQuizMode}
                /* 약점 퀴즈를 마치면 오늘 퀘스트의 다음 줄 — 쭉 퀴즈가 남았으면 바로 이어 간다 */
                onNextQuest={flowAfter('weakquiz')?.go || null}
                nextQuestLabel={flowAfter('weakquiz')?.to === 'stream' ? '쭉 퀴즈로 이어서' : (flowAfter('weakquiz')?.label || '')}
                /* 오늘 랜덤 테스트를 마친 뒤 — N3를 켠 사람에게는 오늘의 N3를 내민다 */
                randomNext={flowAfter('random')}
                randomOn={randomMode}
                onRandomDone={onRandomDone}
                regionExam={regionExam}
                onRegionDone={onRegionDone}
                n3Next={flowAfter('n3')}
                composeFocus={composeFocus}
                composeNext={flowAfter('sentence')}
                seenToday={streamSeenToday}
                streamNext={flowAfter('stream')}
                streamAuto={streamAuto}
                streamQuestDone={!streamQuest || streamQuest.complete}
                onStreamAnswered={onStreamAnswered}
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
              <button className="ghost-btn" onClick={() => { setAskSwap(null); resumeSession(); }}>하던 학습 계속하기</button>
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

      {/* ★ 어느 화면에서든 곤에게 물어보기(AI) ★ */}
      <GonAsk
        settings={settings}
        asks={asks}
        onAsks={setAsks}
        onAddWord={(w) => setCustomWords((prev) => (
          prev.some((x) => x.id === w.id) ? prev : [...prev, { ...w, addedAt: Date.now() }]
        ))}
        onToast={showToast}
        /* 떠 있는 단추는 두지 않는다 — 아래 버튼과 퀘스트 줄의 오른쪽(진행 숫자 · 화살표)을 가렸다.
           어느 탭에서나 상단의 곤 얼굴이 연다(오늘 화면은 제 머리에, 다른 화면은 상단 바에). 창은 그대로 같은 것이다. */
        hidden
        open={gonOpen}
        onOpenChange={setGonOpen}
      />

      <TabBar
        active={activeTab === 'videos' ? 'study' : activeTab}
        onChange={selectAppTab}
        reviewCount={reviewLeft}
      />
      <Toast message={toast} />
    </div>
    </MemoContext.Provider>
  );
}

function Toast({ message }) {
  return <div role="status" aria-live="polite" aria-atomic="true" className={`toast${message ? ' show' : ''}`}>{message}</div>;
}
