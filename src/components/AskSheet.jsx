import { useEffect, useRef, useState } from 'react';
import { IconSpeaker, IconPlus } from './Icons.jsx';
import BottomSheet from './BottomSheet.jsx';
import HunterTutor from './HunterTutor.jsx';
import { questionTutor, TUTORS } from '../data/hunterTutors.js';
import { speakJapanese, readingText } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { resolveProvider } from '../lib/aiClient.js';
import { MAX_QUESTION_CHARS, ASK_PRESET, ask, askKey, findAsk, hasKanji, presetQuestion, rememberAsk } from '../lib/ask.js';

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
  guide = null, title = '궁금한 거 물어보기',
  /* 외우는 법을 골라 그 카드의 메모에 담는다 — 카드를 보고 물을 때만(memoText는 지금 메모) */
  onSaveMemo = null, memoText = '',
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(null);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  /* 지금 보는 카드 — 늦게 온 답이 어느 카드 것인지 견줄 때 쓴다 */
  const cardNow = useRef(card?.id || '');
  cardNow.current = card?.id || '';
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

  /* ★ 질문 창에서 글을 치는 중에 초점을 뺏기지 않는다 ★
     뒤쪽 화면(퀴즈 · 회독 · 입력칸이 있는 화면)이 저절로 초점을 가져가면 치던 글이 끊기고 글자가 엉뚱한 칸으로 들어간다.
     화면마다 초점을 안 뺏게 고쳐 왔지만 새 화면이 생길 때마다 같은 일이 났다 — 그래서 여기서 한 번 더 막는다.
     사람이 직접 옮긴 것(누르기 · Tab)이 아닌데 창 밖으로 초점이 나가면 글상자로 되돌린다. */
  useEffect(() => {
    if (!open) return undefined;
    let lastUser = 0;
    const mark = () => { lastUser = Date.now(); };
    const markKey = (e) => { if (e.key === 'Tab') mark(); };
    const onFocusIn = (e) => {
      const input = inputRef.current;
      const dialog = input?.closest?.('[role="dialog"]');
      if (!input || !dialog || dialog.contains(e.target)) return;
      if (Date.now() - lastUser < 600) return;      // 사람이 옮긴 것
      input.focus();
    };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', markKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('pointerdown', mark, true);
      document.removeEventListener('keydown', markKey, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [open]);

  /* ★ 눌러서 묻는 두 가지: 한자 설명 · 외우는 법 ★
     글상자에 적은 것이 있으면 그것을, 없으면 지금 보는 카드를 두고 묻는다. 정해 둔 글로 묻는 것뿐이라 같은 기록에 남는다. */
  const target = () => q.trim() || card?.kanji || card?.kana || '';
  const runPreset = (kind) => {
    const t = target();
    if (!t) { setErr('설명할 낱말이나 한자를 글상자에 적고 눌러 주세요.'); return; }
    if (kind === ASK_PRESET.KANJI && !hasKanji(t)) { setErr(`「${t}」에는 한자가 없어요. 한자가 든 낱말을 적고 눌러 주세요.`); return; }
    run(presetQuestion(kind, t));
  };

  const run = async (preset = '') => {
    const text = (typeof preset === 'string' && preset) ? preset : q.trim();
    if (!text || busy) return;
    setErr('');

    /* 같은 걸 또 물으면 요금만 또 나간다. 그리고 비행기 모드에서도 아까 받은
       건 다시 볼 수 있어야 한다. */
    const had = findAsk(history, card?.id, text);
    if (had) { setShown(had); setQ(''); return; }

    if (!navigator.onLine) {
      setErr('물어보려면 인터넷이 있어야 해요. 전에 물어본 건 아래에 남아 있어요.');
      return;
    }

    setBusy(true);
    try {
      /* 누구에게 말을 거는지 같이 보낸다 — 「너의 ○○는 뭐야」 같은 잡담도 받아 준다 */
      const got = await ask(text, card, settings, { guideName: TUTORS[guide || questionTutor(text)]?.name || '' });
      const entry = {
        key: askKey(card?.id, text),
        q: text,
        cardId: card?.id || '',
        cardLabel: card?.kanji || card?.kana || '',
        at: Date.now(),
        ...got,
      };
      onHistory(rememberAsk(history, entry));
      /* 답을 기다리는 사이 다른 카드로 넘어갔으면 화면에는 안 띄운다(기록에는 남는다) — 앞 카드의 답이 새 카드에 보였다 */
      if (cardNow.current !== (card?.id || '')) return;
      setShown(entry);
      setQ('');   // 물은 글은 답 위에 남아 있다 — 글상자는 비워서 다음 질문을 바로 치게 한다
    } catch (e) {
      setErr(e.message || '물어보지 못했어요');
    } finally {
      setBusy(false);
      /* 마우스로 「물어보기」를 누르면 초점이 버튼에 가 있다 — 키보드가 있는 기기에서는 글상자로 되돌려 바로 다음 질문을 치게 한다.
         터치 기기에서는 안 한다(화면 자판이 다시 올라와 방금 온 답을 가린다). */
      try {
        if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) setTimeout(() => inputRef.current?.focus(), 0);
      } catch { /* 초점을 못 줘도 물어보기는 된다 */ }
    }
  };

  const mine = history.filter((h) => h.cardId === card?.id && h.key !== shown?.key);

  return (
    <BottomSheet open={open} onClose={onClose} label="궁금한 것 물어보기">
      <div className="asksheet">
        <div className="ask-head">
          <h3>{title}{guide && <small className="ask-aitag">AI</small>}</h3>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); return; }
              /* 창을 열면 글상자에 바로 초점이 간다. 그런데 단축키는 글상자
                 안에서는 안 듣는다(치는 글자가 명령이 되면 안 되니까) —
                 그래서 Esc가 여기서만 안 먹었다. 이 자리에서 직접 받는다. */
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder={card
              ? `예: ${card.kanji || card.kana}랑 비슷한 말은? / 언제 쓰는 말이야?`
              : '예: 〜ている는 언제 써? / ありがとう랑 どうも 차이는?'}
            rows={2}
            /* ★ 기다리는 동안 잠그지(disabled) 않는다 ★ 잠그면 브라우저가 초점을 빼 버려서, 답이 온 뒤 다시 눌러야 다음 질문을 칠 수 있었다.
               읽기 전용으로만 둔다 — 초점은 그대로라 답이 오면 바로 이어서 친다. */
            readOnly={busy}
            aria-busy={busy}
          />
          <button className="submit-btn" disabled={busy || !q.trim() || !ai.apiKey} onClick={() => run()}>
            {busy ? '물어보는 중…' : '물어보기'}
          </button>
          {/* 자주 묻는 두 가지는 눌러서 — 글상자에 적은 낱말(없으면 지금 카드)을 두고 묻는다 */}
          <div className="ask-presets" role="group" aria-label="바로 묻기">
            <button type="button" className="ask-preset" data-preset="kanji" disabled={busy || !ai.apiKey} onClick={() => runPreset(ASK_PRESET.KANJI)}>한자 설명</button>
            <button type="button" className="ask-preset" data-preset="memo" disabled={busy || !ai.apiKey} onClick={() => runPreset(ASK_PRESET.MEMO)}>외우는 법 추천</button>
          </div>
        </div>

        {!ai.apiKey && (
          <p className="set-note">
            설정에서 AI 키를 넣으면 여기서 바로 물어볼 수 있어요.
            키는 이 기기에만 저장돼요.
          </p>
        )}
        {ai.apiKey && !shown && !err && (
          <p className="set-note">
            {card
              ? '지금 보는 카드를 같이 보내니까 「이거 언제 써?」처럼 짧게 물어도 알아들어요. 「한자 설명」은 한국 한자음과 글자의 짜임을, 「외우는 법 추천」은 짧은 연상 문구를 알려 줘요.'
              : '일본어 공부하다 궁금한 건 뭐든 물어보세요. 낱말을 적고 「한자 설명」이나 「외우는 법 추천」을 누르면 그 낱말로 물어봐요. 답은 짧게 옵니다.'}
          </p>
        )}
        {err && <p className="ask-err">{err}</p>}

        {shown && (
          <div className="ask-ans">
            <div className="ask-q">{shown.q}</div>
            <HunterTutor guide={guide || questionTutor(shown.q)} scene="city" title="궁금한 표현 설명" line="지금 질문한 내용과 카드의 표현을 함께 살펴봐요." compact>
              <p className="ask-text">{shown.answer}</p>
            </HunterTutor>
            {/* 한자 설명 — 글자마다: 한국 한자음 · 한국어에서의 쓰임 · 짜임 · 덧붙임 */}
            {(shown.kanji || []).map((k) => (
              <div key={k.char} className="ask-kanji">
                <div className="ask-ktop"><b lang="ja">{k.char}</b>{k.hanja && <span>{k.hanja}</span>}</div>
                {k.korean && <p><i>한국어에서</i>{k.korean}</p>}
                {k.parts && <p><i>짜임</i>{k.parts}</p>}
                {k.more && <p><i>덧붙임</i>{k.more}</p>}
              </div>
            ))}
            {/* 외우는 법 — 마음에 드는 것을 골라 카드 메모에 담는다 */}
            {(shown.tips || []).map((t, i) => (
              <div key={`${i}:${t.text}`} className="ask-tip">
                <p>{t.kind && <i>{t.kind}</i>}{t.text}</p>
                {onSaveMemo && card?.id && shown.cardId === card.id && (
                  <button
                    type="button" className="ghost-btn ask-usetip"
                    onClick={() => {
                      const cur = String(memoText || '').trim();
                      if (cur.includes(t.text)) { onToast?.('이미 메모에 있어요'); return; }
                      onSaveMemo(card.id, cur ? `${cur}\n${t.text}` : t.text);
                      onToast?.('외우는 법 메모에 담았어요');
                    }}
                  >이걸로 외울게요</button>
                )}
              </div>
            ))}
            {(shown.items || []).map((it) => (
              <div key={it.jp} className="ask-item">
                <div className="ask-itop">
                  <b>{it.jp}</b>
                  <button
                    className="ask-say"
                    onClick={() => speakJapanese(readingText(it.kana, it.jp), settings.speechRate)}
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
