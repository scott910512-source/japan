import { useState } from 'react';
import { IconDownload, IconRewind, IconList, IconMap, IconChevron } from '../components/Icons.jsx';
import { DEFAULT_SETTINGS } from '../lib/storage.js';
import { GOAL_CHOICES, todayKey } from '../lib/review.js';
import {
  normalizeGoals, DAY_PRESETS, spreadGoal, goalTotal, presetOf,
} from '../lib/daily.js';
import Account from './Account.jsx';
import { MENUS, MENU_GROUPS } from '../lib/menu.js';
import { PURPOSES, purposeOf, tripLabel } from '../lib/purpose.js';
/* 여섯 묶음 중 큰 셋(음성 · 백업 · 영상 AI)은 제 파일로 — 이 파일이 930줄이라
   떼어 냈다. 각자 제 상태(키 입력·소리 확인·백업 범위)를 들고, 동작은 그대로다. */
import Toggle from './settings/Toggle.jsx';
import VideoAI from './settings/VideoAI.jsx';
import VoiceSettings from './settings/VoiceSettings.jsx';
import BackupSettings from './settings/BackupSettings.jsx';

/* 메뉴 목록은 lib/menu.js 하나로 정한다. 여기에 또 적어 두면 학습 탭에서
   없앤 메뉴가 설정에는 남아, 켜도 아무 데도 안 뜨는 칸이 생긴다 —
   「JLPT 단어」를 단어암기에 합칠 때 실제로 그럴 뻔했다. */

/* 갈래별 하루 목표. 「약점」이 왜 따로 있는지 한 줄로 적어 둔다 —
   안 적으면 복습과 뭐가 다른지 모른 채로 숫자만 만지게 된다. */
const LANE_GOALS = [
  { key: 'fresh', label: '새 단어', note: '오늘 처음 보는 것' },
  { key: 'review', label: '복습', note: '복습일이 된 것' },
  { key: 'weak', label: '약점', note: '세 번 넘게 틀린 것 — 열 번 넘으면 한 판에 두 번 나와요' },
];

/* ★ 더보기는 고를 것 여섯 줄 ★
   긴 한 화면을 내려가며 찾던 것을, 이름을 보고 들어가는 목록으로 바꾼다.
   sub에 무엇이 들어 있는지 적는다 — 이름만으로는 어디에 뭐가 있는지 모른다. */
const MORE_GROUPS = [
  { id: 'study', label: '학습 설정', sub: '학습 목적 · 하루 분량 · 문장 범위 · 메뉴 · 표시 방식' },
  { id: 'voice', label: '음성', sub: '목소리 · 속도 · 자동 읽기 · 소리 테스트' },
  { id: 'account', label: '계정과 동기화', sub: '로그인 · 기기 간 동기화 상태' },
  { id: 'backup', label: '기록 백업', sub: '내려받기 · 복원 · 무엇이 들어가나' },
  { id: 'tools', label: '학습 도구', sub: '내 단어장 · 번역기 · 영상 AI 연결' },
  { id: 'about', label: '앱 정보', sub: '버전 · 최신 버전 받기 · 초기화' },
];

const DIRECTIONS = [
  { id: 'kanji-mean', label: '한자 → 뜻' },
  { id: 'mean-kanji', label: '뜻 → 한자' },
  { id: 'kanji-kana', label: '한자 → 읽기' },
];


export default function Settings({
  settings, onChange, onReplayOnboarding, onOpenWordManager, onOpenTranslate, onOpenSwiss, onToast, onReload,
  session, syncState, storeError, onSync, onSignedOut, onVaultKey, remoteKeyEnvelope, vaultReady,
}) {
  const goals = normalizeGoals(settings.goals ?? settings.dailyGoal);
  /* 총량으로 고르고 갈래는 접어 둔다. 기존에 직접 맞춰 둔 목표는 프리셋에
     억지로 끼우지 않는다 — presetOf가 null이면 「직접 정함」이 사실이다. */
  const total = goalTotal(goals);
  const preset = presetOf(goals);
  const [showLanes, setShowLanes] = useState(false);
  // 어느 묶음을 보고 있나. null이면 고르는 목록.
  const [group, setGroup] = useState(null);
  const menus = settings.menus || DEFAULT_SETTINGS.menus;
  const enabledCount = Object.values(menus).filter(Boolean).length;

  const toggleMenu = (id) => {
    if (menus[id] && enabledCount <= 1) {
      onToast('메뉴를 최소 하나는 켜 두어야 해요');
      return;
    }
    onChange({ menus: { ...menus, [id]: !menus[id] } });
  };

  /* 서비스워커가 옛 화면을 붙잡고 있으면 고친 게 안 보인다.
   * 홈 화면에 추가한 iOS 앱은 사실상 안 닫혀서 갱신이 늦다.
   * 캐시만 비우고 다시 받는다 — 학습 기록은 localStorage에 있어서 그대로 남는다.
   *
   * ★ 우리 것만 지운다 ★
   *
   * 여태 getRegistrations()와 caches.keys()로 가져온 것을 전부 해제·삭제했다.
   * 같은 출처(scott910512-source.github.io)에 다른 앱도 올라가니, 이 버튼이
   * 남의 앱 캐시와 서비스워커까지 지울 수 있는 구조였다. 다른 앱에 실제로
   * 서비스워커가 있다는 뜻은 아니지만, 「최신 버전 받기」가 옆 앱을 망가뜨릴
   * 수 있게 두어야 할 이유는 없다.
   *
   * 서비스워커는 scope가 이 앱 밑인 것만, 캐시는 이름표(cacheId)가 붙은 것만
   * 골라 지운다. */
  const forceUpdate = async () => {
    onToast('최신 버전을 받는 중이에요');
    try {
      const here = new URL(__BASE_PATH__, window.location.origin).href;
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      await Promise.all(regs
        .filter((r) => (r.scope || '').startsWith(here))
        .map((r) => r.unregister()));
      const keys = await caches?.keys?.() ?? [];
      await Promise.all(keys
        /* workbox가 만든 이름에는 cacheId가 들어간다. 옛 배포에서 만든 캐시는
           이름표가 없을 수 있어서 경로로도 한 번 걸러 준다. */
        .filter((k) => k.includes(__CACHE_ID__) || k.includes(__BASE_PATH__))
        .map((k) => caches.delete(k)));
    } catch { /* 지우지 못해도 새로고침은 해 본다 */ }
    window.location.reload(true);
  };

  /* ★ 긴 한 화면을 짧은 목록으로 ★
   *
   * 계정 · 목적 · 문장 범위 · 학습 메뉴 · 학습 기능 · 영상 · 음성 · 데이터 ·
   * 도구 · 기타가 한 화면에 이어져 있었다. 음성 속도를 바꾸려면 열 덩이를
   * 지나쳐 내려가야 하고, 무엇이 어디 있는지는 외워야 알았다.
   *
   * 여섯 묶음으로 나눈다. 처음 화면은 고를 것 여섯 줄이고, 하나를 고르면
   * 그 묶음만 나온다. 안에 있는 설정은 그대로 두었다 — 자리만 옮긴다. */
  const open = MORE_GROUPS.find((x) => x.id === group);
  const G = (id) => group === id;

  return (
    <>
      {!group && (
        <>
          {/* 제목은 위 헤더(설정)가 그린다 — 여기서는 묶음 목록부터 */}
          <div className="card">
            {MORE_GROUPS.map((x) => (
              <button key={x.id} className="listrow moregroup" onClick={() => setGroup(x.id)}>
                <span className="mg-body">
                  <b>{x.label}</b>
                  <span>{x.sub}</span>
                </span>
                <IconChevron className="chev" />
              </button>
            ))}
          </div>
          {/* 저장 상태는 묶음 안에 숨기지 않는다 — 저장이 막혔으면 설정을
              열자마자 보여야 한다. */}
          {storeError && (
            <div className="savestate bad" style={{ marginTop: 12 }}>
              <b>기록을 저장하지 못했어요</b>
              <span>{storeError} 「기록 백업」에서 백업해 두고 저장 공간을 비워 주세요.</span>
            </div>
          )}
        </>
      )}

      {group && (
        <>
          <button className="ghost-btn moreback" onClick={() => setGroup(null)}>
            ← 설정
          </button>
          <div className="navtitle" style={{ marginTop: 10 }}>
            <small>설정</small>
            {open?.label}
          </div>
        </>
      )}

      {G('account') && (<>
      <div className="section-label">계정</div>
      <Account
        session={session}
        syncState={syncState}
        onSync={onSync}
        onSignedOut={onSignedOut}
        onVaultKey={onVaultKey}
        onToast={onToast}
      />

      {/* 학습 탭과 같은 묶음으로 보여 준다 — 거기선 셋으로 갈라 놓고 여기선
          한 줄로 늘어놓으면 어느 칸이 어디 것인지 다시 찾아야 한다. */}
      {/* ★ 하는 만큼만 말한다 ★
          온보딩은 「남은 기간에 맞춰 학습량과 우선순위를 잡아 드려요」라고
          적어 두고 아무것도 안 했다. 이제 정말로 배정 차례를 바꾸고,
          목적마다 무엇이 달라지는지 그 자리에 적는다. */}
      </>)}
      {G('study') && (<>
      <div className="section-label">학습 목적</div>
      <div className="card">
        <div className="setrow col">
          <div className="grouppick">
            {PURPOSES.map((p) => (
              <button
                key={p.id}
                className={purposeOf(settings) === p.id ? 'active' : ''}
                onClick={() => onChange({ purpose: p.id })}
              >{p.label}</button>
            ))}
          </div>
          <div className="set-note">
            {PURPOSES.find((p) => p.id === purposeOf(settings))?.does}
            {' '}목적을 바꿔도 회독 기록과 복습일은 그대로예요.
          </div>
        </div>
        <div className="setrow col">
          <div className="set-title">일본 출발일</div>
          <input
            className="ob-date"
            type="date"
            value={settings.tripDate || ''}
            onChange={(e) => onChange({ tripDate: e.target.value || null })}
            aria-label="여행 출발일"
          />
          <div className="set-note">
            {tripLabel(settings, todayKey())
              || '넣으면 홈에 남은 날을 세어 드려요. 학습량은 안 바뀌어요.'}
          </div>
        </div>
      </div>

      {/* 문장 레벨은 문장에 나오는 낱말의 급수로 잰다. 근거를 못 찾은 문장은
          미분류로 남는데, 그걸 새 학습에 넣을지는 고를 수 있어야 한다.
          모른다는 게 어렵다는 뜻은 아니라서 기본은 넣는 쪽이다. */}
      </>)}
      {G('study') && (<>
      <div className="section-label">문장 범위</div>
      <div className="card">
        <Toggle
          label="레벨을 못 잰 문장도 배정"
          sub="문장 레벨은 그 문장에 나오는 낱말의 급수로 재요. 낱말을 못 찾은 문장은 미분류로 남는데, 끄면 그런 문장은 새로 배정하지 않아요 — 이미 배운 문장은 계속 복습합니다."
          on={settings.sentenceScope !== 'level'}
          onClick={() => onChange({ sentenceScope: settings.sentenceScope === 'level' ? 'all' : 'level' })}
        />
      </div>

      </>)}
      {G('study') && (<>
      <div className="section-label">학습 메뉴</div>
      <div className="card">
        {MENU_GROUPS.map((g) => (
          <div key={g.id} className="setgroup">
            <div className="sg-label">{g.label}</div>
            {MENUS.filter((m) => m.group === g.id).map(({ id, label, sub }) => (
              <button key={id} className="toggle-row setrow" onClick={() => toggleMenu(id)} aria-pressed={Boolean(menus[id])}>
                <span>
                  <span className="set-title">{label}</span>
                  <span className="set-sub">{sub}</span>
                </span>
                <span className={`toggle${menus[id] ? ' on' : ''}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        ))}
        <div className="set-note">끈 메뉴의 학습 기록은 그대로 남아 있어요.</div>
      </div>

      </>)}
      {G('study') && (<>
      <div className="section-label">학습 기능</div>
      <div className="card">
        <Toggle label="자동 음성" sub="카드가 나오면 바로 읽어줘요"
          on={settings.autoTTS} onClick={() => onChange({ autoTTS: !settings.autoTTS })} />
        <Toggle label="판정할 때 읽어주기" sub="몰라요·애매해요·알아요를 고르면 그 단어를 한 번 더 읽어줘요"
          on={settings.speakOnJudge} onClick={() => onChange({ speakOnJudge: !settings.speakOnJudge })} />
        <Toggle label="히라가나 항상 보기" sub="앞면에 읽는 법을 함께 표시해요"
          on={settings.showKana} onClick={() => onChange({ showKana: !settings.showKana })} />
        <Toggle label="한글 발음 표기" sub="가나를 한글로 옮겨 적어요 (근사값)"
          on={settings.hangulPron} onClick={() => onChange({ hangulPron: !settings.hangulPron })} />
        <Toggle label="자동 마이크" sub="뜻을 열면 바로 듣기 시작해요 (처음 한 번은 직접 눌러 권한을 주세요)"
          on={settings.autoMic} onClick={() => onChange({ autoMic: !settings.autoMic })} />
        {/* ★ 답을 보기 전에 판정할 수 있게 할까 ★
            기본은 끈다 — 답을 보기 전에 누르면 「떠올렸나」가 아니라 「떠올린 것
            같나」를 적게 되고, 그 기록이 복습 간격을 정한다. 대신 없애지는 않는다.
            아는 것만 많은 회독에서는 카드마다 한 번 더 두드리는 게 전부 마찰이다. */}
        <Toggle label="빠른 판정" sub="답을 보기 전에도 바로 판정해요. 아는 게 많아 넘기기만 할 때 씁니다 — 끄면 답을 보고 고르게 돼요"
          on={settings.quickJudge} onClick={() => onChange({ quickJudge: !settings.quickJudge })} />
        <Toggle label="예문 보기" sub="뜻과 함께 예문을 보여줘요"
          on={settings.showExample} onClick={() => onChange({ showExample: !settings.showExample })} />
        <Toggle label="카드 섞기" sub="순서를 외워버리는 걸 막아요"
          on={settings.shuffle} onClick={() => onChange({ shuffle: !settings.shuffle })} />

        <div className="setrow col">
          <div className="set-title">여행지</div>
          <div className="set-sub">
            적어 두면 번역기가 그 지역에서 실제로 쓰는 말(사투리)도 같이 알려 줘요.
          </div>
          <input
            type="text"
            value={settings.tripPlace || ''}
            placeholder="예: 오사카 · 후쿠오카"
            onChange={(e) => onChange({ tripPlace: e.target.value })}
          />
        </div>

        {/* ★ 고르는 자리는 총량 하나 ★
         *
         * 갈래마다 따로 세는 것은 이유가 있다 — 복습이 밀린 날 새로 배우는 몫을
         * 뺏기면 진도가 밀린 벌로 새 단어를 못 보게 된다. 그 판단은 그대로 둔다.
         *
         * 문제는 처음 쓰는 사람이 보는 숫자였다. 기본값이 셋 다 20이라 자료가
         * 쌓이면 하루가 예순 장이 되는데, 「20」 셋을 본 사람은 스무 장을 고른
         * 줄로 안다. 총량으로 고르고, 갈래 배분은 아래 고급에서 만진다. */}
        <div className="setrow col">
          <div className="set-title">
            오늘 학습량
            <span className="set-val">하루 최대 {total}장</span>
          </div>
          <div className="set-sub">
            고른 양을 복습 · 새로 배우기 · 약점으로 나눠 배정해요. 있는 만큼만
            담기니 실제로는 이보다 적을 수 있어요.
          </div>
          <div className="grouppick">
            {DAY_PRESETS.map((p) => (
              <button key={p.id} className={preset === p.id ? 'active' : ''}
                onClick={() => onChange({ goals: spreadGoal(p.total) })}>
                {p.label} {p.total}
              </button>
            ))}
            {/* 기존에 직접 맞춰 둔 목표를 프리셋에 억지로 끼우지 않는다.
                고른 적 없는 사람에게 「직접 정함」이 켜져 있으면 그게 사실이다. */}
            {!preset && <button className="active" disabled>직접 정함 {total}</button>}
          </div>
          <div className="set-sub" style={{ marginTop: 8 }}>
            복습 {goals.review} · 새로 배우기 {goals.fresh} · 약점 {goals.weak}
            {goals.review > goals.fresh && ' — 복습에 더 많이 배정했어요'}
          </div>

          {/* 갈래를 직접 만지는 자리는 접어 둔다. 처음부터 셋을 들이밀면
              무엇을 고르는 건지 모른 채로 숫자를 만지게 된다. */}
          <button className="ghost-btn" style={{ marginTop: 10 }}
            onClick={() => setShowLanes((v) => !v)} aria-expanded={showLanes}>
            {showLanes ? '갈래별 설정 접기' : '갈래별로 직접 정하기'}
          </button>
          {showLanes && (
            <>
              <div className="set-sub" style={{ marginTop: 8 }}>
                갈래마다 따로 셉니다. 복습이 밀려도 새 단어 몫은 그대로예요.
              </div>
              <div className="goalrow">
                {LANE_GOALS.map(({ key, label, note }) => (
                  <div key={key} className="goalone">
                    <div className="set-title">
                      {label}
                      <span className="set-val">{goals[key]}장</span>
                    </div>
                    <div className="set-sub">{note}</div>
                    <div className="grouppick">
                      {GOAL_CHOICES.map((g) => (
                        <button key={g} className={goals[key] === g ? 'active' : ''}
                          onClick={() => onChange({ goals: { ...goals, [key]: g } })}>{g}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="setrow col">
          <div className="set-title">회독 방향</div>
          <div className="grouppick">
            {DIRECTIONS.map((d) => (
              <button key={d.id} className={settings.direction === d.id ? 'active' : ''}
                onClick={() => onChange({ direction: d.id })}>{d.label}</button>
            ))}
          </div>
        </div>

        <div className="setrow col">
          <div className="set-title">음성 속도 <span className="set-val">{settings.speechRate.toFixed(2)}x</span></div>
          <input type="range" min="0.6" max="1.2" step="0.05" value={settings.speechRate}
            onChange={(e) => onChange({ speechRate: Number(e.target.value) })} />
        </div>
      </div>

      </>)}
      {G('tools') && (<>
      <div className="section-label">영상 학습</div>
      <VideoAI settings={settings} onChange={onChange} onToast={onToast} />

      </>)}
      {G('voice') && (
        <VoiceSettings
          settings={settings} onChange={onChange} onToast={onToast}
          session={session} remoteKeyEnvelope={remoteKeyEnvelope} vaultReady={vaultReady}
        />
      )}
      {G('backup') && (
        <BackupSettings
          settings={settings} onChange={onChange} onToast={onToast} onReload={onReload}
          session={session} syncState={syncState} storeError={storeError}
        />
      )}
      {G('tools') && (<>
      <div className="section-label">도구</div>
      <div className="card">
        <button className="listrow tool-translate" onClick={onOpenTranslate}>
          <IconMap /> 번역기
          <span className="lr-sub">한국어로 적으면 지금 말할 일본어로 — 발음까지</span>
        </button>
        <button className="listrow" onClick={onOpenWordManager}>
          <IconList /> 내 단어장 관리
          <span className="lr-sub">직접 담은 단어를 고치고 지워요</span>
        </button>
        {/* 완전 곁가지 — 일본어 회독과 무관하고 기록에 안 붙는다.
            도구 묶음 맨 아래에 두어 본업을 가리지 않게 한다. */}
        <button className="listrow tool-swiss" onClick={onOpenSwiss}>
          <IconMap /> 독일어 여행 회화
          <span className="lr-sub">표준 독일어 레슨 · 퀴즈 · 자동재생 · 🇨🇭 스위스 팁 — 학습 탭에도 있어요</span>
        </button>
      </div>

      </>)}
      {G('about') && (<>
      <div className="section-label">기타</div>
      <div className="card">
        <button className="listrow" onClick={onReplayOnboarding}>
          <IconRewind /> 처음 질문 다시 하기
        </button>
        <button className="listrow" onClick={forceUpdate}>
          <IconDownload /> 최신 버전 받기
        </button>
        <div className="set-note">
          JS일본어 · 회독 학습 · 빌드 {__BUILD_STAMP__}
          <br />
          고친 게 안 보이면 위 버튼을 누르세요. 빌드 시각이 바뀌면 새 버전입니다.
          학습 기록은 지워지지 않아요.
        </div>
      </div>
      </>)}
    </>
  );
}

