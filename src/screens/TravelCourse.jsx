import { useMemo, useState } from 'react';
import { IconHeadphone, IconPlay, IconChevron } from '../components/Icons.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { loadTravel, saveTravel } from '../lib/storage.js';
import { TRAVEL_UNITS, itemsOfUnit, lessonById } from '../data/travel.js';
import { readingText } from '../lib/tts.js';
import { normalizeProgress, nextLesson, recordLesson, recordDrill, courseSummary, buildWeakExercises, settleWeak, progressToSave } from '../lib/travelCourse.js';
import { buildDrill, DRILL_KINDS } from '../lib/numberDrill.js';
import TravelLesson from './TravelLesson.jsx';

/* 여행 일본어 코스 — 공항부터 곤란할 때까지, 장면마다 레슨.
 *
 * 「대충은 알아들었는데」가 출발점이다. 그래서 중심은 내가 할 말이 아니라
 * **직원이 먼저 하는 말을 알아듣기**다. 레슨은 그 자리에서 실제로 오가는
 * 열 줄 안팎이고, 직원 줄은 소리로만 듣고 뜻을 고른다.
 *
 * 레슨을 안 잠근다 — 여행은 차례대로 안 온다. 진도는 일본어 회독 기록과
 * 따로 적는다(storage의 travel). 자동 듣기에는 「여행 일본어」 범위로 통째로
 * 들어가 있어서, 이 화면에서 바로 그리로 갈 수 있다. */

const JA = 'ja-JP';

function LineCard({ it, rate }) {
  return (
    <div className="card tr-line" data-item={it.id} data-who={it.who}>
      <span className={`tr-who ${it.who}`}>{it.who === 'staff' ? '직원' : '나'}</span>
      <span className="tr-body">
        <b lang="ja">{it.jp}</b>
        <span className="tr-kana">{it.kana}</span>
        <span className="tr-ko">{it.ko}</span>
        {it.note && <em className="tr-note">{it.note}</em>}
      </span>
      <SpeakButton text={readingText(it.kana, it.jp)} lang={JA} rate={rate} id={`tr:${it.id}`} className="tr-spk" />
    </div>
  );
}

export default function TravelCourse({ settings, onToast, onListen }) {
  const [progress, setProgress] = useState(() => normalizeProgress(loadTravel()));
  const [view, setView] = useState('hub');   // hub | lesson | weak | drill
  const [drillKind, setDrillKind] = useState('mix');
  const [drillRound, setDrillRound] = useState(0);
  const [lessonId, setLessonId] = useState(null);
  const [openUnit, setOpenUnit] = useState(null);
  const rate = Math.min(settings?.speechRate || 0.9, 0.9);

  const summary = useMemo(() => courseSummary(progress), [progress]);
  const next = useMemo(() => nextLesson(progress), [progress]);

  const start = (id) => { setLessonId(id); setView('lesson'); };
  const finish = (result) => {
    if (view === 'drill') {
      /* 숫자 훈련 — 레슨 별은 그대로, XP와 판 수만 */
      const rec = recordDrill(progress, result);
      setProgress(progressToSave(rec));
      saveTravel(progressToSave(rec));
      onToast?.(`${Math.max(0, result.total - result.wrongIds.length)}/${result.total} 한 번에 맞음 · +${rec.gained} XP`);
      return;
    }
    if (view === 'weak') {
      /* 약점 연습 — 한 번도 안 틀린 줄만 주머니에서 빼고, 레슨 기록은 그대로 */
      const settled = settleWeak(progress, result.practiced, result.wrongIds);
      const saved = progressToSave(settled);
      setProgress(saved);
      saveTravel(saved);
      onToast?.(settled.cleared ? `약점 ${settled.cleared}줄 해결 · ${settled.weak.length}줄 남음` : '아직 남았어요 — 다시 해 봐요');
      return;
    }
    const rec = recordLesson(progress, lessonId, result);
    const saved = progressToSave(rec);
    setProgress(saved);
    saveTravel(saved);
    onToast?.(`+${rec.gained} XP · 별 ${'★'.repeat(rec.stars)}`);
  };

  if (view === 'drill') {
    /* 한 판이 끝나면 「한 번 더」가 새 판을 만든다(make가 다시 불린다) — 같은 값이 안 돌아온다 */
    return (
      <TravelLesson
        key={`drill-${drillKind}-${drillRound}`}
        mode="drill"
        make={() => buildDrill(drillKind)}
        rate={rate}
        onDone={finish}
        onQuit={() => { setDrillRound((n) => n + 1); setView('hub'); }}
      />
    );
  }
  if (view === 'weak') {
    return <TravelLesson key="weak" make={() => buildWeakExercises(progress.weak)} rate={rate} onDone={finish} onQuit={() => setView('hub')} />;
  }
  if (view === 'lesson' && lessonId) {
    return <TravelLesson lessonId={lessonId} rate={rate} onDone={finish} onQuit={() => setView('hub')} />;
  }

  return (
    <>
      <div className="card swh-sum tr-sum">
        <div className="swh-cells">
          <div className="swh-cell"><b>{summary.xp}</b><span>XP</span></div>
          <div className="swh-cell"><b>{summary.stars}<i>/{summary.maxStars}</i></b><span>별</span></div>
          <div className="swh-cell"><b>{summary.done}<i>/{summary.total}</i></b><span>레슨</span></div>
        </div>
        <div className="btnrow" style={{ marginTop: 12 }}>
          {next ? (
            <button className="submit-btn swh-next tr-next" onClick={() => start(next)}>
              <IconPlay /> {summary.done === 0 ? '시작하기' : '이어서'} — {lessonById(next)?.unitTitle} · {lessonById(next)?.title}
            </button>
          ) : (
            <button className="submit-btn swh-next tr-next" onClick={() => start('air-1')}>
              <IconPlay /> 다 끝냈어요 — 처음부터 다시
            </button>
          )}
        </div>
        <div className="btnrow tr-sub">
          {summary.weak > 0 && (
            <button className="ghost-btn tr-weak" onClick={() => setView('weak')}>
              틀린 {summary.weak}줄 다시
            </button>
          )}
          {onListen && (
            <button className="ghost-btn swh-listen tr-listen" onClick={onListen}>
              <IconHeadphone /> 자동 듣기
            </button>
          )}
        </div>
        <div className="set-note" style={{ marginTop: 8 }}>
          직원이 먼저 하는 말을 <b>소리만 듣고</b> 알아듣는 연습이에요. 내가 할 말은 뜻을 보고
          고릅니다. 레슨은 어느 것부터 해도 돼요 — 내일 호텔이면 호텔부터. 일본어 회독
          기록과는 따로 셉니다.
        </div>
      </div>

      <div className="card tr-drill" style={{ marginTop: 14 }}>
        <div className="swh-uhead">
          <span className="swh-uemoji" aria-hidden="true">🔢</span>
          <span className="swh-ubody">
            <b>숫자 귀 훈련</b>
            <span>금액 · 시각 · 날짜 · 인원을 무작위로 — 끝이 없어요{summary.drillRounds ? ` · ${summary.drillRounds}판 (${summary.drillPerfect}판 만점)` : ''}</span>
          </span>
        </div>
        <div className="btnrow tr-sub">
          {DRILL_KINDS.map((k) => (
            <button key={k.id} className="ghost-btn tr-drillgo" data-kind={k.id}
              onClick={() => { setDrillKind(k.id); setView('drill'); }}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="set-note" style={{ marginTop: 8 }}>
          직원이 말하는 숫자를 소리만 듣고 고릅니다. 열 문제가 한 판이고, 판마다 값이 새로 만들어져요.
          금액은 자릿수(せん · ひゃく · まん)가, 시각은 분(ふん · ぷん)이, 날짜는 1~10일과 20일(ついたち · ふつか · はつか)이 제일 헷갈려요.
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {TRAVEL_UNITS.map((u, ui) => {
          const done = u.lessons.filter((l) => (progress.lessons[l.id]?.stars || 0) >= 1).length;
          const opened = openUnit === u.id;
          return (
            <div key={u.id} className="card swh-unit tr-unit" data-unit={u.id}>
              <div className="swh-uhead">
                <span className="swh-uemoji" aria-hidden="true">{u.emoji}</span>
                <span className="swh-ubody">
                  <b>{ui + 1}. {u.title}</b>
                  <span>{u.sub} · {done}/{u.lessons.length}</span>
                </span>
              </div>
              <div className="swh-lessons">
                {u.lessons.map((l) => {
                  const stars = progress.lessons[l.id]?.stars || 0;
                  return (
                    <button
                      key={l.id}
                      className={`swh-lesson ${stars ? 'done' : 'open'}`}
                      data-lesson={l.id}
                      onClick={() => start(l.id)}
                    >
                      <span className="swh-lmark" aria-hidden="true">{stars ? '★'.repeat(stars) : '▶'}</span>
                      <span className="swh-ltitle">{l.title}</span>
                    </button>
                  );
                })}
              </div>
              <button className="swh-peek" onClick={() => setOpenUnit(opened ? null : u.id)} aria-expanded={opened}>
                <IconChevron className={`chev${opened ? ' up' : ''}`} /> {opened ? '문장 접기' : '문장 미리 보기'}
              </button>
              {opened && (
                <div className="stack tr-lines" style={{ marginTop: 10 }}>
                  {itemsOfUnit(u.id).map((it) => <LineCard key={it.id} it={it} rate={rate} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="set-note" style={{ marginTop: 14 }}>
        지명·호텔 이름이 들어갈 자리는 〇〇로 두었어요. 삿포로 벼락치기(문장 · 상황별 회화)는
        한 여행의 낱말 목록이고, 여기는 어느 여행에서나 겪는 장면의 말입니다.
      </p>
    </>
  );
}
