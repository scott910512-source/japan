/* 한자 자료의 칸이 섞이지 않는가.
 *
 * 전에는 유래를 memo 끝에 「(실제 유래)」를 붙여 구분했고 화면이 글자를 찾아냈다.
 * 이제 유래(ety)와 연상(memo)은 다른 칸이다. 이 검사는 두 가지를 지킨다.
 *   · 유래와 연상이 한 칸에 섞여 들어오지 않는다 (표시 글자가 남아 있으면 안 된다)
 *   · 선택 칸(st 구조 설명 · ex 예문)이 있으면 모양이 맞다 — 화면이 그대로 그린다 */
import { KANJI_ITEMS, KANJI_LESSONS } from '../../src/data/n3/kanji.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 구성 ]');
ok('쉰 레슨, 500자', KANJI_LESSONS.length === 50 && KANJI_ITEMS.length === 500, `${KANJI_LESSONS.length}과 ${KANJI_ITEMS.length}자`);
ok('글자가 안 겹친다', new Set(KANJI_ITEMS.map((k) => k.k)).size === 500);
ok('기본 칸은 전부 있다(읽기·한국 한자음·부수·구성·뜻·단어)',
  KANJI_ITEMS.every((k) => k.on && k.kh && k.rad && k.parts && k.mean && k.words?.length >= 2),
  KANJI_ITEMS.filter((k) => !(k.on && k.kh && k.rad && k.parts && k.mean && k.words?.length >= 2)).map((k) => k.k).join() || '빠짐 없음');

console.log('\n[ ★ 유래와 연상은 다른 칸 ★ ]');
const withEty = KANJI_ITEMS.filter((k) => k.ety);
const withMemo = KANJI_ITEMS.filter((k) => k.memo);
ok('유래가 있는 한자가 있다', withEty.length >= 100, `${withEty.length}자`);
ok('연상이 있는 한자가 있다', withMemo.length >= 73, `${withMemo.length}자`);
ok('★ 「(실제 유래)」 표시 글자가 어느 칸에도 남아 있지 않다 ★',
  KANJI_ITEMS.every((k) => !/실제 유래\)/.test(`${k.memo || ''}${k.ety || ''}${k.st || ''}`)));
ok('유래와 연상이 같은 글이 아니다', KANJI_ITEMS.every((k) => !(k.ety && k.memo && k.ety === k.memo)));
ok('유래·연상은 글자(문자열)다', KANJI_ITEMS.every((k) => (k.ety === undefined || typeof k.ety === 'string') && (k.memo === undefined || typeof k.memo === 'string')));
ok('빈 문자열은 없다(없으면 칸 자체를 안 둔다)', KANJI_ITEMS.every((k) => k.ety !== '' && k.memo !== '' && k.st !== ''));

console.log('\n[ 선택 칸: 구조 설명 · 예문 ]');
const withSt = KANJI_ITEMS.filter((k) => k.st);
ok('구조 설명이 있으면 글자다', withSt.every((k) => typeof k.st === 'string' && k.st.length >= 6), `${withSt.length}자`);
const withEx = KANJI_ITEMS.filter((k) => k.ex);
ok('예문이 있으면 [일본어, 읽기, 한국어] 묶음이다',
  withEx.every((k) => Array.isArray(k.ex) && k.ex.length >= 1 && k.ex.every((e) => Array.isArray(e) && e.length === 3 && e.every((x) => typeof x === 'string' && x.length > 0))),
  `${withEx.length}자`);
ok('예문에는 그 한자가 들어 있다', withEx.every((k) => k.ex.every(([jp]) => jp.includes(k.k))),
  withEx.filter((k) => !k.ex.every(([jp]) => jp.includes(k.k))).map((k) => k.k).join() || '모두 포함');

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
