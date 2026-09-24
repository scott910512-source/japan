import { WordDeck, KijuDeck, Basics, GrammarHub, Situations, Translate, Quiz, Listen, ListenHub, Conjugate, Match, Rpg, Repeat, Adverb, WordManager, SwissCourse, N3Course } from './screens.js';
import { filterByLevel } from '../lib/wordFilters.js';

export default function FeatureScreen({
  sub,
  words,
  review,
  settings,
  patchSettings,
  startWordDeck,
  startKijuDeck,
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
  customWords,
  openListen,
  n3View,
  quizSet,
  onQuizSet,
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
            {sub === 'kiju' && (
              <KijuDeck words={words} review={review} onStart={startKijuDeck} />
            )}
            {sub === 'basics' && <Basics settings={settings} onToast={showToast} />}
            {/* 곁가지 — 회독·기록·계획 어디에도 안 붙는다. 그래서 넘기는 것도 설정뿐이다 */}
            {sub === 'swiss' && <SwissCourse settings={settings} onToast={showToast} />}
            {/* N3 코스 — 숙련도는 회독 저장소(applyVerdicts)로, 코스 진도는 progress.n3로.
                단어 카드에서 「회독으로 더 외우기」는 startJlptSet로 기존 회독 화면을 연다. */}
            {sub === 'n3' && (
              <N3Course
                review={review}
                progress={progress}
                setProgress={setProgress}
                applyVerdicts={applyVerdicts}
                settings={settings}
                streak={streak}
                onStartSet={startJlptSet}
                onToast={showToast}
                initialView={n3View}
              />
            )}
            {/* 듣기 고르기 — 자동 듣기 · 따라 말하기 · 영상. 학습 탭 「듣기」에서 연다 */}
            {sub === 'listenhub' && <ListenHub onOpen={openListen} />}
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
                /* 듣기에서 넘어온 세트가 있으면 그것만 묻는다 */
                fixedWords={quizSet}
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
                /* 듣던 세트를 그대로 시험으로. 귀로 들은 것과 답할 수 있는
                   것은 다르고, 그 차이는 물어봐야 안다. */
                onQuiz={onQuizSet}
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
