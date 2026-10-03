import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, loadVaultKey, saveVaultKey, markSignedInOnce } from '../lib/storage.js';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { syncNow, pushMerged } from '../lib/sync.js';
import { mergeSyncedSettings, pickSyncedSettings } from '../lib/merge.js';
import { encryptWithVaultKey, decryptWithVaultKey } from '../lib/crypto.js';
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
      setAuthReady(true);
    }, AUTH_READY_TIMEOUT);
    const done = (session) => {
      if (settled) { if (session) setAuthSession(session); return; }
      settled = true;
      clearTimeout(giveUp);
      setAuthSession(session);
      setAuthReady(true);
    };
    try {
      supabase.auth.getSession()
        .then((res) => done(sessionFrom(res)))
        .catch(() => done(null));
    } catch {
      /* 부르는 그 자리에서 던지는 경우도 있다 — 설정이 깨졌을 때가 그렇다 */
      done(null);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setAuthSession(next);
      /* 상태 변화가 왔다는 것은 로그인 쪽이 살아 있다는 뜻이다 — 아직
         기다리는 중이면 여기서 끝낸다. */
      if (!settled) { settled = true; clearTimeout(giveUp); setAuthReady(true); }
      // 재설정 메일 링크로 돌아온 경우다. 세션만 열고 끝내면 비밀번호는 안 바뀐다.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => {
      clearTimeout(giveUp);
      sub.subscription.unsubscribe();
    };
  }, []);

  const runSync = useCallback(async (silent = false) => {
    if (!authSession?.user) return;
    setSyncState((s) => ({ ...s, busy: true }));
    try {
      const merged = await syncNow(authSession.user.id, {
        review, progress, settings, stats, streak, customWords, memos, videos: videoBundle,
      });
      setReview(merged.review);
      setProgress((p) => ({ ...p, ...merged.progress }));
      setStats(merged.stats);
      setStreak(merged.streak);
      setCustomWords(merged.customWords);
      setMemos(merged.memos);
      applyVideoBundle(merged.videos);
      /* 서버에서 온 설정은 학습 범위만 들어 있다 — 기기별 설정은 덮지 않는다.
         메뉴 목록만은 얹지 않고 합친다. 서버에 저장된 건 새 메뉴가 생기기 전
         것이라, 그냥 얹으면 만든 적도 없는 것처럼 사라진다. */
      setSettings((s) => mergeSyncedSettings(s, merged.settings, DEFAULT_SETTINGS));
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

  const saveRemoteKey = useCallback(async (envelope) => {
    if (!authSession?.user) throw new Error('로그인이 필요해요');
    await pushMerged(authSession.user.id, {
      review, progress, settings: pickSyncedSettings(settings), stats, streak,
      customWords, memos, gttsKeyEnc: envelope,
    });
    setRemoteKeyEnvelope(envelope);
  }, [authSession, review, progress, settings, stats, streak, customWords, memos]);

  const rememberVaultKey = useCallback((raw) => {
    setVaultKey(raw);
    saveVaultKey(raw);
  }, []);

  /* API 키를 계정에 자동으로 잠가 두고, 새 기기에서는 자동으로 풀어 온다.
   * 사용자가 따로 누를 게 없어야 한다 — 눌러야 하면 안 누른다. */
  useEffect(() => {
    if (!authSession?.user || !vaultKey) return;

    // 이 기기에 키가 없고 서버에 봉투가 있으면 → 풀어서 가져온다
    if (!settings.gttsKey && remoteKeyEnvelope) {
      decryptWithVaultKey(remoteKeyEnvelope, vaultKey).then((key) => {
        if (key) {
          patchSettings({ gttsKey: key });
          showToast('음성 키를 계정에서 가져왔어요');
        } else {
          // 비밀번호를 바꿨으면 예전 봉투는 못 연다
          showToast('계정에 보관된 음성 키를 열지 못했어요. 키를 다시 넣어 주세요');
        }
      });
      return;
    }

    // 이 기기에 키가 있으면 → 서버 봉투를 이 키로 맞춰 둔다
    if (settings.gttsKey) {
      decryptWithVaultKey(remoteKeyEnvelope, vaultKey).then(async (stored) => {
        if (stored === settings.gttsKey) return; // 이미 같은 키가 올라가 있다
        const envelope = await encryptWithVaultKey(settings.gttsKey, vaultKey);
        try {
          await saveRemoteKey(envelope);
        } catch { /* 다음 동기화에서 다시 시도한다 */ }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, vaultKey, settings.gttsKey, remoteKeyEnvelope]);

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
    if (!authSession?.user || syncedFor.current !== authSession.user.id) return undefined;
    dirty.current = true;
    const send = () => {
      if (!dirty.current) return;
      dirty.current = false;
      pushedAt.current = Date.now();
      runSync(true);
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
    recovering,
    setRecovering,
    rememberVaultKey,
    runSync,
    syncedFor,
    patchSettings
  };
}
