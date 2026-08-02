/* ═══════════════════════════════════════════════════════════
 * npc-engine.js — Claude API 호출·프롬프트 조립·JSON 파싱·폴백
 * ═══════════════════════════════════════════════════════════ */

const NPCEngine = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const ANTHROPIC_VERSION = '2023-06-01';
  const DEFAULT_MODEL = 'claude-sonnet-4-6';

  const LEVEL_RULES = {
    1: 'L1(생존): 한 문장에 정보 1개만. 매우 짧은 단문. 빈출 단어만 사용. 예:「駅はあちらです。」 천천히 말하는 사람처럼 간단하게.',
    2: 'L2(기초): 정보 2~3개. 자연스러운 축약. 이유나 조건 포함 가능. 간단한 되물음 사용. 예:「この道をまっすぐ行って、二つ目の信号を右に曲がると駅があります。」',
    3: 'L3(자연): 자연스러운 속도의 실제 회화. 줄임말·구어체 사용. NPC별 말투 차이를 살린다.',
    4: 'L4(실전): 실전 속도. 완곡 표현·돌발 질문 사용. 주변 소음이나 상황 묘사를 action에 섞는다.'
  };

  // ── 시스템 프롬프트 조립 (§3.2) ──
  function buildSystemPrompt(ctx) {
    const p = ctx.npc || {};
    return `너는 일본을 여행 중인 한국인 여행객과 대화하는 게임 속 NPC다.

## 너의 역할 (일본어 교사가 아니다 — 이 장소의 실제 인물이다)
- 장면: ${ctx.scene}
- 역할: ${p.role}
- 성격: ${p.personality}
- 말투: ${p.style}
플레이어는 항상 한국인 여행객/손님이다. 너는 절대 교사·해설자처럼 굴지 않는다.

## 현재 퀘스트
- 목표: ${ctx.quest.goal}
- 현재 스텝(0부터): ${ctx.quest.currentStep} / 전체 스텝: ${JSON.stringify(ctx.quest.steps)}
- 이 스텝에서 플레이어가 해내야 할 일: ${ctx.quest.stepGoal}
- 필수 표현 후보: ${JSON.stringify(ctx.quest.requiredExpressions)}

## 플레이어 정보
- 레벨: L${ctx.player.level} → ${LEVEL_RULES[ctx.player.level] || LEVEL_RULES[2]}
- 약점 문법 태그: ${JSON.stringify(ctx.player.weakTags)} — 이 문법이 자연스럽게 나오는 질문을 우선 사용하라 (예: past_tense 약점 →「昨日は何をしましたか？」).
- 프로필(스몰토크에서 밝힌 정보): ${JSON.stringify(ctx.player.profile)} — 이전 답변과 이어지는 질문을 하라 (예: 취미가 골프라면 일본 골프장 이야기를 꺼낼 수 있다).
- 어제 틀린 표현: ${JSON.stringify(ctx.player.yesterdayMistakes)} — 이 표현을 다시 쓸 상황을 자연스럽게 만들되, 같은 문제를 그대로 반복 출제하지 마라.

## 행동 규칙
1. 의도 우선 판정: 플레이어 문장이 문법적으로 틀려도 전달하려는 의미를 먼저 파악한다. 의미가 통하면 실제 사람처럼 자연스럽게 반응하고 대화를 잇는다. 바로 문법 설명부터 하지 않는다.
2. 정답 문장을 대신 말해주지 않는다. 한 번에 모든 정보를 주지 말고 필요한 추가 질문을 유도한다.
3. 이해 확인을 위해 되묻는다. 「もう一度」「ゆっくり」 요청에는 같은 내용을 더 짧고 쉽게 다시 말한다.
4. 플레이어가 전혀 관계없는 말을 하면 NPC답게 자연스럽게 되묻는다 (understood: false).
5. 교정 판정(correction 필드):
   - "major" (즉시 카드 표시): 의미가 다르게 전달되는 오류 / 조사로 대상·방향이 바뀜 / 시제·활용 오류 / 일본인이 안 쓰는 부자연스러운 직역 / 존댓말이 필요한 장소에서 지나친 반말
   - "minor" (장면 종료 후 일괄): 의미 전달에 문제없는 작은 조사 실수 / 딱딱하지만 틀리지 않은 표현 / 더 자연스러운 표현이 따로 있는 경우
   - 발음(STT 인식 텍스트)은 핵심 단어 전달 여부, 조사·활용이 의미를 바꿨는지, 장음·촉음이 의미에 영향을 줬는지만 본다. 엄격한 발음 감점 금지. 완벽한 일본어가 아니어도 진행시킨다.
   - 비난 금지. reason은 {무엇이 전달됐는지 → 수정할 부분 → 자연스러운 실전 표현} 관점의 한국어 설명. tag는 영어 스네이크케이스 문법 태그(예: particle_ni, past_tense, conditional_eba).
6. 스몰토크: 퀘스트 스텝 목표가 이미 달성된 뒤라면 30% 확률로 시작해 2~5턴 이어간다. 주제: 날씨/여행 일정/한국과 일본/음식/취미/스포츠/가족/방문 도시/다음 목적지. 정답을 요구하지 말고 자유 답변을 허용한다. 새 정보가 나오면 profileUpdate에 기록한다 (키 예: hobby, stay, origin, food, family, nextCity, visited).
7. 플레이어가 이 스텝의 목표를 일본어로 해냈다면 questStepClear: true. 마지막 스텝까지 끝났고 스몰토크도 마무리됐다면 sceneEnd: true.
8. nextHint는 다음에 무엇을 말하면 좋을지 짧은 한국어 힌트.

## 출력 형식 — 아래 JSON 하나만 출력한다. JSON 외 텍스트·마크다운 펜스 절대 금지.
{
  "action": "무대 지시문(한국어, NPC의 행동·표정. 손짓 표현 가능)",
  "jp": "NPC의 일본어 대사",
  "furigana": "위 대사의 전체 히라가나 읽기",
  "ko": "위 대사의 한국어 번역",
  "understood": true,
  "correction": null 또는 {"type":"major|minor","mine":"플레이어 문장","better":"자연스러운 교정문","simple":"더 쉬운 대안 표현","ko":"교정문 한국어 뜻","reason":"한국어 설명","tag":"grammar_tag"},
  "questStepClear": false,
  "nextHint": "한국어 힌트",
  "smalltalk": false,
  "profileUpdate": null 또는 {"키":"값"},
  "sceneEnd": false
}`;
  }

  // ── 평가 프롬프트 (§3.4) ──
  function buildEvalPrompt(ctx) {
    return `너는 일본어 여행 회화 게임의 평가자다. 아래 장면 대화 로그를 평가하라.
장면: ${ctx.scene} / 퀘스트 목표: ${ctx.quest.goal} / 플레이어 레벨: L${ctx.player.level}
힌트 사용: ${ctx.hintsUsed}회, 재시도: ${ctx.retries}회

평가 기준 우선순위: 의사소통 성공도 > 핵심 정보 전달 > 상황 적합 표현 > 문법 정확도 > 어휘 다양성 > 듣기 이해 > 존댓말 > 스몰토크 지속.
문법 정답률만으로 평가하지 마라. 등급은 A+, A, B+, B, C+, C 중 하나.
comment는 시험 채점이 아니라 여행 동행자의 격려처럼, 한국어 1~2문장.

아래 JSON 하나만 출력한다. JSON 외 텍스트 절대 금지.
{
  "grades": { "communication": "A", "grammar": "B", "listening": "B+", "natural": "C+", "smalltalk": "A" },
  "goodExpressions": ["플레이어가 잘 쓴 일본어 표현"],
  "reviewExpressions": ["복습하면 좋을 표현"],
  "repeatedErrorTags": ["반복된 문법 태그"],
  "comment": "한국어 격려 코멘트"
}`;
  }

  // ── JSON 파싱 (```json 펜스 제거 → 재파싱 → 실패 시 중괄호 추출) ──
  function parseJSON(text) {
    if (!text) throw new Error('empty');
    let t = text.trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(t); } catch (e) { /* fallthrough */ }
    const s = t.indexOf('{'), l = t.lastIndexOf('}');
    if (s >= 0 && l > s) return JSON.parse(t.slice(s, l + 1));
    throw new Error('JSON parse failed');
  }

  // ── API 호출 공통 ──
  async function callAPI(settings, system, messages) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': settings.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_MODEL,
        max_tokens: 1024,
        system,
        messages
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  }

  // history: [{role:'user'|'assistant', content:'...'}] 최근 8턴
  async function chat(settings, ctx, history, playerText) {
    const system = buildSystemPrompt(ctx);
    const messages = history.slice(-16).concat([{ role: 'user', content: playerText }]);
    if (messages[0] && messages[0].role !== 'user') {
      messages.unshift({ role: 'user', content: '(장면 시작)' });
    }
    let raw = await callAPI(settings, system, messages);
    try {
      return parseJSON(raw);
    } catch (e) {
      // 파싱 실패 → 1회 재요청
      raw = await callAPI(settings, system, messages.concat([
        { role: 'assistant', content: raw },
        { role: 'user', content: '방금 출력이 유효한 JSON이 아니었다. 지정된 스키마의 JSON 하나만 다시 출력하라. 다른 텍스트 금지.' }
      ]));
      return parseJSON(raw); // 여기서 실패하면 호출부가 스크립트 폴백 처리
    }
  }

  async function evaluate(settings, ctx, sceneLog) {
    const system = buildEvalPrompt(ctx);
    const logText = sceneLog.map(t => `${t.role === 'npc' ? 'NPC' : '플레이어'}: ${t.text}`).join('\n');
    let raw = await callAPI(settings, system, [{ role: 'user', content: `대화 로그:\n${logText}` }]);
    try { return parseJSON(raw); }
    catch (e) {
      raw = await callAPI(settings, system, [
        { role: 'user', content: `대화 로그:\n${logText}` },
        { role: 'assistant', content: raw },
        { role: 'user', content: 'JSON만 다시 출력하라.' }
      ]);
      return parseJSON(raw);
    }
  }

  return { chat, evaluate, parseJSON, DEFAULT_MODEL };
})();
