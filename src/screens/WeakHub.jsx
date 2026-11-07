import { IconFlame } from '../components/Icons.jsx';
import HunterTutor from '../components/HunterTutor.jsx';

/* 약점 — 약한 것을 보는 곳은 여기 하나다.
 *
 * 복습&내기록의 「약점」 줄, 복습 화면의 「약점」 줄, 오늘 퀘스트의 약점 퀴즈가 모두 이 화면으로 온다.
 * 맨 위에 개수, 그 아래 할 수 있는 것 셋(퀴즈 · 외우기 · 문법), 그 아래에 왜 약한지(약점 장부).
 *
 * ★ 숫자와 큐는 같은 것을 본다 ★ 「약점 퀴즈 5문제」는 아래 장부의 맨 위 낱말들로 만든다.
 * 세는 자리는 lib/weak.js, 오늘 몫은 lib/weakquiz.js 한 군데씩이다. */
export default function WeakHub({
  weakWords, weakGrammar, weakBook = null, weakRows = [], quiz, onStartQuiz, onStartDeck, onOpenGrammar,
}) {
  const total = weakWords + weakGrammar;
  return (
    <>
      <HunterTutor guide="killua" scene="arena" mood="encourage" title="약점부터 하나씩" line={total ? '자주 틀리거나 금방 잊는 것부터 모았어. 가장 약한 것부터 다른 문제로 다시 확인해 보자.' : '지금은 약한 곳이 안 보여. 이대로 꾸준히 가자.'} compact />
      <div className="card wk-sum" data-words={weakWords} data-grammar={weakGrammar}>
        <div className="wk-head"><span>지금 약한 것</span><b>{total}<small>개</small></b></div>
        <div className="set-note">취약 단어 {weakWords}개 · 취약 문법 {weakGrammar}개</div>
      </div>

      <div className="card wk-acts">
        <button className="submit-btn wk-quiz" onClick={onStartQuiz} disabled={quiz.ids.length === 0}>
          <IconFlame /> 다른 문제로 확인 · 약점 퀴즈 {quiz.ids.length > 0 ? `${quiz.ids.length}문제` : ''}
        </button>
        <div className="set-note wk-quizsub">
          {quiz.total === 0
            ? '풀 낱말이 아직 없어요. 약한 낱말이 생기면 여기서 퀴즈로 풀어요'
            : quiz.complete ? `오늘 약점 퀴즈를 마쳤어요 · ${quiz.done} / ${quiz.total}` : `오늘 퀘스트 ${quiz.done} / ${quiz.total}`}
        </div>
        <button className="ghost-btn wk-deck" onClick={onStartDeck} disabled={weakWords === 0}>
          {weakWords > 0 ? `약한 것부터 단어 ${weakWords}개 다시 외우기` : '외울 약한 단어가 없어요'}
        </button>
        <button className="ghost-btn wk-grammar" onClick={onOpenGrammar} disabled={weakGrammar === 0}>
          {weakGrammar > 0 ? `취약 문법 ${weakGrammar}개 공부하기` : '취약 문법이 없어요'}
        </button>
      </div>

      {/* ★ 약점 장부 ★
          「약점 12개」만 보여 주면 무엇을 할지가 안 정해진다. 시험에서 틀리는 낱말과 쉰 번 들었는데
          안 붙는 낱말은 다음에 할 일이 다르다. 그리고 「금방 잊는지」는 횟수로는 안 나온다 — 어제 외운 게
          오늘 무너진 낱말이 제일 위험한데, 틀린 횟수는 한 번일 수 있다. */}
      {weakRows.length > 0 && (
        <>
          <div className="section-label">약점 장부</div>
          <div className="card wb-card">
            <div className="wb-sum">
              {[
                weakBook?.quizWrong ? `시험 오답 ${weakBook.quizWrong}번` : null,
                weakBook?.forgot ? `외웠다가 다시 틀림 ${weakBook.forgot}번` : null,
                weakBook?.fast ? `금방 잊는 낱말 ${weakBook.fast}개` : null,
                weakBook?.stuck ? `듣다 안 뗀 낱말 ${weakBook.stuck}개` : null,
              ].filter(Boolean).join(' · ') || '회독에서 틀린 것만 모여 있어요'}
            </div>
            <div className="wb-list">
              {weakRows.map((w) => (
                <div key={w.id} className="wb-row" data-weak={w.id}>
                  <span className="wb-w">
                    <b>{w.kanji}</b>
                    <small>{w.kana}{w.mean ? ` · ${w.mean}` : ''}</small>
                  </span>
                  <span className="wb-why">
                    {w.speed && <i className="wb-fast">{w.speed}</i>}
                    {/* 까닭 하나는 한 덩어리다 — 「애매해요 1 / 번」처럼 숫자와 단위 사이에서 줄이 꺾이면 읽다가 멈춘다 */}
                    <span>
                      {w.reasons.map((r, i) => (
                        <span key={r} className="wb-reason">{i > 0 && ' · '}{r}</span>
                      ))}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="set-note wb-note">
              시험·듣기는 복습 간격을 안 바꿔요. 맞고 틀린 것만 여기 쌓여서, 오늘 학습의 약점 갈래와 「약점」 범위가 이 순서를 봐요.
            </p>
          </div>
        </>
      )}
    </>
  );
}
