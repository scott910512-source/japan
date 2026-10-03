/* 뒤로가기와 덮인 화면.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 이 앱에는 주소가 없다. 그래서 덮인 화면이 열릴 때 history에 자리 하나를
 * 밀어 넣고, 뒤로가기가 그 자리를 쓰면 덮인 것을 닫는다.
 *
 * 깨지기 쉬운 자리가 셋이다.
 *
 *   · 화면 버튼으로 닫았을 때 자리가 남으면, 다음 뒤로가기 한 번이 헛돈다.
 *     「뒤로가기가 안 먹는다」가 그것이다.
 *   · 층이 둘일 때(회독 판 위에 메뉴) 자리가 하나뿐이면, 위층을 닫은 뒤
 *     한 번 더 누르면 덮인 화면을 두고 앱을 벗어난다.
 *   · 닫고 바로 다시 여는 흐름. 우리가 부른 back은 비동기라서 늦게 도착하고,
 *     그 사이 다시 열렸는데 자리를 안 세우면 거기서 앱 밖으로 튕긴다 —
 *     전에 실제로 그랬고, 그래서 한 번 되돌린 자리다.
 *
 * 전부 「층 수와 두 표시」의 조합이라 표로 지킬 수 있다. 브라우저를 눌러 보고
 * 아는 것으로는 이 셋을 다 못 덮는다 — 특히 마지막 것은 타이밍이다. */
import { NAV_SENTINEL, onLayerChange, onPopState } from '../../src/lib/navhistory.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const show = (r) => JSON.stringify(r);

console.log('\n[ 층이 열릴 때 ]');
{
  ok('열리면 자리를 하나 민다',
    onLayerChange({ depth: 1, owned: false }).act === 'push',
    show(onLayerChange({ depth: 1, owned: false })));
  ok('민 뒤에는 우리 자리가 있다고 적어 둔다',
    onLayerChange({ depth: 1, owned: false }).owned === true);
  ok('★ 자리는 하나만 — 이미 있으면 안 민다 ★',
    onLayerChange({ depth: 1, owned: true }).act === 'none');
  ok('층이 둘로 늘어도 자리는 하나',
    onLayerChange({ depth: 2, owned: true }).act === 'none');
  ok('아무것도 안 열렸으면 밀 일이 없다',
    onLayerChange({ depth: 0, owned: false }).act === 'none');
}

console.log('\n[ ★ 화면 버튼으로 닫을 때 — 남은 자리를 쓴다 ★ ]');
{
  /* 여기가 「뒤로가기가 한 번 안 먹는다」의 자리였다. 닫고 자리를 그대로
     두면 다음 뒤로가기가 그걸 쓰면서 아무 일도 안 일어난다. */
  const r = onLayerChange({ depth: 0, owned: true });
  ok('★ 다 닫히면 우리가 자리를 쓴다 ★', r.act === 'back', show(r));
  ok('쓰라고 불러 뒀다고 적어 둔다 — 도착할 때 알아보려고', r.pending === true);
  ok('두 번 부르지 않는다 — 비동기라 두 번 부르면 남의 자리를 뺀다',
    onLayerChange({ depth: 0, owned: true, pending: true }).act === 'none');
  ok('자리가 없으면 쓸 것도 없다',
    onLayerChange({ depth: 0, owned: false }).act === 'none');
}

console.log('\n[ 뒤로가기를 눌렀을 때 ]');
{
  const one = onPopState({ depth: 1, owned: true });
  ok('덮인 한 층을 닫는다', one.close === true, show(one));
  ok('그 자리는 이 pop이 썼다 — 이제 우리 자리가 없다', one.owned === false);
  ok('다 닫혔으면 자리를 다시 안 세운다', one.act === 'none');

  /* ★ 층이 둘일 때 ★
     위층을 닫아도 아래층은 열려 있다. 자리를 다시 세우지 않으면 다음
     뒤로가기가 덮인 화면을 두고 앱을 벗어난다 — 전에 그랬다. */
  const two = onPopState({ depth: 2, owned: true });
  ok('★ 아래층이 남으면 자리를 다시 세운다 ★', two.act === 'push', show(two));
  ok('위층 하나만 닫는다', two.close === true);
  ok('새로 세운 자리는 우리 것', two.owned === true);

  /* 세 층도 같다 — 한 층씩, 남으면 다시 세운다 */
  const three = onPopState({ depth: 3, owned: true });
  ok('세 층이어도 한 층씩', three.close === true && three.act === 'push');

  /* 덮인 게 없으면 막지 않는다 — 붙잡으면 앱에서 나갈 길이 없어진다 */
  const none = onPopState({ depth: 0, owned: false });
  ok('★ 덮인 게 없으면 안 막는다 — 앱에서 나갈 길 ★',
    none.close === false && none.act === 'none', show(none));
}

console.log('\n[ ★ 닫고 바로 다시 열기 — 전에 앱 밖으로 튕긴 자리 ★ ]');
{
  /* 흐름: 층이 열려 자리가 있다 → 화면 버튼으로 닫는다(back을 부른다) →
     back이 도착하기 전에 다시 열린다 → back이 도착한다.
     그때 자리를 안 세우면 열린 층에 자리가 없고, 다음 뒤로가기가 앱을
     벗어난다. */
  const closing = onLayerChange({ depth: 0, owned: true });
  ok('닫으면서 back을 부른다', closing.act === 'back' && closing.pending === true);

  /* 도착 전에 다시 열렸다 — 여기서는 안 민다(부른 back이 도착하면 그쪽이 센다) */
  const reopen = onLayerChange({ depth: 1, owned: true, pending: true });
  ok('도착 전에 다시 열려도 자리를 더 안 민다', reopen.act === 'none', show(reopen));

  /* back이 도착했다. 층이 열려 있으니 자리를 새로 세운다 */
  const landed = onPopState({ depth: 1, owned: true, pending: true });
  ok('★ 도착했을 때 열려 있으면 자리를 새로 세운다 ★', landed.act === 'push', show(landed));
  ok('우리가 부른 back이라 아무것도 안 닫는다', landed.close === false);
  ok('새 자리는 우리 것', landed.owned === true);
  ok('기다리던 것은 끝났다', landed.pending === false);

  /* 다시 안 열렸으면 그냥 끝. 자리도 없고 닫을 것도 없다 */
  const clean = onPopState({ depth: 0, owned: true, pending: true });
  ok('다시 안 열렸으면 그대로 끝',
    clean.act === 'none' && clean.close === false && clean.owned === false, show(clean));
}

console.log('\n[ 열고 닫기를 되풀이해도 자리가 쌓이지 않는다 ]');
{
  /* ★ 자리가 쌓이면 뒤로가기를 열 번 눌러야 앱을 벗어난다 ★
     한 번 열고 닫을 때마다 하나 밀고 하나 쓰면 셈이 맞는다. 표시를 들고
     스무 번 돌려 본다. */
  let owned = false; let pending = false;
  let pushed = 0; let used = 0;
  for (let i = 0; i < 20; i++) {
    // 열기
    let r = onLayerChange({ depth: 1, owned, pending });
    if (r.act === 'push') pushed += 1;
    owned = r.owned; pending = r.pending;
    // 화면 버튼으로 닫기
    r = onLayerChange({ depth: 0, owned, pending });
    if (r.act === 'back') used += 1;
    owned = r.owned; pending = r.pending;
    // 부른 back이 도착
    r = onPopState({ depth: 0, owned, pending });
    if (r.act === 'push') pushed += 1;
    owned = r.owned; pending = r.pending;
  }
  ok('★ 민 수와 쓴 수가 같다 ★', pushed === used && pushed === 20,
    `민 것 ${pushed} · 쓴 것 ${used}`);
  ok('끝나고 남은 자리가 없다', owned === false && pending === false);
}

console.log('\n[ 자리 이름 ]');
{
  /* history.state로 「우리 자리인가」를 알아본다. 이름이 바뀌면 옛 자리를
     못 알아보고 자리를 두 개 밀게 된다. */
  ok('자리 이름은 layer', NAV_SENTINEL === 'layer', NAV_SENTINEL);
}

console.log('\n[ 빈손으로 불러도 안 죽는다 ]');
{
  ok('onLayerChange()', onLayerChange().act === 'none');
  ok('onPopState()', onPopState().close === false);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
