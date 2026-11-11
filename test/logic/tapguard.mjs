/* 같은 키 · 같은 자리를 연달아 누른 것은 한 번으로 본다(0.2초).
 *   · 「답 보기」(Enter) 바로 뒤의 Enter가 「알아요」로 기록되지 않게
 *   · 다른 키 · 다른 자리는 바로 받는다 */
import { isRepeatTap, SAME_SPOT_PX } from '../../src/lib/tapguard.js';
import { tooSoon, SAME_INPUT_GAP_MS } from '../../src/lib/useHotkeys.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

console.log('\n[ 같은 키 ]');
{
  ok('틈은 0.2초다', SAME_INPUT_GAP_MS === 200);
  ok('★ 같은 키를 0.2초 안에 또 누르면 안 받는다 ★', tooSoon({ id: 'Enter', at: 1000 }, { id: 'Enter', at: 1120 }) === true);
  ok('0.2초가 지나면 받는다', tooSoon({ id: 'Enter', at: 1000 }, { id: 'Enter', at: 1200 }) === false && tooSoon({ id: 'Enter', at: 1000 }, { id: 'Enter', at: 1500 }) === false);
  ok('★ 다른 키는 바로 받는다(1 → 2처럼 이어 누르기) ★', tooSoon({ id: 'Digit1', at: 1000 }, { id: 'Digit2', at: 1010 }) === false);
  ok('처음 누른 키는 받는다', tooSoon(null, { id: 'Enter', at: 5 }) === false);
  ok('시계가 거꾸로 가도(값이 작아져도) 막지 않는다', tooSoon({ id: 'Enter', at: 1000 }, { id: 'Enter', at: 900 }) === false);
}

console.log('\n[ 같은 자리 클릭 ]');
{
  const a = { at: 1000, x: 200, y: 600 };
  ok('★ 같은 자리를 0.2초 안에 또 누르면 버린다 ★', isRepeatTap(a, { at: 1090, x: 204, y: 598 }) === true);
  ok(`${SAME_SPOT_PX}px 안이면 같은 자리다`, isRepeatTap(a, { at: 1050, x: 200 + SAME_SPOT_PX, y: 600 }) === true && isRepeatTap(a, { at: 1050, x: 200 + SAME_SPOT_PX + 1, y: 600 }) === false);
  ok('★ 다른 자리는 바로 받는다(조각을 빠르게 이어 누르기) ★', isRepeatTap(a, { at: 1050, x: 300, y: 600 }) === false && isRepeatTap(a, { at: 1050, x: 200, y: 660 }) === false);
  ok('0.2초가 지나면 같은 자리도 받는다', isRepeatTap(a, { at: 1200, x: 200, y: 600 }) === false);
  ok('처음 누른 것은 받는다', isRepeatTap(null, a) === false);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
