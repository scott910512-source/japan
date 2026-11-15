/* 기기 기록 묶음(extra)이 진도 칸에 실려 오가는 길 — 오가는 요청을 가로채서 본다 */
import { syncNow } from '../../src/lib/sync.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };
const U = 'user-1';
const vids = { list: [], removed: {}, scripts: {}, analyses: {}, progress: {}, stories: { list: [], removed: {} } };
const local = (over = {}) => ({ review: {}, progress: { syncUser: U }, settings: {}, stats: {}, streak: { count: 0, lastDate: null }, customWords: [], memos: {}, videos: vids, ...over });
const row = (over = {}) => ({ review: {}, progress: { syncUser: U }, settings: {}, stats: {}, custom_words: [], streak: { count: 0, lastDate: null }, memos: {}, videos: vids, ...over });
const bag = (plan, at) => ({ v: 1, whole: { plan: { at, v: plan } }, lists: {} });

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

const m1 = await run(local({ extra: bag({ done: 3 }, 100) }), row());
ok('★ 이 기기의 묶음이 진도 칸에 실려 올라간다 ★', posted?.progress?.extra?.whole?.plan?.v?.done === 3, JSON.stringify(posted?.progress?.extra));
ok('화면의 진도 상태에는 묶음이 안 섞인다', m1.progress.extra === undefined && m1.extra?.whole?.plan?.v?.done === 3);

const m2 = await run(local({ extra: bag(null, 0) }), row({ progress: { syncUser: U, extra: bag({ done: 7 }, 500) } }));
ok('★ 서버 묶음이 내려온다(새 기기의 빈 칸이 안 지운다) ★', m2.extra?.whole?.plan?.v?.done === 7 && posted?.progress?.extra?.whole?.plan?.v?.done === 7);
ok('서버 진도에 실린 묶음은 진도 합치기에 안 섞인다', m2.progress.extra === undefined);

const m3 = await run(local({ extra: bag({ done: 9 }, 900) }), row({ progress: { syncUser: U, extra: bag({ done: 7 }, 500) } }));
ok('나중에 바뀐 쪽이 이긴다', m3.extra.whole.plan.v.done === 9);

await run(local({ extra: bag({ done: 1 }, 100) }), row({ progress: { syncUser: U, extra: bag({ done: 7 }, 500) } }));
ok('영상 칸은 그대로면 다시 안 올린다(묶음이 바뀌어도)', posted && !('videos' in posted), Object.keys(posted || {}).join(','));

console.log(`\n통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
