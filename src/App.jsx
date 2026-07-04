import { useEffect, useMemo, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import Onboarding from './components/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Vocab from './screens/Vocab.jsx';
import Sentence from './screens/Sentence.jsx';
import Grammar from './screens/Grammar.jsx';
import My from './screens/My.jsx';
import { DEFAULT_WORDS } from './data/words.js';
import {
  loadCustomWords, saveCustomWords,
  loadProgress, saveProgress,
  loadSettings, saveSettings,
  touchStreak,
} from './lib/storage.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [customWords, setCustomWords] = useState(() => loadCustomWords());
  const [progress, setProgress] = useState(() => loadProgress());
  const [settings, setSettings] = useState(() => loadSettings());
  const [streak, setStreak] = useState({ count: 0, lastDate: null });
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    setStreak(touchStreak());
    setOnboardingOpen(!loadSettings().onboarded);
  }, []);

  useEffect(() => saveCustomWords(customWords), [customWords]);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveSettings(settings), [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const words = useMemo(() => [...DEFAULT_WORDS, ...customWords], [customWords]);

  const addWord = (word) => setCustomWords((prev) => [...prev, word]);
  const deleteWord = (id) => setCustomWords((prev) => prev.filter((w) => w.id !== id));

  const markKnown = (id) => setProgress((p) => ({
    ...p,
    known: [...new Set([...p.known, id])],
    unknown: p.unknown.filter((x) => x !== id),
  }));
  const markUnknown = (id) => setProgress((p) => ({
    ...p,
    unknown: [...new Set([...p.unknown, id])],
    known: p.known.filter((x) => x !== id),
  }));
  const markSentenceDone = (patternId) => setProgress((p) => ({
    ...p, sentenceDone: { ...p.sentenceDone, [patternId]: true },
  }));
  const markGrammarProgress = (moduleId, delta) => setProgress((p) => ({
    ...p, grammarDone: { ...p.grammarDone, [moduleId]: (p.grammarDone[moduleId] || 0) + delta },
  }));

  const finishOnboarding = (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    setOnboardingOpen(false);
  };

  return (
    <div className="app-shell">
      <Onboarding open={onboardingOpen} onFinish={finishOnboarding} />

      <div className="screens">
        <section className={`screen${activeTab === 'home' ? ' active' : ''}`}>
          <Home
            words={words}
            progress={progress}
            streak={streak}
            settings={settings}
            onNavigate={setActiveTab}
          />
        </section>
        <section className={`screen${activeTab === 'vocab' ? ' active' : ''}`}>
          <Vocab
            words={words}
            progress={progress}
            settings={settings}
            onKnown={markKnown}
            onUnknown={markUnknown}
          />
        </section>
        <section className={`screen${activeTab === 'sentence' ? ' active' : ''}`}>
          <Sentence words={words} progress={progress} onPatternDone={markSentenceDone} />
        </section>
        <section className={`screen${activeTab === 'grammar' ? ' active' : ''}`}>
          <Grammar words={words} progress={progress} onProgress={markGrammarProgress} />
        </section>
        <section className={`screen${activeTab === 'my' ? ' active' : ''}`}>
          <My
            words={words}
            customWords={customWords}
            progress={progress}
            streak={streak}
            settings={settings}
            onAddWord={addWord}
            onDeleteWord={deleteWord}
            onSettingsChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            onReplayOnboarding={() => setOnboardingOpen(true)}
          />
        </section>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
