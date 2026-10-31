/* 로그인 상태를 확인하는 동안 — 그리고 확인이 영영 안 끝날 때.
 *
 * ★ 영영 멈추는 화면이 있었다 ★
 *
 * 앱을 켜면 서버에 「이 기기에 로그인된 세션이 있나」를 묻고, 답이 올 때까지
 * 「학습 기록을 확인하고 있어요」를 띄운다. 그 물음이 이렇게 적혀 있었다.
 *
 *   supabase.auth.getSession().then(({ data }) => { ...; setAuthReady(true); });
 *
 * catch가 없다. 그래서 그 약속이 깨지면 — 인터넷이 끊겼거나, 서버가 안
 * 받거나, 응답 모양이 달라서 그 안에서 뭔가 던지면 — setAuthReady(true)가
 * 영영 안 불린다. 그 화면에 갇힌다. 새로고침해도 같은 자리다.
 *
 * 깨지지 않고 그냥 안 오는 경우도 있다. 응답이 끝내 도착하지 않는 연결은
 * 거절도 안 되니 catch로도 안 잡힌다.
 *
 * ★ 그래서 세 갈래를 다 막는다 ★
 *
 *   성공    세션을 받아 들어간다
 *   실패·예외  로그인 문을 보여 준다
 *   시간초과   기다리다 말고 로그인 문을 보여 준다
 *
 * 어느 경우에도 사람이 고를 수 있는 자리까지는 간다. 그리고 그 문에는
 * 「전에 로그인한 적 있으면 오프라인으로 계속」이 있어서, 서버가 죽어 있어도
 * 기기에 있는 것으로 공부할 수 있다 — 기록은 로컬에 쌓이고 서버가 돌아오면
 * 올라간다.
 *
 * ★ 시간초과로 끝낸 뒤에 세션이 와도 괜찮다 ★
 *
 * 시간초과는 「세션이 없다」고 적지 않는다. 기다리는 것만 그만둔다. 늦게
 * 도착한 세션은 로그인 상태 변화(onAuthStateChange)로 들어오고, 그때 앱이
 * 열린다 — 잠깐 문을 봤다가 들어가는 쪽이, 영영 멈춰 있는 쪽보다 낫다. */

/* 얼마나 기다릴까.
 *
 * 6초다. 더 짧으면 느린 지하철 와이파이에서 멀쩡한 로그인도 문을 보게 되고,
 * 더 길면 서버가 죽었을 때 사람이 「고장났다」고 판단하고 앱을 닫는다.
 * 토큰을 갱신하는 왕복이 한 번 있을 수 있어서 한 번의 응답 시간보다는
 * 넉넉해야 한다. */
export const AUTH_READY_TIMEOUT = 6000;

/* 응답에서 세션을 꺼낸다. 모양이 달라도 던지지 않는다 —
   여기서 던지면 그게 바로 영영 멈추는 화면이다. */
export function sessionFrom(res) {
  return res?.data?.session ?? null;
}

/* 지금 무엇을 보여 줄까.
 *
 *   configured   서버를 쓰는 앱인가 (안 쓰면 로그인이 없다)
 *   ready        로그인 상태를 알아냈나 (실패·시간초과도 「알아낸 것」이다)
 *   session      세션이 있나
 *   offlinePass  「오프라인으로 계속」을 고른 적 있나
 *
 * 'loading' 확인 중 · 'gate' 로그인 문 · 'app' 앱 */
/* ★ 「이 기기 기록으로 계속하기」를 보여 줄까 ★
 *
 * 여태 navigator.onLine 하나로 정했다. 그런데 그 값은 「랜선이 꽂혀 있나」에
 * 가깝다 — 와이파이에는 붙었는데 인터넷이 안 되는 자리(호텔 로그인 페이지,
 * 기내 와이파이, 회사 방화벽)에서 참이고, 서버가 죽었을 때도 참이다.
 *
 * 그 경우가 제일 나쁘다. onLine이 참이니 이 버튼이 안 뜨고, 로그인은
 * 서버가 없어서 안 되고, 그래서 이 화면에 갇힌다 — 기기에는 어제까지 공부한
 * 기록이 멀쩡히 있는데 들어갈 길이 없다.
 *
 * 그래서 「서버가 안 받는다」도 같이 본다. 로그인 확인이 시간초과로 끝났거나
 * 동기화가 실패한 상태가 그것이다.
 *
 * 전에 로그인한 적이 없으면 안 보여 준다. 그 기기에는 이어 갈 기록이 없고,
 * 빈손으로 들어가면 아무것도 없는 앱을 보게 된다. */
export function canContinueOffline({ signedInOnce = false, online = true, serverDown = false } = {}) {
  if (!signedInOnce) return false;
  return !online || Boolean(serverDown);
}

/* ★ 서버가 문제인가, 내가 틀린 건가 ★
 *
 * 로그인이 실패하는 이유는 둘로 갈린다. 비밀번호를 틀렸거나 메일 인증 전이면 사람이
 * 고치면 된다. 서버가 안 열리거나(정지된 무료 프로젝트) 키를 거절하거나 5xx를 돌려주면
 * 사람이 할 수 있는 게 없고, 이때는 기기에 있는 기록으로 계속할 길이 열려야 한다.
 * 그 판단이 여기 하나다 — 문구(readableAuthError)와 버튼(Gate)이 같은 판단을 쓴다. */
const NETWORK_WORDS = /(load failed|failed to fetch|networkerror|network request failed|fetch failed|network error|timed? ?out|econnrefused|enotfound)/i;
const KEY_WORDS = /(api key|apikey|no api key|invalid jwt|jwt)/i;
export function isServerProblem(err) {
  if (!err) return false;
  const message = typeof err === 'string' ? err : String(err.message || '');
  const status = Number(err.status ?? err.statusCode ?? 0);
  if (err.name === 'AuthRetryableFetchError') return true;   // 닿지 못했다
  if (NETWORK_WORDS.test(message)) return true;
  if (status >= 500) return true;
  if ((status === 401 || status === 403) && KEY_WORDS.test(message)) return true;   // 서버가 키를 거절
  return false;
}

/* Supabase가 돌려주는 영어 오류를 사람이 읽을 수 있게. 영어를 그대로 보여 주지 않는다 —
   「Load failed」가 그대로 떠서 무슨 말인지 몰랐다(서버가 정지돼 있었다). */
export function readableAuthError(err) {
  const message = typeof err === 'string' ? err : String(err?.message || '');
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return '이메일이나 비밀번호가 맞지 않아요';
  if (m.includes('already registered')) return '이미 가입된 이메일이에요. 로그인해 주세요';
  if (m.includes('password should be')) return '비밀번호는 6자 이상이어야 해요';
  if (m.includes('email not confirmed')) return '메일함에서 인증 링크를 먼저 눌러 주세요';
  if (m.includes('rate limit') || m.includes('too many')) return '잠시 후 다시 시도해 주세요';
  if (m.includes('unable to validate email') || m.includes('invalid format')) return '이메일 형식을 확인해 주세요';
  /* 서버 쪽 문제 — 내가 고칠 수 있는 게 아니다 */
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  if (NETWORK_WORDS.test(message) || err?.name === 'AuthRetryableFetchError') {
    return '서버에 닿지 못했어요. 인터넷이나 서버 상태를 확인해 주세요';
  }
  if ((status === 401 || status === 403) && KEY_WORDS.test(message)) return '서버가 요청을 받지 않아요. 잠시 뒤 다시 시도해 주세요';
  if (status >= 500) return '서버가 바쁜 것 같아요. 잠시 뒤 다시 시도해 주세요';
  return message || '잠시 후 다시 시도해 주세요';
}

export function authGate({ configured = true, ready = false, session = null, offlinePass = false } = {}) {
  if (!configured) return 'app';        // 서버를 안 쓰면 그냥 들어간다
  if (session) return 'app';            // 세션이 있으면 확인이 끝나기 전이라도 들어간다
  if (offlinePass) return 'app';        // 기기에 있는 것으로 공부하겠다고 골랐다
  if (!ready) return 'loading';
  return 'gate';
}
