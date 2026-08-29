/* 기기 간 학습 기록 합치기.
 *
 * 아이폰과 아이패드가 각자 공부한 뒤 만나면 한쪽을 통째로 덮어쓸 수 없다.
 * 카드 단위로 "더 최근에 본 쪽"을 남기고, 누적 카운터는 둘 중 큰 값을 쓴다.
 * 큰 값을 쓰는 이유는 합치면 같은 데이터를 두 번 동기화할 때마다 불어나기 때문이다. */

/* 카드 한 장의 상태(box·streak)는 나중에 본 쪽을 남긴다.
 *
 * 날짜(lastSeen)가 다르면 그것으로 정해진다. 같은 날이면 시각(seenAt)으로
 * 가른다 — 같은 날 같은 카드를 두 기기에서 다르게 판정하는 일이 실제로 있고,
 * 날짜만 보면 먼저 올린 쪽이 이겨서 나중에 한 공부가 묻혔다.
 * seenAt이 없는 건 이 기능 이전에 쌓인 기록이라 있는 쪽을 나중으로 본다. */
function laterOf(l, r) {
  const dl = l.lastSeen || '';
  const dr = r.lastSeen || '';
  if (dl !== dr) return dl > dr ? l : r;
  return (l.seenAt || 0) > (r.seenAt || 0) ? l : r;
}

export function mergeReview(local = {}, remote = {}) {
  const out = { ...remote };

  for (const [id, l] of Object.entries(local)) {
    const r = remote[id];
    if (!r) { out[id] = l; continue; }

    const base = laterOf(l, r);

    out[id] = {
      ...base,
      seenAt: Math.max(l.seenAt || 0, r.seenAt || 0),
      rounds: Math.max(l.rounds || 0, r.rounds || 0),
      wrongCount: Math.max(l.wrongCount || 0, r.wrongCount || 0),
      vagueCount: Math.max(l.vagueCount || 0, r.vagueCount || 0),
    };
  }
  return out;
}

// 메모는 글이라 합칠 수 없다. 나중에 고친 쪽을 남긴다.
export function mergeMemos(local = {}, remote = {}) {
  const out = { ...remote };
  for (const [id, l] of Object.entries(local)) {
    const r = remote[id];
    if (!r) { out[id] = l; continue; }
    out[id] = (l.at || '') >= (r.at || '') ? l : r;
  }
  return out;
}

export function mergeStats(local = {}, remote = {}) {
  const out = { ...remote };
  for (const [day, l] of Object.entries(local)) {
    const r = remote[day] || {};
    // 같은 날 두 기기에서 공부했으면 합쳐야 맞지만, 합치면 재동기화마다 불어난다.
    // 통계는 정확도보다 안정성이 중요하므로 큰 쪽을 남긴다.
    out[day] = {
      studied: Math.max(l.studied || 0, r.studied || 0),
      known: Math.max(l.known || 0, r.known || 0),
      vague: Math.max(l.vague || 0, r.vague || 0),
      unknown: Math.max(l.unknown || 0, r.unknown || 0),
    };
  }
  return out;
}

export function mergeStreak(local = {}, remote = {}) {
  const localNewer = (local.lastDate || '') >= (remote.lastDate || '');
  return {
    count: Math.max(local.count || 0, remote.count || 0),
    lastDate: localNewer ? local.lastDate : remote.lastDate,
  };
}

export function mergeCustomWords(local = [], remote = []) {
  const seen = new Set();
  const out = [];
  for (const w of [...remote, ...local]) {
    if (!w?.id || seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
  }
  return out;
}

/* 맞고 틀린 횟수는 더하지 않고 큰 쪽을 쓴다.
 *
 * 더하면 같은 기기에서 동기화를 두 번만 눌러도 숫자가 두 배가 된다 —
 * 일별 집계(mergeStats)에서 이미 겪은 자리라 같은 방식으로 둔다. */
function mergeCounts(local = {}, remote = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    const a = local?.[k] || {}; const b = remote?.[k] || {};
    out[k] = {
      right: Math.max(a.right || 0, b.right || 0),
      wrong: Math.max(a.wrong || 0, b.wrong || 0),
    };
  }
  return out;
}

/* 동사 활용 성적 — { forms: {'1|masu': {right,wrong}}, words: {단어id: {…}} } */
export function mergeConj(local = {}, remote = {}) {
  return {
    forms: mergeCounts(local?.forms, remote?.forms),
    words: mergeCounts(local?.words, remote?.words),
  };
}

/* 일본 생존 — { exp, stages: {id: {learned, checkpoint, cleared, best}} }
 *
 * 큰 쪽을 남긴다. 더하면 안 된다 — 폰에서 두 번, 태블릿에서 두 번 깼을 때
 * 합치면 네 번이 되고, 같은 판을 두 기기가 다 본 것뿐인데 기록이 부풀어
 * 오른다. 어느 한쪽이라도 도달한 데까지가 그 사람이 도달한 데다. */
export function mergeRpg(local = {}, remote = {}) {
  const stages = {};
  for (const id of new Set([...Object.keys(local.stages || {}), ...Object.keys(remote.stages || {})])) {
    const a = local.stages?.[id] || {};
    const b = remote.stages?.[id] || {};
    stages[id] = {
      learned: Boolean(a.learned || b.learned),
      checkpoint: Math.max(a.checkpoint || 0, b.checkpoint || 0),
      cleared: Math.max(a.cleared || 0, b.cleared || 0),
      best: Math.max(a.best || 0, b.best || 0),
    };
  }
  return { exp: Math.max(local.exp || 0, remote.exp || 0), stages };
}

export function mergeProgress(local = {}, remote = {}) {
  return {
    ...remote,
    ...local,
    bookmarks: [...new Set([...(remote.bookmarks || []), ...(local.bookmarks || [])])],
    grammarDone: { ...(remote.grammarDone || {}), ...(local.grammarDone || {}) },
    sentenceDone: { ...(remote.sentenceDone || {}), ...(local.sentenceDone || {}) },
    // 활용 성적은 두 기기에서 푼 게 다 남아야 한다 — local이 통째로 덮으면 사라진다
    conj: mergeConj(local.conj, remote.conj),
    rpg: mergeRpg(local.rpg, remote.rpg),
  };
}

/* 영상으로 배우기 — 담아 둔 목록 · 자막 · 설명 · 진도.
 *
 * { list: [{id, addedAt}], removed: {id: 뺀시각}, scripts: {id: 글},
 *   analyses: {id: {…, at}}, progress: {id: {scriptStep, scriptDone, step, done}} }
 *
 * 뺀 영상을 되살리지 않는 게 이 함수의 제일 큰 일이다. 목록을 그냥 합치면
 * 한쪽에서 뺀 영상이 다른 기기에 남아 있다가 다음 동기화에 돌아온다. 그래서
 * 묘비(removed)를 같이 들고 다니며, 묘비보다 나중에 담은 것만 살린다 —
 * 다시 담으면 addedAt이 새로워지니 그때는 제대로 돌아온다. */
export function mergeVideos(local = {}, remote = {}) {
  const removed = {};
  for (const id of new Set([...Object.keys(local.removed || {}), ...Object.keys(remote.removed || {})])) {
    removed[id] = Math.max(local.removed?.[id] || 0, remote.removed?.[id] || 0);
  }

  const byId = new Map();
  for (const v of [...(remote.list || []), ...(local.list || [])]) {
    if (!v?.id) continue;
    byId.set(v.id, { id: v.id, addedAt: Math.max(byId.get(v.id)?.addedAt || 0, v.addedAt || 0) });
  }
  const list = [...byId.values()]
    .filter((v) => !(removed[v.id] > v.addedAt))
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  const live = new Set(list.map((v) => v.id));
  const keep = (map) => Object.fromEntries(Object.entries(map).filter(([id]) => live.has(id)));

  /* 자막은 언제 고쳤는지 기록해 두지 않아서 나중 것을 가릴 수가 없다.
     지금 기기 것을 남긴다 — 방금 눈으로 보고 저장한 쪽이 그쪽이다. */
  const scripts = keep({ ...(remote.scripts || {}), ...(local.scripts || {}) });

  // 설명은 만든 시각(at)이 있으니 나중에 만든 것을 남긴다
  const analyses = {};
  for (const id of new Set([...Object.keys(remote.analyses || {}), ...Object.keys(local.analyses || {})])) {
    if (!live.has(id)) continue;
    const l = local.analyses?.[id];
    const r = remote.analyses?.[id];
    analyses[id] = !r || (l && (l.at || 0) >= (r.at || 0)) ? l : r;
  }

  /* 진도는 앞선 쪽을 남긴다. 마쳤다는 표시는 한 번 서면 지우지 않는다 —
     한쪽에서 마친 걸 다른 기기가 "아직 안 함"으로 되돌리면 안 된다. */
  const progress = {};
  for (const id of new Set([...Object.keys(remote.progress || {}), ...Object.keys(local.progress || {})])) {
    if (!live.has(id)) continue;
    const l = local.progress?.[id] || {};
    const r = remote.progress?.[id] || {};
    progress[id] = {
      scriptStep: Math.max(l.scriptStep || 0, r.scriptStep || 0),
      scriptDone: Boolean(l.scriptDone || r.scriptDone),
      step: Math.max(l.step || 0, r.step || 0),
      done: Boolean(l.done || r.done),
    };
  }

  return { list, removed, scripts, analyses, progress };
}

// 설정은 기기마다 다른 게 자연스럽다(음성 속도, 테마). 학습 범위에 관한 것만 가져온다.
// 음성 API 키는 자격 증명이라 서버에 올리지 않는다.
const SYNCED_SETTINGS = [
  'canReadKana', 'tripDay', 'menus', 'levels',
  'dailyGoal', 'direction', 'tripPlace',
  'showKana', 'showExample', 'hangulPron', 'autoMic', 'gttsVoice', 'speakOnJudge',
  'quizCount', 'quizType', 'quizDir', 'quizScope', 'videoTranscribe',
];

export function pickSyncedSettings(settings = {}) {
  const out = {};
  for (const key of SYNCED_SETTINGS) {
    if (settings[key] !== undefined) out[key] = settings[key];
  }
  return out;
}
