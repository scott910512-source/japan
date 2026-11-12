/* 설정은 칸마다 나중에 바꾼 쪽이 이긴다.
 *
 * 전에는 「이 기기 값이 언제나 이긴다」였다. 모든 칸에 기본값이 있어서, 새 기기에서 로그인하면 계정의 설정이 하나도
 * 안 내려오고 기본값이 계정을 덮었다 — 가타카나 질문이 다시 나오고, 기기끼리 설정이 영영 안 맞았다. */
import { mergeSettingsByTime, stampSettings, applySyncedSettings, pickSyncedSettings } from '../../src/lib/merge.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };
const DEF = { onboarded: false, canReadKana: null, levels: ['N5'], goalLevel: 'N4', goals: { fresh: 20, review: 30, weak: 3 }, menus: { words: true, n3: true, speak: true }, quizCount: 20, gttsKey: '', geminiKey: '' };

console.log('\n[ 새 기기에서 로그인 ]');
{
  const account = { onboarded: true, canReadKana: true, levels: ['N4', 'N3'], goalLevel: 'N3', goals: { fresh: 10, review: 20, weak: 3 }, hunterGuide: 'killua' };   // 시각이 없는 옛 계정
  const fresh = { ...DEF };
  const m = mergeSettingsByTime(fresh, account, DEF);
  ok('★ 계정의 설정이 내려온다(처음 화면 다시 안 묻는다) ★', m.onboarded === true && m.canReadKana === true, JSON.stringify([m.onboarded, m.canReadKana]));
  ok('★ 레벨 · 목표도 계정 것이다(기본값이 계정을 덮지 않는다) ★', m.levels.join() === 'N4,N3' && m.goalLevel === 'N3' && m.goals.fresh === 10);
  ok('기본값이 없는 칸(길잡이)도 내려온다', m.hunterGuide === 'killua');
  ok('계정에 없는 칸은 이 기기 값을 쓴다', m.quizCount === 20);
  ok('키는 실리지 않는다', !('gttsKey' in m) && !('geminiKey' in m));
  /* 새 기기에서 로그인 전에 레벨만 바꿨다 */
  const touched = stampSettings(fresh, { ...fresh, levels: ['N3'] }, 5000);
  const m2 = mergeSettingsByTime(touched, account, DEF);
  ok('로그인 전에 이 기기에서 바꾼 칸은 그 값이 남고, 나머지는 계정 것', m2.levels.join() === 'N3' && m2.goalLevel === 'N3' && m2.onboarded === true);
}

console.log('\n[ 기기 두 대 — 나중에 바꾼 쪽 ]');
{
  const a = stampSettings({ ...DEF }, { ...DEF, goalLevel: 'N3' }, 1000);
  const b = stampSettings({ ...DEF }, { ...DEF, goalLevel: 'N5' }, 2000);
  ok('★ 나중에 바꾼 쪽이 이긴다 ★', mergeSettingsByTime(a, b, DEF).goalLevel === 'N5' && mergeSettingsByTime(b, a, DEF).goalLevel === 'N5');
  ok('시각도 같이 올라간다', mergeSettingsByTime(a, b, DEF).settingsAt.goalLevel === 2000);
  ok('★ 일부러 기본값으로 되돌린 것도 나중이면 이긴다 ★', mergeSettingsByTime(stampSettings(a, { ...a, goalLevel: 'N4' }, 3000), b, DEF).goalLevel === 'N4');
  const legacy = { ...DEF, goalLevel: 'N3' };                         // 시각이 없는 옛 값
  ok('한쪽만 시각이 있으면 그쪽', mergeSettingsByTime(legacy, b, DEF).goalLevel === 'N5' && mergeSettingsByTime(b, legacy, DEF).goalLevel === 'N5');
  ok('둘 다 시각이 없고 둘 다 기본값이 아니면 예전처럼 이 기기 값', mergeSettingsByTime(legacy, { goalLevel: 'N5' }, DEF).goalLevel === 'N3');
  const m = mergeSettingsByTime(a, b, DEF);
  ok('몇 번 합쳐도 같다', JSON.stringify(mergeSettingsByTime(m, b, DEF)) === JSON.stringify(m) && JSON.stringify(mergeSettingsByTime(m, a, DEF)) === JSON.stringify(m));
}

console.log('\n[ 바꾼 시각 찍기 ]');
{
  const s0 = { ...DEF };
  ok('바뀐 게 없으면 받은 그대로', stampSettings(s0, s0, 9) === s0 && stampSettings(s0, { ...s0 }, 9).settingsAt === undefined);
  const s1 = stampSettings(s0, { ...s0, quizCount: 10, speechRate: 0.8 }, 700);
  ok('동기화하는 칸이 바뀌면 그 칸에만 시각을 찍는다', s1.settingsAt.quizCount === 700 && Object.keys(s1.settingsAt).length === 1);
  ok('기기마다 다른 설정(음성 속도 · 키)은 안 찍는다', stampSettings(s0, { ...s0, speechRate: 0.8, geminiKey: 'x' }, 700).settingsAt === undefined);
  ok('꾸러미(목표) 안이 바뀌어도 찍는다', stampSettings(s0, { ...s0, goals: { ...s0.goals, fresh: 5 } }, 800).settingsAt.goals === 800);
  ok('올리는 칸에 시각이 들어 있다', pickSyncedSettings(s1).settingsAt.quizCount === 700);
}

console.log('\n[ 합친 설정을 이 기기에 얹기 ]');
{
  const snapshot = { ...DEF };                                         // 요청을 보낼 때의 설정
  const merged = mergeSettingsByTime(snapshot, { onboarded: true, levels: ['N3'], settingsAt: { levels: 4000 } }, DEF);
  const applied = applySyncedSettings(snapshot, merged, snapshot, DEF);
  ok('받은 값이 얹힌다', applied.onboarded === true && applied.levels.join() === 'N3');
  ok('★ 받은 칸은 「이 기기에서 바꾼 것」으로 다시 찍히지 않는다 ★', stampSettings(snapshot, applied, 9999) === applied, JSON.stringify(stampSettings(snapshot, applied, 9999).settingsAt));
  ok('받은 칸의 시각은 서버 것(없던 옛 값은 1)', applied.settingsAt.levels === 4000 && applied.settingsAt.onboarded === 1);
  /* 요청이 오가는 사이에 이 기기에서 레벨을 바꿨다 */
  const during = stampSettings(snapshot, { ...snapshot, levels: ['N4'] }, 6000);
  const kept = applySyncedSettings(during, merged, snapshot, DEF);
  ok('★ 요청을 보낸 뒤에 바꾼 칸은 덮지 않는다 ★', kept.levels.join() === 'N4' && kept.settingsAt.levels === 6000 && kept.onboarded === true);
  ok('새로 생긴 메뉴는 켜진 채로 남는다', applySyncedSettings(snapshot, { menus: { words: false } }, snapshot, DEF).menus.speak === true);
  ok('키는 건드리지 않는다', applySyncedSettings({ ...snapshot, geminiKey: 'mine' }, merged, { ...snapshot, geminiKey: 'mine' }, DEF).geminiKey === 'mine');
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
