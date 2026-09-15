/* 「한 권으로 끝내는 N3」 — 자료와 규칙.
 *
 * 자료: 문법 87꼭지(설명·예문·비교·회화·문제·복습감), 한자 300자(한국 한자·훈음·
 *       음훈·부수·단어), 어휘 주제 묶음(N3 단어 전부 한 번씩), 독해 5단계, 청해 3단계,
 *       실전 문제 — 답이 보기 안에 있고, 오답 보기마다 「왜 틀렸나」가 있다.
 * 규칙: 오늘의 N3 계획(어휘→한자→문법→독해/청해→복습), 열었다고 완료가 아님,
 *       숙련도 NEW→LEARNING→REVIEW→MASTER가 판정으로만 오름, 오답 노트 들고 남,
 *       준비도는 맞힌 결과에서만, 진단으로 건너뛰기, 기기 합치기가 불어나지 않음. */
import { GRAMMAR_LESSONS, GRAMMAR_QUESTIONS, GRAMMAR_GROUPS, grammarOfChapter, BLANK } from '../../src/data/n3/grammar.js';
import { KANJI_LESSONS, KANJI_ITEMS, kanjiByChar, kanjiIn } from '../../src/data/n3/kanji.js';
import { VOCAB_LESSONS, VOCAB_WORDS, VOCAB_TOPICS, VOCAB_EXTRA } from '../../src/data/n3/vocab.js';
import { READING_PASSAGES, READING_QUESTIONS } from '../../src/data/n3/reading.js';
import { LISTENING_ITEMS, LISTENING_QUESTIONS, scriptText } from '../../src/data/n3/listening.js';
import { EXAM_MOJI, EXAM_NARABE, EXAM_BUNSHOU, EXAM_SECTIONS } from '../../src/data/n3/exam.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import * as n3 from '../../src/lib/n3.js';
import { applyVerdict, stateOf, addDays, isMastered } from '../../src/lib/review.js';
import { mergeProgress } from '../../src/lib/merge.js';
import { MENUS, MENU_IDS } from '../../src/lib/menu.js';
import { DEFAULT_SETTINGS } from '../../src/lib/storage.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const HANGUL = /[가-힣]/;
const KANJI = /[一-鿿]/;
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

console.log('\n[ 메뉴 ]');
{
  const m = MENUS.find((x) => x.id === 'n3');
  ok('★ 학습 탭 배우기 묶음의 첫 칸이 「한 권으로 끝내는 N3」 ★', m && m.group === 'learn' && m.big && MENUS[0].id === 'n3', m?.label);
  ok('기본 설정에서 켜져 있다', DEFAULT_SETTINGS.menus.n3 === true && MENU_IDS.includes('n3'));
}

console.log('\n[ ★ 문법 — 설명·예문·비교·회화·문제가 다 있다 ★ ]');
{
  ok('여든 꼭지가 넘는다', GRAMMAR_LESSONS.length >= 80, `${GRAMMAR_LESSONS.length}`);
  const ids = new Set(GRAMMAR_LESSONS.map((l) => l.id));
  ok('id가 안 겹친다', ids.size === GRAMMAR_LESSONS.length);
  const thin = GRAMMAR_LESSONS.filter((l) => !l.meaning || !l.structure || !l.why || !(l.compare?.length >= 1) || !(l.examples?.length >= 2) || !(l.dialog?.length >= 2) || !(l.quiz?.length >= 3 && l.quiz.length <= 5));
  ok('★ 꼭지마다 의미·구조·왜·비교·예문 2+·회화·문제 3~5 ★', thin.length === 0, thin.map((l) => l.id).join(',') || '전부');
  const noKana = GRAMMAR_LESSONS.filter((l) => l.examples.some((e) => !e.kana || KANJI.test(e.kana)) || l.dialog.some((d) => !d.kana || KANJI.test(d.kana)));
  ok('예문·회화에 소리로 낼 읽기(kana)가 있고 한자가 안 섞였다', noKana.length === 0, noKana.map((l) => l.id).join(',') || '전부');
  const badQ = GRAMMAR_QUESTIONS.filter((q) => !q.options.includes(q.answer) || new Set(q.options).size !== q.options.length || q.options.length < 3);
  ok('문제의 답이 보기 안에 있고 보기가 안 겹친다', badQ.length === 0, badQ.map((q) => q.id).join(',') || '전부');
  const noWhy = GRAMMAR_QUESTIONS.filter((q) => q.options.some((o) => o !== q.answer && !(q.why?.[o]?.length > 3)));
  ok('★ 오답 보기마다 「왜 틀렸나」가 한국어로 있다 ★', noWhy.length === 0 && GRAMMAR_QUESTIONS.every((q) => q.options.filter((o) => o !== q.answer).every((o) => HANGUL.test(q.why[o]))), noWhy.map((q) => q.id).join(',') || '전부');
  ok('문제마다 정답 설명(expl)이 있다', GRAMMAR_QUESTIONS.every((q) => q.expl?.length > 2));
  ok('문제 id가 안 겹친다', new Set(GRAMMAR_QUESTIONS.map((q) => q.id)).size === GRAMMAR_QUESTIONS.length);
  const blankQ = GRAMMAR_QUESTIONS.filter((q) => q.q.includes(BLANK));
  ok('빈칸 문제가 대부분이다', blankQ.length > GRAMMAR_QUESTIONS.length * 0.8, `${blankQ.length}/${GRAMMAR_QUESTIONS.length}`);

  const ch0 = grammarOfChapter('ch0').map((l) => l.title).join(' ');
  const need0 = ['は / が', 'に / で', 'を / と / へ', '동사 활용', 'て형', 'ない형', 'た형', '가능형', '의지형', '조건형', '～たい', '～ながら', '～たり', '～と思う', '～ので'];
  ok('★ Chapter 0에 N4 핵심 열다섯이 다 있다 ★', need0.every((t) => ch0.includes(t)) && grammarOfChapter('ch0').length === 15, need0.filter((t) => !ch0.includes(t)).join(',') || '전부');
  const groups = GRAMMAR_GROUPS.map((g) => g.id);
  const need2 = ['reason', 'purpose', 'change', 'guess', 'experience', 'condition', 'compare', 'degree', 'time', 'state', 'decision', 'obligation', 'permission', 'hearsay', 'contrast'];
  ok('★ Chapter 2는 열다섯 뜻으로 묶여 있다(가나다순이 아니다) ★', need2.every((g) => groups.includes(g)) && need2.every((g) => n3.CURRICULUM.find((c) => c.id === 'ch2').groups.find((x) => x.id === g).lessons.length >= 2));
  const titles = GRAMMAR_LESSONS.map((l) => l.title.replace(/～/g, '')).join('|');
  ok('★ 비슷한 표현을 나란히 비교한다: ために/ように · そうだ/ようだ/らしい · ことになる/ことにする · ばかり/ところ ★',
    titles.includes('ために / ように') && titles.includes('ようだ / みたいだ') && titles.includes('らしい') && titles.includes('ことになる / ことにする') && titles.includes('ばかり') && titles.includes('ところ'));
  const chapters = { ch0: 0, ch1: 0, ch2: 0 };
  for (const l of GRAMMAR_LESSONS) chapters[l.ch] += 1;
  ok('Chapter 1(기본 문장)에 수식·명사화·자타·수수·수동·사역·경어·접속사', chapters.ch1 === 8 && grammarOfChapter('ch1').map((l) => l.title).join(' ').includes('경어'));
  ok('조사 문제는 「조사」 갈래로 오답 노트에 간다', GRAMMAR_QUESTIONS.filter((q) => q.cat === 'particle').length >= 12);
}

console.log('\n[ ★ 한자 — 한국 한자와 잇고, 연상은 유래와 가른다 ★ ]');
{
  ok('쉰 과 · 오백 자', KANJI_LESSONS.length === 50 && KANJI_ITEMS.length === 500, `${KANJI_LESSONS.length}과 ${KANJI_ITEMS.length}자`);
  ok('과마다 열 자', KANJI_LESSONS.every((l) => l.kanji.length === 10));
  ok('한 자가 두 번 안 나온다', new Set(KANJI_ITEMS.map((k) => k.k)).size === 500);
  /* 흔히 쓰는 N3 한자 목록(367자)을 다 덮는다 — 球·構·猫·幾 넷만 빼고(앱 단어에 거의 안 나온다) */
  const STD_N3 = '政議民連対部合市内相定回選米実関決全表戦経最現調化当約首法性要制治務成期取都和機平加受続進数記初指権支産点報済活原共得解交資予向際勝面告反判認参利組信在件側任引求所次昨論官増係感情投示変打直両式確果容必演歳争談能位置流格疑過局放常状球職与供役構割費付由説難優夫収断石違消神番規術備宅害配警育席訪乗残想声念助労例然限追商葉伝働形景落好退頭負渡失差末守若種美命福望非観察段横深申様財港識呼達良候程満敗値突光路科積他処太客否師登易速存飛殺号単座破除完降責捕危給苦迎園具辞因馬愛富彼未舞亡冷適婦寄込顔類余王返妻背熱宿薬険頼覚船途許抜便留罪努精散静婚喜浮絶幸押倒等老曲払庭徒勤遅居雑招困欠更刻賛抱犯恐息遠戻願絵越欲痛笑互束似列探逃遊迷夢君閉緒折草暮酒悲晴掛到寝暗盗吸陽御歯忘雪吹娘誤洗慣礼窓昔貧怒泳祖杯疲皆鳴腹煙眠怖耳頂箱晩寒髪忙才靴恥偶偉';
  const haveK = new Set(KANJI_ITEMS.map((k) => k.k));
  const missK = [...STD_N3].filter((c) => !haveK.has(c) && !'球構猫幾'.includes(c));
  ok('★ 표준 N3 한자 목록을 다 덮는다 ★', missK.length === 0, missK.join('') || '전부');
  const thin = KANJI_ITEMS.filter((k) => !k.on || !k.kh || !HANGUL.test(k.kh) || !k.rad || !k.parts || !k.mean || !(k.words?.length >= 2));
  ok('★ 자마다 음독·한국 한자음(훈음)·부수·구성·뜻·단어 2+ ★', thin.length === 0, thin.map((k) => k.k).join('') || '전부');
  const badW = KANJI_ITEMS.filter((k) => k.words.some((w) => w.length !== 3 || KANJI.test(w[1]) || !HANGUL.test(w[2]) || !w[0].includes(k.k)));
  ok('단어는 [표기, 읽기(가나), 뜻]이고 그 한자가 들어 있다', badW.length === 0, badW.map((k) => k.k).join('') || '전부');
  const kei = kanjiByChar('経');
  ok('★ 経: 한국 한자 經 · 지날 경 · 経験/経済/経由 ★', kei?.ko === '經' && kei?.kh === '지날 경' && ['経験', '経済', '経由'].every((w) => kei.words.some((x) => x[0] === w)) && kei.diff?.length > 3, `${kei?.ko} ${kei?.kh}`);
  const diffs = KANJI_ITEMS.filter((k) => k.ko && k.ko !== k.k);
  ok('신자체와 다른 한국 한자를 따로 적은 것이 서른 자가 넘고 모양 차이도 적혀 있다', diffs.length >= 30 && diffs.every((k) => k.diff?.length > 3), `${diffs.length}자`);
  ok('★ 연상(memo)과 실제 유래를 가른다 — 유래는 「실제 유래」로 표시 ★', KANJI_ITEMS.filter((k) => k.memo && /실제 유래/.test(k.memo)).length >= 15 && KANJI_ITEMS.filter((k) => k.memo && !/실제 유래/.test(k.memo)).length >= 10);
  ok('낱말 안의 코스 한자를 찾는다(관련 한자)', kanjiIn('経験').map((k) => k.k).join('') === '経験' || kanjiIn('経験').some((k) => k.k === '経'));
  ok('한자 회독 id는 k:漢', KANJI_ITEMS.every((k) => k.id === `k:${k.k}`));
}

console.log('\n[ ★ 어휘 — 주제별, N3 단어 전부 한 번씩, 회독 id 그대로 ★ ]');
{
  const n3Words = ALL_WORDS.filter((w) => w.level === 'N3');
  ok('N3 단어가 천 개 넘는다', n3Words.length >= 1000, `${n3Words.length}`);
  ok('★ 주제 묶음에 N3 단어가 전부 한 번씩 들어간다 ★', VOCAB_WORDS.length === n3Words.length && new Set(VOCAB_WORDS.map((w) => w.id)).size === n3Words.length);
  ok('주제가 열넷(일상·회사·학교·여행·교통·음식·건강·감정·인간관계·뉴스/사회·자연·시간·상태/변화·쇼핑)', VOCAB_TOPICS.length === 14);
  ok('레슨은 열다섯 단어까지', VOCAB_LESSONS.every((l) => l.words.length >= 1 && l.words.length <= 15) && VOCAB_LESSONS.length >= 70, `${VOCAB_LESSONS.length}레슨`);
  ok('주제마다 레슨이 있다', VOCAB_TOPICS.every((t) => VOCAB_LESSONS.some((l) => l.topic === t.id)));
  ok('★ 단어 카드의 회독 id가 앱의 단어 id 그대로다 — 오늘 학습·복습과 이어진다 ★', VOCAB_WORDS.every((w) => ALL_WORDS.some((a) => a.id === w.id)));
  ok('비슷한/반대 표현이 백 개 넘게 적혀 있다', Object.keys(VOCAB_EXTRA).length >= 100 && Object.values(VOCAB_EXTRA).every((e) => (e.syn || e.ant) && [...(e.syn || []), ...(e.ant || [])].every((x) => !HANGUL.test(x))));
}

console.log('\n[ ★ 독해 — 다섯 단계, 구조 → 문법 → 어휘 → 문제 ★ ]');
{
  const byLv = [1, 2, 3, 4, 5].map((lv) => READING_PASSAGES.filter((p) => p.level === lv).length);
  ok('단계마다 네 편 넘는다', byLv.every((n) => n >= 4), byLv.join('/'));
  ok('Level 1은 두세 문장', READING_PASSAGES.filter((p) => p.level === 1).every((p) => p.text.length <= 3));
  ok('Level 2는 안내문·메시지·SNS·이메일', READING_PASSAGES.filter((p) => p.level === 2).every((p) => p.kind));
  const thin = READING_PASSAGES.filter((p) => !(p.analysis?.length >= 2) || !(p.grammar?.length >= 2) || !(p.vocab?.length >= 2) || !(p.questions?.length >= 1) || p.text.some((s) => !s.kana || !s.ko));
  ok('★ 지문마다 문장 구조 분석·핵심 문법·핵심 어휘·문제, 문장마다 읽기와 뜻 ★', thin.length === 0, thin.map((p) => p.id).join(',') || '전부');
  const gids = new Set(GRAMMAR_LESSONS.map((l) => l.id));
  const badRef = READING_PASSAGES.filter((p) => p.grammar.some((g) => g.ref && !gids.has(g.ref)));
  ok('핵심 문법이 문법 레슨으로 이어진다(ref가 실제 레슨)', badRef.length === 0, badRef.map((p) => p.id).join(',') || '전부');
  const badQ = READING_QUESTIONS.filter((q) => !q.options.includes(q.answer) || q.options.some((o) => o !== q.answer && !q.why?.[o]));
  ok('독해 문제의 답이 보기 안에, 오답마다 이유', badQ.length === 0, badQ.map((q) => q.id).join(',') || '전부');
  ok('실전(L5)에 정보 검색과 주장 파악이 있다', READING_PASSAGES.filter((p) => p.level === 5).some((p) => p.kind === '정보 검색') && READING_PASSAGES.filter((p) => p.level === 5).some((p) => !p.kind));
}

console.log('\n[ ★ 청해 — 스크립트는 kana로 읽고, 문제·분석·섀도잉 ★ ]');
{
  ok('열여덟 항목 · 세 단계', LISTENING_ITEMS.length >= 18 && [1, 2, 3].every((lv) => LISTENING_ITEMS.filter((l) => l.level === lv).length >= 5));
  const bad = LISTENING_ITEMS.filter((l) => l.script.some((s) => !s.kana || KANJI.test(s.kana) || !s.ko) || !(l.analysis?.length >= 2) || !(l.shadow?.length >= 1) || l.shadow.some((i) => !l.script[i]) || !l.options.includes(l.answer));
  ok('★ 줄마다 가나 읽기·뜻, 분석 2+, 섀도잉 줄, 답이 보기 안 ★', bad.length === 0, bad.map((l) => l.id).join(',') || '전부');
  ok('실전(L3)은 과제·포인트·개요 이해', LISTENING_ITEMS.filter((l) => l.level === 3).every((l) => l.ask && l.intro));
  ok('전체 스크립트를 한 번에 읽을 글에는 한자가 없다', LISTENING_ITEMS.every((l) => !KANJI.test(scriptText(l))));
  ok('청해 문제는 「청해」 갈래', LISTENING_QUESTIONS.every((q) => q.cat === 'listening' && q.ref.startsWith('l:')));
}

console.log('\n[ 실전 문제 — 유형은 JLPT를 참고, 문장은 독자적 ]');
{
  ok('영역 넷', EXAM_SECTIONS.length === 4);
  const secs = {};
  for (const q of EXAM_MOJI) secs[q.sec] = (secs[q.sec] || 0) + 1;
  ok('문자·어휘: 읽기·표기·문맥·바꿔 말하기·용법이 다 있다', ['moji-yomi', 'moji-hyoki', 'moji-bunmyaku', 'moji-iikae', 'moji-youhou'].every((s) => secs[s] >= 6), JSON.stringify(secs));
  ok('문자·어휘 문제의 답이 보기 안에, 오답마다 이유', EXAM_MOJI.every((q) => q.options.includes(q.answer) && q.options.filter((o) => o !== q.answer).every((o) => q.why?.[o])));
  ok('★ 배열(★) 문제의 답은 바른 순서의 ★ 자리 조각 ★', EXAM_NARABE.length >= 10 && EXAM_NARABE.every((q) => q.answer === q.pieces[q.star] && q.star < q.pieces.length));
  ok('글의 문법 지문에 빈칸 넷', EXAM_BUNSHOU.every((p) => p.blanks.length === 4 && p.blanks.every((b) => p.text.includes(`【${b.n}】`) && b.options.includes(b.answer))));
}

console.log('\n[ ★ 오늘의 N3 — 어휘 → 한자 → 문법 → 독해/청해 → 복습 ★ ]');
{
  const empty = n3.emptyN3();
  const day1 = n3.ensureDayPlan(empty, {}, '2026-09-15');
  const kinds = day1.plan.steps.map((s) => s.kind);
  ok('★ 첫날: 어휘 → 한자 → 문법 → 독해 (복습할 게 없으니 복습 없음) ★', kinds.join(',') === 'vocab,kanji,grammar,reading', kinds.join(','));
  ok('어휘 여덟 · 한자 넷 — 한 번에 너무 많지 않게', day1.plan.steps[0].ids.length === 8 && day1.plan.steps[1].ids.length === 4);
  ok('문법은 하루 한 꼭지, Chapter 0 첫 꼭지부터', day1.plan.steps[2].lesson === 'g:wa-ga' && !day1.plan.steps[2].ids);
  ok('같은 날 다시 짜지 않는다', n3.ensureDayPlan(day1.n3, {}, '2026-09-15').plan === day1.n3.days['2026-09-15']);
  /* 둘째 날: 독해·청해가 번갈아, 복습이 생긴다 */
  let review = {};
  for (const id of day1.plan.steps[0].ids) review[id] = applyVerdict(undefined, 'known', '2026-09-15');
  let p = day1.n3;
  for (let i = 0; i < 4; i += 1) p = n3.markStep(p, '2026-09-15', i, true);
  ok('단계를 끝내면 done', n3.dayStatus(p.days['2026-09-15']).finished);
  const day2 = n3.ensureDayPlan(p, review, '2026-09-16');
  const k2 = day2.plan.steps.map((s) => s.kind);
  ok('★ 둘째 날: 청해 차례, 어제 외운 단어가 복습으로 ★', k2.includes('listening') && !k2.includes('reading') && k2.at(-1) === 'review' && day2.plan.steps.at(-1).ids.length === 8, k2.join(','));
  ok('어휘 단계는 어제 것 다음 것(아직 안 본 것)', day2.plan.steps[0].ids.every((id) => !review[id]));
  ok('오늘·이번 주 학습량은 답한 수로', n3.todayAmount(n3.recordAnswer(p, { qid: 'x', ok: true, today: '2026-09-15' }), '2026-09-15').answered === 1);
}

console.log('\n[ ★ 열었다고 완료가 아니다 · 숙련도는 판정으로만 ★ ]');
{
  const p = n3.emptyN3();
  ok('레슨을 안 풀면 완료 아님', !n3.isLessonDone(p, {}, 'g:wa-ga') && n3.progressOf(p, {}).pct === 0);
  const done = n3.markLesson(p, 'g:wa-ga', { score: 1 });
  ok('문제까지 풀면 완료', n3.isLessonDone(done, {}, 'g:wa-ga') && n3.nextLesson(done, {}, 'grammar') === 'g:ni-de');
  ok('어휘 레슨은 그 안의 단어를 전부 판정했을 때 완료', (() => {
    const l = VOCAB_LESSONS[0]; const r = {};
    for (const w of l.words) r[w.id] = applyVerdict(undefined, 'known', '2026-09-15');
    return n3.isLessonDone(p, r, l.id) && !n3.isLessonDone(p, {}, l.id);
  })());
  ok('준비도는 처음 0', n3.readinessOf(p, {}).total === 0);
  const r = {};
  for (const w of VOCAB_WORDS.slice(0, 300)) r[w.id] = applyVerdict(undefined, 'known', '2026-09-15');
  ok('★ 맞히면 준비도가 오르고, 진도율과 다른 숫자다 ★', n3.readinessOf(p, r).vocab > 0 && n3.readinessOf(p, r).vocab < 30 && n3.progressOf(p, r).vocab.done >= 20, `어휘 준비도 ${n3.readinessOf(p, r).vocab}% · 진도 ${n3.progressOf(p, r).vocab.done}레슨`);
  ok('갈래 가중치 합이 1', Math.abs(Object.values(n3.READINESS_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  ok('판정: 다 맞히면 알아요 · 반 이상 애매해요 · 그 밑은 몰라요', n3.verdictFor(4, 4) === 'known' && n3.verdictFor(2, 4) === 'vague' && n3.verdictFor(1, 4) === 'unknown');
}

console.log('\n[ ★ NEW → LEARNING → REVIEW → MASTER ★ ]');
{
  let st;
  ok('처음은 NEW', n3.masteryOf(stateOf({}, 'g:x')) === 'new');
  st = applyVerdict(undefined, 'unknown', '2026-09-15');
  ok('틀리면 LEARNING, 오늘 다시', n3.masteryOf(st) === 'learning' && st.due === '2026-09-15');
  st = applyVerdict(st, 'known', '2026-09-15');
  ok('맞히면 REVIEW, 다음 복습은 내일(1일)', n3.masteryOf(st) === 'review' && st.due === '2026-09-16');
  let day = '2026-09-16';
  for (let i = 0; i < 3; i += 1) { st = applyVerdict(st, 'known', day); day = st.due; }
  ok('★ 복습일마다 맞혀 네 번 쌓이면 MASTER (1 → 3 → 7 → 30일) ★', isMastered(st) && n3.masteryOf(st) === 'master', `level ${st.level} · 다음 ${st.due}`);
  const same = applyVerdict(applyVerdict(undefined, 'known', '2026-09-15'), 'known', '2026-09-15');
  ok('같은 날 여러 번 맞혀도 한 칸만 — MASTER가 아니다', same.level === 1 && !isMastered(same));
  const fell = applyVerdict(st, 'unknown', st.due);
  ok('MASTER라도 틀리면 다시 LEARNING(짧은 주기)', n3.masteryOf(fell) === 'learning');
  ok('준비도 무게: MASTER 1 > REVIEW > LEARNING > NEW 0', n3.readinessWeight(st) === 1 && n3.readinessWeight(applyVerdict(undefined, 'known', '2026-09-15')) > n3.readinessWeight(applyVerdict(undefined, 'unknown', '2026-09-15')) && n3.readinessWeight(undefined) === 0);
}

console.log('\n[ ★ 오답 노트 — 틀리면 들어오고 두 번 이어 맞히면 나간다 ★ ]');
{
  let p = n3.emptyN3();
  p = n3.recordAnswer(p, { qid: 'q:ni-de-3', ok: false, cat: 'particle', ref: 'g:ni-de', today: '2026-09-15' });
  ok('틀린 문제가 「조사」 갈래에 쌓인다', n3.wrongNotes(p).byCat.particle.length === 1 && p.q['q:ni-de-3'].w === 1);
  p = n3.recordAnswer(p, { qid: 'q:ni-de-3', ok: true, today: '2026-09-15' });
  ok('한 번 맞혀서는 안 빠진다', n3.wrongNotes(p).list.length === 1 && p.wrong['q:ni-de-3'].ok === 1);
  p = n3.recordAnswer(p, { qid: 'q:ni-de-3', ok: true, today: '2026-09-15' });
  ok('두 번 이어 맞히면 빠진다 — 정답률 기록은 남는다', n3.wrongNotes(p).list.length === 0 && p.q['q:ni-de-3'].r === 2);
  /* 반복해서 틀리는 유형 */
  let w = n3.emptyN3();
  for (const q of ['q:ni-de-1', 'q:ni-de-2', 'q:ni-de-3']) w = n3.recordAnswer(w, { qid: q, ok: false, cat: 'particle', ref: 'g:ni-de', today: '2026-09-15' });
  w = n3.recordAnswer(w, { qid: 'q:tai-1', ok: false, cat: 'grammar', ref: 'g:tai', today: '2026-09-15' });
  const pats = n3.weakPatterns(w);
  ok('★ 최근 약점: に/で가 맨 위(세 번 틀림), 한 번 틀린 건 아직 아님 ★', pats[0]?.title === 'に / で' && !pats.some((x) => x.ref === 'g:tai'), pats.map((x) => `${x.title}:${x.w}`).join(' '));
  const sess = n3.weakSession(w, 12, rnd);
  ok('약점만 공부하기 — 틀린 문제와 그 꼭지의 다른 문제로 판을 짠다', sess.questions.length >= 4 && sess.questions.every((q) => q.ref === 'g:ni-de' || q.ref === 'g:tai') && sess.patterns[0].ref === 'g:ni-de');
  ok('단어·한자 문제도 id에서 다시 만들 수 있어 오답 노트에 뜬다', n3.questionById('vq:n3-0001:ko')?.answer === '포기하다' && n3.questionById('kq:経:0')?.answer === 'けいけん' && n3.questionById('q:ni-de-3')?.answer === 'に');
}

console.log('\n[ ★ 진단으로 건너뛰기 · 확인 테스트 · 모의고사 ★ ]');
{
  const diag = n3.checkTest('t:ch0', n3.emptyN3(), {}, rnd);
  ok('진단은 꼭지마다 한 문제, 열다섯', diag.length === 15 && new Set(diag.map((q) => q.ref)).size === 15);
  const skipped = n3.applyDiagnosis(n3.emptyN3(), { 'g:wa-ga': true, 'g:ni-de': true, 'g:o-to-e': false });
  ok('★ 맞힌 꼭지는 계획에서 빠지고 틀린 꼭지부터 배운다 ★', n3.nextLesson(skipped, {}, 'grammar') === 'g:o-to-e' && n3.isLessonDone(skipped, {}, 'g:wa-ga'));
  ok('Chapter 확인 테스트는 스무 문제', n3.checkTest('t:ch2', n3.emptyN3(), {}, rnd).length === 20 && n3.checkTest('t:ch1', n3.emptyN3(), {}, rnd).length === 8);
  ok('어휘·한자 확인 테스트는 배운 것에서 스무 문제', n3.checkTest('t:vocab', n3.emptyN3(), {}, rnd).length === 20 && n3.checkTest('t:kanji', n3.emptyN3(), {}, rnd).length === 20);
  const ex = n3.mockExam(rnd);
  ok('★ 모의고사: 문자·어휘 25 · 문법 22(문의 문법 13 + 배열 5 + 글의 문법 4) · 독해 4지문 · 청해 6 ★', ex.moji.length === 25 && ex.bunpo.length === 22 && ex.reading.length === 4 && ex.listening.length === 6, `${ex.moji.length}/${ex.bunpo.length}/${ex.reading.length}/${ex.listening.length}`);
  ok('문의 문법에 N4(ch0) 문제는 안 섞는다', ex.bunpo.filter((q) => q.sec === 'bunpo-1').every((q) => GRAMMAR_LESSONS.find((l) => l.id === q.ref)?.ch !== 'ch0'));
  const t = n3.recordTest(n3.emptyN3(), 'exam', { right: 30, total: 57 });
  const t2 = n3.recordTest(t, 'exam', { right: 20, total: 57 });
  ok('시험 결과는 최고·최근을 따로 남긴다', Math.abs(t2.tests.exam.best - 30 / 57) < 1e-9 && Math.abs(t2.tests.exam.last - 20 / 57) < 1e-9 && t2.tests.exam.tries === 2);
}

console.log('\n[ 문제 만들기 ]');
{
  const vq = n3.vocabQuestions(VOCAB_WORDS.slice(0, 9).map((w) => w.id), rnd);
  ok('단어 문제는 뜻·일본어·읽기 세 유형이 돌아간다', vq.length === 9 && new Set(vq.map((q) => q.id.split(':')[2])).size === 3);
  ok('보기 셋, 답이 안에, 뜻이 겹치지 않는다', vq.every((q) => q.options.length === 3 && q.options.includes(q.answer) && new Set(q.options).size === 3));
  const kq = n3.kanjiQuestions(KANJI_ITEMS.slice(0, 5).map((k) => k.id), rnd);
  ok('한자 문제는 그 한자가 든 단어의 읽기', kq.every((q) => q.options.includes(q.answer) && q.options.length === 3 && !KANJI.test(q.answer)));
  const rq = n3.reviewQuestions(['g:wa-ga', 'k:経', VOCAB_WORDS[0].id], rnd);
  ok('복습 단계는 문법·한자·단어 id를 각각 문제로', rq.length === 3 && rq[0].ref === 'g:wa-ga' && rq[1].ref === 'k:経' && rq[2].ref === VOCAB_WORDS[0].id);
}

console.log('\n[ ★ 기기 합치기 — 안 불어나고 안 잃는다 ★ ]');
{
  let a = n3.emptyN3();
  a = n3.markLesson(a, 'g:wa-ga', { score: 0.75 });
  a = n3.recordAnswer(a, { qid: 'q:wa-ga-1', ok: false, cat: 'particle', ref: 'g:wa-ga', today: '2026-09-15' });
  a = n3.recordTest(a, 't:ch1', { right: 15, total: 20 });
  let b = n3.emptyN3();
  b = n3.markLesson(b, 'g:ni-de', { score: 1 });
  b = n3.recordAnswer(b, { qid: 'q:wa-ga-1', ok: false, cat: 'particle', ref: 'g:wa-ga', today: '2026-09-15' });
  b = n3.recordAnswer(b, { qid: 'q:wa-ga-1', ok: false, cat: 'particle', ref: 'g:wa-ga', today: '2026-09-15' });
  b = n3.recordTest(b, 't:ch1', { right: 18, total: 20 });
  const m = n3.mergeN3(a, b);
  ok('레슨 완료는 합집합', m.lessons['g:wa-ga'].done && m.lessons['g:ni-de'].done);
  ok('틀린 수는 큰 쪽(더하지 않는다)', m.q['q:wa-ga-1'].w === 2 && m.wrong['q:wa-ga-1'].c === 2);
  ok('시험은 최고 점수', Math.abs(m.tests['t:ch1'].best - 0.9) < 1e-9);
  const twice = n3.mergeN3(m, m);
  ok('같은 걸 두 번 합쳐도 그대로', JSON.stringify(twice) === JSON.stringify(m));
  const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
  ok('순서를 바꿔도 같다', canon(n3.mergeN3(b, a)) === canon(m));
  const merged = mergeProgress({ known: [], n3: a }, { known: [], n3: b });
  ok('★ progress 합치기가 n3를 같이 합친다(동기화에 실린다) ★', merged.n3?.lessons?.['g:ni-de']?.done === true);
  ok('둘 다 없으면 만들지 않는다', mergeProgress({ known: [] }, { known: [] }).n3 === null);
  ok('옛 기록(칸 없음)도 모양을 맞춘다', n3.normalizeN3(undefined).lessons && n3.normalizeN3({ lessons: 'x' }).lessons && Array.isArray(n3.normalizeN3({ exams: 'x' }).exams));
}

console.log('\n[ 주간 · 준비도 갈래 ]');
{
  let p = n3.emptyN3();
  for (const d of ['2026-09-10', '2026-09-14', '2026-09-15']) p = n3.recordAnswer(p, { qid: 'q:wa-ga-1', ok: true, today: d });
  const w = n3.weekAmount(p, '2026-09-15');
  ok('이번 주는 최근 7일(9/9~15)만 — 9/10·14·15 세 날', w.days === 3 && w.answered === 3);
  ok('커리큘럼 챕터 0~7, 실전은 마지막', n3.CURRICULUM.length === 8 && n3.CURRICULUM.at(-1).kind === 'exam');
  ok('레슨 제목', n3.lessonTitle('g:wa-ga') === 'は / が' && n3.lessonTitle('k:1').includes('한자 1과') && n3.lessonTitle('t:ch0').includes('진단'));
  ok('오늘 복습감은 코스 안의 id에서만', n3.dueInCourse({ zzz: applyVerdict(undefined, 'known', '2026-09-01'), 'g:wa-ga': applyVerdict(undefined, 'known', '2026-09-01') }, '2026-09-15').join() === 'g:wa-ga');
  ok(`자료 크기: 문법 ${n3.COUNTS.grammar} · 단어 ${n3.COUNTS.vocab} · 한자 ${n3.COUNTS.kanji} · 독해 ${n3.COUNTS.reading} · 청해 ${n3.COUNTS.listening} · 문제 ${n3.COUNTS.questions}`, n3.COUNTS.questions > 400);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
