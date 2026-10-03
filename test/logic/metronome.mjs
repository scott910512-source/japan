/* 달리기 박자.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 박자는 흔들리면 없느니만 못하다 — 발이 그걸 따라가려다 리듬을 잃는다.
 * 그래서 소리는 setInterval이 아니라 오디오 시계에 미리 예약한다. 타이머는
 * 예약을 거는 일만 하고, 한 번에 앞으로 1.5초치를 걸어 둔다.
 *
 * 그 구조에서 깨지기 쉬운 자리가 둘이다.
 *
 *   · 밀린 박자가 한꺼번에 터진다 — 화면이 꺼져 타이머가 3초 늦게 돌아오면
 *     지나간 박자가 여덟 개 쌓여 있다. 그걸 다 울리면 「따다다다닥」 하고
 *     터지는데, 달리는 사람에게는 박자가 아니라 사고다.
 *   · 틈이 생긴다 — 예약을 너무 적게 걸면 타이머가 조금만 늦어도 소리가
 *     빈다. 끊긴 박자도 흔들린 박자와 같다.
 *
 * 둘 다 시간 계산이라, 소리와 떼어 두고 여기서 지킨다. */
import {
  ACCENT_EVERY, BPMS, DEFAULT_BPM, LOOKAHEAD, TICK,
  beatInterval, clampBpm, dueBeats, nextBpm,
} from '../../src/lib/metronome.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

console.log('\n[ 달리기 피치 ]');
{
  /* 160·170·180은 분당 걸음 수다. 1씩 고르게 하면 달리면서 못 맞춘다. */
  ok('세 칸뿐', BPMS.length === 3, BPMS.join(' · '));
  ok('160 · 170 · 180', BPMS.join(',') === '160,170,180');
  ok('기본은 170 — 가운데', DEFAULT_BPM === 170 && BPMS.includes(DEFAULT_BPM));

  ok('180은 1/3초마다', near(beatInterval(180), 1 / 3));
  ok('160은 0.375초마다', near(beatInterval(160), 0.375));
  ok('빠를수록 간격이 짧다', beatInterval(180) < beatInterval(160));

  ok('말도 안 되는 값은 끌어온다', clampBpm(5) === 40 && clampBpm(9999) === 240,
    `${clampBpm(5)} / ${clampBpm(9999)}`);
  ok('빈손이면 기본값', clampBpm() === DEFAULT_BPM && clampBpm(null) === DEFAULT_BPM);
  ok('글자가 와도 안 죽는다', clampBpm('헛것') === DEFAULT_BPM);
}

console.log('\n[ 앞으로 걸어 두기 ]');
{
  const got = dueBeats(10, 10, 180);
  ok('지금부터 1.5초치를 건다', got.beats.length === 5, `${got.beats.length}개`);
  ok('첫 박은 지금', near(got.beats[0].at, 10));
  ok('간격이 고르다',
    got.beats.every((b, i) => i === 0 || near(b.at - got.beats[i - 1].at, 1 / 3)),
    got.beats.map((b) => b.at.toFixed(3)).join(' '));
  ok('다음에 이어 걸 자리를 돌려준다', near(got.cursor, 10 + 5 / 3), got.cursor.toFixed(3));

  /* 이어 걸어도 간격이 안 흐트러져야 한다 — 틱마다 「지금」으로 다시 맞추면
     타이머가 1ms 늦을 때마다 박자가 그만큼 밀린다. */
  const next = dueBeats(got.cursor, 10 + TICK, 180, got.count);
  const all = [...got.beats, ...next.beats];
  ok('★ 이어 걸어도 간격이 안 흔들린다 ★',
    all.every((b, i) => i === 0 || near(b.at - all[i - 1].at, 1 / 3)),
    all.map((b) => b.at.toFixed(3)).join(' '));
}

console.log('\n[ ★ 밀린 박자는 버린다 ★ ]');
{
  /* 화면이 꺼져 타이머가 3초 늦게 돌아온 상황. 170bpm이면 지나간 박자가
     여덟 개쯤 쌓여 있는데, 그걸 다 울리면 한꺼번에 터진다. */
  const late = dueBeats(10, 13, 170, 0);
  ok('지나간 자리에는 아무것도 안 건다',
    late.beats.every((b) => b.at >= 13), late.beats.map((b) => b.at.toFixed(2)).join(' '));
  ok('지금부터 다시 맞춘다', late.beats[0].at >= 13 && late.beats[0].at < 13 + beatInterval(170),
    late.beats[0].at.toFixed(3));
  ok('터지지 않는다 — 1.5초치뿐', late.beats.length <= 6, `${late.beats.length}개`);

  /* 버린 박자도 세어 둔다. 안 세면 센 박(네 박마다)의 자리가 어긋난다. */
  ok('버린 박자도 수에는 넣는다', late.count > late.beats.length, `${late.count}`);
}

console.log('\n[ 센 박 ]');
{
  /* 네 박마다 한 번 높은 소리. 소리가 작아도 어디가 첫 박인지 알게 한다. */
  const got = dueBeats(0, 0, 180, 0, 3);
  const marks = got.beats.map((b) => (b.accent ? '●' : '·')).join('');
  ok('첫 박이 센 박', got.beats[0].accent === true);
  ok(`${ACCENT_EVERY}박마다 한 번`, marks.startsWith('●···●···'), marks);

  // 이어 걸어도 자리가 안 어긋난다
  const next = dueBeats(got.cursor, got.cursor, 180, got.count, 3);
  const marks2 = [...got.beats, ...next.beats].map((b) => (b.accent ? '●' : '·')).join('');
  ok('★ 이어 걸어도 센 박 자리가 안 밀린다 ★',
    marks2.split('').every((c, i) => (c === '●') === (i % ACCENT_EVERY === 0)), marks2);
}

console.log('\n[ 틈이 안 생긴다 ]');
{
  /* 예약을 거는 간격(TICK)이 미리 걸어 두는 길이(LOOKAHEAD)보다 충분히
     짧아야 한다. 같거나 길면 타이머가 조금만 늦어도 소리가 빈다. */
  ok('거는 간격이 걸어 두는 길이보다 훨씬 짧다', TICK * 4 <= LOOKAHEAD,
    `${TICK}초마다 · ${LOOKAHEAD}초치`);

  /* 실제로 돌려 본다 — 타이머가 매번 조금씩 늦는 상황에서 한 박도 안 빠지나 */
  let cursor = 0; let count = 0; let now = 0;
  const heard = [];
  for (let i = 0; i < 40; i++) {
    const got = dueBeats(cursor, now, 180, count);
    for (const b of got.beats) heard.push(b.at);
    cursor = got.cursor; count = got.count;
    now += TICK * 1.4;   // 타이머가 40% 늦게 돌아온다
  }
  const gaps = heard.slice(1).map((t, i) => t - heard[i]);
  ok('★ 한 박도 안 빠진다 ★', gaps.every((g) => near(g, 1 / 3, 1e-9)),
    `가장 큰 틈 ${Math.max(...gaps).toFixed(4)}초`);
  ok('같은 박을 두 번 안 건다', new Set(heard.map((t) => t.toFixed(6))).size === heard.length);
}

console.log('\n[ 한 손가락으로 돌리기 ]');
{
  /* 달리는 중에는 화면을 못 본다. 칸을 여럿 두지 않고 한 자리를 눌러 돌린다 —
     160 → 170 → 180 → 끄기 → 160. */
  ok('꺼진 상태에서 누르면 160', nextBpm(null) === 160);
  ok('160 → 170', nextBpm(160) === 170);
  ok('170 → 180', nextBpm(170) === 180);
  ok('★ 180 다음은 끄기 ★', nextBpm(180) === null);
  ok('한 바퀴가 네 번이다',
    [null, 160, 170, 180].map((v) => nextBpm(v)).join(',') === '160,170,180,');
  ok('모르는 값이 들어오면 처음으로', nextBpm(123) === 160);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
