/* 지운 것이 다음 동기화에서 되살아나지 않는다.
 *
 * 합치기가 합집합 · 큰 쪽이라, 지운 것을 「없는 것」으로만 두면 다른 기기 — 또는 서버에 올라가 있던 내 옛 값 — 에서
 * 그대로 돌아왔다. 기기가 하나여도 그랬다(지우고 12초 뒤 동기화). 지운 시각을 남기고 나중 것이 이기게 한다.
 *   메모 · 북마크 · 내 단어 · N3 오답 노트 · 문장 퀘스트 건너뛰기 되돌리기 · 약점의 「다 외웠어요」 */
import { mergeMemos, mergeProgress, mergeCustomWords, mergeBookmarks, mergeGone } from '../../src/lib/merge.js';
import { mergeN3, noteN3Wrong, noteN3Gone, emptyN3 } from '../../src/lib/n3progress.js';
import { recordAnswer } from '../../src/lib/n3.js';
import { mergeQuests, skipSentenceQuest, questsOf } from '../../src/lib/quests.js';
import { mergeWeak, noteWeak, weakEntry, WEAK_KIND } from '../../src/lib/weak.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const T = '2026-11-12';

console.log('\n[ 메모 ]');
{
  const server = { w1: { text: '나무 목요일', at: '2026-11-10T01:00:00.000Z' } };   // 서버에 올라가 있던 내 메모
  const deleted = { w1: { text: '', at: '2026-11-12T03:00:00.000Z' } };             // 이 기기에서 지웠다(빈 글 + 지운 시각)
  ok('★ 지운 메모가 되살아나지 않는다 ★', mergeMemos(deleted, server).w1.text === '' && mergeMemos(server, deleted).w1.text === '');
  const rewritten = { w1: { text: '새 연상법', at: '2026-11-12T05:00:00.000Z' } };
  ok('지운 뒤에 다시 쓴 메모는 남는다', mergeMemos(rewritten, deleted).w1.text === '새 연상법' && mergeMemos(deleted, rewritten).w1.text === '새 연상법');
  ok('(전) 칸을 통째로 없애면 서버 것이 돌아왔다', mergeMemos({}, server).w1.text === '나무 목요일');
}

console.log('\n[ 북마크 ]');
{
  const server = { bookmarks: ['w1', 'w2'] };                                        // 시각이 없는 옛 북마크
  const off = { bookmarks: ['w2'], bookmarkAt: { w1: { on: false, at: 2000 } } };    // 이 기기에서 w1을 풀었다
  const m = mergeBookmarks(off, server);
  ok('★ 푼 북마크가 되살아나지 않는다 ★', same(m.bookmarks, ['w2']), JSON.stringify(m.bookmarks));
  ok('순서를 바꿔도 같다', same(mergeBookmarks(server, off).bookmarks.sort(), ['w2']));
  const on = { bookmarks: ['w1', 'w2'], bookmarkAt: { w1: { on: true, at: 3000 } } };  // 다른 기기에서 그 뒤에 다시 켰다
  ok('풀고 난 뒤에 다시 켠 것은 켜진다(나중 것이 이긴다)', mergeBookmarks(off, on).bookmarks.includes('w1') && mergeBookmarks(on, off).bookmarks.includes('w1'));
  ok('시각이 없는 옛 북마크는 예전처럼 다 남는다', same(mergeBookmarks({ bookmarks: ['a'] }, { bookmarks: ['b'] }).bookmarks.sort(), ['a', 'b']));
  const p = mergeProgress(off, server);
  ok('진도를 합칠 때 그대로 쓰인다', same(p.bookmarks, ['w2']) && p.bookmarkAt.w1.on === false);
  ok('몇 번 합쳐도 같다', same(mergeProgress(p, server).bookmarks, ['w2']) && same(mergeProgress(server, p).bookmarks, ['w2']));
}

console.log('\n[ 내 단어 ]');
{
  const word = { id: 'my-1', kanji: '猫' };
  const server = [word, { id: 'my-2', kanji: '犬' }];
  const gone = { 'my-1': 5000 };
  ok('★ 지운 내 단어가 되살아나지 않는다 ★', same(mergeCustomWords([{ id: 'my-2', kanji: '犬' }], server, gone).map((w) => w.id), ['my-2']));
  ok('지운 뒤에 다시 넣은 낱말은 남는다', mergeCustomWords([{ ...word, addedAt: 9000 }], server, gone).some((w) => w.id === 'my-1'));
  ok('넣은 시각이 지운 시각보다 앞이면 지운 것이다', !mergeCustomWords([{ ...word, addedAt: 1000 }], [], gone).length);
  ok('(전) 지운 시각을 안 넘기면 돌아왔다', mergeCustomWords([], server).length === 2);
  ok('지운 시각은 큰 쪽으로 합친다', same(mergeGone({ a: 1, b: 9 }, { a: 5, c: 2 }), { a: 5, b: 9, c: 2 }));
  ok('진도에 실려 다닌다(wordsGone)', mergeProgress({ wordsGone: { 'my-1': 5000 } }, { wordsGone: { 'my-1': 3000, 'my-3': 1 } }).wordsGone['my-1'] === 5000);
}

console.log('\n[ N3 오답 노트 ]');
{
  let n3 = emptyN3();
  n3 = recordAnswer(n3, { qid: 'q1', ok: false, today: T, at: 1000 });
  const server = n3;                                                   // 틀린 채로 서버에 올라갔다
  n3 = recordAnswer(n3, { qid: 'q1', ok: true, today: T, at: 2000 });
  n3 = recordAnswer(n3, { qid: 'q1', ok: true, today: T, at: 3000 });  // 두 번 이어 맞혀 노트에서 빠졌다
  ok('두 번 이어 맞히면 노트에서 빠지고 뺀 시각이 남는다', !n3.wrong.q1 && n3.wrongGone.q1 === 3000, JSON.stringify(n3.wrongGone));
  ok('★ 뺀 문제가 다음 동기화에서 되살아나지 않는다 ★', !mergeN3(n3, server).wrong.q1 && !mergeN3(server, n3).wrong.q1);
  const again = recordAnswer(n3, { qid: 'q1', ok: false, today: T, at: 4000 });
  ok('뺀 뒤에 다시 틀리면 노트에 다시 오른다', Boolean(mergeN3(again, server).wrong.q1) && mergeN3(again, server).wrong.q1.at === 4000);
  ok('다른 문제는 그대로다', Boolean(mergeN3(n3, recordAnswer(server, { qid: 'q2', ok: false, today: T, at: 1500 })).wrong.q2));
  ok('바뀐 게 없으면 받은 그대로', noteN3Gone(n3.wrongGone, { a: 1 }, { a: 1 }, 9) === n3.wrongGone);
  ok('노트에 없는 문제를 맞혀도 뺀 것으로 적지 않는다', noteN3Gone({}, {}, noteN3Wrong({}, 'x', true), 9).x === undefined);
}

console.log('\n[ 문장 퀘스트 건너뛰기 되돌리기 ]');
{
  const skipped = skipSentenceQuest(undefined, true, T, 1000);         // 건너뛰고 서버에 올라갔다
  const undone = skipSentenceQuest(skipped, false, T, 2000);           // 되돌렸다
  ok('★ 되돌린 건너뛰기가 다음 동기화에서 다시 건너뜀이 되지 않는다 ★', questsOf({ quests: mergeQuests(undone, skipped) }, T).sentenceSkip === false && questsOf({ quests: mergeQuests(skipped, undone) }, T).sentenceSkip === false);
  ok('나중에 건너뛴 쪽은 건너뜀이다', questsOf({ quests: mergeQuests(skipSentenceQuest(undone, true, T, 3000), undone) }, T).sentenceSkip === true);
  ok('시각이 없는 옛 기록은 예전 규칙(한쪽이라도 건너뛰었으면)', mergeQuests({ day: T, sentenceSkip: true }, { day: T, sentenceSkip: false }).sentenceSkip === true);
}

console.log('\n[ 약점 — 다 외웠어요 ]');
{
  let led = noteWeak({}, [{ id: 'w1', kind: WEAK_KIND.STUCK }], 1000);
  led = noteWeak(led, [{ id: 'w1', kind: WEAK_KIND.STUCK }], 1100);
  const server = led;                                                  // 두 바퀴 돈 채로 서버에 올라갔다
  const cleared = noteWeak(led, [{ id: 'w1', kind: WEAK_KIND.CLEARED }], 2000);
  ok('다 외웠어요 — 바퀴 수가 0이 되고 누른 시각이 남는다', weakEntry(cleared, 'w1').stuck === 0 && weakEntry(cleared, 'w1').clearedAt === 2000);
  ok('★ 뗀 낱말이 다음 동기화에서 다시 안 뗀 것으로 돌아오지 않는다 ★', mergeWeak(cleared, server).w1.stuck === 0 && mergeWeak(server, cleared).w1.stuck === 0, JSON.stringify(mergeWeak(cleared, server).w1));
  const other = noteWeak(server, [{ id: 'w1', kind: WEAK_KIND.STUCK }], 3000);   // 다른 기기에서는 그 뒤에도 돌고 있다
  ok('뗀 뒤에 다른 기기에서 또 쌓인 바퀴는 남는다', mergeWeak(cleared, other).w1.stuck === 3);
  ok('뗀 적이 없으면 예전처럼 큰 쪽', mergeWeak(server, noteWeak({}, [{ id: 'w1', kind: WEAK_KIND.STUCK }], 500)).w1.stuck === 2);
  const m = mergeWeak(cleared, server);
  ok('몇 번 합쳐도 같다', same(mergeWeak(m, server), m) && same(mergeWeak(server, m), m));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
