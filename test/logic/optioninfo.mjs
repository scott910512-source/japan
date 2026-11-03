/* 보기마다 읽기 · 뜻 · 듣기 — 줄 만들기와 문제별 보기 정보 */
import { wordInfo, sentenceInfo, textInfo, reviewRows, speakText, hasJapanese } from '../../src/lib/optionInfo.js';
import { vocabQuestion, kanjiQuestion, kanjiMeaningQuestion, kanjiShapeQuestion } from '../../src/lib/n3.js';
import { VOCAB_WORDS } from '../../src/data/n3/vocab.js';
import { KANJI_ITEMS } from '../../src/data/n3/kanji.js';
import { buildQuestion, QUIZ_DIR, QUIZ_TYPE } from '../../src/lib/quiz.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

console.log('\n[ 한 줄 만들기 ]');
{
  const w = wordInfo({ kanji: '食べる', kana: 'たべる', mean: '먹다' });
  ok('낱말 줄', w.jp === '食べる' && w.kana === 'たべる' && w.ko === '먹다');
  ok('읽기가 표기와 같으면 비운다', wordInfo({ kanji: 'ありがとう', kana: 'ありがとう', mean: '고마워' }).kana === '');
  ok('없는 낱말은 null', wordInfo(null) === null && sentenceInfo(null) === null);
  ok('문장 줄', sentenceInfo({ kanji: '水をください', kana: 'みずをください', mean: '물 주세요' }).ko === '물 주세요');
  ok('일본어 글자 판별', hasJapanese('ひかり') && hasJapanese('光') && !hasJapanese('빛'));
  ok('글자만 있는 보기: 일본어는 소리만', textInfo('ひかり').ko === '' && textInfo('ひかり').jp === 'ひかり');
  ok('글자만 있는 보기: 한국어는 뜻만', textInfo('빛').jp === '' && textInfo('빛').ko === '빛');
  ok('빈 값은 null', textInfo('  ') === null);
  ok('소리는 say → 읽기 → 표기 순', speakText({ say: 'a', kana: 'b', jp: 'c' }) === 'a' && speakText({ kana: 'b', jp: 'c' }) === 'b' && speakText({ jp: 'c' }) === 'c');
}

console.log('\n[ 줄 목록 ]');
{
  const opts = ['먹다', '마시다', '자다'];
  const infos = [{ jp: '食べる', kana: 'たべる', ko: '먹다' }, { jp: '飲む', kana: 'のむ', ko: '마시다' }, { jp: '寝る', kana: 'ねる', ko: '자다' }];
  const rows = reviewRows(opts, infos, { isCorrect: (i) => i === 0, isMine: (i) => i === 1 });
  ok('보기 수만큼', rows.length === 3);
  ok('정답·내 답 표시', rows[0].tone === 'correct' && rows[1].tone === 'mine' && rows[2].tone === '');
  ok('번호가 보기 순서', rows.map((r) => r.n).join() === '1,2,3');
  const none = reviewRows(['ひかり', '빛'], null, {});
  ok('정보가 없으면 글자로 나눈다', none[0].jp === 'ひかり' && none[1].ko === '빛');
  ok('정보가 없는 보기는 줄에서 빠져도 번호는 유지', reviewRows(['a', ''], null, {}).length === 1);
}

console.log('\n[ 단어 시험 보기 ]');
{
  const pool = VOCAB_WORDS.slice(0, 40).map((w) => ({ id: w.id, kanji: w.kanji, kana: w.kana, mean: w.mean, level: 'N5' }));
  const q = buildQuestion(pool[3], { type: QUIZ_TYPE.CHOICE, dir: QUIZ_DIR.JP_KO }, pool, () => 0.3);
  ok('모든 보기가 일본어·읽기·뜻을 가진다', q.options.every((o) => o.jp && o.jpKana && o.mean));
  const rows = reviewRows(q.options, q.options.map((o) => wordInfo({ kanji: o.jp, kana: o.jpKana, mean: o.mean })), { isCorrect: (i) => q.options[i].wordId === q.wordId });
  ok('정답 줄이 하나', rows.filter((r) => r.tone === 'correct').length === 1);
}

console.log('\n[ N3 문제의 보기 정보 ]');
{
  const w = VOCAB_WORDS.find((x) => x.kanji !== x.kana) || VOCAB_WORDS[0];
  for (const type of ['ko', 'jp', 'kana']) {
    const q = vocabQuestion(w, type);
    ok(`단어(${type}): 보기와 같은 길이`, Array.isArray(q.optionInfo) && q.optionInfo.length === q.options.length);
    ok(`단어(${type}): 줄마다 표기와 뜻`, q.optionInfo.every((x) => x.jp && x.ko));
  }
  const k = KANJI_ITEMS[0];
  const kr = kanjiQuestion(k);
  ok('한자 읽기: 보기와 같은 길이', kr.optionInfo.length === kr.options.length && kr.optionInfo.every((x) => x.jp && x.ko));
  const km = kanjiMeaningQuestion(k);
  ok('한자 뜻: 한자와 음훈', km.optionInfo.length === km.options.length && km.optionInfo.every((x) => x.jp && x.kana));
  ok('한자 뜻: 소리는 읽기 쪽', km.optionInfo.every((x) => x.say && speakText(x) === x.say));
  const ks = KANJI_ITEMS.find((x) => x.parts && x.parts.includes('+'));
  if (ks) {
    const q = kanjiShapeQuestion(ks);
    ok('한자 모양: 보기마다 뜻', q.optionInfo.every((x) => x.jp && x.ko));
  }
  ok('정답 보기가 정답 줄과 맞는다', (() => { const q = vocabQuestion(w, 'ko'); const i = q.options.indexOf(q.answer); return q.optionInfo[i].jp === w.kanji; })());
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
