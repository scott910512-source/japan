/* 스위스 독일어 코스 — 자료·문제 만들기·진도·별.
 *
 * 화면 없이 규칙을 통째로 본다. 자료가 비면 화면이 비고, 문제에 정답이 없으면
 * 맞힐 수가 없고, 진도가 안 열리면 코스가 막힌다. */
import {
  SWISS_UNITS, SWISS_LESSONS, SWISS_ITEMS, itemsOfLesson, tokensOf,
} from '../../src/data/swiss.js';
import {
  buildExercises, starsFor, emptyProgress, isUnlocked, nextLesson, recordLesson,
  courseSummary, mergeSwiss, listenPool, lessonOrder, XP_PER_LESSON, XP_PERFECT_BONUS,
} from '../../src/lib/swissCourse.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
/* 흔들림 없이 보려고 난수를 고정한다 */
const seeded = (s) => { let x = s; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };

console.log('\n[ 자료가 성하다 ]');
{
  ok('단원이 아홉', SWISS_UNITS.length === 9, SWISS_UNITS.map((u) => u.title).join(' · '));
  ok('레슨이 열 넘게', SWISS_LESSONS.length >= 12, `${SWISS_LESSONS.length}개`);
  ok('낱말·문장이 백 넘게', SWISS_ITEMS.length >= 100, `${SWISS_ITEMS.length}개`);

  const need = ['id', 'kind', 'sw', 'hd', 'ko', 'han'];
  const broken = SWISS_ITEMS.filter((it) => need.some((k) => !String(it[k] ?? '').trim()));
  ok('★ 낱말마다 칸이 다 차 있다 ★', broken.length === 0, broken.map((b) => b.id || '?').join(',') || '없음');
  const ids = new Set(SWISS_ITEMS.map((it) => it.id));
  ok('id가 안 겹친다', ids.size === SWISS_ITEMS.length, `${ids.size} / ${SWISS_ITEMS.length}`);
  const lids = new Set(SWISS_LESSONS.map((l) => l.id));
  ok('레슨 id가 안 겹친다', lids.size === SWISS_LESSONS.length);
  ok('kind는 word 아니면 sentence', SWISS_ITEMS.every((it) => it.kind === 'word' || it.kind === 'sentence'));

  const notHangul = SWISS_ITEMS.filter((it) => !/^[가-힣\s·]+$/.test(it.han));
  ok('한글 소리는 한글로만', notHangul.length === 0, notHangul.map((x) => `${x.id}:${x.han}`).join(',') || '없음');

  /* 셋 중 고르기와 짝 맞추기 넷이 되려면 레슨마다 넷은 있어야 한다 */
  const thin = SWISS_LESSONS.filter((l) => l.items.length < 4);
  ok('레슨마다 넷 이상', thin.length === 0, thin.map((l) => l.id).join(',') || '없음');

  /* 문장은 조각 둘 이상이어야 조립이 된다 */
  const shortS = SWISS_ITEMS.filter((it) => it.kind === 'sentence' && tokensOf(it).length < 2);
  ok('문장은 조각이 둘 이상', shortS.length === 0, shortS.map((s) => s.id).join(',') || '없음');
  ok('조각을 합치면 문장 그대로', SWISS_ITEMS.filter((it) => it.kind === 'sentence')
    .every((it) => tokensOf(it).join(' ') === it.sw));

  const nums = itemsOfLesson('u3l1').map((it) => it.ko.split(' ')[0]);
  ok('숫자가 1~10 차례로', nums.join(',') === '1,2,3,4,5,6,7,8,9,10', nums.join(','));
}

console.log('\n[ ★ 레슨 하나 → 문제 목록 ★ ]');
{
  const ex = buildExercises('u1l1', seeded(7));
  ok('여덟 문제 넘게', ex.length >= 8, `${ex.length}개`);
  ok('마지막은 짝 맞추기', ex.at(-1).type === 'match', ex.at(-1).type);
  const types = new Set(ex.map((e) => e.type));
  ok('★ 유형이 섞인다 ★', ['choose-ko', 'choose-sw', 'listen'].every((t) => types.has(t)), [...types].join(','));

  const items = itemsOfLesson('u1l1').map((it) => it.id);
  ok('★ 낱말마다 문제 하나는 만난다 ★', items.every((id) => ex.some((e) => e.item?.id === id)));

  for (const e of ex.filter((x) => x.options)) {
    if (!(e.options.length === 3 && e.options.some((o) => o.id === e.answerId))) {
      ok('보기 셋에 정답이 든다', false, `${e.type} ${e.item.id}`);
      break;
    }
  }
  ok('보기 셋에 정답이 든다', ex.filter((x) => x.options).every((e) => e.options.length === 3 && e.options.some((o) => o.id === e.answerId)));
  ok('보기가 서로 다르다', ex.filter((x) => x.options).every((e) => new Set(e.options.map((o) => o.id)).size === 3));
  ok('★ 보기는 같은 단원 안에서만 ★', ex.filter((x) => x.options).every((e) => e.options.every((o) => o.unitId === 'u1')));
  ok('짝 맞추기는 넷', ex.at(-1).pairs.length === 4);

  /* 같은 난수면 같은 문제 — 화면 검사가 답을 계산할 수 있어야 한다 */
  ok('같은 난수면 같은 목록', JSON.stringify(buildExercises('u1l1', seeded(7)).map((e) => [e.type, e.item?.id]))
    === JSON.stringify(ex.map((e) => [e.type, e.item?.id])));
  ok('없는 레슨은 빈손', buildExercises('없음').length === 0);
}

console.log('\n[ 문장은 조립 문제 ]');
{
  const ex = buildExercises('u2l1', seeded(3));
  const builds = ex.filter((e) => e.type === 'build');
  ok('문장마다 조립 문제', builds.length === itemsOfLesson('u2l1').filter((it) => it.kind === 'sentence').length, `${builds.length}개`);
  const b = builds[0];
  ok('정답 조각이 다 들어 있다', b.answer.every((t) => b.tokens.some((tk) => tk.text === t)));
  ok('★ 헷갈릴 조각이 더 있다 ★', b.tokens.length > b.answer.length, `${b.tokens.length} > ${b.answer.length}`);
  ok('조각마다 번호가 다르다', new Set(b.tokens.map((t) => t.id)).size === b.tokens.length);
  ok('정답은 문장 그대로', b.answer.join(' ') === b.item.sw);
}

console.log('\n[ 별 ]');
{
  ok('하나도 안 틀리면 셋', starsFor(0, 10) === 3);
  ok('다섯에 하나까지는 둘', starsFor(2, 10) === 2);
  ok('많이 틀리면 하나', starsFor(5, 10) === 1);
  ok('끝까지 갔으면 하나는 준다', starsFor(99, 10) === 1);
}

console.log('\n[ ★ 진도 — 앞 것을 끝내야 열린다 ★ ]');
{
  const order = lessonOrder();
  let p = emptyProgress();
  ok('맨 첫 레슨은 열려 있다', isUnlocked(p, order[0]));
  ok('둘째는 잠겨 있다', !isUnlocked(p, order[1]));
  ok('다음 할 것은 첫 레슨', nextLesson(p) === order[0]);

  const r = recordLesson(p, order[0], { mistakes: 0, total: 9, wrongIds: [], now: 100 });
  p = { lessons: r.lessons, xp: r.xp, weak: r.weak };
  ok('끝내면 별 셋', p.lessons[order[0]].stars === 3);
  ok('경험치가 쌓인다', p.xp === XP_PER_LESSON + XP_PERFECT_BONUS, `${p.xp}`);
  ok('★ 둘째가 열린다 ★', isUnlocked(p, order[1]));
  ok('셋째는 아직', !isUnlocked(p, order[2]));
  ok('다음 할 것은 둘째', nextLesson(p) === order[1]);

  /* 다시 해서 더 못해도 별은 안 깎인다 — 그래야 다시 한다 */
  const r2 = recordLesson(p, order[0], { mistakes: 6, total: 9, wrongIds: ['gruezi', 'hoi'], now: 200 });
  ok('★ 별은 제일 좋았던 것을 남긴다 ★', r2.lessons[order[0]].stars === 3 && r2.lessons[order[0]].last === 1);
  ok('경험치는 매번 쌓인다', r2.xp === p.xp + XP_PER_LESSON, `${r2.xp}`);
  ok('틀린 낱말이 약점에 남는다', r2.weak.includes('gruezi') && r2.weak.includes('hoi'));
  ok('시도 횟수가 는다', r2.lessons[order[0]].tries === 2);

  const s = courseSummary({ lessons: r2.lessons, xp: r2.xp, weak: r2.weak });
  ok('요약이 맞다', s.done === 1 && s.total === order.length && s.stars === 3 && s.weak === 2, JSON.stringify(s));
  ok('망가진 진도도 견딘다', courseSummary(null).done === 0 && courseSummary({ lessons: 'x' }).done === 0);
}

console.log('\n[ 기기 두 대 합치기 ]');
{
  const a = { lessons: { u1l1: { stars: 3, tries: 1, at: 100, last: 3 } }, xp: 15, weak: ['hoi'] };
  const b = { lessons: { u1l1: { stars: 1, tries: 3, at: 200, last: 1 }, u1l2: { stars: 2, tries: 1, at: 150, last: 2 } }, xp: 30, weak: ['ade'] };
  const m = mergeSwiss(a, b);
  ok('별은 큰 쪽', m.lessons.u1l1.stars === 3);
  ok('없던 레슨은 그대로 들어온다', m.lessons.u1l2.stars === 2);
  ok('★ 경험치는 더하지 않고 큰 쪽 ★ (재동기화마다 불면 안 된다)', m.xp === 30, `${m.xp}`);
  ok('약점은 합집합', m.weak.includes('hoi') && m.weak.includes('ade'));
}

console.log('\n[ 자동재생에 무엇을 ]');
{
  const none = emptyProgress();
  ok('배운 게 없으면 배운 것은 비어 있다', listenPool(none, 'learned').length === 0);
  ok('전부는 전부', listenPool(none, 'all').length === SWISS_ITEMS.length);
  ok('단원을 고르면 그 단원만', listenPool(none, 'u5').every((it) => it.unitId === 'u5') && listenPool(none, 'u5').length > 0);
  const r = recordLesson(none, 'u1l1', { mistakes: 1, total: 8, wrongIds: ['hoi'] });
  const p = { lessons: r.lessons, xp: r.xp, weak: r.weak };
  ok('★ 끝낸 레슨의 낱말만 ★', listenPool(p, 'learned').every((it) => it.lessonId === 'u1l1') && listenPool(p, 'learned').length === itemsOfLesson('u1l1').length);
  ok('틀렸던 것만', listenPool(p, 'weak').map((it) => it.id).join() === 'hoi');
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
