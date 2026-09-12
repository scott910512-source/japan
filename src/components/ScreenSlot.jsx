import { Component, Suspense, useEffect, useState } from 'react';

export function ScreenLoading({ label = '화면을 준비하고 있어요' }) {
  return <div className="screen-feedback" role="status" aria-live="polite">
    <span className="loading-mark" aria-hidden="true" />
    <p>{label}</p>
  </div>;
}

// 업데이트 뒤 이전 청크가 사라져도 빈 화면으로 끝내거나 기록을 지우지 않는다.
class ScreenErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

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
