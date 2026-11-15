import { useEffect, useMemo, useState } from 'react';
import { IconSpeaker, IconX } from './Icons.jsx';
import { readingText, speakJapanese } from '../lib/tts.js';
import { shuffled } from '../lib/review.js';
import { useHotkeys } from '../lib/useHotkeys.js';
import { sameOrder, wrongSlots } from '../lib/compose.js';
import KeyboardHelp from './KeyboardHelp.jsx';

/* 문장 조립 퀴즈 — 흩어진 조각을 순서대로 눌러 문장을 만든다.
 *
 * 어순과 조사를 몸에 붙이는 게 목적이라, 틀려도 정답을 바로 까지 않고
 * 어디가 틀렸는지만 알려준 뒤 다시 해볼 기회를 준다.
 *
 * ★ 다 놓은 뒤 전체 순서로 채점한다 ★ (2026-11-15 실사용 버그)
 *   전에는 「방금 놓은 조각이 그 자리에 맞나」만 보고 틀린 조각을 줄에 남긴 채 다음 조각을 받았다. 그래서
 *   は → 子供料金 → ありますか처럼 마지막 조각만 제자리면 완성으로 쳤다(완료 화면의 타일은 오답, 문장은 정답).
 *   이제 모든 조각을 놓았을 때 전체 배열을 정답과 견주고, 틀리면 틀린 자리를 빨갛게 칠한다.
 *   놓은 조각은 중립색이고 초록(완성)은 정답일 때만. 줄의 조각을 누르면 그 조각 하나만 돌아간다. */
export default function BuildQuiz({ item, chunks, settings, onSolved, onAttempt, onNext, onQuit }) {
  // 조각이 겹칠 수 있어(조사 は가 두 번 등) 단추는 자리로 구분한다. 맞는지는 글자로 본다(같은 글자면 어느 것을 집어도 맞다)
  const tiles = useMemo(
    () => shuffled(chunks.map((text, index) => ({ id: `${index}-${text}`, text, index }))),
    [chunks],
  );

  const [placed, setPlaced] = useState([]);
  const [wrong, setWrong] = useState([]);       // 다 놓았는데 틀렸을 때 틀린 자리들
  const [solved, setSolved] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setPlaced([]);
    setWrong([]);
    setSolved(false);
    setTries(0);
  }, [item.id]);

  const remaining = tiles.filter((t) => !placed.some((p) => p.id === t.id));

  const put = (tile) => {
    if (solved) return;
    const next = [...placed, tile];
    setPlaced(next);
    setWrong([]);
    if (next.length < chunks.length) return;      // 다 놓을 때까지는 채점하지 않는다

    const texts = next.map((p) => p.text);
    if (!sameOrder(chunks, texts)) {
      const bad = wrongSlots(chunks, texts);
      setWrong(bad);
      setTries((n) => n + 1);
      /* 오답 노트에는 실제로 놓은 순서 전체를 남긴다(전에는 틀린 순간까지의 일부 — 「は子供料金」) */
      onAttempt?.({ ok: false, chosen: texts.join(' / '), wrongOrder: texts, firstWrong: bad[0] });
      return;
    }
    setSolved(true);
    /* 눈으로만 푸는 중(소리 끔)이면 완성한 문장을 알아서 읽지 않는다 — 듣기 단추로 듣는다 */
    if (settings.autoTTS !== false) speakJapanese(readingText(item.kana, item.jp), settings.speechRate);
    onSolved?.(tries === 0);
    onAttempt?.({ ok: true, chosen: texts.join(' / ') });
  };

  /* 줄의 조각을 누르면 그 조각 하나만 풀로 돌아간다(전에는 그 뒤를 전부 지웠다) */
  const takeBack = (position) => {
    if (solved) return;
    setPlaced(placed.filter((_, i) => i !== position));
    setWrong([]);
  };

  const reset = () => {
    setPlaced([]);
    setWrong([]);
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

      <div className={`build-line${wrong.length ? ' shake' : ''}`}>
        {placed.length === 0 && <span className="build-empty">아래 단어를 순서대로 눌러 보세요</span>}
        {placed.map((tile, i) => (
          <button
            key={tile.id}
            className={`build-tile placed${wrong.includes(i) ? ' bad' : ''}${solved ? ' done' : ''}`}
            onClick={() => takeBack(i)}
          >
            {tile.text}
          </button>
        ))}
      </div>

      {wrong.length > 0 && !solved && (
        <div className="build-hint">
          {wrong[0] + 1}번째 자리부터 달라요. 빨간 조각을 눌러 되돌리고 다시 놓아 보세요.
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
