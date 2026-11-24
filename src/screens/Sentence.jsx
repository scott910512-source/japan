import { Fragment, useMemo, useState } from 'react';
import BottomSheet from '../components/BottomSheet.jsx';
import { PATTERNS } from '../data/sentences.js';

export default function Sentence({ words, progress, onPatternDone }) {
  const [openId, setOpenId] = useState(null);
  const [wordIndex, setWordIndex] = useState(0);

  const knownSet = useMemo(() => new Set(progress.known), [progress.known]);
  const pattern = PATTERNS.find((p) => p.id === openId);

  const eligibleWords = useMemo(() => {
    if (!pattern) return [];
    const candidates = words.filter(pattern.wordFilter);
    const known = candidates.filter((w) => knownSet.has(w.id));
    return known.length ? known : candidates;
  }, [pattern, words, knownSet]);

  const open = (id) => {
    setOpenId(id);
    setWordIndex(0);
    onPatternDone(id);
  };
  const close = () => setOpenId(null);

  const currentWord = eligibleWords[wordIndex % eligibleWords.length];
  const built = currentWord && pattern ? pattern.build(currentWord) : null;
  const usingKnownWords = currentWord && knownSet.has(currentWord.id);

  return (
    <>
      <div className="navtitle"><small>NEW</small>문장</div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '-6px 0 14px', lineHeight: 1.6 }}>
        암기한 단어를 기초 문형에 끼워 넣어 실제 문장으로 익혀요.
      </p>

      <div className="stack">
        {PATTERNS.map((p) => (
          <div key={p.id} className="pattern-card" onClick={() => open(p.id)}>
            {/* 빈칸만 강조 — HTML 문자열을 넣지 않고 조각으로 그린다(보안 감사 #11: dangerouslySetInnerHTML 없앰) */}
            <div className="pattern-jp">
              {p.jp.split('〇〇').map((part, i, all) => (
                <Fragment key={i}>{part}{i < all.length - 1 && <span className="blank">〇〇</span>}</Fragment>
              ))}
            </div>
            <div className="pattern-kr">{p.kr}{progress.sentenceDone[p.id] ? ' · 학습 완료' : ''}</div>
            <div className="pattern-meta">
              {p.tags.map((t) => <span key={t} className="tagpill">{t}</span>)}
            </div>
          </div>
        ))}
      </div>

      <BottomSheet open={!!pattern} onClose={close} label="문장 패턴">
        {pattern && built && (
          <>
            <h3>{pattern.jp}</h3>
            <div className="sub">{pattern.kr}</div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{built.jp}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{built.kr}</div>
            </div>
            {usingKnownWords && (
              <div style={{ fontSize: 11.5, color: 'var(--kon)', marginBottom: 6, fontWeight: 600 }}>
                암기한 단어로 만든 문장이에요
              </div>
            )}
            {eligibleWords.length > 1 && (
              <button className="swap-btn" onClick={() => setWordIndex((i) => i + 1)}>
                다른 단어로 바꾸기 →
              </button>
            )}
          </>
        )}
      </BottomSheet>
    </>
  );
}
