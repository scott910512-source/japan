/* 학습 탭의 짜임새.
 *
 * 탭이 넷(홈·학습·복습·내 학습)이 되면서 학습 탭의 뜻이 「무엇을 공부할지
 * 고르는 자리」로 좁혀졌다. 그래서 여기에는 콘텐츠 종류만 있다 — 행동(새로
 * 배우기·복습하기)은 홈과 복습 탭이 한다.
 *
 * 여기서 지키는 것은 하나다 — 목록이 한 곳에만 있어야 한다. 학습 탭과
 * 설정에 따로 적어 두면, 없앤 메뉴가 설정에는 남아서 켜도 아무 데도 안 뜨는
 * 칸이 생긴다. */
import { MENUS, MENU_GROUPS, MENU_IDS, groupedMenus } from '../../src/lib/menu.js';
import { DEFAULT_SETTINGS } from '../../src/lib/storage.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 네 묶음 ]');
ok('묶음은 넷', MENU_GROUPS.length === 4, MENU_GROUPS.map((g) => g.label).join(' / '));
/* 목표(코스)가 먼저, 그다음 무엇을(콘텐츠), 어떻게 굴릴지(연습), 곁가지 */
ok('JLPT N3 · 콘텐츠 · 연습 · 그 밖에',
  MENU_GROUPS.map((g) => g.id).join() === 'course,content,practice,etc');
ok('묶음마다 왜 여기 있는지 적혀 있다', MENU_GROUPS.every((g) => g.sub?.length > 4));

console.log('\n[ 칸마다 ]');
const ids = new Set(MENU_GROUPS.map((g) => g.id));
ok('모든 칸이 어딘가에 속한다', MENUS.every((m) => ids.has(m.group)),
  MENUS.filter((m) => !ids.has(m.group)).map((m) => m.id).join() || '전부 속함');
ok('id가 안 겹친다', new Set(MENU_IDS).size === MENU_IDS.length);
ok('이름과 설명이 다 있다', MENUS.every((m) => m.label && m.sub && m.icon));

/* ★ 목록은 한 곳에만 ★ 설정에 켜는 칸이 있는데 학습 탭에 없으면,
   켜도 아무 데도 안 뜨는 유령 칸이 된다 */
const defaults = Object.keys(DEFAULT_SETTINGS.menus);
ok('설정에 있는 칸은 학습 탭에도 있다',
  defaults.every((id) => MENU_IDS.includes(id)),
  defaults.filter((id) => !MENU_IDS.includes(id)).join() || '유령 없음');
ok('학습 탭에 있는 칸은 설정에도 있다',
  MENU_IDS.every((id) => defaults.includes(id)),
  MENU_IDS.filter((id) => !defaults.includes(id)).join() || '빠짐 없음');

console.log('\n[ 무엇이 어디에 ]');
const of = (g) => MENUS.filter((m) => m.group === g).map((m) => m.id);
/* 코스는 하나뿐이고 크다 — 이 앱의 목표 */
ok('JLPT N3 묶음에는 코스 하나', of('course').join() === 'n3');
ok('코스만 큰 칸', MENUS.filter((m) => m.big).map((m) => m.id).join() === 'n3');
/* 콘텐츠 종류 — 「학습 → 단어 / 문법 / 한자 / 문장 / 듣기」 */
ok('★ 콘텐츠는 단어 · 문법 · 한자 · 문장 · 듣기 · 영상 ★',
  of('content').join() === 'words,grammar,kanji,sentences,listen,videos', of('content').join());
ok('한자 칸이 있다 (N3 코스의 한자 과정)', MENUS.find((m) => m.id === 'kanji')?.label === '한자');
ok('듣기가 학습 탭 안에 있다 (탭이 아니다)', MENUS.find((m) => m.id === 'listen')?.label === '듣기');
ok('연습은 시험 · 활용 · 부사 · 짝 · 실전',
  of('practice').join() === 'quiz,conjugate,adverb,match,rpg', of('practice').join());
ok('그 밖에는 완전기초 · 독일어', of('etc').join() === 'basics,swiss');
/* ★ 행동은 학습 탭에 없다 ★ 회독 학습·약점 복습은 복습 탭으로 갔다 */
ok('회독 학습·약점 복습은 학습 탭에 없다 (복습 탭에)', !MENU_IDS.includes('repeat') && !MENU_IDS.includes('weak'));
ok('JLPT 단어는 더 이상 따로 없다', !MENU_IDS.includes('jlpt'));
ok('번역기는 학습 탭에 없다', !MENU_IDS.includes('translate'));
ok('문법은 하나로 열린다', MENUS.find((m) => m.id === 'grammar')?.label === '문법');

console.log('\n[ 켠 것만 묶어서 ]');
const all = Object.fromEntries(MENU_IDS.map((id) => [id, true]));
const g = groupedMenus(all);
ok('다 켜면 네 묶음이 다 나온다', g.length === 4);
ok('묶음 순서가 지켜진다', g.map((x) => x.id).join() === 'course,content,practice,etc');
ok('칸 수가 맞는다', g.reduce((a, x) => a + x.items.length, 0) === MENUS.length);

const some = groupedMenus({ quiz: true });
ok('빈 묶음은 안 그린다', some.length === 1 && some[0].id === 'practice',
  some.map((x) => x.id).join());
ok('아무것도 안 켜면 빈손', groupedMenus({}).length === 0);
/* 없어진 메뉴가 설정에 남아 있어도 안 뜬다 — 목록이 이 파일 하나로 정해진다 */
ok('없는 메뉴는 켜져 있어도 안 뜬다',
  groupedMenus({ jlpt: true, repeat: true, weak: true }).length === 0);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
