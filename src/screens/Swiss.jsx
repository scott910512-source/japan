import { useMemo, useState } from 'react';
import { IconSpeaker, IconArrowLeft } from '../components/Icons.jsx';
import { speakIn } from '../lib/tts.js';
import { SWISS_GROUPS, swissByGroup, swissQuiz } from '../data/swiss.js';

/* 스위스 독일어 맛보기 — 유치원 수준.
 *
 * 일본어 회독과는 아무 상관이 없는 곁가지다. 기록·통계·오늘 계획 어디에도
 * 안 붙는다. 그래서 여기에는 저장이 하나도 없다 — 나갔다 오면 처음이고,
 * 그게 맞다. 외우라고 만든 자리가 아니라 소리 내 보라고 만든 자리다.
 *
 * 화면은 둘뿐이다.
 *   보기    묶음 하나를 카드로. 누르면 읽어 준다
 *   맞혀 보기  뜻을 보고 셋 중에 고른다. 맞히면 읽어 주고 넘어간다
 *
 * 글자는 크게, 한 장에 하나만. 유치원 수준이란 「쉬운 낱말」이 아니라
 * 「한 번에 하나」라는 뜻이다. */

const LANG = 'de-CH';

export default function Swiss({ settings }) {
  const [group, setGroup] = useState('hello');
  const [mode, setMode] = useState('cards');   // cards | quiz
  const rate = Math.min(settings?.speechRate || 0.9, 0.9);   // 천천히 — 처음 듣는 말이다

  const items = useMemo(() => swissByGroup(group), [group]);
  const meta = SWISS_GROUPS.find((g) => g.id === group);

  if (mode === 'quiz') {
    return <SwissQuiz group={group} label={meta?.label} rate={rate} onBack={() => setMode('cards')} />;
  }

  return (
    <>
      <div className="navtitle">
        <small>완전 곁가지</small>
        스위스 독일어 맛보기
      </div>
      <p className="set-note sw-intro" style={{ marginTop: 0 }}>
        유치원 수준이에요. 카드를 누르면 읽어 줘요 — 따라 말해 보세요.
        스위스 독일어는 정해진 철자가 없어서, 취리히 쪽에서 흔히 쓰는 꼴로 적고
        표준 독일어를 옆에 뒀어요.
      </p>

      <div className="chiprow sw-chips">
        {SWISS_GROUPS.map((g) => (
          <div
            key={g.id}
            className={`chip${group === g.id ? ' active' : ''}`}
            data-group={g.id}
            onClick={() => setGroup(g.id)}
          >
            {g.emoji} {g.label}
          </div>
        ))}
      </div>

      <div className="stack sw-cards" style={{ marginTop: 14 }}>
        {items.map((it) => (
          <button
            key={it.id}
            className="card sw-card"
            onClick={() => speakIn(it.sw, LANG, rate)}
            aria-label={`${it.sw} — ${it.ko} 읽어 주기`}
          >
            <span className="sw-pic" aria-hidden="true">
              {it.swatch
                ? <i className="sw-swatch" style={{ background: it.swatch }} />
                : (it.emoji || '🔊')}
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

      <div className="btnrow" style={{ marginTop: 16 }}>
        <button className="submit-btn sw-quiz-go" onClick={() => setMode('quiz')}>
          맞혀 보기 — {meta?.label}
        </button>
      </div>
      <p className="set-note" style={{ marginTop: 8 }}>
        여기서 한 건 아무 데도 기록되지 않아요. 놀듯이 하세요.
      </p>
    </>
  );
}

/* 뜻을 보고 셋 중에 고른다. 틀리면 답을 보여 주고, 맞히면 읽어 주고 넘어간다.
   점수는 세지만 어디에도 안 남긴다 — 이 판 안에서만 「몇 개 맞혔나」다. */
function SwissQuiz({ group, label, rate, onBack }) {
  const pool = useMemo(() => swissByGroup(group), [group]);
  const [at, setAt] = useState(0);
  const [seed] = useState(() => Math.random());
  const [picked, setPicked] = useState(null);   // { id, good }
  const [right, setRight] = useState(0);

  // 문제마다 섞임이 달라야 한다 — seed와 번호를 섞어 만든 값으로 뽑는다
  const q = useMemo(() => {
    let x = Math.floor(seed * 1e9) + at * 7919;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    return swissQuiz(group, at, rnd);
  }, [group, at, seed]);

  const done = at >= pool.length;

  const pick = (opt) => {
    if (picked || !q) return;
    const good = opt.id === q.answer.id;
    setPicked({ id: opt.id, good });
    if (good) {
      setRight((n) => n + 1);
      speakIn(q.answer.sw, LANG, rate);
      setTimeout(() => { setPicked(null); setAt((n) => n + 1); }, 1100);
    }
  };
  const next = () => { setPicked(null); setAt((n) => n + 1); };

  if (done) {
    return (
      <div className="sw-done">
        <div className="navtitle"><small>맞혀 보기 · {label}</small>다 했어요</div>
        <div className="card sw-score">
          <b>{right} / {pool.length}</b>
          <span>{right === pool.length ? '전부 맞혔어요 — 굉장해요' : '틀린 건 카드에서 다시 눌러 들어 보세요'}</span>
        </div>
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button className="ghost-btn" onClick={() => { setAt(0); setRight(0); setPicked(null); }}>한 번 더</button>
          <button className="submit-btn" onClick={onBack}>카드로</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sub-header inline">
        <button className="sub-back" onClick={onBack}><IconArrowLeft /> 카드로</button>
        <div className="sub-title">{at + 1} / {pool.length}</div>
      </div>

      <div className="card sw-ask">
        <span className="sw-ask-pic" aria-hidden="true">
          {q.answer.swatch
            ? <i className="sw-swatch big" style={{ background: q.answer.swatch }} />
            : (q.answer.emoji || '❓')}
        </span>
        <div className="sw-ask-ko">{q.answer.ko}</div>
        <div className="set-sub">스위스 독일어로 뭐라고 할까요?</div>
      </div>

      <div className="qoptions sw-opts" style={{ marginTop: 12 }}>
        {q.options.map((opt, i) => {
          const isAns = opt.id === q.answer.id;
          const cls = picked
            ? (isAns ? ' correct' : (picked.id === opt.id ? ' wrong' : ' dim'))
            : '';
          return (
            <button key={opt.id} className={`qopt${cls}`} onClick={() => pick(opt)} disabled={Boolean(picked)}>
              <span className="qo-num">{i + 1}</span>
              <span className="qo-body">
                <b>{opt.sw}</b>
                <span>{opt.han}</span>
              </span>
              {picked && isAns && <span className="qo-mark">정답</span>}
            </button>
          );
        })}
      </div>

      {picked && !picked.good && (
        <div className="card sw-why">
          <div className="set-sub">
            답은 <b>{q.answer.sw}</b> ({q.answer.han}) — 「{q.answer.ko}」
          </div>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <button className="ghost-btn" onClick={() => speakIn(q.answer.sw, LANG, rate)}>
              <IconSpeaker /> 들어 보기
            </button>
            <button className="submit-btn sw-next" onClick={next}>다음</button>
          </div>
        </div>
      )}
    </>
  );
}
