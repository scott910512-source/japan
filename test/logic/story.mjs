/* 이야기 연속 듣기 — 글을 문장으로 나누기, 파일 읽기, 목록 합치기, 자리 기억, 설정 */
import assert from 'node:assert/strict';
import {
  STORY_FORMAT, STORY_LIMIT, STORY_KO, DEFAULT_STORY_PREFS, cleanStoryPrefs,
  splitSentences, cleanStory, parseStoryText, storiesFromFile, flatStory, storyStats, storyMinutes, sectionStarts,
  nextStoryAt, addStories, removeStory, loadStories, saveStories, loadStoryPos, saveStoryPos, resumeAt, loadStoryPrefs, saveStoryPrefs,
  mergeStoryStore, sameStoryStore, loadStoryRemoved, saveStoryRemoved,
  STORY_SIZES, STORY_VOICES, buildGlossIndex, glossSentence,
} from '../../src/lib/story.js';
import { mergeVideos } from '../../src/lib/merge.js';
let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

const TXT = `제목: [N5 - N4] 10-minute simple Japanese listening | My small garden
채널: Test Channel
게시일: 2026-01-01
URL: https://www.youtube.com/watch?v=abcdef12345
============================================================

庭に花があります。毎朝、水をやります。

【春】
春は花がたくさん咲きます。とてもきれいです！「また来てね」と言いました。
`;
const JSON_FILE = JSON.stringify({ format: STORY_FORMAT, version: 1, stories: [{
  id: 'demo-1', title: '아침 이야기', level: 'N5', source: '검사용',
  sections: [
    { title: '', paras: [[{ jp: '皆さん、こんにちは。', ko: '여러분, 안녕하세요.' }, { jp: '今日は天気がいいです。', ko: '오늘은 날씨가 좋아요.' }]] },
    { title: '月曜日', titleKo: '월요일', paras: [[{ jp: '朝、コーヒーを飲みました。', ko: '아침에 커피를 마셨어요.' }], [{ jp: '電車は少し混んでいました。', ko: '전철은 조금 붐볐어요.' }]] },
  ],
}] });

check('문장으로 나눈다 — 마침표 · 느낌표 · 물음표, 닫는 따옴표는 앞 문장에 붙인다', () => {
  assert.deepEqual(splitSentences('朝です。散歩しました！本当？「はい。」と言った'), ['朝です。', '散歩しました！', '本当？', '「はい。」', 'と言った']);
  assert.deepEqual(splitSentences('   '), []);
  assert.deepEqual(splitSentences('終わりの印がない文'), ['終わりの印がない文']);
});
check('글 파일: 머리말에서 제목 · 급수 · 채널 · 주소를 읽고 「몇 분짜리」 꼬리표는 뺀다', () => {
  const s = parseStoryText(TXT, 'x.txt', 1000);
  assert.equal(s.title, 'My small garden');
  assert.equal(s.level, 'N5-N4');
  assert.equal(s.source, 'Test Channel');
  assert.equal(s.url, 'https://www.youtube.com/watch?v=abcdef12345');
  assert.equal(s.id, 'yt-abcdef12345');
  assert.equal(s.addedAt, 1000);
});
check('글 파일: 【…】 줄은 구간 이름, 나머지는 문단 · 문장. 해석은 지어내지 않는다', () => {
  const s = parseStoryText(TXT, 'x.txt');
  assert.deepEqual(s.sections.map((x) => x.title), ['', '春']);
  assert.deepEqual(s.sections[0].paras, [[{ jp: '庭に花があります。' }, { jp: '毎朝、水をやります。' }]]);
  assert.equal(s.sections[1].paras[0].length, 3);
  assert.equal(storyStats(s).hasKo, false);
});
check('머리말이 없는 글 파일은 파일 이름이 제목이 된다 · 같은 글은 같은 id', () => {
  const a = parseStoryText('今日は雨です。家にいます。', '05_My_Morning.txt');
  assert.equal(a.title, '05 My Morning');
  assert.equal(a.id, parseStoryText('今日は雨です。家にいます。', '05_My_Morning.txt').id);
  assert.equal(parseStoryText('', 'x.txt'), null);
});
check('json 파일: 묶음 · 배열 · 한 편 모두 읽고, 문장마다 해석을 받는다', () => {
  const got = storiesFromFile('a.json', JSON_FILE);
  assert.equal(got.length, 1);
  assert.equal(got[0].id, 'demo-1');
  assert.equal(storyStats(got[0]).hasKo, true);
  assert.equal(storiesFromFile('a.json', JSON.stringify(JSON.parse(JSON_FILE).stories)).length, 1);
  assert.equal(storiesFromFile('a.json', JSON.stringify(JSON.parse(JSON_FILE).stories[0])).length, 1);
  assert.equal(storiesFromFile('이름없음', `﻿${JSON_FILE}`).length, 1);   // 확장자가 없어도 · BOM이 있어도
});
check('못 읽는 파일은 빈 목록 — 깨진 json · 모양이 틀린 것', () => {
  assert.deepEqual(storiesFromFile('a.json', '{ 깨짐'), []);
  assert.deepEqual(storiesFromFile('a.json', JSON.stringify({ stories: [{ title: 'x', sections: [{ paras: [[{ jp: '' }, 3, null]] }] }, null, 'x'] })), []);
  assert.equal(cleanStory({ title: 'x', sections: 'nope' }), null);
});
check('모양 다듬기: 글자만 온 문장도 받고, 주소가 아닌 url은 버리고, 너무 긴 값은 자른다', () => {
  const s = cleanStory({ title: 'T'.repeat(500), url: 'javascript:alert(1)', sections: [{ title: 5, paras: [['一つ目。', { jp: '二つ目。', ko: 7 }]] }] });
  assert.equal(s.title.length, 120);
  assert.equal(s.url, '');
  assert.deepEqual(s.sections[0].paras[0], [{ jp: '一つ目。' }, { jp: '二つ目。' }]);
  assert.equal(s.sections[0].title, '');
});
check('한 줄로 편다 — 구간 · 문단 번호와 문단 끝 표시', () => {
  const s = storiesFromFile('a.json', JSON_FILE)[0];
  const flat = flatStory(s);
  assert.equal(flat.length, 4);
  assert.deepEqual(flat.map((l) => l.sec), [0, 0, 1, 1]);
  assert.deepEqual(flat.map((l) => l.last), [false, true, true, true]);
  assert.equal(flat[2].ko, '아침에 커피를 마셨어요.');
  assert.deepEqual(sectionStarts(s), [0, 2]);
  assert.deepEqual(flatStory(null), []);
});
check('다음 자리: 끝이면 멈추고, 되풀이면 처음으로', () => {
  assert.equal(nextStoryAt(0, 4), 1);
  assert.equal(nextStoryAt(3, 4), null);
  assert.equal(nextStoryAt(3, 4, true), 0);
  assert.equal(nextStoryAt(0, 0, true), null);
});
check('목록에 넣기: 새 것은 더하고, 같은 id는 바꾸되 담은 시각은 그대로', () => {
  const a = storiesFromFile('a.json', JSON_FILE)[0];
  const first = addStories([], [{ ...a, addedAt: 5 }]);
  assert.deepEqual([first.added, first.replaced, first.rejected], [1, 0, 0]);
  const again = addStories(first.list, [{ ...a, title: '새 제목', addedAt: 99 }]);
  assert.deepEqual([again.added, again.replaced, again.list.length], [0, 1, 1]);
  assert.equal(again.list[0].title, '새 제목');
  assert.equal(again.list[0].addedAt, 5);
  assert.equal(removeStory(again.list, 'demo-1').length, 0);
});
check('목록에 넣기: 한도를 넘는 것은 안 받는다', () => {
  const a = storiesFromFile('a.json', JSON_FILE)[0];
  const many = Array.from({ length: STORY_LIMIT + 3 }, (_, i) => ({ ...a, id: `s${i}` }));
  const r = addStories([], many);
  assert.equal(r.list.length, STORY_LIMIT);
  assert.equal(r.rejected, 3);
});
check('기기에 남기고 다시 읽는다 · 깨진 값은 빈 목록', () => {
  const s = memory();
  const a = storiesFromFile('a.json', JSON_FILE);
  assert.equal(saveStories(a, s), true);
  assert.equal(loadStories(s)[0].id, 'demo-1');
  assert.equal(saveStories(a, { setItem: () => { throw new Error('공간 없음'); } }), false);
  assert.deepEqual(loadStories({ getItem: () => '{깨짐' }), []);
  assert.deepEqual(loadStories({ getItem: () => '{"a":1}' }), []);
});
check('이어 들을 자리: 범위 안이면 그 자리, 벗어나면 처음', () => {
  const s = memory();
  saveStoryPos({ 'demo-1': 2 }, s);
  const pos = loadStoryPos(s);
  assert.equal(resumeAt(pos, 'demo-1', 4), 2);
  assert.equal(resumeAt(pos, 'demo-1', 2), 0);      // 글이 짧아졌다
  assert.equal(resumeAt(pos, '없는것', 4), 0);
  assert.equal(resumeAt({ x: '2' }, 'x', 4), 2);
  assert.equal(resumeAt({ x: -1 }, 'x', 4), 0);
  assert.deepEqual(loadStoryPos({ getItem: () => '[1,2]' }), {});
});
check('설정: 기본은 천천히 · 한 번 · 해석 글자로. 표에 없는 값은 기본값으로', () => {
  assert.deepEqual(DEFAULT_STORY_PREFS, { rate: 0.75, repeat: 1, ko: STORY_KO.TEXT, loop: false, size: 'l', voice: '' });
  assert.deepEqual(cleanStoryPrefs({ rate: 3, repeat: 9, ko: 'x', loop: 'yes' }), DEFAULT_STORY_PREFS);
  assert.deepEqual(cleanStoryPrefs({ rate: 0.6, repeat: 3, ko: 'voice', loop: true }), { rate: 0.6, repeat: 3, ko: 'voice', loop: true, size: 'l', voice: '' });
  const s = memory();
  saveStoryPrefs({ rate: 1, repeat: 2, ko: 'off', loop: true, size: 'xl', voice: 'ja-JP-Chirp3-HD-Kore' }, s);
  assert.deepEqual(loadStoryPrefs(s), { rate: 1, repeat: 2, ko: 'off', loop: true, size: 'xl', voice: 'ja-JP-Chirp3-HD-Kore' });
  assert.deepEqual(loadStoryPrefs({ getItem: () => 'x' }), DEFAULT_STORY_PREFS);
});
check('글자 크기: 보통 · 크게 · 아주 크게. 기본은 크게, 모르는 값은 기본으로', () => {
  assert.deepEqual(STORY_SIZES.map((x) => x.v), ['m', 'l', 'xl']);
  assert.equal(cleanStoryPrefs({ size: 'm' }).size, 'm');
  assert.equal(cleanStoryPrefs({ size: 'huge' }).size, 'l');
  assert.equal(cleanStoryPrefs({}).size, 'l');
});
check('이야기 목소리: 기본은 설정과 같게, 회화형 넷 중에서 고른다. 모르는 이름은 버린다', () => {
  assert.deepEqual(STORY_VOICES.map((x) => x.v), ['', 'ja-JP-Chirp3-HD-Aoede', 'ja-JP-Chirp3-HD-Kore', 'ja-JP-Chirp3-HD-Charon', 'ja-JP-Chirp3-HD-Puck']);
  assert.equal(cleanStoryPrefs({}).voice, '');
  assert.equal(cleanStoryPrefs({ voice: 'ja-JP-Chirp3-HD-Puck' }).voice, 'ja-JP-Chirp3-HD-Puck');
  assert.equal(cleanStoryPrefs({ voice: 'en-US-Whatever' }).voice, '');
  assert.equal(cleanStoryPrefs({ voice: 7 }).voice, '');
});
const DICT = [
  { id: 'w1', kanji: '行く', kana: 'いく', mean: '가다', type: 'verb', group: '1' },
  { id: 'w2', kanji: '銀行', kana: 'ぎんこう', mean: '은행; 뱅크', type: 'noun' },
  { id: 'w3', kanji: '窓', kana: 'まど', mean: '창문', type: 'noun' },
  { id: 'w4', kanji: '開ける', kana: 'あける', mean: '열다', type: 'verb', group: '2' },
  { id: 'w5', kanji: '飲む', kana: 'のむ', mean: '마시다', type: 'verb', group: '1' },
  { id: 'w6', kanji: '高い', kana: 'たかい', mean: '비싸다', type: 'adj-i' },
  { id: 'w7', kanji: '勉強する', kana: 'べんきょうする', mean: '공부하다', type: 'verb', group: '3' },
  { id: 'w8', kanji: '', kana: 'コーヒー', mean: '커피', type: 'noun' },
  { id: 'w9', kanji: '朝', kana: 'あさ', mean: '아침', type: 'noun' },
];
const gloss = (t, max) => glossSentence(t, buildGlossIndex(DICT), max).map((w) => w.jp);
check('★ 문장 속 낱말 찾기: 활용한 꼴도 사전 꼴로 찾는다 ★', () => {
  assert.deepEqual(gloss('朝、コーヒーを飲みました。'), ['朝', '飲む']);
  assert.deepEqual(gloss('学校に行って、窓を開けた。'), ['行く', '窓', '開ける']);
  assert.deepEqual(gloss('高くないです。'), ['高い']);
  assert.deepEqual(gloss('毎日勉強しています。'), ['勉強する']);
});
check('★ 다른 낱말 안에 든 글자는 잘못 집지 않는다(銀行의 行 ≠ 行く) ★', () => {
  assert.deepEqual(gloss('銀行に行きます。'), ['銀行', '行く']);
  assert.deepEqual(gloss('銀行は高い。'), ['銀行', '高い']);
  assert.deepEqual(gloss('旅行が好きです。'), []);          // 行 뒤에 が — 行く가 아니다
  assert.deepEqual(gloss('窓口で聞いた。'), []);            // 窓口는 사전에 없다 — 窓만 떼어 붙이지 않는다
});
check('가나뿐인 낱말은 붙이지 않고, 같은 낱말은 한 번만, 많아야 max개', () => {
  assert.deepEqual(gloss('コーヒーをください。'), []);
  assert.deepEqual(gloss('行って、行って、行った。'), ['行く']);
  assert.equal(gloss('朝、銀行に行って窓を開けて飲んだ。', 3).length, 3);
  const [w] = glossSentence('銀行に', buildGlossIndex(DICT));
  assert.deepEqual(w, { id: 'w2', jp: '銀行', kana: 'ぎんこう', mean: '은행' });
  assert.deepEqual(glossSentence('銀行', null), []);
  assert.deepEqual(glossSentence('', buildGlossIndex([])), []);
});
check('어림 시간: 느릴수록 · 반복이 많을수록 · 해석을 읽을수록 길다', () => {
  const s = storiesFromFile('a.json', JSON.stringify({ stories: [{ title: 'x', sections: [{ paras: [Array.from({ length: 200 }, () => ({ jp: '今日はとても天気がいいので散歩をしました。', ko: '오늘은 날씨가 아주 좋아서 산책을 했어요.' }))] }] }] }))[0];
  const base = storyMinutes(s, { rate: 1, repeat: 1, ko: 'off' });
  assert.ok(storyMinutes(s, { rate: 0.6, repeat: 1, ko: 'off' }) > base);
  assert.ok(storyMinutes(s, { rate: 1, repeat: 2, ko: 'off' }) > base);
  assert.ok(storyMinutes(s, { rate: 1, repeat: 1, ko: 'voice' }) > base);
  assert.equal(storyMinutes(s, { rate: 1, repeat: 1, ko: 'text' }), base);
  assert.ok(storyMinutes(null) >= 1);
});

/* ── 기기끼리 합치기(계정에 실어 다른 기기에도 뜨게) ── */
const one = (id, addedAt, extra = {}) => ({ ...storiesFromFile('a.json', JSON_FILE)[0], id, addedAt, ...extra });
check('합치기: 한쪽에만 있는 이야기는 양쪽에 다 남는다(넣은 순서대로)', () => {
  const r = mergeStoryStore({ list: [one('b', 20)] }, { list: [one('a', 10)] });
  assert.deepEqual(r.list.map((s) => s.id), ['a', 'b']);
  assert.deepEqual(r.removed, {});
});
check('합치기: 같은 이야기는 나중에 넣거나 바꾼 쪽이 남는다', () => {
  const older = one('a', 10, { title: '옛 제목' });
  const newer = one('a', 10, { title: '새 제목', updatedAt: 50 });
  assert.equal(mergeStoryStore({ list: [older] }, { list: [newer] }).list[0].title, '새 제목');
  assert.equal(mergeStoryStore({ list: [newer] }, { list: [older] }).list[0].title, '새 제목');
  assert.equal(mergeStoryStore({ list: [newer] }, { list: [older] }).list[0].updatedAt, 50);
});
check('★ 합치기: 지운 이야기는 다른 기기에 남아 있어도 되살아나지 않는다 ★', () => {
  const r = mergeStoryStore({ list: [], removed: { a: 30 } }, { list: [one('a', 10)] });
  assert.deepEqual(r.list, []);
  assert.equal(r.removed.a, 30);
  const back = mergeStoryStore({ list: [one('a', 10)] }, { list: [], removed: { a: 30 } });
  assert.deepEqual(back.list, []);
});
check('합치기: 지운 뒤에 다시 불러온 것은 돌아온다 · 바꿔 넣은 것도', () => {
  assert.equal(mergeStoryStore({ list: [one('a', 40)], removed: { a: 30 } }, { list: [], removed: { a: 30 } }).list.length, 1);
  assert.equal(mergeStoryStore({ list: [one('a', 10, { updatedAt: 40 })] }, { removed: { a: 30 } }).list.length, 1);
});
check('합치기: 두 번 해도 같다 · 한쪽이 비었거나 모양이 틀려도 죽지 않는다', () => {
  const a = { list: [one('a', 10), one('b', 20)], removed: { c: 5 } };
  const once = mergeStoryStore(a, { list: [one('b', 20)], removed: { d: 7 } });
  assert.deepEqual(mergeStoryStore(once, once), once);
  assert.equal(sameStoryStore(mergeStoryStore(once, a), once), true);
  assert.deepEqual(mergeStoryStore(undefined, undefined), { list: [], removed: {} });
  assert.deepEqual(mergeStoryStore({ list: 'x', removed: [1] }, { list: [null, 3, { title: 'x' }], removed: 'y' }), { list: [], removed: {} });
});
check('합치기: 한도를 넘으면 먼저 넣은 것부터 남긴다', () => {
  const many = Array.from({ length: STORY_LIMIT + 5 }, (_, i) => one(`s${String(i).padStart(3, '0')}`, i + 1));
  const r = mergeStoryStore({ list: many.slice(0, 30) }, { list: many.slice(20) });
  assert.equal(r.list.length, STORY_LIMIT);
  assert.equal(r.list[0].id, 's000');
});
check('같은 묶음인지: 내용이 같으면 참, 이야기나 지운 표시가 달라지면 거짓', () => {
  const a = { list: [one('a', 10)], removed: {} };
  assert.equal(sameStoryStore(a, { list: [one('a', 10)], removed: {} }), true);
  assert.equal(sameStoryStore(a, { list: [one('a', 10, { updatedAt: 11 })], removed: {} }), false);
  assert.equal(sameStoryStore(a, { list: [one('a', 10)], removed: { b: 1 } }), false);
  assert.equal(sameStoryStore(a, { list: [], removed: {} }), false);
});
check('목록에 넣기: 같은 id를 바꿔 넣으면 바꾼 시각이 남는다(다른 기기의 옛 것을 이긴다)', () => {
  const first = addStories([], [one('a', 5)], 100);
  assert.equal(first.list[0].updatedAt, undefined);
  const again = addStories(first.list, [one('a', 999, { title: '새 제목' })], 200);
  assert.equal(again.list[0].addedAt, 5);
  assert.equal(again.list[0].updatedAt, 200);
});
check('지운 표시를 기기에 남기고 다시 읽는다', () => {
  const s = memory();
  saveStoryRemoved({ a: 30 }, s);
  assert.deepEqual(loadStoryRemoved(s), { a: 30 });
  assert.deepEqual(loadStoryRemoved({ getItem: () => '[1]' }), {});
});
check('★ 영상 묶음에 실린다: 이야기가 계정 칸(videos)으로 같이 합쳐진다 ★', () => {
  const r = mergeVideos({ list: [], stories: { list: [one('a', 10)], removed: {} } }, { list: [], stories: { list: [one('b', 20)], removed: {} } });
  assert.deepEqual(r.stories.list.map((s) => s.id), ['a', 'b']);
  /* 옛 버전이 올린 줄(stories가 없다)과 합쳐도 이 기기의 이야기는 남는다 */
  assert.equal(mergeVideos({ list: [], stories: { list: [one('a', 10)] } }, { list: [] }).stories.list.length, 1);
  assert.deepEqual(mergeVideos({}, {}).stories, { list: [], removed: {} });
});
console.log(`통과 ${pass} / 실패 0`);
