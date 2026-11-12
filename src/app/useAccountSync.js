import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, loadVaultKey, saveVaultKey, markSignedInOnce, hasSignedInOnce } from '../lib/storage.js';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { rememberEmail } from '../lib/idfind.js';
import { syncNow, pushKeyEnvelope } from '../lib/sync.js';
import { applySyncedSettings, mergeReview, mergeProgress, mergeStats, mergeStreak, mergeCustomWords, mergeMemos, mergeGone } from '../lib/merge.js';
import { encryptWithVaultKey, decryptWithVaultKey } from '../lib/crypto.js';
import { looksPacked, reconcileKeys, unpackKeys } from '../lib/keyvault.js';
import { AUTH_READY_TIMEOUT, sessionFrom } from '../lib/authboot.js';

// 기존 서버 왕복과 병합 규칙을 보존한 계정 어댑터. 학습 화면은 서버에 직접 접근하지 않는다.
export function useAccountSync({ data, streak, setStreak, showToast }) {
  const { review, setReview, progress, setProgress, settings, setSettings, stats, setStats, customWords, setCustomWords, memos, setMemos, videoBundle, applyVideoBundle } = data;
  const [authSession, setAuthSession] = useState(null);
  const [syncState, setSyncState] = useState({ busy: false, at: null, error: null });
  const [remoteKeyEnvelope, setRemoteKeyEnvelope] = useState(null);
  const [vaultKey, setVaultKey] = useState(() => loadVaultKey());
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [recovering, setRecovering] = useState(false);
  /* 로그인 확인이 시간초과로 끝났나. 「서버에 닿지 못했다」는 뜻이라,
     로그인 문이 「이 기기 기록으로 계속하기」를 띄울지 정하는 데 쓴다 —
     와이파이는 잡혔는데 서버가 죽은 자리에서 갇히지 않게. */
  const [authTimedOut, setAuthTimedOut] = useState(false);
  /* 서버가 답은 했는데 세션을 못 줬다 — 거절(키·토큰)이다. 시간초과와 같은 뜻으로 다룬다:
     사람이 할 수 있는 게 없으니 기기에 있는 기록으로 계속할 길을 연다. */
  const [authFailed, setAuthFailed] = useState(false);

  const patchSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);
  /* ── 계정 · 기기 간 동기화 ── */

  /* ★ 로그인 확인은 어떤 경우에도 끝난다 ★
   *
   * 여기가 영영 멈추는 화면이었다. getSession()에 catch가 없어서, 그 약속이
   * 깨지면(인터넷이 끊겼거나, 서버가 안 받거나, 응답 모양이 달라서 안에서
   * 뭔가 던지면) setAuthReady(true)가 영영 안 불렸다 — 「학습 기록을
   * 확인하고 있어요」에 갇히고, 새로고침해도 같은 자리다.
   *
   * 깨지지 않고 그냥 안 오는 경우도 있다. 끝내 도착하지 않는 연결은 거절도
   * 안 되니 catch로도 안 잡힌다. 그래서 시간초과를 같이 둔다.
   *
   * 성공·실패·예외·시간초과 넷 다 사람이 고를 수 있는 자리까지 간다.
   * 규칙과 그 이유는 lib/authboot.js에 적어 두었다. */
  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    let settled = false;
    /* 기다리기를 그만둔다. 「세션이 없다」고 적지는 않는다 — 늦게 도착한
       세션은 아래 onAuthStateChange로 들어오고, 그때 앱이 열린다. */
    const giveUp = setTimeout(() => {
      if (settled) return;
      settled = true;
      setAuthTimedOut(true);
      setAuthReady(true);
    }, AUTH_READY_TIMEOUT);
    const done = (session, error = null) => {
      /* 상태 변화(onAuthStateChange)가 먼저 와서 이미 끝난 경우가 많다 — 갱신이 거절되면 그 이벤트가
         빈 세션으로 먼저 오고 오류는 getSession 쪽에 늦게 온다. 늦게 온 오류도 버리지 않는다. */
      if (settled) {
        if (session) setAuthSession(session);
        else if (error) setAuthFailed(true);
        return;
      }
      settled = true;
      clearTimeout(giveUp);
      setAuthSession(session);
      /* 세션이 없는데 오류가 같이 왔다 = 서버가 거절했다(키·갱신 토큰). 처음 쓰는 사람은
         오류 없이 빈 세션이 온다 — 그 경우는 해당 없다. */
      setAuthFailed(Boolean(error) && !session);
      setAuthReady(true);
    };
    /* 거절로 끝난 경우도 「서버에 닿지 못했다」다 — 시간초과와 같게 다룬다 */
    const failed = () => { if (!settled) setAuthTimedOut(true); done(null); };
    try {
      supabase.auth.getSession()
        .then((res) => done(sessionFrom(res), res?.error))
        .catch(failed);
    } catch {
      /* 부르는 그 자리에서 던지는 경우도 있다 — 설정이 깨졌을 때가 그렇다 */
      failed();
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setAuthSession(next);
      /* ★ 켜는 도중에 로그아웃이 왔다 = 저장된 세션을 서버가 거절했다 ★
         이 기기에서 로그인한 적이 있는데 켜자마자 SIGNED_OUT이 오면, 사람이 로그아웃한 게
         아니라 라이브러리가 갱신 토큰이 죽은 것을 알고 세션을 지운 것이다(getSession에는 이미
         지워진 뒤라 오류가 안 온다). 서버가 받지 않는 것이니 시간초과와 같게 다룬다 — 기기에
         있는 기록으로 계속할 길을 연다. 켠 뒤에 사람이 로그아웃한 경우는 아래에서 끈다. */
      if (!settled && event === 'SIGNED_OUT' && hasSignedInOnce()) setAuthFailed(true);
      /* 세션이 생겼거나 켠 뒤의 로그아웃이면 거절 표시는 낡은 것이다 — 로그아웃한 뒤에
         「이 기기 기록으로 계속하기」가 저절로 열리면 안 된다. */
      if (next || (settled && event === 'SIGNED_OUT')) setAuthFailed(false);
      /* 상태 변화가 왔다는 것은 로그인 쪽이 살아 있다는 뜻이다 — 아직
         기다리는 중이면 여기서 끝낸다. */
      if (!settled) { settled = true; clearTimeout(giveUp); setAuthTimedOut(false); setAuthReady(true); }
      // 재설정 메일 링크로 돌아온 경우다. 세션만 열고 끝내면 비밀번호는 안 바뀐다.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => {
      clearTimeout(giveUp);
      sub.subscription.unsubscribe();
    };
  }, []);

  const runSyncRef = useRef(null);
  /* 지금의 진도 — 요청이 오가는 사이에 지운 내 단어를 다시 합칠 때 본다 */
  const progressNow = useRef(progress);
  progressNow.current = progress;
  /* 동기화가 값을 얹는 중인가 · 그 사이에 이 기기에서 바뀐 것이 있었나 — 아래 올리기 효과가 본다 */
  const fromSync = useRef(false);
  const movedDuring = useRef(false);
  const runSync = useCallback(async (silent = false) => {
    if (!authSession?.user) return;
    setSyncState((s) => ({ ...s, busy: true }));
    try {
      const merged = await syncNow(authSession.user.id, {
        review, progress, settings, stats, streak, customWords, memos, videos: videoBundle,
      }, { defaults: DEFAULT_SETTINGS });
      /* ★ 요청이 오가는 동안 이 기기에서 한 것을 지우지 않는다 ★
         merged는 요청을 보내기 전의 값(위에서 넘긴 것)으로 합친 결과다. 그걸 그대로 덮으면 그 사이에 판정한 카드의
         회독 기록과 그날 활동이 이 기기에서 사라지고 서버에도 못 올라갔다(2분마다 올리는 동기화가 학습 중에 돈다).
         보낼 때의 값과 지금 값이 같으면 그대로 받고, 달라졌으면 지금 값에 한 번 더 합친다. 달라졌던 것은 아직
         서버에 없으니 다음 올리기가 돌게 표시한다(movedDuring). */
      const moved = () => { movedDuring.current = true; };
      fromSync.current = true;
      setReview((cur) => (cur === review ? merged.review : (moved(), mergeReview(cur, merged.review))));
      setProgress((p) => (p === progress ? { ...p, ...merged.progress } : (moved(), { ...p, ...mergeProgress(p, merged.progress) })));
      setStats((cur) => (cur === stats ? merged.stats : (moved(), mergeStats(cur, merged.stats))));
      setStreak((cur) => (cur === streak ? merged.streak : mergeStreak(cur, merged.streak)));
      /* 낱말은 같은 id면 뒤에 넘긴 쪽이 진다 — 그 사이에 고친 낱말(지금 값)이 이기게 앞뒤를 바꿔 넘긴다 */
      setCustomWords((cur) => (cur === customWords ? merged.customWords : (moved(), mergeCustomWords(merged.customWords, cur, mergeGone(progressNow.current?.wordsGone, merged.progress?.wordsGone)))));
      setMemos((cur) => (cur === memos ? merged.memos : (moved(), mergeMemos(cur, merged.memos))));
      applyVideoBundle(merged.videos);
      /* 서버에서 온 설정은 학습 범위만 들어 있다 — 기기별 설정은 덮지 않는다.
         메뉴 목록만은 얹지 않고 합친다. 서버에 저장된 건 새 메뉴가 생기기 전
         것이라, 그냥 얹으면 만든 적도 없는 것처럼 사라진다. */
      /* 요청을 보낸 뒤에 이 기기에서 바꾼 설정 칸은 덮지 않는다 — merged는 보내기 전의 값으로 만든 것이라,
         그대로 얹으면 방금 바꾼 목표 · 레벨 · 길잡이가 되돌아갔다. */
      setSettings((s) => applySyncedSettings(s, merged.settings, settings, DEFAULT_SETTINGS));
      setRemoteKeyEnvelope(merged.gttsKeyEnc || null);
      /* 안내(note)와 오류(error)를 나눈다. 영상 칸이 없는 건 나머지가 다 올라간
         상태라, 이걸 오류 자리에 넣으면 "동기화가 안 되고 있어요"로 읽힌다. */
      setSyncState({
        busy: false,
        error: null,
        note: merged.videoNote || null,
        at: new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }),
      });
      if (!silent) showToast(merged.videoNote ? '동기화했어요 (영상 제외)' : '동기화했어요');
    } catch (err) {
      // 토스트는 2초 뒤 사라져서 왜 안 되는지 확인할 방법이 없다. 계정 칸에 남긴다.
      setSyncState((s) => ({ ...s, busy: false, error: err.message }));
      if (!silent) showToast('동기화에 실패했어요');
    }
  }, [authSession, review, progress, settings, stats, streak, customWords, memos, videoBundle, applyVideoBundle, showToast]);

  runSyncRef.current = runSync;

  const saveRemoteKey = useCallback(async (envelope) => {
    if (!authSession?.user) throw new Error('로그인이 필요해요');
    await pushKeyEnvelope(authSession.user.id, envelope);   // 봉투만 — 기록은 동기화(합치기)가 올린다
    setRemoteKeyEnvelope(envelope);
  }, [authSession]);

  const rememberVaultKey = useCallback((raw) => {
    setVaultKey(raw);
    saveVaultKey(raw);
  }, []);

  /* API 키(음성 · AI)를 계정에 자동으로 잠가 두고, 새 기기에서는 자동으로 풀어 온다.
   * 사용자가 따로 누를 게 없어야 한다 — 눌러야 하면 안 누른다. 규칙은 lib/keyvault.js. */
  /* ★ 이 기기에서 방금 지운 키 ★ 있던 키가 빈 칸이 되면 「지웠다」로 적는다. 처음부터 비어 있던 기기(새 기기)와 가려야
     한다 — 새 기기는 계정에서 가져와야 하고, 지운 기기는 가져오면 안 된다(그리고 계정에서도 빼야 한다). */
  const keyCleared = useRef({});
  const keySeen = useRef({ gttsKey: settings.gttsKey || '', geminiKey: settings.geminiKey || '' });
  useEffect(() => {
    for (const k of ['gttsKey', 'geminiKey']) {
      const now = settings[k] || '';
      if (keySeen.current[k] && !now) keyCleared.current = { ...keyCleared.current, [k]: true };
      else if (now) keyCleared.current = { ...keyCleared.current, [k]: false };
      keySeen.current[k] = now;
    }
  }, [settings.gttsKey, settings.geminiKey]);

  useEffect(() => {
    if (!authSession?.user || !vaultKey) return;
    /* 업데이트 전 버전이 새 봉투를 열어 묶음 글자를 음성 키 칸에 통째로 넣었으면 풀어서 제자리에 둔다 */
    if (looksPacked(settings.gttsKey)) {
      const fixed = unpackKeys(settings.gttsKey);
      patchSettings({ gttsKey: fixed.gttsKey, ...(settings.geminiKey ? {} : { geminiKey: fixed.geminiKey }) });
      return;
    }
    let live = true;
    (async () => {
      const plain = remoteKeyEnvelope ? await decryptWithVaultKey(remoteKeyEnvelope, vaultKey) : null;
      if (!live) return;
      const stored = unpackKeys(plain);
      const hasLocal = Boolean(settings.gttsKey || settings.geminiKey);
      if (remoteKeyEnvelope && !stored && !hasLocal) {
        // 비밀번호를 바꿨으면 예전 봉투는 못 연다
        showToast('계정에 보관된 API 키를 열지 못했어요. 키를 다시 넣어 주세요');
        return;
      }
      const { pull, push, clear } = reconcileKeys({ gttsKey: settings.gttsKey, geminiKey: settings.geminiKey }, stored, keyCleared.current);
      if (Object.keys(pull).length) {
        patchSettings(pull);
        showToast(pull.geminiKey && pull.gttsKey ? 'API 키를 계정에서 가져왔어요' : pull.geminiKey ? 'AI 키를 계정에서 가져왔어요' : '음성 키를 계정에서 가져왔어요');
      }
      if (push) {
        try { await saveRemoteKey(await encryptWithVaultKey(push, vaultKey)); } catch { /* 다음 동기화에서 다시 시도한다 */ }
      } else if (clear) {
        /* 키를 다 지웠다 — 계정의 봉투도 비운다(안 비우면 다음에 열 때 다시 내려온다) */
        try { await saveRemoteKey(null); } catch { /* 다음에 다시 시도한다 */ }
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, vaultKey, settings.gttsKey, settings.geminiKey, remoteKeyEnvelope]);

  /* 공부한 걸 자동으로 올린다.
   * 로그인할 때와 버튼을 누를 때만 올리면, 메모를 적고 다른 기기를 열었을 때 없다.
   * 매 판정마다 올리면 너무 잦으니 손을 멈춘 뒤 잠깐 기다렸다 한 번에 보낸다.
   * 앱을 덮거나 탭을 떠날 때도 밀어 넣는다 — 그때 안 보내면 영영 못 보낸다.
   *
   * 다만 기다리기만 하면 안 된다. 회독은 손이 계속 움직이는 일이라 12초가
   * 도무지 안 오고, 그 사이 앱이 죽으면 한 세션이 통째로 날아간다. 그래서
   * 마지막으로 올린 지 2분이 넘으면 손이 움직이는 중이라도 한 번 올린다. */
  const PUSH_IDLE_MS = 12000;
  const PUSH_MAX_MS = 120000;
  const dirty = useRef(false);
  const pushTimer = useRef(null);
  const pushedAt = useRef(Date.now());

  useEffect(() => {
    /* ★ 동기화가 돌려준 값을 얹은 것은 「이 기기에서 바뀐 것」이 아니다 ★
       동기화가 끝나면 회독 · 진도 · 활동이 전부 새 값으로 바뀐다. 그걸 바뀐 것으로 세면 12초 뒤에 또 동기화하고,
       그 동기화가 또 값을 바꿔서 — 로그인해 있는 동안 12초마다 끝없이 내려받고 올렸다(가만히 둬도).
       동기화가 오가는 사이에 실제로 한 것이 있을 때만(movedDuring) 다음 올리기를 잡는다. */
    const applied = fromSync.current;
    const moved = movedDuring.current;
    fromSync.current = false; movedDuring.current = false;   // 어느 길로 나가든 표시가 남지 않게 먼저 내린다
    if (applied && !moved) return undefined;
    if (!authSession?.user || syncedFor.current !== authSession.user.id) return undefined;
    dirty.current = true;
    const send = () => {
      if (!dirty.current) return;
      dirty.current = false;
      pushedAt.current = Date.now();
      /* 지금의 runSync를 부른다. 이 효과가 잡아 둔 runSync는 마지막으로 기록이 바뀐 때의 것이라, 그 뒤에 바꾼 설정을
         모르는 채로 옛 설정을 올리고 다시 얹었다(설정을 바꾸고 12초 안에 되돌아갔다). */
      runSyncRef.current(true);
    };
    clearTimeout(pushTimer.current);
    const waited = Date.now() - pushedAt.current;
    pushTimer.current = setTimeout(send, Math.max(0, Math.min(PUSH_IDLE_MS, PUSH_MAX_MS - waited)));
    return () => clearTimeout(pushTimer.current);
  }, [review, memos, progress, stats, customWords, videoBundle]);

  useEffect(() => {
    const flush = () => {
      if (!dirty.current || !authSession?.user) return;
      dirty.current = false;
      pushedAt.current = Date.now();
      clearTimeout(pushTimer.current);
      runSync(true);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [authSession, runSync]);

  // 로그인 직후 한 번은 자동으로 맞춘다. 사용자가 버튼을 눌러야만 이어지면 잊는다.
  const syncedFor = useRef(null);
  useEffect(() => {
    if (!authSession?.user || syncedFor.current === authSession.user.id) return;
    syncedFor.current = authSession.user.id;
    markSignedInOnce();
    rememberEmail(authSession.user.email);   // 아이디 찾기 — 다음에 로그인 화면에서 알려 준다
    runSync(true);
  }, [authSession, runSync]);

  return {
    authSession,
    setAuthSession,
    syncState,
    remoteKeyEnvelope,
    setRemoteKeyEnvelope,
    vaultKey,
    authReady,
    authTimedOut,
    authFailed,
    recovering,
    setRecovering,
    rememberVaultKey,
    runSync,
    syncedFor,
    patchSettings
  };
}
