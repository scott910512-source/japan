/* 여행 벼락치기 — 목록을 카드로.
 *
 * ★ 기출과 같은 방식, 다른 기준 ★
 *
 * 기출(lib/kiju.js)은 「시험에 나온 적 있나」로 고른다. 여기는 「나흘 동안
 * 입에서 나와야 하나」로 고른다. 둘 다 급수와 상관이 없고, 둘 다 카드를 새로
 * 만들지 않고 단어장에 표기로 이어 붙인다 — 같은 낱말이 두 장이 되면 회독
 * 기록도 둘로 갈린다.
 *
 * ★ 낱말과 문장을 같이 돈다 ★
 *
 * 기출은 낱말만 돈다. 시험이 낱말을 묻기 때문이다. 여행은 반대다 — 空港을
 * 알아도 「JRの乗り場はどこですか」가 안 나오면 공항에서 못 움직인다. 그래서
 * 한 묶음 안에 낱말과 그 묶음의 문장을 같이 넣는다.
 *
 * 낱말이 먼저고 문장이 뒤다. 「両替」를 모르는 채로 「両替できますか」를 들으면
 * 통째로 외우는 수밖에 없는데, 그렇게 외운 건 가게가 바뀌면 안 나온다.
 *
 * ★ 차례는 하루의 차례 ★
 *
 * 공항 → 이동 → 숙소 → 먹기 → 가게 → 눈길 → 곤란할 때. 벼락치기는 끝까지
 * 못 가는 일이 흔해서, 앞에서 끊어도 공항은 넘긴 상태가 되게 해 둔다.
 * 여기서 섞지 않는다 — 섞는 일은 듣기 화면이 정한다(listenOrder). */
import { SAPPORO_GROUPS, SAPPORO_LIST, SAPPORO_SOURCE } from '../data/sapporo.js';
import { SAPPORO_LINES_BY_GROUP } from '../data/situations-sapporo.js';

export { SAPPORO_GROUPS, SAPPORO_LIST, SAPPORO_SOURCE };

/* 이 목록이 어느 상황 묶음의 문장을 데려오는가.
   지금은 삿포로 하나뿐이지만, 다음 여행이 생기면 여기 한 줄을 더한다. */
export const TRIP_SITUATION_ID = 'sapporo';

/* 표기 → 묶음. 목록이 한 벌이라 한 번만 만든다. */
let byWord = null;
function groupOf() {
  if (!byWord) {
    byWord = new Map();
    SAPPORO_LIST.forEach((e, i) => {
      if (!byWord.has(e.w)) byWord.set(e.w, { group: e.g, rank: i, ko: e.ko, kana: e.k });
    });
  }
  return byWord;
}

/* 단어장에서 여행 낱말만, 목록 차례대로.
 *
 * 같은 표기가 단어장에 두 벌 있으면 먼저 나온 것에만 붙인다 — 둘 다 붙이면
 * 같은 낱말이 듣기에서 두 번 나온다(기출에서 겪은 자리라 같이 막는다). */
export function tripWords(words = []) {
  const src = groupOf();
  const used = new Set();
  const out = [];
  for (const w of words) {
    const hit = src.get(w.kanji);
    if (!hit || used.has(w.kanji)) continue;
    used.add(w.kanji);
    out.push({ ...w, trip: hit });
  }
  return out.sort((a, b) => a.trip.rank - b.trip.rank);
}

/* 목록에 있는데 단어장에 없는 표기. 자료가 어긋나면 검사가 여기서 잡는다. */
export function tripMissing(words = []) {
  const have = new Set(words.map((w) => w.kanji));
  return SAPPORO_LIST.filter((e) => !have.has(e.w)).map((e) => e.w);
}

/* 묶음별 문장 id. 자료가 직접 내놓은 것을 그대로 쓴다 — 화면이 들고 있는
   문장 카드에서 글자(place)로 골라내면, 묶음 이름을 한 번 다듬는 순간
   조용히 안 맞는다. */
export function tripLines() {
  return SAPPORO_LINES_BY_GROUP.flatMap(
    (ids, rank) => ids.map((id) => ({ id, rank })),
  );
}

/* 듣기가 받을 후보 — [{ id, kind }].
 *
 * 묶음마다 낱말을 먼저, 그 묶음의 문장을 뒤에 놓는다. 묶음 차례는 하루의
 * 차례다. 낱말과 문장의 묶음 이름이 서로 다른 자리에 적혀 있어서(목록의 g와
 * 상황의 파트 id) 여기서 이어 붙인다 — air ↔ sapporo-1, move ↔ sapporo-2 … */
export function tripPool(words = []) {
  const ws = tripWords(words);
  const lines = tripLines();
  const order = SAPPORO_GROUPS.map((g) => g.id);

  const out = [];
  order.forEach((gid, i) => {
    for (const w of ws) if (w.trip.group === gid) out.push({ id: w.id, kind: 'word' });
    for (const l of lines) if (l.rank === i) out.push({ id: l.id, kind: 'sentence' });
  });

  /* 묶음에 안 걸린 것이 있으면 뒤에 붙인다. 목록을 늘리다가 묶음 이름을
     잘못 적으면 조용히 사라지는데, 그게 제일 찾기 어렵다. */
  const taken = new Set(out.map((x) => x.id));
  for (const w of ws) if (!taken.has(w.id)) out.push({ id: w.id, kind: 'word' });
  for (const l of lines) if (!taken.has(l.id)) out.push({ id: l.id, kind: 'sentence' });
  return out;
}

/* 벼락치기 진도 — 몇 개나 봤고 몇 개나 뗐나.
   기준은 회독 쪽 것을 그대로 쓴다. 여기서 따로 정하면 같은 카드가 화면마다
   다른 상태로 보인다. */
export function tripStat(pool, stateOf, isDoneEnough) {
  let seen = 0; let done = 0;
  for (const c of pool) {
    const st = stateOf(c.id);
    if (!st?.lastSeen) continue;
    seen += 1;
    if (isDoneEnough(st)) done += 1;
  }
  return { total: pool.length, seen, done, left: pool.length - seen };
}
