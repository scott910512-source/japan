/* 숫자 귀 훈련 — 읽기가 맞는가가 전부다.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 이 훈련은 값을 그때그때 만들어 일본어 읽기로 들려준다. 읽기 생성이 한 자리라도
 * 틀리면 앱이 틀린 소리를 가르친다 — 300을 さんひゃく로, 8000을 はちせん으로.
 * 그래서 알려진 값 표(내가 외우고 있는 값)를 하나하나 맞추고, 무작위로 만든
 * 수천 문제가 모양·보기 규칙을 지키는지 센다. */
import {
  numberKana, numberKanji, minuteKana, hourKana, timeSpeech, yenSpeech,
  randomYen, randomTime, yenDistractors, timeDistractors, buildDrill, forgetDrill, DRILL_KINDS, DRILL_ROUND,
  monthKana, dayKana, dateSpeech, countSpeech, randomDate, dateDistractors, randomCount, countDistractors, COUNTERS,
} from '../../src/lib/numberDrill.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const table = (name, fn, rows) => {
  const bad = rows.filter(([input, want]) => fn(...[].concat(input)) !== want)
    .map(([input, want]) => `${[].concat(input).join(':')} → ${fn(...[].concat(input))} (기대 ${want})`);
  ok(`${name} — ${rows.length}개`, bad.length === 0, bad.slice(0, 4).join(' | ') || '전부 맞다');
};

console.log('\n[ 금액 읽기 — 음이 붙고 변하는 자리 ]');
table('numberKana', numberKana, [
  [1, 'いち'], [4, 'よん'], [7, 'なな'], [9, 'きゅう'], [10, 'じゅう'], [17, 'じゅうなな'], [20, 'にじゅう'],
  [40, 'よんじゅう'], [74, 'ななじゅうよん'], [100, 'ひゃく'], [300, 'さんびゃく'], [600, 'ろっぴゃく'],
  [800, 'はっぴゃく'], [980, 'きゅうひゃくはちじゅう'], [1000, 'せん'], [1200, 'せんにひゃく'],
  [3000, 'さんぜん'], [4500, 'よんせんごひゃく'], [8000, 'はっせん'], [8080, 'はっせんはちじゅう'],
  [8680, 'はっせんろっぴゃくはちじゅう'], [10000, 'いちまん'], [13000, 'いちまんさんぜん'],
  [19800, 'いちまんきゅうせんはっぴゃく'], [25800, 'にまんごせんはっぴゃく'], [30000, 'さんまん'],
  [99999, 'きゅうまんきゅうせんきゅうひゃくきゅうじゅうきゅう'], [1980, 'せんきゅうひゃくはちじゅう'],
  [2980, 'にせんきゅうひゃくはちじゅう'], [698, 'ろっぴゃくきゅうじゅうはち'], [3300, 'さんぜんさんびゃく'],
]);
table('numberKanji', numberKanji, [
  [1, '一'], [10, '十'], [11, '十一'], [90, '九十'], [100, '百'], [305, '三百五'], [380, '三百八十'],
  [1000, '千'], [1200, '千二百'], [8680, '八千六百八十'], [10000, '一万'], [13000, '一万三千'],
  [25800, '二万五千八百'], [40000, '四万'], [99999, '九万九千九百九十九'],
]);
table('yenSpeech (일의 자리가 4면 よえん)', (n) => yenSpeech(n).kana, [
  [4, 'よえんです。'], [14, 'じゅうよえんです。'], [24, 'にじゅうよえんです。'], [94, 'きゅうじゅうよえんです。'],
  [104, 'ひゃくよえんです。'], [1204, 'せんにひゃくよえんです。'], [6504, 'ろくせんごひゃくよえんです。'],
  [40, 'よんじゅうえんです。'], [400, 'よんひゃくえんです。'], [4000, 'よんせんえんです。'], [40000, 'よんまんえんです。'],
  [74, 'ななじゅうよえんです。'], [1240, 'せんにひゃくよんじゅうえんです。'],
]);
ok('범위 밖은 빈 문자열', numberKana(0) === '' && numberKana(-5) === '' && numberKana(1.5) === '' && numberKanji(0) === '');
{
  const sp = yenSpeech(1200);
  ok('금액 문장 — 〜円です', sp.jp === '千二百円です。' && sp.kana === 'せんにひゃくえんです。', `${sp.jp} / ${sp.kana}`);
  const sp2 = yenSpeech(380, 'になります');
  ok('금액 문장 — 〜円になります', sp2.jp === '三百八十円になります。' && sp2.kana === 'さんびゃくはちじゅうえんになります。');
}

console.log('\n[ 시각 읽기 — 시는 정해져 있고 분은 ふん/ぷん이 갈린다 ]');
table('hourKana', hourKana, [
  [1, 'いちじ'], [2, 'にじ'], [3, 'さんじ'], [4, 'よじ'], [5, 'ごじ'], [6, 'ろくじ'], [7, 'しちじ'], [8, 'はちじ'],
  [9, 'くじ'], [10, 'じゅうじ'], [11, 'じゅういちじ'], [12, 'じゅうにじ'], [13, 'じゅうさんじ'], [14, 'じゅうよじ'],
  [17, 'じゅうしちじ'], [19, 'じゅうくじ'], [20, 'にじゅうじ'], [21, 'にじゅういちじ'], [23, 'にじゅうさんじ'],
]);
table('minuteKana', minuteKana, [
  [1, 'いっぷん'], [2, 'にふん'], [3, 'さんぷん'], [4, 'よんぷん'], [5, 'ごふん'], [6, 'ろっぷん'], [7, 'ななふん'],
  [8, 'はっぷん'], [9, 'きゅうふん'], [10, 'じゅっぷん'], [11, 'じゅういっぷん'], [12, 'じゅうにふん'],
  [13, 'じゅうさんぷん'], [14, 'じゅうよんぷん'], [15, 'じゅうごふん'], [16, 'じゅうろっぷん'], [18, 'じゅうはっぷん'],
  [19, 'じゅうきゅうふん'], [20, 'にじゅっぷん'], [21, 'にじゅういっぷん'], [24, 'にじゅうよんぷん'],
  [30, 'さんじゅっぷん'], [40, 'よんじゅっぷん'], [45, 'よんじゅうごふん'], [50, 'ごじゅっぷん'], [59, 'ごじゅうきゅうふん'],
]);
{
  const t = (h, m, ampm) => timeSpeech(h, m, { ampm }).kana;
  table('timeSpeech (읽기)', (h, m, a) => t(h, m, a), [
    [[3, 15, 'pm'], 'ごごさんじじゅうごふんです。'],
    [[10, 30, 'am'], 'ごぜんじゅうじはんです。'],
    [[4, 40, 'pm'], 'ごごよじよんじゅっぷんです。'],
    [[12, 0, 'pm'], 'ごごじゅうにじです。'],
    [[7, 1, 'am'], 'ごぜんしちじいっぷんです。'],
    [[17, 7, null], 'じゅうしちじななふんです。'],
    [[21, 45, null], 'にじゅういちじよんじゅうごふんです。'],
    [[19, 59, null], 'じゅうくじごじゅうきゅうふんです。'],
    [[13, 25, null], 'じゅうさんじにじゅうごふんです。'],
  ]);
  const a = timeSpeech(15, 15, { ampm: 'pm' });
  ok('12시간제 문장 — 한자·뜻', a.jp === '午後三時十五分です。' && a.ko === '오후 3시 15분입니다.', `${a.jp} / ${a.ko}`);
  const b = timeSpeech(9, 30, { ampm: 'am' });
  ok('30분은 「半」', b.jp === '午前九時半です。' && b.kana.includes('はん') && b.ko === '오전 9시 30분입니다.', `${b.jp} / ${b.ko}`);
  const c = timeSpeech(21, 0, {});
  ok('24시간제 정각', c.jp === '二十一時です。' && c.ko === '21시입니다.', `${c.jp} / ${c.ko}`);
}

console.log('\n[ 날짜 읽기 — 일은 따로 외워야 한다 ]');
table('monthKana', monthKana, [
  [1, 'いちがつ'], [2, 'にがつ'], [3, 'さんがつ'], [4, 'しがつ'], [5, 'ごがつ'], [6, 'ろくがつ'], [7, 'しちがつ'],
  [8, 'はちがつ'], [9, 'くがつ'], [10, 'じゅうがつ'], [11, 'じゅういちがつ'], [12, 'じゅうにがつ'],
]);
table('dayKana', dayKana, [
  [1, 'ついたち'], [2, 'ふつか'], [3, 'みっか'], [4, 'よっか'], [5, 'いつか'], [6, 'むいか'], [7, 'なのか'], [8, 'ようか'],
  [9, 'ここのか'], [10, 'とおか'], [11, 'じゅういちにち'], [12, 'じゅうににち'], [13, 'じゅうさんにち'], [14, 'じゅうよっか'],
  [15, 'じゅうごにち'], [16, 'じゅうろくにち'], [17, 'じゅうしちにち'], [18, 'じゅうはちにち'], [19, 'じゅうくにち'],
  [20, 'はつか'], [21, 'にじゅういちにち'], [22, 'にじゅうににち'], [23, 'にじゅうさんにち'], [24, 'にじゅうよっか'],
  [25, 'にじゅうごにち'], [26, 'にじゅうろくにち'], [27, 'にじゅうしちにち'], [28, 'にじゅうはちにち'], [29, 'にじゅうくにち'],
  [30, 'さんじゅうにち'], [31, 'さんじゅういちにち'],
]);
ok('범위 밖의 월·일은 빈 문자열', monthKana(0) === '' && monthKana(13) === '' && dayKana(0) === '' && dayKana(32) === '');
{
  const a = dateSpeech(10, 3);
  ok('날짜 문장 — 十月三日', a.jp === '十月三日です。' && a.kana === 'じゅうがつみっかです。' && a.ko === '10월 3일입니다.', `${a.jp} / ${a.kana}`);
  const b = dateSpeech(4, 20);
  ok('날짜 문장 — 四月二十日(はつか)', b.jp === '四月二十日です。' && b.kana === 'しがつはつかです。', `${b.jp} / ${b.kana}`);
  const c = dateSpeech(12, 31);
  ok('날짜 문장 — 十二月三十一日', c.jp === '十二月三十一日です。' && c.kana === 'じゅうにがつさんじゅういちにちです。');
}

console.log('\n[ 사람 · 개수 · 층 ]');
table('countSpeech (읽기)', (c, n) => countSpeech(c, n).kana, [
  [['people', 1], 'ひとりです。'], [['people', 2], 'ふたりです。'], [['people', 3], 'さんにんです。'], [['people', 4], 'よにんです。'],
  [['people', 7], 'ななにんです。'], [['people', 10], 'じゅうにんです。'],
  [['things', 1], 'ひとつです。'], [['things', 3], 'みっつです。'], [['things', 4], 'よっつです。'], [['things', 6], 'むっつです。'],
  [['things', 8], 'やっつです。'], [['things', 9], 'ここのつです。'], [['things', 10], 'とおです。'],
  [['floor', 1], 'いっかいです。'], [['floor', 3], 'さんがいです。'], [['floor', 4], 'よんかいです。'], [['floor', 6], 'ろっかいです。'],
  [['floor', 8], 'はっかいです。'], [['floor', 10], 'じゅっかいです。'],
]);
table('countSpeech (한자·뜻)', (c, n) => { const x = countSpeech(c, n); return `${x.jp}|${x.ko}`; }, [
  [['people', 2], '二人です。|2명입니다.'], [['things', 5], '五つです。|5개입니다.'], [['things', 10], '十です。|10개입니다.'],
  [['floor', 3], '三階です。|3층입니다.'], [['floor', 10], '十階です。|10층입니다.'],
]);
ok('범위 밖·없는 세는 말은 null', countSpeech('people', 0) === null && countSpeech('people', 11) === null && countSpeech('nope', 1) === null && COUNTERS.length === 3);

console.log('\n[ 무작위로 만든 값 ]');
{
  let seed = 3;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let bad = 0; let min = 1e9; let max = 0; const tiers = { 3: 0, 4: 0, 5: 0 };
  for (let i = 0; i < 5000; i++) {
    const n = randomYen(rnd);
    if (!Number.isInteger(n) || n < 100 || n > 49999) bad++;
    min = Math.min(min, n); max = Math.max(max, n);
    tiers[String(n).length] = (tiers[String(n).length] || 0) + 1;
  }
  ok('금액은 100 ~ 49,999 정수', bad === 0, `최소 ${min} · 최대 ${max}`);
  ok('세·네·다섯 자리가 모두 나온다', tiers[3] > 500 && tiers[4] > 1500 && tiers[5] > 500, JSON.stringify(tiers));

  let dBad = 0;
  for (let i = 0; i < 5000; i++) {
    const n = randomYen(rnd);
    const d = yenDistractors(n, rnd);
    if (d.length !== 2 || d[0] === d[1] || d.includes(n) || d.some((v) => v < 10 || v > 99999 || !Number.isInteger(v))) dBad++;
  }
  ok('★ 금액 방해 보기는 늘 둘 · 서로 다르고 · 정답이 아니다 ★', dBad === 0, `이상 ${dBad}`);

  let tBad = 0; let sample = null;
  for (let i = 0; i < 5000; i++) {
    const t = randomTime(rnd);
    if (t.h24 < 1 || t.h24 > 23 || t.m < 0 || t.m > 59 || (t.ampm && t.h24 > 12)) { tBad++; continue; }
    const d = timeDistractors(t, rnd);
    const keys = new Set([`${t.h24}:${t.m}`, ...d.map((x) => `${x.h24}:${x.m}`)]);
    if (d.length !== 2 || keys.size !== 3) { tBad++; sample = sample || JSON.stringify([t, d]); }
  }
  ok('★ 시각 방해 보기는 늘 둘 · 서로 다르고 · 정답이 아니다 ★', tBad === 0, tBad ? sample : '이상 없음');
}

{
  let seed = 21;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let dBad = 0; let cBad = 0; let sample = null;
  for (let i = 0; i < 4000; i++) {
    const t = randomDate(rnd);
    const d = dateDistractors(t, rnd);
    const keys = new Set([`${t.m}-${t.d}`, ...d.map((x) => `${x.m}-${x.d}`)]);
    const maxD = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][t.m];
    if (t.d < 1 || t.d > maxD || d.length !== 2 || keys.size !== 3 || d.some((x) => x.d < 1 || x.d > [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][x.m])) { dBad++; sample = sample || JSON.stringify([t, d]); }
    const c = randomCount(rnd);
    const cd = countDistractors(c, rnd);
    const ck = new Set([`${c.counter}${c.n}`, ...cd.map((x) => `${x.counter}${x.n}`)]);
    if (cd.length !== 2 || ck.size !== 3) cBad++;
  }
  ok('★ 날짜 방해 보기는 늘 둘 · 서로 다르고 · 그 달에 있는 날이다 ★', dBad === 0, dBad ? sample : '이상 없음');
  ok('★ 세는 말 방해 보기는 늘 둘 · 서로 다르다 ★', cBad === 0, `이상 ${cBad}`);
}

console.log('\n[ 한 판 ]');
{
  let seed = 9;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  ok('종류 다섯 — 금액 · 시각 · 날짜 · 인원·층 · 섞어서', DRILL_KINDS.map((k) => k.id).join() === 'yen,time,date,count,mix');
  ok('한 판은 열 문제', DRILL_ROUND === 10 && buildDrill('mix', rnd).length === 10);
  let bad = 0; let hanged = 0; let kanaBad = 0; const ids = [];
  for (const kind of ['yen', 'time', 'date', 'count', 'mix']) for (let i = 0; i < 300; i++) {
    const round = buildDrill(kind, rnd);
    if (round.length !== DRILL_ROUND) { bad++; continue; }
    const keys = new Set(round.map((e) => e.item.id));
    if (keys.size !== round.length) bad++;                                          // 한 판에 같은 값 두 번
    for (const e of round) {
      if (e.type !== 'hear' || e.options.length !== 3 || !e.options.some((o) => o.id === e.answerId)) bad++;
      if (new Set(e.options.map((o) => o.ko)).size !== 3) bad++;                    // 보기 뜻(숫자)이 서로 다르다
      if (e.options.some((o) => o.who !== 'staff')) bad++;
      if (!/^[ぁ-ゖァ-ヺー〇、。]+$/.test(e.item.kana)) kanaBad++;                  // 읽기에 한자·숫자가 없다
      if (/[0-9]/.test(e.item.jp)) hanged++;                                          // 일본어 쪽은 한자 숫자
      if (kind === 'yen' && !e.item.id.startsWith('nd:yen:')) bad++;
      if (kind === 'time' && !e.item.id.startsWith('nd:time:')) bad++;
      if (kind === 'date' && !e.item.id.startsWith('nd:date:')) bad++;
      if (kind === 'count' && !e.item.id.startsWith('nd:count:')) bad++;
      ids.push(e.item.id);
    }
  }
  ok('★ 1,500판의 모든 문제가 규칙을 지킨다 (열 문제 · 보기 셋 · 답 포함 · 뜻 서로 다름) ★', bad === 0, `이상 ${bad}`);
  ok('읽기는 전부 가나뿐', kanaBad === 0, `이상 ${kanaBad}`);
  ok('일본어 쪽에 아라비아 숫자가 없다', hanged === 0, `이상 ${hanged}`);
  {
    /* 연달아 쉰 판(오백 문제)을 풀어도 같은 값이 거의 안 겹친다 — 소리를 외우는 게 아니라 숫자를 듣게 */
    forgetDrill();
    const fifty = [];
    for (let i = 0; i < 50; i++) for (const e of buildDrill('yen', rnd)) fifty.push(e.item.id);
    ok('쉰 판 연달아 — 금액 오백 문제 중 같은 값이 거의 없다', new Set(fifty).size >= 470, `${new Set(fifty).size} / ${fifty.length}`);
    ok('값의 가짓수가 충분하다 (1,500판)', new Set(ids).size > 2000, `${new Set(ids).size} / ${ids.length}`);
  }
  const mix = buildDrill('mix', () => 0.3);
  ok('같은 난수라도 무한 반복에 안 걸린다', Array.isArray(mix));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
