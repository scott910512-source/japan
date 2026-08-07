import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCheck, IconX, IconSpeaker, IconArrowLeft, IconEye, IconPencil, IconList, IconRepeat,
} from '../components/Icons.jsx';
import { speakJapanese } from '../lib/tts.js';
import { useHotkeys, useHasKeyboard } from '../lib/useHotkeys.js';
import { filterByLevel, LEVELS } from './WordDeck.jsx';
import {
  QUIZ_TYPE, QUIZ_DIR, QUIZ_SCOPE, buildQuiz, checkTyping, gradeQuiz, gradeLabel, scopeWords,
} from '../lib/quiz.js';

const COUNTS = [10, 20, 30, 50];

const TYPE_OPTS = [
  { id: QUIZ_TYPE.CHOICE, label: '객관식', sub: '4개 중 고르기' },
  { id: QUIZ_TYPE.TYPING, label: '주관식', sub: '직접 입력' },
  { id: QUIZ_TYPE.MIX, label: '섞기', sub: '번갈아 출제' },
];

const DIR_OPTS = [
  { id: QUIZ_DIR.JP_KO, label: '일본어 → 한국어', sub: '보고 뜻 맞히기' },
  { id: QUIZ_DIR.KO_JP, label: '한국어 → 일본어', sub: '뜻 보고 단어 떠올리기' },
  { id: QUIZ_DIR.MIX, label: '양방향', sub: '번갈아 출제' },
];

const SCOPE_OPTS = [
  { id: QUIZ_SCOPE.ALL, label: '전체', sub: '고른 레벨 전부' },
  { id: QUIZ_SCOPE.SEEN, label: '외운 것', sub: '회독에서 본 단어만' },
  { id: QUIZ_SCOPE.WEAK, label: '틀린 것', sub: '몰라요·애매해요 했던 것' },
];

/* 시험 화면.
 * 회독과 달리 정답을 앱이 판정한다. 그래서 회독 기록(review)은 읽기만 하고 쓰지 않는다 —
 * 시험 때문에 복습 간격이 흔들리면 시험을 마음 편히 못 본다. */
export default function Quiz({ words, review, settings, onChange, onToast, onRetryWrong }) {
  const [config, setConfig] = useState({
    count: settings.quizCount ?? 20,
    type: settings.quizType ?? QUIZ_TYPE.CHOICE,
    dir: settings.quizDir ?? QUIZ_DIR.JP_KO,
    scope: settings.quizScope ?? QUIZ_SCOPE.ALL,
  });
  const [run, setRun] = useState(null); // { questions, answers, index } — 없으면 설정 화면

  const pool = useMemo(() => filterByLevel(words, settings.levels), [words, settings.levels]);
  const available = useMemo(
    () => scopeWords(pool, review, config.scope).length,
    [pool, review, config.scope],
  );

  const patch = (p) => {
    const next = { ...config, ...p };
    setConfig(next);
    // 다음에 들어와도 같은 설정으로 시작하게 남긴다
    onChange({ quizCount: next.count, quizType: next.type, quizDir: next.dir, quizScope: next.scope });
  };

  const start = (subset) => {
    const source = subset?.length ? subset : pool;
    const questions = buildQuiz(source, {
      count: subset?.length ? subset.length : config.count,
      type: config.type,
      dir: config.dir,
      scope: subset?.length ? QUIZ_SCOPE.ALL : config.scope,
      review,
    });
    if (!questions.length) {
      onToast('출제할 단어가 없어요');
      return;
    }
    setRun({ questions, answers: {}, index: 0 });
  };

  if (run) {
    return (
      <QuizRun
        run={run}
        pool={pool}
        settings={settings}
        onRun={setRun}
        onQuit={() => setRun(null)}
        onRetryWrong={onRetryWrong}
        onToast={onToast}
      />
    );
  }

  return (
    <>
      <div className="section-label" style={{ marginTop: 0 }}>출제 범위</div>
      <div className="chiprow">
        {SCOPE_OPTS.map((o) => (
          <div key={o.id} className={`chip${config.scope === o.id ? ' active' : ''}`}
            onClick={() => patch({ scope: o.id })}>{o.label}</div>
        ))}
      </div>
      <div className="set-note">
        {SCOPE_OPTS.find((o) => o.id === config.scope)?.sub} · 지금 {available}개
        {settings.levels?.length ? ` (${settings.levels.join(' · ')})` : ' (전체 레벨)'}
      </div>

      <div className="section-label">문제 유형</div>
      <div className="pickstack">
        {TYPE_OPTS.map((o) => (
          <button key={o.id} className={`pickrow${config.type === o.id ? ' active' : ''}`}
            onClick={() => patch({ type: o.id })}>
            <span className="pk-icon">{o.id === QUIZ_TYPE.TYPING ? <IconPencil /> : <IconList />}</span>
            <span className="pk-body"><b>{o.label}</b><span>{o.sub}</span></span>
          </button>
        ))}
      </div>

      <div className="section-label">출제 방향</div>
      <div className="pickstack">
        {DIR_OPTS.map((o) => (
          <button key={o.id} className={`pickrow${config.dir === o.id ? ' active' : ''}`}
            onClick={() => patch({ dir: o.id })}>
            <span className="pk-icon"><IconRepeat /></span>
            <span className="pk-body"><b>{o.label}</b><span>{o.sub}</span></span>
          </button>
        ))}
      </div>

      <div className="section-label">문항 수</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">한 번에 <span className="set-val">{config.count}문항</span></div>
          <div className="grouppick">
            {COUNTS.map((n) => (
              <button key={n} className={config.count === n ? 'active' : ''}
                onClick={() => patch({ count: n })}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <button className="bigstart" onClick={() => start()} disabled={available === 0}>
        <span className="bs-t">시험 시작</span>
        <span className="bs-s">
          {available === 0
            ? '이 범위에 단어가 없어요'
            : `${Math.min(config.count, available)}문항 · ${TYPE_OPTS.find((o) => o.id === config.type)?.label}`}
        </span>
      </button>

      <div className="set-note" style={{ marginTop: 12 }}>
        시험 결과는 회독 진도에 영향을 주지 않아요. 틀린 단어는 끝나고 바로 복습할 수 있어요.
      </div>
    </>
  );
}

/* ── 문제 풀기 ── */

function QuizRun({ run, pool, settings, onRun, onQuit, onRetryWrong, onToast }) {
  const { questions, answers, index } = run;
  const q = questions[index];
  const done = index >= questions.length;

  const [typed, setTyped] = useState('');
  const [shownSub, setShownSub] = useState(false);
  const inputRef = useRef(null);
  const hasKeyboard = useHasKeyboard();

  const byId = useMemo(() => new Map(pool.map((w) => [w.id, w])), [pool]);
  const word = q ? byId.get(q.wordId) : null;
  const answered = q ? answers[q.id] : null;

  useEffect(() => {
    setTyped('');
    setShownSub(false);
    if (q?.type === QUIZ_TYPE.TYPING) inputRef.current?.focus();
  }, [index, q?.type]);

  // 한자를 그대로 보내면 한 글자짜리 단어에서 음독이 나온다(「海」→ カイ).
  // 읽는 법인 가나를 보내야 외우려는 소리가 나온다.
  const speak = useCallback(() => {
    if (word) speakJapanese(word.kana || word.kanji, settings.speechRate);
  }, [word, settings.speechRate]);

  /* 일→한 문제에서 문제를 읽어 주면 답이 아니라 문제를 들려주는 거라 괜찮다.
   * 한→일은 정답이 소리로 새기 때문에 답을 낸 뒤에만 읽는다.
   * 한 문항에서 한 번만 읽는다 — answered가 바뀔 때 또 부르면 겹쳐 들린다. */
  const spokenFor = useRef(null);
  useEffect(() => {
    if (!settings.autoTTS || !q) return;
    if (q.dir === QUIZ_DIR.KO_JP && !answered) return;
    if (spokenFor.current === index) return;
    spokenFor.current = index;
    speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, Boolean(answered)]);

  const record = (verdict, value) => {
    if (answered) return;
    onRun({ ...run, answers: { ...answers, [q.id]: { verdict, value } } });
  };

  const answerChoice = (option) => record(option.wordId === q.wordId ? 'correct' : 'wrong', option.wordId);

  const submitTyping = () => {
    if (answered || !word) return;
    record(checkTyping(word, q.dir, typed), typed);
  };

  const next = () => onRun({ ...run, index: index + 1 });

  // 오타로 틀리는 건 실력이 아니다. 애매한 답은 내가 인정할 수 있게 둔다.
  const acceptClose = () => onRun({
    ...run,
    answers: { ...answers, [q.id]: { ...answers[q.id], verdict: 'correct' } },
  });

  useHotkeys({
    Enter: () => {
      if (done) return;
      if (answered) next();
      else if (q?.type === QUIZ_TYPE.TYPING) submitTyping();
    },
    ' ': () => { if (answered || q?.dir === QUIZ_DIR.JP_KO) speak(); },
    Space: () => { if (answered || q?.dir === QUIZ_DIR.JP_KO) speak(); },
    1: () => q?.options && !answered && answerChoice(q.options[0]),
    2: () => q?.options && !answered && answerChoice(q.options[1]),
    3: () => q?.options && !answered && answerChoice(q.options[2]),
    4: () => q?.options && !answered && answerChoice(q.options[3]),
    Escape: onQuit,
  });

  if (done) {
    return (
      <QuizResult
        questions={questions}
        answers={answers}
        byId={byId}
        settings={settings}
        onQuit={onQuit}
        onRetryWrong={onRetryWrong}
        onToast={onToast}
      />
    );
  }

  const pct = Math.round((index / questions.length) * 100);
  const correct = Object.values(answers).filter((a) => a.verdict === 'correct').length;

  return (
    <>
      <div className="quizhead">
        <div className="qh-row">
          <button className="sh-close" onClick={onQuit} aria-label="시험 그만두기"><IconArrowLeft /></button>
          <div className="sh-title">{index + 1} / {questions.length}</div>
          <div className="qh-score">{correct}점</div>
        </div>
        <div className="sh-bar"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="quizcard">
        <div className="qc-tag">
          {q.dir === QUIZ_DIR.JP_KO ? '뜻을 고르세요' : '일본어로 뭘까요'}
          {q.type === QUIZ_TYPE.TYPING && ' · 직접 입력'}
        </div>
        <div className={`qc-prompt${q.dir === QUIZ_DIR.KO_JP ? ' ko' : ''}`}>{q.prompt}</div>

        {q.dir === QUIZ_DIR.JP_KO && (
          shownSub || answered
            ? <div className="qc-sub">{q.promptSub}</div>
            : (
              <button className="sc-peek" onClick={() => setShownSub(true)}>
                <IconEye /> 읽는 법 보기
              </button>
            )
        )}

        {(q.dir === QUIZ_DIR.JP_KO || answered) && (
          <button className="qc-speak" onClick={speak} aria-label="발음 듣기">
            <IconSpeaker />
            {hasKeyboard && <kbd className="corner-key">Space</kbd>}
          </button>
        )}
      </div>

      {q.type === QUIZ_TYPE.CHOICE ? (
        <div className="qoptions">
          {q.options.map((o, i) => {
            const isAnswer = o.wordId === q.wordId;
            const isMine = answered?.value === o.wordId;
            let cls = 'qopt';
            if (answered) {
              if (isAnswer) cls += ' correct';
              else if (isMine) cls += ' wrong';
              else cls += ' dim';
            }
            return (
              <button key={o.wordId} className={cls} disabled={Boolean(answered)}
                onClick={() => answerChoice(o)}>
                <span className="qo-num">{hasKeyboard ? <kbd>{i + 1}</kbd> : i + 1}</span>
                <span className="qo-body">
                  <b>{o.label}</b>
                  {o.sub && <span>{o.sub}</span>}
                </span>
                {answered && isAnswer && <span className="qo-mark ok"><IconCheck /> 정답</span>}
                {answered && isMine && !isAnswer && <span className="qo-mark no"><IconX /> 내가 고른 답</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="qtyping">
          <input
            ref={inputRef}
            className="search-input"
            value={answered ? answered.value : typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); answered ? next() : submitTyping(); } }}
            placeholder={q.dir === QUIZ_DIR.JP_KO ? '뜻을 한국어로' : '일본어로 (한자 또는 히라가나)'}
            disabled={Boolean(answered)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {!answered && (
            <button className="submit-btn" onClick={submitTyping} disabled={!typed.trim()}>
              제출{hasKeyboard && <kbd className="inline-key">Enter</kbd>}
            </button>
          )}
        </div>
      )}

      {answered && (
        <div className={`qverdict ${answered.verdict}`}>
          {answered.verdict === 'correct' && <><IconCheck /> 정답이에요</>}
          {answered.verdict === 'close' && <>거의 맞았어요 — 정답은 <b>{q.answer}</b></>}
          {answered.verdict === 'wrong' && <><IconX /> 정답은 <b>{q.answer}</b>{q.answerSub && q.answerSub !== q.answer && ` (${q.answerSub})`}</>}
          {word?.example && (
            <div className="qv-ex">
              <span>{word.example}</span>
              <span className="ex-ko">{word.exampleKo}</span>
            </div>
          )}
        </div>
      )}

      {answered && (
        <div className="qnext">
          {answered.verdict === 'close' && (
            <button className="ghost-btn" onClick={acceptClose}>맞게 처리하기</button>
          )}
          <button className="submit-btn" onClick={next}>
            {index + 1 === questions.length ? '결과 보기' : '다음 문제'}
            {hasKeyboard && <kbd className="inline-key">Enter</kbd>}
          </button>
        </div>
      )}
    </>
  );
}

/* ── 결과 ── */

function QuizResult({ questions, answers, byId, settings, onQuit, onRetryWrong, onToast }) {
  const result = useMemo(() => gradeQuiz(questions, answers), [questions, answers]);
  const grade = gradeLabel(result.score);

  const wrongWords = result.wrongIds.map((id) => byId.get(id)).filter(Boolean);

  return (
    <>
      <div className={`quizscore ${grade.tone}`}>
        <div className="qs-num">{result.score}<small>점</small></div>
        <div className="qs-label">{grade.text}</div>
        <div className="qs-sub">{result.total}문항 중 {result.correct}개 정답</div>
      </div>

      {wrongWords.length > 0 && (
        <>
          <div className="section-label">틀린 단어 {wrongWords.length}개</div>
          <div className="card qwronglist">
            {wrongWords.map((w) => (
              <div key={w.id} className="qwrow">
                <button className="qw-speak" onClick={() => speakJapanese(w.kana || w.kanji, settings.speechRate)}
                  aria-label={`${w.kanji} 듣기`}><IconSpeaker /></button>
                <div className="qw-body">
                  <b>{w.kanji}</b>
                  <span>{w.kana} · {w.mean}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="bigstart" onClick={() => { onRetryWrong(result.wrongIds); onToast('틀린 단어로 회독을 시작해요'); }}>
            <span className="bs-t">틀린 단어 바로 외우기</span>
            <span className="bs-s">{wrongWords.length}장 회독</span>
          </button>
        </>
      )}

      {wrongWords.length === 0 && (
        <div className="empty-state" style={{ marginTop: 16 }}>다 맞혔어요. 다음 레벨로 넘어가 볼까요?</div>
      )}

      <button className="ghost-btn" style={{ marginTop: 12 }} onClick={onQuit}>시험 설정으로</button>
    </>
  );
}
