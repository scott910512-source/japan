import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArrowLeft } from '../components/Icons.jsx';
import { todayKey } from '../lib/review.js';
import { useToday } from '../lib/useToday.js';
import {
  normalizeN3, ensureDayPlan, buildDayPlan, markStep, markLesson, recordAnswer, recordTest, recordExam,
  applyDiagnosis, progressOf, readinessOf, todayAmount, weekAmount, dueInCourse, weakPatterns, weakSession,
  reviewQuestions, verdictFor, trackOf, lessonTitle, lessonOf, TEST_TITLES, TRACKS,
} from '../lib/n3.js';
import { vocabWordById } from '../data/n3/vocab.js';
import { kanjiByChar } from '../data/n3/kanji.js';
import N3Hub from './n3/N3Hub.jsx';
import N3Today from './n3/N3Today.jsx';
import N3Curriculum from './n3/N3Curriculum.jsx';
import GrammarLesson from './n3/GrammarLesson.jsx';
import VocabLesson from './n3/VocabLesson.jsx';
import KanjiLesson, { KanjiCard } from './n3/KanjiLesson.jsx';
import ReadingLesson from './n3/ReadingLesson.jsx';
import ListeningLesson from './n3/ListeningLesson.jsx';
import QuizRunner from './n3/QuizRunner.jsx';
import N3Test from './n3/N3Test.jsx';
import N3Exam from './n3/N3Exam.jsx';
import N3Wrong from './n3/N3Wrong.jsx';

/* 「한 권으로 끝내는 N3」 — 화면들을 잇는 자리.
 *
 * 규칙은 전부 lib/n3.js에 있다. 여기서 하는 일은 셋뿐이다.
 *   · 어느 화면을 보여 줄지(view)
 *   · 문제의 답을 기록하고(recordAnswer) 판정을 회독 저장소로 넘기기(applyVerdicts)
 *   · 레슨·단계·시험이 끝났을 때 진도에 적기
 *
 * 단어 카드에서 「회독으로 더 외우기」를 누르면 회독 화면이 전체를 덮으면서
 * 이 화면이 내려간다. 돌아왔을 때 하던 자리로 와야 하니, 그때만 view를
 * sessionStorage에 적어 두고 다음 mount에서 한 번 꺼내 쓴다. 평소에 들어올 때는
 * 늘 메인부터다 — 어제 하다 만 레슨 한가운데로 떨어지면 어디인지 모른다. */
const VIEW_KEY = 'jp_n3_view_v1';

function readView() {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY) || 'null');
    sessionStorage.removeItem(VIEW_KEY);
    return v && typeof v === 'object' && v.kind ? v : { kind: 'hub' };
  } catch { return { kind: 'hub' }; }
}

/* 회독 저장소에 적을 수 있는 id인가 — 문법(g:)·한자(k:漢)·단어 */
function cardRef(ref) {
  if (!ref) return null;
  if (ref.startsWith('g:')) return ref;
  if (ref.startsWith('k:') && !/^k:\d+$/.test(ref)) return ref;
  if (vocabWordById(ref)) return ref;
  return null;
}

export default function N3Course({ review, progress, setProgress, applyVerdicts, settings, streak, onStartSet, onToast, initialView = null }) {
  const today = useToday();
  const n3 = useMemo(() => normalizeN3(progress?.n3), [progress?.n3]);
  const setN3 = useCallback((fn) => setProgress((p) => ({ ...p, n3: fn(normalizeN3(p?.n3)) })), [setProgress]);
  /* 회독 화면에서 돌아온 자리가 있으면 그게 먼저. 없으면 밖에서 시킨 자리
     (학습 탭 「한자」 → 한자 과정, 복습 탭 「틀린 문제」 → 오답노트), 그것도
     없으면 메인. */
  const [view, setView] = useState(() => { const v = readView(); return v.kind !== 'hub' ? v : (initialView || v); });
  const rate = settings?.speechRate || 0.9;

  /* 오늘 계획은 열자마자 한 번 짜 둔다 — 홈의 「오늘의 N3」 줄이 단계 수를 적어야 한다 */
  useEffect(() => {
    const { n3: next, plan } = ensureDayPlan(n3, review, today);
    if (plan !== n3.days[today]) setN3(() => next);
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  const day = n3.days[today] || null;
  const prog = useMemo(() => progressOf(n3, review), [n3, review]);
  const ready = useMemo(() => readinessOf(n3, review), [n3, review]);
  const due = useMemo(() => dueInCourse(review, today), [review, today]);
  const weak = useMemo(() => weakPatterns(n3, 8), [n3]);

  /* ★ 홈이 읽는 요약을 여기서 적는다 ★
     홈·학습·내 학습은 코스 자료를 안 불러온다(메인 번들을 가볍게). 그래서
     「JLPT N3 68% · 42/120」는 코스가 열릴 때마다 실제 진도·준비도로 적어 둔
     요약(progress.n3.summary)에서 그린다. 숫자가 같으면 안 적는다 — 매번
     적으면 저장·동기화가 헛돈다. */
  useEffect(() => {
    const areas = { vocab: ready.vocab, kanji: ready.kanji, grammar: ready.grammar, reading: ready.reading, listening: ready.listening };
    const cur = n3.summary;
    const same = cur && cur.done === prog.done && cur.total === prog.total && cur.ready === ready.total
      && TRACKS.every((t) => cur.areas?.[t] === areas[t]);
    if (same) return;
    setN3((p) => ({ ...p, summary: { done: prog.done, total: prog.total, pct: prog.pct, ready: ready.total, areas, at: Date.now() } }));
  }, [prog, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 복습·약점 판은 들어올 때 한 번만 짠다. 답을 적을 때마다 n3가 바뀌어 다시
     그려지는데, 그때 다시 섞으면 풀던 문제가 자리를 옮겨 버린다. */
  const session = useMemo(() => {
    if (view.kind === 'weak') return weakSession(n3, 12);
    if (view.kind === 'review') return { questions: reviewQuestions(view.ids || due.slice(0, 20)), patterns: [] };
    return null;
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 답 하나 ── */
  const onAnswer = useCallback((q, ok) => {
    setN3((p) => recordAnswer(p, { qid: q.id, ok, cat: q.cat || 'grammar', ref: q.ref || null, today: todayKey() }));
  }, [setN3]);

  /* ── 한 판의 결과를 회독 판정으로. 같은 카드가 여러 번이면 합쳐서 한 번만 ── */
  const applyResults = useCallback((results, forceRef = null) => {
    const agg = {};
    for (const { q, ok } of results || []) {
      const ref = cardRef(forceRef || q?.ref);
      if (!ref) continue;
      const a = agg[ref] || (agg[ref] = { r: 0, t: 0 });
      a.t += 1; if (ok) a.r += 1;
    }
    const map = {};
    for (const [ref, a] of Object.entries(agg)) map[ref] = verdictFor(a.r, a.t);
    if (Object.keys(map).length) applyVerdicts(map);
    return map;
  }, [applyVerdicts]);

  const goHub = () => setView({ kind: 'hub' });
  const goToday = () => { setN3((p) => ensureDayPlan(p, review, today).n3); setView({ kind: 'today' }); };
  const backFrom = (v) => {
    if (v.from === 'today') return { kind: 'today' };
    if (v.from === 'curriculum') return { kind: 'curriculum', chapter: v.chapter || null };
    if (v.from === 'wrong') return { kind: 'wrong' };
    return { kind: 'hub' };
  };

  /* 단계·레슨이 끝났을 때 */
  const finishLesson = (v, r) => {
    const id = v.id;
    const t = trackOf(id);
    if (t === 'grammar') { applyResults(r.results, id); setN3((p) => markLesson(p, id, { score: r.total ? r.right / r.total : null })); }
    else if (t === 'reading' || t === 'listening') { setN3((p) => markLesson(recordTest(p, id, { right: r.right, total: r.total }), id, { score: r.total ? r.right / r.total : null })); }
    else applyResults(r.results);
    if (v.from === 'today' && v.step != null) setN3((p) => markStep(p, today, v.step, true));
    if (r.total) onToast?.(`${r.right} / ${r.total} 맞혔어요 · 기록했어요`);
    setView(backFrom(v));
  };

  const openLesson = (id, from = 'curriculum', extra = {}) => setView({ kind: 'lesson', id, from, ...extra });
  const openRef = (ref) => {
    if (!ref) return;
    if (ref.startsWith('g:')) { openLesson(ref, 'wrong'); return; }
    if (ref.startsWith('k:') && !/^k:\d+$/.test(ref)) { setView({ kind: 'kanjicard', id: ref, from: 'wrong' }); return; }
    if (vocabWordById(ref)) { setView({ kind: 'lesson', id: 'word', word: ref, from: 'wrong' }); return; }
    if (ref.startsWith('r:') || ref.startsWith('l:')) openLesson(ref, 'wrong');
  };

  /* ── 화면 ── */
  if (view.kind === 'today') {
    return (
      <N3Today
        day={day}
        today={today}
        onBack={goHub}
        onRebuild={() => { setN3((p) => ({ ...p, days: { ...p.days, [today]: { ...(p.days[today] || {}), steps: buildDayPlan(p, review, today).steps, built: Date.now() } } })); }}
        onRun={(i) => {
          const s = day?.steps?.[i];
          if (!s) return;
          if (s.kind === 'review') setView({ kind: 'review', ids: s.ids, from: 'today', step: i });
          else setView({ kind: 'lesson', id: s.lesson, ids: s.ids || null, from: 'today', step: i });
        }}
      />
    );
  }

  if (view.kind === 'curriculum') {
    return (
      <N3Curriculum
        n3={n3} review={review} initialChapter={view.chapter || null}
        onBack={goHub}
        onOpenLesson={(id) => openLesson(id, 'curriculum', { chapter: view.chapter || null })}
        onOpenTest={(tid) => setView(tid === 'exam' ? { kind: 'exam', from: 'curriculum' } : { kind: 'test', id: tid, from: 'curriculum' })}
      />
    );
  }

  if (view.kind === 'lesson') {
    const id = view.id;
    const quit = () => setView(backFrom(view));
    if (id === 'word') {
      return (
        <VocabLesson title={vocabWordById(view.word)?.kanji || '단어'} wordIds={[view.word]} rate={rate} review={review}
          onAnswer={onAnswer} onFinish={(r) => finishLesson(view, r)} onQuit={quit} onKanji={(k) => setView({ kind: 'kanjicard', id: k.id, from: 'wrong' })} />
      );
    }
    const t = trackOf(id);
    if (t === 'vocab') {
      const l = lessonOf(id);
      const ids = view.ids || l.words.map((w) => w.id);
      return (
        <VocabLesson title={view.ids ? `오늘의 어휘 · ${l.title}` : l.title} wordIds={ids} rate={rate} review={review}
          onAnswer={onAnswer} onFinish={(r) => finishLesson(view, r)} onQuit={quit}
          onStartSet={onStartSet ? (words, title, did) => {
            try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* 무시 */ }
            onStartSet(words, title, did);
          } : null}
          onKanji={(k) => setView({ ...view, kind: 'kanjicard', id: k.id, back: view })} />
      );
    }
    if (t === 'kanji') {
      const l = lessonOf(id);
      const ids = view.ids || l.kanji.map((k) => k.id);
      return <KanjiLesson title={view.ids ? `오늘의 한자 · ${l.title}` : lessonTitle(id)} kanjiIds={ids} rate={rate} review={review} onAnswer={onAnswer} onFinish={(r) => finishLesson(view, r)} onQuit={quit} />;
    }
    if (t === 'grammar') {
      return <GrammarLesson lessonId={id} rate={rate} onAnswer={onAnswer} onFinish={(r) => finishLesson(view, r)} onQuit={quit} />;
    }
    if (t === 'reading') {
      return <ReadingLesson passageId={id} mode={view.mode || 'study'} rate={rate} onAnswer={onAnswer} onFinish={(r) => finishLesson(view, r)} onQuit={quit} onOpenGrammar={(g) => setView({ kind: 'lesson', id: g, from: 'curriculum' })} />;
    }
    if (t === 'listening') {
      return <ListeningLesson itemId={id} rate={rate} onAnswer={onAnswer} onFinish={(r) => finishLesson(view, r)} onQuit={quit} />;
    }
    return null;
  }

  if (view.kind === 'kanjicard') {
    const k = kanjiByChar(view.id.slice(2));
    return (
      <div className="n3-lesson">
        <div className="sub-header inline">
          <button className="sub-back" onClick={() => setView(view.back || backFrom(view))}><IconArrowLeft /> 뒤로</button>
          <div className="sub-title">한자 · {k?.k}</div>
        </div>
        {k && <KanjiCard k={k} rate={rate} review={review} />}
      </div>
    );
  }

  if (view.kind === 'review' || view.kind === 'weak') {
    const isWeak = view.kind === 'weak';
    return (
      <div className="n3-lesson n3-reviewrun" data-kind={view.kind}>
        <div className="sub-header inline">
          <button className="sub-back" onClick={() => setView(backFrom(view))}><IconArrowLeft /> 나가기</button>
          <div className="sub-title">{isWeak ? '약점만 공부하기' : '오늘의 복습'}</div>
        </div>
        {isWeak && session.patterns.length > 0 && (
          <div className="card n3-patterns" style={{ marginBottom: 12 }}>
            {session.patterns.map((p) => <div key={p.ref} className="n3-pattern static"><b>{p.title}</b><span>오답률 {p.rate}%</span></div>)}
          </div>
        )}
        {session.questions.length === 0 ? (
          <div className="empty-state">{isWeak ? '아직 약점이 없어요. 문제를 풀면 틀린 것이 여기 모여요.' : '지금 복습할 게 없어요.'}
            <div style={{ marginTop: 10 }}><button className="ghost-btn" onClick={() => setView(backFrom(view))}>돌아가기</button></div>
          </div>
        ) : (
          <QuizRunner
            questions={session.questions} rate={rate} onAnswer={onAnswer}
            onDone={(r) => {
              applyResults(r.results);
              if (view.from === 'today' && view.step != null) setN3((p) => markStep(p, today, view.step, true));
              onToast?.(`${r.right} / ${r.total} · 복습일을 다시 잡았어요`);
              setView(backFrom(view));
            }}
          />
        )}
      </div>
    );
  }

  if (view.kind === 'test') {
    return (
      <N3Test
        testId={view.id} n3={n3} review={review} rate={rate} onAnswer={onAnswer}
        onQuit={() => setView(backFrom(view))}
        onFinish={(r) => {
          setN3((p) => recordTest(p, view.id, { right: r.right, total: r.total }));
          applyResults(r.results);
          if (view.id === 't:ch0') {
            const map = {};
            for (const { q, ok } of r.results) if (q.ref) map[q.ref] = ok;
            setN3((p) => applyDiagnosis(p, map));
            const skipped = Object.values(map).filter(Boolean).length;
            onToast?.(`${skipped}꼭지는 건너뛰어요 · ${r.total - skipped}꼭지는 Chapter 0에서 배워요`);
          } else onToast?.(`${TEST_TITLES[view.id]} ${r.right} / ${r.total}`);
          setView(backFrom(view));
        }}
      />
    );
  }

  if (view.kind === 'exam') {
    return (
      <N3Exam
        rate={rate} onAnswer={onAnswer}
        onQuit={() => setView(backFrom(view))}
        onFinish={(res) => {
          setN3((p) => recordTest(recordExam(p, res), 'exam', { right: res.right, total: res.total, at: res.at }));
          onToast?.(`모의고사 ${Math.round((res.right / Math.max(1, res.total)) * 100)}% 저장했어요`);
          setView(backFrom(view));
        }}
      />
    );
  }

  if (view.kind === 'wrong') {
    return <N3Wrong n3={n3} onBack={goHub} onWeak={() => setView({ kind: 'weak', from: 'wrong' })} onOpenRef={openRef} />;
  }

  return (
    <N3Hub
      progress={prog} readiness={ready} today={todayAmount(n3, today)} week={weekAmount(n3, today)} streak={streak} day={day}
      dueCount={due.length} weakCount={weak.length}
      onStartToday={goToday}
      onCurriculum={() => setView({ kind: 'curriculum' })}
      onReview={() => (due.length ? setView({ kind: 'review', from: 'hub' }) : onToast?.('지금 복습할 게 없어요 — 배운 것의 복습일이 되면 여기 쌓여요'))}
      onExam={() => setView({ kind: 'curriculum', chapter: 'ch7' })}
      onWeak={() => setView({ kind: 'weak', from: 'hub' })}
      onWrong={() => setView({ kind: 'wrong' })}
    />
  );
}
