import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import Onboarding from './components/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Study from './screens/Study.jsx';
import ReviewTab from './screens/ReviewTab.jsx';
import Settings from './screens/Settings.jsx';
import Basics from './screens/Basics.jsx';
import WordManager from './screens/WordManager.jsx';
import WordDeck, { filterByLevel } from './screens/WordDeck.jsx';
import Situations from './screens/Situations.jsx';
import GrammarHub from './screens/GrammarHub.jsx';
import Gate from './screens/Gate.jsx';
import { IconArrowLeft } from './components/Icons.jsx';
import { ALL_WORDS } from './data/allWords.js';
import { ALL_SITUATIONS as SITUATIONS } from './data/allSituations.js';
import {
  loadCustomWords, saveCustomWords,
  loadProgress, saveProgress,
  loadSettings, saveSettings,
  loadReview, saveReview,
  loadSession, saveSession,
  loadStats, saveStats,
  touchStreak, setStorageErrorHandler,
  loadVaultKey, saveVaultKey, markSignedInOnce, hasSignedInOnce,
} from './lib/storage.js';
import { audioUnlocked, configureTTS, setTTSErrorHandler, unlockAudio } from './lib/tts.js';
import { configureSTT } from './lib/stt.js';
import { dueCards, todayKey, weakCards } from './lib/review.js';
import { supabase, supabaseConfigured } from './lib/supabase.js';
import { syncNow, pushMerged } from './lib/sync.js';
import { pickSyncedSettings } from './lib/merge.js';
import { encryptWithVaultKey, decryptWithVaultKey } from './lib/crypto.js';

const SUB_TITLES = {
  basics: '완전기초',
  grammar: '기초문법',
  sentences: '상황별 문장암기',
  rpg: '실전연습 (여행연습)',
  manage: '내 단어장',
  worddeck: '단어암기',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [sub, setSub] = useState(null);
  const [deck, setDeck] = useState(null); // 학습 중인 덱 (있으면 회독 화면이 전체를 덮는다)

  const [customWords, setCustomWords] = useState(() => loadCustomWords());
  const [progress, setProgress] = useState(() => loadProgress());
  const [settings, setSettings] = useState(() => loadSettings());
  const [review, setReview] = useState(() => loadReview());
  const [session, setSession] = useState(() => loadSession());
  const [stats, setStats] = useState(() => loadStats());
  const [streak, setStreak] = useState({ count: 0, lastDate: null });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [authSession, setAuthSession] = useState(null);
  const [syncState, setSyncState] = useState({ busy: false, at: null });
  const [remoteKeyEnvelope, setRemoteKeyEnvelope] = useState(null);
  const [vaultKey, setVaultKey] = useState(() => loadVaultKey());
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [offlinePass, setOfflinePass] = useState(false);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    setStorageErrorHandler(showToast);
    setTTSErrorHandler(showToast);
    setStreak(touchStreak());
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

  // 음성 인식도 같은 Google API 키를 쓴다
  useEffect(() => {
    configureTTS({ gttsKey: settings.gttsKey, useCloud: settings.useCloudTTS });
    configureSTT({ gttsKey: settings.gttsKey, useCloud: settings.useCloudTTS });
  }, [settings.gttsKey, settings.useCloudTTS]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const words = useMemo(() => [...ALL_WORDS, ...customWords], [customWords]);
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const due = useMemo(() => dueCards(wordIds, review, todayKey()), [wordIds, review]);

  const sentenceIds = useMemo(
    () => SITUATIONS.flatMap((s) => s.parts.flatMap((p) => p.items.map((i) => i.id))),
    [],
  );
  const sentenceDue = useMemo(
    () => dueCards(sentenceIds, review, todayKey()).length,
    [sentenceIds, review],
  );

  const patchSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  /* ── 계정 · 기기 간 동기화 ── */

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setAuthSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const runSync = useCallback(async (silent = false) => {
    if (!authSession?.user) return;
    setSyncState((s) => ({ ...s, busy: true }));
    try {
      const merged = await syncNow(authSession.user.id, {
        review, progress, settings, stats, streak, customWords,
      });
      setReview(merged.review);
      setProgress((p) => ({ ...p, ...merged.progress }));
      setStats(merged.stats);
      setStreak(merged.streak);
      setCustomWords(merged.customWords);
      // 서버에서 온 설정은 학습 범위만 들어 있다 — 기기별 설정은 덮지 않는다
      setSettings((s) => ({ ...s, ...merged.settings }));
      setRemoteKeyEnvelope(merged.gttsKeyEnc || null);
      setSyncState({ busy: false, at: new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) });
      if (!silent) showToast('동기화했어요');
    } catch (err) {
      setSyncState((s) => ({ ...s, busy: false }));
      showToast(`동기화에 실패했어요 — ${err.message}`);
    }
  }, [authSession, review, progress, settings, stats, streak, customWords, showToast]);

  const saveRemoteKey = useCallback(async (envelope) => {
    if (!authSession?.user) throw new Error('로그인이 필요해요');
    await pushMerged(authSession.user.id, {
      review, progress, settings: pickSyncedSettings(settings), stats, streak,
      customWords, gttsKeyEnc: envelope,
    });
    setRemoteKeyEnvelope(envelope);
  }, [authSession, review, progress, settings, stats, streak, customWords]);

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

  const openMenu = useCallback((id) => {
    if (id === 'words') { setSub('worddeck'); return; }
    if (id === 'review') { setActiveTab('review'); return; }
    if (id === 'rpg') { showToast('여행연습은 이관 준비 중이에요'); return; }
    setSub(id);
  }, [startWordDeck, showToast]);

  const finishOnboarding = (patch) => {
    patchSettings(patch);
    setOnboardingOpen(false);
  };

  // 학습 탭은 화면이 아니라 바로 회독으로 들어가는 통로다
  const selectTab = (id) => {
    if (id === 'study') { startWordDeck(); return; }
    setSub(null);
    setActiveTab(id);
  };

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
              onReviewChange={applyReview}
              onSessionChange={setSession}
              onSettingsChange={patchSettings}
              onBookmark={toggleBookmark}
              onToast={showToast}
              onClose={() => setDeck(null)}
            />
          </section>
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Onboarding open={onboardingOpen} onFinish={finishOnboarding} />

      <div className="screens">
        <section className={`screen${activeTab === 'home' && !sub ? ' active' : ''}`}>
          <Home
            words={words}
            review={review}
            streak={streak}
            settings={settings}
            stats={stats}
            dueCount={due.length}
            session={session}
            onOpen={openMenu}
            onStartStudy={startWordDeck}
          />
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

        <section className={`screen${activeTab === 'settings' && !sub ? ' active' : ''}`}>
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
            <button className="sub-back" onClick={() => setSub(null)}><IconArrowLeft /> 홈</button>
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

      <TabBar active={activeTab} onChange={selectTab} reviewCount={due.length + sentenceDue} />
      <Toast message={toast} />
    </div>
  );
}

function Toast({ message }) {
  return <div className={`toast${message ? ' show' : ''}`}>{message}</div>;
}
