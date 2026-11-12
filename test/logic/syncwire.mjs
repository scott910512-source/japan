/* 영상이 진짜로 계정(서버)에 올라가는지 — 오가는 요청을 가로채서 본다. */
import { syncNow, pushKeyEnvelope, VIDEO_COLUMN_SQL } from '../../src/lib/sync.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const LOCAL = {
  review: { 'w-1': { box: 2, lastSeen: '2026-08-16' } },
  progress: { bookmarks: ['w-1'] },
  settings: { levels: ['N5'], gttsKey: '비밀' },
  stats: {}, streak: { count: 3, lastDate: '2026-08-16' },
  customWords: [], memos: {},
  videos: {
    list: [{ id: 'vidAAAAAAAA', addedAt: 100 }],
    removed: { vidBBBBBBBB: 500 },
    scripts: { vidAAAAAAAA: '[0:05] 替え玉をお願いします。' },
    analyses: { vidAAAAAAAA: { words: [], at: 700 } },
    progress: { vidAAAAAAAA: { scriptStep: 1 } },
  },
};

const calls = [];
const run = async (handler) => {
  calls.length = 0;
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null });
    const r = handler(u, opt);
    return new Response(JSON.stringify(r.body ?? null), {
      status: r.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return syncNow('user-1', LOCAL);
};

// ── 정상: 영상 칸이 있는 서버 ──
{
  const merged = await run((u, opt) => {
    if ((opt.method || 'GET') === 'GET') {
      return { body: [{ review: {}, progress: {}, settings: {}, stats: {}, custom_words: [], streak: {}, memos: {}, videos: { list: [{ id: 'vidCCCCCCCC', addedAt: 300 }] } }] };
    }
    return { body: [] };
  });

  const get = calls.find((c) => c.method === 'GET');
  ok('내려받을 때 videos도 같이 요청함', get && decodeURIComponent(get.url).includes('videos'), decodeURIComponent(get?.url || '').split('select=')[1]?.slice(0, 80));

  const post = calls.find((c) => c.method === 'POST');
  ok('올릴 때 videos를 실음', post && post.body.videos !== undefined);
  const sent = post.body.videos;
  ok('담아 둔 영상이 올라감', sent.list.some((v) => v.id === 'vidAAAAAAAA'), JSON.stringify(sent.list.map((v) => v.id)));
  ok('서버에 있던 영상도 유지됨', sent.list.some((v) => v.id === 'vidCCCCCCCC'));
  ok('자막이 올라감', sent.scripts.vidAAAAAAAA.includes('替え玉'));
  ok('설명이 올라감', Boolean(sent.analyses.vidAAAAAAAA));
  ok('진도가 올라감', sent.progress.vidAAAAAAAA.scriptStep === 1);
  ok('뺀 기록(묘비)도 올라감', sent.removed.vidBBBBBBBB === 500);

  ok('암기 상태도 같이 올라감', post.body.review['w-1'] !== undefined);
  ok('음성 키는 안 올라감', !JSON.stringify(post.body.settings).includes('비밀'), JSON.stringify(post.body.settings));
  ok('합친 결과를 돌려줌', merged.videos.list.length === 2, String(merged.videos.list.length));
  ok('칸이 있으면 안내가 없음', merged.videoNote === null, String(merged.videoNote));
}

// ── 서버 줄에 키가 들어 있어도(옛 버전이 올린 것 · 손으로 고친 것) 받지도 다시 올리지도 않는다 ──
{
  const merged = await run((u, opt) => {
    if ((opt.method || 'GET') === 'GET') {
      return { body: [{ review: {}, progress: {}, settings: { goalLevel: 'N4', geminiKey: '서버의키', gttsKey: '서버의음성키', claudeKey: '서버의클로드키', aiProvider: 'claude' }, stats: {}, custom_words: [], streak: {}, memos: {}, videos: {} }] };
    }
    return { body: [] };
  });
  const post = calls.find((c) => c.method === 'POST');
  const sent = JSON.stringify(post.body.settings);
  ok('★ 서버 줄의 키를 평문으로 다시 올리지 않는다 ★', !sent.includes('서버의'), sent);
  ok('★ 서버 줄의 키가 이 기기 설정으로 내려오지 않는다 ★', !JSON.stringify(merged.settings).includes('서버의') && merged.settings.aiProvider === undefined, JSON.stringify(merged.settings));
  ok('동기화하는 설정은 그대로 내려온다', merged.settings.goalLevel === 'N4');

}

// ── videos 칸이 아직 없는 서버 ──
{
  const NOCOL = { message: "Could not find the 'videos' column of 'user_data' in the schema cache", code: 'PGRST204' };
  const merged = await run((u, opt) => {
    const method = opt.method || 'GET';
    const asked = decodeURIComponent(u).includes('videos');
    if (method === 'GET') {
      if (asked) return { status: 400, body: NOCOL };
      return { body: [{ review: {}, progress: {}, settings: {}, stats: {}, custom_words: [], streak: {}, memos: {} }] };
    }
    if (opt.body && JSON.parse(opt.body).videos !== undefined) return { status: 400, body: NOCOL };
    return { body: [] };
  });

  const posts = calls.filter((c) => c.method === 'POST');
  ok('영상을 빼고 다시 올림', posts.length === 2, String(posts.length));
  ok('두 번째에는 videos가 없음', posts[1] && posts[1].body.videos === undefined);
  ok('암기 상태는 그래도 올라감', posts[1].body.review['w-1'] !== undefined);
  ok('왜 영상이 빠졌는지 알려 줌', String(merged.videoNote).includes('SQL Editor'), merged.videoNote);
  ok('붙여넣을 SQL을 함께 줌', VIDEO_COLUMN_SQL.includes('add column if not exists videos'), VIDEO_COLUMN_SQL);
  ok('이 기기 영상은 그대로 살아 있음', merged.videos.list[0].id === 'vidAAAAAAAA');
}

// ── 진짜 오류는 삼키지 않는다 ──
{
  let threw = '';
  try {
    await run(() => ({ status: 401, body: { message: 'JWT expired' } }));
  } catch (e) { threw = e.message; }
  ok('권한 오류는 그대로 알림', threw.includes('로그아웃'), threw);
}

// ── 키 봉투만 올린다 — 이 기기의 기록을 합치지 않은 채 같이 올리지 않는다 ──
{
  calls.length = 0;
  globalThis.fetch = async (url, opt = {}) => {
    calls.push({ url: String(url), method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null });
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await pushKeyEnvelope('user-1', { v: 1, iv: 'x', data: 'y' });
  const post = calls.find((c) => c.method === 'POST');
  const keys = Object.keys(post?.body || {}).sort().join();
  ok('★ 봉투를 올릴 때 봉투와 사용자 칸만 보낸다(기록을 덮지 않는다) ★', keys === 'gtts_key_enc,user_id', keys);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
