import { WordDeck, Basics, GrammarHub, Situations, Translate, Quiz, Listen, ReviewTab, Conjugate, Match, Rpg, Repeat, Adverb, WordManager } from './screens.js';
import { filterByLevel } from '../lib/wordFilters.js';

export default function FeatureScreen({
  sub,
  words,
  review,
  settings,
  patchSettings,
  startWordDeck,
  startJlptSet,
  showToast,
  progress,
  setProgress,
  applyReview,
  translations,
  setTranslations,
  trends,
  setTrends,
  setCustomWords,
  startQuizWrongDeck,
  noteActivity,
  listenMode,
  todayPool,
  sentenceCards,
  setSub,
  streak,
  stats,
  startDueDeck,
  startWeakDeck,
  sentenceDue,
  applyVerdicts,
  customWords
}) {
  return (<>
            {sub === 'worddeck' && (
              <WordDeck
                words={words}
                review={review}
                settings={settings}
                onChange={patchSettings}
                onStart={startWordDeck}
                onStartSet={startJlptSet}
                onToast={showToast}
              />
            )}
            {sub === 'basics' && <Basics settings={settings} onToast={showToast} />}
            {sub === 'grammar' && (
              <GrammarHub
                words={words}
                progress={progress}
                settings={settings}
                onProgress={(moduleId, delta) => setProgress((p) => ({
                  ...p, grammarDone: { ...p.grammarDone, [moduleId]: (p.grammarDone[moduleId] || 0) + delta },
                }))}
                onPatternDone={(patternId) => setProgress((p) => ({
                  ...p, sentenceDone: { ...p.sentenceDone, [patternId]: true },
                }))}
                onDailyGrammar={(dailyGrammar) => setProgress((p) => ({ ...p, dailyGrammar }))}
                onToast={showToast}
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
                onActivity={noteActivity}
              />
            )}
            {sub === 'listen' && (
              <Listen
                onSettingsChange={patchSettings}
                initialMode={listenMode}
                pool={todayPool}
                words={words}
                sentences={sentenceCards}
                review={review}
                settings={settings}
                onClose={() => setSub(null)}
                onToast={showToast}
                onActivity={noteActivity}
              />
            )}
            {/* 복습은 탭에서 내려왔지만 화면은 그대로다.
                오늘 화면의 「복습이 더 남았어요」와 기록 탭에서 여기로 온다. */}
            {sub === 'review' && (
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
            {sub === 'match' && (
              <Match
                cards={filterByLevel(words, settings.levels)}
                review={review}
                settings={settings}
                onToast={showToast}
              />
            )}
            {sub === 'rpg' && (
              <Rpg
                review={review}
                progress={progress}
                settings={settings}
                onReview={applyVerdicts}
                onProgress={(rpg) => setProgress((p) => ({ ...p, rpg }))}
                onToast={showToast}
              />
            )}
            {sub === 'repeat' && (
              <Repeat
                words={words}
                review={review}
                onStartSet={startJlptSet}
                onToast={showToast}
              />
            )}
            {sub === 'adverb' && (
              <Adverb
                words={words}
                review={review}
                settings={settings}
                onReview={applyVerdicts}
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
  </>);
}
