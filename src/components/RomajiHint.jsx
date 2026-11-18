import { romajiToKana } from '../lib/jptext.js';

/* 주관식에 로마자로 쓴 답 — 채점하지 않고 입력칸 밑에 남는 안내를 띄운다(QA FIX-04).
 * 전에는 잠깐 뜨는 알림 하나라 「제출을 눌렀는데 아무 반응이 없다」로 보였다.
 * 쓴 로마자를 히라가나로 바꿀 수 있으면 그 글자를 보여 주고, 눌러서 바로 칸에 넣을 수 있다(제출은 사람이). */
export default function RomajiHint({ value, onUse }) {
  if (!value) return null;
  const kana = romajiToKana(value);
  return (
    <div className="qv-romaji" role="status" aria-live="polite">
      <span>히라가나나 한자로 입력해 주세요. 로마자는 채점하지 않아요.</span>
      {kana
        ? <button type="button" className="chip qv-romaji-use" onClick={() => onUse?.(kana)}><span lang="ja">{kana}</span>로 바꾸기</button>
        : <span className="qv-romaji-ex">(예: ねこ / 猫)</span>}
    </div>
  );
}
