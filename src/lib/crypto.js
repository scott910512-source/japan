/* 계정에 올릴 비밀값(음성 API 키)의 암호화.
 *
 * 서버에는 암호문만 올라간다. 복호화 열쇠는 사용자가 정한 "동기화 암호"에서
 * 만들어지고 어디에도 전송되지 않는다. 데이터베이스가 통째로 새어 나가도
 * 암호를 모르면 키를 못 읽는다.
 *
 * 파생한 열쇠는 기기에 남긴다. 그래야 앱을 다시 켤 때마다 암호를 묻지 않는다.
 * 이건 보안을 낮추는 게 아니다 — 어차피 이 기기는 API 키 원문을 갖고 있어야
 * 구글에 요청을 보낼 수 있다. 지키려는 대상은 "서버에 쌓인 데이터"다. */

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 권고치
const SALT_BYTES = 16;
const IV_BYTES = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 8192) {
    bin += String.fromCharCode.apply(null, arr.subarray(i, i + 8192));
  }
  return btoa(bin);
}

function fromBase64(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase, salt) {
  const material = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/* 암호문 봉투: { v, salt, iv, ct }
 * salt를 함께 담아 두어야 다른 기기에서 같은 암호로 같은 열쇠를 만들 수 있다. */
export async function encryptSecret(plaintext, passphrase) {
  if (!plaintext) return null;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));

  return {
    v: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(ct),
  };
}

// 암호가 틀리면 AES-GCM 인증이 실패한다 — 조용히 쓰레기값을 돌려주지 않고 null을 준다.
export async function decryptSecret(envelope, passphrase) {
  if (!envelope?.ct || !passphrase) return null;
  try {
    const key = await deriveKey(passphrase, fromBase64(envelope.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ct),
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}

/* 암호가 맞는지 확인만 하고 싶을 때. */
export async function canDecrypt(envelope, passphrase) {
  return (await decryptSecret(envelope, passphrase)) !== null;
}

/* ── 계정 비밀번호에서 만드는 금고 열쇠 ──
 *
 * 동기화 암호를 따로 외우게 하면 안 쓴다. 로그인할 때 어차피 치는 계정 비밀번호에서
 * 열쇠를 만든다. 비밀번호 자체는 저장하지 않고, 파생된 열쇠 바이트만 기기에 남긴다.
 * salt는 사용자 id로 고정한다 — 그래야 어느 기기에서 로그인해도 같은 열쇠가 나온다. */

export async function deriveVaultKey(password, userId) {
  if (!password || !userId) return null;
  const material = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(`jsjp:${userId}`), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  );
  return toBase64(bits);
}

async function importVaultKey(rawBase64) {
  return crypto.subtle.importKey(
    'raw', fromBase64(rawBase64), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptWithVaultKey(plaintext, rawBase64) {
  if (!plaintext || !rawBase64) return null;
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importVaultKey(rawBase64);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { v: 2, iv: toBase64(iv), ct: toBase64(ct) };
}

// 비밀번호를 바꾸면 예전 봉투는 못 연다. 그때는 null이 나오고 화면이 다시 넣으라고 알린다.
export async function decryptWithVaultKey(envelope, rawBase64) {
  if (!envelope?.ct || !rawBase64) return null;
  try {
    const key = await importVaultKey(rawBase64);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.ct),
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}
