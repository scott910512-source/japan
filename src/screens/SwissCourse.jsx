import { useMemo, useState } from 'react';
import { IconHeadphone, IconPlay, IconChevron } from '../components/Icons.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { loadSwiss, saveSwiss } from '../lib/storage.js';
import { SWISS_UNITS, itemsOfUnit, lessonById } from '../data/swiss.js';
import {
  normalizeProgress, isUnlocked, nextLesson, recordLesson, courseSummary,
} from '../lib/swissCourse.js';
import SwissLesson from './SwissLesson.jsx';
import SwissListen from './SwissListen.jsx';

/* 독일어 여행 회화 코스 — 듀오링고처럼 단원 안의 레슨을 차례로.
 *
 * 기본은 표준 독일어다. 스위스에서 실제로 다르게 말하는 것만 🇨🇭 팁으로 붙는다.
 * 일본어 회독과는 다른 길이라 회독 기록·통계·오늘 계획에 안 붙고 진도는
 * 따로 적는다(storage의 swiss — 이름은 처음 만들 때 것을 그대로 둔다. 바꾸면
 * 이미 쌓인 진도를 못 찾는다).
 *
 * 화면은 셋이다.
 *   허브   단원과 레슨, 진도, 자동재생 입구, 낱말 미리 보기
 *   레슨   문제 열 개쯤 — SwissLesson
 *   자동재생  배운 것을 소리로 흘려 듣기 — SwissListen */

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

export default function SwissCourse({ settings, onToast }) {
  const [progress, setProgress] = useState(() => normalizeProgress(loadSwiss()));
  const [view, setView] = useState('hub');   // hub | lesson | listen
  const [lessonId, setLessonId] = useState(null);
  const [openUnit, setOpenUnit] = useState(null);   // 낱말을 펼쳐 둔 단원
  const rate = Math.min(settings?.speechRate || 0.9, 0.9);

  const summary = useMemo(() => courseSummary(progress), [progress]);
  const next = useMemo(() => nextLesson(progress), [progress]);

  const start = (id) => { setLessonId(id); setView('lesson'); };

  const finish = (result) => {
    const rec = recordLesson(progress, lessonId, result);
    const saved = { lessons: rec.lessons, xp: rec.xp, weak: rec.weak };
    setProgress(saved);
    saveSwiss(saved);
    onToast?.(`+${rec.gained} XP · 별 ${'★'.repeat(rec.stars)}`);
  };

  if (view === 'lesson' && lessonId) {
    return <SwissLesson lessonId={lessonId} rate={rate} onDone={finish} onQuit={() => setView('hub')} />;
  }
  if (view === 'listen') {
    return <SwissListen progress={progress} rate={rate} onQuit={() => setView('hub')} onToast={onToast} />;
  }

  return (
    <>
      <div className="navtitle">
        <small>여행 회화 코스</small>
        독일어
      </div>

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
            <button className="submit-btn swh-next" onClick={() => start('u1l1')}>
              <IconPlay /> 다 끝냈어요 — 처음부터 다시
            </button>
          )}
          <button className="ghost-btn swh-listen" onClick={() => setView('listen')}>
            <IconHeadphone /> 자동재생
          </button>
        </div>
        <div className="set-note" style={{ marginTop: 8 }}>
          표준 독일어예요 — 독일·오스트리아·스위스 어디서나 통해요. 스위스에서 실제로
          다르게 말하는 것만 🇨🇭 팁으로 붙였어요. 일본어 회독 기록과는 따로 셉니다.
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {SWISS_UNITS.map((u, ui) => {
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

      <p className="set-note" style={{ marginTop: 14 }}>
        한글 도움말은 짧은 낱말에만 붙였어요 — 한글로 적으면 발음이 어긋나는 것은
        안 적었습니다. 듣기 🔊가 제일 좋은 방법이에요. 🇨🇭 팁의 소리는 스위스식
        표준 독일어 발음이라 사투리 원어민 발음과는 달라요.
      </p>
    </>
  );
}
