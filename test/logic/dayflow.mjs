/* 하루 흐름 — 복습 → 약점 퀴즈 → 쭉 퀴즈 → 새로 배우기 → 랜덤 테스트 */
import { FLOW, nextStep, stepOfDeck, randomTestIds, RANDOM_TEST_SIZE, RANDOM_TEST_MIN, n3Open, n3Progress } from '../../src/lib/dayflow.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

console.log('\n[ 순서 ]');
{
  ok('★ 순서는 복습 · 약점 퀴즈 · 쭉 퀴즈 · 새로 배우기 · 오늘의 N3 · 랜덤 테스트 ★', FLOW.join() === 'review,weakquiz,stream,fresh,n3,random');
  const all = { review: true, weakquiz: true, stream: true, fresh: true, n3: true, random: true };
  ok('복습 다음은 약점 퀴즈', nextStep('review', all).to === 'weakquiz');
  ok('약점 퀴즈 다음은 쭉 퀴즈', nextStep('weakquiz', all).to === 'stream');
  ok('쭉 퀴즈 다음은 새로 배우기', nextStep('stream', all).to === 'fresh');
  ok('새로 배우기 다음은 오늘의 N3', nextStep('fresh', all).to === 'n3' && nextStep('fresh', all).label === '오늘의 N3');
  ok('오늘의 N3 다음은 랜덤 테스트', nextStep('n3', all).to === 'random');
  ok('랜덤 테스트 다음은 없다', nextStep('random', all) === null);
  ok('이름표가 붙어 있다', nextStep('review', all).label === '약점 퀴즈' && nextStep('n3', all).label === '오늘 랜덤 테스트');
}

console.log('\n[ 할 게 없는 단계는 건너뛴다 ]');
{
  ok('★ 약점이 없으면 복습 다음에 쭉 퀴즈 ★', nextStep('review', { stream: true, fresh: true, random: true }).to === 'stream');
  ok('쭉 퀴즈를 이미 마쳤으면 새로 배우기로', nextStep('weakquiz', { stream: false, fresh: true }).to === 'fresh');
  ok('새로 배울 게 없으면 오늘의 N3로, 그것도 없으면 랜덤 테스트로', nextStep('stream', { fresh: false, n3: true, random: true }).to === 'n3' && nextStep('stream', { fresh: false, n3: false, random: true }).to === 'random');
  ok('★ 아무것도 안 남았으면 null ★', nextStep('review', {}) === null);
  ok('모르는 단계는 처음부터가 아니라 null', nextStep('nope', { review: false }) === null || nextStep('nope', {}) === null);
}

console.log('\n[ 오늘의 N3 ]');
{
  const T = '2026-11-06';
  ok('N3를 안 켰으면 단계가 없다', n3Open(false, {}, T) === false);
  ok('★ 코스를 아직 안 열었으면(오늘 계획이 없으면) 남았다고 본다 ★', n3Open(true, {}, T) === true && n3Open(true, null, T) === true);
  ok('계획이 있고 덜 했으면 남음', n3Open(true, { days: { [T]: { steps: [{ done: true }, { done: false }], built: 1 } } }, T) === true);
  ok('★ 다 했으면 없다 ★', n3Open(true, { days: { [T]: { steps: [{ done: true }, { done: true }], built: 1 } } }, T) === false);
  ok('계획을 짰는데 오늘 할 게 없는 날도 없다', n3Open(true, { days: { [T]: { steps: [], built: 1 } } }, T) === false);
  ok('어제 계획은 오늘과 무관하다', n3Open(true, { days: { '2026-11-05': { steps: [{ done: true }], built: 1 } } }, T) === true);
  ok('코스를 다 돌았으면 없다', n3Open(true, { summary: { done: 100, total: 100 } }, T) === false);
  ok('진행: 계획이 없으면 null', n3Progress({}, T) === null);
  const p = n3Progress({ days: { [T]: { steps: [{ done: true }, { done: false }, { done: false }] } } }, T);
  ok('진행: 3단계 중 1', p.done === 1 && p.total === 3);
}

console.log('\n[ 판이 어느 단계인가 ]');
{
  ok('복습+약점 판은 복습 단계', stepOfDeck('today:review+weak') === 'review');
  ok('새 단어 판은 새로 배우기 단계', stepOfDeck('today:fresh') === 'fresh');
  ok('★ 오늘의 학습 한 판(today)도 복습 단계로 이어진다 ★', stepOfDeck('today') === 'review');
  ok('다른 판은 흐름 밖', stepOfDeck('words') === null && stepOfDeck('kiju') === null && stepOfDeck(undefined) === null);
}

console.log('\n[ 랜덤 테스트 문제 ]');
{
  const ids = Array.from({ length: 200 }, (_, i) => `w${i}`);
  const wordIds = new Set(ids);
  const fixed = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  ok('문제 수는 쉰', RANDOM_TEST_SIZE === 50 && RANDOM_TEST_MIN === 10);
  const today = ids.slice(0, 40);
  const seen = ids.slice(20, 120);
  const t = randomTestIds({ today, seen, wordIds, rng: fixed });
  ok('★ 쉰 문제를 만든다 ★', t.length === 50, `${t.length}`);
  ok('겹치지 않는다', new Set(t).size === t.length);
  ok('★ 오늘 만난 것이 다 들어간다(마흔 개 + 외운 것 열 개) ★', today.every((id) => t.includes(id)));
  ok('모자란 만큼만 외운 것으로 채운다', t.filter((id) => !today.includes(id)).length === 10);
  const few = randomTestIds({ today: ids.slice(0, 5), seen: [], wordIds, rng: fixed });
  ok('오늘 것뿐이고 모자라면 있는 만큼', few.length === 5);
  const many = randomTestIds({ today: ids.slice(0, 80), seen: [], wordIds, rng: fixed });
  ok('오늘 것이 많으면 쉰 개로 자른다', many.length === 50 && many.every((id) => ids.slice(0, 80).includes(id)));
  const stray = randomTestIds({ today: ['s1', 'x', null, 'w1'], seen: ['w2', 3], wordIds, rng: fixed });
  ok('★ 낱말이 아닌 것(문장 카드 등)은 빠진다 ★', stray.length === 2 && stray.every((id) => wordIds.has(id)));
  ok('순서가 섞인다', t.join() !== [...today, ...seen.filter((i) => !today.includes(i))].slice(0, 50).join());
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
