/* 단어 데이터 자체를 훑는다.
 *
 * 학습이 전부 이 데이터 위에 서 있다. 여기가 틀리면 회독도 시험도 틀린 걸
 * 가르친다 — 그런데 화면만 보면 멀쩡해 보여서 안 걸린다. 그래서 따로 잰다. */
import { ALL_WORDS } from '../../src/data/allWords.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

ok('단어가 있음', ALL_WORDS.length > 2000, `${ALL_WORDS.length}개`);

/* 같은 한자가 두 번 들어 있는데 뜻·품사·읽기가 다르면, 회독에서는 A를 외우고
   시험에서는 B가 정답이 되는 일이 생긴다. mergeUnique가 하나로 합쳐야 한다. */
const byKanji = new Map();
for (const w of ALL_WORDS) {
  if (!byKanji.has(w.kanji)) byKanji.set(w.kanji, []);
  byKanji.get(w.kanji).push(w);
}
const clash = (field) => [...byKanji.entries()]
  .filter(([, ws]) => ws.length > 1 && new Set(ws.map((w) => w[field])).size > 1)
  .map(([k, ws]) => `${k}(${ws.map((w) => w[field]).join('/')})`);

for (const [field, label] of [['mean', '뜻'], ['type', '품사'], ['kana', '읽기']]) {
  const bad = clash(field);
  ok(`같은 한자인데 ${label}이 갈리지 않음`, bad.length === 0, bad.slice(0, 3).join(', ') || undefined);
}

// 빈 칸이 있으면 카드 뒷면이 비거나 음성이 아무것도 안 읽는다
for (const f of ['kanji', 'kana', 'mean', 'type', 'level', 'example', 'exampleKana', 'exampleKo']) {
  const n = ALL_WORDS.filter((w) => !w[f]).length;
  ok(`${f}가 빈 단어 없음`, n === 0, n ? `${n}개` : undefined);
}

/* 읽기(kana)에 한자가 섞이면 음성이 그걸 그대로 읽는다 — 「海」를 うみ가 아니라
   カイ로 읽어 버리는 식이라, 읽는 법을 배우러 온 사람에게 틀린 소리를 들려준다. */
const KANJI = /[一-鿿]/;
const badKana = ALL_WORDS.filter((w) => KANJI.test(w.kana || ''));
ok('읽기에 한자가 안 섞임', badKana.length === 0, badKana.slice(0, 3).map((w) => `${w.id} ${w.kana}`).join(', ') || undefined);
const badEx = ALL_WORDS.filter((w) => KANJI.test(w.exampleKana || ''));
ok('예문 읽기에 한자가 안 섞임', badEx.length === 0, badEx.slice(0, 3).map((w) => w.id).join(', ') || undefined);

// id가 겹치면 회독 기록이 두 단어에 같이 붙는다
const seen = new Map();
for (const w of ALL_WORDS) seen.set(w.id, (seen.get(w.id) || 0) + 1);
const dupIds = [...seen].filter(([, n]) => n > 1);
ok('id가 안 겹침', dupIds.length === 0, dupIds.slice(0, 3).map(([i]) => i).join(', ') || undefined);

// 규격 밖 값이 들어오면 레벨 필터·품사 표시가 조용히 어긋난다
const LV = new Set(['N5', 'N4', 'N3', 'N2', 'N1']);
const TY = new Set(['verb', 'noun', 'adj-i', 'adj-na', 'adv', 'conj', 'etc', 'pron', 'num', 'expr', 'prefix', 'suffix']);
const oddLv = [...new Set(ALL_WORDS.map((w) => w.level).filter((l) => !LV.has(l)))];
const oddTy = [...new Set(ALL_WORDS.map((w) => w.type).filter((t) => !TY.has(t)))];
ok('레벨이 규격 안에 있음', oddLv.length === 0, oddLv.join(', ') || undefined);
ok('품사가 규격 안에 있음', oddTy.length === 0, oddTy.join(', ') || undefined);

// 레벨별로 실제로 몇 개인지 — 데이터가 통째로 빠지면 여기서 보인다
const count = (l) => ALL_WORDS.filter((w) => w.level === l).length;
ok('N5가 있음', count('N5') > 400, `${count('N5')}개`);
ok('N4가 있음', count('N4') > 400, `${count('N4')}개`);
ok('N3가 있음', count('N3') > 900, `${count('N3')}개`);
console.log(`  · N2 ${count('N2')}개 · N1 ${count('N1')}개 (아직 없음 — 회화 목표에는 N3까지면 된다)`);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
