/* 일별 활동 집계 — 「몇 번 눌렀나」.
 *
 * 이 계산이 두 군데 손으로 적혀 있었고, 그래서 서로 달라졌다.
 *
 *   · 회독 판정은 올리기만 하고 되돌리기에서 아무것도 빼지 않았다. 잘못 눌러
 *     되돌리고 다시 누르면 카드 하나를 한 번 판정했는데 활동이 둘로 셌다.
 *     고칠 데를 찾으려고 기록을 보는 사람에게 기록이 거짓말을 한 셈이다.
 *   · 실전 연습은 studied·vague·unknown만 올리고 known을 안 올렸다.
 *     실전에서 맞힌 것은 어느 칸에도 안 남았다.
 *
 * 세는 자리를 하나로 모으고, 올리기와 내리기를 같은 표로 검사한다. */
import {
  EMPTY_DAY, tallyVerdicts, addToDay, removeFromDay,
} from '../../src/lib/stats.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const D = '2026-09-12';

console.log('\n[ 판정을 칸별로 센다 ]');
{
  const t = tallyVerdicts(['known', 'vague', 'unknown', 'master']);
  ok('판정 수', t.studied === 4, `${t.studied}`);
  ok('「알아요」와 「이미 알아요」는 같이 안다로', t.known === 2, `${t.known}`);
  ok('애매해요', t.vague === 1);
  ok('몰라요', t.unknown === 1);
  /* 되돌리기에서 빈 판정이 넘어올 수 있다. 그걸 한 번으로 세면 안 된다 */
  ok('빈 판정은 안 센다', tallyVerdicts([null, undefined, '']).studied === 0);
  ok('빈 목록도 괜찮다', tallyVerdicts().studied === 0);
}

console.log('\n[ ★ 판정 → 되돌리기 → 재판정에서 숫자가 제자리로 ★ ]');
{
  let s = {};
  s = addToDay(s, D, ['known']);
  ok('판정하면 오른다', s[D].studied === 1 && s[D].known === 1);

  s = removeFromDay(s, D, ['known']);
  ok('★ 되돌리면 내려간다 ★', s[D].studied === 0 && s[D].known === 0,
    JSON.stringify(s[D]));

  s = addToDay(s, D, ['known']);
  ok('★ 다시 판정해도 하나다 ★', s[D].studied === 1 && s[D].known === 1,
    `studied ${s[D].studied}`);

  /* 여러 번 되풀이해도 부풀지 않아야 한다 — 잘못 눌러 고치는 일은 몇 번이고 생긴다 */
  for (let i = 0; i < 5; i += 1) {
    s = removeFromDay(s, D, ['known']);
    s = addToDay(s, D, ['known']);
  }
  ok('★ 다섯 번 되풀이해도 하나 ★', s[D].studied === 1, `${s[D].studied}`);
}

console.log('\n[ 되돌린 판정의 칸에서 뺀다 ]');
{
  let s = addToDay({}, D, ['known', 'vague', 'unknown']);
  ok('셋 다 올랐다', s[D].studied === 3);
  s = removeFromDay(s, D, ['vague']);
  ok('애매해요만 내려간다', s[D].vague === 0 && s[D].known === 1 && s[D].unknown === 1);
  ok('판정 수도 하나만 내려간다', s[D].studied === 2, `${s[D].studied}`);
}

console.log('\n[ 0 아래로 안 내려간다 ]');
{
  /* 이 집계는 60일만 남기고 기기 두 대에서 합쳐지기도 한다. 올린 적 없는 것을
     빼라는 요청이 들어올 수 있는데, 음수가 남으면 그 뒤 모든 합이 틀어진다. */
  let s = addToDay({}, D, ['known']);
  s = removeFromDay(s, D, ['known']);
  s = removeFromDay(s, D, ['known']);
  ok('★ 음수가 안 생긴다 ★', s[D].studied === 0 && s[D].known === 0, JSON.stringify(s[D]));

  const none = removeFromDay({}, D, ['known']);
  ok('없는 날은 그대로 둔다', none[D] === undefined, JSON.stringify(none));
}

console.log('\n[ 되돌리기는 판정이 적힌 날에서 뺀다 ]');
{
  /* 자정을 넘겨 되돌릴 수 있다. 오늘에서 빼면 어제 올린 것이 오늘에서 사라진다. */
  const 어제 = '2026-09-11';
  let s = addToDay({}, 어제, ['known']);
  s = addToDay(s, D, ['vague']);
  s = removeFromDay(s, 어제, ['known']);
  ok('★ 어제 것은 어제에서 빠진다 ★', s[어제].studied === 0, `${s[어제].studied}`);
  ok('오늘 것은 그대로', s[D].studied === 1 && s[D].vague === 1);
}

console.log('\n[ ★ 실전 연습도 맞힌 것을 센다 ★ ]');
{
  /* 실전 쪽은 known을 안 올렸다. 같은 표를 쓰니 이제 센다. */
  const s = addToDay({}, D, ['known', 'known', 'vague']);
  ok('★ 맞힌 것이 남는다 ★', s[D].known === 2, `${s[D].known}`);
  ok('판정 수도 맞다', s[D].studied === 3);
}

console.log('\n[ 다른 날과 원래 값을 건드리지 않는다 ]');
{
  const before = { '2026-09-01': { studied: 7, known: 7, vague: 0, unknown: 0 } };
  const after = addToDay(before, D, ['known']);
  ok('다른 날은 그대로', after['2026-09-01'].studied === 7);
  ok('원래 꾸러미를 고치지 않는다', before[D] === undefined);
  ok('빈 날의 기본 모양', Object.keys(EMPTY_DAY).length === 4);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
