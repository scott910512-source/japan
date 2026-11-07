import { useEffect, useRef, useState } from 'react';

/* 성장 지도가 쓰는 N3 코스 달성 수.
 *
 * 코스 자료(수천 줄)는 홈에서 안 불러온다 — 지도 탭이 열렸을 때만 계산 조각을 불러와서 코스 화면과 같은 함수
 * (isLessonDone · progressOf)로 센다. 그래서 지도의 숫자와 코스 화면의 진도가 어긋나지 않는다.
 * 코스를 안 켠 사람은 enabled를 false로 둔다 — 그러면 null이고, 지도는 N3 항목을 「계산 중」이 아니라
 * 해당 지역의 항목으로 안 센다(evaluateRegion이 null을 못 센 것으로 둔다). */
export function useN3Meta({ enabled, review, progress }) {
  const [meta, setMeta] = useState(null);
  const latest = useRef({ review, progress });
  latest.current = { review, progress };
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const [m, g] = await Promise.all([import('../lib/n3.js'), import('../data/n3/grammar.js')]);
        if (!live) return;
        const { review: rv, progress: pg } = latest.current;
        const n3 = m.normalizeN3(pg?.n3);
        const chapters = {};
        for (const ch of (g.GRAMMAR_CHAPTERS || []).map((c) => c.id)) {
          const ids = g.grammarOfChapter(ch).map((l) => l.id);
          chapters[ch] = { done: ids.filter((id) => m.isLessonDone(n3, rv, id)).length, total: ids.length };
        }
        const tracks = {};
        for (const tr of m.TRACKS) {
          const ids = m.LESSON_ORDER[tr] || [];
          tracks[tr] = { done: ids.filter((id) => m.isLessonDone(n3, rv, id)).length, total: ids.length };
        }
        const overall = m.progressOf(n3, rv);
        setMeta({ chapters, tracks, overall: { done: overall.done, total: overall.total, pct: overall.pct } });
      } catch { /* 코스 조각을 못 불러와도 지도는 그대로 — 해당 항목만 「계산 중」으로 남는다 */ }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [enabled, review, progress?.n3]);
  return meta;
}
