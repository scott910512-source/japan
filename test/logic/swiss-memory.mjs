/* 독일어 반복 학습의 규칙.
 *
 *   · 끝낸 레슨의 낱말에 기억 기록이 채워진다(옛 진도를 버리지 않는다), 여러 번 불러도 같다
 *   · 맞히면 알아요·틀리면 몰라요, 복습일이 된 것을 맞혀야 단계가 오른다(하루 한 칸)
 *   · 복습 세션: 복습일이 된 것만(미리 복습은 일부러 켤 때만), 굳은 정도에 맞는 유형
 *   · 쓰기 채점: 움라우트를 못 치는 자판도 맞게 쳐 준다
 *   · 일본어 회독과 섞이지 않는다 */
import {
  seedMemory, recordResults, dueIds, preReviewIds, memorySummary, mergeMemory, stageOf, memoryOf, itemById, MEMORY_STAGES,
} from '../../src/lib/swissMemory.js';
import {
  normalizeProgress, recordLesson, mergeSwiss, buildReview, judgeGerman, normalizeDe, typeFor, listenPool, REVIEW_SIZE, emptyProgress,
} from '../../src/lib/swissCourse.js';
import { SWISS_ITEMS, SWISS_LESSONS, itemsOfLesson, lessonById, tokensOf } from '../../src/data/swiss.js';
import { applyVerdict, VERDICT, addDays, todayKey, BOX, stateOf } from '../../src/lib/review.js';
import { readFileSync } from 'node:fs';
const STORAGE_SRC = readFileSync(new URL('../../src/lib/storage.js', import.meta.url), 'utf8');

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const seeded01 = (s = 1) => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const today = todayKey();
const DAY = 86400000;
const L1 = lessonById('u1l1'); const L2 = lessonById('u1l2');
const doneProgress = () => normalizeProgress({
  lessons: { [L1.id]: { stars: 2, at: Date.now() - 5 * DAY }, [L2.id]: { stars: 1, at: Date.now() - 2 * DAY } },
  xp: 30, weak: [L1.items[0].id],
});

console.log('\n[ 기억 기록 채우기 — 옛 진도를 버리지 않는다 ]');
{
  const old = doneProgress();
  ok('옛 진도에는 기억 칸이 비어 있다', Object.keys(old.mem).length === 0);
  const s = seedMemory(old, today);
  const n = L1.items.length + L2.items.length;
  ok('★ 끝낸 두 레슨의 낱말 전부에 기록이 생긴다 ★', Object.keys(memoryOf(s)).length === n, `${n}개`);
  const w = L1.items[0].id;
  ok('★ 약점 주머니에 있던 것은 「몰라요」(오늘 다시) ★', memoryOf(s)[w].box === BOX.UNKNOWN && memoryOf(s)[w].due === today);
  const ok1 = L1.items[1].id;
  ok('나머지는 그 레슨을 끝낸 날 맞힌 것', memoryOf(s)[ok1].box === BOX.KNOWN && memoryOf(s)[ok1].lastSeen === addDays(today, -5));
  ok('★ 여러 번 불러도 같다(멱등) ★', JSON.stringify(seedMemory(s, today)) === JSON.stringify(s));
  const notDone = seedMemory(normalizeProgress({ lessons: { [L1.id]: { stars: 0 } } }), today);
  ok('별이 없는 레슨(안 끝낸 것)은 채우지 않는다', Object.keys(memoryOf(notDone)).length === 0);
  const own = { ...old, mem: { [ok1]: applyVerdict(undefined, VERDICT.UNKNOWN, today) } };
  ok('이미 있는 기록은 안 덮는다', memoryOf(seedMemory(own, today))[ok1].box === BOX.UNKNOWN);
  ok('★ 입력을 바꾸지 않는다 ★', Object.keys(old.mem).length === 0);
}

console.log('\n[ 결과를 기억에 적는다 ]');
{
  const base = seedMemory(doneProgress(), today);
  const a = L2.items[0].id; const b = L2.items[1].id;
  const before = memoryOf(base);
  const after = memoryOf(recordResults(base, { [a]: true, [b]: false }, { today }));
  ok('★ 맞히면 알아요 — 복습일이었으면 단계가 한 칸 오른다 ★', after[a].box === BOX.KNOWN && after[a].level === before[a].level + 1, `${before[a].level}→${after[a].level}`);
  ok('★ 틀리면 몰라요 — 오늘 다시 나온다 ★', after[b].box === BOX.UNKNOWN && after[b].due === today && after[b].level === 0);
  ok('몰라요는 틀린 횟수가 는다', after[b].wrongCount === (before[b].wrongCount || 0) + 1);
  const again = memoryOf(recordResults(recordResults(base, { [a]: true }, { today }), { [a]: true }, { today }));
  ok('★ 같은 날 또 맞혀도 단계는 한 칸만 ★', again[a].level === before[a].level + 1, `${again[a].level}`);
  ok('모르는 id는 무시한다', Object.keys(memoryOf(recordResults(base, { 엉뚱: true }, { today }))).length === Object.keys(before).length);
  ok('빈 결과는 그대로', recordResults(base, {}, { today }) === base);
  ok('입력을 바꾸지 않는다', memoryOf(base)[a].level === before[a].level);
}

console.log('\n[ 복습일 · 단계 ]');
{
  ok('단계: 본 적 없으면 null', stageOf(null) === null && stageOf({ level: 3 }) === null);
  const mk = (level) => ({ lastSeen: today, level });
  ok('★ 단계 경계: 0~1 익히는 중 · 2~3 거의 외움 · 4~ 외웠어요 ★', stageOf(mk(0)) === 'learning' && stageOf(mk(1)) === 'learning' && stageOf(mk(2)) === 'known' && stageOf(mk(3)) === 'known' && stageOf(mk(4)) === 'mastered' && stageOf(mk(5)) === 'mastered');
  ok('단계 이름 셋', MEMORY_STAGES.map((s) => s.id).join() === 'learning,known,mastered');
  const p = seedMemory(doneProgress(), today);
  const due = dueIds(p, today);
  ok('★ 레슨을 끝낸 지 이틀 이상이면 복습일이 된다 ★', due.length === L1.items.length + L2.items.length, `${due.length}`);
  ok('복습일이 된 것이 앞서고 어려운 것이 앞선다', stateOf(memoryOf(p), due[0]).wrongCount >= stateOf(memoryOf(p), due.at(-1)).wrongCount);
  const fresh = recordResults(p, Object.fromEntries(due.map((id) => [id, true])), { today });
  ok('★ 다 맞히면 오늘 복습이 비는데 ★', dueIds(fresh, today).length === 0);
  ok('미리 복습할 것은 남아 있다(익히는 중)', preReviewIds(fresh, today).length === due.length);
  ok('복습일이 된 것과 미리 복습할 것은 겹치지 않는다', preReviewIds(p, today).every((id) => !due.includes(id)));
  const sum = memorySummary(fresh, today);
  ok('★ 요약: 본 것 + 아직 안 배운 것 = 전체 ★', sum.seen + sum.unseen === sum.total && sum.total === SWISS_ITEMS.length, JSON.stringify({ seen: sum.seen, unseen: sum.unseen, total: sum.total }));
  ok('요약: 단계 합 = 본 것', sum.stages.learning + sum.stages.known + sum.stages.mastered === sum.seen);
  ok('요약: 오늘 복습이 0', sum.due === 0 && memorySummary(p, today).due === due.length);
  ok('아무것도 안 한 진도의 요약', memorySummary(emptyProgress(), today).seen === 0 && memorySummary(emptyProgress(), today).due === 0);
}

console.log('\n[ 진도 합치기 · 저장 모양 ]');
{
  const a = recordResults(doneProgress(), { [L1.items[2].id]: true }, { today, at: 1000 });
  const b = recordResults(doneProgress(), { [L1.items[2].id]: false }, { today, at: 2000 });
  const m = mergeMemory(a.mem, b.mem);
  ok('★ 낱말마다 나중에 만진 쪽을 따른다 ★', m[L1.items[2].id].box === BOX.UNKNOWN);
  ok('한쪽에만 있는 낱말도 남는다', mergeMemory({ x: { seenAt: 1 } }, {}).x.seenAt === 1);
  ok('mergeSwiss가 기억도 합친다', Object.keys(mergeSwiss(a, b).mem).length === Object.keys(m).length);
  ok('★ 옛 진도(기억 칸 없음)도 읽힌다 ★', normalizeProgress({ lessons: {}, xp: 5, weak: [] }).mem && Object.keys(normalizeProgress({ xp: 5 }).mem).length === 0);
  const rec = recordLesson(a, L1.id, { mistakes: 0, total: 8, wrongIds: [] });
  ok('★ 레슨 기록이 기억을 지우지 않는다 ★', Object.keys(rec.mem).length === Object.keys(a.mem).length);
  ok('★ 일본어 회독과 다른 저장 열쇠 — 독일어 기억은 독일어 진도 안에만 ★', /swiss: 'jp_manabu_swiss_v1'/.test(STORAGE_SRC) && /review: 'jp_manabu_review_v1'/.test(STORAGE_SRC));
  ok('기억 칸은 쓰레기를 받아도 안 죽는다', normalizeProgress({ mem: 'x' }).mem && typeof normalizeProgress({ mem: 5 }).mem === 'object');
}

console.log('\n[ 쓰기 채점 ]');
{
  const j = (de, inp) => judgeGerman({ de }, inp).verdict;
  ok('★ ü를 못 쳐서 u로 써도 맞다 ★', j('Tschüss', 'tschuss') === 'correct' && j('Tschüss', 'Tschuss') === 'correct');
  ok('★ ue로 써도 맞다 ★', j('Tschüss', 'tschuess') === 'correct' && j('Grüezi', 'gruezi') === 'correct');
  ok('ö·ä·ß도', j('schön', 'schoen') === 'correct' && j('Käse', 'kaese') === 'correct' && j('Straße', 'strasse') === 'correct' && j('Straße', 'Straße') === 'correct');
  ok('대소문자·마침표·물음표·공백이 달라도 맞다', j('Wie viel kostet das?', 'wie viel kostet das') === 'correct' && j('Guten Tag', '  guten   tag. ') === 'correct');
  ok('공백만 다른 것은 같은 말', j('Auf Wiedersehen', 'aufwiedersehen') === 'correct');
  ok('★ 한 글자 오타는 close ★', j('Entschuldigung', 'entschuldigng') === 'close' && j('Entschuldigung', 'entschuldigunk') === 'close');
  ok('긴 문장은 두 글자까지 close', j('Ich hätte gern einen Kaffee.', 'ich haette gern einen kaffe') === 'close');
  ok('★ 엉뚱한 답은 틀림 ★', j('Danke', 'bitte') === 'wrong' && j('Hallo', 'ja') === 'wrong');
  ok('★ 짧은 낱말은 한 글자 차이도 틀림(Ja와 Da, Nein과 Mein은 다른 말) ★', j('Ja', 'da') === 'wrong' && j('Nein', 'mein') === 'wrong');
  ok('빈 입력은 틀림', j('Danke', '') === 'wrong' && j('Danke', '   ') === 'wrong' && j('Danke', null) === 'wrong');
  ok('정답이 같이 돌아온다', judgeGerman({ de: 'Danke' }, 'bitte').expected === 'Danke');
  ok('정규화는 움라우트를 하나로 모은다', normalizeDe('Tschüss') === normalizeDe('tschuess') && normalizeDe('ÜBER') === normalizeDe('ueber'));
  /* 자료 전체가 자기 자신을 맞게 채점한다 */
  const hund = SWISS_ITEMS.find((i) => i.id === 'b-hund');
  ok('★ 관사를 빼고 쓰면 거의 맞았어요(close) + 관사 표시 ★', judgeGerman(hund, 'Hund').verdict === 'close' && judgeGerman(hund, 'hund').article === true);
  ok('관사까지 쓰면 맞다', judgeGerman(hund, 'der Hund').verdict === 'correct' && judgeGerman(hund, 'DER HUND').verdict === 'correct');
  ok('★ 엉뚱한 관사는 틀리다(성이 다른 낱말) ★', judgeGerman(hund, 'die Hund').verdict === 'wrong' && judgeGerman(hund, 'das Hund').verdict === 'wrong');
  ok('관사 없는 낱말(숫자·요일)은 영향이 없다', judgeGerman(SWISS_ITEMS.find((i) => i.id === 'b-drei'), 'drei').verdict === 'correct' && !judgeGerman(SWISS_ITEMS.find((i) => i.id === 'b-drei'), 'drei').article);
  ok('관사만 쓰면 틀리다', judgeGerman(hund, 'der').verdict === 'wrong');
  ok('★ 자료 전부가 자기 철자로 맞다 ★', SWISS_ITEMS.every((it) => judgeGerman(it, it.de).verdict === 'correct'));
  ok('★ 자료 전부가 움라우트 없이 써도 맞다 ★', SWISS_ITEMS.every((it) => judgeGerman(it, it.de.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')).verdict === 'correct'));
}

console.log('\n[ 복습 세션 ]');
{
  const p = seedMemory(doneProgress(), today);
  const r = buildReview(p, { rnd: seeded01(3), today });
  const dueCount = dueIds(p, today).length;
  ok('★ 오늘 복습이 많아도 한 묶음은 열두 개까지 ★', r.ids.length === Math.min(REVIEW_SIZE, dueCount) && REVIEW_SIZE === 12, `${r.ids.length}/${dueCount}`);
  ok('복습일이 된 것만 나온다', r.ids.every((id) => dueIds(p, today).includes(id)));
  ok('묶음 끝에 짝 맞추기가 붙는다(낱말이 넷 이상이면)', r.exercises.at(-1).type === 'match' && r.exercises.at(-1).pairs.length === 4);
  const q = r.exercises.filter((e) => e.type !== 'match');
  ok('★ 처음 배운 것(익히는 중)은 보기가 있는 문제다 ★', q.every((e) => ['choose-ko', 'choose-sw', 'listen', 'build'].includes(e.type)), [...new Set(q.map((e) => e.type))].join());
  ok('보기 문제는 보기가 있고 정답이 안에 있다', q.filter((e) => e.options).every((e) => e.options.length === 3 && e.options.some((o) => o.id === e.answerId)));
  /* 다 맞혀서 오늘 복습이 빈 상태 */
  const done = recordResults(p, Object.fromEntries(dueIds(p, today).map((id) => [id, true])), { today });
  ok('★ 복습이 없으면 묶음이 비어 있다(미리 복습을 안 켰으면) ★', buildReview(done, { rnd: seeded01(1), today }).exercises.length === 0);
  const pre = buildReview(done, { fill: true, rnd: seeded01(1), today });
  ok('★ 미리 복습을 켜면 약한 것부터 채운다 ★', pre.exercises.length > 0 && pre.dueCount === 0 && pre.extra > 0);
  ok('입력을 바꾸지 않는다', Object.keys(memoryOf(p)).length === L1.items.length + L2.items.length);
  ok('아무것도 안 배웠으면 빈 묶음', buildReview(emptyProgress(), { fill: true, today }).exercises.length === 0);

  /* 굳은 정도에 따른 유형 */
  const word = SWISS_ITEMS.find((i) => i.kind === 'word'); const sent = SWISS_ITEMS.find((i) => i.kind === 'sentence');
  const st = (level) => ({ lastSeen: today, level });
  const types = (item, level) => [0, 1, 2, 3].map((i) => typeFor(item, st(level), i));
  ok('★ 낱말: 익히는 중 → 보기 문제만 ★', types(word, 1).every((t) => ['choose-ko', 'choose-sw', 'listen'].includes(t)));
  ok('낱말: 거의 외움 → 직접 쓰기가 섞인다', types(word, 2).includes('write'));
  ok('★ 낱말: 외웠어요 → 보기 없이 쓰기·받아쓰기 ★', types(word, 4).every((t) => ['write', 'dictate'].includes(t)));
  ok('문장: 익히는 중·거의 외움은 조립', types(sent, 1).every((t) => t === 'build') && types(sent, 3).every((t) => t === 'build'));
  ok('문장: 외웠어요는 쓰기도 섞인다', types(sent, 4).includes('write') && types(sent, 4).includes('build'));
  /* 굳은 낱말만 있는 복습 */
  const hard = { ...p, mem: Object.fromEntries(Object.entries(memoryOf(p)).map(([id, s]) => [id, { ...s, level: 4, due: addDays(today, -1) }])) };
  const hr = buildReview(hard, { rnd: seeded01(5), today });
  const ht = hr.exercises.filter((e) => e.type !== 'match').map((e) => e.type);
  ok('★ 굳은 낱말 복습에는 직접 쓰기 문제가 나온다 ★', ht.some((t) => t === 'write' || t === 'dictate'), [...new Set(ht)].join());
  ok('직접 쓰기 문제에는 보기가 없다', hr.exercises.filter((e) => e.type === 'write' || e.type === 'dictate').every((e) => !e.options && e.item));
  ok('조립 문제 조각이 정답을 이룬다', hr.exercises.filter((e) => e.type === 'build').every((e) => e.answer.join(' ') === tokensOf(e.item).join(' ')));
}

console.log('\n[ 듣기: 복습할 것 ]');
{
  const p = seedMemory(doneProgress(), today);
  const due = listenPool(p, 'due');
  ok('★ 복습일이 된 낱말만 들려 준다 ★', due.length === dueIds(p, today).length && due.every((it) => itemById(it.id)));
  ok('안 배웠으면 비어 있다', listenPool(emptyProgress(), 'due').length === 0);
  ok('기존 범위(배운 것·틀렸던 것)는 그대로', listenPool(p, 'learned').length === L1.items.length + L2.items.length && listenPool(p, 'weak').length === 1);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
