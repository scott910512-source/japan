import { GUIDES } from '../data/hunterTheme.js';

export default function HunterAppHeader({ guideId, section, onHome }) {
  const guide = GUIDES.find((g) => g.id === guideId) || GUIDES[0];
  return <header className="hunter-appbar">
    <button className="hunter-app-brand" onClick={onHome} aria-label="헌터 홈으로"><span aria-hidden="true">H<span>×</span>H</span><b><span lang="ja">日本語</span> HUNTER</b></button>
    <div className="hunter-app-context"><span>{section}</span><img key={guide.id} src={guide.portrait} alt={`${guide.name} 가이드`} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} /></div>
  </header>;
}
