/* 학습 탭의 짜임새.
 *
 * 탭이 넷(홈·학습·복습·내 학습)이 되면서 학습 탭의 뜻이 「무엇을 공부할지
 * 고르는 자리」로 좁혀졌다. 그래서 여기에는 콘텐츠 종류만 있다 — 행동(새로
 * 배우기·복습하기)은 홈과 복습 탭이 한다.
 *
 * 여기서 지키는 것은 하나다 — 목록이 한 곳에만 있어야 한다. 학습 탭과
 * 설정에 따로 적어 두면, 없앤 메뉴가 설정에는 남아서 켜도 아무 데도 안 뜨는
 * 칸이 생긴다. */
import { MENUS, MENU_GROUPS, MENU_IDS, groupedMenus, practiceOf,
  FAV_MAX, favMenus, isFav, toggleFav,
} from '../../src/lib/menu.js';
import { DEFAULT_SETTINGS } from '../../src/lib/storage.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 세 영역과 안에 든 연습 ]');
ok('묶음은 넷(학습 탭에 그리는 셋 + 안에 든 연습)', MENU_GROUPS.length === 4, MENU_GROUPS.map((g) => g.label).join(' / '));
/* 목표(코스)가 먼저, 그다음 무엇을(골라 학습), 곁가지(자료 더 보기). 연습은 단어·문법 안에 든다 */
ok('추천 경로 · 골라 학습 · 자료 더 보기 · (안에 든 연습)',
  MENU_GROUPS.map((g) => g.id).join() === 'course,pick,more,practice');
ok('★ 학습 탭에 그리는 묶음은 셋 ★', MENU_GROUPS.filter((g) => !g.inline).length === 3);
ok('연습 묶음만 안에 든다(inline)', MENU_GROUPS.filter((g) => g.inline).map((g) => g.id).join() === 'practice');
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
/* 추천 경로 — 코스 하나와 기출 단어.
   기출은 「무엇을 공부할까」가 아니라 「무엇부터 외울까」의 답이라 고르는
   줄이 아니라 여기 있다. 큰 칸은 여전히 코스뿐이다. */
ok('추천 경로는 코스와 기출', of('course').join() === 'n3,kiju', of('course').join());
ok('코스만 큰 칸', MENUS.filter((m) => m.big).map((m) => m.id).join() === 'n3');
ok('★ 골라 학습은 단어 · 문법 · 한자 · 문장 · 듣기 · 실전 연습 ★',
  of('pick').join() === 'words,grammar,kanji,sentences,listen,rpg', of('pick').join());
ok('한자 칸이 있다 (N3 코스의 한자 과정)', MENUS.find((m) => m.id === 'kanji')?.label === '한자');
ok('듣기가 학습 탭 안에 있다 (탭이 아니다)', MENUS.find((m) => m.id === 'listen')?.label === '듣기');
ok('★ 자료 더 보기는 여행 일본어 · 영상 · 완전기초 · 독일어 ★',
  of('more').join() === 'travel,videos,basics,swiss', of('more').join());
/* 연습은 학습 탭 최상위에 안 선다. 단어·문법 화면 안 「연습」 줄에 든다 */
ok('★ 연습은 시험 · 짝 맞추기 · 부사 연습 · 동사 활용 ★',
  of('practice').join() === 'quiz,match,adverb,conjugate', of('practice').join());
ok('안에 든 연습은 모두 열릴 화면(parent)이 있다',
  MENUS.filter((m) => m.group === 'practice').every((m) => m.parent === 'worddeck' || m.parent === 'grammar'));
ok('단어 연습은 단어 화면에', practiceOf('worddeck', Object.fromEntries(MENU_IDS.map((i) => [i, true]))).map((m) => m.id).join() === 'quiz,match,adverb');
ok('동사 활용은 문법 화면에', practiceOf('grammar', Object.fromEntries(MENU_IDS.map((i) => [i, true]))).map((m) => m.id).join() === 'conjugate');
ok('끈 연습은 줄에서도 빠진다', practiceOf('worddeck', { quiz: true, match: false }).map((m) => m.id).join() === 'quiz');
ok('모든 칸의 id가 그대로다(저장된 설정·즐겨찾기가 안 깨진다)',
  ['n3', 'kiju', 'words', 'grammar', 'kanji', 'sentences', 'listen', 'videos', 'quiz', 'conjugate', 'adverb', 'match', 'rpg', 'basics', 'travel', 'swiss']
    .every((id) => MENU_IDS.includes(id)) && MENU_IDS.length === 16);
/* ★ 행동은 학습 탭에 없다 ★ 회독 학습·약점 복습은 복습 탭으로 갔다 */
ok('회독 학습·약점 복습은 학습 탭에 없다 (복습 탭에)', !MENU_IDS.includes('repeat') && !MENU_IDS.includes('weak'));
ok('JLPT 단어는 더 이상 따로 없다', !MENU_IDS.includes('jlpt'));
ok('번역기는 학습 탭에 없다', !MENU_IDS.includes('translate'));
ok('문법은 하나로 열린다', MENUS.find((m) => m.id === 'grammar')?.label === '문법');

console.log('\n[ 켠 것만 묶어서 ]');
const all = Object.fromEntries(MENU_IDS.map((id) => [id, true]));
const g = groupedMenus(all);
ok('다 켜면 학습 탭 묶음은 셋', g.length === 3);
ok('묶음 순서가 지켜진다', g.map((x) => x.id).join() === 'course,pick,more');
ok('★ 연습은 학습 탭 바둑판에 안 그린다 ★', !g.some((x) => x.items.some((m) => m.group === 'practice')));
ok('칸 수가 맞는다(연습 넷은 화면 안으로)', g.reduce((a, x) => a + x.items.length, 0) === MENUS.length - 4);

const some = groupedMenus({ rpg: true });
ok('빈 묶음은 안 그린다', some.length === 1 && some[0].id === 'pick',
  some.map((x) => x.id).join());
ok('연습만 켜면 학습 탭에는 아무것도 안 그린다', groupedMenus({ quiz: true, conjugate: true }).length === 0);
ok('아무것도 안 켜면 빈손', groupedMenus({}).length === 0);
/* 없어진 메뉴가 설정에 남아 있어도 안 뜬다 — 목록이 이 파일 하나로 정해진다 */
ok('없는 메뉴는 켜져 있어도 안 뜬다',
  groupedMenus({ jlpt: true, repeat: true, weak: true }).length === 0);



console.log('\n[ ★ 바로가기 ★ ]');
{
  /* 묶음(콘텐츠·연습·그 밖에)은 「처음 오는 사람이 무엇이 있는지 알아보는」
     차례다. 그건 맞는데, 날마다 듣기와 기출만 쓰는 사람은 날마다 그 두 칸을
     찾아 내려가야 한다.
     자주 쓴 것이 저절로 올라오게 하면 눈 감고 누르던 자리가 매번 달라져서
     더 나쁘다 — 사람이 고른 것만, 고른 차례 그대로 맨 앞에 둔다. */
  const all = {};
  for (const id of MENU_IDS) all[id] = true;

  ok('여섯 개까지', FAV_MAX === 6);
  ok('처음엔 빈손', favMenus([], all).length === 0);

  const picked = favMenus(['listen', 'kiju', 'quiz'], all);
  ok('고른 것만 나온다', picked.length === 3, picked.map((m) => m.label).join(' · '));
  ok('★ 고른 차례 그대로 ★ — 앱이 다시 정렬하지 않는다',
    picked.map((m) => m.id).join() === 'listen,kiju,quiz');

  /* 설정에서 끈 메뉴는 바로가기에서도 안 보인다 — 껐는데 위에 남아 있으면
     끈 게 아니다. 즐겨찾기 자체는 안 지운다(다시 켜면 돌아온다). */
  const off = { ...all, kiju: false };
  ok('★ 끈 메뉴는 안 뜬다 ★', favMenus(['listen', 'kiju', 'quiz'], off).map((m) => m.id).join() === 'listen,quiz');
  ok('다시 켜면 돌아온다', favMenus(['listen', 'kiju', 'quiz'], all).length === 3);

  ok('없는 id는 버린다', favMenus(['listen', '헛것'], all).length === 1);
  ok('같은 걸 두 번 넣어도 한 번', favMenus(['listen', 'listen'], all).length === 1);
  ok('빈손이 와도 안 죽는다', favMenus(null, all).length === 0 && favMenus(undefined, undefined).length === 0);

  // 켜고 끄기
  ok('넣는다', toggleFav([], 'listen').join() === 'listen');
  ok('뒤에 붙는다 — 고른 차례가 곧 보이는 차례다',
    toggleFav(['listen'], 'kiju').join() === 'listen,kiju');
  ok('다시 누르면 뺀다', toggleFav(['listen', 'kiju'], 'listen').join() === 'kiju');
  ok('없는 메뉴는 안 넣는다', toggleFav([], '헛것').length === 0);

  /* 꽉 차면 받은 그대로 돌려준다 — 부르는 쪽이 「자리가 없다」로 읽고 알린다.
     조용히 안 넣으면 눌렀는데 아무 일도 안 일어나는 것처럼 보인다. */
  const full = MENU_IDS.slice(0, FAV_MAX);
  const same = toggleFav(full, MENU_IDS[FAV_MAX]);
  ok('★ 꽉 차면 그대로 돌려준다 ★', same === full, `${same.length}개`);
  ok('꽉 차도 빼는 건 된다', toggleFav(full, full[0]).length === FAV_MAX - 1);

  ok('isFav', isFav(['listen'], 'listen') === true && isFav(['listen'], 'kiju') === false);
  ok('isFav는 빈손에도 답한다', isFav(null, 'listen') === false);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
