/* 이야기 글이 계정으로 오가는 길 — 오가는 요청을 가로채서 본다.
 *   · 이야기는 영상 칸(videos)에 실려 올라가고, 다른 기기는 그 칸에서 받는다
 *   · 영상 칸이 서버 것과 내용이 같으면 그 칸은 다시 올리지 않는다(자막 · 이야기 글이 들어 있어 크다 —
 *     카드 한 장 넘길 때마다 다시 올릴 이유가 없다)
 *   · 지운 이야기는 다른 기기에서 되살아나지 않는다 */
import { syncNow, sameJson } from '../../src/lib/sync.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const U = 'user-1';
const story = (id, addedAt, extra = {}) => ({ id, title: `이야기 ${id}`, titleOrig: '', level: 'N5', source: '검사용', url: '', addedAt, sections: [{ title: '', titleKo: '', paras: [[{ jp: '今日は天気がいいです。', ko: '오늘은 날씨가 좋아요.' }]] }], ...extra });
const local = (over = {}) => ({ review: {}, progress: { syncUser: U }, settings: {}, stats: {}, streak: { count: 0, lastDate: null }, customWords: [], memos: {}, videos: { list: [], removed: {}, scripts: {}, analyses: {}, progress: {}, stories: { list: [], removed: {} } }, ...over });
const row = (over = {}) => ({ review: {}, progress: { syncUser: U }, settings: {}, stats: {}, custom_words: [], streak: { count: 0, lastDate: null }, memos: {}, videos: {}, ...over });

let posted = null;
const run = async (localData, remoteRow) => {
  posted = null;
  globalThis.fetch = async (url, opt = {}) => {
    const m = opt.method || 'GET';
    if (m === 'POST') { posted = JSON.parse(opt.body); posted = Array.isArray(posted) ? posted[0] : posted; }
    return new Response(JSON.stringify(m === 'GET' ? (remoteRow ? [remoteRow] : []) : []), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return syncNow(U, localData, { defaults: {} });
};
/* 서버의 jsonb는 열쇠 순서를 바꿔서 돌려준다 — 흉내 낸다 */
const reorder = (v) => (Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort((a, b) => a.length - b.length || a.localeCompare(b)).map((k) => [k, reorder(v[k])])) : v);

console.log('\n[ 같은 내용인지 ]');
{
  ok('열쇠 순서가 달라도 같은 내용이면 같다', sameJson({ a: 1, b: { c: [1, { d: 2, e: 3 }] } }, { b: { c: [1, { e: 3, d: 2 }] }, a: 1 }));
  ok('값이 다르면 다르다 · 배열 순서가 다르면 다르다', !sameJson({ a: 1 }, { a: 2 }) && !sameJson({ a: [1, 2] }, { a: [2, 1] }));
  ok('없는 값(undefined)은 열쇠가 없는 것과 같다', sameJson({ a: 1, b: undefined }, { a: 1 }));
  ok('한쪽이 없으면 같다고 하지 않는다(올려야 한다)', !sameJson(undefined, {}) && !sameJson({}, null) && !sameJson(undefined, undefined));
}

console.log('\n[ 불러온 기기 → 계정 ]');
let server;
{
  const merged = await run(local({ videos: { list: [], removed: {}, scripts: {}, analyses: {}, progress: {}, stories: { list: [story('a', 100)], removed: {} } } }), row());
  ok('★ 이야기가 영상 칸에 실려 올라간다 ★', posted.videos?.stories?.list?.length === 1 && posted.videos.stories.list[0].sections[0].paras[0][0].ko === '오늘은 날씨가 좋아요.');
  ok('합친 결과에도 그대로 있다', merged.videos.stories.list[0].id === 'a');
  server = row({ videos: reorder(posted.videos) });
}

console.log('\n[ 다른 기기(한 번도 안 불러옴) ]');
{
  const merged = await run(local(), server);
  ok('★ 계정에서 이야기를 받는다 ★', merged.videos.stories.list.length === 1 && merged.videos.stories.list[0].title === '이야기 a');
  ok('★ 서버 것과 같으니 영상 칸은 다시 올리지 않는다 ★', posted && !('videos' in posted), Object.keys(posted || {}).join(','));
  ok('나머지 칸은 평소대로 올린다', 'review' in posted && 'progress' in posted && 'settings' in posted);
}

console.log('\n[ 바뀐 게 없을 때 ]');
{
  const same = local({ videos: { list: [], removed: {}, scripts: {}, analyses: {}, progress: {}, stories: { list: [story('a', 100)], removed: {} } } });
  await run(same, server);
  ok('★ 글이 그대로면 영상 칸을 다시 올리지 않는다 ★', !('videos' in posted));
  await run(local({ videos: { ...same.videos, stories: { list: [story('a', 100), story('b', 200)], removed: {} } } }), server);
  ok('이야기를 하나 더 불러오면 그때는 올린다', posted.videos?.stories?.list?.length === 2);
  await run(same, null);
  ok('서버에 줄이 없으면(첫 동기화) 올린다', posted.videos?.stories?.list?.length === 1);
  await run(same, { ...server, videos: undefined, videoColumnMissing: true });
  ok('영상 칸을 못 읽었으면 같다고 치지 않는다', 'videos' in posted);
}

console.log('\n[ 지우기 ]');
{
  const merged = await run(local({ videos: { list: [], removed: {}, scripts: {}, analyses: {}, progress: {}, stories: { list: [], removed: { a: 500 } } } }), server);
  ok('★ 지운 이야기는 계정에서 다시 내려오지 않는다 ★', merged.videos.stories.list.length === 0);
  ok('★ 지운 표시가 계정으로 올라간다(다른 기기도 따라 지운다) ★', posted.videos?.stories?.removed?.a === 500 && posted.videos.stories.list.length === 0);
  const other = await run(local({ videos: { list: [], removed: {}, scripts: {}, analyses: {}, progress: {}, stories: { list: [story('a', 100)], removed: {} } } }), row({ videos: reorder(posted.videos) }));
  ok('★ 아직 갖고 있던 다른 기기에서도 사라진다 ★', other.videos.stories.list.length === 0);
}

console.log('\n[ 옛 버전이 올린 줄 ]');
{
  const merged = await run(local({ videos: { list: [], removed: {}, scripts: {}, analyses: {}, progress: {}, stories: { list: [story('a', 100)], removed: {} } } }), row({ videos: { list: [], removed: {}, scripts: {}, analyses: {}, progress: {} } }));
  ok('★ 서버 줄에 이야기 칸이 없어도 이 기기의 이야기는 남고, 다시 올라간다 ★', merged.videos.stories.list.length === 1 && posted.videos?.stories?.list?.length === 1);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
