import { useEffect, useRef, useState } from 'react';
import { IconSpeaker, IconPlus } from './Icons.jsx';
import BottomSheet from './BottomSheet.jsx';
import { speakJapanese } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { resolveProvider } from '../lib/aiClient.js';
import { MAX_QUESTION_CHARS, ask, askKey, findAsk, rememberAsk } from '../lib/ask.js';

/* 공부하다 떠오른 걸 물어보는 창.
 *
 * 회독 화면에서 부르지만 그 화면 것이 아니다 — 시험에도 실전에도 같은 창을
 * 붙일 수 있게 따로 뒀다. 필요한 건 카드 하나와 설정뿐이다.
 *
 * 창을 닫아도 방금 받은 답은 안 지운다. 물어보고 카드로 돌아갔다가 "아까 뭐랬지"
 * 하고 다시 여는 일이 실제로 생긴다. */

/* 물어본 표현을 단어장으로 옮길 때 쓰는 모양. 번역기와 같은 규칙이다 —
   id를 표현으로 고정해서 같은 걸 두 번 담아도 안 늘어난다. */
function toCard(item, from) {
  return {
    id: `custom-ask-${item.jp}`,
    kanji: item.jp,
    kana: item.kana || item.jp,
    mean: item.ko || item.note || '',
    type: 'etc',
    level: 'N4',
    example: '',
    exampleKana: '',
    exampleKo: '',
    custom: true,
    source: { from: '물어보기', card: from || '' },
  };
}

export default function AskSheet({
  open, card, settings, history, onHistory, onAddWord, onClose, onToast,
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(null);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  const ai = resolveProvider(settings);

  /* 카드가 바뀌면 앞 카드 이야기를 지운다. 「食べる 뭐가 어쩌고」가 남은 채로
     다음 카드가 뜨면 그 카드 설명인 줄 안다. */
  useEffect(() => { setQ(''); setShown(null); setErr(''); }, [card?.id]);

  useEffect(() => {
    if (!open) return;
    // 열자마자 바로 칠 수 있어야 한다. 한 번 더 두드리게 하면 안 쓰게 된다.
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open]);

  const run = async () => {
    const text = q.trim();
    if (!text || busy) return;
    setErr('');

    /* 같은 걸 또 물으면 요금만 또 나간다. 그리고 비행기 모드에서도 아까 받은
       건 다시 볼 수 있어야 한다. */
    const had = findAsk(history, card?.id, text);
    if (had) { setShown(had); return; }

    if (!navigator.onLine) {
      setErr('물어보려면 인터넷이 있어야 해요. 전에 물어본 건 아래에 남아 있어요.');
      return;
    }

    setBusy(true);
    try {
      const got = await ask(text, card, settings);
      const entry = {
        key: askKey(card?.id, text),
        q: text,
        cardId: card?.id || '',
        cardLabel: card?.kanji || card?.kana || '',
        at: Date.now(),
        ...got,
      };
      setShown(entry);
      onHistory(rememberAsk(history, entry));
    } catch (e) {
      setErr(e.message || '물어보지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const mine = history.filter((h) => h.cardId === card?.id && h.key !== shown?.key);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="asksheet">
        <div className="ask-head">
          <h3>궁금한 거 물어보기</h3>
          {card && (
            <span className="ask-chip">
              {card.kanji || card.kana}
              {card.kana && card.kana !== card.kanji && <i>{card.kana}</i>}
            </span>
          )}
        </div>

        <div className="ask-box">
          <textarea
            ref={inputRef}
            className="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, MAX_QUESTION_CHARS))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
            placeholder={card
              ? `예: ${card.kanji || card.kana}랑 비슷한 말은? / 언제 쓰는 말이야?`
              : '궁금한 걸 적으세요'}
            rows={2}
            disabled={busy}
          />
          <button className="submit-btn" disabled={busy || !q.trim() || !ai.apiKey} onClick={run}>
            {busy ? '물어보는 중…' : '물어보기'}
          </button>
        </div>

        {!ai.apiKey && (
          <p className="set-note">
            더보기 → 설정에서 AI 키를 넣으면 여기서 바로 물어볼 수 있어요.
            키는 이 기기에만 저장돼요.
          </p>
        )}
        {ai.apiKey && !shown && !err && (
          <p className="set-note">
            지금 보는 카드를 같이 보내니까 「이거 언제 써?」처럼 짧게 물어도 알아들어요.
            공부하다 옆길로 새는 용이라 답은 짧게 옵니다.
          </p>
        )}
        {err && <p className="ask-err">{err}</p>}

        {shown && (
          <div className="ask-ans">
            <div className="ask-q">{shown.q}</div>
            <p className="ask-text">{shown.answer}</p>
            {shown.items.map((it) => (
              <div key={it.jp} className="ask-item">
                <div className="ask-itop">
                  <b>{it.jp}</b>
                  <button
                    className="ask-say"
                    onClick={() => speakJapanese(it.kana || it.jp, settings.speechRate)}
                    aria-label={`${it.jp} 발음 듣기`}
                  ><IconSpeaker /></button>
                  {onAddWord && (
                    <button
                      className="ask-add"
                      onClick={() => {
                        onAddWord(toCard(it, card?.kanji || card?.kana));
                        onToast?.(`«${it.jp}»를 단어장에 담았어요`);
                      }}
                      aria-label={`${it.jp} 단어장에 담기`}
                    ><IconPlus /></button>
                  )}
                </div>
                <div className="ask-ikana">
                  {it.kana}
                  {settings.hangulPron && ` · ${kanaToHangul(it.kana)}`}
                </div>
                {it.ko && <div className="ask-iko">{it.ko}</div>}
                {it.note && <div className="ask-inote">{it.note}</div>}
              </div>
            ))}
            {/* AI는 틀린다. 그걸 안 적어 두면 여기서 본 걸 사전처럼 믿는다. */}
            <p className="ask-warn">AI가 답한 거예요. 중요한 건 한 번 더 확인하세요.</p>
          </div>
        )}

        {mine.length > 0 && (
          <>
            <div className="section-label">이 카드로 물어본 것</div>
            {mine.map((h) => (
              <button key={h.key} className="ask-old" onClick={() => setShown(h)}>
                <b>{h.q}</b>
                <span>{h.answer}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
