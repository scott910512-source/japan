import { Component } from 'react';
import { exportBackup } from '../lib/storage.js';
import { todayKey } from '../lib/review.js';

/* 앱 전체를 감싸는 마지막 안전망.
 *
 * 화면 하나가 죽는 것은 ScreenSlot이 받는다. 그런데 App 자체가 그리다 죽으면(저장된 기록의 모양이 틀렸을 때 등)
 * 받아 줄 것이 없어서 열 때마다 하얀 화면이었다 — 설정까지 못 가니 백업도 초기화도 못 한다.
 * 여기서는 기록을 건드리지 않는다. 다시 불러오기와, 기록을 파일로 꺼내 두는 길만 준다. */
export default class AppErrorBoundary extends Component {
  state = { failed: false, saved: '' };

  static getDerivedStateFromError() { return { failed: true }; }

  download = () => {
    try {
      const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `js-japanese-backup-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.setState({ saved: '백업 파일을 내려받았어요.' });
    } catch {
      this.setState({ saved: '백업 파일을 만들지 못했어요.' });
    }
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen-feedback app-crash" role="alert">
        <h2>앱을 여는 중에 문제가 생겼어요</h2>
        <p>저장된 학습 기록은 지우지 않았어요. 다시 불러와도 같은 화면이면 기록을 파일로 내려받아 두세요.</p>
        <button className="submit-btn app-crash-reload" onClick={() => window.location.reload()}>다시 불러오기</button>
        <button className="ghost-btn app-crash-backup" onClick={this.download}>기록 백업 내려받기</button>
        {this.state.saved && <p role="status">{this.state.saved}</p>}
      </div>
    );
  }
}
