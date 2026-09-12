/* 백업과 복원.
 *
 * ★ 이 모듈에 검사가 하나도 없었다 ★
 *
 * 저장을 전부 담당하는 곳인데 검사가 없어서, 아래 세 가지가 조용히 살아남았다.
 *
 *   · 「전체 백업」이 스무 개 칸 중 일곱 개만 담았다. 담아 둔 영상, 붙여넣은
 *     자막, 영상 진도, 번역, 물어본 것, 요즘 일본어, 오늘 계획이 빠졌다.
 *   · settings를 통째로 담아서 음성·AI API 키가 백업 파일에 평문으로 들어갔다.
 *     백업은 메일로 보내고 드라이브에 올리는 파일이다.
 *   · 복원이 write()의 성공 여부를 한 번도 안 봤다. 저장 공간이 가득 찬 기기에서
 *     앞의 몇 개만 저장되고도 「복원했어요」가 떴다 — 사용자는 원본 파일을 지운다.
 *
 * localStorage를 흉내 내서 저장 실패까지 실제로 일으켜 본다. 성공 화면만 보고
 * 넘어가면 위 셋을 또 놓친다. */

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* ── localStorage 흉내 ──
   실패를 마음대로 일으킬 수 있어야 한다. failKeys에 든 키에 쓰면 던진다. */
const store = new Map();
const failKeys = new Set();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (failKeys.has(k)) {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    }
    store.set(k, String(v));
  },
  removeItem: (k) => { store.delete(k); },
};

/* 흉내를 깐 뒤에 불러와야 한다 — 모듈이 불릴 때 localStorage를 본다 */
const S = await import('../../src/lib/storage.js');

const K = {
  settings: 'jp_manabu_settings_v1',
  review: 'jp_manabu_review_v1',
  videos: 'jp_manabu_videos_v1',
  scripts: 'jp_manabu_video_scripts_v1',
  progress: 'jp_manabu_video_progress_v1',
  translations: 'jp_manabu_translations_v1',
  asks: 'jp_manabu_asks_v1',
  plan: 'jp_manabu_plan_v1',
  memos: 'jp_manabu_memos_v1',
  custom: 'jp_manabu_custom_words_v1',
  stats: 'jp_manabu_stats_v1',
};
const put = (k, v) => store.set(k, JSON.stringify(v));
const get = (k) => { const r = store.get(k); return r == null ? null : JSON.parse(r); };
const reset = () => { store.clear(); failKeys.clear(); };

/* 사용자가 실제로 쌓아 둔 자료를 심는다 */
function seed() {
  reset();
  put(K.settings, {
    goals: { fresh: 20, review: 20, weak: 20 },
    levels: ['N5'],
    gttsKey: 'SECRET-TTS-KEY',
    geminiKey: 'SECRET-AI-KEY',
  });
  put(K.review, { 'n5-0001': { level: 2, due: '2026-09-20' } });
  put(K.videos, [{ id: 'v1', title: '영상 하나' }]);
  put(K.scripts, { v1: '자막 본문' });
  put(K.progress, { v1: { at: 12 } });
  put(K.translations, [{ jp: 'これ', ko: '이것' }]);
  put(K.asks, [{ q: '왜?', a: '그래서' }]);
  put(K.plan, { date: '2026-09-12', assigned: [{ id: 'n5-0001' }], done: {} });
  put(K.memos, { 'n5-0001': { text: '연상법' } });
  put(K.custom, [{ id: 'my-1', kanji: '私' }]);
  put(K.stats, { '2026-09-12': { judged: 3 } });
}

console.log('\n[ ★ 전체 백업은 사용자 자료를 다 담는다 ★ ]');
{
  seed();
  const b = S.exportBackup();
  const d = b.data;
  ok('담아 둔 영상', Array.isArray(d.videos) && d.videos.length === 1, JSON.stringify(d.videos));
  ok('붙여넣은 자막', d.videoScripts?.v1 === '자막 본문');
  ok('영상 학습 진도', d.videoProgress?.v1?.at === 12);
  ok('받아 둔 번역', d.translations?.length === 1);
  ok('물어본 것', d.asks?.length === 1);
  ok('오늘의 계획', d.plan?.date === '2026-09-12');
  ok('회독 기록', d.review?.['n5-0001']?.level === 2);
  ok('단어 메모', d.memos?.['n5-0001']?.text === '연상법');
  ok('내가 넣은 단어', d.customWords?.length === 1);
  ok('일별 활동 기록', Boolean(d.stats?.['2026-09-12']));
}

console.log('\n[ ★ 비밀값은 백업 파일에 안 들어간다 ★ ]');
{
  seed();
  const b = S.exportBackup();
  const text = JSON.stringify(b);
  ok('★ 음성 API 키가 파일에 없다 ★', !text.includes('SECRET-TTS-KEY'));
  ok('★ AI API 키가 파일에 없다 ★', !text.includes('SECRET-AI-KEY'));
  ok('gttsKey 칸 자체가 없다', b.data.settings.gttsKey === undefined);
  ok('geminiKey 칸 자체가 없다', b.data.settings.geminiKey === undefined);
  /* 설정을 통째로 빼면 학습 범위·목표까지 잃는다. 뺄 것만 뺀다 */
  ok('나머지 설정은 그대로 담긴다', b.data.settings.levels?.[0] === 'N5');
  ok('목표도 그대로', b.data.settings.goals?.fresh === 20);
}

console.log('\n[ 무엇이 들어가고 무엇이 빠지는지 내보내기 전에 알 수 있다 ]');
{
  seed();
  const rows = S.backupContents(S.exportBackup());
  ok('항목마다 이름이 있다', rows.every((r) => r.label));
  ok('센 개수가 붙는다', rows.find((r) => r.key === 'videos')?.count === 1);
  ok('빠지는 것은 이유가 붙는다', S.BACKUP_EXCLUDED.every((x) => x.label && x.why));
  ok('API 키가 빠진다고 적혀 있다',
    S.BACKUP_EXCLUDED.some((x) => /키/.test(x.label)));
}

console.log('\n[ ★ 복원이 이 기기의 API 키를 지우지 않는다 ★ ]');
{
  /* 비밀값을 백업에서 뺐으니, 복원할 때 settings를 통째로 덮으면 이 기기에
     있던 키가 사라진다. 새는 곳을 막으려다 쓰던 기능을 끄면 안 된다. */
  seed();
  const b = S.exportBackup();
  S.importBackup(b);
  ok('★ 음성 키가 남아 있다 ★', get(K.settings).gttsKey === 'SECRET-TTS-KEY');
  ok('★ AI 키가 남아 있다 ★', get(K.settings).geminiKey === 'SECRET-AI-KEY');
  ok('백업의 다른 설정은 들어온다', get(K.settings).levels?.[0] === 'N5');
}

console.log('\n[ ★ 다 저장된 것을 확인하고서 성공이라고 한다 ★ ]');
{
  seed();
  const b = S.exportBackup();
  // 원래 기록을 알아볼 수 있게 바꿔 둔다
  put(K.review, { 'before-restore': { level: 9 } });
  put(K.videos, [{ id: 'before', title: '복원 전 영상' }]);
  const snapshot = { review: get(K.review), videos: get(K.videos) };

  // 영상 칸에서 저장이 막히게 한다 — 실제 기기의 용량 부족과 같은 상황
  failKeys.add(K.videos);
  let threw = null;
  try { S.importBackup(b); } catch (e) { threw = e; }

  ok('★ 실패를 성공이라고 하지 않는다 ★', threw !== null, threw?.message);
  ok('무엇을 해야 하는지 알려 준다', /저장 공간|되돌렸/.test(threw?.message || ''));
  /* ★ 반쯤 덮인 상태로 남기지 않는다 ★
     원래 기록도 아니고 백업도 아닌 칸이 제일 나쁘다 */
  ok('★ 회독 기록이 복원 전으로 돌아간다 ★',
    JSON.stringify(get(K.review)) === JSON.stringify(snapshot.review), JSON.stringify(get(K.review)));
  ok('★ 영상도 복원 전으로 돌아간다 ★',
    JSON.stringify(get(K.videos)) === JSON.stringify(snapshot.videos));
}

console.log('\n[ 되돌리기는 없던 칸을 지우는 것까지 한다 ]');
{
  seed();
  const b = S.exportBackup();
  // 이 기기에는 자막이 없던 상태로 만든다
  store.delete(K.scripts);
  failKeys.add(K.asks);
  try { S.importBackup(b); } catch { /* 실패를 기대한다 */ }
  /* 없던 칸에 백업 값을 썼다가 되돌릴 때는 「지우기」로 되돌려야 한다.
     기본값으로 되돌리면 없던 것이 생긴다. */
  ok('★ 없던 칸은 없던 채로 돌아간다 ★', store.has(K.scripts) === false,
    String(store.get(K.scripts)));
}

console.log('\n[ 옛 백업으로 복원해도 새 칸이 지워지지 않는다 ]');
{
  seed();
  /* v1 백업에는 영상·자막 칸이 아예 없었다. 그걸로 복원했다고 이 기기의
     영상이 사라지면, 옛 파일을 여는 것이 자료를 버리는 일이 된다. */
  const v1 = {
    format: S.BACKUP_FORMAT,
    version: 1,
    data: {
      customWords: [], progress: {}, settings: { levels: ['N4'] },
      streak: { count: 3, lastDate: '2026-09-11' },
      review: { 'n5-0002': { level: 1 } }, stats: {}, memos: {},
    },
  };
  S.importBackup(v1);
  ok('★ 담아 둔 영상이 남는다 ★', get(K.videos)?.length === 1, JSON.stringify(get(K.videos)));
  ok('★ 붙여넣은 자막이 남는다 ★', get(K.scripts)?.v1 === '자막 본문');
  ok('백업에 있던 것은 들어온다', get(K.review)?.['n5-0002']?.level === 1);
  ok('백업에 있던 설정도 들어온다', get(K.settings)?.levels?.[0] === 'N4');
}

console.log('\n[ 백업 파일이 아니면 받지 않는다 ]');
{
  seed();
  let threw = null;
  try { S.importBackup({ format: 'something-else', data: {} }); } catch (e) { threw = e; }
  ok('형식이 다르면 거절', threw !== null);
  threw = null;
  try { S.importBackup({ format: S.BACKUP_FORMAT, data: {} }); } catch (e) { threw = e; }
  ok('되돌릴 게 없으면 거절', threw !== null, threw?.message);
  ok('거절해도 지금 기록은 그대로', get(K.review)?.['n5-0001']?.level === 2);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
