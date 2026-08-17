import { parseAnalysis } from '../../src/lib/videoTutor.js';
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) pass++; else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };
const err = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };

ok('정상 JSON', JSON.parse(JSON.stringify(parseAnalysis('{"a":1}'))).a === 1);
ok('펜스가 붙어도 읽음', parseAnalysis('```json\n{"a":2}\n```').a === 2);
ok('앞뒤에 말이 붙어도 읽음', parseAnalysis('여기 있습니다 {"a":3} 끝').a === 3);

const cut = err(() => parseAnalysis('{"overview":{"jlpt":"N4","points":["가"'));
ok('잘린 JSON은 잘렸다고 말함', cut.includes('잘렸'), cut);

const junk = err(() => parseAnalysis('완전히 다른 글'));
ok('JSON이 아니면 그렇게 말함', junk.includes('읽지 못했'), junk);
ok('빈 응답', err(() => parseAnalysis('')).includes('빈 응답'));

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
