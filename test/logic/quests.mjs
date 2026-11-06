/* 오늘의 퀘스트 — 쭉 퀴즈 하루 몫 */
import { STREAM_QUEST_SIZE, questsOf, noteQuest, streamQuestState, mergeQuests, randomQuestState } from '../../src/lib/quests.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };
const T = '2026-11-03'; const Y = '2026-11-02';

console.log('\n[ 하루 몫 세기 ]');
{
  ok('몫은 스무 문제', STREAM_QUEST_SIZE === 20);
  ok('기록이 없으면 0', questsOf(undefined, T).stream === 0 && questsOf({}, T).stream === 0);
  ok('어제 것은 오늘 0', questsOf({ quests: { day: Y, stream: 8 } }, T).stream === 0);
  const a = noteQuest(undefined, 'stream', 1, T);
  ok('한 문제 풀면 1', a.day === T && a.stream === 1);
  ok('이어서 더해진다', noteQuest(a, 'stream', 3, T).stream === 4);
  ok('날이 바뀌면 새로 시작', noteQuest({ day: Y, stream: 9 }, 'stream', 1, T).stream === 1);
  ok('엉뚱한 값은 무시', noteQuest(a, 'stream', 0, T) === a && noteQuest(a, 'stream', -2, T) === a);
}

console.log('\n[ 퀘스트 상태 ]');
{
  const none = streamQuestState({}, true, T);
  ok('외운 게 있으면 0 / 20', none.done === 0 && none.total === 20 && !none.complete);
  ok('★ 외운 게 하나도 없으면 줄이 없다(채울 수 없는 몫) ★', streamQuestState({}, false, T) === null);
  ok('이미 푼 게 있으면 외운 게 없어도 보인다', streamQuestState({ quests: { day: T, stream: 3 } }, false, T).done === 3);
  const mid = streamQuestState({ quests: { day: T, stream: 7 } }, true, T);
  ok('7 / 20', mid.done === 7 && !mid.complete);
  const full = streamQuestState({ quests: { day: T, stream: 34 } }, true, T);
  ok('★ 스무 문제를 넘겨도 20 / 20으로 센다 ★', full.done === 20 && full.complete);
}

console.log('\n[ 기기 합치기 ]');
{
  const a = { day: T, stream: 6 }; const b = { day: T, stream: 9 };
  ok('★ 같은 날이면 큰 쪽(더하지 않는다) ★', mergeQuests(a, b).stream === 9 && mergeQuests(b, a).stream === 9);
  ok('날이 다르면 나중 날', mergeQuests({ day: Y, stream: 10 }, a).day === T);
  ok('한쪽이 없으면 다른 쪽', mergeQuests(undefined, a) === a && mergeQuests(a, undefined) === a);
}

console.log('\n[ 오늘 랜덤 테스트 ]');
{
  ok('볼 낱말이 없고 안 봤으면 줄이 없다', randomQuestState({}, false, T) === null);
  const open = randomQuestState({}, true, T);
  ok('볼 수 있으면 0 / 1', open.done === 0 && open.total === 1 && !open.complete);
  const done = randomQuestState({ quests: { day: T, random: 1 } }, false, T);
  ok('★ 한 번 봤으면 낱말이 모자라도 「마쳤어요」로 보인다 ★', done.done === 1 && done.complete);
  ok('어제 본 건 오늘 0', randomQuestState({ quests: { day: Y, random: 1 } }, true, T).done === 0);
  ok('noteQuest로 적으면 stream은 그대로', noteQuest({ day: T, stream: 5 }, 'random', 1, T).stream === 5
    && noteQuest({ day: T, stream: 5 }, 'random', 1, T).random === 1);
  ok('같은 날 합칠 때 random도 큰 쪽', mergeQuests({ day: T, random: 0 }, { day: T, random: 1 }).random === 1);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
