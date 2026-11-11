import { useEffect, useMemo, useState } from 'react';
import { IconSpeaker, IconX } from './Icons.jsx';
import { readingText, speakJapanese } from '../lib/tts.js';
import { shuffled } from '../lib/review.js';
import { useHotkeys } from '../lib/useHotkeys.js';
import { fitsAt } from '../lib/compose.js';
import KeyboardHelp from './KeyboardHelp.jsx';

/* 문장 조립 퀴즈 — 흩어진 조각을 순서대로 눌러 문장을 만든다.
 *
 * 어순과 조사를 몸에 붙이는 게 목적이라, 틀려도 정답을 바로 까지 않고
 * 어디까지 맞았는지만 알려준 뒤 다시 해볼 기회를 준다. */
export default function BuildQuiz({ item, chunks, settings, onSolved, onAttempt, onNext, onQuit }) {
  // 조각이 겹칠 수 있어(조사 は가 두 번 등) 단추는 자리로 구분한다. 맞는지는 글자로 본다(같은 글자면 어느 것을 집어도 맞다)
  const tiles = useMemo(
    () => shuffled(chunks.map((text, index) => ({ id: `${index}-${text}`, text, index }))),
    [chunks],
  );

  const [placed, setPlaced] = useState([]);
  const [wrongAt, setWrongAt] = useState(-1);
  const [solved, setSolved] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setPlaced([]);
    setWrongAt(-1);
    setSolved(false);
    setTries(0);
  }, [item.id]);

  const remaining = tiles.filter((t) => !placed.some((p) => p.id === t.id));

  const put = (tile) => {
    if (solved) return;
    const next = [...placed, tile];
    setPlaced(next);
    setWrongAt(-1);

    // 방금 놓은 조각이 제자리인지 바로 본다 — 끝까지 다 놓고 알려주면 어디서 틀렸는지 모른다
    if (!fitsAt(chunks, next.length - 1, tile.text)) {
      setWrongAt(next.length - 1);
      setTries((n) => n + 1);
      onAttempt?.({ ok: false, chosen: next.map((p) => p.text).join(''), expected: chunks[next.length - 1] });
      return;
    }
    if (next.length === chunks.length) {
      setSolved(true);
      speakJapanese(readingText(item.kana, item.jp), settings.speechRate);
      onSolved?.(tries === 0);
      onAttempt?.({ ok: true, chosen: next.map((p) => p.text).join('') });
    }
  };

  const takeBack = (position) => {
    if (solved) return;
    setPlaced(placed.slice(0, position));
    setWrongAt(-1);
  };

  const reset = () => {
    setPlaced([]);
    setWrongAt(-1);
  };

  const scope = useHotkeys({
    ...Object.fromEntries(remaining.slice(0, 9).map((tile, i) => [i + 1, () => put(tile)])),
    Escape: onQuit,
    ArrowLeft: () => { if (placed.length) takeBack(placed.length - 1); },
    Enter: () => { if (solved) onNext?.(); },
    Space: () => { if (solved) speakJapanese(readingText(item.kana, item.jp), settings.speechRate); },
  }, { enabled: !solved || Boolean(onNext), rapid: !solved });   // 조각을 놓는 동안은 같은 숫자(1 · 1 · 1)를 바로 이어 누른다

  return (
    <div ref={scope} className="build">
      <KeyboardHelp kind="build" />
      <div className="build-ask">{item.ko}</div>

      <div className={`build-line${wrongAt >= 0 ? ' shake' : ''}`}>
        {placed.length === 0 && <span className="build-empty">아래 단어를 순서대로 눌러 보세요</span>}
        {placed.map((tile, i) => (
          <button
            key={tile.id}
            className={`build-tile placed${wrongAt === i ? ' bad' : ''}${solved ? ' done' : ''}`}
            onClick={() => takeBack(i)}
          >
            {tile.text}
          </button>
        ))}
      </div>

      {wrongAt >= 0 && !solved && (
        <div className="build-hint">
          여기는 아직 아니에요. 조각을 눌러 되돌리고 다시 골라 보세요.
        </div>
      )}

      {solved ? (
        <div className="build-done">
          <div className="bd-jp">
            {item.jp}
            <button
              className="iconbtn"
              onClick={() => speakJapanese(readingText(item.kana, item.jp), settings.speechRate)}
              aria-label="듣기"
            >
              <IconSpeaker />
            </button>
          </div>
          <div className="bd-kana">{item.kana}</div>
          <div className="bd-note">{tries === 0 ? '한 번에 맞혔어요' : `${tries}번 고쳐서 완성했어요`}</div>
        </div>
      ) : (
        <>
          {/* 조각이 빠지면 다음 조각이 같은 자리로 당겨진다 — 같은 자리를 빠르게 이어 누르는 것이 정상이라 클릭 틈(tapguard)을 두지 않는다 */}
          <div className="build-pool" data-rapid>
            {remaining.map((tile, i) => (
              <button key={tile.id} className="build-tile" onClick={() => put(tile)}>
                <span className="qo-num" aria-hidden="true" data-number={i + 1} />{tile.text}
              </button>
            ))}
          </div>
          {placed.length > 0 && (
            <button className="build-reset" onClick={reset}><IconX /> 처음부터</button>
          )}
        </>
      )}
    </div>
  );
}
