/* 검사용 회독 기록 — 낱말이 세 칸(뜻 · 읽기 · 떠올리기) 모두 같은 단계까지 확인된 상태로 심는다.
 * 2026-11-19부터 낱말은 세 칸이 다 확인돼야 그 단계다(lib/review.js FACETS). fx 없이 level만 심으면
 * 앱이 「뜻만 확인됨」으로 옮겨서 단계가 0이 된다 — 외운 것을 보려는 검사는 이걸로 심는다. */
export function allFacets(st) {
  const f = { lv: st.level || 0, due: st.due ?? null, on: null };
  return { ...st, fx: { mean: { ...f }, read: { ...f }, prod: { ...f }, listen: { ...f } } };
}
