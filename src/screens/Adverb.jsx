import { useMemo, useState } from 'react';
import { IconChevron } from '../components/Icons.jsx';
import BlankRun from '../components/BlankRun.jsx';
import { ADVERB_SETS, buildSet, setStats, verdictsFrom } from '../lib/adverb.js';

/* 부사 연습 — 빈칸 채우기.
 *
 * 부사는 카드로 안 배워진다. 「あまり = 별로」를 외운 사람이 「あまり
 * わかります」라고 쓴다 — 뒤에 부정이 와야 한다는 걸 뜻만으로는 못 배운다.
 * 그래서 문장 안에 넣는 연습을 따로 뒀다.
 *
 * 한 판을 도는 일은 BlankRun이 한다 — 일상문법과 똑같은 화면이라 두 벌로
 * 두지 않는다. 여기 남는 건 부사라서 다른 것뿐이다. 틀린 부사를 단어 카드에
 * 이어 붙여 다음 날 오늘의 학습에 약점으로 올리는 부분. */

export default function Adverb({ words, review, settings, onReview, onToast }) {
  const [setId, setSetId] = useState(null);
  const stats = useMemo(() => setStats(words, review), [words, review]);

  if (!setId) {
    return (
      <>
        <p className="set-note av-intro" style={{ marginTop: 0 }}>
          부사는 뜻만 외우면 자리에 못 넣어요. 「あまり」는 뒤에 반드시 부정이 옵니다 —
          그런 건 문장 안에서만 배워져요.
        </p>
        <div className="section-label">묶음 고르기</div>
        <div className="stack">
          {stats.map((s) => (
            <button key={s.id} className="rowcard av-set" onClick={() => setSetId(s.id)}>
              <span className="rc-body">
                <b>{s.label}</b>
                <span>{s.sub}</span>
              </span>
              <span className="av-count">
                {s.weak > 0 ? <i className="av-weak">약점 {s.weak}</i> : null}
                <b>{s.total}</b>문제
              </span>
              <IconChevron className="chev" />
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <BlankRun
      key={setId}
      set={ADVERB_SETS.find((s) => s.id === setId)}
      items={buildSet(setId)}
      settings={settings}
      wrongNote="오늘의 학습에 약점으로 올라가요"
      onDone={(answers, items) => {
        const v = verdictsFrom(answers, items, words);
        if (Object.keys(v).length) onReview(v);
      }}
      onQuit={() => setSetId(null)}
      onToast={onToast}
    />
  );
}
