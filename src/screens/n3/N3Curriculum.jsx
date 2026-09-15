import { useState } from 'react';
import { IconArrowLeft, IconCheck, IconChevron } from '../../components/Icons.jsx';
import { CURRICULUM, isLessonDone, lessonTitle, trackOf, TEST_TITLES } from '../../lib/n3.js';
import { stateOf } from '../../lib/review.js';
import { masteryOf, MASTERY_LABEL } from '../../lib/n3.js';

/* 전체 과정 — Chapter 0 ~ 7. 잠그지 않는다. 대신 「다음 것」에 표시를 해서
   순서대로 가고 싶은 사람이 길을 잃지 않게 한다. 확인 테스트는 챕터 끝에. */
export default function N3Curriculum({ n3, review, onOpenLesson, onOpenTest, onBack, initialChapter = null }) {
  const [open, setOpen] = useState(initialChapter);
  const [openGroup, setOpenGroup] = useState(null);

  const mark = (id) => {
    const done = isLessonDone(n3, review, id);
    const t = trackOf(id);
    let m = null;
    if (t === 'grammar') m = masteryOf(stateOf(review, id));
    return { done, m, skipped: Boolean(n3.skip[id]) };
  };

  const LessonRow = ({ id }) => {
    const { done, m, skipped } = mark(id);
    return (
      <button className={`n3-lrow${done ? ' done' : ''}`} data-lesson={id} onClick={() => onOpenLesson(id)}>
        <span className="n3-lmark">{done ? <IconCheck /> : '▶'}</span>
        <span className="n3-ltitle">{lessonTitle(id)}</span>
        {skipped && <i className="n3-mast master">SKIP</i>}
        {!skipped && m && m !== 'new' && <i className={`n3-mast ${m}`}>{MASTERY_LABEL[m]}</i>}
      </button>
    );
  };

  return (
    <div className="n3-curriculum">
      <div className="sub-header inline">
        <button className="sub-back" onClick={onBack}><IconArrowLeft /> 코스로</button>
        <div className="sub-title">전체 과정</div>
      </div>
      <div className="stack">
        {CURRICULUM.map((c, ci) => {
          const total = c.lessons.length;
          const done = c.lessons.filter((id) => isLessonDone(n3, review, id)).length;
          const opened = open === c.id;
          const test = c.test ? n3.tests[c.test] : null;
          return (
            <div key={c.id} className={`card n3-chapter${opened ? ' open' : ''}`} data-chapter={c.id}>
              <button className="n3-chhead" onClick={() => setOpen(opened ? null : c.id)} aria-expanded={opened}>
                <span className="n3-chemoji" aria-hidden="true">{c.emoji}</span>
                <span className="n3-chbody">
                  <b>Chapter {ci} · {c.title}</b>
                  <span>{c.sub}</span>
                  {total > 0 && <span className="jl-bar"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>}
                </span>
                <span className="n3-chcount">{total > 0 ? `${done}/${total}` : ''}</span>
                <IconChevron className={`chev${opened ? ' up' : ''}`} />
              </button>
              {opened && (
                <div className="n3-chbody2">
                  {c.id === 'ch0' && (
                    <button className="rowcard n3-testbtn" data-test="t:ch0" onClick={() => onOpenTest('t:ch0')}>
                      <span className="rc-body"><b>{TEST_TITLES['t:ch0']}</b><span>{test ? `최고 ${Math.round((test.best || 0) * 100)}% · 맞힌 꼭지는 SKIP` : '15문제 — 맞힌 꼭지는 건너뛰어요'}</span></span>
                      <IconChevron className="chev" />
                    </button>
                  )}
                  {c.groups ? c.groups.map((g) => {
                    const gdone = g.lessons.filter((id) => isLessonDone(n3, review, id)).length;
                    const gopen = openGroup === g.id;
                    return (
                      <div key={g.id} className="n3-group" data-group={g.id}>
                        <button className="n3-ghead" onClick={() => setOpenGroup(gopen ? null : g.id)} aria-expanded={gopen}>
                          <b>{g.title}</b><span>{g.sub || ''}</span><em>{gdone}/{g.lessons.length}</em>
                        </button>
                        {gopen && <div className="n3-lrows">{g.lessons.map((id) => <LessonRow key={id} id={id} />)}</div>}
                      </div>
                    );
                  }) : (
                    <div className="n3-lrows">{c.lessons.map((id) => <LessonRow key={id} id={id} />)}</div>
                  )}
                  {c.test && c.id !== 'ch0' && (
                    <button className="rowcard n3-testbtn" data-test={c.test} onClick={() => onOpenTest(c.test)}>
                      <span className="rc-body"><b>{TEST_TITLES[c.test]}</b><span>{test ? `최고 ${Math.round((test.best || 0) * 100)}% · ${test.tries}회` : (c.id === 'ch7' ? '문자·어휘 25 · 문법 22 · 독해 4지문 · 청해 6문항' : '20문제 — 챕터를 마치고 확인해요')}</span></span>
                      <IconChevron className="chev" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
