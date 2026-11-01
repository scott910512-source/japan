import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconSpeaker, IconX } from '../components/Icons.jsx';
import BuildQuiz from '../components/BuildQuiz.jsx';
import { readingText, speakJapanese } from '../lib/tts.js';
import { markBusy } from '../lib/busy.js';
import { goalOf } from '../lib/goal.js';
import { chunksOf } from '../data/allChunks.js';
import { DAILY_GRAMMAR_SETS } from '../data/grammar-daily.js';
import { ADVERB_SETS } from '../data/adverbs.js';
import { BLANK, splitBlank, filled } from '../lib/blank.js';
import { VERDICT } from '../lib/review.js';
import {
  COMPOSE_MODES, COMPOSE_MODE, buildVerdict, clozeItems, clozePool, composePool, judgeWrite, newSession,
  pickNext, record, writeVerdict,
} from '../lib/compose.js';
import { shouldRecord } from '../lib/stream.js';
import { correctSentence, hasAiKey } from '../lib/composeAi.js';

/* 문장 만들기 — 배운 문장을 내 손으로 만들어 본다.
 *
 * 규칙과 이유는 lib/compose.js 머리말에 있다. 여기는 그리는 일만 한다.
 *   조립 · 빈칸 · 쓰기 · 내 문장 — 네 갈래가 한 화면에서 탭으로 갈린다.
 *   조립과 쓰기는 복습 기록에 들어간다(문장 카드에 붙는 연습). 첫 대답만 적는다.
 *
 * 한 판의 풀은 갈래를 열 때 한 번 굳힌다 — 답할 때마다 복습 기록이 바뀌는데 그때마다 풀을
 * 다시 짜면 방금 틀린 문장의 무게가 흔들린다(쭉 퀴즈와 같은 이유). */
const AUTO_NEXT_MS = 900;

export default function ComposeQuiz(props) {
  const [mode, setMode] = useState(COMPOSE_MODE.BUILD);
  const { settings } = props;
  return (
    <div className="compose">
      <div className="segment cmp-tabs" role="tablist" aria-label="문장 만들기 방식">
        {COMPOSE_MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'active' : ''}
            data-mode={m.id} onClick={() => setMode(m.id)}>{m.label}</button>
        ))}
      </div>
      <p className="set-note cmp-note">{COMPOSE_MODES.find((m) => m.id === mode)?.sub} · 목표 {goalOf(settings)}</p>
      {mode === COMPOSE_MODE.BUILD && <BuildMode key="build" {...props} />}
      {mode === COMPOSE_MODE.BLANK && <BlankMode key="blank" {...props} />}
      {mode === COMPOSE_MODE.WRITE && <WriteMode key="write" {...props} />}
      {mode === COMPOSE_MODE.FREE && <FreeMode key="free" {...props} />}
    </div>
  );
}

/* ── 공통: 판의 풀과 점수 ── */
function useRun({ sentences, review, progress, settings, mode, hasChunks }) {
  const goal = goalOf(settings);
  const ledger = progress?.weak || null;
  const pool = useRef(null);
  if (pool.current === null) {
    pool.current = composePool({ sentences, review, ledger, goal, mode, hasChunks });
  }
  const [session, setSession] = useState(newSession);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const byId = useMemo(() => new Map(sentences.map((s) => [s.id, s])), [sentences]);
  const next = useCallback(() => pickNext(pool.current, sessionRef.current), []);
  return { pool: pool.current, session, setSession, sessionRef, byId, next };
}

const Score = ({ session }) => {
  const total = session.log.length;
  const right = session.log.filter((e) => e.ok).length;
  return <div className="cmp-score"><b>{right}</b> / {total}{session.streak >= 3 && <span className="cmp-hot"> · 연속 {session.streak}</span>}</div>;
};

const Empty = ({ children }) => <div className="empty-state cmp-empty">{children}</div>;

/* ── 조립 ── */
function BuildMode({ sentences, review, progress, settings, onVerdicts, onActivity }) {
  const run = useRun({ sentences, review, progress, settings, mode: COMPOSE_MODE.BUILD, hasChunks: (id) => chunksOf(id) != null });
  const [cur, setCur] = useState(() => run.next());
  const [solved, setSolved] = useState(false);

  const onSolved = (firstTry) => {
    if (!cur || solved) return;
    setSolved(true);
    if (shouldRecord(run.sessionRef.current, cur.id)) onVerdicts?.({ [cur.id]: buildVerdict(firstTry) });
    onActivity?.({ quizzed: 1 });
    run.setSession((s) => record(s, cur, firstTry));
  };
  const advance = () => { setSolved(false); setCur(run.next()); };

  if (!run.pool.length) return <Empty>조립할 문장이 아직 없어요. 오늘 화면에서 문장을 먼저 배워 보세요. 목표 {goalOf(settings)} 안의 문장만 나와요.</Empty>;
  const s = run.byId.get(cur.id);
  return (
    <div className="cmp-build" data-id={cur.id}>
      <Score session={run.session} />
      <BuildQuiz key={cur.id} item={{ id: s.id, ko: s.mean, jp: s.kanji, kana: s.kana }} chunks={chunksOf(s.id)}
        settings={settings} onSolved={onSolved} />
      {solved && <div className="qnext"><button className="submit-btn cmp-next" onClick={advance}>다음 문장</button></div>}
    </div>
  );
}

/* ── 빈칸 ── 답이 하나가 되게 짜 둔 자료(일상문법·부사). 복습 기록에는 안 들어간다 — 문장 카드가 아니다. */
function BlankMode({ onActivity, settings }) {
  const items = useMemo(() => clozeItems(DAILY_GRAMMAR_SETS, ADVERB_SETS), []);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const pool = useMemo(() => clozePool(items), [items]);
  const [session, setSession] = useState(newSession);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [curId, setCurId] = useState(() => pickNext(pool, newSession())?.id);
  const [picked, setPicked] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const item = byId.get(curId);
  const options = useMemo(() => (item ? [...item.options].sort(() => Math.random() - 0.5) : []), [item]);
  const advance = useCallback(() => {
    clearTimeout(timer.current);
    setPicked(null);
    setCurId(pickNext(pool, sessionRef.current)?.id);
  }, [pool]);

  const choose = (opt) => {
    if (picked != null) return;
    const ok = opt === item.answer;
    setPicked(opt);
    onActivity?.({ quizzed: 1 });
    setSession((s) => record(s, { id: item.id, kind: 'cloze' }, ok));
    if (ok) timer.current = setTimeout(advance, AUTO_NEXT_MS);
  };

  const { head, tail } = splitBlank(item.jp);
  const done = picked != null;
  return (
    <div className="cmp-blank" data-id={item.id}>
      <Score session={session} />
      <div className="quizcard cmp-q">
        <div className="qc-tag">{item.set} · 빈칸을 고르세요</div>
        <div className="qc-prompt ko">{item.ko}</div>
        <div className="cmp-sentence" lang="ja">
          {head}<span className={`cmp-hole${done ? (picked === item.answer ? ' ok' : ' no') : ''}`}>{done ? item.answer : BLANK}</span>{tail}
        </div>
      </div>
      <div className="qoptions">
        {options.map((o) => {
          let cls = 'qopt cmp-opt';
          if (done) cls += o === item.answer ? ' correct' : o === picked ? ' wrong' : ' dim';
          return (
            <button key={o} className={cls} disabled={done} onClick={() => choose(o)}>
              <span className="qo-body"><b lang="ja">{o}</b>{done && o !== item.answer && item.why?.[o] && <span className="qo-why">{item.why[o]}</span>}</span>
              {done && o === item.answer && <span className="qo-mark ok"><IconCheck /></span>}
            </button>
          );
        })}
      </div>
      {done && (
        <>
          <div className={`qverdict ${picked === item.answer ? 'correct' : 'wrong'}`}>
            <b lang="ja">{filled(item)}</b>
            <div className="qv-ex"><span>{item.note}</span></div>
          </div>
          {picked !== item.answer && <div className="qnext"><button className="submit-btn cmp-next" onClick={advance}>다음 문제</button></div>}
        </>
      )}
    </div>
  );
}

/* ── 쓰기 ── */
const AI_TO_VERDICT = { good: VERDICT.KNOWN, okay: VERDICT.VAGUE, wrong: VERDICT.UNKNOWN };

function WriteMode({ sentences, review, progress, settings, onVerdicts, onActivity, onToast }) {
  const run = useRun({ sentences, review, progress, settings, mode: COMPOSE_MODE.WRITE });
  const [cur, setCur] = useState(() => run.next());
  const [typed, setTyped] = useState('');
  const [res, setRes] = useState(null);        // { verdict, expected }
  const [ai, setAi] = useState(null);          // { busy, error, data }
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const aiReady = hasAiKey(settings);

  /* 이 문장의 기록을 확정한다 — 틀림·애매는 「다음」을 누를 때(그 사이에 AI가 고쳐 줄 수 있다) */
  const settle = (ok, verdictOverride) => {
    const item = cur;
    if (shouldRecord(run.sessionRef.current, item.id)) onVerdicts?.({ [item.id]: verdictOverride || writeVerdict(ok) });
    onActivity?.({ quizzed: 1 });
    run.setSession((s) => record(s, item, ok));
  };

  const advance = useCallback(() => {
    clearTimeout(timer.current);
    setTyped(''); setRes(null); setAi(null);
    setCur(run.next());
  }, [run]);

  const submit = () => {
    if (res || !typed.trim()) return;
    const r = judgeWrite(run.byId.get(cur.id), typed);
    setRes(r);
    if (r.verdict === 'correct') { settle(true); timer.current = setTimeout(advance, AUTO_NEXT_MS); }
  };

  const askAi = async () => {
    const s = run.byId.get(cur.id);
    setAi({ busy: true });
    try {
      const data = await correctSentence({ ko: s.mean, mine: typed, expected: s.kanji }, settings);
      setAi({ data });
    } catch (e) {
      setAi({ error: e.message });
      onToast?.(e.message);
    }
  };

  /* 틀림·close를 어떻게 마무리하나. AI가 맞다/통한다고 하면 그쪽을 따른다 — 이 문장이 정답과 다르게 써도
     맞는 말일 수 있다(자료의 정답은 한 가지일 뿐이다). */
  const finish = (kind) => {
    if (kind === 'right') settle(true);
    else if (kind === 'ai') settle(ai?.data?.verdict !== 'wrong', AI_TO_VERDICT[ai?.data?.verdict]);
    else settle(false);
    advance();
  };

  if (!run.pool.length) return <Empty>쓸 문장이 아직 없어요. 오늘 화면에서 문장을 먼저 배워 보세요. 목표 {goalOf(settings)} 안의 문장만 나와요.</Empty>;
  const s = run.byId.get(cur.id);
  const pending = res && res.verdict !== 'correct';
  return (
    <div className="cmp-write" data-id={cur.id}>
      <Score session={run.session} />
      <div className="quizcard cmp-q">
        <div className="qc-tag">{s.place ? `${s.place} · ` : ''}일본어로 써 보세요</div>
        <div className="qc-prompt ko">{s.mean}</div>
      </div>
      <div className="qtyping">
        <input className="search-input cmp-input" value={typed} lang="ja" disabled={Boolean(res)}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="일본어 문장 (한자 또는 히라가나)" autoComplete="off" autoCorrect="off" spellCheck={false} />
        {!res && <button className="submit-btn cmp-submit" onClick={submit} disabled={!typed.trim()}>제출</button>}
      </div>

      {res?.verdict === 'correct' && <div className="qverdict correct cmp-ok"><IconCheck /> 맞아요</div>}

      {pending && (
        <div className={`qverdict ${res.verdict} cmp-result`}>
          {res.verdict === 'close' ? <>거의 맞았어요. 정답은 </> : <><IconX /> 정답은 </>}
          <b lang="ja">{s.kanji}</b>
          <div className="qv-ex"><span lang="ja">{s.kana}</span></div>
          <button className="qc-speak cmp-speak" onClick={() => speakJapanese(readingText(s.kana, s.kanji), settings?.speechRate)} aria-label="발음 듣기"><IconSpeaker /></button>
        </div>
      )}

      {pending && ai?.data && <AiResult data={ai.data} settings={settings} />}
      {pending && ai?.error && <p className="set-note cmp-aierr">{ai.error}</p>}

      {pending && (
        <div className="qnext">
          {aiReady && !ai?.data && (
            <button className="ghost-btn cmp-ai" onClick={askAi} disabled={ai?.busy}>{ai?.busy ? 'AI가 보는 중…' : '내 문장 AI에게 확인받기'}</button>
          )}
          {res.verdict === 'close' && !ai?.data && <button className="ghost-btn cmp-accept" onClick={() => finish('right')}>맞게 처리하기</button>}
          {ai?.data && <button className="ghost-btn cmp-follow" onClick={() => finish('ai')}>
            {ai.data.verdict === 'wrong' ? '틀린 걸로 하고 다음' : ai.data.verdict === 'good' ? '맞게 처리하고 다음' : '뜻은 통해요, 다음'}
          </button>}
          {!ai?.data && <button className="submit-btn cmp-next" onClick={() => finish('wrong')}>틀렸어요, 다음 문장</button>}
        </div>
      )}
      {!aiReady && pending && <p className="set-note">설정에 AI 키를 넣으면 다른 말로 맞게 쓴 문장도 확인받을 수 있어요.</p>}
    </div>
  );
}

/* ── 내 문장 ── */
function AiResult({ data, settings }) {
  const speak = (jp, kana) => speakJapanese(readingText(kana, jp), settings?.speechRate);
  const label = { good: '자연스러워요', okay: '뜻은 통해요, 조금 어색해요', wrong: '고쳐야 해요' }[data.verdict];
  return (
    <div className={`cmp-ai-result qverdict ${data.verdict === 'wrong' ? 'wrong' : data.verdict === 'good' ? 'correct' : 'close'}`} data-verdict={data.verdict}>
      <div className="cmp-ai-head"><b>{label}</b></div>
      {data.corrected && (
        <div className="cmp-fixed">
          <span lang="ja">{data.corrected}</span>
          {data.kana && <small lang="ja">{data.kana}</small>}
          <button className="qc-speak cmp-speak" onClick={() => speak(data.corrected, data.kana)} aria-label="고친 문장 듣기"><IconSpeaker /></button>
        </div>
      )}
      {data.reason && <div className="cmp-reason">{data.reason}</div>}
      {data.natural.length > 0 && (
        <div className="cmp-natural">
          <small>이렇게도 말해요</small>
          {data.natural.map((n) => (
            <div key={n.jp} className="cmp-nat">
              <span lang="ja">{n.jp}</span><small>{n.ko}{n.note ? ` · ${n.note}` : ''}</small>
              <button className="qc-speak cmp-speak" onClick={() => speak(n.jp, n.kana)} aria-label="듣기"><IconSpeaker /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FreeMode({ settings, onToast }) {
  const [ko, setKo] = useState('');
  const [mine, setMine] = useState('');
  const [ai, setAi] = useState(null);
  const [history, setHistory] = useState([]);
  const aiReady = hasAiKey(settings);

  const check = async () => {
    if (!mine.trim() || ai?.busy) return;
    setAi({ busy: true });
    try {
      const data = await correctSentence({ ko, mine }, settings);
      setAi({ data, mine });
      setHistory((h) => [{ mine, data }, ...h].slice(0, 5));
    } catch (e) {
      setAi({ error: e.message });
      onToast?.(e.message);
    }
  };

  if (!aiReady) {
    return (
      <div className="card cmp-nokey">
        <div className="set-title">내 문장을 AI가 고쳐 줘요</div>
        <p className="set-note">
          내가 만든 일본어 문장을 넣으면 자연스러운지 봐 주고, 고친 문장과 일본인이 실제로 쓰는 말을 알려 줘요.
          내 AI 키가 있어야 해요. 내 학습 · 설정 · 학습 도구에서 넣어요. 키는 이 기기 밖으로 나가지 않아요.
        </p>
      </div>
    );
  }
  return (
    <div className="cmp-free">
      <div className="card cmp-form">
        <label className="set-title" htmlFor="cmp-ko">만들려는 뜻 (선택)</label>
        <input id="cmp-ko" className="search-input cmp-ko" value={ko} onChange={(e) => setKo(e.target.value)} placeholder="예: 내일 친구랑 영화 보러 가요" autoComplete="off" />
        <label className="set-title" htmlFor="cmp-mine">내가 만든 일본어 문장</label>
        <textarea id="cmp-mine" className="search-input cmp-mine" lang="ja" rows={3} value={mine} onChange={(e) => setMine(e.target.value)}
          placeholder="일본어로 써 보세요" spellCheck={false} />
        <button className="submit-btn cmp-check" onClick={check} disabled={!mine.trim() || Boolean(ai?.busy)}>
          {ai?.busy ? 'AI가 보는 중…' : '고쳐 달라고 하기'}
        </button>
      </div>
      {ai?.error && <p className="set-note cmp-aierr">{ai.error}</p>}
      {ai?.data && <AiResult data={ai.data} settings={settings} />}
      {history.length > 1 && (
        <>
          <div className="section-label">이번에 쓴 문장</div>
          <div className="card cmp-hist">
            {history.slice(1).map((h, i) => (
              <div key={`${h.mine}-${i}`} className="cmp-histrow"><span lang="ja">{h.mine}</span><small>{{ good: '자연스러워요', okay: '조금 어색', wrong: '고침' }[h.data.verdict]}</small></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
