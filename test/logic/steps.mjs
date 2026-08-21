/* 회독마다 방식이 달라지는 것.
 *
 * 같은 카드를 다섯 번 똑같이 보면 다섯 번째에는 카드 생김새를 외운다. 그래서
 * 회를 거듭할수록 단서를 뺀다. 여기서 확인할 건 두 가지다.
 *   - 맞힐수록 어려워지고, 틀리면 처음으로 돌아가는지
 *   - 소리를 못 내는 사람에게 「글자 없는 화면」을 안 주는지 */
import {
  STEP, STEP_LABEL, STEP_HINT, stepFor, settingsForStep, hidesFront, needsSound,
} from '../../src/lib/steps.js';
import { applyVerdict, emptyState, VERDICT, MASTER_STREAK } from '../../src/lib/review.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('── 맞힐수록 어려워진다');
ok('처음은 읽기', stepFor(0) === STEP.READ);
ok('한 번 맞히면 떠올리기', stepFor(1) === STEP.RECALL);
ok('두 번이면 듣기', stepFor(2) === STEP.LISTEN);
ok('세 번이면 한국어 → 일본어', stepFor(3) === STEP.PRODUCE);
ok('네 번이면 소리 내어', stepFor(4) === STEP.SPEAK);
ok('그 뒤로는 계속 소리 내어', stepFor(9) === STEP.SPEAK && stepFor(50) === STEP.SPEAK);

console.log('\n── 이상한 값이 와도 안 죽는다');
ok('없으면 읽기부터', stepFor() === STEP.READ);
ok('음수도 읽기', stepFor(-3) === STEP.READ);
ok('글자가 와도 읽기', stepFor('x') === STEP.READ);
ok('소수점은 내림', stepFor(2.9) === STEP.LISTEN);

console.log('\n── 틀리면 처음으로 돌아간다');
{
  /* streak을 쓰는 이유가 이것이다. rounds로 세면 방금 틀린 카드가
     오히려 더 어려운 단계로 올라간다. */
  let st = emptyState();
  const seq = [];
  for (const v of [VERDICT.KNOWN, VERDICT.KNOWN, VERDICT.KNOWN]) {
    st = applyVerdict(st, v, '2026-08-21', 1);
    seq.push(stepFor(st.streak));
  }
  ok('세 번 맞히면 3단계까지 올라감', seq.join(' → ') === `${STEP.RECALL} → ${STEP.LISTEN} → ${STEP.PRODUCE}`, seq.join(' → '));

  st = applyVerdict(st, VERDICT.UNKNOWN, '2026-08-21', 1);
  ok('틀리면 다시 읽기부터', stepFor(st.streak) === STEP.READ, `streak ${st.streak}`);
  ok('rounds는 늘었는데도 그렇다', st.rounds === 4, `rounds ${st.rounds}`);

  st = applyVerdict(st, VERDICT.VAGUE, '2026-08-21', 1);
  ok('애매해요도 처음으로', stepFor(st.streak) === STEP.READ);
}

console.log('\n── 졸업할 때쯤이면 말하기를 하고 있다');
{
  let st = emptyState();
  for (let i = 0; i < MASTER_STREAK; i++) st = applyVerdict(st, VERDICT.KNOWN, '2026-08-21', 1);
  ok('졸업 직전 단계가 소리 내어', stepFor(st.streak) === STEP.SPEAK, `streak ${st.streak}`);
  /* 한국어 → 일본어를 한 번은 거쳐야 회화 연습이 된다 */
  ok('가는 길에 한국어 → 일본어를 거침', stepFor(MASTER_STREAK - 1) === STEP.PRODUCE);
}

console.log('\n── 소리를 못 내면 듣기를 건너뛴다');
{
  /* 자동 읽기를 꺼 둔 사람에게 소리를 억지로 트는 건 무례하고,
     소리가 안 나오면 글자 없는 화면만 남아서 아무것도 못 한다. */
  ok('못 들으면 떠올리기로', stepFor(2, { canListen: false }) === STEP.RECALL);
  ok('다른 단계는 그대로', stepFor(3, { canListen: false }) === STEP.PRODUCE);
  ok('들을 수 있으면 듣기', stepFor(2, { canListen: true }) === STEP.LISTEN);
}

console.log('\n── 기존 설정 모양으로 바꿔 준다');
{
  const base = { direction: 'kanji-mean', showKana: false, autoTTS: true, hangulPron: true };
  const read = settingsForStep(base, STEP.READ);
  ok('읽기는 읽는 법을 같이', read.showKana === true && read.direction === 'kanji-mean');
  ok('떠올리기는 읽는 법 없이', settingsForStep(base, STEP.RECALL).showKana === false);
  ok('한국어 → 일본어는 방향을 뒤집음', settingsForStep(base, STEP.PRODUCE).direction === 'mean-kanji');
  ok('소리 내어는 일본어가 앞', settingsForStep(base, STEP.SPEAK).direction === 'kanji-mean');
  ok('다른 설정은 안 건드림', read.hangulPron === true && read.autoTTS === true);
  ok('단계가 없으면 그대로', settingsForStep(base, null) === base);
}

console.log('\n── 앞면을 가리는 건 듣기뿐');
ok('듣기는 가림', hidesFront(STEP.LISTEN) === true);
for (const s of [STEP.READ, STEP.RECALL, STEP.PRODUCE, STEP.SPEAK]) {
  ok(`${STEP_LABEL[s]}는 안 가림`, hidesFront(s) === false);
}
ok('듣기는 소리가 꼭 필요', needsSound(STEP.LISTEN) === true);
ok('나머지는 소리가 없어도 됨', [STEP.READ, STEP.RECALL, STEP.PRODUCE, STEP.SPEAK].every((s) => !needsSound(s)));

console.log('\n── 화면에 쓸 말');
{
  const all = [STEP.READ, STEP.RECALL, STEP.LISTEN, STEP.PRODUCE, STEP.SPEAK];
  ok('다섯 단계에 이름이 있음', all.every((s) => STEP_LABEL[s]), all.map((s) => STEP_LABEL[s]).join(' / '));
  ok('무엇을 하라는지도 있음', all.every((s) => STEP_HINT[s]?.length > 4));
  /* 글자가 안 보이는데 안내가 없으면 고장으로 읽힌다 */
  ok('듣기 안내가 소리를 말함', STEP_HINT[STEP.LISTEN].includes('듣'), STEP_HINT[STEP.LISTEN]);
  ok('한국어 → 일본어 안내가 방향을 말함', STEP_HINT[STEP.PRODUCE].includes('일본어'), STEP_HINT[STEP.PRODUCE]);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
