/* 계정에 잠가 두는 API 키 묶음 — 음성(TTS) 키와 AI(Gemini) 키.
 *
 * ★ 왜 묶나 ★
 *   여태 계정에 올라가는 것은 음성 키 하나였다. AI 키는 기기마다 따로 넣어야 해서, 컴퓨터에서 넣은 키가
 *   휴대폰에는 없었다. 두 키는 여전히 서로 다른 키다(쓰는 곳도 다르다) — 잠가서 올리는 봉투만 같이 쓴다.
 *   서버에는 암호문만 올라간다(lib/crypto.js). 봉투 칸은 그대로 하나(gtts_key_enc)라 DB를 안 바꾼다.
 *
 * ★ 예전 봉투와 같이 산다 ★
 *   예전 봉투의 속은 음성 키 글자 그대로다. AI 키가 없으면 지금도 그 모양으로 올린다.
 *   AI 키가 있으면 {"v":2,"gttsKey","geminiKey"} 글자로 올린다. 읽을 때는 둘 다 읽는다. */
export function packKeys({ gttsKey = '', geminiKey = '' } = {}) {
  if (!geminiKey) return gttsKey || '';
  return JSON.stringify({ v: 2, gttsKey: gttsKey || '', geminiKey });
}

/* 봉투 속 글자 → 키 둘. 못 읽으면 null. */
export function unpackKeys(plain) {
  if (typeof plain !== 'string' || !plain) return null;
  if (plain.startsWith('{')) {
    try {
      const o = JSON.parse(plain);
      if (o && o.v === 2) return { gttsKey: String(o.gttsKey || ''), geminiKey: String(o.geminiKey || '') };
    } catch { /* 키 글자가 우연히 {로 시작했을 뿐이다 */ }
  }
  return { gttsKey: plain, geminiKey: '' };
}

/* 업데이트 전 버전이 새 봉투를 열면 묶음 글자를 통째로 음성 키 칸에 넣는다. 그 흔적인가 */
export function looksPacked(value) {
  const u = typeof value === 'string' && value.startsWith('{"v":2') ? unpackKeys(value) : null;
  return Boolean(u && (u.geminiKey || u.gttsKey !== value));
}

/* 이 기기의 키와 계정의 키를 맞춘다.
 *   pull  이 기기에 없고 계정에 있는 키 — 가져온다
 *   push  올릴 묶음(계정 것과 다를 때만). 이 기기에 있는 키가 우선이다(예전 음성 키 규칙 그대로) */
export function reconcileKeys(local = {}, stored = null) {
  const mine = { gttsKey: local.gttsKey || '', geminiKey: local.geminiKey || '' };
  const theirs = stored || { gttsKey: '', geminiKey: '' };
  const pull = {};
  if (!mine.gttsKey && theirs.gttsKey) pull.gttsKey = theirs.gttsKey;
  if (!mine.geminiKey && theirs.geminiKey) pull.geminiKey = theirs.geminiKey;
  const union = { gttsKey: mine.gttsKey || theirs.gttsKey, geminiKey: mine.geminiKey || theirs.geminiKey };
  const want = packKeys(union);
  const have = stored ? packKeys(theirs) : '';
  return { pull, push: want && want !== have ? want : null };
}
