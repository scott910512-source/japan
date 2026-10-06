/* JLPT 문장 듣기 — 급수별 문장만.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 자동 듣기를 틀었더니 N3이 섞여 와서 몇몇 낱말 말고는 안 들렸다. 그래서
 * 급수를 골라 그 급수의 문장만 돌게 했다. 깨지기 쉬운 자리는 셋이다.
 *
 *   · 목록이 빈다 — 예문·회화 어느 한쪽을 못 읽으면 조용히 줄어든다.
 *     N5가 수백 개여야 하는데 스무 개면 그게 신호다.
 *   · 급수가 샌다 — N5 낱말의 예문에 N4 낱말이 끼어 있는 것이 서른 개쯤
 *     있다. 그게 N5로 들리면 「N5인데 왜 모르지」가 된다.
 *   · 카드를 못 푼다 — 예문은 단어장에 카드로 없다. 큐의 id를 못 찾으면
 *     조용히 버려지고 「들을 게 없어요」가 뜬다. */
import { ALL_WORDS } from '../../src/data/allWords.js';
import { allSentenceCards } from '../../src/lib/content.js';
import { cardsForQueue } from '../../src/lib/cards.js';
import {
  JLPT_LEVELS, exampleCard, exampleId, jlptCounts, jlptPool, jlptSentences, poolOf,
} from '../../src/lib/jlptListen.js';
import { SCOPES, blocksIn, inScope, pickListen, scopeCounts } from '../../src/lib/listen.js';
import { readListen } from '../../src/lib/listenSettings.js';
import { defaultLexicon, gradeSentence } from '../../src/lib/sentlevel.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const SENT = allSentenceCards();
const RANK = { N5: 0, N4: 1, N3: 2 };
const lex = defaultLexicon();

console.log('\n[ 급수마다 문장이 넉넉한가 ]');
{
  const counts = jlptCounts(ALL_WORDS, SENT);
  ok('급수는 N5 · N4 · N3', JLPT_LEVELS.join() === 'N5,N4,N3');
  /* 예문 500 안팎 + 회화 280 안팎. 절반 밑으로 떨어지면 한쪽을 못 읽는 것이다. */
  ok('★ N5가 수백 개 ★', counts.N5 >= 600, `${counts.N5}문장`);
  ok('N4도 수백 개', counts.N4 >= 600, `${counts.N4}문장`);
  ok('N3이 제일 많다', counts.N3 > counts.N4 && counts.N3 >= 1500, `${counts.N3}문장`);
  ok('모르는 급수는 빈손', jlptSentences('N2', ALL_WORDS, SENT).length === 0);
  ok('단어장 없이는 회화만 남는다', jlptSentences('N5', [], SENT).every((c) => !c.id.startsWith('ex:')));
}

console.log('\n[ 문장 카드가 성한가 ]');
for (const L of JLPT_LEVELS) {
  const list = jlptSentences(L, ALL_WORDS, SENT, lex);
  const ids = list.map((c) => c.id);
  const texts = list.map((c) => c.kanji);
  ok(`${L} — id가 겹치지 않는다`, new Set(ids).size === ids.length);
  ok(`${L} — 같은 문장이 두 번 없다`, new Set(texts).size === texts.length);
  ok(`${L} — 전부 문장 카드(kanji · kana · mean · kind)`,
    list.every((c) => c.kanji && c.kana && c.mean && c.kind === 'sentence'));
  ok(`${L} — 낱말은 안 섞인다`, list.every((c) => c.kind !== 'word' && c.type === 'sentence'));
  ok(`${L} — 예문이 먼저, 회화가 뒤`, (() => {
    let seenSit = false;
    for (const c of list) {
      if (c.id.startsWith('ex:')) { if (seenSit) return false; } else seenSit = true;
    }
    return list[0]?.id.startsWith('ex:');
  })());
  /* ★ 급수가 새지 않는다 ★ 그 급수를 넘는 낱말이 든 문장은 없다 */
  const leak = list.filter((c) => {
    const g = gradeSentence({ jp: c.kanji }, lex);
    return g.level != null && (RANK[g.level] ?? 9) > RANK[L];
  });
  ok(`★ ${L} — 그 급수를 넘는 낱말이 든 문장이 없다 ★`, leak.length === 0,
    leak.slice(0, 3).map((c) => c.kanji).join(' | ') || '없음');
  ok(`${L} — 회화 문장의 급수는 그 급수`,
    list.filter((c) => !c.id.startsWith('ex:')).every((c) => c.level === L));
}

console.log('\n[ 예문 카드 ]');
{
  const w = ALL_WORDS.find((x) => x.level === 'N5' && x.example);
  const c = exampleCard(w);
  ok('예문이 앞면, 뜻이 뒷면', c.kanji === w.example && c.mean === w.exampleKo && c.kana === w.exampleKana);
  ok('id는 낱말 id에 표를 붙인 것', c.id === exampleId(w.id) && c.id !== w.id);
  ok('어느 낱말의 예문인지 남긴다', c.word === w.kanji && c.wordMean === w.mean);
  ok('예문 없는 낱말은 null', exampleCard({ id: 'x', kanji: 'x' }) === null);
}

console.log('\n[ 듣기 범위에 꽂히는가 ]');
{
  const list = jlptSentences('N5', ALL_WORDS, SENT, lex);
  const pool = jlptPool('N5', ALL_WORDS, SENT, lex);
  const today = '2026-10-04';
  ok('범위 목록에 JLPT 문장이 있다', SCOPES.some((s) => s.id === 'jlpt' && s.label && s.sub));
  ok('기본 급수는 N5', readListen({}, 'jlptLevel') === 'N5');
  ok('저장된 급수를 읽는다', readListen({ listenJlptLevel: 'N4' }, 'jlptLevel') === 'N4');
  ok('급수는 내력이 아니라 목록이 정한다 — 안 본 카드도 범위 안',
    inScope({ box: 0, wrongCount: 0 }, 'jlpt', today));

  const counts = scopeCounts(pool, {}, today, null, false, null, null, pool);
  ok('★ 범위 수가 목록과 같다 ★', counts.jlpt === list.length, `${counts.jlpt}`);
  ok('목록을 안 주면 빈손 — 「다 들린다」보다 낫다',
    scopeCounts(pool, {}, today).jlpt === 0
    && pickListen(pool, {}, { scope: 'jlpt', count: 20, today }).length === 0);
  ok('다른 범위 수는 그대로다', counts.all === pool.length);

  const first = pickListen(pool, {}, { scope: 'jlpt', count: 20, today, jlpt: pool, order: 'block', blocks: [0] });
  ok('1구간은 목록의 첫 스무 개', first.length === 20 && first.every((x, i) => x.id === pool[i].id));
  ok('구간 수는 목록 ÷ 개수', blocksIn(pool, {}, { scope: 'jlpt', count: 20, today, jlpt: pool }) === Math.ceil(pool.length / 20));

  /* ★ 큐를 카드로 푼다 ★ 예문은 단어장에 없으니 extra로 같이 줘야 한다 */
  const cards = cardsForQueue(first, ALL_WORDS, SENT, list);
  ok('★ 큐의 문장이 전부 카드로 풀린다 ★', cards.length === first.length, `${cards.length} / ${first.length}`);
  ok('예문 카드를 안 주면 예문이 조용히 사라진다 — 그래서 줘야 한다',
    cardsForQueue(first, ALL_WORDS, SENT).length < first.length);

  /* 셋째 자리에 객체로 줘도 같다 — 자리 여덟 개를 세다 밀리는 것을 막는다 */
  const byOpts = scopeCounts(pool, {}, { today, jlpt: pool });
  ok('객체로 준 범위 수가 자리로 준 것과 같다', byOpts.jlpt === counts.jlpt && byOpts.all === counts.all);
  ok('후보 모양은 poolOf 한 곳이 정한다', poolOf(list).every((x, i) => x.id === pool[i].id && x.kind === 'sentence'));

  /* 다른 급수는 다른 목록이다 */
  const n4 = jlptPool('N4', ALL_WORDS, SENT, lex);
  ok('N4 목록은 N5와 겹치지 않는다', !n4.some((x) => pool.some((y) => y.id === x.id)));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
