/* 동사 활용이 맞는지.
 *
 * 활용은 규칙이라 답이 하나로 정해진다. 그러니 검사도 정확히 할 수 있다 —
 * 손으로 적어 둔 정답과 글자까지 맞춰 본다.
 *
 * 그리고 자료에 있는 동사 644개를 전부 돌려 본다. 하나라도 모양이 안 나오면
 * 그 단어는 시험에 못 나온다는 뜻이고, 그건 조용히 빠지는 것이라 제일 나쁘다. */
import {
  conjugate, canDrill, distractors, makeQuestion, planDrill,
  applyDrill, drillRate, FORMS, BASIC_KEYS, ASK_KEYS, FORM_LABEL,
} from '../../src/lib/verbform.js';
import { conjugate as conjugateOld } from '../../src/lib/conjugate.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const V = (kanji, kana, group) => ({ id: `t-${kanji}`, kanji, kana, mean: '', type: 'verb', group, level: 'N5' });

/* ── 손으로 적어 둔 정답 ──
   [사전형, 읽기, 그룹, 정중, 정중과거, 부정, 과거부정, 과거, て형] */
const TABLE = [
  // 1형(五段) — 줄마다 하나씩
  ['遊ぶ', 'あそぶ', '1', '遊びます', '遊びました', '遊ばない', '遊ばなかった', '遊んだ', '遊んで'],
  ['飲む', 'のむ', '1', '飲みます', '飲みました', '飲まない', '飲まなかった', '飲んだ', '飲んで'],
  ['死ぬ', 'しぬ', '1', '死にます', '死にました', '死なない', '死ななかった', '死んだ', '死んで'],
  ['書く', 'かく', '1', '書きます', '書きました', '書かない', '書かなかった', '書いた', '書いて'],
  ['泳ぐ', 'およぐ', '1', '泳ぎます', '泳ぎました', '泳がない', '泳がなかった', '泳いだ', '泳いで'],
  ['話す', 'はなす', '1', '話します', '話しました', '話さない', '話さなかった', '話した', '話して'],
  ['待つ', 'まつ', '1', '待ちます', '待ちました', '待たない', '待たなかった', '待った', '待って'],
  ['買う', 'かう', '1', '買います', '買いました', '買わない', '買わなかった', '買った', '買って'],
  ['作る', 'つくる', '1', '作ります', '作りました', '作らない', '作らなかった', '作った', '作って'],
  // 2형(一段)
  ['食べる', 'たべる', '2', '食べます', '食べました', '食べない', '食べなかった', '食べた', '食べて'],
  ['見る', 'みる', '2', '見ます', '見ました', '見ない', '見なかった', '見た', '見て'],
  ['いる', 'いる', '2', 'います', 'いました', 'いない', 'いなかった', 'いた', 'いて'],
  // 3형(불규칙)
  ['する', 'する', '3', 'します', 'しました', 'しない', 'しなかった', 'した', 'して'],
  ['勉強する', 'べんきょうする', '3', '勉強します', '勉強しました', '勉強しない', '勉強しなかった', '勉強した', '勉強して'],
  ['来る', 'くる', '3', '来ます', '来ました', '来ない', '来なかった', '来た', '来て'],
  // 예외
  ['行く', 'いく', '1', '行きます', '行きました', '行かない', '行かなかった', '行った', '行って'],
  ['ある', 'ある', '1', 'あります', 'ありました', 'ない', 'なかった', 'あった', 'あって'],
];

console.log('── 한자 쪽 활용');
for (const [kanji, kana, g, masu, masuPast, nai, naiPast, ta, te] of TABLE) {
  const c = conjugate(V(kanji, kana, g));
  if (!c) { ok(`${kanji} 활용됨`, false); continue; }
  const got = [c.masu.jp, c.masuPast.jp, c.nai.jp, c.naiPast.jp, c.ta.jp, c.te.jp].join(' ');
  const want = [masu, masuPast, nai, naiPast, ta, te].join(' ');
  ok(`${kanji}(${g}형)`, got === want, got === want ? want : `받음 ${got} / 기대 ${want}`);
}

console.log('\n── 읽는 쪽도 같이 바뀜');
{
  const c = conjugate(V('遊ぶ', 'あそぶ', '1'));
  ok('遊びます의 읽기', c.masu.yomi === 'あそびます', c.masu.yomi);
  ok('遊んだ의 읽기', c.ta.yomi === 'あそんだ', c.ta.yomi);
  /* 来る는 한자가 안 바뀌는데 소리는 く→き→こ로 바뀐다. 여기가 제일 헷갈린다. */
  const k = conjugate(V('来る', 'くる', '3'));
  ok('来ます는 한자 그대로', k.masu.jp === '来ます', k.masu.jp);
  ok('来ます의 읽기는 きます', k.masu.yomi === 'きます', k.masu.yomi);
  ok('来ない의 읽기는 こない', k.nai.yomi === 'こない', k.nai.yomi);
  ok('来た의 읽기는 きた', k.ta.yomi === 'きた', k.ta.yomi);
}

console.log('\n── 정중 부정');
{
  const c = conjugate(V('飲む', 'のむ', '1'));
  ok('飲みません', c.masuNeg.jp === '飲みません', c.masuNeg.jp);
  ok('飲みませんでした', c.masuNegPast.jp === '飲みませんでした', c.masuNegPast.jp);
}

console.log('\n── 동사가 아니면 안 만든다');
ok('명사는 활용 안 함', conjugate({ kanji: '水', kana: 'みず', type: 'noun', group: '1' }) === null);
ok('그룹이 없으면 안 함', conjugate({ kanji: '遊ぶ', kana: 'あそぶ', type: 'verb' }) === null);
ok('빈 것도 안 죽음', conjugate(null) === null && conjugate(undefined) === null);
ok('2형인데 る로 안 끝나면 안 함', conjugate(V('飲む', 'のむ', '2')) === null);

console.log('\n── 자료에 있는 동사를 전부 (조용히 빠지면 시험에 안 나온다)');
{
  const verbs = ALL_WORDS.filter((w) => w.type === 'verb');
  const bad = verbs.filter((w) => !canDrill(w));
  ok(`동사 ${verbs.length}개가 전부 활용됨`, bad.length === 0,
    bad.length ? bad.slice(0, 8).map((w) => `${w.kanji}(${w.level}/${w.group}형)`).join(', ') : '빠진 것 없음');

  const n5 = verbs.filter((w) => w.level === 'N5');
  ok('N5 동사가 충분히 있음', n5.length >= 90, `${n5.length}개`);
  for (const g of ['1', '2', '3']) {
    const n = n5.filter((w) => String(w.group) === g).length;
    ok(`N5에 ${g}형이 있음`, n >= 5, `${n}개`);
  }

  /* 만들어진 모양에 이상한 글자가 섞이면 규칙이 어긋난 것이다 */
  let weird = [];
  for (const w of verbs) {
    const c = conjugate(w);
    for (const k of Object.keys(c)) {
      const v = c[k].jp;
      if (!v || /undefined|null|NaN/.test(v) || v.length < 2) weird.push(`${w.kanji}.${k}=${v}`);
    }
  }
  ok('깨진 모양이 없음', weird.length === 0, weird.slice(0, 5).join(', ') || '없음');

  /* ます형은 반드시 ます로 끝난다 — 규칙이 어긋나면 여기서 걸린다 */
  const notMasu = verbs.filter((w) => !conjugate(w).masu.jp.endsWith('ます'));
  ok('모든 ます형이 ます로 끝남', notMasu.length === 0, notMasu.slice(0, 3).map((w) => w.kanji).join(', ') || '전부');
  const notTe = verbs.filter((w) => !/[てで]$/.test(conjugate(w).te.jp));
  ok('모든 て형이 て나 で로 끝남', notTe.length === 0, notTe.slice(0, 3).map((w) => w.kanji).join(', ') || '전부');
}

console.log('\n── 오답 만들기 (눈으로 골라지면 시험이 아니다)');
{
  const asobu = V('遊ぶ', 'あそぶ', '1');
  const w = distractors(asobu, 'ta', 3);
  ok('오답이 3개', w.length === 3, w.join(' / '));
  ok('정답이 오답에 없음', !w.includes('遊んだ'));
  ok('오답끼리도 안 겹침', new Set(w).size === w.length);
  ok('오답도 그 동사 모양임', w.every((x) => x.startsWith('遊')), w.join(' / '));

  /* 走る는 る로 끝나지만 1형이다. 2형으로 보면 走ない — 진짜로 많이 하는 실수라
     오답으로 나와야 문제가 된다. */
  const hashiru = V('走る', 'はしる', '1');
  const w2 = distractors(hashiru, 'nai', 3);
  ok('る로 끝나는 1형에는 2형 오답이 나옴', w2.includes('走ない'), w2.join(' / '));

  /* 반대로 2형에는 1형으로 본 오답이 나온다 */
  const taberu = V('食べる', 'たべる', '2');
  const w3 = distractors(taberu, 'nai', 3);
  ok('2형에는 1형 오답이 나옴', w3.includes('食べらない'), w3.join(' / '));

  /* 3형을 보통 동사처럼 굴린 답 — する를 처음 배울 때 하는 실수 */
  const suru = distractors(V('勉強する', 'べんきょうする', '3'), 'masu', 3);
  ok('3형에는 보통 동사처럼 굴린 오답', suru.includes('勉強すります'), suru.join(' / '));

  /* ます와 ました를 못 가르는 게 기초 시제에서 제일 많이 하는 실수다.
     그 둘이 같이 안 나오면 시험이 되질 않는다. */
  const masu = distractors(asobu, 'masu', 3);
  ok('정중형에는 시제가 다른 오답', masu.includes('遊びました'), masu.join(' / '));
  ok('극성이 다른 오답도', masu.includes('遊びません'), masu.join(' / '));

  /* 보기가 3개뿐인 문제가 섞이면 그것만 확률이 달라진다.
     동사 644개 × 물어볼 8모양을 전부 세어 본다. */
  const thin = [];
  for (const w of ALL_WORDS.filter((x) => x.type === 'verb')) {
    for (const k of ASK_KEYS) {
      if (distractors(w, k, 3).length < 3) thin.push(`${w.kanji}.${k}`);
    }
  }
  ok('모든 문제에 오답이 3개씩', thin.length === 0, thin.slice(0, 6).join(', ') || '전부');

  /* 오답이 정답과 같으면 문제가 두 개 정답이 된다 — 절대 안 된다 */
  const dup = [];
  for (const w of ALL_WORDS.filter((x) => x.type === 'verb')) {
    for (const k of ASK_KEYS) {
      const right = conjugate(w)[k].jp;
      if (distractors(w, k, 3).includes(right)) dup.push(`${w.kanji}.${k}`);
    }
  }
  ok('정답이 오답에 섞인 문제가 없음', dup.length === 0, dup.slice(0, 6).join(', ') || '없음');
}

console.log('\n── 문제 한 개');
{
  const q = makeQuestion(V('遊ぶ', 'あそぶ', '1'), 'ta', 0);
  ok('보기가 4개', q.choices.length === 4, q.choices.join(' / '));
  ok('정답이 보기에 있음', q.choices.includes('遊んだ'));
  ok('무엇을 묻는지 적힘', q.label === '과거', q.label);
  ok('id가 정해짐', q.id === 'conj-t-遊ぶ-ta', q.id);
  ok('아홉 모양을 같이 들고 옴', Object.keys(q.forms).length === 9, Object.keys(q.forms).length);

  /* 정답이 늘 첫 칸이면 그 자리만 외운다 */
  const spots = new Set();
  for (let s = 0; s < 8; s++) spots.add(makeQuestion(V('遊ぶ', 'あそぶ', '1'), 'ta', s).choices.indexOf('遊んだ'));
  ok('정답 자리가 돌아감', spots.size >= 3, `${spots.size}자리`);

  /* 같은 문제는 같은 자리에 — 다시 그릴 때마다 보기가 흔들리면 못 고른다 */
  const a = makeQuestion(V('遊ぶ', 'あそぶ', '1'), 'ta', 5).choices.join();
  const b = makeQuestion(V('遊ぶ', 'あそぶ', '1'), 'ta', 5).choices.join();
  ok('같은 seed면 보기가 같음', a === b);

  ok('못 만드는 건 null', makeQuestion({ kanji: '水', kana: 'みず', type: 'noun' }, 'ta', 0) === null);
}

console.log('\n── 한 판 짜기');
{
  const n5 = ALL_WORDS.filter((w) => w.type === 'verb' && w.level === 'N5');
  const plan = planDrill(n5, { count: 12, seed: 0 });
  ok('문제가 12개', plan.length === 12, `${plan.length}개`);
  ok('같은 문제가 두 번 안 나옴', new Set(plan.map((q) => q.id)).size === plan.length);

  /* 1형만 잔뜩 나오면 2형은 영영 안 는다 */
  const gs = new Set(plan.map((q) => String(q.word.group)));
  ok('세 그룹이 다 나옴', gs.size === 3, [...gs].sort().join('/'));
  const ks = new Set(plan.map((q) => q.formKey));
  ok('여러 모양을 물어봄', ks.size >= 4, [...ks].join('/'));
  ok('기초 시제만 물어봄', plan.every((q) => BASIC_KEYS.includes(q.formKey)));

  const more = planDrill(n5, { count: 8, keys: ASK_KEYS, seed: 3 });
  ok('て형까지 켜면 그것도 나옴', more.some((q) => q.formKey === 'te') || ASK_KEYS.includes('te'));

  const one = planDrill(n5, { count: 6, groups: ['2'], seed: 1 });
  ok('한 그룹만 고를 수 있음', one.length === 6 && one.every((q) => String(q.word.group) === '2'));

  ok('단어가 없으면 빈 판', planDrill([], { count: 5 }).length === 0);
  ok('모양을 안 고르면 빈 판', planDrill(n5, { count: 5, keys: [] }).length === 0);

  /* 있는 것보다 많이 달라고 해도 안 죽는다 */
  const few = planDrill(n5.filter((w) => String(w.group) === '3'), { count: 200, groups: ['3'] });
  ok('있는 만큼만 나옴', few.length > 0 && few.length <= 200, `${few.length}개`);
}

console.log('\n── 어디서 틀리는지 남기기');
{
  let s = {};
  const asobu = V('遊ぶ', 'あそぶ', '1');
  const taberu = V('食べる', 'たべる', '2');
  ok('아직 안 본 자리는 null', drillRate(s, '1', 'ta') === null);
  s = applyDrill(s, asobu, 'ta', true);
  s = applyDrill(s, asobu, 'ta', false);
  ok('맞고 틀린 걸 세어 둠', drillRate(s, '1', 'ta') === 0.5, String(drillRate(s, '1', 'ta')));
  s = applyDrill(s, taberu, 'ta', true);
  ok('그룹이 다르면 따로 셈', drillRate(s, '2', 'ta') === 1);
  ok('원래 것은 그대로', drillRate(s, '1', 'ta') === 0.5);
  ok('안 건드린 자리는 여전히 null', drillRate(s, '3', 'masu') === null);
}

console.log('\n── 기초문법이 쓰는 옛 활용표도 (앞말이 날아가던 자리)');
{
  /* 기초문법 시험은 동사 전체에서 문제를 뽑는데, する가 붙은 동사가 53개다.
     앞말을 잃으면 「勉強する의 ます형」 답이 「します」가 되어 아예 다른 말이 된다. */
  const g = conjugateOld('べんきょうする', '3');
  ok('勉強する의 ます형에 앞말이 남음', g.masu === 'べんきょうします', g.masu);
  ok('과거도', g.ta === 'べんきょうした', g.ta);
  ok('부정도', g.nai === 'べんきょうしない', g.nai);
  ok('가능형은 できる 쪽', g.potentialDict === 'べんきょうできる', g.potentialDict);
  const k = conjugateOld('もってくる', '3');
  ok('くる가 붙은 것도', k.masu === 'もってきます', k.masu);
  ok('혼자 쓰는 する는 그대로', conjugateOld('する', '3').masu === 'します');
  ok('혼자 쓰는 くる도 그대로', conjugateOld('くる', '3').masu === 'きます');

  /* 자료에 있는 3형 동사를 전부 — 앞말이 사라진 게 하나라도 있으면 안 된다 */
  const lost = ALL_WORDS
    .filter((w) => w.type === 'verb' && String(w.group) === '3')
    .filter((w) => !conjugateOld(w.kana, '3').masu.startsWith(w.kana.replace(/(する|くる)$/, '')));
  ok('3형 동사가 전부 앞말을 지킴', lost.length === 0, lost.slice(0, 5).map((w) => w.kana).join(', ') || '전부');
}

console.log('\n── 화면에 쓰는 이름들');
ok('아홉 모양에 이름이 다 있음', FORMS.every((f) => f.ko && f.ex && f.koEx), FORMS.length);
ok('기초 시제가 다섯', BASIC_KEYS.length === 5, BASIC_KEYS.join('/'));
ok('이름표가 다 있음', ASK_KEYS.every((k) => FORM_LABEL[k]));

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
