import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSpeaker, IconCheck, IconX, IconArrowLeft } from './Icons.jsx';
import { speakJapanese } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { useHotkeys, useHasKeyboard } from '../lib/useHotkeys.js';
import {
  BLANK, filled, filledKana, retryOf, scoreOf, splitBlank,
} from '../lib/blank.js';

/* 빈칸 채우기 한 판 — 부사 연습과 일상문법이 같이 쓴다.
 *
 * ★ 이 화면의 값은 「왜 틀렸는지」에 있다 ★
 * 정답만 알려 주면 다음에 또 틀린다. 그래서 틀렸을 때는 자동으로 안 넘어간다 —
 * 0.9초 만에 설명을 치우면 안 읽고, 그럴 거면 안 적은 것과 같다.
 *
 * 화면 이름(class)은 부사 연습 때 쓰던 것을 그대로 둔다. 자료만 다른 같은
 * 화면이라 이름까지 갈라 두면 손질할 때 두 곳을 봐야 한다. */

const FEEDBACK_MS = 900;

function Say({ text, kana, rate }) {
  return (
    <button className="av-say" onClick={() => speakJapanese(kana || text, rate)} aria-label="발음 듣기">
      <IconSpeaker />
    </button>
  );
}

export default function BlankRun({
  set, items: initial, settings, onDone, onQuit, backLabel = '묶음 목록', wrongNote = null,
}) {
  const [items, setItems] = useState(initial);
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState({});
  const [picked, setPicked] = useState(null);
  const [round, setRound] = useState(1);
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  const hasKeyboard = useHasKeyboard();

  useEffect(() => () => clearTimeout(timer.current), []);

  const item = items[at];

  /* 판이 끝나면 결과를 한 번만 넘긴다.
     그리는 중에 하지 않는다 — 같은 판이 두 번 계산되면 두 번 올라간다. */
  const sent = useRef(false);
  useEffect(() => {
    if (!done || sent.current) return;
    sent.current = true;
    onDone?.(answers, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const pick = (opt) => {
    if (picked || !item) return;
    const good = opt === item.answer;
    setPicked({ opt, good });
    setAnswers((prev) => ({ ...prev, [item.id]: { good, opt } }));

    /* 맞히면 넘어가고, 틀리면 설명을 읽을 시간을 준다. */
    if (!good) return;
    timer.current = setTimeout(() => {
      setPicked(null);
      if (at + 1 >= items.length) setDone(true); else setAt(at + 1);
    }, FEEDBACK_MS);
  };

  const next = () => {
    clearTimeout(timer.current);
    setPicked(null);
    if (at + 1 >= items.length) setDone(true); else setAt(at + 1);
  };

  useHotkeys(done ? { Escape: onQuit } : {
    1: () => item && pick(item.options[0]),
    2: () => item && pick(item.options[1]),
    3: () => item && pick(item.options[2]),
    Enter: () => { if (picked && !picked.good) next(); },
    ' ': () => item && speakJapanese(item.kana.replace(BLANK, item.answer), settings.speechRate),
    Escape: onQuit,
  });

  const wrong = useMemo(
    () => items.filter((it) => answers[it.id] && !answers[it.id].good),
    [items, answers],
  );

  if (done) {
    const s = scoreOf(answers, items);
    return (
      <>
        <button className="inner-back" onClick={onQuit}><IconArrowLeft /> {backLabel}</button>
        <div className="finish">
          <div className="fin-badge">{s.rate >= 0.8 ? '🎉' : '💪'}</div>
          <h2>{s.rate >= 0.8 ? '잘했어요' : '조금만 더'}</h2>
          <div className="fin-big"><b>{s.right}</b><span>/ {s.total}개 맞힘</span></div>

          {wrong.length > 0 ? (
            <>
              <div className="section-label">틀린 것</div>
              {wrong.map((it) => (
                <div key={it.id} className="av-back">
                  <b>{it.answer}</b>
                  <span>{filled(it)}</span>
                  <i>{it.ko}</i>
                </div>
              ))}
              {wrongNote && <p className="set-note">{wrongNote}</p>}
              <button
                className="submit-btn"
                onClick={() => {
                  setItems(retryOf(items, wrong.map((w) => w.id)));
                  setAt(0); setPicked(null); setDone(false); setRound(round + 1);
                  setAnswers({});
                  sent.current = false;
                }}
              >틀린 것만 다시</button>
            </>
          ) : (
            <p className="set-note">다 맞혔어요. 다른 묶음도 해 보세요.</p>
          )}
          <button className="ghost-btn" onClick={onQuit}>{backLabel}으로</button>
        </div>
      </>
    );
  }

  if (!item) return null;
  const { head, tail } = splitBlank(item.jp);
  const showAnswer = picked && !picked.good;

  return (
    <>
      <div className="quizhead">
        <div className="qh-row">
          <button className="sh-close" onClick={onQuit} aria-label="그만두기"><IconArrowLeft /></button>
          <div className="sh-title">
            {set.label}{round > 1 ? ' · 틀린 것만' : ''} {at + 1} / {items.length}
          </div>
        </div>
        <div className="sh-bar"><i style={{ width: `${(at / items.length) * 100}%` }} /></div>
      </div>

      {at === 0 && round === 1 && <p className="set-note av-intro">{set.intro}</p>}

      <div className="av-card">
        <div className="av-jp">
          {head}
          <span className={`av-blank${picked ? (picked.good ? ' ok' : ' no') : ''}`}>
            {picked ? picked.opt : '？'}
          </span>
          {tail}
        </div>
        <div className="av-ko">{item.ko}</div>
        {/* 소리는 답을 맞힌 뒤에만. 먼저 들려주면 답을 불러 주는 셈이다 */}
        {picked?.good && <Say text={filled(item)} kana={filledKana(item)} rate={settings.speechRate} />}
        {picked?.good && settings.hangulPron && (
          <div className="av-hangul">{kanaToHangul(filledKana(item))}</div>
        )}
      </div>

      <div className="qoptions">
        {item.options.map((o, i) => {
          const isAnswer = o === item.answer;
          const mine = picked?.opt === o;
          let cls = 'qopt';
          if (picked) {
            if (mine) cls += picked.good ? ' correct' : ' wrong';
            else if (isAnswer) cls += ' correct';
            else cls += ' dim';
          }
          return (
            <button key={o} className={cls} disabled={Boolean(picked)} onClick={() => pick(o)}>
              {hasKeyboard && <span className="qo-num"><kbd>{i + 1}</kbd></span>}
              <span className="qo-body"><b>{o}</b></span>
              {picked && mine && (picked.good
                ? <span className="qo-mark ok"><IconCheck /> 맞아요</span>
                : <span className="qo-mark no"><IconX /> 내가 고른 답</span>)}
              {picked && !mine && isAnswer && <span className="qo-mark ok"><IconCheck /> 정답</span>}
            </button>
          );
        })}
      </div>

      {/* ★ 왜 틀렸는지가 이 화면의 전부다 ★ */}
      {showAnswer && (
        <div className="av-why">
          {item.why?.[picked.opt] && (
            <p className="av-wrong"><IconX /> {item.why[picked.opt]}</p>
          )}
          <p className="av-right">
            <IconCheck /> 답은 <b>{item.answer}</b> — {item.note}
          </p>
          <button className="submit-btn" onClick={next}>
            {at + 1 >= items.length ? '결과 보기' : '다음'}
            {hasKeyboard && <kbd className="inline-key">Enter</kbd>}
          </button>
        </div>
      )}
    </>
  );
}
