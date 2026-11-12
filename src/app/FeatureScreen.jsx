import { WordDeck, KijuDeck, Basics, GrammarHub, Situations, Translate, Quiz, Listen, ListenHub, Conjugate, Match, Rpg, Repeat, Adverb, WordManager, SwissCourse, TravelCourse, N3Course, DrillHub, StreamQuiz, ComposeQuiz, SpeakPractice, StoryListen } from './screens.js';
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
  noteWeakness,
  onAttempt,
  composeStart,
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
  swissView,
  quizSet,
  onQuizSet,
  onOpenDrill,
  onVerdicts,
  onExit,
  /* 하루 흐름의 끝 화면에 두는 「홈으로」 — 어디서 들어왔든 오늘 화면으로 */
  onHome = null,
  weakQuiz = null,
  weakQuizOn = false,
  onNextQuest = null,
  nextQuestLabel = '쭉 퀴즈로 이어서',
  randomNext = null,
  /* 하루 흐름 — 오늘 랜덤 테스트로 들어왔나 · 끝났다고 적기 · 쭉 퀴즈 다음 단계 */
  randomOn = false,
  onRandomDone = null,
  /* 지역 승급시험 — { id, label, pass } 이면 단어 시험을 그 낱말들로 바로 시작한다 */
  regionExam = null,
  onRegionDone = null,
  streamNext = null,
  n3Next = null,
  composeFocus = null,
  composeNext = null,
  seenToday = null,
  streamQuestDone = false,
  onStreamAnswered,
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
            {sub === 'swiss' && <SwissCourse settings={settings} onToast={showToast} initialView={swissView} />}
            {sub === 'travel' && (
              <TravelCourse
                settings={settings}
                onToast={showToast}
                /* 코스 전체를 자동 듣기의 「여행 일본어」 범위로 — 범위를 먼저 그쪽으로 돌려 둔다 */
                onListen={() => { patchSettings({ listenScope: 'tour' }); openListen('listen'); }}
              />
            )}
            {/* N3 코스 — 숙련도는 회독 저장소(applyVerdicts)로, 코스 진도는 progress.n3로.
                단어 카드에서 「회독으로 더 외우기」는 startJlptSet로 기존 회독 화면을 연다. */}
            {sub === 'n3' && (
              <N3Course
                onAttempt={onAttempt}
                review={review}
                progress={progress}
                setProgress={setProgress}
                applyVerdicts={applyVerdicts}
                settings={settings}
                streak={streak}
                onStartSet={startJlptSet}
                onToast={showToast}
                initialView={n3View}
                flowNext={n3Next}
                onHome={onHome}
              />
            )}
            {/* 듣기 고르기 — 자동 듣기 · 따라 말하기 · 영상. 학습 탭 「듣기」에서 연다 */}
            {sub === 'listenhub' && <ListenHub onOpen={openListen} />}
            {sub === 'story' && <StoryListen onActivity={noteActivity} onToast={showToast} />}
            {sub === 'grammar' && (
              <GrammarHub
                onAttempt={onAttempt}
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
                  prev.some((x) => x.id === w.id) ? prev : [...prev, { ...w, addedAt: Date.now() }]
                ))}
                onToast={showToast}
              />
            )}
            {sub === 'quiz' && (
              <Quiz
                key={regionExam ? 'region' : randomOn ? 'random' : weakQuizOn ? 'weak' : 'quiz'}
                onAttempt={onAttempt}
                mistakes={progress.mistakes}
                words={words}
                review={review}
                settings={settings}
                onChange={patchSettings}
                onToast={showToast}
                onRetryWrong={startQuizWrongDeck}
                onActivity={noteActivity}
                /* 맞고 틀린 것이 약점 장부에 쌓인다. 복습 간격은 그대로 둔다 —
                   시험 때문에 일정이 흔들리면 시험을 마음 편히 못 본다. */
                onWeakness={noteWeakness}
                /* 「약점」 범위가 시험 오답·잊어버림까지 본다 */
                ledger={progress.weak}
                /* 듣기에서 넘어온 세트가 있으면 그것만 묻는다 */
                fixedWords={quizSet}
                /* 약점 퀴즈로 들어왔으면 결과 화면이 오늘 몫을 말한다 */
                weak={weakQuizOn ? weakQuiz : null}
                onExit={onExit}
                onHome={onHome}
                onNextQuest={weakQuizOn ? onNextQuest : randomOn && !regionExam ? (randomNext?.go || null) : null}
                nextLabel={weakQuizOn ? nextQuestLabel : (randomNext?.label || '')}
                flow={regionExam ? { kind: 'region', label: regionExam.label, pass: regionExam.pass } : randomOn ? { kind: 'random' } : null}
                onComplete={regionExam ? onRegionDone : randomOn ? onRandomDone : null}
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
                /* 몇 번 들었는지가 낱말마다 쌓인다. 쉰 번 들었는데 아직 틀리는
                   낱말은 더 약한 낱말이라, 약점 순서에서 위로 올라온다. */
                onWeakness={noteWeakness}
                /* 「약점만」 범위가 시험 오답·잊어버림까지 본다 */
                ledger={progress.weak}
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
            {sub === 'drill' && <DrillHub settings={settings} onOpen={onOpenDrill} />}
            {sub === 'stream' && (
              <StreamQuiz
                onAttempt={onAttempt}
                words={words}
                review={review}
                progress={progress}
                settings={settings}
                sentenceCards={sentenceCards}
                onVerdicts={onVerdicts}
                onActivity={noteActivity}
                onToast={showToast}
                onExit={onExit}
                onAnswered={onStreamAnswered}
                next={streamNext}
                seenToday={seenToday}
                questDone={streamQuestDone}
                onHome={onHome}
              />
            )}
            {sub === 'speak' && (
              <SpeakPractice
                sentenceCards={sentenceCards}
                review={review}
                progress={progress}
                setProgress={setProgress}
                settings={settings}
                onActivity={noteActivity}
                onToast={showToast}
                onExit={onExit}
              />
            )}
            {sub === 'compose' && (
              <ComposeQuiz
                initialMode={composeStart}
                focusIds={composeFocus?.ids || null}
                questTarget={composeFocus?.target || 0}
                questNext={composeNext}
                onHome={onHome}
                onAttempt={onAttempt}
                sentences={sentenceCards}
                review={review}
                progress={progress}
                settings={settings}
                onVerdicts={onVerdicts}
                onActivity={noteActivity}
                onToast={showToast}
                onExit={onExit}
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
                onAddWord={(w) => setCustomWords((prev) => [...prev, { ...w, addedAt: Date.now() }])}
                /* 지운 시각을 남긴다 — 낱말만 빼면 다른 기기(또는 서버에 올라가 있던 내 것)에서 다음 동기화 때 되살아났다 */
                onDeleteWord={(id) => {
                  setCustomWords((prev) => prev.filter((w) => w.id !== id));
                  setProgress((p) => ({ ...p, wordsGone: { ...(p.wordsGone || {}), [id]: Date.now() } }));
                }}
                onToast={showToast}
              />
            )}
  </>);
}
