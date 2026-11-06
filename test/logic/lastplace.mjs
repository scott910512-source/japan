/* 앱이 다시 떠도 마지막에 있던 자리에서 잇는다 — 규칙 검사.
 * 오랜만에 돌아오면 어디 있었든 홈으로 튕기던 것(주소가 없는 앱이라 상태가 날아간다)을 막는다.
 * 단, 오래되면(6시간, 다른 날) 쓰지 않는다 — 아침에 열었는데 어제 저녁 화면이면 오늘 퀘스트가 안 보인다. */
import { PLACE_KEY, PLACE_MAX_AGE, readPlace, writePlace } from '../../src/lib/lastplace.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l); } else { fail++; console.log('  ✗', l, e ?? ''); } };

const mem = new Map();
const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); } };
const NOW = 1_700_000_000_000; const TODAY = '2026-11-06';
const subs = ['quiz', 'n3', 'worddeck', 'swiss', 'listen'];
const put = (o) => mem.set(PLACE_KEY, JSON.stringify(o));
const read = (extra = {}) => readPlace({ now: NOW + 1000, today: TODAY, validSubs: subs, storage, ...extra });

mem.clear();
ok('저장된 게 없으면 홈에서 시작', read() === null);

writePlace({ tab: 'study', sub: 'n3', parent: null, n3View: { kind: 'curriculum', chapter: 'ch4' }, swissView: null, listenMode: 'listen' }, { now: NOW, today: TODAY, storage });
const p = read();
ok('★ 방금 떠난 자리를 돌려준다(탭 · 화면 · N3 코스 위치) ★', p && p.tab === 'study' && p.sub === 'n3' && p.n3View?.chapter === 'ch4');

ok('6시간이 지나면 홈', read({ now: NOW + PLACE_MAX_AGE + 5000 }) === null);
ok('같은 날이 아니면 홈', read({ today: '2026-11-07' }) === null);
ok('시계가 거꾸로 가도(저장이 미래) 홈', read({ now: NOW - 3_600_000 }) === null);

put({ tab: 'study', sub: '없는화면', at: NOW, day: TODAY });
ok('모르는 화면 이름이면 화면은 버리고 탭만 이어요', read()?.tab === 'study' && read()?.sub === null);

put({ tab: 'home', sub: null, at: NOW, day: TODAY });
ok('홈에 있었으면 굳이 잇지 않는다(null)', read() === null);

put({ tab: '이상한탭', sub: 'quiz', at: NOW, day: TODAY });
ok('모르는 탭이면 홈 위의 그 화면', read()?.tab === 'home' && read()?.sub === 'quiz');

for (const bad of ['null', '123', '"글자"', '[]', '{망가짐']) { mem.set(PLACE_KEY, bad); let v; let threw = false; try { v = read(); } catch { threw = true; } ok(`저장값이 ${bad}여도 안 죽고 홈`, !threw && v === null); }

mem.set(PLACE_KEY, JSON.stringify({ tab: 'study', sub: 'listen', listenMode: 'shadow', at: NOW, day: TODAY }));
ok('따라 말하기 방식도 기억한다', read()?.listenMode === 'shadow');

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
