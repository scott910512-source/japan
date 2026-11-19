import { useEffect, useMemo, useRef, useState } from 'react';
import HunterTutor from '../components/HunterTutor.jsx';
import KeyboardHelp from '../components/KeyboardHelp.jsx';
import RomajiHint from '../components/RomajiHint.jsx';
import { useQuizHotkeys, shortcutEvent } from '../lib/useHotkeys.js';
import { speakJapanese, stopSpeaking } from '../lib/tts.js';
import { todayKey } from '../lib/review.js';
import {
  readRun, writeRun, GRAMMAR_USE_BY_ID, DIAG_SIZE, FOLLOW_SIZE, PRACTICE_SIZE, TIER_LABEL, buildSet, judge, nextStage, outcomeOf, stageScore, statusOf, recommend, modeOf,
} from '../lib/grammarUse.js';
import '../styles/grammar-use.css';

/* ★ 외운 단어로 문법 활용 ★ — 오늘의 퀘스트 · 문법 메뉴(활용 탭) · 오답노트 「다시 학습」이 모두 이 화면을 연다.
 *
 * 세트는 시작할 때 문제를 다 정하고(lib/grammarUse.js buildSet) 이 기기에 적어 둔다 — 새로고침 · 재접속해도
 * 같은 문제, 같은 제출 상태에서 이어진다. 기록(통과 · 약점 · 오늘 퀘스트)은 세트를 마칠 때 한 번만 넘긴다.
 * 진단 중에는 규칙표 · 완성 문장 · 정답 소리를 안 보인다 — 답을 낸 뒤의 해설과 설명 단계에서만. */
const MODE_TITLE = { place: '초기 진단', explore: '탐색 테스트', repeat: '문법 확인' };
const KIND_LABEL = { choice: '알맞은 것 고르기', type: '빈칸에 직접 쓰기', order: '순서대로 문장 만들기', pick: '상황에 맞는 문장 고르기' };

export default function GrammarUse({
  words, review, progress, gid = null, settings = {}, onRecord, onAttempt, onWordForgot, onToast,
  next = null, onHome = null, onExit = null, onNeedWords = null, embedded = false,
}) {
  const today = todayKey();
  const gu = progress?.grammarUse || null;
  const rate = settings?.speechRate;
  /* 같은 날 · 같은 대상(퀘스트면 시기, 메뉴면 그 문법)의 세트가 있으면 이어서 */
  const [run, setRun] = useState(() => {
    const kept = readRun();
    const want = gid ? `repeat:${gid}` : modeOf(gu);
    if (kept && !kept.closed && (kept.want === want || (!gid && kept.quest))) return kept;
    return null;
  });
  const [input, setInput] = useState('');
  const [romaji, setRomaji] = useState(null);
  const [placed, setPlaced] = useState([]);
  const [showWords, setShowWords] = useState(false);
  const scope = useRef(null);

  const start = (opts = {}) => {
    const target = opts.gid ?? gid;
    const set = buildSet({ words, review, gu, today, gid: target, nonce: opts.nonce || '' });
    const r = { ...set, want: target ? `repeat:${target}` : modeOf(gu), quest: !target || Boolean(opts.quest), phase: set.empty ? 'empty' : 'intro' };
    setRun(r); writeRun(set.empty ? null : r);
    setInput(''); setPlaced([]); setShowWords(false); setRomaji(null);
  };
  useEffect(() => { if (!run) start({ quest: !gid }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const save = (r) => { setRun(r); writeRun(r); };

  const stage = run?.stages?.[run.stage];
  const q = stage?.qs?.[run.at];
  const ans = stage?.answers?.[run.at];
  const g = run?.gid ? GRAMMAR_USE_BY_ID[run.gid] : null;
  const orderLeft = useMemo(() => {
    if (q?.kind !== 'order') return [];
    const used = [...placed]; return q.pieces.map((p, i) => ({ p, i })).filter(({ i }) => !used.includes(i));
  }, [q, placed]);

  useEffect(() => { setInput(''); setPlaced([]); setShowWords(false); setRomaji(null); stopSpeaking(); }, [run?.stage, run?.at]);

  /* 한 문제 답 — 기록은 오답노트 줄(문항 단위)로 바로, 문법 통과는 세트 끝에 한 번 */
  const submit = (value) => {
    if (!q || ans) return;
    if (q.kind === 'type') {
      if (!String(value || '').trim()) return;
      if (/^[A-Za-z\s'-]+$/.test(String(value).trim())) { setRomaji(String(value)); return; }
    }
    if (q.kind === 'order' && (!Array.isArray(value) || value.length < q.pieces.length)) return;
    const shown = q.kind === 'order' ? value.map((i) => q.pieces[i]).join('') : String(value);
    const ok = judge(q, q.kind === 'order' ? value.map((i) => q.pieces[i]) : value);
    const a = { ok, picked: shown, first: true, wordHelp: Boolean(showWords), at: Date.now() };
    const answers = [...stage.answers]; answers[run.at] = a;
    const stages = run.stages.map((s, i) => (i === run.stage ? { ...s, answers } : s));
    save({ ...run, stages });
    const cause = ok ? null : (q.cause || 'grammar');
    onAttempt?.({
      id: `grammaruse:${q.gid}:${q.qid}`, source: 'grammaruse', ref: `gu:${q.gid}`, kind: `문법 활용 · ${GRAMMAR_USE_BY_ID[q.gid].short}`,
      prompt: q.kind === 'order' ? `${q.ko}\n${q.pieces.join(' / ')}` : q.kind === 'pick' ? q.ko : `${q.text}${q.showKo ? `\n${q.ko}` : ''}`,
      correct: q.answer, accepted: q.accepted, chosen: shown, options: q.options || null,
      explanation: [q.why?.[shown], q.expl].filter(Boolean).join(' '), speak: q.full, ok,
      /* 무엇을 · 어떻게 틀렸나 — 목표 문법 · 사용 단어 · 유형 · 원인 · 단어 도움 · 단계 */
      grammar: q.gid, words: q.words.map((w) => w.kanji), qtype: q.kind, cause, wordHelp: a.wordHelp, phase: stage.name,
    });
  };

  /* 「이 단어 뜻이 기억 안 나요」 — 문법 채점에서 빼고, 그 단어 뜻 칸에 몰라요(사용자 결정). 반복 학습이면 같은 문법의 다른 문장으로 바꾼다 */
  const forgot = (w) => {
    if (!q || ans) return;
    onWordForgot?.(w.id);
    const answers = [...stage.answers];
    let qs = stage.qs;
    const spare = (run.spare?.swap || []).find((x) => !run.stages.some((s) => s.qs.some((y) => y.qid === x.qid)));
    if (spare && run.mode === 'repeat') {
      qs = [...stage.qs]; qs[run.at] = spare;
      onToast?.(`「${w.kanji}」는 단어 복습에 다시 넣었어요. 같은 문법을 다른 문장으로 볼게요`);
    } else {
      answers[run.at] = { void: true, ok: false, picked: null, wordHelp: true, at: Date.now() };
      onToast?.(`「${w.kanji}」는 단어 복습에 다시 넣었어요. 이 문제는 문법 점수에서 빼요`);
    }
    const stages = run.stages.map((s, i) => (i === run.stage ? { ...s, qs, answers } : s));
    save({ ...run, stages, spare: spare ? { ...run.spare, swap: run.spare.swap.filter((x) => x.qid !== spare.qid) } : run.spare });
    setShowWords(false);
  };

  /* 다음 문제 · 다음 단계 · 끝 */
  const advance = () => {
    if (!run) return;
    if (run.phase === 'intro') { save({ ...run, phase: 'q' }); return; }
    if (run.phase === 'between') { save({ ...run, phase: 'q' }); return; }
    if (!ans) return;
    if (run.at + 1 < stage.qs.length) { save({ ...run, at: run.at + 1 }); return; }
    const nx = nextStage(run);
    if (nx) {
      save({ ...run, stages: [...run.stages, nx], stage: run.stage + 1, at: 0, phase: nx.intro ? 'between' : 'q' });
      return;
    }
    const done = { ...run, phase: 'done' };
    if (!run.recorded) {
      onRecord?.(outcomeOf(done, today), done);
      done.recorded = true;
    }
    save(done);
  };

  const finishAndClose = (go) => { writeRun(null); go?.(); };
  const nextGrammar = () => {
    const r = recommend(progress?.grammarUse || null, today);
    if (!r) { onToast?.('오늘 더 확인할 문법이 없어요'); return; }
    start({ gid: r.gid, quest: false });
  };
  const retry = () => start({ gid: run.gid, nonce: `again${Date.now()}`, quest: false });

  useQuizHotkeys({
    scope,
    enabled: Boolean(run),
    options: run?.phase === 'q' && q && !ans && (q.kind === 'choice' || q.kind === 'pick') ? q.options : (run?.phase === 'q' && q?.kind === 'order' && !ans ? orderLeft.map((x) => x.i) : []),
    onChoose: (o) => {
      if (q?.kind === 'order') setPlaced((p) => [...p, o]);
      else submit(o);
    },
    onNext: () => {
      if (run?.phase === 'q' && q?.kind === 'order' && !ans && placed.length === q.pieces.length) { submit(placed); return; }
      if (run?.phase === 'done') return;
      advance();
    },
    onSpeak: () => { if (ans && q) speakJapanese(q.fullKana || q.full, rate); },
  });

  if (!run) return <div className="gu" ref={scope}><p className="set-note">문제를 준비하고 있어요…</p></div>;

  /* ── 문장을 못 만드는 날 ── */
  if (run.phase === 'empty') {
    return (
      <div className="gu gu-empty" ref={scope} data-phase="empty">
        <HunterTutor guide="gon" scene="island" mood="encourage" title="외운 단어로 문법 활용" line={run.reason} compact />
        {run.needWords && onNeedWords && <button className="submit-btn gu-needwords" onClick={onNeedWords}>새로 배우기로 단어 익히기</button>}
        <div className="gu-actions">
          {next && <button className="ghost-btn" onClick={() => finishAndClose(next.go)}>다음: {next.label}</button>}
          {(onHome || onExit) && <button className="ghost-btn" onClick={() => finishAndClose(onHome || onExit)}>오늘로</button>}
        </div>
      </div>
    );
  }

  const title = run.mode === 'repeat' ? `${MODE_TITLE.repeat} · ${g?.short}` : run.mode === 'explore' ? `${MODE_TITLE.explore}` : MODE_TITLE.place;
  const sc = stage ? stageScore(stage) : { right: 0, total: 0 };
  const answered = stage ? stage.answers.filter(Boolean).length : 0;

  return (
    <div className="gu" ref={scope} data-phase={run.phase} data-mode={run.mode} data-stage={stage?.name} data-gid={run.gid || ''}>
      <KeyboardHelp />
      <div className="gu-head">
        <b>{title}</b>
        {stage && run.phase !== 'intro' && run.phase !== 'done' && (
          <span className="gu-count" aria-label="이번 단계 진행">{stage.label} {Math.min(stage.qs.length, run.at + 1)} / {stage.qs.length}</span>
        )}
      </div>
      {stage && run.phase === 'q' && (
        <div className="gu-bar" aria-hidden="true"><i style={{ width: `${(answered / stage.qs.length) * 100}%` }} /></div>
      )}

      {run.phase === 'intro' && <Intro run={run} g={g} onStart={advance} />}
      {run.phase === 'between' && <Between run={run} stage={stage} g={g} onStart={advance} />}
      {run.phase === 'q' && q && (
        <Question
          q={q} ans={ans} stageName={stage.name} input={input} setInput={(v) => { setInput(v); setRomaji(null); }} romaji={romaji} setRomaji={setRomaji}
          placed={placed} setPlaced={setPlaced} orderLeft={orderLeft} showWords={showWords} setShowWords={setShowWords}
          onSubmit={submit} onForgot={forgot} onNext={advance} rate={rate}
          last={run.at + 1 >= stage.qs.length}
        />
      )}
      {run.phase === 'done' && (
        <Result
          run={run} g={g} gu={gu} today={today} next={next} onHome={onHome} onExit={onExit} embedded={embedded}
          onNextGrammar={nextGrammar} onRetry={retry} onClose={finishAndClose}
        />
      )}
      {stage && run.phase === 'q' && <p className="gu-score" aria-live="polite">맞힌 것 {sc.right} / {sc.total}</p>}
    </div>
  );
}

/* 세트 시작 — 무엇을 하는지 · 몇 문제인지 · 어떤 단어로 만들었는지(규칙 · 정답은 안 보인다) */
function Intro({ run, g, onStart }) {
  const n = run.stages[0].qs.length;
  const what = run.mode === 'place'
    ? `문법마다 한 문제씩 ${n}문제예요. 기초를 8개 넘게 맞히면 뒤 묶음도 이어서 봐요. 출발점을 찾는 진단이라 틀려도 괜찮아요.`
    : run.mode === 'explore'
      ? `여러 문법을 섞은 ${n}문제예요. 처음 열흘은 넓게 재 보고, 그다음부터 약한 문법을 하나씩 반복해요.`
      : `「${g?.title}」 기초 확인 ${DIAG_SIZE}문제예요. 다 맞히면 바로 통과, 하나 틀리면 추가 확인 ${FOLLOW_SIZE}문제, 더 틀리면 짧은 설명 뒤에 연습 ${PRACTICE_SIZE}문제예요.`;
  return (
    <div className="gu-intro">
      <HunterTutor guide="zushi" scene="arena" mood="explain" title="외운 단어로 문법 활용"
        line={run.mode === 'repeat' ? '아는 단어로 만든 문장에서 이 문법을 정말 쓸 수 있는지 볼게요. 힌트 없이 먼저 풀어 봐요!' : '문법은 사람마다 아는 곳이 달라요. 먼저 어디까지 아는지 같이 재 봐요!'} compact />
      <p className="gu-what">{what}</p>
      <p className="set-note">외운 단어 {run.knownCount}개로 만든 문장이에요 · {TIER_LABEL[3]} · {TIER_LABEL[2]}를 먼저 써요.</p>
      {run.prep?.length > 0 && (
        <div className="card gu-prep">
          <b>이 세트에 필요한 준비 단어 {run.prep.length}개</b>
          {run.prep.map((w) => <div key={w.id}><span lang="ja">{w.kanji}</span> <small lang="ja">{w.kana}</small> · {w.mean}</div>)}
        </div>
      )}
      <button className="submit-btn gu-start" onClick={onStart}>시작하기</button>
    </div>
  );
}

/* 단계 사이 — 2/3이면 틀린 부분만 짧게, 0~1이면 윙의 원리 설명 */
function Between({ run, stage, g, onStart }) {
  const diag = run.stages[0];
  const wrong = diag.qs.map((q, i) => ({ q, a: diag.answers[i] })).filter((x) => x.a && !x.a.ok && !x.a.void);
  return (
    <div className="gu-between" data-intro={stage.intro}>
      {stage.intro === 'fix' ? (
        <HunterTutor guide="killua" scene="arena" mood="encourage" title={`기초 확인 ${stageScore(diag).right} / ${DIAG_SIZE}`} line="거의 됐어. 틀린 곳만 짚고 새 문장 두 개로 한 번 더 확인하자." compact>
          {wrong.map(({ q, a }) => (
            <div key={q.qid} className="gu-fix">
              <div lang="ja" className="gu-fix-jp">{q.full}</div>
              <div className="gu-fix-why">내 답 「{a.picked}」 → 정답 「{q.answer}」. {q.why?.[a.picked] || ''} {q.expl}</div>
            </div>
          ))}
        </HunterTutor>
      ) : (
        <HunterTutor guide="wing" scene="arena" mood="explain" title={`${g?.title} — 원리부터`} line={g?.rule}
          peer={{ guide: 'zushi', line: '한국어랑 어디가 달라요?' }}>
          <p className="gu-tip">{g?.tip}</p>
          <p className="gu-ex"><span lang="ja">{g?.ex.jp}</span><small>{g?.ex.ko}</small></p>
        </HunterTutor>
      )}
      <button className="submit-btn gu-start" onClick={onStart}>{stage.label} {stage.qs.length}문제 시작</button>
    </div>
  );
}

function Question({ q, ans, stageName, input, setInput, romaji, setRomaji, placed, setPlaced, orderLeft, showWords, setShowWords, onSubmit, onForgot, onNext, rate, last }) {
  const g = GRAMMAR_USE_BY_ID[q.gid];
  const inputRef = useRef(null);
  useEffect(() => { if (q.kind === 'type' && !ans) inputRef.current?.focus({ preventScroll: true }); }, [q, ans]);
  return (
    <div className="gu-q card" data-kind={q.kind} data-qid={q.qid} data-answered={ans ? (ans.void ? 'void' : ans.ok ? 'ok' : 'no') : ''}>
      {/* 문법 이름은 답을 낸 뒤에만 — 진단 중에 「は」라고 적으면 답을 알려 주는 셈이다 */}
      <div className="gu-kind">{KIND_LABEL[q.kind]}{ans ? ` · ${g.title}` : ''}</div>
      {q.kind === 'pick' ? (
        <div className="gu-ko-prompt">{q.ko}</div>
      ) : q.kind === 'order' ? (
        <>
          <div className="gu-ko-prompt">{q.ko}</div>
          <div className="gu-line" lang="ja" aria-label="만든 문장">
            {placed.length ? placed.map((i, k) => (
              <button key={`${i}-${k}`} className="gu-chip on" disabled={Boolean(ans)} onClick={() => setPlaced(placed.filter((_, j) => j !== k))}>{q.pieces[i]}</button>
            )) : <span className="gu-line-empty">아래 조각을 순서대로 눌러요</span>}
          </div>
        </>
      ) : (
        <>
          <div className="gu-sent" lang="ja">{q.text}</div>
          {(q.showKo || ans) && <div className="gu-ko">{q.ko}</div>}
        </>
      )}

      {/* 단어 도움 — 뜻 · 읽기를 본 것은 기록에 남고(문법 힌트와 구분), 「기억 안 나요」는 그 문제를 문법 채점에서 뺀다 */}
      {!ans && (
        <div className="gu-help">
          <button className="chip gu-wordbtn" onClick={() => setShowWords(!showWords)}>{showWords ? '단어 닫기' : '단어 뜻 보기'}</button>
          {showWords && (
            <div className="gu-words">
              {q.words.map((w) => (
                <div key={w.kanji} className="gu-word">
                  <span lang="ja">{w.kanji}</span> <small lang="ja">{w.kana}</small> · {w.ko}
                  {w.id && <button className="gu-forgot" onClick={() => onForgot(w)}>이 단어 뜻이 기억 안 나요</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!ans && (q.kind === 'choice' || q.kind === 'pick') && (
        <div className={`gu-opts${q.kind === 'pick' ? ' sentences' : ''}`}>
          {q.options.map((o, i) => (
            <button key={o} className="gu-opt" lang="ja" data-opt={o} onClick={() => onSubmit(o)}><kbd>{i + 1}</kbd>{o}</button>
          ))}
        </div>
      )}
      {!ans && q.kind === 'type' && (
        <div className="gu-type">
          <input ref={inputRef} className="search-input gu-input" lang="ja" value={input} placeholder="빈칸에 들어갈 말 (가나 · 한자)"
            autoComplete="off" autoCorrect="off" spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && shortcutEvent(e)) { e.preventDefault(); e.stopPropagation(); onSubmit(input); } }} />
          <button className="submit-btn gu-submit" disabled={!input.trim()} onClick={() => onSubmit(input)}>확인</button>
          <RomajiHint value={romaji} onUse={(k) => { setInput(k); setRomaji(null); }} />
        </div>
      )}
      {!ans && q.kind === 'order' && (
        <>
          <div className="gu-pool" lang="ja">
            {orderLeft.map(({ p, i }, k) => <button key={i} className="gu-chip" onClick={() => setPlaced([...placed, i])}><kbd>{k + 1}</kbd>{p}</button>)}
          </div>
          <button className="submit-btn gu-submit" disabled={placed.length < q.pieces.length} onClick={() => onSubmit(placed)}>확인</button>
        </>
      )}

      {ans && <Feedback q={q} ans={ans} g={g} rate={rate} onNext={onNext} last={last} />}
    </div>
  );
}

/* 답을 낸 뒤 — 내 답 · 정답(인정 답) · 왜 · 한국어와 헷갈리는 곳 · 같은 문법 예문. 실제로 고른 답으로만 말한다 */
function Feedback({ q, ans, g, rate, onNext, last }) {
  const nextRef = useRef(null);
  useEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, []);
  /* 인정 답 — 정답의 가나 읽기는 빼고, 다른 말(へ · ので · じゃありません)만 */
  const kanjiIn = /[\u3400-\u9fff]/;
  const alts = q.kind === 'order' ? [] : q.accepted.filter((x) => x !== q.answer && !(kanjiIn.test(q.answer) && !kanjiIn.test(x)));
  if (ans.void) {
    return (
      <div className="gu-fb void">
        <p>이 문제는 단어 확인으로 넘겼어요. 문법 점수에는 안 들어가요.</p>
        <button ref={nextRef} className="submit-btn gu-next" onClick={onNext}>{last ? '결과 보기' : '다음 문제'}</button>
      </div>
    );
  }
  return (
    <div className={`gu-fb ${ans.ok ? 'ok' : 'no'}`} role="status">
      <div className="gu-verdict">{ans.ok ? '맞았어요' : '틀렸어요'}</div>
      {!ans.ok && <div className="gu-mine">내 답 <b lang="ja">{ans.picked}</b></div>}
      <div className="gu-right">정답 <b lang="ja">{q.answer}</b>{alts.length > 0 && <small> · 이것도 맞아요: <span lang="ja">{alts.join(' · ')}</span></small>}</div>
      <div className="gu-full"><span lang="ja">{q.full}</span>
        <button className="chip gu-say" onClick={() => speakJapanese(q.fullKana || q.full, rate)} aria-label="문장 듣기">🔊</button>
        <small>{q.ko}</small>
      </div>
      {!ans.ok ? (
        <HunterTutor guide="killua" scene="arena" mood="encourage" title="어디가 달랐나" line={[q.why?.[ans.picked], q.expl].filter(Boolean).join(' ')} compact />
      ) : (
        <p className="gu-expl">{q.expl}</p>
      )}
      <p className="gu-tip">{g.tip}</p>
      <p className="gu-ex">같은 문법: <span lang="ja">{g.ex.jp}</span> <small>{g.ex.ko}</small></p>
      <button ref={nextRef} className="submit-btn gu-next" onClick={onNext}>{last ? '결과 보기' : '다음 문제'}<kbd className="inline-key">Enter</kbd></button>
    </div>
  );
}

/* 결과 — 실제 풀이로 계산한 문구와 수치, 다음 행동 */
function Result({ run, g, gu, today, next, onHome, onExit, embedded, onNextGrammar, onRetry, onClose }) {
  const by = (n) => run.stages.find((s) => s.name === n);
  const diag = by('diag'); const follow = by('follow'); const practice = by('practice');
  const wrongRows = run.stages.flatMap((s) => s.qs.map((q, i) => ({ q, a: s.answers[i], s }))).filter((x) => x.a && !x.a.ok && !x.a.void);
  let head = ''; let line = ''; let quick = false; let passed = false;
  if (run.mode === 'repeat') {
    const d = stageScore(diag);
    if (d.right >= DIAG_SIZE) { quick = true; passed = true; head = `${g.short} 기초 확인 ${d.right} / ${DIAG_SIZE}`; line = '다른 문장에서도 정확하게 사용했어요. 다른 날 다른 문장으로 한 번 더 확인해요.'; }
    else if (follow) { const f = stageScore(follow); passed = f.right >= FOLLOW_SIZE; head = `${g.short} 추가 확인 ${f.right} / ${FOLLOW_SIZE}`; line = passed ? '틀렸던 곳을 바로잡았어요. 다른 날 다시 확인해요.' : '아직 헷갈려요. 이 문법을 복습에 넣었어요 — 다음에 다른 문장으로 다시 봐요.'; }
    else if (practice) { const p = stageScore(practice); head = `${g.short} 연습 ${p.right} / ${p.total}`; line = `${g.short}를 한 번 더 확인해요. 오늘 몫은 끝났고, 이 문법은 복습에 넣었어요.`; }
  } else {
    const per = {};
    run.stages.forEach((s) => s.answers.forEach((a, i) => { if (!a || a.void) return; const id = s.qs[i].gid; (per[id] ||= { r: 0, t: 0 }); per[id].t += 1; if (a.ok) per[id].r += 1; }));
    const total = Object.values(per).reduce((n, x) => n + x.t, 0); const right = Object.values(per).reduce((n, x) => n + x.r, 0);
    head = `${run.mode === 'place' ? '초기 진단' : '탐색 테스트'} ${right} / ${total}`;
    line = run.mode === 'place' ? '어디서부터 시작할지 정했어요. 내일부터 열흘 동안 여러 문법을 섞어 확인해요.' : '오늘 확인한 문법이에요. 틀린 문법은 다음 탐색 · 반복 학습에 먼저 나와요.';
    run.per = per;
  }
  const st = g ? statusOf(gu, g.id, today) : null;
  return (
    <div className="gu-result" data-quick={quick ? '1' : '0'} data-passed={passed ? '1' : '0'}>
      <HunterTutor guide="gon" scene="island" mood={wrongRows.length ? 'encourage' : 'celebrate'} title={head} line={line} compact />
      {run.per && (
        <div className="gu-per">
          {Object.entries(run.per).map(([id, x]) => (
            <div key={id} className={`gu-per-row ${x.r === x.t ? 'ok' : 'no'}`}><b>{GRAMMAR_USE_BY_ID[id].short}</b><span>{GRAMMAR_USE_BY_ID[id].title}</span><em>{x.r} / {x.t}</em></div>
          ))}
        </div>
      )}
      {st && <p className="set-note">{st.level > 0 ? `날짜를 두고 확인한 날 ${st.level}일` : '아직 날짜를 두고 확인한 날이 없어요'}{st.weak ? ' · 복습 대상' : ''}</p>}
      {wrongRows.length > 0 && (
        <div className="gu-wrongs">
          <b>틀린 문제 {wrongRows.length}개</b>
          {wrongRows.map(({ q, a }) => (
            <div key={q.qid} className="card gu-wrong">
              <div lang="ja">{q.full}</div>
              <small>내 답 「{a.picked}」 → 정답 「{q.answer}」 · {q.why?.[a.picked] || q.expl}</small>
            </div>
          ))}
        </div>
      )}
      <div className="gu-actions">
        {run.mode === 'repeat' && passed && <button className="submit-btn gu-nextgrammar" onClick={onNextGrammar}>다음 문법으로</button>}
        {run.mode === 'repeat' && !passed && <button className="ghost-btn gu-retry" onClick={onRetry}>틀린 문법 다시 연습</button>}
        {next && <button className={`${passed && run.mode === 'repeat' ? 'ghost-btn' : 'submit-btn'} gu-nextquest`} onClick={() => onClose(next.go)}>다음: {next.label}</button>}
        {!embedded && (onHome || onExit) && <button className="ghost-btn gu-home" onClick={() => onClose(onHome || onExit)}>오늘로</button>}
      </div>
    </div>
  );
}
