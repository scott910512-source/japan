/* 시트 장부 — 뒤로가기가 시트부터 닫게.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 시트가 떠 있을 때 뒤로가기를 누르면 시트만 닫혀야 한다. 전에는 화면이
 * 통째로 나갔다 — 층 세기가 시트를 몰랐기 때문이다. 장부가 열린 순서를
 * 지키고, 맨 위부터 닫고, 지운 뒤에는 안 세는지를 본다. */
import {
  closeTopSheet, pushSheet, resetSheets, sheetDepth, subscribeSheets,
} from '../../src/lib/sheets.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 열고 닫기 ]');
{
  resetSheets();
  ok('처음엔 없다', sheetDepth() === 0);
  ok('없을 때 닫으면 false — 아래 층이 닫힐 차례다', closeTopSheet() === false);

  const log = [];
  const offA = pushSheet(() => log.push('A'));
  ok('하나 열면 한 층', sheetDepth() === 1);
  const offB = pushSheet(() => log.push('B'));
  ok('둘 열면 두 층', sheetDepth() === 2);

  ok('★ 맨 위부터 닫는다 ★', closeTopSheet() === true && log.join() === 'B');
  /* 닫는 손잡이를 불렀을 뿐, 장부에서 빼는 것은 시트 쪽이 한다(닫히면 효과가 지운다) */
  ok('손잡이를 불러도 장부는 시트가 지울 때까지 남는다', sheetDepth() === 2);
  offB();
  ok('지우면 한 층', sheetDepth() === 1);
  ok('그다음은 아래 시트', closeTopSheet() === true && log.join() === 'B,A');
  offA();
  ok('다 지우면 없다', sheetDepth() === 0);
  ok('두 번 지워도 안 깨진다', (offA(), sheetDepth() === 0));
}

console.log('\n[ 닫는 손잡이가 없는 시트 ]');
{
  resetSheets();
  const rm = pushSheet(undefined);
  ok('손잡이 없이도 층으로는 센다', sheetDepth() === 1);
  ok('★ 닫았다고 하지 않는다 — 그래야 아래 층이 닫히지 않고 자리가 다시 선다 ★', closeTopSheet() === false);
  rm();
}

console.log('\n[ 구독 ]');
{
  resetSheets();
  let n = 0;
  const off = subscribeSheets(() => { n += 1; });
  const rm = pushSheet(() => {});
  ok('열면 알린다', n === 1);
  rm();
  ok('지우면 알린다', n === 2);
  off();
  pushSheet(() => {});
  ok('구독을 끊으면 더 안 온다', n === 2);
  resetSheets();
  ok('검사용 비우기', sheetDepth() === 0);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
