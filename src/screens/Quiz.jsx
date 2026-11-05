import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCheck, IconX, IconSpeaker, IconArrowLeft, IconEye, IconPencil, IconList, IconRepeat,
} from '../components/Icons.jsx';
import { speakJapanese } from '../lib/tts.js';
import { markBusy } from '../lib/busy.js';
import { useQuizHotkeys, useHasKeyboard, shortcutEvent } from '../lib/useHotkeys.js';
import KeyboardHelp from '../components/KeyboardHelp.jsx';
import { filterByLevel, LEVELS } from '../lib/wordFilters.js';
import {
  QUIZ_TYPE, QUIZ_DIR, QUIZ_SCOPE, buildQuiz, checkTyping, gradeQuiz, gradeLabel, scopeWords, acceptedJp, meaningsOf,
} from '../lib/quiz.js';
import { WEAK_KIND } from '../lib/weak.js';
import OptionReview, { useReviewOpen } from '../components/OptionReview.jsx';
import { reviewRows, wordInfo } from '../lib/optionInfo.js';

const COUNTS = [10, 20, 30, 50];

// 맞힌 문제에서 다음으로 넘어가기까지 — 정답 표시를 눈으로 확인할 만큼만 둔다.
const AUTO_NEXT_MS = 750;
const AUTO_NEXT_SPEAK_MS = 1500;

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
  // 「약점」의 기준은 회독 쪽 한 군데에서 정한다 — 여기서 따로 세면 같은 낱말이 다른 수가 된다
  { id: QUIZ_SCOPE.WEAK, label: '약점', sub: '몰라요·애매해요를 세 번 넘게 한 것' },
];

/* 시험 화면.
 * 회독과 달리 정답을 앱이 판정한다. 그래서 회독 기록(review)은 읽기만 하고 쓰지 않는다 —
 * 시험 때문에 복습 간격이 흔들리면 시험을 마음 편히 못 본다. */
/* fixedWords — 듣기에서 들고 온 세트.
 *
 * 있으면 그것만 묻는다. 범위 고르기는 안 보여 준다 — 「방금 들은 스무 개로
 * 시험」인데 거기서 범위를 또 고르게 하면 무엇을 푸는 시험인지 흐려진다.
 * 보기(오답 후보)도 그 세트 안에서 뽑는다. 같은 구간에서 헷갈리는 것끼리
 * 겨루는 편이, 안 들은 낱말이 보기로 나오는 것보다 낫다. */
export default function Quiz({
  words, review, settings, onChange, onToast, onRetryWrong, onActivity, onWeakness,
  fixedWords = null, ledger = null, mistakes = {}, onAttempt, weak = null, onExit,
}) {
  const [config, setConfig] = useState({
    count: settings.quizCount ?? 20,
    type: settings.quizType ?? QUIZ_TYPE.CHOICE,
    dir: settings.quizDir ?? QUIZ_DIR.JP_KO,
    scope: settings.quizScope ?? QUIZ_SCOPE.ALL,
  });
  const [run, setRun] = useState(null); // { questions, answers, index } — 없으면 설정 화면

  /* 풀던 답은 제출 전까지 아무 데도 안 적힌다. 새 버전이 올라와도 시험이
     끝날 때까지 갈아끼우지 않는다 — 반쯤 푼 시험이 사라지면 다시 풀 마음이 안 난다. */
  useEffect(() => {
    markBusy('quiz', Boolean(run));
    return () => markBusy('quiz', false);
  }, [run]);

  const set = fixedWords?.length ? fixedWords.filter((w) => w?.kind !== 'sentence') : null;
  const pool = useMemo(
    () => (set ? set : filterByLevel(words, settings.levels)),
    [set, words, settings.levels],
  );
  const available = useMemo(
    () => (set ? set.length : scopeWords(pool, review, config.scope, ledger, mistakes).length),
    [set, pool, review, config.scope, ledger, mistakes],
  );

  const patch = (p) => {
    const next = { ...config, ...p };
    setConfig(next);
    // 다음에 들어와도 같은 설정으로 시작하게 남긴다
    onChange({ quizCount: next.count, quizType: next.type, quizDir: next.dir, quizScope: next.scope });
  };

  const start = (subset, over = null) => {
    const source = subset?.length ? subset : pool;
    const cfg = over ? { ...config, ...over } : config;
    const questions = buildQuiz(source, {
      count: subset?.length ? subset.length : cfg.count,
      type: cfg.type,
      dir: cfg.dir,
      scope: subset?.length ? QUIZ_SCOPE.ALL : config.scope,
      review,
      /* 「약점」 범위가 시험 오답까지 본다 — 시험에서 틀린 낱말을 다시 묻는
         자리인데, 여태 회독 기록만 봐서 그걸 못 보고 있었다. */
      ledger,
      mistakes,
    });
    if (!questions.length) {
      onToast('출제할 단어가 없어요');
      return;
    }
    setRun({ questions, answers: {}, index: 0 });
  };

  /* ★ 약점 퀴즈는 설정을 묻지 않고 바로 시작한다 ★
     퀘스트 한 줄은 한 번 눌러 바로 풀려야 한다. 객관식, 일본어 → 한국어로 정해 두고(약한 낱말을 알아보는 판),
     설정은 건드리지 않는다(다음 일반 시험은 내가 정한 대로). 그만두면 이 화면의 설정이 아니라 온 곳으로 돌아간다. */
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!weak || !set?.length || run || autoStarted.current) return;
    autoStarted.current = true;
    start(set, { type: QUIZ_TYPE.CHOICE, dir: QUIZ_DIR.JP_KO });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weak, set, run]);

  if (run) {
    return (
      <QuizRun
        onAttempt={onAttempt}
        run={run}
        pool={pool}
        settings={settings}
        onRun={setRun}
        onQuit={() => (weak && onExit ? onExit() : setRun(null))}
        onRetryWrong={onRetryWrong}
        onToast={onToast}
        onActivity={onActivity}
        onWeakness={onWeakness}
        weak={weak}
        onExit={onExit}
      />
    );
  }

  return (
    <>
      {set ? (
        /* 듣고 온 세트 — 무엇을 푸는 시험인지만 적고 범위는 안 묻는다 */
        <div className="card qz-fromlisten" style={{ marginTop: 0 }}>
          <div className="set-title">방금 들은 {set.length}개로 시험</div>
          <div className="set-sub">
            귀로 들은 것과 답할 수 있는 것은 달라요. 여기서 확인해요.
          </div>
        </div>
      ) : (
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
        </>
      )}

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

      {/* 들고 온 세트는 그 수가 곧 문항 수다 — 스무 개를 듣고 와서 열 개만
          묻으면 나머지 열 개는 확인이 안 된 채로 남는다. */}
      {!set && (
        <div>
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
        </div>
      )}

      <button className="bigstart" onClick={() => start(set)} disabled={available === 0}>
        <span className="bs-t">시험 시작</span>
        <span className="bs-s">
          {available === 0
            ? '이 범위에 단어가 없어요'
            : `${set ? set.length : Math.min(config.count, available)}문항 · ${TYPE_OPTS.find((o) => o.id === config.type)?.label}`}
        </span>
      </button>

      <div className="set-note" style={{ marginTop: 12 }}>
        시험 결과는 회독 진도에 영향을 주지 않아요. 틀린 단어는 끝나고 바로 복습할 수 있어요.
      </div>
    </>
  );
}

/* ── 문제 풀기 ── */

function QuizRun({ run, pool, settings, onRun, onQuit, onRetryWrong, onToast, onActivity, onWeakness, onAttempt, weak, onExit }) {
  const { questions, answers, index } = run;
  const q = questions[index];
  const done = index >= questions.length;

  const [typed, setTyped] = useState('');
  const [shownSub, setShownSub] = useState(false);
  /* 일본어를 고르는 문제에서 읽는 법을 열어 볼지.
     기본은 안 보여 준다 — 시험이 묻는 것은 표기고, 가나가 같이 떠 있으면
     한자를 못 읽어도 소리로 찍을 수 있다. 막히면 그때 연다. */
  const [shownOpt, setShownOpt] = useState(false);
  const inputRef = useRef(null);
  const hasKeyboard = useHasKeyboard();

  const byId = useMemo(() => new Map(pool.map((w) => [w.id, w])), [pool]);
  const word = q ? byId.get(q.wordId) : null;
  const answered = q ? answers[q.id] : null;

  /* 답을 낸 뒤 보기마다 읽기 · 뜻 · 듣기. 펼쳐 두면 맞혀도 자동으로 넘기지 않는다 —
     정답은 아는데 다른 보기를 보고 싶어 하는 게 바로 맞힌 때라서. */
  const [reviewOpen, setReviewOpen] = useReviewOpen();
  const optRows = useMemo(() => (answered && q?.type === QUIZ_TYPE.CHOICE
    ? reviewRows(q.options, q.options.map((o) => wordInfo({ kanji: o.jp, kana: o.jpKana, mean: o.mean })), {
      isCorrect: (i) => q.options[i].wordId === q.wordId,
      isMine: (i) => answered.value === q.options[i].wordId,
    })
    : []), [answered, q]);
  const holdForReview = reviewOpen && optRows.length >= 2;

  useEffect(() => {
    setTyped('');
    setShownSub(false);
    setShownOpt(false);
    if (q?.type === QUIZ_TYPE.TYPING) inputRef.current?.focus();
  }, [index, q?.type]);

  // 한자를 그대로 보내면 한 글자짜리 단어에서 음독이 나온다(「海」→ カイ).
  // 읽는 법인 가나를 보내야 외우려는 소리가 나온다.
  const speak = useCallback(() => {
    if (word) speakJapanese(word.kana || word.kanji, settings.speechRate);
  }, [word, settings.speechRate]);

  /* ★ 정답의 예문을 읽어 준다 ★
   *
   * 낱말 하나만 들으면 그 소리가 문장 안에서 어떻게 서는지를 모른다. 시험은
   * 낱말을 묻지만 시험장 밖에서 만나는 것은 문장이라, 답을 확인하는 자리에서
   * 한 번은 문장으로 들려준다.
   *
   * 예문에는 한자가 섞여 있다. 카나로 바꿔 둔 것(exampleKana)이 있으면 그걸
   * 보낸다 — 한자를 그대로 보내면 음독으로 읽히는 낱말이 있다. */
  const speakExample = useCallback(() => {
    if (!word?.example) return;
    speakJapanese(word.exampleKana || word.example, settings.speechRate);
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

  /* 답을 낸 뒤 예문을 한 번. 낱말을 먼저 읽고 조금 뒤에 문장을 읽는다 —
     바로 이어 붙이면 앞엣것이 잘린다(기기 음성은 부르는 족족 앞것을 끊는다). */
  const exampleFor = useRef(null);
  useEffect(() => {
    if (!settings.autoTTS || !answered || !word?.example) return;
    if (exampleFor.current === index) return;
    exampleFor.current = index;
    const t = setTimeout(speakExample, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, Boolean(answered)]);

  /* ★ 맞고 틀린 것을 약점 장부에 적는다 ★
   *
   * 회독 저장소는 안 건드린다 — 시험 때문에 복습 간격이 흔들리면 시험을
   * 마음 편히 못 본다. 그 판단은 그대로 두는데, 그 탓에 시험에서 열 번 틀린
   * 낱말이 「약점 0」이었다. 장부가 그 빈자리를 채운다(lib/weak.js).
   *
   * ★ 결과 화면이 아니라 문항마다 적는다 ★
   * 결과 화면에서 한 번에 적으면 점수와 딱 맞아떨어져서 처음엔 그게 맞아
   * 보였다. 그런데 스무 문항 중 열다섯을 풀고 나간 사람의 열다섯 문항이
   * 아무 데도 안 남는다 — 약점을 모으는 게 이 장부의 전부라 그게 제일 아깝다.
   *
   * 「거의 맞았어요」(close)는 아직 안 적는다. 사용자가 인정하면 정답이 되고
   * 안 하면 오답이라, 그 자리에서는 결론이 없다. 결론이 날 때 적는다.
   *
   * 한 문항은 한 번만 적는다(logged). 인정하기와 다음으로 넘기기가 같은
   * 문항을 두 번 부를 수 있다. */
  const logged = useRef(new Set());
  useEffect(() => { logged.current = new Set(); }, [questions]);

  const noteQuiz = useCallback((verdict, value) => {
    if (!q) return;
    if (verdict !== 'correct' && verdict !== 'wrong') return;
    if (logged.current.has(q.id)) return;
    logged.current.add(q.id);
    onWeakness?.([{
      id: q.wordId,
      kind: verdict === 'correct' ? WEAK_KIND.QUIZ_RIGHT : WEAK_KIND.QUIZ_WRONG,
    }]);
    onAttempt?.({ id: `word:${q.wordId}:${q.dir}`, source: 'word', ref: q.wordId, kind: q.dir === QUIZ_DIR.JP_KO ? '단어 뜻' : '단어 표기', prompt: q.prompt, correct: q.answer, accepted: q.dir === QUIZ_DIR.JP_KO ? meaningsOf(word) : acceptedJp(word), chosen: q.options?.find((o) => o.wordId === value)?.label || value, options: q.options?.map((o) => o.label), explanation: [word?.note, word?.example, word?.exampleKo].filter(Boolean).join(' · '), ok: verdict === 'correct' });
  }, [q, word, onWeakness, onAttempt]);

  const record = (verdict, value) => {
    if (answered) return;
    noteQuiz(verdict, value);
    onRun({ ...run, answers: { ...answers, [q.id]: { verdict, value } } });
  };

  const answerChoice = (option) => record(option.wordId === q.wordId ? 'correct' : 'wrong', option.wordId);

  const submitTyping = () => {
    if (answered || !word) return;
    record(checkTyping(word, q.dir, typed), typed);
  };

  const next = () => {
    // 인정하지 않고 넘어간 「거의 맞았어요」는 오답이다 — 점수도 그렇게 센다
    if (answered?.verdict === 'close') noteQuiz('wrong', answered.value);
    onRun({ ...run, index: index + 1 });
  };

  const { keyboard, takeControl } = useQuizHotkeys({
    options: !done ? q?.options : [], legacyNext: true,
    onChoose: (o) => { if (!answered) answerChoice(o); else { const text = o.jpKana || o.jp; if (text) speakJapanese(text, settings.speechRate); } },
    onNext: () => { if (done) onQuit(); else if (answered) next(); else if (q?.type === QUIZ_TYPE.TYPING) submitTyping(); },
    onSpeak: () => { if (!done && (answered || q?.dir === QUIZ_DIR.JP_KO)) speak(); }, onQuit,
  });

  /* 맞혔으면 버튼을 한 번 더 누르게 하지 않는다. 맞은 문제에서 더 볼 것도 없는데
   * 화면 아래 버튼까지 손을 내리는 게 스무 문제 내내 반복된다.
   * 다만 눈으로 확인할 틈은 준다 — 바로 넘기면 맞았는지도 모르고 지나간다.
   * 한→일 문제에서 답을 읽어 주는 중이면 그 소리가 끝날 때까지 기다린다. */
  useEffect(() => {
    if (!answered || answered.verdict !== 'correct' || holdForReview || keyboard) return undefined;
    const speaking = settings.autoTTS && q?.dir === QUIZ_DIR.KO_JP;
    const timer = setTimeout(next, speaking ? AUTO_NEXT_SPEAK_MS : AUTO_NEXT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, index, holdForReview, keyboard]);

  // 오타로 틀리는 건 실력이 아니다. 애매한 답은 내가 인정할 수 있게 둔다.
  const acceptClose = () => {
    noteQuiz('correct', answered.value);
    onRun({
      ...run,
      answers: { ...answers, [q.id]: { ...answers[q.id], verdict: 'correct' } },
    });
  };



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
        onActivity={onActivity}
        weak={weak}
        onExit={onExit}
      />
    );
  }

  const pct = Math.round((index / questions.length) * 100);
  const correct = Object.values(answers).filter((a) => a.verdict === 'correct').length;

  return (
    <>
      <KeyboardHelp />
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

      {/* 일본어를 고르는 문제에서 읽는 법을 열어 보는 길. 답을 내면 어차피
          보이니 그 전에만 둔다. */}
      {q.type === QUIZ_TYPE.CHOICE && q.dir === QUIZ_DIR.KO_JP && !answered && !shownOpt && (
        <button className="sc-peek qz-hint" onClick={() => setShownOpt(true)}>
          <IconEye /> 읽는 법 보기
        </button>
      )}

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
                  {/* ★ 읽는 법은 눌러야 나온다 ★
                      시험이 묻는 것은 표기다. 가나가 같이 떠 있으면 한자를 못
                      읽어도 소리로 찍을 수 있어서, 아는 것과 찍은 것이 안 갈린다.
                      답을 낸 뒤에는 확인하는 자리라 그냥 보여 준다. */}
                  {o.sub && (shownOpt || answered) && <span>{o.sub}</span>}
                  {/* 설명은 정답 보기 안에 붙인다. 아래에 따로 상자를 띄우면
                      그만큼 '다음 문제'가 화면 밖으로 밀려난다. */}
                  {/* ★ 정답 밑에 예문 — 맞혔을 때도 ★ 소리 버튼은 예문 글자 바로 옆에 붙는다
                      (예전엔 글자와 🔊가 따로 떨어져 있었다). */}
                  {answered && isAnswer && (answered.verdict !== 'correct' || word?.example) && (
                    <span className="qo-why">
                      {answered.verdict !== 'correct' && q.answerSub && q.answerSub !== o.label && <b>{q.answerSub}</b>}
                      {word?.example && (
                        <>
                          <span className="qw-jp">
                            {word.example}
                            <i
                              className="qo-replay"
                              role="button"
                              tabIndex={0}
                              aria-label="예문 듣기"
                              onClick={(e) => { e.stopPropagation(); speakExample(); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); speakExample(); } }}
                            >
                              <IconSpeaker />
                            </i>
                          </span>
                          <span className="qw-ko">{word.exampleKo}</span>
                        </>
                      )}
                    </span>
                  )}
                  {/* ★ 내가 고른 틀린 답은 무슨 낱말이었나 ★
                      「옮기다」를 골랐다는 것만 남으면 다음에 또 고른다. 헷갈린
                      둘을 나란히 놓고 봐야 갈린다. */}
                  {answered && isMine && !isAnswer && o.jp && o.jp !== o.label && (
                    <span className="qo-mine">
                      <b>{o.jp}</b>
                      {o.jpKana && o.jpKana !== o.jp && <i>{o.jpKana}</i>}
                    </span>
                  )}
                </span>
                {answered && isAnswer && (
                  <span className="qo-mark ok"><IconCheck /> 정답</span>
                )}
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
            onKeyDown={(e) => { if (e.key === 'Enter' && shortcutEvent(e)) { takeControl(); e.preventDefault(); answered ? next() : submitTyping(); } }}
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

      {/* 객관식은 정답 보기 안에서 설명하니 상자를 또 띄우지 않는다.
          주관식은 보기가 없어서 여기 말고는 설명할 자리가 없다. */}
      {answered && q.type !== QUIZ_TYPE.CHOICE && answered.verdict !== 'correct' && (
        <div className={`qverdict ${answered.verdict}`}>
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

      {/* 맞힌 문제는 알아서 넘어가므로 버튼을 내지 않는다 — 눌러야 할 게 없어야 빠르다.
          다만 보기 상세를 펼쳐 둔 때는 직접 넘긴다(읽고 들을 시간을 주려고). */}
      {answered && (answered.verdict !== 'correct' || holdForReview || keyboard) && (
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

      {/* ★ 정답은 아는데 다른 보기가 궁금할 때 ★ 답을 낸 뒤 보기마다 읽기 · 뜻 · 듣기.
          「다음 문제」 버튼 아래에 둔다 — 위에 두면 버튼이 화면 밖으로 밀려난다. */}
      {answered && q.type === QUIZ_TYPE.CHOICE && (
        <OptionReview idPrefix={`qz:${q.id}`} rate={settings.speechRate} rows={optRows} open={reviewOpen} onOpenChange={setReviewOpen} />
      )}
    </>
  );
}

/* ── 결과 ── */

function QuizResult({ questions, answers, byId, settings, onQuit, onRetryWrong, onToast, onActivity, weak, onExit }) {
  const result = useMemo(() => gradeQuiz(questions, answers), [questions, answers]);

  /* 시험도 회독 진도를 올리지 않는다. 다만 몇 문항 풀었는지는 활동에 남긴다 —
     안 남기면 스무 문항 풀고도 기록이 그대로다. 결과 화면에 들어올 때 한 번만. */
  const noted = useRef(false);
  useEffect(() => {
    if (noted.current) return;
    noted.current = true;
    onActivity?.({ quizzed: questions.length });
  }, [questions.length, onActivity]);
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

      {/* ★ 약점 퀴즈로 들어왔으면 말이 다르다 ★
          「다음 레벨로 넘어가 볼까요?」는 일반 시험의 말이다. 약점 퀴즈를 마친 사람에게는 오늘 몫이 얼마나
          찼는지, 맞힌 낱말이 약점에서 빠지는지가 궁금하다. */}
      {weak ? (
        <>
          <div className="card wk-result" data-done={weak.done} data-total={weak.total}>
            <b>{weak.complete ? '오늘 약점 퀴즈를 마쳤어요' : `오늘 약점 퀴즈 ${weak.done} / ${weak.total}`}</b>
            <span>
              {wrongWords.length === 0
                ? '약한 낱말을 다 맞혔어요. 맞힌 만큼 약점 장부에서 점수가 내려가요.'
                : '틀린 낱말은 약점 장부에 남아서 다음에 또 나와요.'}
            </span>
          </div>
          <button className="submit-btn wk-resultdone" style={{ marginTop: 12 }} onClick={onExit || onQuit}>약점 퀴즈 마치기</button>
        </>
      ) : (
        <>
          {wrongWords.length === 0 && (
            <div className="empty-state" style={{ marginTop: 16 }}>다 맞혔어요. 다음 레벨로 넘어가 볼까요?</div>
          )}
          <button className="ghost-btn" style={{ marginTop: 12 }} onClick={onQuit}>시험 설정으로</button>
        </>
      )}
    </>
  );
}
