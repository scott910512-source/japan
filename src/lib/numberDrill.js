/* 숫자 귀 훈련 — 금액·시각을 무작위로 만들어 소리로 듣고 고른다.
 *
 * ★ 왜 따로 있나 ★
 *
 * 여행에서 제일 놓치기 쉬운 것은 문장이 아니라 숫자다. 고정된 문장 몇십 개로는
 * 「얼마」「몇 시」를 귀가 외워 버리지 숫자를 듣게 되지 않는다. 그래서 값을
 * 그때그때 만들어 일본어 읽기로 들려주고, 비슷하게 들리는 값 두 개와 섞어서
 * 고르게 한다. 끝이 없고, 같은 문제가 두 번 안 나온다.
 *
 * ★ 읽기를 직접 만든다 — 틀리면 틀린 소리를 가르친다 ★
 *
 * 소리는 늘 읽기(가나)로 낸다. 300은 さんびゃく, 600은 ろっぴゃく, 8000은
 * はっせん, 15분은 じゅうごふん, 14분은 じゅうよんぷん — 음이 붙고 변하는 자리가
 * 전부 규칙이다. test/logic/numdrill.mjs가 알려진 값 표로 하나하나 맞춘다.
 *
 * 문제의 모양은 레슨 문제와 같다({ type:'hear', item, options, answerId }) —
 * 그래서 TravelLesson이 그대로 푼다. 보기는 읽기가 아니라 숫자(뜻 칸)로 나온다. */

/* ── 읽기(가나) ── */
const ONES = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const TENS = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう', 'ろくじゅう', 'ななじゅう', 'はちじゅう', 'きゅうじゅう'];
const HUNDREDS = ['', 'ひゃく', 'にひゃく', 'さんびゃく', 'よんひゃく', 'ごひゃく', 'ろっぴゃく', 'ななひゃく', 'はっぴゃく', 'きゅうひゃく'];
const THOUSANDS = ['', 'せん', 'にせん', 'さんぜん', 'よんせん', 'ごせん', 'ろくせん', 'ななせん', 'はっせん', 'きゅうせん'];

function kanaBelow10k(n) {
  const th = Math.floor(n / 1000) % 10;
  const hu = Math.floor(n / 100) % 10;
  const te = Math.floor(n / 10) % 10;
  const on = n % 10;
  return THOUSANDS[th] + HUNDREDS[hu] + TENS[te] + ONES[on];
}

/* 1 ~ 99,999,999 */
export function numberKana(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99999999) return '';
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  return (man ? (man === 1 ? 'いち' : kanaBelow10k(man)) + 'まん' : '') + kanaBelow10k(rest);
}

/* ── 한자 숫자 ── */
const KD = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function kanjiBelow10k(n) {
  const th = Math.floor(n / 1000) % 10;
  const hu = Math.floor(n / 100) % 10;
  const te = Math.floor(n / 10) % 10;
  const on = n % 10;
  /* 千·百·十은 앞의 一을 안 쓴다(千二百円). 万은 쓴다(一万) */
  const one = (d, unit) => (d === 0 ? '' : (d === 1 ? '' : KD[d]) + unit);
  return one(th, '千') + one(hu, '百') + one(te, '十') + KD[on];
}

export function numberKanji(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99999999) return '';
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  return (man ? (man === 1 ? '一' : kanjiBelow10k(man)) + '万' : '') + kanjiBelow10k(rest);
}

/* ── 금액 ── */
const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function yenSpeech(n, tail = 'です') {
  return { jp: `${numberKanji(n)}円${tail}。`, kana: `${numberKana(n)}えん${tail}。` };
}

/* ── 시각 ── */
/* 시: 4는 よ, 7은 しち, 9는 く — 정해진 읽기다 */
const HOUR_ONES = ['', 'いち', 'に', 'さん', 'よ', 'ご', 'ろく', 'しち', 'はち', 'く'];
const MIN_UNITS = ['', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん'];

export function hourKana(h) {
  if (!Number.isInteger(h) || h < 1 || h > 23) return '';
  const tens = h >= 20 ? 'にじゅう' : (h >= 10 ? 'じゅう' : '');
  return `${tens}${HOUR_ONES[h % 10]}じ`;
}

/* 분: 10·20·30… 은 じゅっぷん, 그 밖은 십의 자리 + 일의 자리(いっぷん·にふん·…) */
export function minuteKana(m) {
  if (!Number.isInteger(m) || m < 1 || m > 59) return '';
  const t = Math.floor(m / 10);
  const u = m % 10;
  if (u === 0) return `${TENS[t].replace(/じゅう$/, 'じゅっ')}ぷん`;
  return TENS[t] + MIN_UNITS[u];
}

export function hourKanji(h) {
  return `${numberKanji(h)}時`;
}
export function minuteKanji(m) {
  return `${numberKanji(m)}分`;
}

/* 한 시각 → { jp, kana, ko }. m이 0이면 시만, 30이면 「半」 */
export function timeSpeech(h24, m, { ampm = null, tail = true } = {}) {
  const h = ampm ? (h24 % 12 === 0 ? 12 : h24 % 12) : h24;
  const pre = ampm ? { jp: ampm === 'am' ? '午前' : '午後', kana: ampm === 'am' ? 'ごぜん' : 'ごご', ko: ampm === 'am' ? '오전' : '오후' } : { jp: '', kana: '', ko: '' };
  const mJp = m === 0 ? '' : (m === 30 ? '半' : minuteKanji(m));
  const mKa = m === 0 ? '' : (m === 30 ? 'はん' : minuteKana(m));
  const mKo = m === 0 ? '' : ` ${m}분`;
  return {
    jp: `${pre.jp}${hourKanji(h)}${mJp}${tail ? 'です。' : ''}`,
    kana: `${pre.kana}${hourKana(h)}${mKa}${tail ? 'です。' : ''}`,
    ko: `${pre.ko ? `${pre.ko} ` : ''}${h}시${mKo}${tail ? '입니다.' : ''}`,
  };
}

/* ── 무작위 값 ── */
const randInt = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

function shuffle(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 일본 가격다운 값 — 두 자리부터 다섯 자리까지, 끝이 0·50·80·98인 값(380円 · 1,980円 ·
   2,980円)이 많고 그 밖의 값(1,240円 · 760円)도 섞인다. 값의 가짓수가 많아야 같은 소리를
   외우지 않고 숫자를 듣는다. */
export function randomYen(rnd = Math.random) {
  const tier = rnd();
  if (tier < 0.25) {                                                                       // 150 ~ 998
    return rnd() < 0.7 ? randInt(rnd, 10, 99) * 10 : randInt(rnd, 1, 9) * 100 + pick(rnd, [50, 80, 98]);
  }
  if (tier < 0.8) {                                                                        // 1,000 ~ 9,998
    return rnd() < 0.6 ? randInt(rnd, 100, 999) * 10 : randInt(rnd, 10, 99) * 100 + pick(rnd, [0, 50, 80, 98]);
  }
  return randInt(rnd, 100, 499) * 100 + pick(rnd, [0, 0, 0, 80]);                          // 10,000 ~ 49,980
}

/* 비슷하게 들리는 값 — 자리를 바꾸거나, 한 자리를 비슷한 소리로, 자릿수를 하나 늘리고 줄인다.
   「얼마」를 듣는 데서 실제로 틀리는 방식들이다. */
const SOUND_ALIKE = { 3: ['8'], 8: ['3'], 1: ['7'], 7: ['1'], 4: ['9'], 9: ['4'], 2: ['5'], 5: ['2'], 6: ['0'], 0: ['6'] };

export function yenDistractors(n, rnd = Math.random) {
  const s = String(n);
  const cands = new Set();
  const add = (v) => { if (Number.isInteger(v) && v >= 10 && v <= 99999 && v !== n) cands.add(v); };

  // 1) 이웃한 두 자리를 맞바꾼다 (1,280 ↔ 1,820)
  for (let i = 0; i < s.length - 1; i += 1) {
    if (s[i] !== s[i + 1]) {
      const t = s.split('');
      [t[i], t[i + 1]] = [t[i + 1], t[i]];
      if (t[0] !== '0') add(Number(t.join('')));
    }
  }
  // 2) 한 자리를 비슷한 소리로 (さん ↔ はち, いち ↔ しち)
  for (let i = 0; i < s.length; i += 1) {
    for (const alt of SOUND_ALIKE[s[i]] || []) {
      const t = s.split('');
      t[i] = alt;
      if (t[0] !== '0') add(Number(t.join('')));
    }
  }
  // 3) 자릿수를 하나 늘리거나 줄인다 (1,200 ↔ 12,000 ↔ 120)
  add(n * 10);
  if (n % 10 === 0) add(n / 10);
  // 4) 바로 이웃한 값 (千二百 ↔ 千三百)
  if (n >= 1000 && n % 100 === 0) { add(n + 100); add(n - 100); }
  if (n < 1000 && n % 10 === 0) { add(n + 100); add(n - 100); add(n + 10); }

  const pool = [...cands];
  const chosen = shuffle(pool, rnd).slice(0, 2);
  // 후보가 모자라면 가까운 값으로 채운다 — 무조건 둘이 나오게
  let step = 10;
  while (chosen.length < 2) {
    const v = n + step * (chosen.length + 1) * (rnd() < 0.5 ? 1 : -1);
    if (v >= 10 && v <= 99999 && v !== n && !chosen.includes(v)) chosen.push(v);
    step += 10;
  }
  return chosen;
}

/* 무작위 시각. 12시간제(오전/오후)와 24시간제를 섞는다 — 시각표·라스트 오더는 24시간제다 */
export function randomTime(rnd = Math.random) {
  const style = rnd() < 0.6 ? '12' : '24';
  const m = pick(rnd, [0, 0, 5, 10, 15, 20, 25, 30, 30, 35, 40, 45, 50, 55, randInt(rnd, 1, 59), randInt(rnd, 1, 59)]);
  if (style === '12') {
    const h = randInt(rnd, 1, 12);
    return { h24: h, m, ampm: rnd() < 0.5 ? 'am' : 'pm', style };
  }
  return { h24: randInt(rnd, 6, 23), m, ampm: null, style };
}

export function timeDistractors(t, rnd = Math.random) {
  const cands = [];
  const add = (h24, m) => {
    const key = `${h24}:${m}`;
    if (h24 < 1 || h24 > 23 || m < 0 || m > 59) return;
    if (t.ampm && h24 > 12) return;
    if (key === `${t.h24}:${t.m}`) return;
    if (!cands.some((c) => `${c.h24}:${c.m}` === key)) cands.push({ ...t, h24, m });
  };
  // 시를 하나 어긋나게 / 소리가 비슷한 시 (しち ↔ いち, く ↔ よ)
  add(t.h24 + 1, t.m); add(t.h24 - 1, t.m);
  const alike = { 1: 7, 7: 1, 4: 9, 9: 4, 3: 8, 8: 3, 2: 5, 5: 2 };
  if (alike[t.h24]) add(alike[t.h24], t.m);
  // 분을 어긋나게 / 소리가 비슷한 분 (십 단위가 다르고 일의 자리가 같은 것: 15 ↔ 45 ↔ 5)
  if (t.m !== 0) {
    add(t.h24, (t.m + 10) % 60); add(t.h24, (t.m + 50) % 60);
    add(t.h24, (t.m + 5) % 60); add(t.h24, (t.m + 55) % 60);
    add(t.h24, t.m % 10 === 0 ? t.m + 5 : t.m - (t.m % 10));
    // 십의 자리와 일의 자리를 맞바꾼다 (15분 ↔ 51분)
    const sw = (t.m % 10) * 10 + Math.floor(t.m / 10);
    if (sw < 60) add(t.h24, sw);
  } else {
    add(t.h24, 30); add(t.h24, 10); add(t.h24, 15);
  }
  return shuffle(cands, rnd).slice(0, 2);
}

/* ── 문제 ── */
function yenItem(n, tail) {
  const sp = yenSpeech(n, tail);
  return {
    id: `nd:yen:${n}`, who: 'staff', jp: sp.jp, kana: sp.kana,
    ko: `${comma(n)}엔입니다.`,
    lessonId: 'drill', unitId: 'num',
  };
}

function timeItem(t) {
  const sp = timeSpeech(t.h24, t.m, { ampm: t.ampm });
  return {
    id: `nd:time:${t.ampm || '24'}:${t.h24}:${t.m}`, who: 'staff', jp: sp.jp, kana: sp.kana, ko: sp.ko,
    lessonId: 'drill', unitId: 'num',
  };
}

export const DRILL_KINDS = [
  { id: 'yen', label: '금액', sub: '얼마예요?' },
  { id: 'time', label: '시각', sub: '몇 시예요?' },
  { id: 'mix', label: '섞어서', sub: '금액 · 시각' },
];

export const DRILL_ROUND = 10;

/* 최근에 낸 값 — 연달아 풀어도 같은 값이 거의 안 돌아오게 한다(소리를 외우면 숫자를 안 듣는다).
   화면을 닫으면 사라지는 기억이면 충분하다. */
const RECENT_MAX = 400;
let recent = [];
export function forgetDrill() { recent = []; }

/* 한 판 — kind: yen | time | mix. 같은 값은 한 판에 두 번, 최근 판에도 되도록 안 나온다 */
export function buildDrill(kind = 'mix', rnd = Math.random, count = DRILL_ROUND) {
  const out = [];
  const seen = new Set(recent);
  let guard = 0;
  while (out.length < count && guard < count * 50) {
    guard += 1;
    const useYen = kind === 'yen' || (kind === 'mix' && rnd() < 0.5);
    let item; let opts;
    if (useYen) {
      const n = randomYen(rnd);
      const tail = rnd() < 0.3 ? 'になります' : 'です';
      item = yenItem(n, tail);
      opts = yenDistractors(n, rnd).map((v) => yenItem(v, tail));
    } else {
      const t = randomTime(rnd);
      item = timeItem(t);
      opts = timeDistractors(t, rnd).map(timeItem);
    }
    if (seen.has(item.id) || opts.length < 2) continue;
    seen.add(item.id);
    out.push({ type: 'hear', item, options: shuffle([item, ...opts], rnd), answerId: item.id });
  }
  /* 기억에서 막혀 모자라면(값이 바닥난 경우) 기억을 비우고 다시 — 문제가 모자란 판은 없다 */
  if (out.length < count && recent.length) {
    recent = [];
    return buildDrill(kind, rnd, count);
  }
  recent = [...recent, ...out.map((e) => e.item.id)].slice(-RECENT_MAX);
  return out;
}
