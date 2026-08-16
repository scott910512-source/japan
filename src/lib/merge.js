/* 기기 간 학습 기록 합치기.
 *
 * 아이폰과 아이패드가 각자 공부한 뒤 만나면 한쪽을 통째로 덮어쓸 수 없다.
 * 카드 단위로 "더 최근에 본 쪽"을 남기고, 누적 카운터는 둘 중 큰 값을 쓴다.
 * 큰 값을 쓰는 이유는 합치면 같은 데이터를 두 번 동기화할 때마다 불어나기 때문이다. */

export function mergeReview(local = {}, remote = {}) {
  const out = { ...remote };

  for (const [id, l] of Object.entries(local)) {
    const r = remote[id];
    if (!r) { out[id] = l; continue; }

    // 마지막으로 본 날이 늦은 쪽의 상태(box·streak)를 채택한다
    const localNewer = (l.lastSeen || '') > (r.lastSeen || '');
    const base = localNewer ? l : r;

    out[id] = {
      ...base,
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

export function mergeProgress(local = {}, remote = {}) {
  return {
    ...remote,
    ...local,
    bookmarks: [...new Set([...(remote.bookmarks || []), ...(local.bookmarks || [])])],
    grammarDone: { ...(remote.grammarDone || {}), ...(local.grammarDone || {}) },
    sentenceDone: { ...(remote.sentenceDone || {}), ...(local.sentenceDone || {}) },
  };
}

// 설정은 기기마다 다른 게 자연스럽다(음성 속도, 테마). 학습 범위에 관한 것만 가져온다.
// 음성 API 키는 자격 증명이라 서버에 올리지 않는다.
const SYNCED_SETTINGS = [
  'canReadKana', 'tripDay', 'menus', 'levels',
  'newPerDay', 'reviewMix', 'dailyGoal', 'direction',
  'showKana', 'showExample', 'hangulPron', 'autoMic', 'gttsVoice', 'speakOnJudge',
  'quizCount', 'quizType', 'quizDir', 'quizScope',
];

export function pickSyncedSettings(settings = {}) {
  const out = {};
  for (const key of SYNCED_SETTINGS) {
    if (settings[key] !== undefined) out[key] = settings[key];
  }
  return out;
}
