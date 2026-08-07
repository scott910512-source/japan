import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { IconArrowLeft } from './components/Icons.jsx';
import { ALL_WORDS } from './data/allWords.js';
import { SITUATIONS } from './data/situations.js';
import {
  loadCustomWords, saveCustomWords,
  loadProgress, saveProgress,
  loadSettings, saveSettings,
  loadReview, saveReview,
  loadSession, saveSession,
  loadStats, saveStats,
  touchStreak, setStorageErrorHandler,
} from './lib/storage.js';
import { audioUnlocked, configureTTS, setTTSErrorHandler, unlockAudio } from './lib/tts.js';
import { configureSTT } from './lib/stt.js';
import { dueCards, todayKey, weakCards } from './lib/review.js';

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
