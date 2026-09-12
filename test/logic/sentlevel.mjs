/* 문장 난이도와 학습 범위.
 *
 * ★ 근거 없는 레벨은 레벨이 아니라 추측이다 ★
 *
 * 자료의 star는 「얼마나 자주 쓰나」다. 중요도지 난이도가 아니다. 그런데
 * cards.js가 star===3이면 N5, 아니면 N4로 바꿔 놓았다. 자주 쓴다는 이유로
 * 어려운 문장이 N5가 되고, 드물다는 이유로 쉬운 문장이 N4가 됐다.
 *
 * 게다가 오늘의 후보에서 단어만 레벨로 걸러졌다. N5만 켠 사람은 단어가
 * 534개로 줄었는데 문장은 600개가 그대로 남아서, 고르지도 않은 범위의
 * 문장이 새 학습에 섞였다.
 *
 * ── 그다음에 알게 된 것 ──
 *
 * 추측을 안 하는 것과 재지 않는 것은 다르다. star를 걷어내고 600문장을 전부
 * 미분류로 두었더니, 설정의 「문장 범위」를 레벨로 좁히면 문장이 통째로
 * 사라졌다. 켜면 전부 없어지는 스위치는 스위치가 아니다.
 *
 * 그래서 잰다. 문장에 실제로 나오는 낱말의 급수 중 제일 높은 것 — 우리
 * 단어장이 2336개 낱말의 급수를 알고 있으니 추측할 게 아니라 세면 된다.
 * 「근거 없는 레벨은 안 붙인다」는 규칙은 그대로다. 근거가 생겼을 뿐이다.
 * 근거를 못 찾은 문장은 여전히 미분류로 남는다. */
import { sentenceToCard, dailyPool, allSentenceCards } from '../../src/lib/cards.js';
import { buildLexicon, gradeSentence } from '../../src/lib/sentlevel.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 중요도와 난이도를 가른다 ]');
{
  const c = sentenceToCard({ id: 's1', jp: 'これください', kana: 'これください', ko: '이거 주세요', star: 3 });
  ok('★ star를 레벨로 바꾸지 않는다 ★', c.level === null, `${c.level}`);
  ok('중요도는 그대로 남긴다', c.importance === 3, `${c.importance}`);
  const c2 = sentenceToCard({ id: 's2', jp: 'あ', kana: 'あ', ko: '아', star: 1, level: 'N4' });
  ok('자료에 레벨이 있으면 그건 쓴다', c2.level === 'N4');
  ok('미분류는 미분류로 둔다', sentenceToCard({ id: 's3', jp: 'い', kana: 'い', ko: '이' }).level === null);
}

console.log('\n[ ★ 필수 회귀 7 — 선택 레벨 밖 신규 문장이 안 섞인다 ★ ]');
{
  const words = [{ id: 'w1' }, { id: 'w2' }];
  const sents = [
    { id: 's-n5', level: 'N5' },
    { id: 's-n4', level: 'N4' },
    { id: 's-none', level: null },
  ];
  const all = dailyPool(words, sents);
  ok('레벨을 안 고르면 전부', all.length === 5, `${all.length}`);

  const n5 = dailyPool(words, sents, { levels: ['N5'] });
  const ids = n5.map((x) => x.id);
  ok('★ 레벨이 붙은 문장은 고른 것만 ★',
    ids.includes('s-n5') && !ids.includes('s-n4'), ids.join(','));
  ok('단어는 그대로', ids.filter((x) => x.startsWith('w')).length === 2);

  /* 미분류는 거를 근거가 없다. 빼면 지금 자료로는 문장이 통째로 사라지니 —
     문제를 기능을 없애서 푸는 셈이다 — 기본은 넣고, 빼고 싶으면 뺀다. */
  ok('미분류는 기본으로 들어온다', ids.includes('s-none'), ids.join(','));
  const strict = dailyPool(words, sents, { levels: ['N5'], includeUnleveled: false })
    .map((x) => x.id);
  ok('빼 달라면 뺀다', !strict.includes('s-none'), strict.join(','));
  ok('그때도 고른 레벨은 남는다', strict.includes('s-n5'));
}

console.log('\n[ 배운 문장은 레벨을 좁혀도 복습에서 안 사라진다 ]');
{
  const words = [{ id: 'w1' }];
  const sents = [{ id: 's-n4', level: 'N4' }, { id: 's-none', level: null }];
  /* 레벨을 좁혔다고 어제 외운 문장이 조용히 사라지면,
     외운 게 새어 나가는 걸 설정 하나로 만드는 셈이다 */
  const seen = new Set(['s-n4', 's-none']);
  const ids = dailyPool(words, sents, { levels: ['N5'], seen }).map((x) => x.id);
  ok('★ 배운 것은 남는다 ★', ids.includes('s-n4') && ids.includes('s-none'), ids.join(','));

  const notSeen = dailyPool(words, sents, { levels: ['N5'], seen: new Set() }).map((x) => x.id);
  ok('안 배운 것은 여전히 안 들어온다', !notSeen.includes('s-n4'), notSeen.join(','));
  /* 엄격 모드에서도 배운 것은 복습된다 — 설정으로 외운 걸 잃으면 안 된다 */
  const strictSeen = dailyPool(words, sents, {
    levels: ['N5'], seen, includeUnleveled: false,
  }).map((x) => x.id);
  ok('엄격 모드에서도 배운 것은 남는다',
    strictSeen.includes('s-n4') && strictSeen.includes('s-none'), strictSeen.join(','));
}

console.log('\n[ ★ 레벨은 문장에 나오는 낱말로 잰다 ★ ]');
{
  const lex = buildLexicon([
    { kanji: '電車', level: 'N5' },
    { kanji: '駅', level: 'N5' },
    { kanji: '指定席', level: 'N3' },
    { kanji: '現金', level: 'N4' },
    { kanji: 'カード', level: 'N5' },
  ]);
  ok('제일 높은 급수가 문장의 레벨',
    gradeSentence({ jp: '電車で指定席をお願いします' }, lex).level === 'N3');
  ok('쉬운 낱말만 있으면 쉬운 문장',
    gradeSentence({ jp: '電車は駅にいます' }, lex).level === 'N5');
  ok('근거를 남긴다', gradeSentence({ jp: '指定席です' }, lex).by === '指定席',
    gradeSentence({ jp: '指定席です' }, lex).by);
  ok('★ 근거가 없으면 레벨도 없다 ★',
    gradeSentence({ jp: 'ここです' }, lex).level === null);
}

console.log('\n[ 낱말 경계를 지킨다 — 오탐은 쉬운 문장을 없앤다 ]');
{
  /* 히라가나에서 찾으면 現金しか(げんきんしか)에서 「きんし」(금지)가 걸린다.
     한자·가타카나 표기로만 찾는 이유다. */
  const lex = buildLexicon([
    { kanji: '禁止', kana: 'きんし', level: 'N3' },
    { kanji: '現金', level: 'N4' },
    { kanji: '宿', level: 'N3' },
    { kanji: '谷', level: 'N3' },
    { kanji: 'パン', level: 'N5' },
    { kanji: '駅', level: 'N5' },
  ]);
  ok('가나 속에서 낱말을 줍지 않는다',
    gradeSentence({ jp: '現金しか使えませんか', kana: 'げんきんしかつかえませんか' }, lex).level === 'N4');
  /* 한 글자 낱말·가타카나는 덩어리 전체가 같을 때만 — 안 그러면 지명이 걸린다 */
  ok('★ 新宿이 宿으로 걸리지 않는다 ★',
    gradeSentence({ jp: '新宿までいくらですか' }, lex).level === null);
  ok('★ 渋谷가 谷로 걸리지 않는다 ★',
    gradeSentence({ jp: '渋谷の駅はどこですか' }, lex).level === 'N5');
  ok('한 글자 낱말은 덩어리가 같으면 센다',
    gradeSentence({ jp: '谷はどこですか' }, lex).level === 'N3');
}

console.log('\n[ 한 글자 조각은 N4까지만 ]');
{
  /* 「次」는 단어장에 次ぐ(N3)로만 있다. 조각을 그대로 믿으면
     「次の駅はどこですか」가 N3이 되어 N5 학습에서 사라진다.
     쉬운 쪽으로 틀리면 조금 일찍 나올 뿐, 어려운 쪽으로 틀리면 없어진다. */
  const lex = buildLexicon([
    { kanji: '次ぐ', level: 'N3' },
    { kanji: '買う', level: 'N5' },
    { kanji: '調べる', level: 'N4' },
    { kanji: '駅', level: 'N5' },
  ]);
  ok('★ N3 조각으로는 레벨을 못 올린다 ★',
    gradeSentence({ jp: '次の駅はどこですか' }, lex).level === 'N5');
  ok('N5 조각은 근거가 된다', gradeSentence({ jp: '買えますか' }, lex).level === 'N5');
  ok('N4 조각까지는 센다', gradeSentence({ jp: '調べていただけますか' }, lex).level === 'N4');
}

console.log('\n[ 문형도 근거다 — 낱말이 쉬워도 초급이 아닌 문장이 있다 ]');
{
  const lex = buildLexicon([
    { kanji: '教える', level: 'N5' },
    { kanji: '必要', level: 'N4' },
    { kanji: '特急', level: 'N4' },
  ]);
  ok('겸양 의뢰형은 N4',
    gradeSentence({ jp: '教えていただけますか' }, lex).level === 'N4');
  /* 문형을 가나에서 찾으면 必要ですか(ひつようですか)가 「ようです」로 걸려
     N3이 된다. 표기에서 찾으면 그 일이 없다. */
  ok('★ 必要ですか가 「ようです」로 걸리지 않는다 ★',
    gradeSentence({ jp: '特急券も必要ですか', kana: 'とっきゅうけんもひつようですか' }, lex).level === 'N4');
}

console.log('\n[ 실제 자료 ]');
{
  const cards = allSentenceCards();
  ok('문장 카드가 만들어진다', cards.length > 100, `${cards.length}개`);
  ok('중요도는 살아 있다', cards.some((c) => c.importance != null));
  ok('회독에 필요한 칸은 다 있다',
    cards.every((c) => c.id && c.kanji && c.kana && c.mean && c.kind === 'sentence'));

  /* ★ 예전엔 「임의 레벨이 하나도 안 붙는다」를 검사했다 ★
     그때는 붙일 근거가 없었으니 맞는 검사였다. 지금은 문장에 나오는 낱말로
     재니 근거가 있다. 대신 붙었다는 것만으로는 안 되고, 근거를 댈 수 있어야
     한다 — 그래서 검사도 「레벨이 있으면 levelBy가 있다」로 바꾼다. */
  const graded = cards.filter((c) => c.level != null);
  ok('★ 레벨이 붙었으면 근거가 있다 ★',
    graded.every((c) => c.levelBy), `${graded.filter((c) => !c.levelBy).length}개 무근거`);
  ok('★ star가 레벨로 새지 않는다 ★',
    cards.every((c) => c.levelBy !== c.importance));
  ok('대부분은 레벨을 잰다', graded.length > cards.length * 0.7,
    `${graded.length}/${cards.length}`);
  /* 다 재려 들면 다시 추측이 된다. 못 잰 것은 못 잰 채로 남아야 한다 */
  ok('★ 못 잰 문장은 미분류로 남는다 ★', graded.length < cards.length,
    `미분류 ${cards.length - graded.length}개`);
  for (const lv of ['N5', 'N4', 'N3']) {
    ok(`${lv} 문장이 실제로 있다`, cards.some((c) => c.level === lv),
      `${cards.filter((c) => c.level === lv).length}개`);
  }
  /* 레벨을 좁히는 게 실제로 뜻이 있어야 한다 — N5만 골랐을 때 N3 문장이 빠진다 */
  const n5only = dailyPool([], cards, { levels: ['N5'] });
  ok('★ N5만 고르면 N3 문장이 새로 안 나온다 ★',
    !n5only.some((x) => cards.find((c) => c.id === x.id)?.level === 'N3'));
  ok('그래도 배정할 문장은 넉넉히 남는다', n5only.length > 200, `${n5only.length}개`);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
