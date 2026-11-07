import { useEffect, useState } from 'react';
import AskSheet from './AskSheet.jsx';
import gonFace from '../assets/hunter/characters/gon-thumb.png';

/* ★ 어느 화면에서든 곤에게 물어보기 ★
 *
 * 우측 하단에 작은 곤 얼굴과 「AI」 표시. 누르면 질문 창이 열린다. 카드를 보고 있지 않아도 되는, 그냥 일본어 공부하다 궁금한
 * 것을 묻는 자리다(카드 화면의 「궁금해요」와 같은 창·같은 기록을 쓴다).
 * AI가 답한다는 것을 단추에도 적어 둔다 — 사람이 답하는 줄 알면 틀린 것도 믿는다. */
const MINI_KEY = 'jp_gonfab_mini';
const loadMini = () => { try { return localStorage.getItem(MINI_KEY) === '1'; } catch { return false; } };

export default function GonAsk({ settings, asks, onAsks, onAddWord, onToast, hidden = false, open: openProp, onOpenChange, placement = 'bottom' }) {
  /* 밖에서 열고 닫을 수 있다(상단 바의 곤 얼굴이 이 창을 연다). 안 넘기면 단추가 스스로 연다. */
  const [openInner, setOpenInner] = useState(false);
  const controlled = typeof onOpenChange === 'function';
  const open = controlled ? Boolean(openProp) : openInner;
  const setOpen = controlled ? onOpenChange : setOpenInner;
  /* 질문 창은 열려 있을 때만 DOM에 둔다. 닫아 둔 창까지 늘 붙어 있으면 학습 화면의 카드 「궁금해요」 창과 같은 모양이 둘이 되어
     「어느 창」인지 가릴 수 없다(검사도 사람도). 닫을 때는 미끄러져 내려갈 시간을 준 뒤에 뗀다. */
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const f = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(f);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 500);
    return () => clearTimeout(t);
  }, [open]);
  /* ★ 작게 접고 펼칠 수 있다 ★ 단추가 아래쪽 버튼(다음 문제 등)을 가릴 때 접어 두면 작은 얼굴만 남는다.
     접은 상태는 기억한다. 접힌 얼굴을 누르면 질문 창이 아니라 다시 펼쳐진다. */
  const [mini, setMini] = useState(loadMini);
  const setMiniSaved = (v) => { setMini(v); try { localStorage.setItem(MINI_KEY, v ? '1' : '0'); } catch { /* 저장 못 해도 이번 접속은 된다 */ } };
  return (
    <>
      {!hidden && (
        <div className={`gonfab-wrap${mini ? ' mini' : ''}${placement === 'top' ? ' top' : ''}`}>
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
      {mounted && (
      <AskSheet
        open={shown}
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
      )}
    </>
  );
}
