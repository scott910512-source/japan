import { useState } from 'react';
import AskSheet from './AskSheet.jsx';
import gonFace from '../assets/hunter/characters/gon-thumb.png';

/* ★ 어느 화면에서든 곤에게 물어보기 ★
 *
 * 우측 하단에 작은 곤 얼굴과 「AI」 표시. 누르면 질문 창이 열린다. 카드를 보고 있지 않아도 되는, 그냥 일본어 공부하다 궁금한
 * 것을 묻는 자리다(카드 화면의 「궁금해요」와 같은 창·같은 기록을 쓴다).
 * AI가 답한다는 것을 단추에도 적어 둔다 — 사람이 답하는 줄 알면 틀린 것도 믿는다. */
const MINI_KEY = 'jp_gonfab_mini';
const loadMini = () => { try { return localStorage.getItem(MINI_KEY) === '1'; } catch { return false; } };

export default function GonAsk({ settings, asks, onAsks, onAddWord, onToast, hidden = false }) {
  const [open, setOpen] = useState(false);
  /* ★ 작게 접고 펼칠 수 있다 ★ 단추가 아래쪽 버튼(다음 문제 등)을 가릴 때 접어 두면 작은 얼굴만 남는다.
     접은 상태는 기억한다. 접힌 얼굴을 누르면 질문 창이 아니라 다시 펼쳐진다. */
  const [mini, setMini] = useState(loadMini);
  const setMiniSaved = (v) => { setMini(v); try { localStorage.setItem(MINI_KEY, v ? '1' : '0'); } catch { /* 저장 못 해도 이번 접속은 된다 */ } };
  return (
    <>
      {!hidden && (
        <div className={`gonfab-wrap${mini ? ' mini' : ''}`}>
          {mini ? (
            <button type="button" className="gonfab mini" onClick={() => setMiniSaved(false)} aria-label="곤 단추 펼치기 (AI)">
              <img src={gonFace} alt="" width="26" height="26" />
            </button>
          ) : (
            <>
              <button type="button" className="gonfab" onClick={() => setOpen(true)} aria-label="곤에게 물어보기 (AI)">
                <img src={gonFace} alt="" width="40" height="40" />
                <span className="gonfab-ai" aria-hidden="true">AI</span>
              </button>
              <button type="button" className="gonfab-fold" onClick={() => setMiniSaved(true)} aria-label="곤 단추 작게 접기">−</button>
            </>
          )}
        </div>
      )}
      <AskSheet
        open={open}
        card={null}
        guide="gon"
        title="곤에게 물어보기"
        settings={settings}
        history={asks}
        onHistory={onAsks}
        onAddWord={onAddWord}
        onClose={() => setOpen(false)}
        onToast={onToast}
      />
    </>
  );
}
