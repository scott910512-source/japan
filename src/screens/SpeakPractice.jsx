import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPlay, IconSpeaker, IconTrash, IconChevron } from '../components/Icons.jsx';
import KeyboardHelp from '../components/KeyboardHelp.jsx';
import { useHotkeys, useHasKeyboard } from '../lib/useHotkeys.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { markBusy } from '../lib/busy.js';
import { speakJapanese, speakKorean, stopSpeaking, unlockAudio, readingText } from '../lib/tts.js';
import { goalOf } from '../lib/goal.js';
import { resolveProvider } from '../lib/aiClient.js';
import {
  SPEAK_DIR, SPEAK_SOURCE, THINK_SECONDS, SPEAK_COUNTS, GEN_COUNT, MAX_TOPIC_CHARS,
  savedSentences, addSentences, removeSentence, speakCounts, buildSpeakQueue, speakSteps, stepMs, generateSentences,
  speakBatches, pickBatches, batchSentences, batchLabel,
} from '../lib/speak.js';

/* 말하기 연습 — 문장을 보고 스스로 말해 본 뒤 정답을 듣는다. 마이크는 안 쓴다.
 *
 * 듣기처럼 틀어 두면 저절로 흘러간다. 뜻을 보고(듣고) → 생각하고 말할 시간 → 정답 → 따라 말할 시간 → 다음 문장.
 * 채점이 없으니 복습 간격도 약점도 안 건드린다 — 몇 문장 말했는지만 활동에 남긴다.
 * 문장은 배운 문장과, 주제를 적어 AI로 만든 문장(progress.speak에 저장 · 동기화)에서 온다. 규칙은 lib/speak.js. */

const PREF_KEY = 'jp_speak_prefs_v1';
/* again — 정답을 들은 뒤 한 번 더 말할 차례를 둘지. batches — 연습할 AI 문장 회차(비어 있으면 전부 섞는다) */
const DEFAULT_PREFS = { dir: SPEAK_DIR.KO_JP, think: 5, count: 10, source: SPEAK_SOURCE.MIX, again: true, batches: [] };
const loadPrefs = () => {
  try {
    const p = { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}')) };
    return { ...p, again: p.again !== false, batches: Array.isArray(p.batches) ? p.batches : [] };
  } catch { return { ...DEFAULT_PREFS }; }
};

const STEP_LABEL = {
  [SPEAK_DIR.KO_JP]: { prompt: '뜻을 보고 일본어로 떠올려요', think: '소리 내어 말해 보세요', answer: '정답을 들어요', repeat: '따라 말해 보세요' },
  [SPEAK_DIR.JP_KO]: { prompt: '일본어를 들어요', think: '따라 말해 보세요', answer: '뜻을 확인하고 한 번 더 들어요', repeat: '뜻을 떠올리며 한 번 더 말해 보세요' },
};

export default function SpeakPractice({ sentenceCards = [], review = {}, progress = {}, setProgress, settings = {}, onActivity, onToast, onExit }) {
  const [prefs, setPrefsState] = useState(loadPrefs);
  const setPref = (k, v) => setPrefsState((p) => { const n = { ...p, [k]: v }; try { localStorage.setItem(PREF_KEY, JSON.stringify(n)); } catch { /* 저장 못 해도 이번 판은 된다 */ } return n; });
  const saved = useMemo(() => savedSentences(progress.speak), [progress.speak]);
  /* 회차 — 한 번 만들 때 나온 묶음. 고른 회차의 문장만 연습에 쓴다(안 골랐으면 전부) */
  const batches = useMemo(() => speakBatches(saved), [saved]);
  const chosen = useMemo(() => pickBatches(batches, prefs.batches), [batches, prefs.batches]);
  /* 손으로 고른 회차 — 지금 있는 것만. 비어 있으면 「전체 섞기」다.
     전부 손으로 골랐을 때도 고른 그대로 둔다(「전체 섞기」로 바꿔 버리면 고른 표시가 사라져서 선택이 풀린 것처럼 보인다) */
  const picked = useMemo(() => {
    const have = new Set(batches.map((b) => b.id));
    return (Array.isArray(prefs.batches) ? prefs.batches : []).filter((id) => have.has(id));
  }, [batches, prefs.batches]);
  const allBatches = picked.length === 0;
  const pool = useMemo(() => batchSentences(chosen), [chosen]);
  const toggleBatch = (id) => setPref('batches', picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const counts = useMemo(() => speakCounts({ saved: pool, sentenceCards, review }), [pool, sentenceCards, review]);
  const hasAi = Boolean(resolveProvider(settings).apiKey);
  const level = goalOf(settings);
  const hasKeyboard = useHasKeyboard();

  /* ── AI 문장 만들기 ── */
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const make = async () => {
    if (busy) return;
    setErr('');
    if (!navigator.onLine) { setErr('문장을 만들려면 인터넷이 있어야 해요. 저장해 둔 문장은 그대로 연습할 수 있어요.'); return; }
    setBusy(true);
    try {
      const list = await generateSentences({ topic, level, count: GEN_COUNT, avoid: saved.slice(0, 40).map((s) => s.jp) }, settings);
      /* 몇 개가 새로 들어가는지는 지금 저장된 것으로 센다(갱신 함수 안에서 세면 알림이 먼저 나간다) */
      const { added } = addSentences(progress.speak, list);
      setProgress((p) => { const r = addSentences(p.speak, list); return r.store === p.speak ? p : { ...p, speak: r.store }; });
      onToast?.(added ? `문장 ${added}개를 ${batches.length + 1}회차로 저장했어요` : '이미 있는 문장만 와서 더하지 않았어요');
    } catch (e) {
      setErr(e.message || '문장을 만들지 못했어요');
    } finally { setBusy(false); }
  };
  const drop = (id) => setProgress((p) => ({ ...p, speak: removeSentence(p.speak, id) }));

  /* ── 한 판 ── */
  const [run, setRun] = useState(null);       // { items, index, step, done }
  const [paused, setPaused] = useState(false);
  const [nudge, setNudge] = useState(0);      // 「다시 듣기」 — 이미 첫 걸음이어도 소리를 다시 내게 하는 신호
  const timer = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); stopSpeaking(); markBusy('speak', false); }; }, []);
  useEffect(() => { markBusy('speak', Boolean(run && !run.done)); }, [run]);
  useWakeLock(Boolean(run && !run.done && !paused));

  const steps = speakSteps(prefs.dir, { again: prefs.again });
  const item = run && !run.done ? run.items[run.index] : null;
  const step = run ? steps[run.step] : null;

  const start = () => {
    const items = buildSpeakQueue({ source: prefs.source, saved: pool, sentenceCards, review, count: prefs.count });
    if (!items.length) { onToast?.('연습할 문장이 아직 없어요 — AI로 문장을 만들거나 문장을 먼저 배워 주세요'); return; }
    unlockAudio();
    setPaused(false);
    setRun({ items, index: 0, step: 0, done: false });
  };
  const finish = (r) => ({ ...r, done: true });
  /* 몇 문장 말했는지 활동에 한 번만 남긴다 — 갱신 함수 안에서 적으면 두 번 불릴 수 있다 */
  const noted = useRef(null);
  useEffect(() => {
    if (!run?.done || noted.current === run.items) return;
    noted.current = run.items;
    onActivity?.({ speak: run.items.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.done]);
  const goNext = () => setRun((r) => {
    if (!r || r.done) return r;
    if (r.index + 1 >= r.items.length) return finish(r);
    return { ...r, index: r.index + 1, step: 0 };
  });
  /* 다시 듣기 — 어느 걸음에 있든 이 문장을 처음(뜻 · 소리)부터 다시 간다.
     「말할 시간」처럼 조용한 걸음에서 그 걸음만 되풀이하면 아무 소리도 안 나서 고장처럼 보였다. */
  const replay = () => {
    setPaused(false);
    setRun((r) => (r && !r.done ? { ...r, step: 0 } : r));
    setNudge((n) => n + 1);
  };
  const goPrev = () => setRun((r) => (r && !r.done ? { ...r, index: Math.max(0, r.index - 1), step: 0 } : r));
  const quit = () => {
    clearTimeout(timer.current); stopSpeaking();
    if (run && !run.done && run.index > 0) onActivity?.({ speak: run.index });   // 끝까지 안 했어도 말한 만큼은 남긴다
    setRun(null);
  };

  /* 걸음이 바뀔 때마다 소리를 내고 다음 걸음을 예약한다. 끝났다는 신호를 안 믿고 글자 수로 어림한 시간으로 넘긴다(듣기와 같은 규칙) */
  useEffect(() => {
    if (!item || !step) return undefined;
    clearTimeout(timer.current);
    if (paused) { stopSpeaking(); return undefined; }
    const say = readingText(item.kana, item.jp);   // 조사 は · へ를 소리 나는 대로(화면의 읽기는 그대로)
    const rate = settings.speechRate;
    if (prefs.dir === SPEAK_DIR.KO_JP) {
      if (step === 'prompt') speakKorean(item.ko, 1);
      else if (step === 'think') stopSpeaking();
      else if (step === 'answer') speakJapanese(say, rate);
      else if (step === 'repeat') { /* 따라 말할 시간 — 조용히 둔다 */ }
    } else if (step === 'prompt' || step === 'answer') speakJapanese(say, rate);
    const ms = stepMs(step, item, { dir: prefs.dir, think: prefs.think });
    timer.current = setTimeout(() => {
      if (!alive.current) return;
      setRun((r) => {
        if (!r || r.done) return r;
        if (r.step + 1 < steps.length) return { ...r, step: r.step + 1 };
        if (r.index + 1 >= r.items.length) return finish(r);
        return { ...r, index: r.index + 1, step: 0 };
      });
    }, ms);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.index, run?.step, run?.done, paused, nudge, prefs.dir, prefs.think, prefs.again]);

  useHotkeys({
    Space: () => { if (run && !run.done) setPaused((v) => !v); },
    Enter: () => { if (!run || run.done) start(); else goNext(); },   // 끝 화면의 Enter는 단추에 적힌 대로 「한 판 더」
    ArrowRight: () => { if (run && !run.done) goNext(); },
    ArrowLeft: () => { if (run && !run.done) goPrev(); },
    r: () => { if (run && !run.done) replay(); },
    Escape: () => { if (run) quit(); else onExit?.(); },
  });

  /* ── 끝 ── */
  if (run?.done) {
    return (
      <div className="speak sp-done" data-total={run.items.length}>
        <div className="card sp-card">
          <b className="sp-donehead">오늘 {run.items.length}문장을 말해 봤어요</b>
          <p className="set-note">말하기는 채점하지 않아요. 복습 간격에는 영향이 없고, 활동 기록에만 남아요.</p>
          <button className="submit-btn sp-again" onClick={start}>한 판 더{hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>
          <button className="ghost-btn sp-out" onClick={() => setRun(null)}>설정으로 돌아가기</button>
        </div>
      </div>
    );
  }

  /* ── 흘러가는 중 ── */
  if (run && item) {
    const showJp = prefs.dir === SPEAK_DIR.JP_KO || step === 'answer' || step === 'repeat';
    const showKo = prefs.dir === SPEAK_DIR.KO_JP || step === 'answer' || step === 'repeat';
    const ms = stepMs(step, item, { dir: prefs.dir, think: prefs.think });
    const speakNow = step === 'think' || step === 'repeat';
    return (
      <div className="speak sp-run" data-step={step} data-index={run.index} data-dir={prefs.dir} data-paused={paused ? '1' : '0'}>
        <KeyboardHelp kind="listen" />
        <div className="sp-head">
          <span className="sp-pos"><b>{run.index + 1}</b> / {run.items.length}</span>
          <button className="ghost-btn sp-quit" onClick={quit}>그만하기</button>
        </div>
        <div className={`card sp-card sp-stage${speakNow ? ' speak-now' : ''}`}>
          <div className="sp-step" role="status">{paused ? '잠시 멈춤' : STEP_LABEL[prefs.dir][step]}</div>
          {showKo && <div className="sp-ko">{item.ko}</div>}
          {!showKo && <div className="sp-ko sp-hidden" aria-hidden="true">뜻은 잠시 뒤에 나와요</div>}
          {showJp ? (
            <div className="sp-answer">
              <div className="sp-jp" lang="ja">{item.jp}</div>
              {item.kana && <div className="sp-kana" lang="ja">{item.kana}</div>}
            </div>
          ) : (
            <div className="sp-answer sp-wait" aria-hidden="true">{step === 'think' ? '🗣' : '…'}</div>
          )}
          {/* 남은 시간 막대 — 걸음이 바뀔 때마다 처음부터 다시 찬다 */}
          <div className="sp-bar" key={`${run.index}:${run.step}:${nudge}:${paused ? 'p' : 'r'}`} aria-hidden="true">
            <i style={{ animationDuration: `${ms}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
          </div>
        </div>
        <div className="sp-controls">
          <button className="ghost-btn sp-prev" onClick={goPrev} disabled={run.index === 0} aria-label="이전 문장">이전</button>
          <button className="submit-btn sp-pause" onClick={() => setPaused((v) => !v)} aria-pressed={paused}>
            {paused ? '이어서' : '잠시 멈춤'}{hasKeyboard && <kbd className="inline-key">Space</kbd>}
          </button>
          <button className="ghost-btn sp-next" onClick={goNext} aria-label="다음 문장">다음</button>
        </div>
        <button className="ghost-btn sp-replay" onClick={replay}><IconSpeaker /> 다시 듣기</button>
      </div>
    );
  }

  /* ── 설정 ── */
  const available = counts[prefs.source] || 0;
  return (
    <div className="speak sp-setup">
      <div className="navtitle"><small>보고 · 생각하고 · 말하기</small>말하기 연습</div>
      <p className="set-note sp-lead">마이크는 쓰지 않아요. 틀어 두면 문장이 저절로 넘어가요: {prefs.dir === SPEAK_DIR.JP_KO ? '일본어 → 따라 말하기 → 뜻과 일본어' : '뜻 → 말할 시간 → 정답'}{prefs.again ? ' → 한 번 더 말하기' : ''}.</p>

      <div className="section-label">방향</div>
      <div className="ls-pills sp-dirs">
        <button className={`ls-pill${prefs.dir === SPEAK_DIR.KO_JP ? ' active' : ''}`} data-dir="ko-jp" aria-pressed={prefs.dir === SPEAK_DIR.KO_JP} onClick={() => setPref('dir', SPEAK_DIR.KO_JP)}>한국어 보고 일본어로 말하기</button>
        <button className={`ls-pill${prefs.dir === SPEAK_DIR.JP_KO ? ' active' : ''}`} data-dir="jp-ko" aria-pressed={prefs.dir === SPEAK_DIR.JP_KO} onClick={() => setPref('dir', SPEAK_DIR.JP_KO)}>일본어 듣고 따라 말하기</button>
      </div>

      <div className="section-label">말할 시간</div>
      <div className="ls-pills sp-thinks">
        {THINK_SECONDS.map((s) => <button key={s} className={`ls-pill${prefs.think === s ? ' active' : ''}`} aria-pressed={prefs.think === s} onClick={() => setPref('think', s)}>{s}초</button>)}
      </div>

      <div className="section-label">정답을 들은 뒤</div>
      <div className="ls-pills sp-agains">
        <button className={`ls-pill${prefs.again ? ' active' : ''}`} data-again="1" aria-pressed={prefs.again} onClick={() => setPref('again', true)}>한 번 더 말하기</button>
        <button className={`ls-pill${!prefs.again ? ' active' : ''}`} data-again="0" aria-pressed={!prefs.again} onClick={() => setPref('again', false)}>바로 다음 문장</button>
      </div>

      <div className="section-label">문장</div>
      <div className="ls-pills sp-sources">
        {[[SPEAK_SOURCE.MIX, '섞어서'], [SPEAK_SOURCE.AI, 'AI 문장'], [SPEAK_SOURCE.LEARNED, '배운 문장']].map(([id, label]) => (
          <button key={id} className={`ls-pill${prefs.source === id ? ' active' : ''}`} data-source={id} aria-pressed={prefs.source === id} onClick={() => setPref('source', id)}>
            {label} <span className="pk-count">{counts[id]}개</span>
          </button>
        ))}
      </div>
      {prefs.source !== SPEAK_SOURCE.LEARNED && batches.length > 1 && (
        <>
          <div className="section-label">AI 문장 회차</div>
          <div className="ls-pills sp-batches">
            <button className={`ls-pill${allBatches ? ' active' : ''}`} data-batch="all" aria-pressed={allBatches} onClick={() => setPref('batches', [])}>
              전체 섞기 <span className="pk-count">{saved.length}개</span>
            </button>
            {[...batches].reverse().map((b) => {
              const on = picked.includes(b.id);
              return (
                <button key={b.id} className={`ls-pill${on ? ' active' : ''}`} data-batch={b.id} data-no={b.no} aria-pressed={on} onClick={() => toggleBatch(b.id)}>
                  {batchLabel(b)} <span className="pk-count">{b.items.length}개</span>
                </button>
              );
            })}
          </div>
          <p className="set-note sp-batchnote">회차를 누를 때마다 골랐다 뺐다 해요. 여러 개를 고르면 그 문장들을 섞어서 아래에서 정한 수만큼 내요.</p>
        </>
      )}
      <div className="ls-pills sp-counts">
        {SPEAK_COUNTS.map((n) => <button key={n} className={`ls-pill${prefs.count === n ? ' active' : ''}`} aria-pressed={prefs.count === n} onClick={() => setPref('count', n)}>{n}문장</button>)}
      </div>

      <button className="bigstart sp-start" onClick={start} disabled={available === 0}>
        <span className="bs-t"><IconPlay /> 말하기 시작</span>
        <span className="bs-s">{available === 0 ? '연습할 문장이 없어요 — 아래에서 AI로 만들어요' : `${Math.min(prefs.count, available)}문장 · 저절로 넘어가요`}</span>
      </button>

      <div className="section-label">AI로 문장 만들기</div>
      <div className="card sp-gen">
        <input
          className="search-input sp-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC_CHARS))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (hasAi) make(); } }}
          placeholder="주제 (예: 식당에서 주문 · 회사 회의 · 친구와 약속)"
          aria-label="문장 주제"
        />
        <button className="submit-btn sp-make" onClick={make} disabled={busy || !hasAi}>{busy ? '만드는 중…' : `JLPT ${level} 수준으로 ${GEN_COUNT}문장 만들기`}</button>
        {!hasAi && <p className="set-note">설정에서 AI 키를 넣으면 주제에 맞는 문장을 만들어 저장할 수 있어요.</p>}
        {hasAi && <p className="set-note">주제를 비워 두면 일상 회화로 만들어요. 만든 문장은 저장되고 다른 기기에도 넘어가요. AI가 만든 문장이라 어색한 것이 있으면 지워 주세요.</p>}
        {err && <p className="ask-err sp-err">{err}</p>}
        <button className="listrow sp-savedrow" onClick={() => setShowSaved((v) => !v)} aria-expanded={showSaved} disabled={saved.length === 0}>
          <span className="rv-body"><b>저장한 AI 문장 {saved.length}개{batches.length > 1 ? ` · ${batches.length}회차` : ''}</b><span>{saved.length ? '눌러서 보고, 필요 없는 문장은 지워요' : '아직 없어요'}</span></span>
          <IconChevron className="chev" />
        </button>
        {showSaved && saved.length > 0 && (
          <div className="sp-saved">
            {[...batches].reverse().map((b) => (
              <div key={b.id} className="sp-batch" data-batch={b.id}>
                <div className="sp-batchhead"><b>{batchLabel(b, 24)}</b><span>{b.items.length}개</span></div>
                {b.items.map((s) => (
                  <div key={s.id} className="sp-row" data-id={s.id}>
                    <span className="sp-rowbody">
                      <b lang="ja">{s.jp}</b>
                      {s.kana && <small lang="ja">{s.kana}</small>}
                      <span>{s.ko}</span>
                    </span>
                    <button className="sp-say" onClick={() => speakJapanese(readingText(s.kana, s.jp), settings.speechRate)} aria-label={`${s.jp} 듣기`}><IconSpeaker /></button>
                    <button className="sp-del" onClick={() => drop(s.id)} aria-label={`${s.jp} 지우기`}><IconTrash /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
