import { useMemo, useState } from 'react';
import { IconSpeaker, IconHeadphone, IconPlay, IconChevron } from '../components/Icons.jsx';
import { speakIn } from '../lib/tts.js';
import { loadSwiss, saveSwiss } from '../lib/storage.js';
import { SWISS_UNITS, itemsOfUnit, lessonById } from '../data/swiss.js';
import {
  normalizeProgress, isUnlocked, nextLesson, recordLesson, courseSummary,
} from '../lib/swissCourse.js';
import SwissLesson from './SwissLesson.jsx';
import SwissListen from './SwissListen.jsx';

/* 스위스 독일어 코스 — 듀오링고처럼 단원 안의 레슨을 차례로.
 *
 * 일본어 회독과는 다른 길이다. 회독 기록·통계·오늘 계획에 안 붙고 진도는
 * 따로 적는다(storage의 swiss). 이 화면은 셋으로 갈린다.
 *   허브   단원과 레슨, 진도, 자동재생 입구
 *   레슨   문제 열 개쯤 — SwissLesson
 *   자동재생  배운 것을 소리로 흘려 듣기 — SwissListen
 *
 * 레슨은 앞 것을 끝내야 열린다. 별 개수는 안 본다 — 겨우 통과해도 다음으로
 * 갈 수 있어야 막히지 않는다. 낱말은 언제든 미리 볼 수 있다(펼치기). */

export const SWISS_LANG = 'de-CH';

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
    return (
      <SwissLesson
        lessonId={lessonId}
        rate={rate}
        onDone={finish}
        onQuit={() => setView('hub')}
      />
    );
  }
  if (view === 'listen') {
    return <SwissListen progress={progress} rate={rate} onQuit={() => setView('hub')} onToast={onToast} />;
  }

  return (
    <>
      <div className="navtitle">
        <small>곁가지 코스</small>
        스위스 독일어
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
          일본어 회독 기록과는 따로 셉니다. 이 진도는 이 기기와 백업에만 남아요.
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
                <IconChevron className={`chev${opened ? ' up' : ''}`} /> {opened ? '낱말 접기' : '낱말 미리 보기'}
              </button>
              {opened && (
                <div className="stack sw-cards" style={{ marginTop: 10 }}>
                  {itemsOfUnit(u.id).map((it) => (
                    <button
                      key={it.id}
                      className="card sw-card"
                      onClick={() => speakIn(it.sw, SWISS_LANG, rate)}
                      aria-label={`${it.sw} — ${it.ko} 읽어 주기`}
                    >
                      <span className="sw-pic" aria-hidden="true">
                        {it.swatch ? <i className="sw-swatch" style={{ background: it.swatch }} /> : (it.emoji || '🔊')}
                      </span>
                      <span className="sw-body">
                        <b className="sw-word">{it.sw}</b>
                        <span className="sw-han">{it.han}</span>
                        <span className="sw-ko">{it.ko}</span>
                        {it.hd !== it.sw && <span className="sw-hd">표준 독일어 {it.hd}</span>}
                        {it.note && <span className="sw-note">{it.note}</span>}
                      </span>
                      <IconSpeaker className="sw-spk" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="set-note" style={{ marginTop: 14 }}>
        스위스 독일어는 정해진 철자가 없어요. 취리히 쪽에서 흔히 쓰는 꼴로 적고
        표준 독일어를 옆에 뒀습니다. 한글 소리는 입을 여는 첫 실마리일 뿐이에요.
      </p>
    </>
  );
}
