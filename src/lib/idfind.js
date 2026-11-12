/* 아이디 찾기.
 *
 * 아이디는 가입할 때 쓴 이메일이다. 찾는 길은 둘이다.
 *  1) 이 기기에서 로그인한 적이 있으면 그 이메일을 기억해 두었다가 로그인 화면에 보여 준다.
 *  2) 처음 쓰는 기기에서는 쓸 만한 이메일을 넣어 보고 가입된 주소인지 서버에 묻는다.
 *
 * 2)는 누구든 어떤 이메일이 가입돼 있는지 알 수 있게 된다. 그걸 알고 고른 길이다(비밀번호
 * 재설정은 여전히 가입 여부를 알려 주지 않는다). 서버에는 「계정은 만들지 말고 로그인 링크만」을
 * 청한다 — 가입된 주소면 링크 메일이 그 주소로 가고, 아니면 서버가 거절한다. 그 거절이 답이다. */

const KEY = 'jp_manabu_last_email_v1';   // 학습 기록이 아니다 — 초기화 · 백업 · 동기화가 건드리지 않는다
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function rememberEmail(email, store = globalThis.localStorage) {
  const address = String(email || '').trim();
  if (!EMAIL.test(address)) return;
  try { store?.setItem(KEY, address); } catch { /* 못 적어도 로그인은 된다 */ }
}
export function lastEmail(store = globalThis.localStorage) {
  try {
    const v = String(store?.getItem(KEY) || '').trim();
    return EMAIL.test(v) ? v : '';
  } catch { return ''; }
}

/* 어깨너머로 보여도 전부 읽히지 않게 — 앞 두 글자와 도메인만 남긴다. sc••••••@gmail.com */
export function maskEmail(email) {
  const address = String(email || '').trim();
  const at = address.lastIndexOf('@');
  if (at < 1) return '';
  const name = address.slice(0, at);
  const keep = name.length <= 2 ? 1 : 2;
  return `${name.slice(0, keep)}${'•'.repeat(Math.max(2, name.length - keep))}${address.slice(at)}`;
}

/* 서버의 답을 읽는다. 'yes' 가입된 주소 · 'no' 가입 안 된 주소 · 'wait' 너무 잦다. 그 밖의 오류는 null(부른 쪽이 그대로 알린다) */
export function readFindAnswer(error) {
  if (!error) return 'yes';
  const code = String(error.code || error.error_code || '').toLowerCase();
  const message = String(error.message || error.msg || '').toLowerCase();
  const status = Number(error.status ?? error.statusCode ?? 0);
  if (code === 'otp_disabled' || message.includes('signups not allowed')) return 'no';
  if (code === 'user_not_found' || message.includes('user not found')) return 'no';
  if (status === 429 || code.includes('rate_limit') || message.includes('rate limit') || message.includes('security purposes')) return 'wait';
  return null;
}

export async function findAccount(supabase, email, redirectTo) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
  });
  const answer = readFindAnswer(error);
  if (!answer) throw error;
  return answer;
}
