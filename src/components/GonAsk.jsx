import { useState } from 'react';
import AskSheet from './AskSheet.jsx';
import gonFace from '../assets/hunter/characters/gon-thumb.png';

/* ★ 어느 화면에서든 곤에게 물어보기 ★
 *
 * 우측 하단에 작은 곤 얼굴과 「AI」 표시. 누르면 질문 창이 열린다. 카드를 보고 있지 않아도 되는, 그냥 일본어 공부하다 궁금한
 * 것을 묻는 자리다(카드 화면의 「궁금해요」와 같은 창·같은 기록을 쓴다).
 * AI가 답한다는 것을 단추에도 적어 둔다 — 사람이 답하는 줄 알면 틀린 것도 믿는다. */
export default function GonAsk({ settings, asks, onAsks, onAddWord, onToast, hidden = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!hidden && (
        <button type="button" className="gonfab" onClick={() => setOpen(true)} aria-label="곤에게 물어보기 (AI)">
          <img src={gonFace} alt="" width="40" height="40" />
          <span className="gonfab-ai" aria-hidden="true">AI</span>
        </button>
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
