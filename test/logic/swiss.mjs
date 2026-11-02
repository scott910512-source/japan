/* 독일어 여행 회화 코스 — 자료·문제 만들기·진도·별.
 *
 * 화면 없이 규칙을 통째로 본다. 자료가 비면 화면이 비고, 문제에 정답이 없으면
 * 맞힐 수가 없고, 진도가 안 열리면 코스가 막힌다.
 *
 * ★ 기본은 표준 독일어다 ★ 스위스 팁은 실제로 다른 말일 때만, 열에 하나쯤. */
import {
  trackOfLesson, SWISS_TRACKS, SWISS_UNITS, SWISS_LESSONS, SWISS_ITEMS, itemsOfLesson, tokensOf,
} from '../../src/data/swiss.js';
import {
  buildExercises, starsFor, emptyProgress, isUnlocked, nextLesson, recordLesson,
  courseSummary, mergeSwiss, listenPool, lessonOrder, XP_PER_LESSON, XP_PERFECT_BONUS,
} from '../../src/lib/swissCourse.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const seeded = (s) => { let x = s; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
const HANGUL = /[가-힣]/;

console.log('\n[ 자료가 성하다 — 표준 독일어가 기본 ]');
{
  const travelUnits = SWISS_UNITS.filter((u) => u.track === 'travel');
  ok('여행 회화 단원이 아홉', travelUnits.length === 9, travelUnits.map((u) => u.title).join(' · '));
  ok('레슨이 열넷 넘게', SWISS_LESSONS.length >= 14, `${SWISS_LESSONS.length}개`);
  ok('낱말·문장이 백 넘게', SWISS_ITEMS.length >= 100, `${SWISS_ITEMS.length}개`);

  const need = ['id', 'kind', 'ko', 'de'];
  const broken = SWISS_ITEMS.filter((it) => need.some((k) => !String(it[k] ?? '').trim()));
  ok('★ 낱말마다 뜻·독일어가 있다 ★', broken.length === 0, broken.map((b) => b.id || '?').join(',') || '없음');
  ok('id가 안 겹친다', new Set(SWISS_ITEMS.map((it) => it.id)).size === SWISS_ITEMS.length);
  ok('id는 영문·숫자만', SWISS_ITEMS.every((it) => /^[a-z0-9_-]+$/.test(it.id)),
    SWISS_ITEMS.filter((it) => !/^[a-z0-9_-]+$/.test(it.id)).map((it) => it.id).join(','));
  ok('kind는 word 아니면 sentence', SWISS_ITEMS.every((it) => it.kind === 'word' || it.kind === 'sentence'));

  /* ★ 독일어 칸에 한글이 섞이면 TTS가 한글까지 읽는다 ★ */
  const mixed = SWISS_ITEMS.filter((it) => HANGUL.test(it.de) || (it.ch && HANGUL.test(it.ch.text)));
  ok('★ 독일어 칸에 한글이 없다 ★', mixed.length === 0, mixed.map((x) => x.id).join(',') || '없음');

  /* 옛 스위스 방언 꼴이 기본 자리에 남아 있으면 안 된다 */
  const dialect = ['Grüezi', 'Merci', 'Exgüsi', 'Guete Morge', 'isch', 'nöd', 'chume', 'Chatz', 'Öpfel'];
  /* 낱말 단위로 본다 — 'isch'는 Tisch·Englisch 안에도 있다 */
  const hasWord = (text, w) => new RegExp(`(^|[^A-Za-zÄÖÜäöüß])${w}([^A-Za-zÄÖÜäöüß]|$)`).test(text);
  const leaked = SWISS_ITEMS.filter((it) => dialect.some((d) => hasWord(it.de, d)));
  ok('★ 기본 자리에 스위스 방언이 안 남았다 ★', leaked.length === 0, leaked.map((x) => `${x.id}:${x.de}`).join(',') || '없음');

  /* 한글 도움말은 한글로만, 그리고 짧은 것에만 */
  const badHan = SWISS_ITEMS.filter((it) => it.han && !/^[가-힣\s·]+$/.test(it.han));
  ok('한글 도움말은 한글로만', badHan.length === 0, badHan.map((x) => `${x.id}:${x.han}`).join(',') || '없음');
  const longHan = SWISS_ITEMS.filter((it) => it.han && tokensOf(it).length > 3);
  ok('긴 문장에는 한글 도움말을 안 붙인다', longHan.length === 0, longHan.map((x) => x.id).join(',') || '없음');

  const thin = SWISS_LESSONS.filter((l) => l.items.length < 4);
  ok('레슨마다 넷 이상', thin.length === 0, thin.map((l) => l.id).join(',') || '없음');
  const shortS = SWISS_ITEMS.filter((it) => it.kind === 'sentence' && tokensOf(it).length < 2);
  ok('문장은 조각이 둘 이상', shortS.length === 0, shortS.map((s) => s.id).join(',') || '없음');
  ok('조각을 합치면 문장 그대로', SWISS_ITEMS.filter((it) => it.kind === 'sentence').every((it) => tokensOf(it).join(' ') === it.de));

  const nums = itemsOfLesson('u2l1').map((it) => it.ko.split(' ')[0]);
  ok('숫자가 1~10 차례로', nums.join(',') === '1,2,3,4,5,6,7,8,9,10', nums.join(','));

  /* 여행 순서 — 식당·호텔·공항·길 찾기·쇼핑·응급이 다 있다 */
  const titles = SWISS_UNITS.filter((u) => u.track === 'travel').map((u) => u.title).join(' ');
  ok('여행 상황이 단원으로 있다', ['식당', '호텔', '공항', '길 찾기', '쇼핑', '응급'].every((t) => titles.includes(t)), titles);
}

console.log('\n[ ★ 스위스 팁 — 실제로 다른 말만, 열에 하나쯤 ★ ]');
{
  /* 팁은 여행 회화의 것이다. 기초 단어(숫자·색깔·동물)에는 스위스만의 말이 없다 */
  const travelItems = SWISS_ITEMS.filter((it) => it.track === 'travel');
  const tips = SWISS_ITEMS.filter((it) => it.ch);
  ok('★ 팁은 전부 여행 회화에만 있다 ★', tips.every((it) => it.track === 'travel'));
  const ratio = tips.length / travelItems.length;
  ok('팁이 있다', tips.length >= 8, `${tips.length}개`);
  ok('★ 열에 하나쯤 (5~20%) ★', ratio >= 0.05 && ratio <= 0.2, `${Math.round(ratio * 100)}%`);
  ok('팁은 글이 있다', tips.every((it) => String(it.ch.text).trim().length > 0));
  ok('★ 팁은 표준 독일어와 다른 말이다 ★', tips.every((it) => it.ch.text.trim().toLowerCase() !== it.de.trim().toLowerCase()),
    tips.filter((it) => it.ch.text.trim().toLowerCase() === it.de.trim().toLowerCase()).map((x) => x.id).join(',') || '전부 다름');
  const must = ['Grüezi', 'Merci', 'Velo', 'Billett', 'Spital'];
  ok('여행자가 정말 만나는 팁이 들어 있다', must.every((m) => tips.some((it) => it.ch.text.includes(m))),
    must.filter((m) => !tips.some((it) => it.ch.text.includes(m))).join(',') || '다 있음');
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
  ok('보기 셋에 정답이 든다', ex.filter((x) => x.options).every((e) => e.options.length === 3 && e.options.some((o) => o.id === e.answerId)));
  ok('보기가 서로 다르다', ex.filter((x) => x.options).every((e) => new Set(e.options.map((o) => o.id)).size === 3));
  ok('★ 보기는 같은 단원 안에서만 ★', ex.filter((x) => x.options).every((e) => e.options.every((o) => o.unitId === 'u1')));
  ok('짝 맞추기는 넷', ex.at(-1).pairs.length === 4);
  ok('같은 난수면 같은 목록', JSON.stringify(buildExercises('u1l1', seeded(7)).map((e) => [e.type, e.item?.id]))
    === JSON.stringify(ex.map((e) => [e.type, e.item?.id])));
  ok('없는 레슨은 빈손', buildExercises('없음').length === 0);
}

console.log('\n[ 문장은 조립 문제 ]');
{
  const ex = buildExercises('u3l1', seeded(3));
  const builds = ex.filter((e) => e.type === 'build');
  ok('문장마다 조립 문제', builds.length === itemsOfLesson('u3l1').filter((it) => it.kind === 'sentence').length, `${builds.length}개`);
  const b = builds[0];
  ok('정답 조각이 다 들어 있다', b.answer.every((t) => b.tokens.some((tk) => tk.text === t)));
  ok('★ 헷갈릴 조각이 더 있다 ★', b.tokens.length > b.answer.length, `${b.tokens.length} > ${b.answer.length}`);
  ok('조각마다 번호가 다르다', new Set(b.tokens.map((t) => t.id)).size === b.tokens.length);
  ok('정답은 문장 그대로', b.answer.join(' ') === b.item.de);
}

console.log('\n[ 별 ]');
{
  ok('하나도 안 틀리면 셋', starsFor(0, 10) === 3);
  ok('다섯에 하나까지는 둘', starsFor(2, 10) === 2);
  ok('많이 틀리면 하나', starsFor(5, 10) === 1);
}

console.log('\n[ ★ 진도 — 앞 것을 끝내야 열린다 ★ ]');
{
  const all = lessonOrder();
  /* 여행 회화 갈래 안에서의 잠금. 갈래가 둘이라 「전체 순서의 맨 앞」이 아니라 갈래마다 따로 본다 */
  const order = all.filter((id) => trackOfLesson(id) === 'travel');
  let p = emptyProgress();
  ok('맨 첫 레슨은 열려 있다', isUnlocked(p, order[0]));
  ok('둘째는 잠겨 있다', !isUnlocked(p, order[1]));
  const r = recordLesson(p, order[0], { mistakes: 0, total: 9, wrongIds: [], now: 100 });
  p = { lessons: r.lessons, xp: r.xp, weak: r.weak };
  ok('끝내면 별 셋', p.lessons[order[0]].stars === 3);
  ok('경험치가 쌓인다', p.xp === XP_PER_LESSON + XP_PERFECT_BONUS, `${p.xp}`);
  ok('★ 둘째가 열린다 ★', isUnlocked(p, order[1]));
  ok('다음 할 것은 둘째', nextLesson(p) === order[1]);
  const r2 = recordLesson(p, order[0], { mistakes: 6, total: 9, wrongIds: ['hallo', 'danke'], now: 200 });
  ok('★ 별은 제일 좋았던 것을 남긴다 ★', r2.lessons[order[0]].stars === 3 && r2.lessons[order[0]].last === 1);
  ok('틀린 낱말이 약점에 남는다', r2.weak.includes('hallo') && r2.weak.includes('danke'));
  const s = courseSummary({ lessons: r2.lessons, xp: r2.xp, weak: r2.weak });
  ok('요약이 맞다', s.done === 1 && s.total === all.length && s.stars === 3, JSON.stringify(s));
  ok('망가진 진도도 견딘다', courseSummary(null).done === 0);
}

console.log('\n[ 기기 두 대 합치기 ]');
{
  const a = { lessons: { u1l1: { stars: 3, tries: 1, at: 100, last: 3 } }, xp: 15, weak: ['hallo'] };
  const b = { lessons: { u1l1: { stars: 1, tries: 3, at: 200, last: 1 }, u1l2: { stars: 2, tries: 1, at: 150, last: 2 } }, xp: 30, weak: ['danke'] };
  const m = mergeSwiss(a, b);
  ok('별은 큰 쪽', m.lessons.u1l1.stars === 3);
  ok('★ 경험치는 더하지 않고 큰 쪽 ★', m.xp === 30, `${m.xp}`);
  ok('약점은 합집합', m.weak.includes('hallo') && m.weak.includes('danke'));
}

console.log('\n[ 자동재생에 무엇을 ]');
{
  const none = emptyProgress();
  ok('배운 게 없으면 배운 것은 비어 있다', listenPool(none, 'learned').length === 0);
  ok('전부는 전부', listenPool(none, 'all').length === SWISS_ITEMS.length);
  const r = recordLesson(none, 'u1l1', { mistakes: 1, total: 8, wrongIds: ['hallo'] });
  const p = { lessons: r.lessons, xp: r.xp, weak: r.weak };
  ok('★ 끝낸 레슨의 낱말만 ★', listenPool(p, 'learned').every((it) => it.lessonId === 'u1l1') && listenPool(p, 'learned').length === itemsOfLesson('u1l1').length);
  ok('틀렸던 것만', listenPool(p, 'weak').map((it) => it.id).join() === 'hallo');
}

console.log('\n[ ★ 기초 단어 갈래 — 초등학생이 먼저 배우는 말 ★ ]');
{
  const basicUnits = SWISS_UNITS.filter((u) => u.track === 'basic');
  const basicLessons = SWISS_LESSONS.filter((l) => l.track === 'basic');
  const basicItems = SWISS_ITEMS.filter((it) => it.track === 'basic');
  ok('갈래가 둘: 기초 단어가 앞, 여행 회화가 뒤', SWISS_TRACKS.map((t) => t.id).join() === 'basic,travel');
  ok('기초 단어 단원이 열둘 넘게', basicUnits.length >= 12, `${basicUnits.length}개`);
  ok('기초 단어 레슨이 스물다섯 넘게', basicLessons.length >= 25, `${basicLessons.length}개`);
  ok('★ 기초 낱말·문장이 백오십 넘게 ★', basicItems.length >= 150, `${basicItems.length}개`);
  ok('기초 단원 id는 b로 시작해 여행과 안 겹친다', basicUnits.every((u) => /^b\d+$/.test(u.id)) && basicItems.every((it) => it.id.startsWith('b-')));
  ok('SWISS_UNITS 맨 앞이 기초 단어', SWISS_UNITS[0].track === 'basic');

  const small = basicLessons.filter((l) => l.items.length < 4 || l.items.length > 8);
  ok('★ 레슨 하나는 네~여덟 개(한꺼번에 많이 외우지 않는다) ★', small.length === 0, small.map((l) => `${l.id}:${l.items.length}`).join(',') || '모두 적당');

  const sameLesson = basicLessons.filter((l) => new Set(l.items.map((it) => it.de.toLowerCase())).size !== l.items.length);
  ok('같은 레슨에 같은 독일어가 둘 없다(보기가 겹치지 않는다)', sameLesson.length === 0, sameLesson.map((l) => l.id).join(',') || '없음');
  const sameKo = basicLessons.filter((l) => new Set(l.items.map((it) => it.ko)).size !== l.items.length);
  ok('같은 레슨에 같은 뜻이 둘 없다', sameKo.length === 0, sameKo.map((l) => l.id).join(',') || '없음');
  /* 같은 말이 기초와 여행 양쪽에 있는 건 괜찮다(숫자·오늘/내일 — 두 번 만나는 셈). 하지만 한 갈래 안에서
     같은 말이 두 번 나오면 복습이 같은 낱말을 둘로 센다 */
  const dupWithin = ['basic', 'travel'].flatMap((t) => {
    const seen = new Set();
    return SWISS_ITEMS.filter((it) => it.track === t).filter((it) => { const k = it.de.toLowerCase(); const d = seen.has(k); seen.add(k); return d; }).map((it) => `${t}:${it.de}`);
  });
  ok('★ 한 갈래 안에서는 같은 독일어가 두 번 안 나온다 ★', dupWithin.length === 0, dupWithin.join(',') || '없음');

  /* 명사는 관사를 붙여 한 덩어리로 */
  const nouns = basicItems.filter((it) => it.kind === 'word' && /^(der|die|das) /.test(it.de));
  ok('관사 붙은 명사가 육십 개 넘게', nouns.length >= 60, `${nouns.length}개`);
  const bareNouns = basicItems.filter((it) => it.kind === 'word' && /^[A-ZÄÖÜ]/.test(it.de) && !/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)$/.test(it.de));
  ok('★ 대문자로 시작하는 낱말(명사)은 모두 관사가 붙었다(요일 제외) ★', bareNouns.length === 0, bareNouns.map((x) => x.de).join(',') || '없음');
  const bigHan = basicItems.filter((it) => it.han && /^(der|die|das)\b/.test(it.han));
  ok('한글 도움말에는 관사를 안 적는다', bigHan.length === 0);
  const pics = basicItems.filter((it) => it.emoji || it.swatch);
  ok('그림이나 색이 붙은 낱말이 마흔 개 넘게', pics.length >= 40, `${pics.length}개`);
  ok('색깔 단원은 색이 전부 붙었다', SWISS_ITEMS.filter((it) => it.lessonId.startsWith('b3l')).every((it) => /^#[0-9a-f]{6}$/i.test(it.swatch || '')));
  ok('숫자 0~10이 차례로', itemsOfLesson('b1l1').concat(itemsOfLesson('b1l2')).map((it) => it.ko.split(' ')[0]).join() === '0,1,2,3,4,5,6,7,8,9,10');

  /* 문장은 짧다 */
  const sents = basicItems.filter((it) => it.kind === 'sentence');
  ok('쉬운 문장이 열다섯 개 넘게', sents.length >= 15, `${sents.length}개`);
  ok('★ 기초 문장은 다섯 낱말 이하 ★', sents.every((it) => tokensOf(it).length <= 5), sents.filter((it) => tokensOf(it).length > 5).map((x) => x.de).join(',') || '모두 짧음');

  console.log('\n[ 갈래별 잠금 · 다음 레슨 ]');
  const e = emptyProgress();
  ok('처음 오면 기초 단어 첫 레슨이 열려 있다', isUnlocked(e, 'b1l1'));
  ok('★ 여행 회화 첫 레슨도 열려 있다(기초를 안 끝내도 막지 않는다) ★', isUnlocked(e, 'u1l1'));
  ok('기초 둘째 레슨은 잠겨 있다', !isUnlocked(e, 'b1l2'));
  ok('여행 둘째 레슨도 잠겨 있다', !isUnlocked(e, 'u1l2'));
  ok('★ 처음엔 기초 단어부터 권한다 ★', nextLesson(e) === 'b1l1');
  const r1 = recordLesson(e, 'b1l1', { mistakes: 0, total: 8, wrongIds: [], now: 1000 });
  const p1 = { lessons: r1.lessons, xp: r1.xp, weak: r1.weak };
  ok('기초 첫 레슨을 끝내면 기초 둘째가 열린다', isUnlocked(p1, 'b1l2'));
  ok('기초 진도가 여행 잠금은 안 건드린다', !isUnlocked(p1, 'u1l2'));
  ok('이어서 기초 둘째 레슨', nextLesson(p1) === 'b1l2');
  const r2 = recordLesson(p1, 'u1l1', { mistakes: 0, total: 8, wrongIds: [], now: 2000 });
  const p2 = { lessons: r2.lessons, xp: r2.xp, weak: r2.weak };
  ok('★ 가장 최근에 한 갈래를 이어 간다(여행을 하던 사람은 여행으로) ★', nextLesson(p2) === 'u1l2', nextLesson(p2));
  ok('끝낸 레슨은 다시 권하지 않는다', !['b1l1', 'u1l1'].includes(nextLesson(p2)));
  /* 여행 회화를 이미 끝까지 한 옛 사용자: 기초가 새로 생겼어도 잠기지 않고, 기초를 권한다 */
  const oldAll = { lessons: {}, xp: 0, weak: [] };
  SWISS_LESSONS.filter((l) => l.track === 'travel').forEach((l, i) => { oldAll.lessons[l.id] = { stars: 2, tries: 1, at: 1000 + i, last: 2 }; });
  ok('★ 옛 진도(여행 전부 끝냄)가 그대로 인정된다 ★', courseSummary(oldAll).done === SWISS_LESSONS.filter((l) => l.track === 'travel').length);
  ok('여행을 다 끝낸 사람에게는 기초 단어를 권한다', nextLesson(oldAll) === 'b1l1');
  const oldNone = { lessons: {}, xp: 0, weak: [] };
  SWISS_LESSONS.forEach((l, i) => { oldNone.lessons[l.id] = { stars: 1, tries: 1, at: 1 + i, last: 1 }; });
  ok('전부 끝내면 권할 것이 없다', nextLesson(oldNone) === null);
  ok('알 수 없는 레슨 id는 잠김', !isUnlocked(e, '없음'));

  /* 문제: 기초 레슨도 똑같이 만든다 */
  const seeded = (s) => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const bad = basicLessons.filter((l) => {
    const ex = buildExercises(l.id, seeded(3));
    return ex.length < 5 || ex.filter((x) => x.options).some((o) => o.options.length !== 3 || !o.options.some((q) => q.id === o.answerId));
  });
  ok('★ 기초 레슨 전부 문제가 만들어지고 보기에 정답이 있다 ★', bad.length === 0, bad.map((l) => l.id).join(',') || '모두 정상');
  ok('모든 보기 문제의 보기가 서로 다르다', basicLessons.every((l) => buildExercises(l.id, seeded(9)).filter((x) => x.options).every((o) => new Set(o.options.map((q) => q.de)).size === 3)));
  const sentLessons = basicLessons.filter((l) => l.items.some((it) => it.kind === 'sentence'));
  ok('문장 레슨은 조립 문제를 만든다', sentLessons.every((l) => buildExercises(l.id, seeded(5)).some((x) => x.type === 'build')));
  ok('자동재생 「전부」에 기초 낱말이 들어 있다', listenPool(e, 'all').some((it) => it.track === 'basic'));
  ok('자동재생에 기초 단원 id로 고를 수 있다', listenPool(e, 'b3').length === 11);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
