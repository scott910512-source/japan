import { useEffect, useMemo, useRef, useState } from 'react';
import { hunterProfile } from '../lib/hunter.js';
import { GUIDES, REGIONS } from '../data/hunterTheme.js';
import MistakeNotebook from './MistakeNotebook.jsx';
import '../styles/hunter.css';

/* Character assets are kept in the theme, independently of learning data. */
export function HunterGuide({ guide, small = false, celebrate = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const retry = () => setFailed(false);
    retry();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [guide.id, small]);
  return <span className={'hunter-guide' + (small ? ' small' : '') + (celebrate ? ' celebrate' : '')}>
    {failed
      ? <span className="hunter-guide-fallback" role="img" aria-label={`${guide.name} 가이드`}>{guide.name}</span>
      : <img src={small ? guide.portrait : guide.image} alt={`${guide.name} 가이드`} loading={small ? 'lazy' : 'eager'} referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
  </span>;
}
function WorldMap({ profile, selected, onSelect }) {
  return <div className="hunter-map" aria-label="헌터 학습 지역 지도">
    <div className="hunter-map-title"><span>THE LEARNING WORLD</span><h2>다음 모험은 어디로?</h2><p>N5의 첫걸음부터 N3 실전까지</p></div>
    <div className="hunter-map-land" aria-hidden="true" />
    <svg className="hunter-map-path" viewBox="0 0 500 650" preserveAspectRatio="none" aria-hidden="true"><path d="M120 520C300 555 425 455 355 442S80 410 130 344S430 335 355 260S60 240 125 162S390 155 350 78" /></svg>
    {REGIONS.map((region, index) => <button key={region.id}
      className={`hunter-region ${selected === index ? 'selected' : ''} ${profile.recommended === index ? 'recommended' : ''}`}
      style={{ left: `${region.x}%`, top: `${region.y}%` }} onClick={() => onSelect(index)} aria-pressed={selected === index}>
      {profile.recommended === index && <em>추천 경로</em>}
      <span className="hunter-region-icon" aria-hidden="true">{region.icon}</span>
      <b>{region.name}</b><small>{region.level} · {region.kind}</small>
    </button>)}
    <span className="hunter-map-compass" aria-hidden="true">✧<small>N</small></span>
  </div>;
}

const HOME_TABS = [
  { id: 'today', title: '오늘', sub: '일일 퀘스트' },
  { id: 'map', title: '지도', sub: '지역 탐험' },
  { id: 'mistakes', title: '오답', sub: '재학습·재시험' },
  { id: 'record', title: '기록', sub: '헌터 성장' },
];

export default function HunterDashboard({ children, words, review, progress, stats, streak, settings, onOpen, onSettings, onReview, onAttempt, onLearnMistake, homeResetKey }) {
  const profile = useMemo(() => hunterProfile({ words, review, progress }), [words, review, progress]);
  const lastReward = useRef({ xp: profile.xp, level: profile.level });
  const [reward, setReward] = useState(null);
  useEffect(() => {
    const last = lastReward.current;
    if (profile.xp > last.xp) setReward({ xp: profile.xp - last.xp, levelUp: profile.level > last.level });
    lastReward.current = { xp: profile.xp, level: profile.level };
  }, [profile.xp, profile.level]);
  const [selected, setSelected] = useState(null);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [pane, setPane] = useState('today');
  const tabRefs = useRef([]);
  const rootRef = useRef(null);
  useEffect(() => { setPane('today'); }, [homeResetKey]);
  useEffect(() => { rootRef.current?.closest('.screen')?.scrollTo({ top: 0, behavior: 'instant' }); }, [pane]);
  const region = REGIONS[selected ?? profile.recommended];
  const guide = GUIDES.find((g) => g.id === settings.hunterGuide) || GUIDES[0];
  const moveTab = (event, index) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? HOME_TABS.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % HOME_TABS.length
        : event.key === 'ArrowLeft' ? (index + HOME_TABS.length - 1) % HOME_TABS.length : null;
    if (next == null) return;
    event.preventDefault(); setPane(HOME_TABS[next].id); tabRefs.current[next]?.focus();
  };
  const earned = profile.badges.filter((b) => b.earned);
  const todayActivity = Object.entries(stats || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  const open = (mission) => onOpen(mission.id, mission.view ? { view: mission.view } : {});
  return <div className="hunter-home hunter-home-tabs" ref={rootRef} data-pane={pane}>
    <header className="hunter-top">
      <div className="hunter-brand"><span className="hunter-brand-mark" aria-hidden="true">H<span>×</span>H</span><div><small>YOUR JAPANESE ADVENTURE</small><h1><span lang="ja">日本語</span> HUNTER</h1></div></div>
      <div className="hunter-top-stats"><span>🔥 <b>{streak.count || 0}일</b> 연속</span><span>◆ <b>{profile.xp.toLocaleString()}</b> XP</span><span>♛ <b>Lv. {profile.level}</b></span></div>
    </header>
    <div className="hunter-welcome"><HunterGuide guide={guide} celebrate={Boolean(profile.seen)} /><div><small>{guide.name} · {guide.role}</small><h2>오늘도 한 걸음, 헌터의 길!</h2><p>{guide.quote}</p></div><span className="hunter-welcome-seal">HUNTER<br />EXAM<br /><b>N5 → N3</b></span></div>
    <div className="hunter-home-navigation">
      <nav className="hunter-shortnav" role="tablist" aria-label="헌터 홈 화면">
        {HOME_TABS.map((tab, index) => <button key={tab.id} ref={(el) => { tabRefs.current[index] = el; }} role="tab" id={`hunter-tab-${tab.id}`} aria-selected={pane === tab.id} aria-controls={`hunter-panel-${tab.id}`} tabIndex={pane === tab.id ? 0 : -1} onClick={() => setPane(tab.id)} onKeyDown={(event) => moveTab(event, index)}><b>{tab.title}</b><small>{tab.sub}</small></button>)}
      </nav>
      <button className="hunter-diagnose" onClick={() => onOpen('n3', { view: { kind: 'test', id: 't:ch0' } })}>↗ 레벨 진단</button>
    </div>
    {reward && <div className="hunter-reward" role="status"><b>{reward.levelUp ? `레벨 업! Lv. ${profile.level}` : '수련 기록이 쌓였어요'} · +{reward.xp} XP</b><button onClick={() => setReward(null)} aria-label="XP 알림 닫기">×</button></div>}
    <div className="hunter-grid">
      <section className="hunter-tabpanel" id="hunter-panel-today" role="tabpanel" aria-labelledby="hunter-tab-today" hidden={pane !== 'today'}>
      <div className="hunter-daily">
        {children}
        <details className="hunter-quick-fold"><summary>빠른 수련 열기</summary>
        <section className="hunter-panel hunter-quick"><div className="hunter-section-head"><h2>빠른 수련</h2><small>원하는 것만 가볍게</small></div><div>
          {[['쭉 퀴즈', 'stream', '⚡'], ['한자 연구', 'kanji', '漢'], ['듣기', 'listen', '♫'], ['문장 만들기', 'compose', '✎']].map(([name, id, icon]) => <button key={id} onClick={() => onOpen(id)}><span aria-hidden="true">{icon}</span>{name}</button>)}
        </div></section>
        </details>
      </div>
      </section>
      <section className="hunter-world hunter-tabpanel" id="hunter-panel-map" role="tabpanel" aria-labelledby="hunter-tab-map" hidden={pane !== 'map'}>
        <WorldMap profile={profile} selected={selected ?? profile.recommended} onSelect={setSelected} />
        <div className="hunter-region-detail hunter-panel" data-region={region.id}>
          <div className="hunter-section-head"><div><small>REGION {REGIONS.indexOf(region) + 1} · {region.level}</small><h2>{region.name}</h2></div><span className="hunter-tag">{profile.recommended === REGIONS.indexOf(region) ? '추천 지역' : '자유 탐험'}</span></div>
          <p>{region.intro}</p><div className="hunter-region-missions">{region.missions.map((mission, i) => <button key={mission.title} onClick={() => open(mission)}><span>{i + 1}</span><div><b>{mission.title}</b><small>{mission.note}</small></div><i aria-hidden="true">↗</i></button>)}</div>
          <small className="hunter-explore-note">지도는 권장 학습 순서예요. 모든 지역을 자유롭게 탐험할 수 있어요.</small>
        </div>
      </section>
      <section className="hunter-tabpanel hunter-mistakes-pane" id="hunter-panel-mistakes" role="tabpanel" aria-labelledby="hunter-tab-mistakes" hidden={pane !== 'mistakes'}>
        <div className="hunter-pane-intro"><small>KILLUA'S REVIEW</small><h2>틀린 곳부터 다시, 확실하게.</h2><p>오답 기록을 보고 다시 학습하거나 재시험을 시작해요.</p></div>
        <MistakeNotebook book={progress?.mistakes} onAttempt={onAttempt} onLearn={onLearnMistake} />
      </section>
      <section className="hunter-record hunter-tabpanel" id="hunter-panel-record" role="tabpanel" aria-labelledby="hunter-tab-record" hidden={pane !== 'record'}>
        <section className="hunter-panel hunter-license"><div className="hunter-section-head"><h2>헌터 라이선스</h2><span className="hunter-tag">성장 기록</span></div><div className="hunter-license-main"><div className="hunter-license-card" aria-hidden="true"><small>HUNTER</small><b>H<span>×</span>H</b><span>LICENSE</span></div><div><strong>Lv. {profile.level}</strong><b>{profile.rank}</b><small>다음 레벨까지 {profile.ceiling - profile.xp} XP</small></div></div><div className="hunter-meter" role="progressbar" aria-label="다음 헌터 레벨 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profile.percent}><i style={{ width: `${profile.percent}%` }} /></div><p className="hunter-xp-count">{profile.xp.toLocaleString()} / {profile.ceiling.toLocaleString()} XP</p><details><summary>XP는 어떻게 쌓이나요?</summary><p>직접 학습한 카드마다 10 XP, 문법·N3 레슨 완료마다 25 XP, 상황 대화 첫 통과마다 75 XP, 시험 종류별 첫 완료마다 20 XP. 같은 항목을 반복해도 보상은 한 번만 계산해요. 기존 학습 기록도 포함돼요.</p></details></section>
        <section className="hunter-panel hunter-skills"><div className="hunter-section-head"><h2>나의 넨 능력</h2><span className="hunter-tag">학습 지표</span></div>{profile.skills.map((skill) => <button key={skill.key} onClick={() => onOpen(skill.menu)}><span className="hunter-skill-symbol" aria-hidden="true">{skill.icon}</span><div><b>{skill.label}</b><div className="hunter-meter"><i style={{ width: `${skill.pct || 0}%` }} /></div><small>{skill.detail}</small></div><strong>{skill.pct == null ? '—' : `${skill.pct}%`}</strong></button>)}<p>실제 학습 기록 기준이며 공식 JLPT 등급이나 말하기 평가가 아니에요.</p></section>
        <section className="hunter-panel hunter-badges"><div className="hunter-section-head"><h2>획득한 배지 <small>{earned.length} / {profile.badges.length}</small></h2><button onClick={() => setShowAllBadges(!showAllBadges)} aria-expanded={showAllBadges}>{showAllBadges ? '접기' : '배지 보기'}</button></div><div>{(showAllBadges ? profile.badges : earned.length ? earned.slice(-3) : profile.badges.slice(0, 3)).map((badge) => <div key={badge.id} className={badge.earned ? 'earned' : 'locked'}><span aria-hidden="true">{badge.symbol}</span><b>{badge.title}</b><small>{badge.earned ? '획득' : badge.note}</small></div>)}</div></section>
        <section className="hunter-panel hunter-growth"><div className="hunter-section-head"><h2>모험의 발자국</h2><button onClick={onReview}>복습하기 ↗</button></div><div className="hunter-growth-numbers"><div><b>{profile.seen}</b><small>학습한 카드</small></div><div><b>{profile.lessons}</b><small>N3 레슨 완료</small></div><div><b>{profile.cleared}</b><small>상황 대화 통과</small></div></div><div className="hunter-days" aria-label="최근 활동일">{todayActivity.length ? todayActivity.map(([day, activity]) => <div key={day}><i style={{ height: `${Math.min(56, 6 + (activity.studied || 0) + (activity.listen || 0))}px` }} /><small>{day.slice(5)}</small></div>) : <p>첫 수련을 마치면 여기에 기록이 쌓여요.</p>}</div><p className="hunter-diagnostic">{profile.diagnostic?.total ? `N4 문법 진단 최고 ${Math.round((profile.diagnostic.best || 0) * 100)}% · 권장 지역 ${REGIONS[profile.recommended].name}` : '문법 진단으로 나에게 맞는 시작 지역을 찾아보세요.'}</p></section>
        <section className="hunter-panel hunter-guides"><div className="hunter-section-head"><h2>함께할 가이드</h2><small>변경하면 저장돼요</small></div><div>{GUIDES.map((g) => <button key={g.id} aria-pressed={g.id === guide.id} onClick={() => onSettings({ hunterGuide: g.id })}><HunterGuide guide={g} small /><span>{g.name}</span></button>)}</div><p>캐릭터 이미지: NEN×IMPACT 공식 사이트</p></section>
      </section>
    </div>
  </div>;
}
