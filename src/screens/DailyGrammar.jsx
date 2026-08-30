import { useMemo, useState } from 'react';
import { IconChevron, IconCheck } from '../components/Icons.jsx';
import BlankRun from '../components/BlankRun.jsx';
import {
  DAILY_GRAMMAR_SETS, buildSet, recordOf, scoreOf, setStats,
} from '../lib/dailygrammar.js';
import { todayKey } from '../lib/review.js';

/* 일상문법 — 매일 쓰는 자리에 무엇을 넣는가.
 *
 * 기초문법은 규칙표다. 「1그룹 く는 いて가 된다」를 외우는 자리.
 * 여기는 그 규칙을 아는데도 틀리는 자리를 다룬다 — 「電車を乗ります」는
 * を의 뜻을 몰라서가 아니라, 乗る가 に를 받는 걸 문장 안에서 안 만나 봐서다.
 *
 * 그래서 설명을 읽는 화면이 아니라 문장에 넣어 보는 화면으로 만든다. */

export default function DailyGrammar({ progress, settings, onProgress, onToast }) {
  const [setId, setSetId] = useState(null);
  const done = progress?.dailyGrammar || {};
  const stats = useMemo(() => setStats(done), [done]);

  if (!setId) {
    const cleared = stats.filter((s) => s.cleared).length;
    return (
      <>
        <p className="set-note av-intro" style={{ marginTop: 0 }}>
          규칙을 아는데도 틀리는 자리를 모았어요. 「電車を乗ります」가 틀린 건 を의 뜻을
          몰라서가 아니라, 乗る가 に를 받는 걸 문장 안에서 안 만나 봐서예요.
        </p>

        <div className="section-label">
          묶음 고르기
          <span className="mg-sub">{cleared} / {stats.length} 다 맞힘</span>
        </div>
        <div className="stack">
          {stats.map((s) => (
            <button key={s.id} className="rowcard av-set dg-set" onClick={() => setSetId(s.id)}>
              <span className="rc-body">
                <b>{s.label}</b>
                <span>{s.sub}</span>
              </span>
              <span className="av-count">
                {s.cleared
                  ? <i className="dg-clear"><IconCheck /> 다 맞힘</i>
                  : <><b>{s.right}</b>/ {s.total}</>}
              </span>
              <IconChevron className="chev" />
            </button>
          ))}
        </div>

        <p className="set-note">
          여기서 틀린 건 회독에 안 쌓여요 — 「を」는 외울 카드가 아니라 자리라서요.
          대신 묶음마다 몇 개 맞혔는지 남습니다.
        </p>
      </>
    );
  }

  return (
    <BlankRun
      key={setId}
      set={DAILY_GRAMMAR_SETS.find((s) => s.id === setId)}
      items={buildSet(setId)}
      settings={settings}
      onDone={(answers, items) => {
        onProgress?.(recordOf(done, setId, scoreOf(answers, items), todayKey()));
      }}
      onQuit={() => setSetId(null)}
      onToast={onToast}
    />
  );
}
