/* 일본 생존 — 자료와 진행 규칙.
 *
 * 게임은 규칙이 하나만 어긋나도 「맞는데 틀렸다」가 나오고, 그러면 아무도
 * 다시 안 한다. 특히 이 셋을 본다.
 *   - 정답이 없는 장면이 있는지 (있으면 거기서 못 나간다)
 *   - 보기 둘이 같은 글자인지 (둘 다 정답인데 하나만 맞다고 한다)
 *   - 실전에서 틀린 게 회독으로 넘어가는지 (이게 안 되면 앱에 붙은 게 아니다) */
import { STAGES, COMING } from '../../src/data/rpg.js';
import {
  FORM, CHOICES, PASS, buildDrill, buildCheckpoint, reask, passed, repsFor,
  masteryOf, MASTERY_LABEL, scoreForHints, gradeOf, expFor, levelOf, levelProgress,
  verdictsFrom, stageOf, HINT_SCORE,
} from '../../src/lib/rpg.js';
import { applyVerdict, emptyState, VERDICT } from '../../src/lib/review.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const conbini = STAGES[0];

console.log('── 스테이지 자료');
{
  ok('편의점이 있음', conbini && conbini.id === 'conbini');
  ok('표현이 다섯에서 여덟', conbini.expressions.length >= 5 && conbini.expressions.length <= 8,
    `${conbini.expressions.length}개`);
  ok('장면이 있음', conbini.scenes.length >= 5, `${conbini.scenes.length}개`);

  const ids = conbini.expressions.map((e) => e.id);
  ok('표현 id가 안 겹침', new Set(ids).size === ids.length);
  /* id가 회독 저장소에 그대로 들어간다. 규칙이 어긋나면 단어와 부딪친다. */
  ok('id가 rpg-로 시작함', ids.every((id) => id.startsWith('rpg-')), ids[0]);
  ok('표현마다 일본어·읽기·뜻이 다 있음',
    conbini.expressions.every((e) => e.jp && e.kana && e.ko));
  ok('뜻이 서로 안 겹침',
    new Set(conbini.expressions.map((e) => e.ko)).size === conbini.expressions.length);

  ok('앞으로 나올 곳도 적혀 있음', COMING.length >= 3, COMING.map((c) => c.label).join(','));
  ok('스테이지를 id로 찾을 수 있음', stageOf(STAGES, 'conbini') === conbini && stageOf(STAGES, '없음') === null);
}

console.log('\n── 장면 (여기가 어긋나면 못 나간다)');
{
  for (const sc of conbini.scenes) {
    const okCount = sc.choices.filter((c) => c.ok).length;
    const noCount = sc.choices.filter((c) => !c.ok).length;
    if (okCount === 0) { ok(`${sc.id}에 정답이 있음`, false, '정답이 하나도 없다'); continue; }
    if (noCount === 0) { ok(`${sc.id}에 오답도 있음`, false, '전부 정답이라 문제가 안 된다'); continue; }
    const texts = sc.choices.map((c) => c.jp);
    if (new Set(texts).size !== texts.length) { ok(`${sc.id} 보기가 안 겹침`, false, texts.join(' / ')); continue; }
    if (sc.choices.some((c) => !c.ok && !c.why)) { ok(`${sc.id} 오답에 이유가 붙음`, false); continue; }
    ok(`${sc.id} — 정답 ${okCount} · 오답 ${noCount}`, true);
  }

  /* 「봉투 필요하세요?」는 네도 아니오도 맞는 답이다. 하나만 정답으로 치면
     맞는데 틀렸다고 나온다. 그런 장면이 실제로 있어야 한다. */
  ok('정답이 둘인 장면이 있음', conbini.scenes.some((s) => s.choices.filter((c) => c.ok).length >= 2));

  ok('장면마다 힌트가 둘', conbini.scenes.every((s) => (s.hints || []).length >= 2));
  ok('힌트 첫 줄에 한글 뜻이 통째로 안 들어감',
    conbini.scenes.every((s) => !s.hints[0].includes(s.npc.ko)),
    conbini.scenes[0].hints[0]);
  ok('장면마다 NPC 말과 읽기·뜻', conbini.scenes.every((s) => s.npc.jp && s.npc.kana && s.npc.ko));
  ok('맞았을 때와 틀렸을 때 반응이 다름',
    conbini.scenes.every((s) => s.reaction.ok && s.reaction.no && s.reaction.ok !== s.reaction.no));

  /* uses에 적은 표현이 실제로 있어야 회독으로 넘어간다 */
  const known = new Set(conbini.expressions.map((e) => e.id));
  const bad = [];
  for (const s of conbini.scenes) for (const c of s.choices) for (const u of c.uses || []) if (!known.has(u)) bad.push(u);
  ok('장면이 가리키는 표현이 다 있음', bad.length === 0, bad.join(',') || '전부');
}

console.log('\n── 숙련도는 회독을 그대로 쓴다');
{
  const id = conbini.expressions[0].id;
  ok('처음 보면 0', masteryOf({}, id) === 0);
  let st = emptyState();
  st = applyVerdict(st, VERDICT.KNOWN, '2026-08-01', 1);
  ok('한 번 맞히면 1', masteryOf({ [id]: st }, id) === 1);
  for (let i = 0; i < 5; i++) st = applyVerdict(st, VERDICT.KNOWN, '2026-08-01', 1);
  ok('많이 맞혀도 4를 안 넘음', masteryOf({ [id]: st }, id) === 4, String(masteryOf({ [id]: st }, id)));
  ok('단계마다 이름이 있음', MASTERY_LABEL.length === 5 && MASTERY_LABEL[0] && MASTERY_LABEL[4]);

  /* 다 똑같이 반복하면 아는 것에 시간을 버린다 */
  ok('처음 보는 건 더 자주', repsFor({}, id) === 4, String(repsFor({}, id)));
  ok('익숙하면 덜', repsFor({ [id]: st }, id) === 2, String(repsFor({ [id]: st }, id)));
  let weak = emptyState();
  for (let i = 0; i < 3; i++) weak = applyVerdict(weak, VERDICT.UNKNOWN, '2026-08-01', 1);
  ok('자꾸 틀리는 건 제일 자주', repsFor({ [id]: weak }, id) === 5, String(repsFor({ [id]: weak }, id)));
}

console.log('\n── 반복 문제');
{
  const drill = buildDrill(conbini, {});
  ok('문제가 넉넉히 나옴', drill.length >= 20, `${drill.length}문제`);
  ok('표현마다 서너 번씩', conbini.expressions.every((e) => {
    const n = drill.filter((q) => q.exprId === e.id).length;
    return n >= 2 && n <= 8;
  }), conbini.expressions.map((e) => drill.filter((q) => q.exprId === e.id).length).join(','));

  /* 같은 표현을 같은 모양으로만 물으면 뜻이 아니라 보기 자리를 외운다 */
  const first = conbini.expressions[0].id;
  const forms = new Set(drill.filter((q) => q.exprId === first).map((q) => q.form));
  ok('한 표현을 여러 모양으로 물음', forms.size >= 2, [...forms].join(','));

  ok('보기가 세 개씩', drill.every((q) => q.options.length === CHOICES),
    `${new Set(drill.map((q) => q.options.length)).size}가지`);
  ok('보기 글자가 안 겹침', drill.every((q) => new Set(q.options.map((o) => o.text)).size === q.options.length));
  ok('정답이 보기에 있음', drill.filter((q) => q.answerId)
    .every((q) => q.options.some((o) => o.id === q.answerId)));

  /* 시작하자마자 모르는 게 나오면 그날은 거기서 끝난다 */
  let opened = 0;
  for (let i = 0; i < 10; i++) {
    const d = buildDrill(conbini, {}, { seed: i });
    if (d[0].form === FORM.JP_KO) opened++;
  }
  ok('앞은 쉬운 것으로 연다', opened >= 8, `10판 중 ${opened}판`);

  /* 실전이 「점원 말에 답하기」 모양이라, 한 번도 안 해 보고 나가면 안 된다 */
  ok('점원 말에 답하는 문제도 섞임', drill.some((q) => q.form === FORM.REPLY));
  const rq = drill.find((q) => q.form === FORM.REPLY);
  ok('그 문제에 정답과 오답이 다 있음', rq.options.some((o) => o.ok) && rq.options.some((o) => !o.ok));

  ok('소리를 끄면 듣기 문제가 안 나옴',
    !buildDrill(conbini, {}, { canListen: false }).some((q) => q.form === FORM.LISTEN));
  ok('켜면 나옴', buildDrill(conbini, {}, { canListen: true }).some((q) => q.form === FORM.LISTEN));
}

console.log('\n── 틀리면 다른 모양으로 다시');
{
  const drill = buildDrill(conbini, {});
  const q = drill.find((x) => x.form === FORM.JP_KO);
  const again = reask(q, conbini, {}, 3);
  ok('다시 낼 문제가 나옴', Boolean(again));
  /* 그대로 또 물으면 답을 외우지 뜻을 외우지 않는다 */
  ok('아까와 다른 모양', again.form !== q.form, `${q.form} → ${again.form}`);
  ok('같은 표현을 물음', again.exprId === q.exprId);
}

console.log('\n── 체크포인트');
{
  const cp = buildCheckpoint(conbini, {});
  ok('다섯에서 열 문제', cp.length >= 5 && cp.length <= 10, `${cp.length}문제`);
  ok('보기가 세 개씩', cp.every((q) => q.options.length === CHOICES));

  /* 못 넘으면 틀린 것만 짧게 다시 — 다 처음부터 시키면 그만둔다 */
  const only = [conbini.expressions[0].id, conbini.expressions[1].id];
  const re = buildCheckpoint(conbini, {}, { only });
  ok('틀린 것만 다시 낼 수 있음', re.length === 2 && re.every((q) => only.includes(q.exprId)), `${re.length}문제`);

  ok('여덟 개 맞히면 통과', passed(8, 10));
  ok('일곱이면 아직', !passed(7, 10));
  ok('선이 8할', PASS === 0.8);
  ok('아무것도 안 풀면 통과 아님', !passed(0, 0));
}

console.log('\n── 힌트와 점수');
{
  ok('힌트 없이 맞히면 100', scoreForHints(0) === 100);
  ok('한 번 쓰면 70', scoreForHints(1) === 70);
  ok('두 번 쓰면 40', scoreForHints(2) === 40);
  ok('더 써도 밑으로는 안 감', scoreForHints(9) === HINT_SCORE[HINT_SCORE.length - 1]);
  ok('많이 맞히면 높은 등급', gradeOf(0.9) === 'A' && gradeOf(1) === 'S');
  ok('적게 맞히면 낮은 등급', gradeOf(0.4) === 'D');
  ok('연속으로 맞히면 더 받음', expFor({ score: 100, combo: 5, hints: 0 }) > expFor({ score: 100, combo: 0, hints: 0 }));
  ok('힌트를 쓰면 덜 받음', expFor({ score: 100, combo: 0, hints: 3 }) < expFor({ score: 100, combo: 0, hints: 0 }));
  ok('그래도 0은 아님', expFor({ score: 0, combo: 0, hints: 99 }) > 0);
}

console.log('\n── 레벨');
{
  ok('처음엔 1', levelOf(0) === 1);
  ok('300이면 2', levelOf(300) === 2);
  ok('중간이면 그 사이', levelProgress(150) === 50, String(levelProgress(150)));
  ok('빈 값도 안 죽음', levelOf() === 1 && levelProgress() === 0);
}

console.log('\n── 회독으로 넘기기 (이게 안 되면 얹혀 있는 것이다)');
{
  const v = verdictsFrom({ wrong: ['rpg-conbini-fukuro'], hinted: ['rpg-conbini-ohashi'] });
  ok('틀린 건 몰라요로', v['rpg-conbini-fukuro'] === VERDICT.UNKNOWN);
  ok('힌트 쓴 건 애매해요로', v['rpg-conbini-ohashi'] === VERDICT.VAGUE);

  /* 셋 중에 고르는 건 알아본 것이지 떠올린 게 아니다.
     그걸 알아요로 세면 복습 간격이 실력보다 빨리 벌어진다. */
  ok('잘한 건 안 올림', Object.values(verdictsFrom({ wrong: [], hinted: [], right: ['rpg-conbini-fukuro'] })).length === 0);
  ok('둘 다면 틀린 쪽이 이김',
    verdictsFrom({ wrong: ['a'], hinted: ['a'] }).a === VERDICT.UNKNOWN);
  ok('아무것도 없으면 빈 것', Object.keys(verdictsFrom({})).length === 0);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
