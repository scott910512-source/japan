import { useMemo, useState } from 'react';
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
            <div className="pattern-jp" dangerouslySetInnerHTML={{ __html: p.jp.replace('〇〇', '<span class="blank">〇〇</span>') }} />
            <div className="pattern-kr">{p.kr}{progress.sentenceDone[p.id] ? ' · 학습 완료' : ''}</div>
            <div className="pattern-meta">
              {p.tags.map((t) => <span key={t} className="tagpill">{t}</span>)}
            </div>
          </div>
        ))}
      </div>

      <BottomSheet open={!!pattern} onClose={close}>
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
