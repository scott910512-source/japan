import { Component, Suspense, useEffect, useState } from 'react';

export function ScreenLoading({ label = '화면을 준비하고 있어요' }) {
  return <div className="screen-feedback" role="status" aria-live="polite">
    <span className="loading-mark" aria-hidden="true" />
    <p>{label}</p>
  </div>;
}

/* ★ 새 버전이 나간 뒤 열어 둔 화면에서 옛 화면 파일(청크)이 404 ★ (2026-11-17 QA B04)
 * 배포하면 파일 이름(해시)이 바뀌어서, 전에 연 탭에서 처음 여는 화면은 옛 이름으로 받으러 가다 실패한다.
 * 그건 고장이 아니라 「새 버전이 있다」는 뜻이라 한 번 자동으로 새로 불러온다. 같은 탭에서 1분 안에 또 실패하면
 * (정말로 연결이 안 되는 것) 되풀이하지 않고 아래 「다시 불러오기」를 보여 준다 — 무한 새로고침을 막는다. */
const CHUNK_FAIL = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError|Unable to preload CSS/i;
const RELOAD_KEY = 'jp_chunk_reload_at';
export function reloadForNewVersion(err, { now = Date.now(), storage = globalThis.sessionStorage, reload = () => window.location.reload() } = {}) {
  if (!CHUNK_FAIL.test(String(err?.message || err || ''))) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  let last = 0;
  try { last = Number(storage?.getItem(RELOAD_KEY)) || 0; } catch { /* 저장 못 하면 한 번만 시도 */ }
  if (last && now - last < 60000) return false;
  try { storage?.setItem(RELOAD_KEY, String(now)); } catch { /* 무시 */ }
  reload();
  return true;
}

// 업데이트 뒤 이전 청크가 사라져도 빈 화면으로 끝내거나 기록을 지우지 않는다.
class ScreenErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(err) { reloadForNewVersion(err); }

  render() {
    if (this.state.failed) return <div className="screen-feedback" role="alert">
      <h2>화면을 불러오지 못했어요</h2>
      <p>연결을 확인하고 다시 열어 주세요. 저장된 학습 기록은 그대로 남아 있어요.</p>
      <button className="submit-btn" onClick={() => window.location.reload()}>다시 불러오기</button>
    </div>;
    return this.props.children;
  }
}

export function DeferredScreen({ children }) {
  return <ScreenErrorBoundary>
    <Suspense fallback={<ScreenLoading />}>{children}</Suspense>
  </ScreenErrorBoundary>;
}

// 처음 방문할 때 로드하고 이후에는 유지한다. 탭 이동으로 입력·스크롤을 잃지 않는다.
export function ScreenSlot({ active, children }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);

  return <section className={`screen${active ? ' active' : ''}`} aria-hidden={!active}>
    {(active || visited) && <DeferredScreen>{children}</DeferredScreen>}
  </section>;
}
