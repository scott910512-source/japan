import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconFlame, IconSpeaker, IconX } from '../components/Icons.jsx';
import { speakJapanese } from '../lib/tts.js';
import { markBusy } from '../lib/busy.js';
import { goalOf } from '../lib/goal.js';
import {
  KIND, KIND_LABEL, MIN_POOL, buildPool, judge, newSession, pickNext, poolCounts, questionFor,
  record, shouldRecord, summarize, verdictFor,
} from '../lib/stream.js';

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

export default function StreamQuiz({
  words, review, progress, settings, sentenceCards, onVerdicts, onActivity, onToast, onExit,
}) {
  const goal = goalOf(settings);
  const [n3, setN3] = useState(null);
  const [phase, setPhase] = useState('intro');   // intro · run · sum
  const [session, setSession] = useState(newSession);
  const [cur, setCur] = useState(null);          // { item, q }
  const [answered, setAnswered] = useState(null); // { value, verdict, ok? }
  const [typed, setTyped] = useState('');
  const poolRef = useRef([]);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const timer = useRef(null);

  /* N3 코스 자료(한자·문법)는 크다. 이 화면을 열 때만 받는다. */
  useEffect(() => {
    let live = true;
    import('../lib/n3.js').then((m) => {
      if (live) setN3({ ids: { kanjiIds: m.TRACK_ITEM_IDS.kanji, grammarIds: m.TRACK_ITEM_IDS.grammar }, question: m.questionForCard });
    });
    return () => { live = false; };
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { markBusy('stream', phase === 'run'); return () => markBusy('stream', false); }, [phase]);

  const wordById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const sentenceById = useMemo(() => new Map(sentenceCards.map((s) => [s.id, s])), [sentenceCards]);
  const ledger = progress?.weak || null;

  const live = useMemo(() => (n3
    ? buildPool({ words, sentences: sentenceCards, n3: n3.ids, review, ledger, goal })
    : null), [n3, words, sentenceCards, review, ledger, goal]);

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
    setCur(first); setAnswered(null); setTyped(''); setPhase('run');
  };

  const advance = useCallback(() => {
    clearTimeout(timer.current);
    const nxt = nextQuestion(sessionRef.current);
    if (!nxt) { setPhase('sum'); return; }
    setCur(nxt); setAnswered(null); setTyped('');
  }, [nextQuestion]);

  /* 대답이 확정됐다 — 판에 적고, 첫 대답이면 복습 기록에도 넣는다 */
  const finalize = (ok, value, extra = {}) => {
    const { item } = cur;
    if (shouldRecord(sessionRef.current, item.id)) onVerdicts?.({ [item.id]: verdictFor(ok) });
    onActivity?.({ quizzed: 1 });
    setSession((s) => record(s, item, ok));
    setAnswered({ value, ok, verdict: ok ? 'correct' : 'wrong', ...extra });
    if (ok) timer.current = setTimeout(advance, AUTO_NEXT_MS);
  };

  const answer = (input) => {
    if (answered || !cur) return;
    const res = judge(cur.q, input);
    if (res.verdict === 'close') { setAnswered({ value: input, verdict: 'close', ok: null }); return; }
    finalize(res.verdict === 'correct', input, { why: res.why, expected: res.expected });
  };

  /* 한 글자 오타(close)는 내가 정한다 */
  const settleClose = (ok) => finalize(ok, answered.value, { closed: true });

  const speak = (text) => speakJapanese(text, settings?.speechRate);

  /* ── 맛보기: 아직 외운 게 없을 때 ── */
  const counts = live ? poolCounts(live) : null;

  if (phase === 'intro') {
    return (
      <div className="stream st-intro">
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
          {live && live.length < MIN_POOL && (
            <p className="set-note st-few">
              아직 외운 것이 적어요({live.length}개). 오늘 화면에서 먼저 배우고 오면 문제가 나와요.
              목표 {goal} 안의 것만 나오니, 설정에서 목표를 바꿔 볼 수도 있어요.
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
      onAgain={start} onExit={onExit} />;
  }

  const { q } = cur;
  const total = session.log.length;
  const right = session.log.filter((e) => e.ok).length;
  const isTyping = q.mode === 'typing';

  return (
    <div className="stream st-run" data-kind={q.kind} data-id={cur.item.id} data-mode={q.mode}>
      <div className="st-head">
        <span className="st-score" aria-label="맞힌 개수"><b>{right}</b> / {total}</span>
        <span className={`st-streak${session.streak >= 3 ? ' hot' : ''}`} aria-label="연속 정답">
          <IconFlame />{session.streak}
        </span>
        <button className="ghost-btn st-stop" onClick={() => setPhase('sum')}>그만하기</button>
      </div>

      <div className="quizcard st-q">
        <div className="qc-tag"><span className="st-kind" data-kind={q.kind}>{KIND_LABEL[q.kind]}</span> {q.tag}</div>
        <div className={`qc-prompt${q.promptJp ? '' : ' ko'}`} lang={q.promptJp ? 'ja' : 'ko'}>{q.prompt}</div>
        {q.sub && (answered || q.kind === KIND.KANJI) && <div className="qc-sub">{q.sub}</div>}
        {q.speak && (q.promptJp || answered) && (
          <button className="qc-speak" onClick={() => speak(q.speak)} aria-label="발음 듣기"><IconSpeaker /></button>
        )}
      </div>

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
              <button key={`${o.key}-${i}`} className={cls} disabled={Boolean(answered)} onClick={() => answer(o.key)}>
                <span className="qo-num">{i + 1}</span>
                <span className="qo-body">
                  <b lang={q.promptJp ? 'ko' : 'ja'}>{o.label}</b>
                  {answered && o.sub && <span>{o.sub}</span>}
                  {answered && q.why?.[o.key] && o.key !== q.correct && <span className="qo-why">{q.why[o.key]}</span>}
                </span>
                {answered && o.key === q.correct && <span className="qo-mark ok"><IconCheck /></span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="qtyping">
          <input
            className="search-input st-input"
            value={answered ? answered.value : typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (answered?.verdict === 'wrong') advance(); else if (!answered) answer(typed); } }}
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

      {answered && answered.verdict === 'wrong' && (
        <>
          {(isTyping || q.explain) && (
            <div className="qverdict wrong st-explain">
              <IconX /> 정답은 <b>{q.answerText}</b>{q.answerSub && q.answerSub !== q.answerText ? ` (${q.answerSub})` : ''}
              {answered.why && <div className="qv-ex"><span>{answered.why}</span></div>}
              {q.explain && <div className="qv-ex"><span>{q.explain}</span></div>}
            </div>
          )}
          <div className="qnext">
            <button className="submit-btn st-next" onClick={advance}>다음 문제</button>
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

function StreamSummary({ session, goal, wordById, sentenceById, onAgain, onExit }) {
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
        <button className="submit-btn st-again" onClick={onAgain}>계속 풀기</button>
        <button className="ghost-btn st-exit" onClick={onExit}>나가기</button>
      </div>
    </div>
  );
}
