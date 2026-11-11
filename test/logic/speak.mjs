import assert from 'node:assert/strict';
import {
  shapeSentence, parseSentences, addSentences, removeSentence, savedSentences, mergeSpeak, buildSpeakQueue, learnedSentences,
  speakCounts, speakSteps, stepMs, userText, SPEAK_DIR, SPEAK_SOURCE, speakBatches, pickBatches, batchSentences, batchLabel,
} from '../../src/lib/speak.js';
import { mergeProgress } from '../../src/lib/merge.js';
let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }

const A = { jp: 'ここに座ってもいいですか。', kana: 'ここにすわってもいいですか。', ko: '여기 앉아도 될까요?' };
const B = { jp: '注文をお願いします。', kana: 'ちゅうもんをおねがいします。', ko: '주문 부탁드려요.' };

check('AI 문장 한 줄: 일본어 · 읽기 · 뜻이 맞는 모양만 받는다', () => {
  const s = shapeSentence(A, { topic: '식당', level: 'N4', at: 10 });
  assert.equal(s.jp, A.jp); assert.equal(s.kana, A.kana); assert.equal(s.ko, A.ko); assert.equal(s.topic, '식당'); assert.ok(s.id.startsWith('sp:'));
  assert.equal(shapeSentence({ jp: 'hello', ko: '안녕' }), null);
  assert.equal(shapeSentence({ jp: 'こんにちは', ko: 'hello' }), null);
  assert.equal(shapeSentence({ jp: '', ko: '안녕' }), null);
});
check('읽기에 한자가 섞여 오면 읽기를 버린다(틀린 읽기를 보여 주지 않는다)', () => {
  assert.equal(shapeSentence({ ...A, kana: 'ここに座ってもいいですか' }).kana, '');
});
check('같은 문장은 문장부호·공백이 달라도 같은 id다', () => {
  assert.equal(shapeSentence(A).id, shapeSentence({ ...A, jp: 'ここに座ってもいいですか' }).id);
});
check('응답 읽기: 펜스 · 앞뒤 말 · 배열만 와도 읽고, 겹치는 문장은 한 번만', () => {
  const body = JSON.stringify({ sentences: [A, B, A, { jp: 'x', ko: 'y' }] });
  assert.equal(parseSentences('```json\n' + body + '\n```').length, 2);
  assert.equal(parseSentences('여기 있어요: ' + body).length, 2);
  assert.equal(parseSentences(JSON.stringify([A])).length, 1);
  assert.throws(() => parseSentences(''));
});
check('저장: 이미 있는 문장은 다시 넣지 않고, 상한을 넘으면 오래된 것부터 뺀다', () => {
  const a = shapeSentence(A, { at: 1 }); const b = shapeSentence(B, { at: 2 });
  let r = addSentences(null, [a, b]);
  assert.equal(r.added, 2); assert.equal(savedSentences(r.store).length, 2);
  const again = addSentences(r.store, [a]);
  assert.equal(again.added, 0); assert.equal(again.store, r.store);
  const capped = addSentences(r.store, [shapeSentence({ jp: '水をください。', kana: 'みずをください。', ko: '물 주세요.' }, { at: 3 })], 2);
  assert.deepEqual(savedSentences(capped.store).map((x) => x.at), [3, 2]);
});
check('지운 문장은 목록에서 빠지고, 다시 만들면 되살아난다', () => {
  const a = shapeSentence(A, { at: 1 });
  let store = addSentences(null, [a]).store;
  store = removeSentence(store, a.id, 5);
  assert.equal(savedSentences(store).length, 0);
  store = addSentences(store, [{ ...a, at: 9 }]).store;
  assert.equal(savedSentences(store).length, 1);
});
check('두 기기 합치기: 문장은 합집합, 지운 것은 지운 것, 여러 번 합쳐도 같다', () => {
  const a = shapeSentence(A, { at: 1 }); const b = shapeSentence(B, { at: 2 });
  const pc = addSentences(null, [a, b]).store;
  const phone = removeSentence(addSentences(null, [a]).store, a.id, 5);
  const m = mergeSpeak(pc, phone);
  assert.deepEqual(savedSentences(m).map((x) => x.id), [b.id]);
  assert.deepEqual(mergeSpeak(m, m), m); assert.deepEqual(mergeSpeak(pc, phone), mergeSpeak(phone, pc));
  assert.equal(savedSentences(mergeProgress({ speak: pc }, { speak: phone }).speak).length, 1);
  assert.deepEqual(mergeProgress({}, {}).speak, { items: {}, gone: {} });
});
const cards = [
  { id: 's1', kanji: 'すみません。', kana: 'すみません。', mean: '실례합니다.;죄송합니다.', kind: 'sentence', place: '식당' },
  { id: 's2', kanji: 'お会計をお願いします。', kana: 'おかいけいをおねがいします。', mean: '계산 부탁드려요.', kind: 'sentence' },
];
check('배운 문장은 회독 기록이 있는 문장 카드만', () => {
  const l = learnedSentences(cards, { s1: { lastSeen: '2026-11-01' } });
  assert.equal(l.length, 1); assert.equal(l[0].ko, '실례합니다.'); assert.equal(l[0].kana, '');
  assert.deepEqual(speakCounts({ saved: [shapeSentence(A)], sentenceCards: cards, review: { s1: { lastSeen: 'x' } } }), { ai: 1, learned: 1, mix: 2 });
});
check('한 판: 출처대로 고르고, 섞어서는 두 쪽을 번갈아 넣는다', () => {
  const saved = [shapeSentence(A), shapeSentence(B)];
  const review = { s1: { lastSeen: 'x' }, s2: { lastSeen: 'x' } };
  const rng = () => 0.5;
  assert.equal(buildSpeakQueue({ source: SPEAK_SOURCE.AI, saved, sentenceCards: cards, review, count: 10, rng }).length, 2);
  assert.ok(buildSpeakQueue({ source: SPEAK_SOURCE.LEARNED, saved, sentenceCards: cards, review, count: 10, rng }).every((x) => x.learned));
  const mix = buildSpeakQueue({ source: SPEAK_SOURCE.MIX, saved, sentenceCards: cards, review, count: 3, rng });
  assert.equal(mix.length, 3); assert.ok(mix.some((x) => x.learned) && mix.some((x) => !x.learned));
  assert.deepEqual(buildSpeakQueue({ source: SPEAK_SOURCE.AI, saved: [], sentenceCards: [], review: {} }), []);
});
check('걸음: 뜻→일본어는 넷(뜻 · 말하기 · 정답 · 따라 말하기), 일본어→뜻은 셋', () => {
  assert.deepEqual(speakSteps(SPEAK_DIR.KO_JP), ['prompt', 'think', 'answer', 'repeat']);
  assert.deepEqual(speakSteps(SPEAK_DIR.JP_KO), ['prompt', 'think', 'answer', 'repeat']);   // 정답 뒤에 한 번 더 말하기가 기본
});
check('말할 시간은 고른 초 그대로, 긴 문장은 듣는 시간이 더 길다', () => {
  const it = shapeSentence(A);
  assert.equal(stepMs('think', it, { dir: SPEAK_DIR.KO_JP, think: 8 }), 8000);
  assert.equal(stepMs('think', it, { dir: SPEAK_DIR.KO_JP, think: 3 }), 3000);
  assert.ok(stepMs('answer', it) > stepMs('answer', { jp: 'はい。', kana: 'はい。', ko: '네.' }));
  assert.ok(stepMs('think', it, { dir: SPEAK_DIR.JP_KO, think: 3 }) >= 3000);
});
check('AI에게 보내는 글: 주제 · 수준 · 개수 · 이미 있는 문장', () => {
  const t = userText({ topic: '식당', level: 'N3', count: 10, avoid: [A.jp] });
  assert.ok(t.includes('[주제] 식당') && t.includes('JLPT N3') && t.includes('[개수] 10') && t.includes(A.jp));
  assert.ok(userText({}).includes('일상 회화'));
});

/* ── 정답 뒤에 한 번 더 말하기 ── */
check('일본어 → 뜻도 정답 뒤에 한 번 더 말할 차례가 있다(기본)', () => {
  assert.deepEqual(speakSteps(SPEAK_DIR.JP_KO), ['prompt', 'think', 'answer', 'repeat']);
  assert.deepEqual(speakSteps(SPEAK_DIR.KO_JP), ['prompt', 'think', 'answer', 'repeat']);
});
check('설정에서 끄면 정답을 듣고 바로 다음 문장이다', () => {
  assert.deepEqual(speakSteps(SPEAK_DIR.JP_KO, { again: false }), ['prompt', 'think', 'answer']);
  assert.deepEqual(speakSteps(SPEAK_DIR.KO_JP, { again: false }), ['prompt', 'think', 'answer']);
});
check('한 번 더 말할 차례는 고른 「말할 시간」만큼은 준다', () => {
  assert.ok(stepMs('repeat', A, { dir: SPEAK_DIR.JP_KO, think: 8 }) >= 8000);
  assert.ok(stepMs('repeat', A, { dir: SPEAK_DIR.JP_KO, think: 3 }) >= 3000);
});

/* ── 회차 ── */
const mk = (jp, extra) => ({ ...shapeSentence({ jp, kana: '', ko: '뜻' }, extra) });
check('한 번 만든 문장은 같은 회차, 만든 순서대로 번호가 붙는다', () => {
  const first = [mk('一つ目です。', { topic: '식당', at: 1000, batch: 'b1' }), mk('二つ目です。', { topic: '식당', at: 1000, batch: 'b1' })];
  const second = [mk('三つ目です。', { topic: '회사', at: 5000, batch: 'b2' })];
  const bs = speakBatches([...second, ...first]);
  assert.equal(bs.length, 2);
  assert.deepEqual(bs.map((b) => [b.no, b.topic, b.items.length]), [[1, '식당', 2], [2, '회사', 1]]);
  assert.equal(batchLabel(bs[1]), '2회차 · 회사');
  assert.equal(batchLabel({ no: 3, topic: '' }), '3회차 · 일상 회화');
});
check('회차 표시가 없는 예전 문장은 주제와 만든 시각으로 묶는다', () => {
  const old = [
    mk('朝ごはんを食べます。', { topic: '아침', at: 10_000 }), mk('歯を磨きます。', { topic: '아침', at: 10_003 }),
    mk('会議が始まります。', { topic: '회사', at: 10_004 }),                       // 주제가 다르면 다른 회차
    mk('顔を洗います。', { topic: '아침', at: 900_000 }),                           // 같은 주제라도 한참 뒤에 만든 것은 다른 회차
  ];
  const bs = speakBatches(old);
  assert.deepEqual(bs.map((b) => [b.topic, b.items.length]), [['아침', 2], ['회사', 1], ['아침', 1]]);
  assert.ok(bs.every((b) => b.id.startsWith('old:')));
  assert.equal(new Set(bs.map((b) => b.id)).size, 3);
});
check('회차를 고르면 그 문장만, 안 고르면 전부 섞는다', () => {
  const bs = speakBatches([mk('一つ目です。', { at: 1, batch: 'b1' }), mk('二つ目です。', { at: 2, batch: 'b2' }), mk('三つ目です。', { at: 3, batch: 'b3' })]);
  assert.equal(batchSentences(pickBatches(bs, [])).length, 3);
  assert.deepEqual(batchSentences(pickBatches(bs, ['b2'])).map((x) => x.jp), ['二つ目です。']);
  assert.equal(batchSentences(pickBatches(bs, ['b1', 'b3'])).length, 2);
  assert.equal(batchSentences(pickBatches(bs, ['지운 회차'])).length, 3);            // 고른 회차가 사라졌으면 전부
  const q = buildSpeakQueue({ source: SPEAK_SOURCE.AI, saved: batchSentences(pickBatches(bs, ['b3'])), count: 10 });
  assert.deepEqual(q.map((x) => x.jp), ['三つ目です。']);
});
check('회차 표시는 저장 · 합치기를 거쳐도 남는다', () => {
  const list = [mk('一つ目です。', { at: 1, batch: 'b1' })];
  const { store } = addSentences(undefined, list);
  assert.equal(savedSentences(mergeSpeak(store, { items: {}, gone: {} }))[0].batch, 'b1');
  assert.equal(shapeSentence(A).batch, undefined);                                    // 회차가 없으면 칸도 없다
});
check('상한으로 밀려난 문장은 지운 것으로 적혀서 다른 기기와 합쳐도 되살아나지 않는다', () => {
  const five = Array.from({ length: 5 }, (_, i) => mk(`${i}番目の文です。`, { at: 100 + i, batch: 'b1' }));
  const { store } = addSentences(undefined, five, 5);
  const other = addSentences(undefined, five, 5).store;                    // 다른 기기도 같은 다섯을 갖고 있다
  const sixth = mk('新しい文です。', { at: 900, batch: 'b2' });
  const { store: capped } = addSentences(store, [sixth], 5);
  assert.equal(savedSentences(capped).length, 5);
  assert.ok(!savedSentences(capped).some((x) => x.jp === '0番目の文です。'));  // 가장 오래된 것이 밀려났다
  const merged = mergeSpeak(capped, other);
  assert.equal(savedSentences(merged).length, 5);                           // 합쳐도 여섯이 되지 않는다
  assert.ok(!savedSentences(merged).some((x) => x.jp === '0番目の文です。'));
});
console.log(`통과 ${pass} / 실패 0`);
