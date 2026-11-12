/* 로그인한 채 한 초기화 · 복원이 다음 동기화에서 되돌아오지 않는다 — 오가는 요청을 가로채서 본다.
 *
 * 합치기가 합집합이라 서버에 있던 기록이 그대로 다시 내려왔다. 「이 계정은 이때 초기화했다」(progress.resetAt)를 적고,
 *   이 기기의 시각이 더 나중이면  서버 것과 합치지 않고 이 기기 것으로 바꿔 올린다
 *   서버의 시각이 더 나중이면     이 기기의 옛 기록을 버리고 서버 것을 받는다(이 계정과 맞춘 적 있는 기기만)
 * 다른 계정 · 처음 로그인한 기기에서는 평소대로 합친다(기록을 잃지 않게). */
import { syncNow, resetOrder } from '../../src/lib/sync.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const U = 'user-1';
const row = (over = {}) => ({ review: { old1: { box: 3, lastSeen: '2026-11-01' }, old2: { box: 2, lastSeen: '2026-11-02' } }, progress: { bookmarks: ['old1'] }, settings: {}, stats: { '2026-11-01': { studied: 9 } }, custom_words: [{ id: 'my-old', kanji: '猫' }], streak: { count: 9, lastDate: '2026-11-02' }, memos: { old1: { text: '옛 메모', at: '2026-11-01T00:00:00.000Z' } }, videos: {}, ...over });
const local = (over = {}) => ({ review: {}, progress: {}, settings: {}, stats: {}, streak: { count: 0, lastDate: null }, customWords: [], memos: {}, videos: {}, ...over });

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

console.log('\n[ 어느 쪽을 쓰나 ]');
{
  ok('이 기기에서 방금 초기화했다 → 바꿔 올린다', resetOrder(U, { resetAt: 5000, resetUser: U, syncUser: U }, { resetAt: 1000 }) === 'replace');
  ok('다른 기기에서 초기화했다 → 서버 것을 받는다', resetOrder(U, { syncUser: U }, { resetAt: 5000 }) === 'adopt');
  ok('시각이 같으면 평소대로 합친다', resetOrder(U, { resetAt: 5000, resetUser: U, syncUser: U }, { resetAt: 5000 }) === 'merge' && resetOrder(U, { syncUser: U }, {}) === 'merge');
  ok('★ 다른 계정에서 한 초기화는 이 계정을 덮지 않는다 ★', resetOrder(U, { resetAt: 9000, resetUser: 'someone-else', syncUser: 'someone-else' }, { resetAt: 0 }) === 'merge');
  ok('★ 처음 로그인한 기기(손님 기록)는 서버 것으로 갈아 끼우지 않고 합친다 ★', resetOrder(U, {}, { resetAt: 5000 }) === 'merge' && resetOrder(U, { syncUser: 'someone-else' }, { resetAt: 5000 }) === 'merge');
}

console.log('\n[ 로그인한 채 초기화 → 다음 동기화 ]');
{
  /* 초기화하면 이 기기는 비고, 진도에 초기화 시각만 남는다 */
  const merged = await run(local({ progress: { resetAt: 5000, resetUser: U } }), row());
  ok('★ 서버에 있던 회독 기록이 다시 내려오지 않는다 ★', Object.keys(merged.review).length === 0, JSON.stringify(Object.keys(merged.review)));
  ok('★ 내 단어 · 메모 · 연속 학습일 · 일별 기록도 안 내려온다 ★', merged.customWords.length === 0 && Object.keys(merged.memos).length === 0 && Object.keys(merged.stats).length === 0 && !merged.streak.count);
  ok('★ 서버 줄도 빈 기록으로 바뀐다 ★', Object.keys(posted.review).length === 0 && posted.custom_words.length === 0 && Object.keys(posted.memos).length === 0, JSON.stringify(Object.keys(posted.review)));
  ok('서버 줄에 초기화 시각이 올라간다(다른 기기가 본다)', posted.progress.resetAt === 5000 && posted.progress.resetUser === U && posted.progress.syncUser === U);
}

console.log('\n[ 다른 기기 — 옛 기록을 다시 올리지 않는다 ]');
{
  const stale = local({ review: { old1: { box: 3, lastSeen: '2026-11-01' }, old3: { box: 1, lastSeen: '2026-11-03' } }, progress: { syncUser: U, bookmarks: ['old1'] }, customWords: [{ id: 'my-old', kanji: '猫' }], memos: { old1: { text: '옛 메모', at: '2026-11-01T00:00:00.000Z' } }, stats: { '2026-11-03': { studied: 4 } } });
  const serverAfterReset = row({ review: { new1: { box: 1, lastSeen: '2026-11-12' } }, progress: { resetAt: 5000, resetUser: U, syncUser: U }, custom_words: [], memos: {}, stats: {}, streak: { count: 1, lastDate: '2026-11-12' } });
  const merged = await run(stale, serverAfterReset);
  ok('★ 이 기기의 옛 회독 기록이 서버로 다시 올라가지 않는다 ★', JSON.stringify(Object.keys(posted.review)) === '["new1"]', JSON.stringify(Object.keys(posted.review)));
  ok('★ 이 기기도 초기화된 뒤의 기록으로 맞춰진다 ★', JSON.stringify(Object.keys(merged.review)) === '["new1"]' && merged.customWords.length === 0 && Object.keys(merged.memos).length === 0 && merged.streak.count === 1);
  ok('초기화 시각을 이 기기도 갖게 된다(다음부터는 평소대로 합친다)', merged.progress.resetAt === 5000 && resetOrder(U, merged.progress, serverAfterReset.progress) === 'merge');
}

console.log('\n[ 평소 · 다른 계정 · 처음 로그인 ]');
{
  const mine = local({ review: { mine1: { box: 1, lastSeen: '2026-11-12' } }, progress: { syncUser: U } });
  const merged = await run(mine, row());
  ok('초기화가 없으면 예전처럼 합집합이다', ['mine1', 'old1', 'old2'].every((id) => merged.review[id]) && merged.customWords.length === 1);
  const guest = local({ review: { guest1: { box: 1, lastSeen: '2026-11-12' } } });
  const merged2 = await run(guest, row({ progress: { resetAt: 5000, resetUser: U } }));
  ok('★ 한 번 초기화했던 계정에 처음 로그인해도 손님 기록을 잃지 않는다 ★', Boolean(merged2.review.guest1) && Boolean(merged2.review.old1));
  const other = local({ review: { a1: { box: 1, lastSeen: '2026-11-12' } }, progress: { resetAt: 9000, resetUser: 'someone-else', syncUser: 'someone-else' } });
  const merged3 = await run(other, row());
  ok('★ 다른 계정에서 초기화했던 기기가 이 계정의 기록을 지우지 않는다 ★', Boolean(merged3.review.old1) && Boolean(posted.review.old1) && merged3.progress.resetAt === undefined, JSON.stringify([Object.keys(posted.review), merged3.progress.resetAt]));
  const first = await run(local({ review: { n1: { box: 1 } } }), null);
  ok('서버에 줄이 없는 첫 동기화도 그대로 된다', Boolean(first.review.n1) && posted.progress.syncUser === U);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
