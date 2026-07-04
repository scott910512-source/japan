import { IconFlame, IconBook, IconChat, IconGrid } from '../components/Icons.jsx';
import { PATTERNS } from '../data/sentences.js';
import { GRAMMAR_MODULES } from '../data/grammar.js';

function todayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

export default function Home({ words, progress, streak, onNavigate }) {
  const knownCount = progress.known.length;
  const unknownCount = progress.unknown.length;
  const totalWords = words.length;

  const sentenceDoneCount = PATTERNS.filter((p) => progress.sentenceDone[p.id]).length;

  const grammarForms = GRAMMAR_MODULES.reduce((sum, m) => sum + m.forms.length, 0);
  const grammarDoneCount = Math.min(
    grammarForms,
    Object.values(progress.grammarDone).reduce((a, b) => a + b, 0)
  );

  return (
    <>
      <div className="navtitle"><small>{todayLabel()}</small>안녕하세요, 학습자님</div>

      <div className="streak">
        <IconFlame />
        <div>
          <div className="num">{streak.count}일 연속</div>
          <div className="cap">오늘 학습을 마치면 {streak.count + 1}일이 돼요</div>
        </div>
      </div>

      <div className="section-label">이어서 학습하기</div>
      <div className="card stack" style={{ gap: 0 }}>
        <button className="resume-item" onClick={() => onNavigate('vocab')}>
          <div className="resume-badge"><IconBook /></div>
          <div>
            <div className="resume-title">단어 복습</div>
            <div className="resume-sub">
              {unknownCount > 0 ? `모르는 단어 ${unknownCount}개 남음` : '모르는 단어가 없어요'}
            </div>
          </div>
        </button>
        <button className="resume-item" onClick={() => onNavigate('sentence')}>
          <div className="resume-badge"><IconChat /></div>
          <div>
            <div className="resume-title">문장 패턴</div>
            <div className="resume-sub">{sentenceDoneCount}/{PATTERNS.length} 완료</div>
          </div>
        </button>
        <button className="resume-item" onClick={() => onNavigate('grammar')}>
          <div className="resume-badge"><IconGrid /></div>
          <div>
            <div className="resume-title">문법 학습</div>
            <div className="resume-sub">{grammarDoneCount}/{grammarForms} 항목 학습</div>
          </div>
        </button>
      </div>

      <div className="section-label">전체 진도</div>
      <div className="progress-grid">
        <div className="progress-cell">
          <div className="ring" style={{ '--p': totalWords ? Math.round((knownCount / totalWords) * 100) : 0 }} />
          <div className="val">{knownCount}/{totalWords}</div>
          <div className="lab">단어 암기</div>
        </div>
        <div className="progress-cell">
          <div className="ring" style={{ '--p': Math.round((sentenceDoneCount / PATTERNS.length) * 100) }} />
          <div className="val">{sentenceDoneCount}/{PATTERNS.length}</div>
          <div className="lab">문장 패턴</div>
        </div>
        <div className="progress-cell">
          <div className="ring" style={{ '--p': Math.round((grammarDoneCount / grammarForms) * 100) }} />
          <div className="val">{grammarDoneCount}/{grammarForms}</div>
          <div className="lab">문법 항목</div>
        </div>
      </div>
    </>
  );
}
