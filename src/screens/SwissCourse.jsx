import { useEffect, useMemo, useRef, useState } from 'react';
import { IconHeadphone, IconPlay, IconChevron } from '../components/Icons.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { loadSwiss, saveSwiss } from '../lib/storage.js';
import { SWISS_UNITS, SWISS_TRACKS, itemsOfUnit, lessonById } from '../data/swiss.js';
import {
  normalizeProgress, isUnlocked, nextLesson, recordLesson, courseSummary, buildReview,
} from '../lib/swissCourse.js';
import { MEMORY_STAGES, memorySummary, recordResults, seedMemory } from '../lib/swissMemory.js';
import SwissLesson from './SwissLesson.jsx';
import SwissListen from './SwissListen.jsx';

/* 독일어 여행 회화 코스 — 듀오링고처럼 단원 안의 레슨을 차례로.
 *
 * 기본은 표준 독일어다. 스위스에서 실제로 다르게 말하는 것만 🇨🇭 팁으로 붙는다.
 * 일본어 회독과는 다른 길이라 회독 기록·통계·오늘 계획에 안 붙고 진도는
 * 따로 적는다(storage의 swiss — 이름은 처음 만들 때 것을 그대로 둔다. 바꾸면
 * 이미 쌓인 진도를 못 찾는다).
 *
 * 화면은 넷이다.
 *   허브   복습 카드, 단원과 레슨, 진도, 자동재생 입구, 낱말 미리 보기
 *   레슨   문제 열 개쯤 — SwissLesson
 *   복습   복습일이 된 낱말을 굳은 정도에 맞는 문제로 — SwissLesson(mode=review)
 *   자동재생  배운 것을 소리로 흘려 듣기 — SwissListen
 *
 * ★ 반복해서 외운다 ★
 * 레슨을 끝낸 낱말은 「언제 다시 볼까」가 적힌다(lib/swissMemory.js). 복습일이 되면 허브에 오늘 복습이
 * 뜨고, 맞히면 복습 간격이 늘고 틀리면 오늘 다시 나온다. 굳을수록 보기 없이 직접 쓰게 된다. */

export const DE = 'de-DE';
export const CH = 'de-CH';

/* 낱말 카드 하나 — 뜻 → 독일어 → 🔊 순서. 한글 도움말은 있을 때만 작게.
   스위스 팁은 실제로 다른 말일 때만 아래에 붙고 자기 🔊를 갖는다. */
export function WordCard({ it, rate }) {
  return (
    <div className="card sw-card" data-item={it.id}>
      <div className="sw-ko">{it.ko}</div>
      <div className="sw-derow">
        <span className="sw-pic" aria-hidden="true">
          {it.swatch ? <i className="sw-swatch" style={{ background: it.swatch }} /> : (it.emoji || '')}
        </span>
        <b className="sw-word" lang="de">{it.de}</b>
        <SpeakButton text={it.de} lang={DE} rate={rate} id={`de:${it.id}`} className="sw-spk-main" />
      </div>
      {it.han && <div className="sw-han">{it.han}</div>}
      {it.note && <div className="sw-note">{it.note}</div>}
      {it.ch && (
        <div className="sw-tip" data-tip={it.id}>
          <span className="sw-tipflag" aria-hidden="true">🇨🇭</span>
          <span className="sw-tipbody">
            <span className="sw-tiplabel">스위스에서는:</span>
            <b lang="de-CH">{it.ch.text}</b>
            {it.ch.note && <span className="sw-tipnote">{it.ch.note}</span>}
          </span>
          <SpeakButton text={it.ch.text} lang={CH} rate={rate} id={`ch:${it.id}`} className="sw-spk-tip" label="스위스 표현 듣기" />
        </div>
      )}
    </div>
  );
}

export default function SwissCourse({ settings, onToast, initialView = null }) {
  /* 옛 진도에는 기억 칸이 없다 — 끝낸 레슨의 낱말을 그 자리에서 채워 읽는다(seedMemory) */
  const [progress, setProgressState] = useState(() => seedMemory(normalizeProgress(loadSwiss())));
  const progressRef = useRef(progress);
  const setProgress = (next) => { progressRef.current = next; setProgressState(next); saveSwiss(next); };
  const [view, setView] = useState('hub');   // hub | lesson | listen | review
  const [batch, setBatch] = useState(null);  // 복습 한 묶음 { exercises, key }
  const [lessonId, setLessonId] = useState(null);
  const [openUnit, setOpenUnit] = useState(null);   // 낱말을 펼쳐 둔 단원
  const rate = Math.min(settings?.speechRate || 0.9, 0.9);

  const summary = useMemo(() => courseSummary(progress), [progress]);
  const memory = useMemo(() => memorySummary(progress), [progress]);
  const next = useMemo(() => nextLesson(progress), [progress]);

  const start = (id) => { setLessonId(id); setView('lesson'); };

  /* 복습을 시작한다. 복습일이 된 것이 먼저, 모자라거나 일부러 미리 하는 거면(fill) 약한 것부터 채운다 */
  const startReview = (fill = false) => {
    const b = buildReview(progressRef.current, { fill });
    if (!b.exercises.length) {
      onToast?.('복습할 낱말이 아직 없어요 — 레슨을 먼저 하나 끝내 보세요');
      setView('hub');
      return;
    }
    setBatch({ exercises: b.exercises, key: Date.now() });
    setView('review');
  };
  /* 복습 탭의 「독일어 복습」 줄에서 바로 들어온 경우 */
  useEffect(() => { if (initialView === 'review') startReview(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (result) => {
    /* ★ 기억을 먼저, 레슨 기록은 나중에 ★ 레슨을 끝낸 낱말을 seedMemory가 「맞힌 것」으로 채우는데, 이번에
       푼 결과를 그 위에 또 얹으면 같은 대답이 두 번 센다. 이번 결과를 먼저 적으면 seed는 이 레슨을 아직 모른다. */
    const withMem = recordResults(progressRef.current, result.results);
    const rec = recordLesson(withMem, lessonId, result);
    setProgress({ lessons: rec.lessons, xp: rec.xp, weak: rec.weak, mem: rec.mem });
    onToast?.(`+${rec.gained} XP · 별 ${'★'.repeat(rec.stars)}`);
  };

  const finishReview = (result) => {
    const withMem = recordResults(progressRef.current, result.results);
    const right = Object.values(result.results || {}).filter(Boolean).length;
    const gained = Math.min(12, right);
    setProgress({ ...withMem, xp: (withMem.xp || 0) + gained });
    onToast?.(`복습 +${gained} XP`);
  };

  if (view === 'lesson' && lessonId) {
    return <SwissLesson lessonId={lessonId} rate={rate} onDone={finish} onQuit={() => setView('hub')} />;
  }
  if (view === 'review' && batch) {
    return (
      <SwissLesson
        key={batch.key}
        mode="review"
        exercises={batch.exercises}
        rate={rate}
        onDone={finishReview}
        onQuit={() => setView('hub')}
        onMore={() => startReview(true)}
      />
    );
  }
  if (view === 'listen') {
    return <SwissListen progress={progress} rate={rate} onQuit={() => setView('hub')} onToast={onToast} />;
  }

  return (
    <>
      {/* 제목은 위 헤더(독일어 여행 회화)가 그린다 */}
      <div className="card swh-sum">
        <div className="swh-cells">
          <div className="swh-cell"><b>{summary.xp}</b><span>XP</span></div>
          <div className="swh-cell"><b>{summary.stars}<i>/{summary.maxStars}</i></b><span>별</span></div>
          <div className="swh-cell"><b>{summary.done}<i>/{summary.total}</i></b><span>레슨</span></div>
        </div>
        <div className="btnrow" style={{ marginTop: 12 }}>
          {next ? (
            <button className="submit-btn swh-next" onClick={() => start(next)}>
              <IconPlay /> {summary.done === 0 ? '시작하기' : '이어서 배우기'} — {lessonById(next)?.title}
            </button>
          ) : (
            <button className="submit-btn swh-next" onClick={() => start('b1l1')}>
              <IconPlay /> 다 끝냈어요 — 처음부터 다시
            </button>
          )}
          <button className="ghost-btn swh-listen" onClick={() => setView('listen')}>
            <IconHeadphone /> 자동재생
          </button>
        </div>
        <div className="set-note" style={{ marginTop: 8 }}>
          처음이라면 「기초 단어」부터 해요 — 숫자·색깔·동물 같은 쉬운 말이에요. 「여행 회화」는
          표준 독일어라 독일·오스트리아·스위스 어디서나 통하고, 스위스에서 다르게 말하는 것만
          🇨🇭 팁으로 붙였어요. 일본어 회독 기록과는 따로 셉니다.
        </div>
      </div>

      {/* ★ 복습 ★ 외웠는지를 확인하는 자리. 레슨을 끝낸 낱말이 복습일이 되면 여기 쌓인다. */}
      <div className="card swh-review" data-due={memory.due} data-seen={memory.seen}>
        <div className="swh-rhead">
          <b>복습</b>
          <span className="swh-rdue">{memory.seen === 0 ? '레슨을 끝내면 시작돼요' : memory.due > 0 ? `오늘 ${memory.due}개` : '오늘 복습은 다 했어요'}</span>
        </div>
        {memory.seen > 0 && (
          <>
            <div className="swh-rbar" role="img" aria-label={`외운 낱말 ${memory.stages.mastered}개, 거의 외움 ${memory.stages.known}개, 익히는 중 ${memory.stages.learning}개`}>
              <i className="mastered" style={{ width: `${(memory.stages.mastered / memory.total) * 100}%` }} />
              <i className="known" style={{ width: `${(memory.stages.known / memory.total) * 100}%` }} />
              <i className="learning" style={{ width: `${(memory.stages.learning / memory.total) * 100}%` }} />
            </div>
            <div className="swh-rstages">
              {MEMORY_STAGES.slice().reverse().map((st) => <span key={st.id} data-stage={st.id}><b>{memory.stages[st.id]}</b>{st.label}</span>)}
              <span data-stage="unseen"><b>{memory.unseen}</b>아직 안 배움</span>
            </div>
          </>
        )}
        <button
          className="submit-btn swh-rstart"
          disabled={memory.seen === 0}
          onClick={() => startReview(memory.due === 0)}
        >
          {memory.due > 0 ? '복습 시작' : '미리 복습하기'}
        </button>
        <div className="set-note">
          맞히면 다음 복습이 점점 멀어지고, 틀리면 오늘 다시 나와요. 굳을수록 보기 없이 직접 쓰게 돼요.
        </div>
      </div>

      {SWISS_TRACKS.map((tr) => {
        const units = SWISS_UNITS.filter((u) => u.track === tr.id);
        const trLessons = units.flatMap((u) => u.lessons);
        const trDone = trLessons.filter((l) => (progress.lessons[l.id]?.stars || 0) >= 1).length;
        return (
      <div key={tr.id} className="swh-track" data-track={tr.id}>
        <div className="section-label swh-tlabel">
          {tr.title}
          <span className="mg-sub">{tr.sub} · {trDone}/{trLessons.length}</span>
        </div>
      <div className="stack" style={{ marginTop: 8 }}>
        {units.map((u, ui) => {
          const done = u.lessons.filter((l) => (progress.lessons[l.id]?.stars || 0) >= 1).length;
          const opened = openUnit === u.id;
          return (
            <div key={u.id} className="card swh-unit" data-unit={u.id}>
              <div className="swh-uhead">
                <span className="swh-uemoji" aria-hidden="true">{u.emoji}</span>
                <span className="swh-ubody">
                  <b>{ui + 1}. {u.title}</b>
                  <span>{u.sub} · {done}/{u.lessons.length}</span>
                </span>
              </div>
              <div className="swh-lessons">
                {u.lessons.map((l) => {
                  const st = progress.lessons[l.id];
                  const unlocked = isUnlocked(progress, l.id);
                  const stars = st?.stars || 0;
                  const state = !unlocked ? 'locked' : (stars ? 'done' : 'open');
                  return (
                    <button
                      key={l.id}
                      className={`swh-lesson ${state}`}
                      data-lesson={l.id}
                      disabled={!unlocked}
                      onClick={() => start(l.id)}
                      aria-label={`${l.title}${unlocked ? '' : ' — 앞 레슨을 먼저 끝내세요'}`}
                    >
                      <span className="swh-lmark" aria-hidden="true">
                        {state === 'locked' ? '🔒' : (stars ? '★'.repeat(stars) : '▶')}
                      </span>
                      <span className="swh-ltitle">{l.title}</span>
                    </button>
                  );
                })}
              </div>
              <button className="swh-peek" onClick={() => setOpenUnit(opened ? null : u.id)} aria-expanded={opened}>
                <IconChevron className={`chev${opened ? ' up' : ''}`} /> {opened ? '표현 접기' : '표현 미리 보기'}
              </button>
              {opened && (
                <div className="stack sw-cards" style={{ marginTop: 10 }}>
                  {itemsOfUnit(u.id).map((it) => <WordCard key={it.id} it={it} rate={rate} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
        );
      })}

      <p className="set-note" style={{ marginTop: 14 }}>
        한글 도움말은 짧은 낱말에만 붙였어요 — 한글로 적으면 발음이 어긋나는 것은
        안 적었습니다. 듣기 🔊가 제일 좋은 방법이에요. 🇨🇭 팁의 소리는 스위스식
        표준 독일어 발음이라 사투리 원어민 발음과는 달라요.
      </p>
    </>
  );
}
