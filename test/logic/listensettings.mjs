/* 듣기 설정 표.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 설정 열두 개가 각자 다른 규칙으로 읽히고 있었다 — 「기본 켬」은
 * !== false, 「기본 끔」은 === true, 숫자는 || 기본값. 한 번 틀리면 기본값이
 * 뒤집히는데, 그게 눈에 띄는 데 한참 걸린다. 「끝에 한 번 더」가 저절로
 * 켜져 있으면 한 장에 드는 시간이 늘어나는데 그 이유를 아무도 모른다.
 *
 * 그리고 저장 키는 못 바꾼다. 쓰던 사람 기기에 그 이름으로 적혀 있어서,
 * 바꾸면 고른 것이 전부 기본값으로 돌아간다. 그 이름들을 여기 박아 둔다 —
 * 이름을 「예쁘게」 고치려는 손을 검사가 막는다. */
import {
  LISTEN_SETTINGS, listenBlocksPatch, listenPatch,
  readListen, readListenAll, readListenBlocks, readListenDropped,
} from '../../src/lib/listenSettings.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ ★ 저장 키는 바뀌면 안 된다 ★ ]');
{
  /* 기기에 이 이름으로 적혀 있다. 하나라도 바뀌면 그 사람이 고른 것이
     기본값으로 돌아간다 — 방향도, 개수도, 켜 둔 것도 전부. */
  const want = {
    direction: 'listenDir', scope: 'listenScope', order: 'listenOrder',
    count: 'listenCount', gap: 'listenGap',
    sayKo: 'listenSayKo', sayAnswer: 'listenSayAnswer', recap: 'listenRecap',
    showYomi: 'listenShowYomi', skipDone: 'listenSkipDone',
    loop: 'listenLoop', reshuffle: 'listenReshuffle',
  };
  for (const [name, key] of Object.entries(want)) {
    ok(`${name} → ${key}`, LISTEN_SETTINGS[name]?.key === key, LISTEN_SETTINGS[name]?.key);
  }
  ok('표에 그 열둘뿐 — 모르는 칸이 없다',
    Object.keys(LISTEN_SETTINGS).length === Object.keys(want).length,
    Object.keys(LISTEN_SETTINGS).join(' · '));
}

console.log('\n[ ★ 기본값이 뒤집히지 않는다 ★ ]');
{
  const d = readListenAll({});
  ok('빈손이면 일본어 → 뜻', d.direction === 'jp-ko');
  ok('빈손이면 오늘 배운 것', d.scope === 'today');
  ok('빈손이면 구간별', d.order === 'block');
  ok('빈손이면 20개', d.count === 20);
  ok('빈손이면 2초 간격', d.gap === 2);

  /* 기본 켬 셋 — 화면을 못 보는 자리라 뜻도 소리로 나와야 하고, 소리를
     외우는 일은 여러 번 마주쳐야 되는 일이라 반복은 켜져 있어야 한다. */
  ok('★ 뜻도 소리로 — 기본 켬 ★', d.sayKo === true);
  ok('★ 답도 소리로 — 기본 켬 ★', d.sayAnswer === true);
  ok('★ 끝까지 반복 — 기본 켬 ★', d.loop === true);
  ok('★ 순서 섞기 — 기본 켬 ★', d.reshuffle === true);

  /* 기본 끔 셋 — 켜면 한 장이 길어지거나, 듣는 자리가 읽는 자리가 된다. */
  ok('★ 끝에 한 번 더 — 기본 끔 ★', d.recap === false);
  ok('★ 읽는 법 보기 — 기본 끔 ★', d.showYomi === false);
  ok('★ 외운 건 빼기 — 기본 끔 ★', d.skipDone === false);
}

console.log('\n[ 껐다 켠 것이 그대로 읽힌다 ]');
{
  /* 기본 켬인 칸은 「명시적으로 false」만 끔으로 읽는다. undefined를 끔으로
     읽으면 새 칸이 생길 때마다 아무도 안 끈 것이 꺼져 있다. */
  ok('뜻도 소리로 — 끈 것은 꺼져 있다', readListen({ listenSayKo: false }, 'sayKo') === false);
  ok('뜻도 소리로 — 안 건드린 것은 켜져 있다', readListen({}, 'sayKo') === true);
  ok('뜻도 소리로 — null도 켜진 것으로', readListen({ listenSayKo: null }, 'sayKo') === true);

  /* 기본 끔인 칸은 「명시적으로 true」만 켬으로 읽는다. 1이나 '예' 같은
     값이 들어와도 안 켜진다 — 저장이 깨져서 들어온 값이면 안 켜는 쪽이 맞다. */
  ok('끝에 한 번 더 — 켠 것만 켜진다', readListen({ listenRecap: true }, 'recap') === true);
  ok('끝에 한 번 더 — 1은 안 켜진다', readListen({ listenRecap: 1 }, 'recap') === false);

  ok('개수는 고른 값이 그대로', readListen({ listenCount: 100 }, 'count') === 100);
  ok('0이 들어오면 기본값 — 0개는 들을 게 없다',
    readListen({ listenCount: 0 }, 'count') === 20);
  ok('모르는 칸을 물으면 빈손', readListen({}, '헛것') === undefined);
  ok('설정이 없어도 안 죽는다', readListenAll().direction === 'jp-ko');
}

console.log('\n[ 바뀐 것을 기기에 적는 모양 ]');
{
  ok('한 칸만 적는다', JSON.stringify(listenPatch('gap', 5)) === '{"listenGap":5}');
  ok('참거짓도 그대로', JSON.stringify(listenPatch('loop', false)) === '{"listenLoop":false}');
  ok('모르는 칸은 아무것도 안 적는다',
    JSON.stringify(listenPatch('헛것', 1)) === '{}');
}

console.log('\n[ ★ 옛 설정과 호환 — 구간 ★ ]');
{
  /* 구간이 하나뿐이던 때의 설정(listenBlock)을 쓰던 사람이 업데이트하는
     순간 고른 자리가 사라지면 안 된다. */
  ok('★ 옛 한 칸 설정을 읽는다 ★',
    JSON.stringify(readListenBlocks({ listenBlock: 3 })) === '[3]');
  ok('새 목록이 있으면 그걸 쓴다',
    JSON.stringify(readListenBlocks({ listenBlocks: [0, 2], listenBlock: 3 })) === '[0,2]');
  ok('둘 다 없으면 첫 구간',
    JSON.stringify(readListenBlocks({})) === '[0]');
  ok('빈 목록은 못 쓴다 — 그러면 들을 게 없다',
    JSON.stringify(readListenBlocks({ listenBlocks: [] })) === '[0]');
  ok('설정이 아예 없어도 첫 구간',
    JSON.stringify(readListenBlocks()) === '[0]');

  /* ★ 적을 때는 둘 다 적는다 ★
     옛 버전으로 돌아가거나 다른 기기가 아직 안 올라갔을 때, 적어도 첫
     구간은 맞게 읽히게 한다. */
  const p = listenBlocksPatch([1, 4]);
  ok('★ 새 키와 옛 키를 같이 적는다 ★',
    JSON.stringify(p.listenBlocks) === '[1,4]' && p.listenBlock === 1,
    JSON.stringify(p));
  ok('빈손으로 적으려 하면 첫 구간으로',
    JSON.stringify(listenBlocksPatch([]).listenBlocks) === '[0]');
}

console.log('\n[ 뺀 낱말 ]');
{
  ok('목록을 그대로 읽는다',
    JSON.stringify(readListenDropped({ listenDropped: ['a', 'b'] })) === '["a","b"]');
  ok('없으면 빈 목록', JSON.stringify(readListenDropped({})) === '[]');
  ok('목록이 아닌 것이 들어와도 빈 목록 — 저장이 깨져도 듣기는 열린다',
    JSON.stringify(readListenDropped({ listenDropped: '헛것' })) === '[]');
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
