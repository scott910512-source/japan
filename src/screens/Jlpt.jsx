import { useMemo, useState } from 'react';
import { IconArrowLeft, IconBook, IconCheck, IconChevron } from '../components/Icons.jsx';
import { summarize } from '../lib/review.js';

/* JLPT 레벨별 단어.
 *
 * 연도별(기출) 정리는 하지 않는다. 주관사는 2010년 개편 이후 공식 어휘 목록을
 * 내지 않고 회차별 문제도 공개하지 않는다. 출처가 불분명한 목록을 "기출"이라고
 * 붙이면 나오지도 않은 단어를 외우게 된다. 레벨은 공개된 실제 기준이라
 * 여기에 맞춰 나눈다.
 *
 * 100개씩 끊는 이유는 회독과 맞추기 위해서다. 1211개짜리 N3를 통째로 두면
 * 어디까지 했는지 알 수 없지만, 세트로 끊으면 "3세트까지 끝냈다"가 눈에 보인다. */

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const SET_SIZE = 100;

const LEVEL_NOTE = {
  N5: '기초 — 히라가나를 뗀 직후',
  N4: '초급 — 일상 회화의 뼈대',
  N3: '중급 — 여행·생활이 되는 수준',
  N2: '중상급 — 뉴스와 업무 문서',
  N1: '상급 — 추상·전문 어휘',
};

// 레벨 안에서 순서를 고정한다. 세트 번호가 매번 달라지면 진도가 의미를 잃는다.
export function setsOf(words, level) {
  const pool = words.filter((w) => (w.level || 'N5') === level);
  const sets = [];
  for (let i = 0; i < pool.length; i += SET_SIZE) {
    sets.push({ index: sets.length + 1, cards: pool.slice(i, i + SET_SIZE) });
  }
  return sets;
}

export default function Jlpt({ words, review, onStartSet, onToast }) {
  const [level, setLevel] = useState(null);

  const counts = useMemo(() => {
    const map = {};
    for (const w of words) {
      const lv = w.level || 'N5';
      map[lv] = (map[lv] || 0) + 1;
    }
    return map;
  }, [words]);

  const sets = useMemo(() => (level ? setsOf(words, level) : []), [words, level]);

  if (!level) {
    return (
      <>
        <div className="navtitle"><small>단어암기</small>JLPT 레벨별</div>
        <p className="jl-note" style={{ marginBottom: 14 }}>
          레벨을 고르면 {SET_SIZE}개씩 세트로 나눠 드려요. 세트 하나를 골라 바로 회독할 수 있어요.
        </p>

        <div className="stack">
          {JLPT_LEVELS.map((lv) => {
            const n = counts[lv] || 0;
            const ready = n > 0;
            return (
              <button
                key={lv}
                className="card jl-level"
                disabled={!ready}
                onClick={() => (ready ? setLevel(lv) : onToast?.(`${lv} 단어는 아직 준비 중이에요`))}
              >
                <div className="jl-badge">{lv}</div>
                <div className="jl-body">
                  <div className="jl-title">{LEVEL_NOTE[lv]}</div>
                  <div className="jl-sub">
                    {ready ? `${n}개 · ${Math.ceil(n / SET_SIZE)}세트` : '준비 중'}
                  </div>
                </div>
                {ready && <IconChevron className="chev" />}
              </button>
            );
          })}
        </div>

        <p className="jl-note" style={{ marginTop: 16 }}>
          연도별 기출로 나누지 않은 이유: 주관사가 2010년 개편 이후 공식 어휘 목록을
          내지 않고 회차별 문제도 공개하지 않아요. 출처가 불확실한 목록을 기출이라고
          붙이면 실제로 나온 적 없는 단어를 외우게 됩니다.
        </p>
      </>
    );
  }

  return (
    <>
      <button className="inner-back" onClick={() => setLevel(null)}>
        <IconArrowLeft /> 레벨 다시 고르기
      </button>
      <div className="navtitle"><small>{LEVEL_NOTE[level]}</small>{level} · {counts[level]}개</div>

      <div className="stack">
        {sets.map((set) => {
          const stat = summarize(set.cards.map((c) => c.id), review);
          const done = stat.seen >= set.cards.length;
          const pct = Math.round((stat.seen / set.cards.length) * 100);
          const first = set.cards[0];
          const last = set.cards[set.cards.length - 1];
          return (
            <button
              key={set.index}
              className="card jl-set"
              onClick={() => onStartSet(set.cards, `${level} ${set.index}세트`, `jlpt-${level}-${set.index}`)}
            >
              <div className="jl-setno">{done ? <IconCheck /> : set.index}</div>
              <div className="jl-body">
                <div className="jl-title">{set.index}세트 · {set.cards.length}개</div>
                <div className="jl-sub">{first.kanji} … {last.kanji}</div>
                <div className="jl-bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="jl-pct">{stat.seen}/{set.cards.length}</div>
            </button>
          );
        })}
      </div>

      <p className="jl-note" style={{ marginTop: 14 }}>
        <IconBook /> 세트를 누르면 그 100개만 회독해요. 복습은 평소처럼 복습 탭에 쌓입니다.
      </p>
    </>
  );
}
