/* 기출 단어를 단어장에 이어 붙인다.
 *
 * ★ 왜 「나온 적 있다」가 순서를 정하나 ★
 *
 * 단어장에는 3,000개가 있고 하루에 배우는 것은 여덟 개다. 어느 여덟 개냐가
 * 시험 전까지 만나는 단어를 정한다. 여태 그 순서는 자료에 담긴 차례였다 —
 * 어느 파일에 먼저 적혔는지가 순서였다는 뜻이고, 그건 순서가 아니다.
 *
 * 기출은 근거가 있는 순서다. 열여섯 해 동안 실제로 나온 낱말이고, 두 번
 * 이상 나온 서른여섯 개는 앞으로도 나올 자리가 그만큼 넓다.
 *
 * ★ 이어 붙이는 것이지 새로 만드는 게 아니다 ★
 *
 * 기출 카드를 따로 만들면 같은 단어가 두 장이 된다 — 하나는 오늘의 학습에서,
 * 하나는 기출에서. 외운 기록도 둘로 갈린다. 그래서 카드는 단어장 것을 그대로
 * 쓰고, 여기는 「그 카드가 몇 번 나왔나」만 붙인다. 회독 기록(review)은 한 벌이다. */
import { KIJU_LIST, KIJU_SOURCE } from '../data/kiju.js';

export { KIJU_LIST, KIJU_SOURCE };

/* 표기 → { years, count }. 목록이 한 벌이라 한 번만 만든다. */
let byWord = null;
export function kijuByWord() {
  if (!byWord) {
    byWord = new Map();
    for (const e of KIJU_LIST) byWord.set(e.w, { years: e.y, count: e.y.length, ko: e.ko, kana: e.k });
  }
  return byWord;
}

/* 단어 id → { years, count }.
 *
 * 표기로 잇는다. 단어장이 커지면서 같은 표기가 두 벌 들어오는 일이 있는데,
 * 그때는 먼저 나온 것에만 붙인다 — 둘 다 붙이면 같은 낱말이 기출 목록에
 * 두 줄로 뜬다. */
export function kijuIndex(words = []) {
  const src = kijuByWord();
  const out = new Map();
  const used = new Set();
  for (const w of words) {
    const hit = src.get(w.kanji);
    if (!hit || used.has(w.kanji)) continue;
    used.add(w.kanji);
    out.set(w.id, hit);
  }
  return out;
}

/* 기출 순서대로 늘어놓은 카드.
 *
 * 많이 나온 것 → 최근에 나온 것. 같은 값이면 단어장 차례를 그대로 둔다 —
 * 여기서 섞으면 어제 본 자리가 오늘 달라진다. */
export function kijuCards(words = []) {
  const idx = kijuIndex(words);
  const rank = new Map([...KIJU_LIST.entries()].map(([i, e]) => [e.w, i]));
  return words
    .filter((w) => idx.has(w.id))
    .map((w) => ({ ...w, kiju: idx.get(w.id) }))
    .sort((a, b) => (rank.get(a.kanji) ?? 1e9) - (rank.get(b.kanji) ?? 1e9));
}

/* 목록에 있는데 단어장에 없는 표기. 자료가 어긋나면 검사가 여기서 잡는다. */
export function kijuMissing(words = []) {
  const have = new Set(words.map((w) => w.kanji));
  return KIJU_LIST.filter((e) => !have.has(e.w)).map((e) => e.w);
}

/* 기출 진도 — 몇 개를 한 번이라도 봤나, 몇 개를 외웠나.
 *
 * 「외웠다」의 기준은 회독 쪽과 같은 값을 쓴다(isDoneEnough). 여기서 따로
 * 정하면 같은 카드가 화면마다 다른 상태로 보인다. */
export function kijuStat(cards, stateOf, isDoneEnough) {
  let seen = 0; let done = 0; let weak = 0;
  for (const c of cards) {
    const st = stateOf(c.id);
    if (!st?.lastSeen) continue;
    seen += 1;
    if (isDoneEnough(st)) done += 1;
    else if ((st.wrongCount || 0) + (st.vagueCount || 0) >= 3) weak += 1;
  }
  return { total: cards.length, seen, done, weak, left: cards.length - seen };
}

/* 연도별 목록 — 최근 해부터. 기출 화면이 「2025년에 나온 열여섯 개」를 그린다. */
export function kijuByYear() {
  const years = new Map();
  for (const e of KIJU_LIST) {
    for (const y of e.y) {
      if (!years.has(y)) years.set(y, []);
      years.get(y).push(e);
    }
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }));
}
