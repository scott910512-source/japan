/* 영상 동기화 합치기 — 되살아나지 않는지가 핵심. */
import { mergeVideos } from '../../src/lib/merge.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };
const ids = (r) => r.list.map((v) => v.id).join(',');

// 두 기기가 각자 담은 영상은 둘 다 남는다
{
  const r = mergeVideos(
    { list: [{ id: 'A', addedAt: 100 }] },
    { list: [{ id: 'B', addedAt: 200 }] },
  );
  ok('양쪽 영상이 다 남음', ids(r) === 'A,B', ids(r));
}

// 한쪽에서 뺀 영상은 되살아나지 않는다
{
  const r = mergeVideos(
    { list: [], removed: { A: 500 } },
    { list: [{ id: 'A', addedAt: 100 }], scripts: { A: '자막' }, analyses: { A: { at: 9 } } },
  );
  ok('뺀 영상이 안 돌아옴', ids(r) === '', ids(r));
  ok('그 자막도 안 돌아옴', !r.scripts.A);
  ok('그 설명도 안 돌아옴', !r.analyses.A);
  ok('묘비는 남겨 둠', r.removed.A === 500);
}

// 뺐다가 다시 담으면 살아난다
{
  const r = mergeVideos(
    { list: [{ id: 'A', addedAt: 900 }], removed: { A: 500 } },
    { list: [], removed: { A: 500 } },
  );
  ok('다시 담으면 살아남', ids(r) === 'A', ids(r));
}

// 되돌아온 묘비가 나중 것이면 다시 지운다
{
  const r = mergeVideos(
    { list: [{ id: 'A', addedAt: 100 }] },
    { list: [], removed: { A: 300 } },
  );
  ok('다른 기기에서 뺀 게 반영됨', ids(r) === '', ids(r));
}

// 자막: 지금 기기 것을 남기고, 없는 쪽은 상대 것을 가져온다
{
  const r = mergeVideos(
    { list: [{ id: 'A', addedAt: 1 }, { id: 'B', addedAt: 2 }], scripts: { A: '내 자막' } },
    { list: [{ id: 'A', addedAt: 1 }, { id: 'B', addedAt: 2 }], scripts: { A: '서버 자막', B: '서버 B' } },
  );
  ok('내 자막이 이김', r.scripts.A === '내 자막', r.scripts.A);
  ok('없던 자막은 받아옴', r.scripts.B === '서버 B', r.scripts.B);
}

// 설명: 나중에 만든 것을 남긴다
{
  const r = mergeVideos(
    { list: [{ id: 'A', addedAt: 1 }], analyses: { A: { tag: 'old', at: 10 } } },
    { list: [{ id: 'A', addedAt: 1 }], analyses: { A: { tag: 'new', at: 20 } } },
  );
  ok('나중 설명이 남음', r.analyses.A.tag === 'new', r.analyses.A.tag);
  const r2 = mergeVideos(
    { list: [{ id: 'A', addedAt: 1 }], analyses: { A: { tag: 'new', at: 30 } } },
    { list: [{ id: 'A', addedAt: 1 }], analyses: { A: { tag: 'old', at: 20 } } },
  );
  ok('내 것이 나중이면 내 것', r2.analyses.A.tag === 'new', r2.analyses.A.tag);
  const r3 = mergeVideos(
    { list: [{ id: 'A', addedAt: 1 }] },
    { list: [{ id: 'A', addedAt: 1 }], analyses: { A: { tag: 'srv', at: 20 } } },
  );
  ok('없던 설명은 받아옴', r3.analyses.A.tag === 'srv');
}

// 진도: 앞선 쪽, 마침은 지우지 않는다
{
  const r = mergeVideos(
    { list: [{ id: 'A', addedAt: 1 }], progress: { A: { scriptStep: 8, step: 0 } } },
    { list: [{ id: 'A', addedAt: 1 }], progress: { A: { scriptStep: 3, scriptDone: true, step: 5 } } },
  );
  ok('자막 진도는 앞선 쪽', r.progress.A.scriptStep === 8, String(r.progress.A.scriptStep));
  ok('설명 진도도 앞선 쪽', r.progress.A.step === 5, String(r.progress.A.step));
  ok('마쳤다는 표시는 안 지움', r.progress.A.scriptDone === true);
}

// 두 번 합쳐도 결과가 안 변한다 (재동기화로 불어나면 안 된다)
{
  const local = { list: [{ id: 'A', addedAt: 1 }], removed: { B: 9 }, scripts: { A: 'x' } };
  const remote = { list: [{ id: 'B', addedAt: 5 }], scripts: { B: 'y' } };
  const once = mergeVideos(local, remote);
  const twice = mergeVideos(once, once);
  ok('두 번 합쳐도 같음', JSON.stringify(once) === JSON.stringify(twice));
}

// 빈 입력에도 안 터진다
{
  const r = mergeVideos(undefined, undefined);
  ok('빈 입력도 됨', ids(r) === '' && typeof r.scripts === 'object');
}

/* ── 자막만 넣은 것 ──
   넷플릭스는 영상을 못 붙여서 제목과 갈래가 그 항목의 전부다. 동기화가 그걸
   지우면 제목이 사라지고 유튜브 영상인 척하게 된다 — 섬네일을 부르다
   깨진 네모가 뜬다. */
{
  const sub = { id: 'sub-abc', addedAt: 100, kind: 'sub', title: '사랑은 비가 갠 뒤처럼 3화' };
  const m = mergeVideos({ list: [sub] }, { list: [] });
  ok('자막 항목의 제목이 남는다', m.list[0].title === sub.title, m.list[0].title);
  ok('갈래도 남는다', m.list[0].kind === 'sub', m.list[0].kind);

  const both = mergeVideos({ list: [sub] }, { list: [{ id: 'sub-abc', addedAt: 200 }] });
  ok('한쪽에 칸이 없어도 안 지워진다', both.list[0].title === sub.title && both.list[0].kind === 'sub',
    JSON.stringify(both.list[0]));
  ok('담은 시각은 늦은 쪽', both.list[0].addedAt === 200, String(both.list[0].addedAt));

  const yt = mergeVideos({ list: [{ id: 'abc', addedAt: 1 }] }, { list: [] });
  ok('유튜브 항목에는 갈래가 안 붙는다', yt.list[0].kind === undefined, JSON.stringify(yt.list[0]));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
