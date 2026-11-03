import SpeakButton from './SpeakButton.jsx';
import { useReviewOpen } from './OptionReview.jsx';

/* 독일어 문제의 보기 상세 — 답을 낸 뒤 보기마다 독일어 · 한글 발음 · 뜻 · 🔊.
 *
 * 일본어 칸(OptionReview)과 일부러 따로 둔다. 독일어는
 *   · 소리를 독일어(de-DE) 음성으로 내야 하고, 일본어 엔진으로 읽히면 안 된다
 *   · 일본어처럼 「읽기(가나)」가 따로 없다 — 대신 짧은 낱말에는 한글 발음 도움말(han)이 있다
 *   · 스위스에서 다르게 말하는 표현(ch)은 스위스 독일어(de-CH) 음성으로 따로 들려줘야 한다
 * 그래서 줄의 구성이 다르다: 독일어 / 한글 발음 / 뜻 / 🔊 / (있으면) 🇨🇭 표현 + 🔊. */

const DE = 'de-DE';
const CH = 'de-CH';

export default function SwissOptionReview({ options, answerId, pickId, rate, idPrefix = 'sw' }) {
  const [open, setOpen] = useReviewOpen();
  if (!options || options.length < 2) return null;
  return (
    <details
      className="optrev optrev-de"
      open={open}
      onToggle={(e) => { if (e.currentTarget.open !== open) setOpen(e.currentTarget.open); }}
    >
      <summary>보기 발음 · 뜻 · 듣기 <small>독일어 음성으로 들려줘요</small></summary>
      <ul className="optrev-list">
        {options.map((o, i) => {
          const tone = o.id === answerId ? 'correct' : (o.id === pickId ? 'mine' : '');
          return (
            <li key={o.id} className={`optrev-row${tone ? ` ${tone}` : ''}`} data-id={o.id}>
              <span className="optrev-num">{i + 1}</span>
              <span className="optrev-body">
                <span className="optrev-line">
                  <b lang="de">{o.de}</b>
                  {o.han && <i>{o.han}</i>}
                  <SpeakButton text={o.de} lang={DE} rate={rate} id={`${idPrefix}:de:${o.id}`} label="독일어로 듣기" />
                </span>
                <span className="optrev-ko">{o.ko}</span>
                {o.ch && (
                  <span className="optrev-ch">
                    <span aria-hidden="true">🇨🇭</span> <b lang="de-CH">{o.ch.text}</b>
                    <SpeakButton text={o.ch.text} lang={CH} rate={rate} id={`${idPrefix}:ch:${o.id}`} label="스위스 표현 듣기" />
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
