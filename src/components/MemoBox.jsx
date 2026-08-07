import { useEffect, useRef, useState } from 'react';
import { IconPencil, IconTrash } from './Icons.jsx';

/* 단어 암기 메모.
 * "스베루 → 미끄러졌다" 같은 자기만의 연상법을 붙여 둔다.
 * 남이 만든 설명보다 자기가 붙인 게 잘 붙는다. */
export default function MemoBox({ memo, placeholder, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo?.text || '');
  const ref = useRef(null);

  // 카드가 바뀌면 편집을 닫고 그 카드의 메모로 되돌린다
  useEffect(() => {
    setEditing(false);
    setDraft(memo?.text || '');
  }, [memo?.text]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="memo editing">
        <textarea
          ref={ref}
          className="memo-input"
          rows={3}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="btnrow">
          <button
            className="ghost-btn"
            onClick={() => { onSave(draft.trim()); setEditing(false); }}
          >
            저장
          </button>
          <button className="ghost-btn" onClick={() => { setDraft(memo?.text || ''); setEditing(false); }}>
            취소
          </button>
          {memo?.text && (
            <button className="ghost-btn danger" onClick={() => { onDelete(); setEditing(false); }}>
              <IconTrash />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!memo?.text) {
    return (
      <button className="memo-add" onClick={() => setEditing(true)}>
        <IconPencil /> 외우는 방법 메모하기
      </button>
    );
  }

  return (
    <button className="memo" onClick={() => setEditing(true)}>
      <span className="memo-label">내 메모</span>
      <span className="memo-text">{memo.text}</span>
    </button>
  );
}
