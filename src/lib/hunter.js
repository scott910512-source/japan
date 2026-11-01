/* Hunter rewards are derived from unique saved achievements, never click counters.
 * Existing review/progress records remain the source of truth and keep syncing as before. */
export function hunterProfile({ words = [], review = {}, progress = {} } = {}) {
  const seen = Object.entries(review).filter(([, s]) => s?.lastSeen && !s.selfKnown);
  const wordIds = new Set(words.map((w) => w.id));
  const lessons = Object.values(progress.n3?.lessons || {}).filter((s) => s?.done).length;
  const grammar = Object.values(progress.grammarDone || {}).filter((n) => n > 0).length;
  const stages = Object.values(progress.rpg?.stages || {});
  const cleared = stages.filter((s) => s.cleared > 0).length;
  const tests = Object.values(progress.n3?.tests || {}).filter((t) => t.total > 0).length;
  const xp = seen.length * 10 + (lessons + grammar) * 25 + cleared * 75 + tests * 20;
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const floor = (level - 1) ** 2 * 100;
  const ceiling = level ** 2 * 100;
  const rank = level >= 20 ? '트리플 스타 헌터' : level >= 12 ? '더블 스타 헌터' : level >= 6 ? '싱글 스타 헌터' : level >= 3 ? '루키 헌터' : '헌터 지망생';
  const levels = Object.fromEntries(['N5', 'N4', 'N3'].map((lv) => {
    const pool = words.filter((w) => String(w.level).toUpperCase() === lv);
    return [lv, { total: pool.length, seen: pool.filter((w) => review[w.id]?.lastSeen).length }];
  }));
  const diagnostic = progress.n3?.tests?.['t:ch0'];
  const recommended = diagnostic?.best >= .8 ? 4 : diagnostic?.total ? 2 : levels.N5.seen >= 30 ? 2 : seen.length ? 1 : 0;
  const skills = [
    { key: 'grammar', label: '문법력', icon: '文', pct: progress.n3?.summary?.areas?.grammar ?? null, detail: `${grammar + seen.filter(([id]) => id.startsWith('g:')).length}개 학습 기록`, menu: 'grammar' },
    { key: 'vocab', label: '어휘력', icon: '字', pct: words.length ? Math.round(words.reduce((n, w) => n + (review[w.id]?.lastSeen && !review[w.id]?.selfKnown ? Math.min(5, Math.max(0, review[w.id]?.level ?? review[w.id]?.streak ?? 0)) / 5 : 0), 0) / words.length * 100) : null, detail: `${seen.filter(([id]) => wordIds.has(id)).length}단어 학습`, menu: 'words' },
    { key: 'listening', label: '청해력', icon: '聴', pct: progress.n3?.summary?.areas?.listening ?? null, detail: 'N3 청해 문제 결과 기준', menu: 'listen' },
    { key: 'conversation', label: '회화력', icon: '話', pct: stages.some((s) => Number.isFinite(s.checkpoint)) ? Math.round(stages.reduce((n, s) => n + (s.checkpoint || 0), 0) / stages.length * 100) : null, detail: `${cleared}개 상황 통과 · 연습 지표`, menu: 'rpg' },
  ];
  const badges = [
    { id: 'first', symbol: '✦', title: '첫 발걸음', note: '카드 1개 학습', earned: seen.length >= 1 },
    { id: 'words', symbol: '百', title: '백 가지 발견', note: '카드 100개 학습', earned: seen.length >= 100 },
    { id: 'lesson', symbol: '✧', title: '수련의 시작', note: '레슨 또는 문법 1개 완료', earned: lessons + grammar > 0 },
    { id: 'talk', symbol: '話', title: '실전 헌터', note: '상황 대화 1개 통과', earned: cleared > 0 },
    { id: 'test', symbol: '✓', title: '시험에 도전', note: '진단·확인 시험 1회 완료', earned: tests > 0 },
    { id: 'level', symbol: '★', title: '싱글 스타', note: '헌터 레벨 6 달성', earned: level >= 6 },
  ];
  return { xp, level, floor, ceiling, rank, levels, recommended, skills, badges, seen: seen.length, lessons, cleared, diagnostic, percent: Math.round((xp - floor) / (ceiling - floor) * 100) };
}
