import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { focusUnlessTyping, sheetOpen } from '../lib/focus.js';
import WordMemo from '../components/WordMemo.jsx';
import { avoidToday } from '../lib/dayflow.js';
import { IconCheck, IconFlame, IconSpeaker, IconX } from '../components/Icons.jsx';
import { speakJapanese, readingText } from '../lib/tts.js';
import { OptWrap, useReviewOpen } from '../components/OptionReview.jsx';
import { reviewRows, rowOf, speakText, textInfo } from '../lib/optionInfo.js';
import { useHasKeyboard } from '../lib/useHotkeys.js';
import { markBusy } from '../lib/busy.js';
import { goalOf, n3Included } from '../lib/goal.js';
import { useQuizHotkeys, shortcutEvent } from '../lib/useHotkeys.js';
import KeyboardHelp from '../components/KeyboardHelp.jsx';
import {
  KIND, KIND_LABEL, MIN_POOL, buildPool, judge, newSession, pickNext, poolCounts, questionFor,
  record, shouldRecord, summarize, verdictFor,
} from '../lib/stream.js';
import { otherWordNote } from '../lib/quiz.js';

/* 쭉 퀴즈 — 외운 것을 끊지 않고 이어서 묻는다.
 *
 * 규칙과 이유는 lib/stream.js 머리말에 있다. 여기는 그리는 일만 한다.
 *   · 외운 단어·한자·문법·문장이 섞여 나오고, 약한 것이 더 자주 나온다
 *   · 맞히면 「알아요」, 틀리면 「몰라요」가 복습 기록에 들어간다 — 첫 대답만
 *   · 「그만하기」를 누르면 평가가 나온다
 *
 * 한 판의 풀은 시작할 때 한 번 굳힌다. 답할 때마다 복습 기록이 바뀌는데 그때마다 풀을
 * 다시 짜면 방금 틀린 것의 무게가 판 안에서 이리저리 흔들린다 — 판 안의 적응은 session이 한다. */
const AUTO_NEXT_MS = 800;
const BATCH_KEY = 'jp_stream_batch';
const BATCH_CHOICES = [10, 20, 30, 0];   // 0 = 끝없이
const loadBatch = () => {
  try { const n = Number(localStorage.getItem(BATCH_KEY)); return BATCH_CHOICES.includes(n) && localStorage.getItem(BATCH_KEY) != null ? n : 20; } catch { return 20; }
};

export default function StreamQuiz({
  words, review, progress, settings, sentenceCards, onVerdicts, onActivity, onToast, onExit, onAttempt, onAnswered,
  /* 하루 흐름 — 쭉 퀴즈 오늘 몫(스무 문제)을 마치면 다음 단계를 바로 내민다. next = { label, go } */
  next = null, questDone = false, seenToday = null, onHome = null,
  /* 퀘스트 줄 · 하루 흐름으로 들어왔다 — 설정 화면(한 번에 몇 문제)을 건너뛰고 바로 첫 문제를 낸다 */
  autoStart = false,
}) {
  const goal = goalOf(settings);
  const [n3, setN3] = useState(null);
  const [phase, setPhase] = useState('intro');   // intro · run · sum
  const [session, setSession] = useState(newSession);
  const [cur, setCur] = useState(null);          // { item, q }
  const [answered, setAnswered] = useState(null); // { value, verdict, ok? }
  const [typed, setTyped] = useState('');
  /* 한 번에 풀 문제 수 — 정해 두지 않으면 20. 다 풀면 「계속하기 / 오늘은 여기까지」를 묻는다. 0이면 끝없이. */
  const [batch, setBatchState] = useState(loadBatch);
  const setBatch = (n) => { setBatchState(n); try { localStorage.setItem(BATCH_KEY, String(n)); } catch { /* 저장 못 해도 괜찮다 */ } };
  const [checkpoint, setCheckpoint] = useState(false);
  const lastCheck = useRef(0);
  const poolRef = useRef([]);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const timer = useRef(null);
  const inputRef = useRef(null);

  /* N3 코스 자료(한자·문법)는 크다. 이 화면을 열 때만 받는다. */
  useEffect(() => {
    let live = true;
    import('../lib/n3.js').then((m) => {
      if (live) setN3({ ids: { kanjiIds: m.TRACK_ITEM_IDS.kanji, grammarIds: m.TRACK_ITEM_IDS.grammar }, question: m.questionForCard });
    });
    return () => { live = false; };
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  /* 답을 낸 뒤 보기마다 읽기 · 뜻 · 듣기. 펼쳐 두면 맞혀도 자동으로 넘기지 않는다. */
  const [reviewOpen] = useReviewOpen();
  const curQ = cur?.q;
  const optRows = useMemo(() => (answered && curQ && curQ.mode === 'choice' && curQ.options?.length
    ? reviewRows(curQ.options, curQ.options.map((o) => o.info), {
      isCorrect: (i) => curQ.options[i].key === curQ.correct,
      isMine: (i) => curQ.options[i].key === answered.value,
    })
    : []), [answered, curQ]);
  const holdForReview = reviewOpen && optRows.length >= 2;
  useEffect(() => { markBusy('stream', phase === 'run'); return () => markBusy('stream', false); }, [phase]);

  useEffect(() => { if (phase === 'run' && cur?.q.mode === 'typing' && !answered) focusUnlessTyping(inputRef.current); }, [phase, cur, answered]);

  const wordById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const sentenceById = useMemo(() => new Map(sentenceCards.map((s) => [s.id, s])), [sentenceCards]);
  const ledger = progress?.weak || null;

  const liveAll = useMemo(() => (n3
    ? buildPool({ words, sentences: sentenceCards, n3: n3.ids, review, ledger, goal })
    : null), [n3, words, sentenceCards, review, ledger, goal]);
  /* 오늘 복습 · 약점 퀴즈에서 이미 본 것은 뺀다 — 한 바퀴가 같은 낱말의 반복이 되지 않게(남는 게 적으면 그대로) */
  const live = useMemo(() => (liveAll ? avoidToday(liveAll, seenToday, MIN_POOL) : null), [liveAll, seenToday]);

  const ctx = useMemo(() => ({
    wordById, wordPool: words, sentenceById, sentencePool: sentenceCards, n3Question: n3?.question,
  }), [wordById, words, sentenceById, sentenceCards, n3]);

  /* 다음 문제. 문제를 못 만드는 항목(자료가 없어졌거나 보기를 못 채움)은 이 판의 풀에서 뺀다. */
  const nextQuestion = useCallback((sess) => {
    for (let guard = 0; guard < 30; guard += 1) {
      const item = pickNext(poolRef.current, sess);
      if (!item) return null;
      const q = questionFor(item, ctx);
      if (q) return { item, q };
      poolRef.current = poolRef.current.filter((it) => it.id !== item.id);
    }
    return null;
  }, [ctx]);

  const start = () => {
    poolRef.current = live || [];
    const fresh = newSession();
    setSession(fresh);
    const first = nextQuestion(fresh);
    if (!first) { onToast?.('낼 수 있는 문제가 없어요'); return; }
    lastCheck.current = 0; setCheckpoint(false);
    questShown.current = questDone;   // 이미 오늘 몫을 마치고 다시 들어온 판은 끊지 않는다
    setCur(first); setAnswered(null); setTyped(''); setPhase('run');
  };

  /* ★ 퀘스트로 들어왔으면 바로 시작한다 ★ 자료가 준비되는 대로 한 번만. 풀 문제가 모자라면(MIN_POOL) 소개 화면에 남아
     왜 안 열리는지 알려 준다. 그만하고 다시 소개로 돌아왔을 때 또 저절로 시작하지는 않는다. */
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || phase !== 'intro' || !live || live.length < MIN_POOL) return;
    autoStarted.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, phase, live]);

  /* 한 묶음(기본 20문제)을 다 풀었으면 다음 문제 대신 멈춰서 묻는다 */
  const goNext = useCallback(() => {
    const nxt = nextQuestion(sessionRef.current);
    if (!nxt) { setPhase('sum'); return; }
    setCheckpoint(false);
    setCur(nxt); setAnswered(null); setTyped('');
  }, [nextQuestion]);

  /* ★ 오늘 몫(스무 문제)을 이 판에서 채웠으면 그 자리에서 멈춰 「다음: ○○」를 내민다 ★
     전에는 한 묶음이 끝나야만 물었다. 앞서 몇 문제 풀어 둔 날이나, 한 번에 30문제 · 끝없이로 둔 사람은
     퀘스트를 마치고도 다음 단계가 안 나와서 하루 흐름이 여기서 끊겼다. */
  const questShown = useRef(questDone);
  const advance = useCallback(() => {
    clearTimeout(timer.current);
    const n = sessionRef.current.log.length;
    if (questDone && next && !questShown.current && n > 0) {
      questShown.current = true; lastCheck.current = n; setCheckpoint(true); return;
    }
    if (batch > 0 && n > 0 && n % batch === 0 && lastCheck.current !== n) {
      lastCheck.current = n; setCheckpoint(true); return;
    }
    goNext();
  }, [goNext, batch, questDone, next]);

  const { keyboard, takeControl } = useQuizHotkeys({
    options: phase === 'run' && !checkpoint ? cur?.q.options : [], onChoose: (o) => { if (!answered) answer(o.key); else { const text = speakText(o.info || textInfo(o.label)); if (text) speak(text); } }, legacyNext: true,
    onNext: () => {
      if (phase === 'intro') { if (live?.length >= MIN_POOL) start(); }
      /* 끝 화면 · 중간 멈춤의 Enter는 가장 큰 단추와 같은 일을 한다 — 오늘 몫을 마쳤으면 다음 단계로 간다 */
      else if (phase === 'sum') { if (questDone && next) next.go(); else onExit?.(); }
      else if (checkpoint) { if (questDone && next) next.go(); else goNext(); }
      else if (answered?.verdict === 'close') settleClose(false);
      else if (answered) advance();
      else if (cur?.q.mode === 'typing' && typed.trim()) answer(typed);
    },
    onSpeak: () => { if (phase === 'run' && cur?.q.speak && (cur.q.promptJp || answered)) speak(cur.q.speak); },
    onQuit: () => { clearTimeout(timer.current); if (phase === 'run') setPhase('sum'); else onExit?.(); },
  });

  /* 대답이 확정됐다 — 판에 적고, 첫 대답이면 복습 기록에도 넣는다 */
  const finalize = (ok, value, extra = {}) => {
    const { item, q } = cur;
    if (shouldRecord(sessionRef.current, item.id)) onVerdicts?.({ [item.id]: verdictFor(ok) });
    onAttempt?.({ id: `stream:${item.id}:${q.dir || q.kind}`, source: 'stream', ref: item.id, kind: KIND_LABEL[q.kind] || q.kind, prompt: q.prompt, correct: q.answerText, chosen: q.options?.find((o) => o.key === value)?.label || (value ?? '잘 모르겠어요'), options: q.options?.map((o) => o.label), explanation: [extra.why, q.explain].filter(Boolean).join(' '), ok });
    onActivity?.({ quizzed: 1 });
    /* 오늘의 퀘스트(쭉 퀴즈 열 문제)가 센다 */
    onAnswered?.();
    setSession((s) => record(s, item, ok));
    setAnswered({ value, ok, verdict: ok ? 'correct' : 'wrong', ...extra });
  };

  /* 맞히면 잠깐 보여 주고 알아서 넘어간다. 보기 상세를 펼쳐 둔 때는 직접 넘긴다. */
  useEffect(() => {
    if (phase !== 'run' || checkpoint || !answered || answered.verdict !== 'correct' || holdForReview || keyboard) return undefined;
    timer.current = setTimeout(() => { if (!sheetOpen()) advance(); }, AUTO_NEXT_MS);   // 곤에게 묻는 창이 열려 있으면 저절로 안 넘긴다
    return () => clearTimeout(timer.current);
  }, [phase, checkpoint, answered, holdForReview, advance, keyboard]);

  const answer = (input) => {
    if (answered || !cur) return;
    /* 뜻을 묻는 직접 입력 문제에 문제 글자를 그대로 쳐서 낸 것은 오답이 아니다 — 채점하지 않고 무엇을 쓰는 칸인지 알려 준다 */
    if (cur.q.mode === 'typing' && cur.q.promptJp && typeof input === 'string'
      && input.trim() && [cur.q.prompt, cur.q.sub, cur.q.speak].some((t) => t && String(t).trim() === input.trim())) {
      onToast?.('이 문제는 뜻을 한국어로 쓰는 칸이에요');
      return;
    }
    const res = judge(cur.q, input);
    if (res.verdict === 'close') { setAnswered({ value: input, verdict: 'close', ok: null }); return; }
    /* 한→일 직접 쓰기에서 다른 낱말을 쳤으면 그 낱말의 뜻을 같이 알려 준다 */
    const why = res.why || (res.verdict === 'wrong' && !cur.q.promptJp && cur.q.word ? otherWordNote(words, input, cur.q.word) : null);
    finalize(res.verdict === 'correct', input, { why: why || undefined, expected: res.expected });
  };

  /* ★ 잘 모르겠어요 ★ 찍어서 맞히면 모르는 것이 아는 것으로 세어져 복습 간격이 틀어진다.
     모르면 이걸 눌러 「몰라요」로 남기고 정답을 본다. */
  const dunno = () => {
    if (answered || !cur) return;
    finalize(false, null, { dunno: true, expected: cur.q.answerText });
  };

  /* 한 글자 오타(close)는 내가 정한다 */
  const settleClose = (ok) => finalize(ok, answered.value, { closed: true });

  const speak = (text) => speakJapanese(text, settings?.speechRate);

  /* ★ 자동 읽기(설정의 「자동 읽기」) — 단어 시험과 같은 규칙 ★
     일→한 문제는 문제 글자를 읽어 주는 거라 바로 읽어도 답이 새지 않는다.
     한→일(문제가 한국어)은 정답이 소리로 새니 답을 낸 뒤에만 읽는다. 한 문항에서 한 번만 읽는다. */
  const spokenFor = useRef(null);
  useEffect(() => {
    if (!settings?.autoTTS || phase !== 'run' || checkpoint || !cur?.q?.speak) return;
    if (!cur.q.promptJp && !answered) return;
    if (spokenFor.current === cur) return;
    spokenFor.current = cur;
    speak(cur.q.speak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, Boolean(answered), phase, checkpoint]);
  /* 답을 낸 뒤 예문을 한 번 — 낱말을 먼저 읽고 조금 뒤에 문장을 읽는다(기기 음성은 앞것을 끊는다) */
  const exampleFor = useRef(null);
  useEffect(() => {
    if (!settings?.autoTTS || !answered || !cur?.q?.exJp) return;
    if (exampleFor.current === cur) return;
    exampleFor.current = cur;
    const t = setTimeout(() => speak(readingText(cur.q.exKana, cur.q.exJp)), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, Boolean(answered)]);

  const hasKeyboard = useHasKeyboard();

  /* ── 맛보기: 아직 외운 게 없을 때 ── */
  const counts = live ? poolCounts(live) : null;

  if (phase === 'intro') {
    return (
      <div className="stream st-intro">
        <KeyboardHelp />
        <div className="card st-card">
          <div className="st-goal">목표 <b>{goal}</b></div>
          <div className="set-title">외운 것을 쭉 풀어 봐요</div>
          <p className="set-note st-lead">
            단어, 한자, 문법, 문장이 섞여 나와요. 약한 것이 더 자주 나오고, 맞히면 복습 간격이 늘고
            틀리면 오늘 복습에 올라가요. 그만하고 싶을 때 「그만하기」를 누르면 평가가 나와요.
          </p>
          {!live && <div className="empty-state">자료를 불러오고 있어요</div>}
          {live && (
            <div className="st-counts" aria-label="출제 범위">
              {Object.values(KIND).map((k) => (
                <span key={k} className="st-count" data-kind={k}><b>{counts[k]}</b><small>{KIND_LABEL[k]}</small></span>
              ))}
            </div>
          )}
          {live && counts.kanji === 0 && counts.grammar === 0 && n3Included(goal) && (
            <p className="set-note st-n3hint">한자와 문법은 「N3 학습하기」에서 배우면 쭉 퀴즈에도 나와요.</p>
          )}
          <div className="st-batch" role="group" aria-label="한 번에 풀 문제 수">
            <span className="st-batch-lab">한 번에</span>
            {BATCH_CHOICES.map((n) => (
              <button key={n} type="button" data-n={n} className={`chip${batch === n ? ' active' : ''}`} onClick={() => setBatch(n)}>
                {n ? `${n}문제` : '끝없이'}
              </button>
            ))}
          </div>
          {live && live.length < MIN_POOL && (
            <p className="set-note st-few">
              단어 {MIN_POOL - live.length}개만 더 배우면 열려요. 지금 외운 것은 {live.length}개예요.
              오늘 화면의 「오늘 학습 시작」에서 새 카드를 배우고 다시 오세요.
            </p>
          )}
          <button className="submit-btn st-start" onClick={start} disabled={!live || live.length < MIN_POOL}>
            쭉 풀기 시작
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'sum') {
    return <StreamSummary session={session} goal={goal} wordById={wordById} sentenceById={sentenceById}
      onAgain={start} onExit={onExit} onHome={questDone && next ? onHome : null} next={questDone ? next : null} hasKeyboard={hasKeyboard} />;
  }

  const { q } = cur;
  const total = session.log.length;
  const right = session.log.filter((e) => e.ok).length;
  /* 진행 현황 — 지금 몇 번째 / 한 묶음 몇 개. 맞힌 개수는 오른쪽에 따로 둔다(점수가 아니라 진행이 먼저 보여야 한다).
     묶음을 이어서 풀면 다시 1부터 센다. 끝없이(0)는 몇 번째인지만 보인다. */
  /* 「거의 맞았어요」는 받아들일지 정하기 전이라 아직 기록에 없다 — 그때 한 칸 덜 세면 첫 문제가 「0 / 20」으로 보인다 */
  const idx = answered && answered.verdict !== 'close' ? total : total + 1;
  const pos = batch > 0 ? ((idx - 1) % batch) + 1 : idx;

  /* ── 한 묶음을 다 풀었다: 계속할지, 오늘은 여기까지 할지 ── */
  if (checkpoint) {
    return (
      <div className="stream st-checkpoint" data-total={total}>
        <div className="card st-card">
          <div className="st-goal">{total}문제를 풀었어요</div>
          <div className="set-title">{questDone && next ? '오늘 쭉 퀴즈를 마쳤어요' : '여기서 어떻게 할까요?'}</div>
          <p className="set-note st-lead">
            맞힌 것 <b>{right}</b> / {total}{session.streak >= 3 ? ` · 연속 ${session.streak}` : ''}.
            더 풀면 같은 판에서 이어져요. 오늘은 여기까지 하면 지금까지의 평가가 나와요.
          </p>
          {questDone && next && <button className="submit-btn st-next" onClick={next.go}>다음: {next.label}{hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>}
          <button className={`${questDone && next ? 'ghost-btn' : 'submit-btn'} st-continue`} onClick={goNext}>계속하기{!(questDone && next) && hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>
          <button className="ghost-btn st-enough" onClick={() => { setCheckpoint(false); setPhase('sum'); }}>오늘은 여기까지</button>
          {questDone && next && onHome && <button className="ghost-btn st-home" onClick={onHome}>홈으로</button>}
        </div>
      </div>
    );
  }
  const isTyping = q.mode === 'typing';

  return (
    <div className="stream st-run" data-kind={q.kind} data-id={cur.item.id} data-mode={q.mode}>
      <KeyboardHelp />
      <div className="st-head">
        <span className="st-score" aria-label="진행 현황"><b>{pos}</b>{batch > 0 ? <> / {batch}</> : '번째'}</span>
        <span className="st-right" aria-label="맞힌 개수">맞힘 <b>{right}</b></span>
        <span className={`st-streak${session.streak >= 3 ? ' hot' : ''}`} aria-label="연속 정답">
          <IconFlame />{session.streak}
        </span>
        <button className="ghost-btn st-stop" onClick={() => setPhase('sum')}>그만하기</button>
      </div>

      <div className="quizcard st-q">
        {!answered && (
          <button type="button" className="ghost-btn st-dunno qc-dunno" onClick={dunno} aria-label="잘 모르겠어요, 몰라요로 남기기">잘 모르겠어요</button>
        )}
        <div className="qc-tag"><span className="st-kind" data-kind={q.kind}>{KIND_LABEL[q.kind]}</span> {q.tag}</div>
        <div className={`qc-prompt${q.promptJp ? '' : ' ko'}`} lang={q.promptJp ? 'ja' : 'ko'}>{q.prompt}</div>
        {q.sub && (answered || q.kind === KIND.KANJI) && <div className="qc-sub">{q.sub}</div>}
        {q.speak && (q.promptJp || answered) && (
          <button className="qc-speak" onClick={() => speak(q.speak)} aria-label="발음 듣기"><IconSpeaker />{hasKeyboard && <kbd className="corner-key">Space</kbd>}</button>
        )}
      </div>

      {/* 외우는 법 메모 — 낱말 문제에서만, 기본은 접혀 있다 */}
      {q.word?.id && <WordMemo key={`${q.id}:${q.word.id}`} id={q.word.id} />}

      {!isTyping ? (
        <div className="qoptions">
          {q.options.map((o, i) => {
            let cls = 'qopt st-opt';
            if (answered) {
              if (o.key === q.correct) cls += ' correct';
              else if (o.key === answered.value) cls += ' wrong';
              else cls += ' dim';
            }
            return (
              <OptWrap key={`${o.key}-${i}`} row={rowOf(optRows, i)} label={`${o.label} ${o.sub || ''}`} show={Boolean(answered)}
                rate={settings?.speechRate} id={`st:${q.id}:${i}`}>
              {(aside) => (
              <button className={cls} disabled={Boolean(answered)} onClick={() => answer(o.key)}>
                <span className="qo-num">{hasKeyboard ? <kbd>{i + 1}</kbd> : i + 1}</span>
                <span className="qo-body">
                  <b lang={q.promptJp ? 'ko' : 'ja'}>{o.label}</b>
                  {answered && o.sub && <span>{o.sub}</span>}
                  {answered && q.why?.[o.key] && o.key !== q.correct && <span className="qo-why">{q.why[o.key]}</span>}
                </span>
                {aside}
                {answered && o.key === q.correct && <span className="qo-mark ok"><IconCheck /></span>}
              </button>
              )}
              </OptWrap>
            );
          })}
        </div>
      ) : (
        <div className="qtyping">
          <input
            ref={inputRef}
            className="search-input st-input"
            value={answered ? (answered.value ?? '') : typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && shortcutEvent(e)) { takeControl(); e.preventDefault(); if (!answered && typed.trim()) answer(typed); } }}
            placeholder={q.promptJp ? '뜻을 한국어로' : '일본어로 (한자 또는 히라가나)'}
            disabled={Boolean(answered)}
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          {!answered && <button className="submit-btn st-submit" onClick={() => answer(typed)} disabled={!typed.trim()}>제출</button>}
        </div>
      )}

      {answered?.verdict === 'close' && (
        <div className="qverdict close st-close">
          거의 맞았어요. 정답은 <b>{q.answerText}</b>{q.answerSub && q.answerSub !== q.answerText ? ` (${q.answerSub})` : ''}
          <div className="qnext">
            <button className="ghost-btn st-accept" onClick={() => settleClose(true)}>맞게 처리하기</button>
            <button className="submit-btn st-reject" onClick={() => settleClose(false)}>틀렸어요</button>
          </div>
        </div>
      )}

      {answered && answered.verdict === 'correct' && (holdForReview || keyboard) && (
        <div className="qnext">
          <button className="submit-btn st-next" onClick={advance}>다음 문제{hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>
        </div>
      )}

      {answered && answered.verdict === 'wrong' && (
        <>
          {(isTyping || q.explain) && (
            <div className="qverdict wrong st-explain">
              <IconX /> 정답은 <b>{q.answerText}</b>{q.answerSub && q.answerSub !== q.answerText ? ` (${q.answerSub})` : ''}
              {answered.why && <div className="qv-ex"><span>{answered.why}</span></div>}
              {q.exJp
                ? (
                  <div className="qv-ex">
                    <span lang="ja">{q.exJp}</span>
                    {q.exKana && <span className="ex-kana" lang="ja">{q.exKana}</span>}
                    {q.exKo && <span className="ex-ko">{q.exKo}</span>}
                  </div>
                )
                : q.explain && <div className="qv-ex"><span>{q.explain}</span></div>}
            </div>
          )}
          <div className="qnext">
            <button className="submit-btn st-next" onClick={advance}>다음 문제{hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>
          </div>
        </>
      )}

    </div>
  );
}

/* ── 평가 ── */
function labelOf(id, wordById, sentenceById) {
  const w = wordById.get(id);
  if (w) return { main: w.kanji, sub: `${w.kana !== w.kanji ? `${w.kana} · ` : ''}${w.mean}` };
  const s = sentenceById.get(id);
  if (s) return { main: s.kanji, sub: s.mean };
  if (id.startsWith('k:') && !/^k:\d+$/.test(id)) return { main: id.slice(2), sub: '한자' };
  return { main: id, sub: '문법' };
}

function StreamSummary({ session, goal, wordById, sentenceById, onAgain, onExit, onHome = null, next = null, hasKeyboard = false }) {
  const r = useMemo(() => summarize(session.log), [session.log]);
  const tone = r.pct >= 90 ? 'great' : r.pct >= 70 ? 'good' : r.pct >= 50 ? 'okay' : 'weak';
  if (r.total === 0) {
    return (
      <div className="stream st-sum">
        <div className="empty-state">푼 문제가 없어요</div>
        <div className="qnext"><button className="submit-btn" onClick={onExit}>나가기</button></div>
      </div>
    );
  }
  return (
    <div className="stream st-sum">
      <div className={`quizscore ${tone}`}>
        <div className="qs-num">{r.pct}<small>%</small></div>
        <div className="qs-label">{r.right} / {r.total} 맞혔어요</div>
        <div className="qs-sub">가장 길게 이은 연속 정답 {session.best}개 · 목표 {goal}</div>
      </div>

      <div className="section-label">종류별</div>
      <div className="card st-kinds">
        {Object.entries(r.byKind).map(([k, v]) => (
          <div key={k} className="st-kindrow" data-kind={k}>
            <span className="st-kn">{KIND_LABEL[k]}</span>
            <span className="st-kbar"><i style={{ width: `${v.pct}%` }} /></span>
            <b>{v.right}/{v.total}</b>
          </div>
        ))}
      </div>

      {r.missed.length > 0 ? (
        <>
          <div className="section-label">다시 볼 것 {r.missed.length}개</div>
          <div className="card qwronglist st-missed">
            {r.missed.slice(0, 12).map(({ id, n }) => {
              const l = labelOf(id, wordById, sentenceById);
              return (
                <div key={id} className="qwrow" data-id={id}>
                  <div className="qw-body"><b lang="ja">{l.main}</b><span>{l.sub}{n > 1 ? ` · ${n}번 틀림` : ''}</span></div>
                </div>
              );
            })}
          </div>
          <p className="set-note">틀린 것은 오늘 복습에 올라가요. 복습일에 맞히면 기억 단계가 올라요.</p>
        </>
      ) : <p className="set-note">하나도 안 틀렸어요. 맞힌 것은 복습 간격이 늘어나요.</p>}

      <div className="qnext">
        {next && <button className="submit-btn st-next" onClick={next.go}>다음: {next.label}{hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>}
        <button className={`${next ? 'ghost-btn' : 'submit-btn'} st-again`} onClick={onAgain}>계속 풀기</button>
        {onHome
          ? <button className="ghost-btn st-home" onClick={onHome}>홈으로</button>
          : <button className="ghost-btn st-exit" onClick={onExit}>나가기{!next && hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>}
      </div>
    </div>
  );
}
