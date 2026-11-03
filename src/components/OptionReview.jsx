import { useCallback, useState } from 'react';
import JpSpeak from '../screens/n3/JpSpeak.jsx';
import { speakText } from '../lib/optionInfo.js';

const KEY = 'jp_optrev_open';
const loadOpen = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };

/* 열림 여부. 화면이 「열려 있으면 맞혀도 자동으로 안 넘긴다」를 알아야 해서 부모가 쥔다. */
export function useReviewOpen() {
  const [open, setOpen] = useState(loadOpen);
  const set = useCallback((v) => {
    setOpen(v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* 저장 못 해도 괜찮다 */ }
  }, []);
  return [open, set];
}

/* 답을 낸 뒤, 보기마다 일본어 · 읽기 · 뜻 · 🔊를 한 줄씩 보여 주는 접이식 칸.
 * 열고 닫은 것은 기억해 둔다 — 답만 보고 넘기는 사람에게는 접어 둔 채로 둘 수 있게. */
export default function OptionReview({ rows, open, onOpenChange, rate = 0.9, idPrefix = 'opt' }) {
  if (!rows || rows.length < 2) return null;
  const onToggle = (e) => { if (e.currentTarget.open !== open) onOpenChange?.(e.currentTarget.open); };
  return (
    <details className="optrev" open={open} onToggle={onToggle}>
      <summary>보기 읽기 · 뜻 · 듣기 <small>{open ? '펼쳐 두면 맞혀도 직접 넘겨요' : '접어 두면 맞히면 바로 넘어가요'}</small></summary>
      <ul className="optrev-list">
        {rows.map((r, i) => (
          <li key={`${r.jp}-${r.ko}-${i}`} className={`optrev-row${r.tone ? ` ${r.tone}` : ''}`}>
            <span className="optrev-num">{r.n || i + 1}</span>
            <span className="optrev-body">
              {r.jp && <b lang="ja">{r.jp}</b>}
              {r.kana && <i lang="ja">{r.kana}</i>}
              {r.ko && <span className="optrev-ko">{r.ko}</span>}
            </span>
            {speakText(r) && <JpSpeak text={speakText(r)} rate={rate} id={`${idPrefix}:${i}:${speakText(r)}`} className="optrev-spk" label="듣기" />}
          </li>
        ))}
      </ul>
    </details>
  );
}
