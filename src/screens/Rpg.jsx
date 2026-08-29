import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconSpeaker, IconCheck, IconX, IconBulb, IconChevron } from '../components/Icons.jsx';
import { speakJapanese } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { STAGES, COMING } from '../data/rpg.js';
import {
  FORM, buildDrill, buildCheckpoint, reask, passed, masteryOf, MASTERY_LABEL,
  scoreForHints, gradeOf, expFor, levelOf, levelProgress, verdictsFrom, PASS,
} from '../lib/rpg.js';

/* 일본 생존.
 *
 * 흐름은 하나다 — 익히기 → 반복 → 체크포인트 → 실전 → 결과.
 * 새 라우터를 넣지 않고 상태 하나로 넘긴다(활용·짝맞추기 화면과 같은 방식).
 *
 * 게임 요소(체력·EXP·레벨·콤보)는 이 화면 안에서만 보인다. 오늘 탭이나
 * 기록 탭으로는 한 글자도 안 나간다 — 거기 섞이면 학습 기록이 게임 점수로
 * 오염된다. */

const HEARTS = 3;
const FEEDBACK_MS = 700;   // 짧게. 매번 「다음」을 누르게 하지 않는다.

function Speak({ text, kana, big }) {
  return (
    <button className="rp-say" onClick={() => speakJapanese(kana || text)} aria-label="발음 듣기">
      <IconSpeaker />
      <span className={big ? 'rp-jp big' : 'rp-jp'}>{text}</span>
    </button>
  );
}

export default function Rpg({ review, progress, settings, onReview, onProgress, onToast }) {
  const saved = progress.rpg || { exp: 0, stages: {} };
  const [stageId, setStageId] = useState(null);
  const [phase, setPhase] = useState('learn');   // learn | drill | check | live | result
  const stage = useMemo(() => STAGES.find((s) => s.id === stageId) || null, [stageId]);

  if (!stage) {
    return <Pick saved={saved} onPick={(id, ph) => { setStageId(id); setPhase(ph); }} />;
  }
  return (
    <Play
      key={`${stage.id}:${phase}`}
      stage={stage}
      phase={phase}
      setPhase={setPhase}
      review={review}
      saved={saved}
      settings={settings}
      onReview={onReview}
      onProgress={onProgress}
      onToast={onToast}
      onQuit={() => setStageId(null)}
    />
  );
}

/* ── 어디로 갈지 고르기 ── */
function Pick({ saved, onPick }) {
  const exp = saved.exp || 0;
  return (
    <div className="rp">
      <div className="rp-lv">
        <div className="rp-lvrow">
          <b>日本 SURVIVAL</b>
          <span>LV. {levelOf(exp)}</span>
        </div>
        <div className="rp-bar"><i style={{ width: `${levelProgress(exp)}%` }} /></div>
        <span className="rp-exp">EXP {exp}</span>
      </div>

      {STAGES.map((s) => {
        const st = saved.stages?.[s.id] || {};
        const unlocked = st.checkpoint >= PASS;
        return (
          <div key={s.id} className="rp-stage">
            <div className="rp-sthead">
              <span className="rp-icon">{s.icon}</span>
              <span className="rp-stbody">
                <b>{s.label}</b>
                <span>{st.cleared ? `${st.cleared}번 통과 · 최고 ${st.best || 0}점` : s.goal}</span>
              </span>
            </div>
            <div className="rp-stacts">
              <button className="ghost-btn" onClick={() => onPick(s.id, 'learn')}>
                {st.learned ? '다시 익히기' : '표현 익히기'}
              </button>
              <button
                className="submit-btn"
                disabled={!unlocked}
                onClick={() => onPick(s.id, 'live')}
              >
                {unlocked ? '실전' : '실전 🔒'}
              </button>
            </div>
            {!unlocked && (
              <p className="set-note">체크포인트를 {Math.round(PASS * 100)}% 넘기면 실전이 열려요</p>
            )}
          </div>
        );
      })}

      <div className="section-label">다음 장소</div>
      <div className="rp-soon">
        {COMING.map((c) => (
          <span key={c.id} className="rp-soonone">{c.icon} {c.label} 🔒</span>
        ))}
      </div>
    </div>
  );
}

/* ── 한 스테이지를 실제로 하는 곳 ── */
function Play({ stage, phase, setPhase, review, saved, settings, onReview, onProgress, onToast, onQuit }) {
  const canListen = settings.autoTTS !== false;

  // 익히기
  const [at, setAt] = useState(0);

  // 반복 · 체크포인트
  const [queue, setQueue] = useState(() => (
    phase === 'drill' ? buildDrill(stage, review, { canListen }) : []
  ));
  const [answered, setAnswered] = useState(null);
  const [right, setRight] = useState(0);
  const [asked, setAsked] = useState(0);

  // 실전
  const [scene, setScene] = useState(0);
  const [hints, setHints] = useState(0);        // 이 장면에서 연 힌트 수
  const [combo, setCombo] = useState(0);
  const [hearts, setHearts] = useState(HEARTS);
  const [log, setLog] = useState({ score: 0, hits: 0, tries: 0, hintTotal: 0, best: 0, wrong: [], hinted: [] });
  const [result, setResult] = useState(null);
  const advance = useRef(null);

  useEffect(() => () => clearTimeout(advance.current), []);

  /* 실전이 끝나면 정산한다.
   *
   * 그리는 중에 하지 않는다. 회독 기록을 올리고 EXP를 더하는 일은 부모의
   * 상태를 바꾸는 일이라, 렌더 안에서 하면 같은 판이 두 번 계산되는 순간
   * 점수가 두 번 붙는다. 화면을 다 그린 뒤 한 번만 돈다. */
  const over = phase === 'live' && !result && scene >= stage.scenes.length;
  useEffect(() => {
    if (!over) return;
    const rate = log.tries ? log.hits / log.tries : 0;
    const gained = expFor({ score: log.score, combo: log.best, hints: log.hintTotal });
    const out = { ...log, rate, grade: gradeOf(rate), exp: gained };

    // 못한 것만 회독으로 넘긴다 — 잘한 건 안 올린다
    const v = verdictsFrom(out);
    if (Object.keys(v).length) onReview(v);

    const prev = saved.stages?.[stage.id] || {};
    onProgress({
      ...saved,
      exp: (saved.exp || 0) + gained,
      stages: {
        ...saved.stages,
        [stage.id]: {
          ...prev,
          learned: true,
          checkpoint: Math.max(prev.checkpoint || 0, PASS),
          cleared: (prev.cleared || 0) + 1,
          best: Math.max(prev.best || 0, log.score),
        },
      },
    });
    setResult(out);
  }, [over]);   // eslint-disable-line react-hooks/exhaustive-deps

  const startDrill = () => {
    const q = buildDrill(stage, review, { canListen });
    if (!q.length) { onToast('연습할 표현이 모자라요'); return; }
    setQueue(q); setAnswered(null); setRight(0); setAsked(0);
    setPhase('drill');
  };

  const startCheck = (only) => {
    const q = buildCheckpoint(stage, review, { only });
    if (!q.length) { onToast('시험 볼 표현이 모자라요'); return; }
    setQueue(q); setAnswered(null); setRight(0); setAsked(0);
    setPhase('check');
  };

  /* ── 익히기 ── */
  if (phase === 'learn') {
    const e = stage.expressions[at];
    const last = at >= stage.expressions.length - 1;
    return (
      <div className="rp">
        <Head label={`${stage.icon} ${stage.label}`} sub={`표현 익히기 ${at + 1} / ${stage.expressions.length}`} onQuit={onQuit} />
        <div className="rp-learn">
          <Speak text={e.jp} kana={e.kana} big />
          <div className="rp-kana">{e.kana}{settings.hangulPron && ` · ${kanaToHangul(e.kana)}`}</div>
          <div className="rp-ko">{e.ko}</div>
          {e.note && <p className="rp-note">{e.note}</p>}
          <div className="rp-mastery">{MASTERY_LABEL[masteryOf(review, e.id)]}</div>
        </div>
        {/* 새 표현을 처음 볼 때는 읽을 시간이 필요하다 — 여기만 직접 넘긴다 */}
        <button
          className="bigstart"
          onClick={() => (last ? startDrill() : setAt((n) => n + 1))}
        >
          <span className="bs-t">{last ? '연습 시작' : '다음'}</span>
        </button>
      </div>
    );
  }

  /* ── 반복 · 체크포인트 ── */
  if (phase === 'drill' || phase === 'check') {
    const q = queue[0];
    if (!q) {
      // 체크포인트가 끝났다
      if (phase === 'check') {
        const rate = asked ? right / asked : 0;
        const okPass = passed(right, asked);
        const wrongIds = [...new Set(queue.wrongIds || [])];
        return (
          <div className="rp">
            <Head label={`${stage.icon} ${stage.label}`} sub="체크포인트" onQuit={onQuit} />
            <div className="finish">
              <div className="fin-badge">{okPass ? '🎉' : '💪'}</div>
              <h2>{okPass ? '실전으로 갈 수 있어요' : '조금만 더 하면 돼요'}</h2>
              <div className="fin-big"><b>{Math.round(rate * 100)}</b><span>% 맞힘</span></div>
              {okPass ? (
                <button
                  className="submit-btn"
                  onClick={() => {
                    onProgress({
                      ...saved,
                      stages: { ...saved.stages, [stage.id]: { ...(saved.stages?.[stage.id] || {}), learned: true, checkpoint: rate } },
                    });
                    setScene(0); setHints(0); setCombo(0); setHearts(HEARTS);
                    setLog({ score: 0, hits: 0, tries: 0, hintTotal: 0, best: 0, wrong: [], hinted: [] });
                    setPhase('live');
                  }}
                >실전으로</button>
              ) : (
                <button className="submit-btn" onClick={() => startCheck(wrongIds.length ? wrongIds : null)}>
                  틀린 것만 다시
                </button>
              )}
              <button className="ghost-btn" onClick={startDrill}>연습 더 하기</button>
            </div>
          </div>
        );
      }
      // 반복이 끝났다 → 체크포인트로
      return (
        <div className="rp">
          <Head label={`${stage.icon} ${stage.label}`} sub="연습 끝" onQuit={onQuit} />
          <div className="finish">
            <div className="fin-badge">✅</div>
            <h2>연습 끝났어요</h2>
            <div className="fin-big"><b>{right}</b><span>/ {asked} 맞힘</span></div>
            <button className="submit-btn" onClick={() => startCheck(null)}>체크포인트 보기</button>
            <button className="ghost-btn" onClick={startDrill}>한 번 더 연습</button>
          </div>
        </div>
      );
    }

    const pick = (opt) => {
      if (answered) return;
      const good = q.form === FORM.REPLY ? opt.ok : opt.id === q.answerId;
      setAnswered({ id: opt.id, good, why: opt.why });
      setAsked((n) => n + 1);
      if (good) setRight((n) => n + 1);

      advance.current = setTimeout(() => {
        setAnswered(null);
        setQueue((rest) => {
          const next = rest.slice(1);
          if (!good) {
            // 그대로 또 물으면 답을 외우지 뜻을 외우지 않는다
            const again = reask(q, stage, review, asked + 1);
            next.wrongIds = [...(rest.wrongIds || []), q.exprId].filter(Boolean);
            if (again && phase === 'drill') next.splice(Math.min(3, next.length), 0, again);
          } else {
            next.wrongIds = rest.wrongIds || [];
          }
          return next;
        });
      }, FEEDBACK_MS);
    };

    return (
      <div className="rp">
        <Head
          label={`${stage.icon} ${stage.label}`}
          sub={phase === 'check' ? `체크포인트 · 남은 ${queue.length}` : `연습 · 남은 ${queue.length}`}
          onQuit={onQuit}
        />
        <div className="rp-q">
          {q.form === FORM.LISTEN ? (
            <button className="rp-listen" onClick={() => speakJapanese(q.speak)} aria-label="다시 듣기">
              <IconSpeaker />
            </button>
          ) : q.form === FORM.REPLY ? (
            <>
              <div className="rp-npcline">점원</div>
              <Speak text={q.npc.jp} kana={q.npc.kana} big />
            </>
          ) : (
            <div className="rp-prompt">{q.prompt}</div>
          )}
          <div className="rp-ask">{q.ask}</div>
        </div>

        <div className="qoptions">
          {q.options.map((o) => {
            const isAnswer = q.form === FORM.REPLY ? o.ok : o.id === q.answerId;
            const mine = answered?.id === o.id;
            let cls = 'qopt';
            if (answered) {
              if (mine) cls += answered.good ? ' correct' : ' wrong';
              else if (isAnswer && !answered.good) cls += ' correct';
              else cls += ' dim';
            }
            return (
              <button key={o.id} className={cls} disabled={Boolean(answered)} onClick={() => pick(o)}>
                <span className="qo-body"><b>{o.text}</b></span>
                {answered && mine && (answered.good
                  ? <span className="qo-mark ok"><IconCheck /> 통했다</span>
                  : <span className="qo-mark no"><IconX /> 다시 생각해 보자</span>)}
              </button>
            );
          })}
        </div>
        {answered && !answered.good && answered.why && <p className="rp-why">{answered.why}</p>}
      </div>
    );
  }

  /* ── 실전 ── */
  if (phase === 'live') {
    if (result) {
      return (
        <Result
          stage={stage}
          r={result}
          onAgain={() => {
            setResult(null); setScene(0); setHearts(HEARTS); setCombo(0); setHints(0);
            setLog({ score: 0, hits: 0, tries: 0, hintTotal: 0, best: 0, wrong: [], hinted: [] });
          }}
          onQuit={onQuit}
        />
      );
    }
    const sc = stage.scenes[scene];
    if (!sc) return null;   // 정산 중 — 위 effect가 한 프레임 뒤에 결과를 넣는다

    const answer = (c) => {
      if (answered) return;
      const gain = c.ok ? scoreForHints(hints) : 0;
      setAnswered({ id: c.jp, good: c.ok, why: c.why, note: c.note });
      const nextCombo = c.ok ? combo + 1 : 0;
      setCombo(nextCombo);
      if (!c.ok) setHearts((h) => h - 1);
      setLog((l) => ({
        ...l,
        score: l.score + gain,
        hits: l.hits + (c.ok ? 1 : 0),
        tries: l.tries + 1,
        hintTotal: l.hintTotal + hints,
        best: Math.max(l.best, nextCombo),
        wrong: c.ok ? l.wrong : [...l.wrong, ...(sc.choices.find((x) => x.ok)?.uses || [])],
        hinted: hints > 0 ? [...l.hinted, ...(c.uses || sc.choices.find((x) => x.ok)?.uses || [])] : l.hinted,
      }));

      advance.current = setTimeout(() => {
        setAnswered(null);
        setHints(0);
        if (!c.ok && hearts - 1 <= 0) { setScene(stage.scenes.length); return; }
        setScene((n) => n + 1);
      }, c.ok ? FEEDBACK_MS + 300 : 1600);
    };

    return (
      <div className="rp live">
        <div className="rp-livehead">
          <button className="sh-close" onClick={onQuit} aria-label="그만두기"><IconChevron style={{ transform: 'rotate(180deg)' }} /></button>
          <span className="rp-hearts">{'❤️'.repeat(Math.max(0, hearts))}{'🖤'.repeat(HEARTS - Math.max(0, hearts))}</span>
          {combo >= 2 && <span className="rp-combo">🔥 {combo}</span>}
          <span className="rp-step">{scene + 1} / {stage.scenes.length}</span>
        </div>

        <div className="rp-scene">
          <div className="rp-npcline">점원</div>
          {/* 실전은 한글 뜻을 안 보여 준다. 힌트를 눌러야만 열린다.
              읽는 법은 가리지 않는다 — 「お支払い」를 못 읽으면 어려운 게 아니라
              아예 못 푸는 문제가 된다. 가려야 할 건 뜻이지 소리가 아니다. */}
          <Speak text={sc.npc.jp} kana={sc.npc.kana} big />
          <div className="rp-kana">
            {sc.npc.kana}
            {settings.hangulPron && ` · ${kanaToHangul(sc.npc.kana)}`}
          </div>
          <div className="rp-ask">{sc.ask}</div>

          {hints > 0 && (
            <div className="rp-hints">
              {sc.hints.slice(0, hints).map((h) => <p key={h}>{h}</p>)}
            </div>
          )}
        </div>

        <div className="qoptions">
          {sc.choices.map((c) => {
            const mine = answered?.id === c.jp;
            let cls = 'qopt';
            if (answered) {
              if (mine) cls += c.ok ? ' correct' : ' wrong';
              else cls += ' dim';
            }
            return (
              <button key={c.jp} className={cls} disabled={Boolean(answered)} onClick={() => answer(c)}>
                <span className="qo-body"><b>{c.jp}</b></span>
                {answered && mine && (c.ok
                  ? <span className="qo-mark ok"><IconCheck /> 통했다</span>
                  : <span className="qo-mark no"><IconX /> 다시 생각해 보자</span>)}
              </button>
            );
          })}
        </div>

        {!answered && hints < sc.hints.length && (
          <button className="rp-hintbtn" onClick={() => setHints((n) => n + 1)}>
            <IconBulb /> 힌트 {hints > 0 ? `(${scoreForHints(hints + 1)}점)` : ''}
          </button>
        )}
        {answered && (
          <p className="rp-why">
            {answered.good ? (answered.note || sc.reaction.ok) : `${sc.reaction.no} — ${answered.why || ''}`}
          </p>
        )}
      </div>
    );
  }

  return null;
}

function Head({ label, sub, onQuit }) {
  return (
    <div className="rp-head">
      <button className="sh-close" onClick={onQuit} aria-label="그만두기"><IconChevron style={{ transform: 'rotate(180deg)' }} /></button>
      <div className="rp-headbody"><b>{label}</b><span>{sub}</span></div>
    </div>
  );
}

function Result({ stage, r, onAgain, onQuit }) {
  const back = [...new Set([...(r.wrong || []), ...(r.hinted || [])])];
  const byId = new Map(stage.expressions.map((e) => [e.id, e]));
  return (
    <div className="rp">
      <div className="finish">
        <div className="fin-badge">{r.rate >= PASS ? '🎉' : '💪'}</div>
        <h2>{r.rate >= PASS ? `${stage.label} 생존 성공` : '조금만 더 하면 돼요'}</h2>
        <div className="fin-big"><b>{r.score}</b><span>점 · {r.grade}</span></div>
        <div className="fin-grid">
          <div className="fin-cell ok"><b>{Math.round(r.rate * 100)}%</b><span>정답률</span></div>
          <div className="fin-cell mid"><b>{r.hintTotal}</b><span>힌트</span></div>
          <div className="fin-cell no"><b>{r.best}</b><span>연속 정답</span></div>
        </div>
        <p className="fin-lines"><span>EXP +{r.exp}</span></p>

        {back.length > 0 && (
          <div className="rp-back">
            <div className="section-label">다시 볼 표현</div>
            {back.map((id) => {
              const e = byId.get(id);
              if (!e) return null;
              return (
                <div key={id} className="rp-backone">
                  <b>{e.jp}</b><i>{e.kana}</i><span>{e.ko}</span>
                </div>
              );
            })}
            <p className="set-note">오늘의 학습에 약점으로 올라가요</p>
          </div>
        )}

        <button className="submit-btn" onClick={onAgain}>한 번 더</button>
        <button className="ghost-btn" onClick={onQuit}>돌아가기</button>
      </div>
    </div>
  );
}
