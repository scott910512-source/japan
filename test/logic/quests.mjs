/* 오늘의 퀘스트 — 쭉 퀴즈 하루 몫 */
import { STREAM_QUEST_SIZE, questsOf, noteQuest, streamQuestState, mergeQuests, randomQuestState, SENTENCE_QUEST_SIZE, planSentenceQuest, skipSentenceQuest, pickNewSentences, sentenceQuestState } from '../../src/lib/quests.js';

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

console.log('\n[ 문장 퀘스트 ]');
{
  ok('몫은 다섯 문장', SENTENCE_QUEST_SIZE === 5);
  const cards = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}` }));
  const review = { s0: { lastSeen: '2026-11-01' }, s2: { lastSeen: '2026-11-02' } };
  ok('★ 아직 안 본 문장만 고른다(본 것은 건너뛴다) ★', pickNewSentences(cards, review, 5).join() === 's1,s3,s4,s5,s6');
  ok('모자라면 있는 만큼', pickNewSentences(cards.slice(0, 3), review, 5).join() === 's1');
  ok('안 본 문장이 없고 시작도 안 했으면 줄이 없다', sentenceQuestState({}, {}, false, T) === null);
  const open = sentenceQuestState({}, {}, true, T);
  ok('시작 전: 0 / 5', open.done === 0 && open.total === 5 && !open.complete && !open.skipped);
  const planned = planSentenceQuest(undefined, ['s1', 's3', 's4'], T);
  ok('정해 두면 그 id가 남는다', planned.day === T && planned.sentenceIds.join() === 's1,s3,s4');
  ok('★ 이미 정했으면 다시 정해도 안 바뀐다(배우던 게 바뀌면 안 된다) ★', planSentenceQuest(planned, ['x1', 'x2'], T) === planned);
  const mid = sentenceQuestState({ quests: planned }, { s1: { lastSeen: T }, s3: { lastSeen: '2026-11-01' } }, true, T);
  ok('★ 정해 둔 것 중 오늘 판정받은 것만 센다 ★', mid.done === 1 && mid.total === 3 && !mid.complete, JSON.stringify(mid));
  const full = sentenceQuestState({ quests: planned }, { s1: { lastSeen: T }, s3: { lastSeen: T }, s4: { lastSeen: T } }, false, T);
  ok('다 판정받으면 완료(안 본 문장이 없어도 줄은 남는다)', full.done === 3 && full.complete);
  ok('어제 정한 것은 오늘 0에서 시작', sentenceQuestState({ quests: { day: Y, sentenceIds: ['s1'] } }, { s1: { lastSeen: Y } }, true, T).done === 0);
  const skipped = skipSentenceQuest(planned, true, T);
  const sk = sentenceQuestState({ quests: skipped }, {}, true, T);
  ok('★ 건너뛰면 줄도 흐름도 빠진다(skipped) ★', sk.skipped === true && !sk.complete);
  ok('건너뜀을 되돌릴 수 있다', sentenceQuestState({ quests: skipSentenceQuest(skipped, false, T) }, {}, true, T).skipped === false);
  ok('건너뛰어도 다른 몫(쭉 퀴즈)은 그대로', skipSentenceQuest({ day: T, stream: 7 }, true, T).stream === 7);
  const m = mergeQuests({ day: T, stream: 3, sentenceIds: ['a', 'b'], sentenceSkip: false }, { day: T, stream: 9, sentenceIds: ['b', 'c'], sentenceSkip: true });
  ok('★ 두 기기 합치기: id는 합집합 · 건너뜀은 한쪽이라도 · 숫자는 큰 쪽 ★', m.sentenceIds.join() === 'a,b,c' && m.sentenceSkip === true && m.stream === 9, JSON.stringify(m));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
