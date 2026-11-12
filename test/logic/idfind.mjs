/* 아이디 찾기 — 기기에 기억한 이메일, 가려서 보여 주기, 서버 답 읽기 */
import assert from 'node:assert/strict';
import { rememberEmail, lastEmail, maskEmail, readFindAnswer, findAccount } from '../../src/lib/idfind.js';
let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }
async function checkAsync(label, run) { await run(); pass++; console.log('✓', label); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

check('로그인한 이메일을 기억했다가 돌려준다', () => {
  const s = memory();
  assert.equal(lastEmail(s), '');
  rememberEmail(' me@example.com ', s);
  assert.equal(lastEmail(s), 'me@example.com');
});
check('이메일이 아닌 것은 기억하지 않고, 있던 것도 지우지 않는다', () => {
  const s = memory();
  rememberEmail('me@example.com', s);
  rememberEmail('', s); rememberEmail(undefined, s); rememberEmail('아이디', s);
  assert.equal(lastEmail(s), 'me@example.com');
});
check('저장소가 깨져 있거나 막혀 있어도 죽지 않는다', () => {
  const broken = { getItem: () => { throw new Error('막힘'); }, setItem: () => { throw new Error('막힘'); } };
  rememberEmail('me@example.com', broken);
  assert.equal(lastEmail(broken), '');
  assert.equal(lastEmail({ getItem: () => '{"x":1}' }), '');
});
check('가려서 보여 준다 — 앞 두 글자와 도메인만', () => {
  assert.equal(maskEmail('scott1234@gmail.com'), 'sc•••••••@gmail.com');
  assert.equal(maskEmail('ab@x.kr'), 'a••@x.kr');
  assert.equal(maskEmail('a@x.kr'), 'a••@x.kr');
  assert.equal(maskEmail('이메일아님'), '');
  assert.ok(!maskEmail('scott1234@gmail.com').includes('ott1234'));
});
check('서버 답: 오류가 없으면 가입된 주소', () => { assert.equal(readFindAnswer(null), 'yes'); });
check('서버 답: 「계정을 만들 수 없다」는 거절은 가입 안 된 주소', () => {
  assert.equal(readFindAnswer({ status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' }), 'no');
  assert.equal(readFindAnswer({ status: 422, message: 'Signups not allowed for otp' }), 'no');
  assert.equal(readFindAnswer({ status: 400, code: 'user_not_found', message: 'User not found' }), 'no');
});
check('서버 답: 너무 잦으면 기다리라고 한다', () => {
  assert.equal(readFindAnswer({ status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }), 'wait');
  assert.equal(readFindAnswer({ status: 429, message: 'For security purposes, you can only request this after 52 seconds.' }), 'wait');
});
check('서버 답: 그 밖의 오류는 답이 아니다(가입 안 됨으로 읽지 않는다)', () => {
  assert.equal(readFindAnswer({ status: 500, message: 'Internal Server Error' }), null);
  assert.equal(readFindAnswer({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }), null);
  assert.equal(readFindAnswer({ status: 401, message: 'Invalid API key' }), null);
});
await checkAsync('서버에는 계정을 만들지 말라고 청한다 · 답을 돌려준다 · 모르는 오류는 던진다', async () => {
  const calls = [];
  const fake = (error) => ({ auth: { signInWithOtp: async (arg) => { calls.push(arg); return { error }; } } });
  assert.equal(await findAccount(fake(null), 'me@example.com', 'https://x/japan/'), 'yes');
  assert.deepEqual(calls[0], { email: 'me@example.com', options: { shouldCreateUser: false, emailRedirectTo: 'https://x/japan/' } });
  assert.equal(await findAccount(fake({ status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' }), 'no@example.com'), 'no');
  assert.equal(calls[1].options.shouldCreateUser, false);
  await assert.rejects(() => findAccount(fake({ status: 500, message: 'boom' }), 'me@example.com'));
});
console.log(`통과 ${pass} / 실패 0`);
