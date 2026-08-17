import { parseScript, withDurations, toSeconds, formatTime, hasTimes } from '../../src/lib/script.js';
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) pass++; else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + JSON.stringify(e) : ''); } };

ok('분:초', toSeconds('1:30') === 90);
ok('시:분:초', toSeconds('1:02:03') === 3723);
ok('이상한 값', toSeconds('없음') === null);
ok('시간 표기', formatTime(90) === '1:30' && formatTime(3723) === '1:02:03');

const a = parseScript('[00:12] やっぱり外で食べる\n[00:15] ラーメンって美味しい。');
ok('대괄호 시간', a.length === 2 && a[0].at === 12 && a[0].jp === 'やっぱり外で食べる', a);

const b = parseScript('0:12\nこんにちは。\n0:20\n元気ですか。');
ok('시간이 따로 한 줄', b.length === 2 && b[1].at === 20 && b[1].jp === '元気ですか。', b);

const c = parseScript('WEBVTT\n\n1\n00:00:12,340 --> 00:00:15,000\nこんにちは。\n\n2\n00:00:15,000 --> 00:00:18,000\n元気ですか。');
ok('srt/vtt', c.length === 2 && c[0].at === 12 && c[1].jp === '元気ですか。', c);

const d = parseScript('こんにちは。\n元気ですか。');
ok('시간 없이 본문만', d.length === 2 && d[0].at === null);
ok('시간 유무 판별', !hasTimes(d) && hasTimes(a));

const e = parseScript('[00:12] やっぱり外で食べる\nラーメンって味が違いますよね。\n[00:20] そうですね。');
ok('끊긴 줄을 이어 붙임', e.length === 2 && e[0].jp === 'やっぱり外で食べるラーメンって味が違いますよね。', e);

const f = withDurations(parseScript('[00:10] あ\n[00:14] い\n[00:20] う'));
ok('길이 계산', f[0].dur === 4 && f[1].dur === 6 && f[2].dur === 6, f);

ok('빈 입력', parseScript('').length === 0 && parseScript(null).length === 0);
ok('공백만', parseScript('\n\n   \n').length === 0);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
