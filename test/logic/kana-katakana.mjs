/* 외래어(가타카나) 단어의 읽기는 가타카나로 적는다.
 *
 * 단어 자료는 읽기(kana·exampleKana)를 전부 히라가나로 적어서 「パン → ぱん」, 「スケジュール → すけじゅーる」처럼
 * 표기와 읽기가 따로 놀았다. 상황 대화·여행·독해·청해는 이미 가타카나를 그대로 두고 있어 자료마다 규칙이 달랐다(일본인 점검에서 지적).
 * 규칙: 표기가 가타카나만(또는 가타카나+히라가나)이면 읽기는 표기와 같다. 예문의 가타카나 덩어리는 읽기에도 가타카나로 남는다. */
import { ALL_WORDS } from '../../src/data/allWords.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l); } else { fail++; console.log('  ✗', l, e ?? ''); } };

const KANJI = /[㐀-鿿]/;
const KATA = /[ァ-ヶー]+/g;
const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const headBad = ALL_WORDS.filter((w) => /[ァ-ヶ]/.test(w.kanji) && !KANJI.test(w.kanji) && w.kana && hira(w.kanji) === hira(w.kana) && w.kanji !== w.kana);
ok('가타카나 표제어의 읽기가 표기와 같다', headBad.length === 0, headBad.slice(0, 3).map((w) => `${w.id} ${w.kanji}/${w.kana}`).join(' | '));

const exBad = ALL_WORDS.filter((w) => w.example && w.exampleKana && (w.example.match(KATA) || []).filter((r) => r !== 'ー').some((r) => !w.exampleKana.includes(r)));
ok('예문의 가타카나가 예문 읽기에도 가타카나로 남는다', exBad.length === 0, exBad.slice(0, 3).map((w) => `${w.id} ${w.exampleKana}`).join(' | '));

/* 읽기 자체는 안 바뀐다 — 가타카나를 히라가나로 되돌리면 소리가 같다(글자만 바뀌었다) */
const mismatch = ALL_WORDS.filter((w) => w.example && w.exampleKana && hira(w.example).replace(/[㐀-鿿]/g, '').length > 0 && !hira(w.exampleKana).includes(hira((w.example.match(/[ぁ-ゟ]+/g) || [''])[0] || '')));
ok('히라가나 부분은 읽기에도 그대로 있다(읽기가 어긋나지 않았다)', mismatch.length === 0, mismatch.slice(0, 3).map((w) => w.id).join(','));

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
