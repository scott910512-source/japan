import { useEffect, useRef } from 'react';

/* 오늘 탭의 「JLPT N3 ○%」를 실제 학습에 맞춰 갱신한다.
 *
 * 그 숫자는 N3 코스 화면이 열릴 때 적어 둔 요약(progress.n3.summary)에서 그린다 — 홈은 코스 자료
 * (수천 줄)를 안 불러오기 때문이다. 그래서 퀘스트로 단어·한자·문법을 풀어 회독 기록이 올라도
 * 코스를 열기 전까지는 숫자가 그대로였다.
 *
 * 회독 기록(review)이 바뀌고 잠깐 조용해지면(2.5초), 한가할 때 코스 계산 조각을 불러와 요약만 다시 적는다.
 * 숫자가 같으면 적지 않는다(저장·동기화가 헛돌지 않게). 아직 아무것도 안 했으면(0%) 「시작 전」으로 둔다. */

const QUIET_MS = 2500;

export function useN3Summary({ review, progress, setProgress, enabled }) {
  const latest = useRef(progress);
  latest.current = progress;

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const m = await import('../lib/n3.js');
        if (!live) return;
        const n3 = m.normalizeN3(latest.current?.n3);
        const prog = m.progressOf(n3, review);
        const ready = m.readinessOf(n3, review);
        const cur = n3.summary;
        if (!cur && ready.total === 0 && prog.done === 0 && ready.exact === 0) return;   // 아직 시작 전
        const areas = { vocab: ready.vocab, kanji: ready.kanji, grammar: ready.grammar, reading: ready.reading, listening: ready.listening };
        const same = cur && cur.done === prog.done && cur.total === prog.total && cur.ready === ready.total && cur.exact === ready.exact
          && m.TRACKS.every((t) => cur.areas?.[t] === areas[t]);
        if (same) return;
        setProgress((p) => ({
          ...p,
          n3: { ...m.normalizeN3(p?.n3), summary: { done: prog.done, total: prog.total, pct: prog.pct, ready: ready.total, exact: ready.exact, areas, at: Date.now() } },
        }));
      } catch { /* 조각을 못 불러와도 앱은 그대로 — 다음 변화 때 다시 시도 */ }
    }, QUIET_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [review, enabled, setProgress]);
}
