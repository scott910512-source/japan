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
  EMPTY_DAY, tallyVerdicts, addToDay, removeFromDay, noteActivity,
} from '../../src/lib/stats.js';
import { mergeStats } from '../../src/lib/merge.js';

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

console.log('\n[ ★ 판정이 아닌 활동도 남는다 ★ ]');
{
  /* 듣기와 시험은 회독 진도를 안 올린다 — 들으면서 흘려보낸 것과 떠올려서
     맞힌 것은 다른 일이다. 그런데 아무 데도 안 남으니 한 시간 듣고도 기록이
     그대로였다. 활동 칸에만 적고 기억 단계는 안 건드린다. */
  let s = noteActivity({}, D, { listened: 3 });
  ok('들은 문장이 남는다', s[D].listened === 3, `${s[D].listened}`);
  ok('★ 판정 수는 안 오른다 ★', (s[D].studied || 0) === 0, `${s[D].studied}`);

  s = noteActivity(s, D, { listened: 2, quizzed: 20 });
  ok('쌓인다', s[D].listened === 5 && s[D].quizzed === 20,
    `들음 ${s[D].listened} / 시험 ${s[D].quizzed}`);

  // 0이나 빈 값으로는 칸을 만들지 않는다
  ok('0은 안 센다', noteActivity({}, D, { listened: 0 })[D] === undefined);
  ok('빈 것도 괜찮다', noteActivity({}, D)[D] === undefined);

  /* 판정과 활동이 같은 날에 같이 있어도 서로 안 섞인다 */
  let both = addToDay({}, D, ['known']);
  both = noteActivity(both, D, { listened: 4 });
  ok('판정과 활동이 같은 칸에 따로 남는다',
    both[D].studied === 1 && both[D].known === 1 && both[D].listened === 4,
    JSON.stringify(both[D]));
}

console.log('\n[ ★ 새 칸이 동기화에서 사라지지 않는다 ★ ]');
{
  /* mergeStats가 칸 이름을 손으로 적어 두고 있었다. 그러면 새 칸을 만들 때
     그 줄을 같이 고쳐야 하고, 잊으면 기기 두 대를 쓰는 사람에게만 그 칸이
     조용히 사라진다 — 한참 뒤에야 드러난다. 양쪽에 있는 칸을 다 훑게 했다. */
  const local = { [D]: { studied: 3, listened: 10, quizzed: 20 } };
  const remote = { [D]: { studied: 5, listened: 2 } };
  const m = mergeStats(local, remote);
  ok('★ 듣기 칸이 살아남는다 ★', m[D].listened === 10, `${m[D].listened}`);
  ok('★ 시험 칸도 살아남는다 ★', m[D].quizzed === 20, `${m[D].quizzed}`);
  ok('원래 규칙(큰 쪽)은 그대로', m[D].studied === 5, `${m[D].studied}`);

  /* 이름을 모르는 칸이 생겨도 마찬가지다 — 다음 칸을 만들 때 여기를 안 고쳐도 된다 */
  const future = mergeStats({ [D]: { 나중칸: 7 } }, { [D]: { 나중칸: 2 } });
  ok('앞으로 생길 칸도 살아남는다', future[D]['나중칸'] === 7, `${future[D]['나중칸']}`);
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
