import { REGIONS } from '../data/hunterTheme.js';
import { REGION_RULES, REGION_QUIZ_MIN, leftText } from '../lib/regions.js';

/* 성장 지도 — 「지금 어디까지 했고, 다음에 무엇을 하면 승급하는가」.
 *
 * 숫자는 전부 lib/regions.js가 기존 기록으로 센 것이다. 여기서는 그리기만 한다.
 * 장식(아이콘 · 문구)보다 목표 · 남은 수련 · 승급 상태가 먼저 보이게 둔다. */
const pct = (x) => `${Math.round((x || 0) * 100)}%`;

export function WorldMap({ states, selected, recommended, onSelect }) {
  return <div className="hunter-map" aria-label="헌터 성장 지도">
    <div className="hunter-map-title"><span>GROWTH MAP</span><h2>다음 승급은 어디서?</h2><p>수련을 채우고 승급시험을 통과하면 지역이 클리어돼요</p></div>
    <div className="hunter-map-land" aria-hidden="true" />
    <svg className="hunter-map-path" viewBox="0 0 500 650" preserveAspectRatio="none" aria-hidden="true"><path d="M120 520C300 555 425 455 355 442S80 410 130 344S430 335 355 260S60 240 125 162S390 155 350 78" /></svg>
    {REGIONS.map((region, index) => {
      const st = states[index];
      return <button key={region.id}
        className={`hunter-region ${selected === index ? 'selected' : ''} ${recommended === index ? 'recommended' : ''} ${st?.cleared ? 'cleared' : ''}`}
        style={{ left: `${region.x}%`, top: `${region.y}%` }} onClick={() => onSelect(index)} aria-pressed={selected === index}
        data-phase={st?.phase}>
        {recommended === index && <em>다음 승급</em>}
        {st?.cleared && <em className="hunter-region-clear">클리어</em>}
        <span className="hunter-region-icon" aria-hidden="true">{region.icon}</span>
        <b>{region.name}</b>
        <small>{region.level} · {st?.loading ? '계산 중' : `수련 ${st?.reqsDone}/${st?.reqsTotal}`}</small>
      </button>;
    })}
    <span className="hunter-map-compass" aria-hidden="true">✧<small>N</small></span>
  </div>;
}

function phaseLine(st, nextRegion) {
  if (st.loading) return { head: 'N3 코스 기록을 계산하는 중이에요', sub: '' };
  if (st.cleared) return { head: '승급시험 통과 · 지역 클리어', sub: nextRegion ? `다음 지역 추천: ${nextRegion.name}` : '모든 지역을 클리어했어요' };
  if (st.phase === 'retry') return { head: `승급시험 최고 ${pct(st.exam.best)} · 통과 기준 ${pct(st.exam.pass)} · 다시 도전해요`, sub: '' };
  if (st.phase === 'exam') return { head: '필수 수련 완료 · 승급시험을 볼 수 있어요', sub: '실력 확인 전 — 시험을 보면 알 수 있어요' };
  return { head: `필수 수련 ${st.reqsTotal}개 중 ${st.reqsDone}개 달성`, sub: `남은 수련 → ${leftText(st)}` };
}

export function RegionDetail({ index, state: st, recommended, nextRegion, wordsSeenForQuiz, onOpenMission, onGo, onExam, onSelectNext }) {
  const region = REGIONS[index];
  const rule = REGION_RULES[index];
  const { head, sub } = phaseLine(st, nextRegion);
  const quizNeedsWords = rule.exam.source === 'region' && wordsSeenForQuiz < REGION_QUIZ_MIN;
  const examDisabled = !st.examOpen || quizNeedsWords || st.loading;
  const examState = st.exam.state === 'passed' ? `최고 ${pct(st.exam.best)} · 통과` : st.exam.state === 'failed' ? `최고 ${pct(st.exam.best)} · 기준 미달 (${st.exam.tries}회 응시)` : '응시 기록 없음 · 실력 확인 전';
  const nextReq = st.next;
  return <div className="hunter-region-detail hunter-panel" data-region={region.id} data-phase={st.phase}>
    <div className="hunter-section-head"><div><small>REGION {index + 1} · {region.level}</small><h2>{region.name}</h2></div>
      <span className="hunter-tag">{st.cleared ? '클리어' : recommended === index ? '다음 승급' : '수련 중'}</span></div>
    <p className="hunter-goal"><b>목표</b> {st.goal}</p>

    <div className="hunter-status" role="status">
      <b>{head}</b>
      {sub && <small>{sub}</small>}
    </div>

    <ul className="hunter-reqs" aria-label="필수 수련">
      {st.reqs.map((r) => <li key={r.id} className={r.ok ? 'ok' : ''} data-req={r.id}>
        <button onClick={() => onGo(r)} disabled={!r.go}>
          <span className="hunter-req-mark" aria-hidden="true">{r.ok ? '✓' : ''}</span>
          <span className="hunter-req-body">
            <b>{r.label}</b>
            <i role="progressbar" aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.done}><em style={{ width: `${r.total ? Math.min(100, Math.round((r.done / r.total) * 100)) : 0}%` }} /></i>
            {r.kind === 'words' && r.seen > r.done && <small>본 단어 {r.seen}개 중 날짜를 두고 확인된 것만 세요</small>}
          </span>
          <strong>{r.measured ? <>{r.done}<small> / {r.total}{r.unit}</small></> : '계산 중'}</strong>
        </button>
      </li>)}
    </ul>

    <div className="hunter-exam" data-exam={st.exam.state}>
      <div><small>승급시험</small><b>{st.exam.label}</b></div>
      <p>응시 조건: 필수 수련을 모두 달성 · 통과 기준: 정답률 {pct(st.exam.pass)} 이상</p>
      <p className="hunter-exam-state">{examState}</p>
      {quizNeedsWords && st.examOpen && <p className="hunter-exam-note">본 낱말이 {REGION_QUIZ_MIN}개 이상 있어야 낼 수 있어요 (지금 {wordsSeenForQuiz}개)</p>}
    </div>

    <div className="hunter-nextact">
      {st.cleared
        ? <button className="submit-btn" onClick={onSelectNext} disabled={!nextRegion}>{nextRegion ? `다음 지역 보기 · ${nextRegion.name}` : '모든 지역 클리어'}</button>
        : (st.phase === 'exam' || st.phase === 'retry')
          ? <button className="submit-btn hunter-exam-go" onClick={onExam} disabled={examDisabled}>승급시험 보기</button>
          : nextReq
            ? <button className="submit-btn" onClick={() => onGo(nextReq)}>다음 수련 · {nextReq.label} {nextReq.total - nextReq.done}{nextReq.unit} 더</button>
            : null}
      {!st.cleared && st.phase === 'train' && <button className="ghost-btn hunter-exam-go" onClick={onExam} disabled={examDisabled}>승급시험 (수련을 마치면 열려요)</button>}
    </div>

    <details className="hunter-free">
      <summary>자유 탐험 · 이 지역의 수련 메뉴</summary>
      <div className="hunter-region-missions">{region.missions.map((mission, i) => <button key={mission.title} onClick={() => onOpenMission(mission)}><span>{i + 1}</span><div><b>{mission.title}</b><small>{mission.note}</small></div><i aria-hidden="true">↗</i></button>)}</div>
      <small className="hunter-explore-note">자유 입장은 언제든 돼요. 다만 지역 클리어는 필수 수련 달성과 승급시험 통과로만 돼요.</small>
    </details>
  </div>;
}
