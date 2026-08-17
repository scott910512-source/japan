import { clipScript, scriptChars, parseScript } from '../../src/lib/script.js';
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) pass++; else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + JSON.stringify(e) : ''); } };

const mk = (n, len = 10) => Array.from({ length: n }, (_, i) =>
  `[0:${String(i).padStart(2, '0')}] ${'あ'.repeat(len)}`).join('\n');

ok('글자 수는 말한 것만 센다', scriptChars('[0:05] あいうえお') === 5);
ok('시각은 안 센다', scriptChars('[10:05] あい\n[10:09] うえお') === 5);
ok('빈 자막', scriptChars('') === 0);

const short = clipScript(mk(3), 4000);
ok('짧으면 그대로', !short.clipped && short.lines === 3 && short.total === 3, short);

const long = clipScript(mk(100, 50), 400);
ok('길면 앞부분만', long.clipped, long);
ok('한도를 넘지 않음', long.chars <= 400, long.chars);
ok('전체 줄 수도 알려 줌', long.total === 100, long.total);
ok('줄 중간에서 안 자름', parseScript(long.text).every((l) => l.jp.length === 50));
ok('자른 글도 다시 읽힘', parseScript(long.text).length === long.lines);
ok('시각을 지키고 자름', long.text.startsWith('[0:00]'), long.text.slice(0, 12));

const huge = clipScript('[0:01] ' + 'あ'.repeat(9000), 400);
ok('첫 줄이 한도보다 길어도 남긴다', huge.lines === 1 && huge.chars === 9000, huge.chars);

ok('빈 입력도 안전', clipScript('', 400).lines === 0);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
