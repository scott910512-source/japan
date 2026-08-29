import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconSpeaker, IconCheck, IconPlay } from '../components/Icons.jsx';
import { speakJapanese } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import {
  MODE, MODE_HINT, MODE_LABEL, PAIRS, buildBoard, scoreOf, verdictOf,
} from '../lib/match.js';

/* 짝 맞추기.
 *
 * 왼쪽에서 하나, 오른쪽에서 하나를 눌러 짝을 만든다. 맞으면 둘 다 지워지고,
 * 틀리면 잠깐 흔들리고 되돌아온다. 규칙 설명이 필요 없는 게 이 판의 전부다.
 *
 * 회독 기록은 건드리지 않는다 — 짝 맞추기는 다섯 개 중에 고르는 일이라
 * 떠올리는 것보다 훨씬 쉽다. 여기서 맞혔다고 「알아요」로 세면 복습 간격이
 * 실력보다 빨리 벌어진다. 화면에도 그렇게 적어 둔다. */

const ROUNDS = 4;   // 한 게임에 네 판. 다섯 쌍씩이니 스무 개쯤 스친다.

export default function Match({ cards, review, settings, onToast }) {
  const [mode, setMode] = useState(null);        // null이면 무엇을 할지 고르는 화면
  const [board, setBoard] = useState(null);
  const [round, setRound] = useState(1);
  const [picked, setPicked] = useState(null);    // 왼쪽에서 고른 id
  const [matched, setMatched] = useState([]);    // 짝을 찾은 id
  const [wrong, setWrong] = useState(null);      // 방금 틀린 짝 — 잠깐 흔든다
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(null);
  const seen = useRef([]);                       // 이번 게임에 이미 낸 것
  const startedAt = useRef(0);
  const rate = settings.speechRate;

  const say = useCallback((kana) => speakJapanese(kana, rate), [rate]);

  const deal = useCallback((m, keepSeen) => {
    const next = buildBoard(cards, review, { mode: m, pairs: PAIRS, exclude: keepSeen ? seen.current : [] });
    if (!next) { onToast('짝 맞추기에 쓸 단어가 모자라요'); return false; }
    seen.current = [...seen.current, ...next.pairs.map((p) => p.id)];
    setBoard(next);
    setPicked(null);
    setMatched([]);
    setWrong(null);
    return true;
  }, [cards, review, onToast]);

  const start = (m) => {
    seen.current = [];
    setMisses(0);
    setRound(1);
    setDone(null);
    startedAt.current = Date.now();
    if (deal(m, false)) setMode(m);
  };

  // 소리판은 왼쪽을 누르기 전엔 아무것도 안 들린다 — 첫 짝은 한 번 들려준다
  useEffect(() => {
    if (!board || board.mode !== MODE.SOUND) return;
    const first = board.left[0];
    const p = board.pairs.find((x) => x.id === first);
    if (p) say(p.kana);
  }, [board, say]);

  const pairOf = (id) => board?.pairs.find((p) => p.id === id);

  const tapLeft = (id) => {
    if (matched.includes(id)) return;
    setPicked(id);
    if (board.mode === MODE.SOUND) say(pairOf(id).kana);
  };

  const tapRight = (id) => {
    if (matched.includes(id) || !picked) return;
    if (id === picked) {
      const next = [...matched, id];
      setMatched(next);
      setPicked(null);
      if (board.mode === MODE.TEXT) say(pairOf(id).kana);
      if (next.length === board.pairs.length) finishRound();
      return;
    }
    setMisses((n) => n + 1);
    setWrong(id);
    setTimeout(() => setWrong(null), 420);
  };

  const finishRound = () => {
    setTimeout(() => {
      if (round >= ROUNDS) {
        const seconds = Math.round((Date.now() - startedAt.current) / 1000);
        const pairs = seen.current.length;
        setDone({ pairs, misses, seconds, score: scoreOf({ pairs, misses, seconds }) });
        return;
      }
      setRound((r) => r + 1);
      deal(board.mode, true);
    }, 500);
  };

  // ── 무엇을 할지 고르기 ──
  if (!mode) {
    return (
      <div className="mt">
        <p className="vd-note">
          왼쪽과 오른쪽에서 짝을 찾는 놀이예요. 한 판 다섯 쌍, {ROUNDS}판이면 끝나요.
          <b> 회독 기록은 안 건드려요</b> — 고르는 건 떠올리는 것보다 쉬워서, 여기서 맞혔다고
          「알아요」로 세면 복습이 실력보다 빨리 벌어져요.
        </p>

        {[MODE.TEXT, MODE.SOUND].map((m) => (
          <button key={m} className="mt-pick" onClick={() => start(m)}>
            <span className="mt-picon">{m === MODE.SOUND ? <IconSpeaker /> : <IconPlay />}</span>
            <span className="mt-pbody">
              <b>{MODE_LABEL[m]}</b>
              <span>{MODE_HINT[m]}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  // ── 끝 ──
  if (done) {
    return (
      <div className="mt">
        <div className="finish">
          <div className="fin-badge">🎉</div>
          <h2>{verdictOf(done)}</h2>
          <div className="fin-big"><b>{done.score}</b><span>점</span></div>
          <div className="fin-grid">
            <div className="fin-cell ok"><b>{done.pairs}</b><span>맞힌 짝</span></div>
            <div className="fin-cell no"><b>{done.misses}</b><span>틀린 횟수</span></div>
            <div className="fin-cell mid"><b>{done.seconds}</b><span>초</span></div>
          </div>
          <button className="submit-btn" onClick={() => start(mode)}>한 판 더</button>
          <button className="ghost-btn" onClick={() => setMode(null)}>다른 판으로</button>
        </div>
      </div>
    );
  }

  // ── 판 ──
  return (
    <div className="mt">
      {/* 위에 이미 「뒤로」가 있다. 여기 하나 더 두면 같은 자리에 둘이 겹친다. */}
      <div className="mt-head">
        <div className="sh-title">{MODE_LABEL[mode]} · {round} / {ROUNDS}판</div>
        <div className="qh-score">{misses}번 틀림</div>
      </div>

      <div className="mt-board">
        <div className="mt-col">
          {board.left.map((id) => {
            const p = pairOf(id);
            const gone = matched.includes(id);
            return (
              <button
                key={id}
                className={`mt-tile${gone ? ' gone' : ''}${picked === id ? ' on' : ''}`}
                disabled={gone}
                onClick={() => tapLeft(id)}
                aria-label={board.mode === MODE.SOUND ? '눌러서 소리 듣기' : p.jp}
              >
                {board.mode === MODE.SOUND ? (
                  <span className="mt-sound"><IconSpeaker /></span>
                ) : (
                  <>
                    <b>{p.jp}</b>
                    {settings.hangulPron && <i>{kanaToHangul(p.kana)}</i>}
                  </>
                )}
                {gone && <span className="mt-ok"><IconCheck /></span>}
              </button>
            );
          })}
        </div>

        <div className="mt-col">
          {board.right.map((id) => {
            const p = pairOf(id);
            const gone = matched.includes(id);
            return (
              <button
                key={id}
                className={`mt-tile${gone ? ' gone' : ''}${wrong === id ? ' bad' : ''}`}
                disabled={gone}
                onClick={() => tapRight(id)}
              >
                {board.mode === MODE.SOUND ? <b>{p.jp}</b> : <b className="mt-ko">{p.mean}</b>}
                {gone && <span className="mt-ok"><IconCheck /></span>}
              </button>
            );
          })}
        </div>
      </div>

      <p className="set-note mt-foot">
        {picked
          ? '오른쪽에서 짝을 고르세요'
          : (board.mode === MODE.SOUND ? '왼쪽을 눌러 소리를 들어 보세요' : '왼쪽에서 하나 고르세요')}
      </p>
    </div>
  );
}
