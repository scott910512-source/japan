/* 일본어 주관식 채점.
 *
 * ★ 한 글자가 낱말을 가른다 ★
 *
 * 예전 정규화는 문장부호를 지우면서 장음 기호 ー까지 같이 지웠다. 그래서
 * ビール(맥주)의 답으로 ビル(빌딩)을 쳐도 정답이 됐다. 「공백은 봐준다」와
 * 「장음은 봐준다」가 같은 목록에 들어 있었던 것이다.
 *
 * 여기서 지키는 것은 둘이다.
 *   지워도 되는 것 — 공백, 괄호 주석, 문장부호
 *   절대 못 지우는 것 — 장음 · 촉음 · 작은 가나 · 탁음 · 반탁음 */
import {
  checkTyping, judgeTyping, otherWordNote, acceptedJp, sensesDiffer, normalizeAnswer,
} from '../../src/lib/quiz.js';
import {
  normalizeJp, phoneticJp, soundDiff, expandLongVowels, widenKana,
} from '../../src/lib/jptext.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const W = (kanji, kana, mean, alt) => ({ id: 'x', kanji, kana, mean, alt });
const jp = (w, input) => checkTyping(w, 'ko-jp', input);
const ko = (w, input) => checkTyping(w, 'jp-ko', input);

console.log('\n[ ★ 필수 회귀 1 — ビール에 ビル은 정답이 아니다 ★ ]');
const beer = W('ビール', 'ビール', '맥주');
ok('ビール은 정답', jp(beer, 'ビール') === 'correct');
ok('★ ビル은 오답 ★', jp(beer, 'ビル') === 'wrong', jp(beer, 'ビル'));
ok('왜 틀렸는지 알려 준다', judgeTyping(beer, 'ko-jp', 'ビル').why?.includes('장음'),
  judgeTyping(beer, 'ko-jp', 'ビル').why);
/* 「거의 맞았어요」로도 빠져나가면 안 된다 — 사용자가 인정 버튼을 누르면
   빌딩이 맥주로 통과한다 */
ok('close로도 안 빠진다', judgeTyping(beer, 'ko-jp', 'ビル').verdict !== 'close');

console.log('\n[ 소리가 같은 표기는 인정한다 ]');
ok('히라가나로 써도 정답', jp(beer, 'びーる') === 'correct');
ok('장음을 모음으로 늘여도 정답', jp(beer, 'びいる') === 'correct');
ok('반각 가타카나도 정답', jp(beer, 'ﾋﾞｰﾙ') === 'correct');
ok('띄어쓰기는 봐준다', jp(W('食べる', 'たべる', '먹다'), 'たべ る') === 'correct');
ok('문장부호도 봐준다', jp(W('はい', 'はい', '네'), 'はい。') === 'correct');
/* 봐주는 것과 지우는 것은 다르다 — 그래도 びる은 여전히 다른 말이다 */
ok('그래도 びる과는 다르다', phoneticJp('ビール') !== phoneticJp('ビル'),
  `${phoneticJp('ビール')} / ${phoneticJp('ビル')}`);

console.log('\n[ ★ 필수 — 한 글자가 낱말을 가르는 자리 ★ ]');
const cases = [
  ['おばあさん', 'おばさん', '할머니 / 아주머니', '길이'],
  ['きって', 'きて', '우표 / 와서', '촉음'],
  ['かがみ', 'かかみ', '거울 / 없는 말', '탁음'],
  ['びょういん', 'びよういん', '병원 / 미용실', '작은 가나'],
];
for (const [right, wrong, what] of cases) {
  const w = W(right, right, what);
  ok(`${right} ≠ ${wrong}`, jp(w, wrong) === 'wrong', `${what} → ${jp(w, wrong)}`);
  ok(`  왜 다른지 적어 준다`, Boolean(judgeTyping(w, 'ko-jp', wrong).why),
    judgeTyping(w, 'ko-jp', wrong).why);
}

console.log('\n[ 등록된 표기는 인정한다 ]');
const toru = W('取る', 'とる', '잡다', ['採る', '獲る']);
ok('한자 표기', jp(toru, '取る') === 'correct');
ok('가나 표기', jp(toru, 'とる') === 'correct');
ok('자료에 적어 둔 대체 표기', jp(toru, '採る') === 'correct');
/* 적어 두지 않은 것은 안 받는다 — 「비슷하면 맞다」로 열면 규칙이 아니라 인심이다 */
ok('안 적어 둔 표기는 안 받는다', jp(toru, '撮る') === 'wrong', jp(toru, '撮る'));
ok('인정 목록에 셋이 다 있다', acceptedJp(toru).length === 4, acceptedJp(toru).join(','));

console.log('\n[ 뜻 쪽 — 반대말과 수를 자동으로 인정하지 않는다 ]');
ok('여러 뜻 중 하나만 맞아도 정답', ko(W('たたかう', 'たたかう', '다투다;경쟁하다'), '경쟁하다') === 'correct');
ok('오타는 봐준다', ko(W('がっこう', 'がっこう', '학교입니다'), '학교임니다') === 'close',
  ko(W('がっこう', 'がっこう', '학교입니다'), '학교임니다'));
ok('★ 뜻이 반대면 오답 ★', sensesDiffer('있습니다', '없습니다'));
ok('★ 수가 다르면 오답 ★', sensesDiffer('하나 주세요', '둘 주세요'));
ok('숫자도 본다', sensesDiffer('3번 출구', '4번 출구'));
ok('같은 뜻이면 안 걸린다', !sensesDiffer('학교입니다', '학교임니다'));

console.log('\n[ 정규화 자체 ]');
ok('ー를 지우지 않는다', normalizeJp('ビール').includes('ー'), normalizeJp('ビール'));
ok('っ를 지우지 않는다', normalizeJp('きって').includes('っ'), normalizeJp('きって'));
ok('가타카나는 히라가나로', normalizeJp('カタカナ') === 'かたかな');
ok('전각 영숫자는 반각으로', normalizeAnswer('ＡＢＣ') === 'abc');
ok('반각 가나는 전각으로', widenKana('ﾋﾞｰﾙ') === 'ビール', widenKana('ﾋﾞｰﾙ'));
ok('장음은 앞 모음으로 편다', expandLongVowels('びーる') === 'びいる', expandLongVowels('びーる'));
ok('모르는 자리의 ー는 그대로 둔다', expandLongVowels('ーあ') === 'ーあ');
ok('같은 말이면 차이가 없다', soundDiff('きって', 'キッテ') === null);

/* ★ 정중한 접두사 お · ご ★ 물을 お水라고 써도 정답이다. おとな의 お를 떼는 것은 받지 않는다 */
const water = { kanji: '水', kana: 'みず', mean: '물' };
const adult = { kanji: '大人', kana: 'おとな', mean: '어른' };
ok('お水는 「물」의 정답이다', checkTyping(water, 'ko-jp', 'お水') === 'correct');
ok('おみず도 정답이다', checkTyping(water, 'ko-jp', 'おみず') === 'correct');
ok('접두사 없이 水 · みず도 그대로 정답', checkTyping(water, 'ko-jp', '水') === 'correct' && checkTyping(water, 'ko-jp', 'みず') === 'correct');
ok('おとな의 お를 뗀 とな는 오답', checkTyping(adult, 'ko-jp', 'とな') !== 'correct');
ok('おとな · 大人는 그대로 정답', checkTyping(adult, 'ko-jp', 'おとな') === 'correct' && checkTyping(adult, 'ko-jp', '大人') === 'correct');

/* ★ 다른 낱말을 쳤으면 그 낱말의 뜻을 알려 준다 ★ */
const saku = { id: 'a', kanji: '咲く', kana: 'さく', mean: '피다' };
const fuku = { id: 'b', kanji: '吹く', kana: 'ふく', mean: '불다;(바람이) 불다' };
const note = otherWordNote([saku, fuku], '吹く', saku);
ok('피다에 吹く를 쓰면 「불다」라고 알려 준다', note?.includes('「吹く」(ふく)는 「불다」') && note.includes('「咲く」(さく)'), note);
ok('읽기(가나)로 쳐도 찾는다', otherWordNote([saku, fuku], 'ふく', saku)?.includes('불다'));
ok('사전에 없는 말이면 알려 줄 게 없다', otherWordNote([saku, fuku], 'ほげほげ', saku) === null);
ok('정답 낱말 자신은 대상이 아니다', otherWordNote([saku, fuku], '咲く', saku) === null);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
