import { useAppData, usePersistAppData } from './app/useAppData.js';
import FeatureScreen from './app/FeatureScreen.jsx';
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
import { ensurePlan } from './lib/plan.js';
import { LANE_DECK, useStudyQueue } from './app/useStudyQueue.js';
import BottomSheet from './components/BottomSheet.jsx';
import Onboarding from './components/Onboarding.jsx';
import Today from './screens/Today.jsx';
import Gate from './screens/Gate.jsx';
import { IconArrowLeft } from './components/Icons.jsx';
import { dailyPool } from './lib/cards.js';
import { kijuIndex } from './lib/kiju.js';
import { hasSignedInOnce } from './lib/storage.js';
import { todayKey } from './lib/review.js';
import { supabaseConfigured } from './lib/supabase.js';
import { authGate } from './lib/authboot.js';
import { useToday } from './lib/useToday.js';

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
  /* 어디에 있나 — 탭 · 밀어 넣은 화면 · 회독 판, 그리고 뒤로가기 연동과
     「지금 갈아끼우면 잃는 게 있나」 표시까지 app/useAppNavigation.js가 쥔다.
     주소가 없는 앱이라 「지금 어느 화면인가」가 전부 상태값이고, 그게 일곱
     개로 흩어져 있으면 한 자리를 열 때 함께 할 일을 빼먹는다. */
  const nav = useAppNavigation();
  const {
    activeTab, sub, deck, n3View, listenMode, quizSet, videosSeen,
    setActiveTab, setSub, setDeck, setQuizSet, selectTab, openListen,
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
    removeVideo
  } = appData;
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const { toast, showToast } = useToast();
  /* 앱을 켤 때 브라우저와 맞추는 일들 — 저장 실패를 받는 손, 음성 오류,
     「새 버전이 준비됐다」 알림, iOS 오디오 열기, 연속일, 테마, 음성 설정.
     전부 바깥 시스템과 맞추는 일이라 app/useAppBoot.js에 모았다. */
  const { storeError, streak, setStreak } = useAppBoot({ settings, showToast });
  const [offlinePass, setOfflinePass] = useState(false);
  const {
    authSession,
    setAuthSession,
    syncState,
    remoteKeyEnvelope,
    setRemoteKeyEnvelope,
    vaultKey,
    authReady,
    authTimedOut,
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
    if (signedIn && syncedFor.current !== authSession.user.id) return;  // 동기화를 기다린다
    onboardingDecided.current = true;
    /* 답이 이미 있으면 끝난 것으로 본다. onboarded 표시가 옛 기기에만 있고
       계정에는 없을 수 있어서, 답(canReadKana)이 있는지도 같이 본다. */
    setOnboardingOpen(!settings.onboarded && settings.canReadKana == null);
  }, [authReady, authSession, settings.onboarded, settings.canReadKana, syncState.at]);

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

  /* 메뉴를 연다. 길은 app/useAppNavigation.js가 알고, 「약점」만 여기서
     가로챈다 — 그건 화면이 아니라 판이라서(회독 큐를 짜야 한다) 자리를
     정하는 쪽이 알 일이 아니다. */
  const openMenu = useCallback((id, opts = {}) => {
    if (id === 'weak') { startWeakDeck(); return; }
    nav.openMenu(id, opts);
  }, [startWeakDeck, nav.openMenu]);

  const finishOnboarding = (patch) => {
    patchSettings(patch);
    setOnboardingOpen(false);
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
              /* 와이파이는 잡혔는데 서버가 죽은 자리에서 갇히지 않게 —
                 확인이 시간초과·거절로 끝났거나 동기화가 실패했으면
                 「이 기기 기록으로 계속하기」를 띄운다 */
              serverDown={authTimedOut || Boolean(syncState.error)}
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
