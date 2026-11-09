import { useState } from 'react';
import { IconPencil } from './Icons.jsx';
import MemoBox from './MemoBox.jsx';
import { useMemos } from '../lib/memoContext.js';

/* 외우는 법 메모 — 퀴즈 · 시험 어디서든 그 단어의 메모를 쓰고 본다.
 *
 * ★ 기본은 숨김이다 ★ 메모에 정답이 적혀 있을 수 있어서, 문제를 푸는 동안은 눌러야만 열린다.
 * 닫힌 채로는 「메모」 글자와 (있으면) 점 하나만 보인다. 열면 쓰던 메모 상자(MemoBox)가 그대로 나온다.
 * 같은 단어의 메모는 회독 카드의 메모와 같은 것이다. */
export default function WordMemo({ id, className = '' }) {
  const { memos, saveMemo } = useMemos();
  const [open, setOpen] = useState(false);
  if (!id) return null;
  const memo = memos?.[id];
  return (
    <div className={`wordmemo ${className}`} data-open={open ? '1' : '0'} data-has={memo?.text ? '1' : '0'}>
      <button type="button" className="sc-peek wordmemo-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <IconPencil /> 외우는 법 메모{memo?.text ? <i className="wordmemo-dot" aria-label="메모 있음" /> : null}
      </button>
      {open && (
        <MemoBox
          memo={memo}
          placeholder="이 단어를 외우는 나만의 방법 (예: 木曜日 = 나무 목요일)"
          onSave={(text) => saveMemo(id, text)}
          onDelete={() => saveMemo(id, '')}
        />
      )}
    </div>
  );
}
