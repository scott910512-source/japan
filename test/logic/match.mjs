/* 짝 맞추기 판 짜기.
 *
 * 게임은 규칙이 하나만 어긋나도 "맞는데 틀렸다"가 나오고, 그러면 아무도
 * 다시 안 한다. 특히 두 가지를 본다.
 *   - 뜻이 같은 카드가 한 판에 둘 들어가지 않는지 (어디에 붙여도 맞는 짝이 생긴다)
 *   - 문장처럼 긴 게 안 들어오는지 (작은 칸에서 글자가 뭉개진다) */
import {
  buildBoard, usable, shortMean, scoreOf, verdictOf, MODE, MODE_LABEL, MODE_HINT, PAIRS,
} from '../../src/lib/match.js';
import { applyVerdict, emptyState, todayKey, VERDICT } from '../../src/lib/review.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const W = (id, kanji, kana, mean, extra = {}) => ({ id, kanji, kana, mean, type: 'noun', ...extra });
const many = (n) => Array.from({ length: n }, (_, i) => W(`w${i}`, `語${i}`, `ご${i}`, `뜻${i}`));

console.log('── 무엇을 쓸 수 있나');
{
  ok('보통 단어는 됨', usable(W('a', '水', 'みず', '물')));
  ok('뜻이 없으면 안 됨', !usable({ id: 'x', kanji: '水', kana: 'みず' }));
  ok('한자가 없으면 안 됨', !usable({ id: 'x', kana: 'みず', mean: '물' }));
  ok('빈 것도 안 죽음', !usable(null) && !usable(undefined));

  /* 문장을 작은 칸에 넣으면 글자가 뭉개지고, 짝 찾기가 아니라 긴 글 비교가 된다 */
  ok('문장은 뺀다', !usable({ id: 's1', kind: 'sentence', kanji: '切符はどこで買えますか。', kana: 'きっぷは', mean: '표는 어디서' }));
  ok('긴 것도 뺀다', !usable(W('x', '一日乗車券はありますか', 'いち', '1일 승차권')));
  ok('여섯 글자까지는 됨', usable(W('x', '六文字ちょうど', 'ろく', '뜻')) === false);
  ok('짧은 건 됨', usable(W('x', '勉強する', 'べんきょうする', '공부하다')));
}

console.log('\n── 뜻 다듬기');
{
  ok('여러 뜻은 첫 것만', shortMean(W('x', '危', 'あぶ', '위험하다;아슬아슬하다')) === '위험하다');
  ok('쉼표도 가름', shortMean(W('x', 'a', 'b', '안, 속')) === '안');
  ok('빈 것도 안 죽음', shortMean({}) === '');
}

console.log('\n── 판 짜기');
{
  const board = buildBoard(many(30), {}, { mode: MODE.TEXT });
  ok('다섯 쌍이 나옴', board.pairs.length === PAIRS, `${board.pairs.length}쌍`);
  ok('왼쪽 오른쪽 수가 같음', board.left.length === board.right.length);
  ok('양쪽이 같은 카드들', new Set(board.left).size === board.pairs.length
    && board.left.slice().sort().join() === board.right.slice().sort().join());
  ok('짝마다 일본어와 뜻이 있음', board.pairs.every((p) => p.jp && p.mean && p.kana));

  /* 양쪽이 같은 차례로 놓이면 위에서부터 눌러도 다 맞는다 */
  let sameOrder = 0;
  for (let i = 0; i < 20; i++) {
    const b = buildBoard(many(30), {}, { mode: MODE.TEXT });
    if (b.left.join() === b.right.join()) sameOrder++;
  }
  ok('양쪽 차례가 다르게 섞임', sameOrder <= 2, `20판 중 ${sameOrder}판만 같음`);

  ok('이미 낸 건 빼고 짤 수 있음',
    buildBoard(many(30), {}, { exclude: ['w0', 'w1', 'w2'] }).pairs.every((p) => !['w0', 'w1', 'w2'].includes(p.id)));
  ok('카드가 모자라면 있는 만큼', buildBoard(many(3), {}, {}).pairs.length === 3);
  ok('한 장뿐이면 판이 안 나옴', buildBoard(many(1), {}, {}) === null);
  ok('아무것도 없어도 안 죽음', buildBoard([], {}, {}) === null);
}

console.log('\n── 같은 뜻이 두 개 들어가면 안 된다');
{
  /* 「물」이 둘이면 어느 쪽에 붙여도 맞는 짝인데 화면은 하나만 정답으로 친다 */
  const dup = [
    W('a', '水', 'みず', '물'),
    W('b', 'お水', 'おみず', '물'),
    W('c', '火', 'ひ', '불'),
    W('d', '木', 'き', '나무'),
    W('e', '金', 'かね', '돈'),
    W('f', '土', 'つち', '흙'),
  ];
  const board = buildBoard(dup, {}, { mode: MODE.TEXT });
  const means = board.pairs.map((p) => p.mean);
  ok('뜻이 안 겹침', new Set(means).size === means.length, means.join(','));

  /* 소리판에서는 읽는 법이 겹치면 안 된다 — 소리가 같으면 구별할 길이 없다 */
  const same = [
    W('a', '橋', 'はし', '다리'),
    W('b', '箸', 'はし', '젓가락'),
    W('c', '山', 'やま', '산'),
    W('d', '川', 'かわ', '강'),
  ];
  const sb = buildBoard(same, {}, { mode: MODE.SOUND });
  const kanas = sb.pairs.map((p) => p.kana);
  ok('소리판은 읽는 법이 안 겹침', new Set(kanas).size === kanas.length, kanas.join(','));
}

console.log('\n── 약점을 먼저 넣되 다 채우지는 않는다');
{
  const cards = many(40);
  const review = {};
  const weakOf = () => {
    let st = emptyState();
    for (let i = 0; i < 3; i++) st = applyVerdict(st, VERDICT.UNKNOWN, '2026-08-01', 1000);
    return st;
  };
  for (let i = 0; i < 20; i++) review[`w${i}`] = weakOf();   // 앞 20개가 약점

  let weakSeen = 0; let rounds = 0;
  for (let n = 0; n < 12; n++) {
    const b = buildBoard(cards, review, { mode: MODE.TEXT });
    const w = b.pairs.filter((p) => Number(p.id.slice(1)) < 20).length;
    weakSeen += w; rounds++;
    if (w > Math.ceil(PAIRS / 2)) { ok('약점이 판의 절반을 안 넘음', false, `${w}개`); break; }
    if (n === 11) ok('약점이 판의 절반을 안 넘음', true, `평균 ${(weakSeen / rounds).toFixed(1)}개`);
  }
  ok('약점이 실제로 들어감', weakSeen > 0, `${rounds}판에 ${weakSeen}개`);

  // 약점밖에 없으면 그거라도 채운다
  const onlyWeak = many(8);
  const rev2 = {};
  for (let i = 0; i < 8; i++) rev2[`w${i}`] = weakOf();
  ok('약점뿐이어도 판이 나옴', buildBoard(onlyWeak, rev2, {}).pairs.length === PAIRS);
}

console.log('\n── 진짜 자료로');
{
  const board = buildBoard(ALL_WORDS.slice(0, 400), {}, { mode: MODE.TEXT });
  ok('실제 단어로도 판이 나옴', board && board.pairs.length === PAIRS);
  ok('칸에 들어갈 만한 길이', board.pairs.every((p) => p.jp.length <= 6), board.pairs.map((p) => p.jp).join(' '));
  ok('뜻에 구분자가 안 남음', board.pairs.every((p) => !p.mean.includes(';')), board.pairs.map((p) => p.mean).join(' / '));

  /* 쓸 수 있는 단어가 충분한가 — 몇 개 안 되면 매번 같은 것만 나온다 */
  const n = ALL_WORDS.filter((w) => usable(w)).length;
  ok('쓸 수 있는 단어가 넉넉함', n > 800, `${n}개`);
}

console.log('\n── 점수와 한 줄 평');
{
  ok('안 틀리면 더 높음', scoreOf({ pairs: 5, misses: 0, seconds: 20 }) > scoreOf({ pairs: 5, misses: 4, seconds: 20 }));
  ok('빠르면 조금 더', scoreOf({ pairs: 5, misses: 0, seconds: 10 }) > scoreOf({ pairs: 5, misses: 0, seconds: 28 }));
  ok('많이 틀려도 0은 아님', scoreOf({ pairs: 5, misses: 99, seconds: 300 }) > 0, String(scoreOf({ pairs: 5, misses: 99, seconds: 300 })));
  ok('한 번도 안 틀리면 그렇게 말함', verdictOf({ pairs: 5, misses: 0 }).includes('안 틀렸'));
  ok('많이 틀리면 회독으로 넘김', verdictOf({ pairs: 5, misses: 5 }).includes('회독'));
}

console.log('\n── 화면에 쓰는 이름');
ok('두 판에 이름이 있음', MODE_LABEL[MODE.TEXT] && MODE_LABEL[MODE.SOUND]);
ok('무엇을 하는지도', MODE_HINT[MODE.SOUND].includes('소리'));

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
