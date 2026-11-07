import { GUIDES } from '../data/hunterTheme.js';

export default function HunterAppHeader({ guideId, section, onHome, onAsk = null }) {
  const guide = GUIDES.find((g) => g.id === guideId) || GUIDES[0];
  return <header className="hunter-appbar">
    <button className="hunter-app-brand" onClick={onHome} aria-label="헌터 홈으로"><span aria-hidden="true">H<span>×</span>H</span><b><span lang="ja">日本語</span> HUNTER</b></button>
    <div className="hunter-app-context"><span>{section}</span>{onAsk ? (
        /* 이 화면에서는 떠 있는 단추 대신 상단 곤 얼굴이 「곤에게 물어보기(AI)」를 연다 — 아래 버튼을 안 가린다 */
        <button type="button" className="hunter-app-ask" onClick={onAsk} aria-label="곤에게 물어보기 (AI)">
          <img key={guide.id} src={guide.portrait} alt={`${guide.name} 가이드`} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
          <span className="hunter-app-ai" aria-hidden="true">AI</span>
        </button>
      ) : (
        <img key={guide.id} src={guide.portrait} alt={`${guide.name} 가이드`} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
      )}
    </div>
  </header>;
}
