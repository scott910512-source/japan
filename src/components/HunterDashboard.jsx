import { useEffect, useMemo, useRef, useState } from 'react';
import { hunterProfile } from '../lib/hunter.js';
import { GUIDES, REGIONS } from '../data/hunterTheme.js';
import { WorldMap, RegionDetail } from './GrowthMap.jsx';
import { useN3Meta } from '../hooks/useN3Meta.js';
import { evaluateRegions, recommendedRegion, REGION_RULES } from '../lib/regions.js';
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
const HOME_TABS = [
  { id: 'today', title: '오늘', sub: '일일 퀘스트' },
  { id: 'map', title: '지도', sub: '성장·승급' },
  { id: 'record', title: '기록', sub: '헌터 성장' },
];

export default function HunterDashboard({ children, words, review, progress, stats, streak, settings, onOpen, onSettings, onReview, onOpenProgress, onStartRegionExam, homeResetKey, onAsk = null }) {
  const profile = useMemo(() => hunterProfile({ words, review, progress }), [words, review, progress]);
  const lastReward = useRef({ xp: profile.xp, level: profile.level });
  const [reward, setReward] = useState(null);
  useEffect(() => {
    const last = lastReward.current;
    if (profile.xp > last.xp) setReward({ xp: profile.xp - last.xp, levelUp: profile.level > last.level });
    lastReward.current = { xp: profile.xp, level: profile.level };
  }, [profile.xp, profile.level]);
  const [selected, setSelected] = useState(null);
  /* ★ 성장 지도의 숫자 ★ 기존 학습 기록(review · progress)을 lib/regions.js의 규칙으로 센 것뿐이다.
     N3 코스 달성 수는 코스 자료가 커서 지도 탭을 열었을 때만 불러온다 */
  const [pane, setPane] = useState('today');
  const n3meta = useN3Meta({ enabled: pane === 'map', review, progress });
  const regionStates = useMemo(() => evaluateRegions({ words, review, progress, n3meta }), [words, review, progress, n3meta]);
  const recIndex = recommendedRegion(regionStates);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const tabRefs = useRef([]);
  const rootRef = useRef(null);
  useEffect(() => { setPane('today'); }, [homeResetKey]);
  useEffect(() => { rootRef.current?.closest('.screen')?.scrollTo({ top: 0, behavior: 'instant' }); }, [pane]);
  const shown = selected ?? recIndex ?? 0;
  const region = REGIONS[shown];
  const seenOf = (level) => words.filter((w) => String(w.level).toUpperCase() === level && review?.[w.id]?.lastSeen && !review[w.id].selfKnown).length;
  /* 지도의 수련 줄 → 해당 화면. 단어 항목은 그 레벨 단어만 열린다(설정 레벨 필터 대신 이 화면에서만 덮어쓴다) */
  const goReq = (req) => { if (req?.go) onOpen(req.go.menu, { ...(req.go.view ? { view: req.go.view } : {}), ...(req.kind === 'words' ? { levels: [req.level] } : {}) }); };
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
  /* 자유 탐험 — 지역의 레벨 단어만 열린다. N5 지역에서 설정의 레벨(N3 등)로 열리지 않게 이 화면에서만 레벨을 덮어쓴다 */
  const LEVEL_BOUND = ['words', 'conjugate', 'stream', 'match', 'quiz'];
  const open = (mission, level = null) => onOpen(mission.id, { ...(mission.view ? { view: mission.view } : {}), ...(level && LEVEL_BOUND.includes(mission.id) ? { levels: [level] } : {}) });
  return <div className="hunter-home hunter-home-tabs" ref={rootRef} data-pane={pane}>
    <header className="hunter-top">
      <div className="hunter-brand"><span className="hunter-brand-mark" aria-hidden="true">H<span>×</span>H</span><div><small>YOUR JAPANESE ADVENTURE</small><h1><span lang="ja">日本語</span> HUNTER</h1></div></div>
      <div className="hunter-top-stats"><span>🔥 <b>{streak.count || 0}일</b> 연속</span><span>◆ <b>{profile.xp.toLocaleString()}</b> XP</span><span>♛ <b>Lv. {profile.level}</b></span></div>
      {/* 곤에게 물어보기(AI) — 떠 있던 단추가 퀘스트 줄 오른쪽을 가려서 머리로 올렸다. 다른 화면의 상단 곤 얼굴과 같은 단추다 */}
      {onAsk && (
        <button type="button" className="hunter-app-ask hunter-top-ask" onClick={onAsk} aria-label="곤에게 물어보기 (AI)">
          <img src={guide.portrait} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
          <span className="hunter-app-ai" aria-hidden="true">AI</span>
        </button>
      )}
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
        <WorldMap states={regionStates} selected={shown} recommended={recIndex} onSelect={setSelected} />
        <RegionDetail index={shown} state={regionStates[shown]} recommended={recIndex}
          nextRegion={recIndex != null && recIndex !== shown ? REGIONS[recIndex] : null}
          wordsSeenForQuiz={REGION_RULES[shown].exam.level ? seenOf(REGION_RULES[shown].exam.level) : 0}
          onOpenMission={(m) => open(m, region.level)} onGo={goReq} onExam={() => onStartRegionExam?.(region.id)}
          onSelectNext={() => setSelected(recIndex ?? shown)} />
      </section>
      <section className="hunter-record hunter-tabpanel" id="hunter-panel-record" role="tabpanel" aria-labelledby="hunter-tab-record" hidden={pane !== 'record'}>
        <section className="hunter-panel hunter-license"><div className="hunter-section-head"><h2>헌터 라이선스</h2><span className="hunter-tag">활동 보상</span></div><div className="hunter-license-main"><div className="hunter-license-card" aria-hidden="true"><small>HUNTER</small><b>H<span>×</span>H</b><span>LICENSE</span></div><div><strong>Lv. {profile.level}</strong><b>{profile.rank}</b><small>활동 보상 레벨 · 다음 레벨까지 {profile.ceiling - profile.xp} XP</small></div></div><div className="hunter-meter" role="progressbar" aria-label="다음 헌터 레벨 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profile.percent}><i style={{ width: `${profile.percent}%` }} /></div><p className="hunter-xp-count">{profile.xp.toLocaleString()} / {profile.ceiling.toLocaleString()} XP</p><details><summary>XP · 지역 승급 · N3 준비도는 뭐가 달라요?</summary><p><b>헌터 XP · 레벨</b>은 학습 활동에 주는 보상이에요. XP가 높아도 지역이 클리어되지 않아요. <b>지역 승급</b>은 지도에서 필수 수련을 채우고 승급시험을 통과해야 해요. <b>N3 준비도</b>는 N3 코스의 영역별 학습·평가 기록이고, 지역 클리어와는 다른 수치예요.</p><p>직접 학습한 카드마다 10 XP, 문법·N3 레슨 완료마다 25 XP, 상황 대화 첫 통과마다 75 XP, 시험 종류별 첫 완료마다 20 XP. 같은 항목을 반복해도 보상은 한 번만 계산해요. 기존 학습 기록도 포함돼요.</p></details></section>
        <section className="hunter-panel hunter-skills"><div className="hunter-section-head"><h2>나의 넨 능력</h2><span className="hunter-tag">학습 지표</span></div>{profile.skills.map((skill) => <button key={skill.key} onClick={() => onOpen(skill.menu)}><span className="hunter-skill-symbol" aria-hidden="true">{skill.icon}</span><div><b>{skill.label}</b><div className="hunter-meter"><i style={{ width: `${skill.pct || 0}%` }} /></div><small>{skill.detail}</small></div><strong>{skill.pct == null ? '—' : `${skill.pct}%`}</strong></button>)}<p>실제 학습 기록 기준이며 공식 JLPT 등급이나 말하기 평가가 아니에요.</p></section>
        <section className="hunter-panel hunter-badges"><div className="hunter-section-head"><h2>획득한 배지 <small>{earned.length} / {profile.badges.length}</small></h2><button onClick={() => setShowAllBadges(!showAllBadges)} aria-expanded={showAllBadges}>{showAllBadges ? '접기' : '배지 보기'}</button></div><div>{(showAllBadges ? profile.badges : earned.length ? earned.slice(-3) : profile.badges.slice(0, 3)).map((badge) => <div key={badge.id} className={badge.earned ? 'earned' : 'locked'}><span aria-hidden="true">{badge.symbol}</span><b>{badge.title}</b><small>{badge.earned ? '획득' : badge.note}</small></div>)}</div></section>
        {/* ★ 단어 회독 ★ 헌터 성장에는 요약만 둔다. 세부(기억 단계별 개수·달력)는 복습&내기록에서 본다 */}
        <section className="hunter-panel hunter-words" data-seen={profile.wordStat.seen} data-mastered={profile.wordStat.mastered}>
          <div className="hunter-section-head"><h2>단어 회독</h2>{onOpenProgress && <button onClick={onOpenProgress}>세부 보기 ↗</button>}</div>
          <div className="hunter-growth-numbers">
            <div><b>{profile.wordStat.seen}<small> / {profile.wordStat.total}</small></b><small>본 단어</small></div>
            <div><b>{profile.wordStat.mastered}</b><small>외운 단어</small></div>
            <div><b>{profile.wordStat.fresh}</b><small>아직 안 본 단어</small></div>
          </div>
          <div className="hunter-levelbars" aria-label="레벨별로 본 단어">
            {Object.entries(profile.levels).map(([lv, v]) => (
              <div key={lv} className="hunter-levelbar" data-level={lv}>
                <span>{lv}</span>
                <i role="progressbar" aria-valuemin={0} aria-valuemax={v.total} aria-valuenow={v.seen}><em style={{ width: `${v.total ? Math.round((v.seen / v.total) * 100) : 0}%` }} /></i>
                <small>{v.seen} / {v.total}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="hunter-panel hunter-growth"><div className="hunter-section-head"><h2>모험의 발자국</h2><button onClick={onReview}>복습하기 ↗</button></div><div className="hunter-growth-numbers"><div><b>{profile.seen}</b><small>학습한 카드</small></div><div><b>{profile.lessons}</b><small>N3 레슨 완료</small></div><div><b>{profile.cleared}</b><small>상황 대화 통과</small></div></div><div className="hunter-days" aria-label="최근 활동일">{todayActivity.length ? todayActivity.map(([day, activity]) => <div key={day}><i style={{ height: `${Math.min(56, 6 + (activity.studied || 0) + (activity.listen || 0))}px` }} /><small>{day.slice(5)}</small></div>) : <p>첫 수련을 마치면 여기에 기록이 쌓여요.</p>}</div><p className="hunter-diagnostic">{profile.diagnostic?.total ? `N4 문법 진단 최고 ${Math.round((profile.diagnostic.best || 0) * 100)}% · 다음 승급 지역 ${REGIONS[recIndex ?? 0].name}` : '문법 진단으로 나에게 맞는 시작 지역을 찾아보세요.'}</p></section>
        <section className="hunter-panel hunter-guides"><div className="hunter-section-head"><h2>함께할 가이드</h2><small>변경하면 저장돼요</small></div><div>{GUIDES.map((g) => <button key={g.id} aria-pressed={g.id === guide.id} onClick={() => onSettings({ hunterGuide: g.id })}><HunterGuide guide={g} small /><span>{g.name}</span></button>)}</div><p>캐릭터 이미지: NEN×IMPACT 공식 사이트</p></section>
      </section>
    </div>
  </div>;
}
