/* 계정을 바꿔 로그인할 때 이 기기의 기록을 새 계정에 섞지 않는다 — lib/accountswitch.js */
import { ACCOUNT_DATA_KEYS, stashKeyOf, switchedFrom, switchAccountStorage, settingsForNewAccount, _resetSwitching, isSwitching } from '../../src/lib/accountswitch.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };
const mem = (init = {}, limit = Infinity) => {
  const d = new Map(Object.entries(init));
  return {
    d,
    getItem: (k) => (d.has(k) ? d.get(k) : null),
    setItem: (k, v) => { if (String(v).length > limit) throw new Error('QuotaExceededError'); d.set(k, String(v)); },
    removeItem: (k) => { d.delete(k); },
  };
};
const J = (o) => JSON.stringify(o);
const A = 'user-a'; const B = 'user-b';
const deviceA = () => ({
  jp_manabu_review_v1: J({ w1: { box: 3, lastSeen: '2026-11-14' } }),
  jp_manabu_progress_v1: J({ syncUser: A, quests: { day: '2026-11-15' } }),
  jp_manabu_streak_v1: J({ count: 9, lastDate: '2026-11-15' }),
  jp_manabu_plan_v1: J({ date: '2026-11-15' }),
  jp_manabu_stories_v1: J([{ id: 's1' }]),
  jp_nav_v1: J({ tab: 'me', sub: 'quiz' }),
  jp_manabu_settings_v1: J({ onboarded: true, goalLevel: 'N3', speechRate: 0.8, deviceVoiceURI: 'v-A', gttsKey: 'AIza-A', geminiKey: 'AQ.A', settingsAt: { goalLevel: 100 } }),
  jp_manabu_vault_v1: 'vault-of-b',
  jp_manabu_signed_in_v1: '1',
  jp_story_prefs_v1: J({ rate: 0.75 }),
});

console.log('\n[ 누구의 기록인가 ]');
ok('이 기기의 기록이 다른 계정 것이면 그 계정 id', switchedFrom({ syncUser: A }, B) === A);
ok('같은 계정이면 null', switchedFrom({ syncUser: A }, A) === null);
ok('★ 손님 기록(syncUser 없음)은 전처럼 첫 계정에 합친다 ★', switchedFrom({}, B) === null && switchedFrom(null, B) === null);

console.log('\n[ 처음 오는 계정으로 바꾸면 ]');
{
  _resetSwitching();
  const s = mem(deviceA());
  const r = switchAccountStorage(A, B, s, 1000);
  ok('옮기는 중 표시가 선다(다시 불러오기 전까지 동기화를 막는다)', isSwitching());
  ok('★ 이전 계정의 기록이 그 계정 보관함에 통째로 들어간다 ★', r.stashed && JSON.parse(s.getItem(stashKeyOf(A))).items.jp_manabu_review_v1 === deviceA().jp_manabu_review_v1);
  ok('보관함에 설정(키 포함)도 같이', JSON.parse(JSON.parse(s.getItem(stashKeyOf(A))).items.jp_manabu_settings_v1).gttsKey === 'AIza-A');
  ok('★ 이 기기의 학습 기록은 비운다(회독 · 진도 · 연속일 · 계획 · 이야기) ★', ['jp_manabu_review_v1', 'jp_manabu_progress_v1', 'jp_manabu_streak_v1', 'jp_manabu_plan_v1', 'jp_manabu_stories_v1'].every((k) => s.getItem(k) === null));
  ok('보던 화면(풀던 시험)도 지운다', s.getItem('jp_nav_v1') === null);
  const st = JSON.parse(s.getItem('jp_manabu_settings_v1'));
  ok('★ API 키는 빼서 새 계정에 안 올라간다 ★', !st.gttsKey && !st.geminiKey);
  ok('이 기기에만 있는 목소리 선택은 그대로', st.deviceVoiceURI === 'v-A');
  ok('★ 이전 계정의 학습 설정 · 처음 안내 답은 빼서 새 계정은 처음 안내부터 ★', st.goalLevel === undefined && st.onboarded === undefined);
  ok('★ 칸마다 바꾼 시각은 지운다(새 계정의 설정이 이긴다) ★', st.settingsAt === undefined);
  ok('금고 열쇠 · 로그인 표시 · 기기 취향은 그대로', s.getItem('jp_manabu_vault_v1') === 'vault-of-b' && s.getItem('jp_manabu_signed_in_v1') === '1' && s.getItem('jp_story_prefs_v1') !== null);
  ok('되살린 것은 없다', r.restored === false);

  console.log('\n[ 다시 이전 계정으로 돌아오면 ]');
  _resetSwitching();
  s.setItem('jp_manabu_review_v1', J({ w9: { box: 1 } }));          // 새 계정에서 공부한 것
  s.setItem('jp_manabu_progress_v1', J({ syncUser: B }));
  s.setItem('jp_manabu_settings_v1', J({ ...JSON.parse(s.getItem('jp_manabu_settings_v1')), gttsKey: 'AIza-B', speechRate: 1.1 }));
  const back = switchAccountStorage(B, A, s, 2000);
  ok('★ 새 계정의 기록은 그 계정 보관함으로 ★', JSON.parse(JSON.parse(s.getItem(stashKeyOf(B))).items.jp_manabu_review_v1).w9 !== undefined);
  ok('★ 이전 계정의 기록이 되살아난다(못 올린 것까지) ★', back.restored && s.getItem('jp_manabu_review_v1') === deviceA().jp_manabu_review_v1 && JSON.parse(s.getItem('jp_manabu_streak_v1')).count === 9);
  ok('★ 새 계정의 회독은 섞이지 않는다 ★', !JSON.parse(s.getItem('jp_manabu_review_v1')).w9);
  const st2 = JSON.parse(s.getItem('jp_manabu_settings_v1'));
  ok('★ 이전 계정의 키가 돌아온다(새 계정의 키가 아니다) ★', st2.gttsKey === 'AIza-A' && st2.geminiKey === 'AQ.A');
  ok('되살린 보관함은 지운다(두 번 되살리지 않는다)', s.getItem(stashKeyOf(A)) === null);
  ok('진도의 syncUser도 이전 계정 것으로 돌아온다', JSON.parse(s.getItem('jp_manabu_progress_v1')).syncUser === A);
}

console.log('\n[ 저장 공간이 모자라면 ]');
{
  _resetSwitching();
  const big = 'x'.repeat(5000);
  const init = { ...deviceA(), jp_manabu_video_scripts_v1: J({ v1: big }) };
  const s = mem(init, 4000);
  const r = switchAccountStorage(A, B, s, 1);
  const kept = JSON.parse(s.getItem(stashKeyOf(A)) || 'null');
  ok('★ 큰 것(영상 자막)을 빼고라도 학습 기록은 보관한다 ★', r.stashed && kept && kept.items.jp_manabu_review_v1 && !kept.items.jp_manabu_video_scripts_v1);
}

console.log('\n[ 설정 손질 ]');
ok('깨진 설정도 죽지 않는다', JSON.stringify(settingsForNewAccount('{x')) === '{}' && JSON.stringify(settingsForNewAccount(null)) === '{}');
ok('기록 칸 목록에 금고 열쇠 · 로그인 표시는 없다', !ACCOUNT_DATA_KEYS.includes('jp_manabu_vault_v1') && !ACCOUNT_DATA_KEYS.includes('jp_manabu_signed_in_v1'));
_resetSwitching();

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
