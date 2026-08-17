import { useEffect, useMemo, useState } from 'react';
import { IconSpeaker, IconPlus, IconTrash } from '../components/Icons.jsx';
import { speakJapanese, speakSlow, readingText } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import {
  MAX_INPUT_CHARS, TREND_COUNT, fetchTrends, shapeTranslation, translate,
} from '../lib/translate.js';
import { resolveProvider } from '../lib/aiClient.js';

/* 현지에서 바로 쓰는 번역기.
 *
 * 학습 화면이 아니다. 가게 앞에서 한 손으로 30초 안에 끝나야 한다. 그래서
 * 규칙이 몇 개 있다.
 *
 *   - 답이 오면 제일 먼저 크게 보이는 건 한글 발음이다. 여행 중에 가나를
 *     더듬어 읽을 틈은 없다. 눈으로 보고 바로 입으로 나와야 한다.
 *   - 한글 발음은 AI에게 안 맡긴다. 받아 온 가나를 우리가 바꾼다 —
 *     지어낸 발음을 그대로 말하면 안 통하고, 틀린 줄도 모른다.
 *   - 최근 것은 남겨 둔다. 같은 걸 두 번 물어보면 요금만 두 번 나간다.
 *     비행기 모드에서도 아까 받은 건 다시 볼 수 있어야 한다.
 *   - 단어는 그 자리에서 단어장에 담긴다. 여행에서 쓴 말이 제일 잘 붙는다.
 */

/* 요즘 말은 알아듣는 것만으로도 값이 있지만, 아무 데나 쓰면 무례해진다.
   딱지에 그 선을 적어 둔다. */
const SAFE_HINT = {
  친구: '또래끼리만',
  점원: '젊은 점원에게도 OK',
  안전: '누구에게나 OK',
};

const WORD_TYPES = ['verb', 'noun', 'adj-i', 'adj-na', 'adv', 'conj', 'etc'];
const WORD_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

/* 번역기에서 담은 단어도 원래 쓰던 카드와 같은 모양이어야 회독·시험이
   따로 놀지 않는다. id를 단어로 고정해서 같은 말을 또 담아도 안 늘어난다. */
function toCard(w) {
  return {
    id: `custom-tr-${w.jp}`,
    kanji: w.jp,
    kana: w.yomi || w.jp,
    mean: w.ko,
    type: WORD_TYPES.includes(w.type) ? w.type : 'etc',
    level: WORD_LEVELS.includes(w.level) ? w.level : 'N4',
    // 요즘 말은 예문 없이 「それな」만 남으면 나중에 봐도 쓸 자리를 모른다
    example: w.ex || '',
    exampleKana: w.ex ? (w.exYomi || w.ex) : '',
    exampleKo: w.ex ? (w.exKo || '') : '',
    custom: true,
    source: { from: '번역기' },
  };
}

/* 일본어 구두점을 한글 발음에 그대로 두면 「스미마센、코레와」처럼 읽기 나쁘다.
   소리에 영향이 없는 건 우리 문장부호로 바꾸거나 뺀다. */
function readable(text) {
  return text.replace(/、/g, ', ').replace(/[。]/g, '').replace(/？/g, '?').replace(/！/g, '!').trim();
}

/* 일본어 한 줄 + 읽는 법 + 한글 발음. 화면 곳곳에서 같은 모양으로 나온다. */
function Line({ jp, yomi, big, rate }) {
  const hangul = readable(kanaToHangul(yomi || jp));
  return (
    <div className={`tr-line${big ? ' big' : ''}`}>
      <div className="tr-jp">{jp}</div>
      {hangul && <div className="tr-hangul">{hangul}</div>}
      {yomi && yomi !== jp && <div className="tr-yomi">{yomi}</div>}
      <div className="tr-say">
        <button className="ghost-btn" onClick={() => speakJapanese(readingText(yomi, jp), rate)}>
          <IconSpeaker /> 듣기
        </button>
        <button className="ghost-btn" onClick={() => speakSlow(readingText(yomi, jp))}>천천히</button>
      </div>
    </div>
  );
}

export default function Translate({
  settings, onAddWord, onToast, history, onHistory, trends, onTrends,
}) {
  const [korean, setKorean] = useState('');
  const [busy, setBusy] = useState(false);
  const [trendBusy, setTrendBusy] = useState(false);
  const [openId, setOpenId] = useState(history[0]?.id || null);

  const ai = useMemo(() => resolveProvider(settings), [settings]);
  const rate = settings.speechRate;
  /* 화면에 올리기 전에 모양을 한 번 맞춘다. 저장된 것이든 방금 받은 것이든
     여기를 지나가므로, 칸이 하나 빠져서 화면이 죽는 일이 없다. */
  const found = history.find((h) => h.id === openId) || history[0] || null;
  const shown = found ? shapeTranslation(found) : null;
  // 언제 받았는지 적어 둔다 — 유행어는 낡는다
  const trendAt = trends?.at ? new Date(trends.at).toLocaleDateString('ko-KR', { dateStyle: 'short' }) : '';

  useEffect(() => { if (!openId && history[0]) setOpenId(history[0].id); }, [history, openId]);

  const run = async () => {
    const text = korean.trim();
    if (!text || busy) return;

    /* 방금 물어본 것과 같으면 다시 안 부른다. 여행 중에 같은 말을 두 번
       치는 일은 흔한데, 그때마다 요금이 나갈 이유가 없다. */
    const already = history.find((h) => h.korean === text && h.place === (settings.tripPlace || ''));
    if (already) { setOpenId(already.id); setKorean(''); onToast('아까 물어본 거예요'); return; }

    setBusy(true);
    try {
      const result = await translate({
        ...ai, korean: text, place: settings.tripPlace,
      });
      const entry = {
        id: `tr-${Date.now()}`, korean: text, place: settings.tripPlace || '', at: Date.now(), ...result,
      };
      onHistory([entry, ...history]);
      setOpenId(entry.id);
      setKorean('');
    } catch (err) {
      onToast(err.message || '번역하지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const keep = (w) => {
    onAddWord(toCard(w));
    onToast(`${w.jp} — 단어장에 담았어요`);
  };

  /* 요즘 말은 목록을 코드에 박아 두지 않는다. 적어 두는 순간 낡기 시작하고,
     낡은 유행어를 자신 있게 알려 주는 건 안 알려 주느니만 못하다. */
  const loadTrend = async () => {
    if (trendBusy) return;
    setTrendBusy(true);
    try {
      const items = await fetchTrends(ai);
      onTrends({ at: Date.now(), items });
    } catch (err) {
      onToast(err.message || '받아오지 못했어요');
    } finally {
      setTrendBusy(false);
    }
  };

  const drop = (id) => {
    onHistory(history.filter((h) => h.id !== id));
    if (openId === id) setOpenId(null);
  };

  return (
    <>
      <div className="tr-ask">
        <textarea
          className="tr-input"
          value={korean}
          onChange={(e) => setKorean(e.target.value.slice(0, MAX_INPUT_CHARS))}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
          placeholder="한국어로 적으세요 — 예: 이거 얼마예요? / 아아 하나요"
          rows={2}
        />
        <button className="tr-go" disabled={busy || !korean.trim() || !ai.apiKey} onClick={run}>
          {busy ? '물어보는 중…' : '일본어로'}
        </button>
      </div>

      {!ai.apiKey && (
        <p className="vd-note">
          설정 → 영상 학습에서 API 키를 넣으면 여기서 바로 번역해요. 키는 이 기기에만 저장돼요.
        </p>
      )}
      {ai.apiKey && !shown && (
        <p className="vd-note">
          지금 그 자리에서 말할 문장으로 알려 줘요. 한글 발음이 같이 나오니 보고 바로 말하면 돼요.
          «대박», «아아», «영끌» 같은 줄임말·유행어로 적어도 알아들어요.
          {settings.tripPlace
            ? ` 지금 «${settings.tripPlace}»로 맞춰져 있어서 그 지역 사투리도 같이 봐요.`
            : ' 설정에서 여행지를 적어 두면 그 지역 사투리도 같이 알려 줘요.'}
        </p>
      )}

      {shown && (
        <div className="card tr-card">
          <div className="tr-asked">{shown.korean}</div>
          <Line jp={shown.jp} yomi={shown.yomi} big rate={rate} />
          {shown.ko && <div className="tr-ko">{shown.ko}</div>}
          {shown.politeness && <span className="tr-tag">{shown.politeness}</span>}
          {shown.note && <p className="tr-note">{shown.note}</p>}

          {shown.alt.length > 0 && (
            <div className="tr-sec">
              <h4>이렇게도 말해요</h4>
              {shown.alt.map((a) => (
                <div key={a.jp} className="tr-sub">
                  <Line jp={a.jp} yomi={a.yomi} rate={rate} />
                  {a.when && <div className="tr-when">{a.when}</div>}
                </div>
              ))}
            </div>
          )}

          {shown.dialect.length > 0 && (
            <div className="tr-sec">
              <h4>그 동네에서는</h4>
              {shown.dialect.map((d) => (
                <div key={d.jp} className="tr-sub">
                  <span className="tr-area">{d.area}</span>
                  <Line jp={d.jp} yomi={d.yomi} rate={rate} />
                  {d.note && <div className="tr-when">{d.note}</div>}
                </div>
              ))}
            </div>
          )}

          {shown.slang.length > 0 && (
            <div className="tr-sec">
              <h4>요즘은 이렇게도</h4>
              {shown.slang.map((g) => (
                <div key={g.jp} className="tr-sub">
                  {/* 어디까지 써도 되는지를 말보다 먼저 보여 준다. 모르고 점원에게
                      던지면 무례하게 들리는 말이 섞여 있다. */}
                  <span className={`tr-safe s-${g.safe}`}>{SAFE_HINT[g.safe] || g.safe}</span>
                  <Line jp={g.jp} yomi={g.yomi} rate={rate} />
                  {g.ko && <div className="tr-when">{g.ko}</div>}
                  {g.note && <div className="tr-when">{g.note}</div>}
                </div>
              ))}
            </div>
          )}

          {shown.words.length > 0 && (
            <div className="tr-sec">
              <h4>여기서 건질 단어</h4>
              {shown.words.map((w) => (
                <div key={w.jp} className="tr-word">
                  <button className="tr-wordmain" onClick={() => speakJapanese(readingText(w.yomi, w.jp), rate)}>
                    <span className="tr-wjp">{w.jp}</span>
                    <span className="tr-wyomi">{readable(kanaToHangul(w.yomi || w.jp)) || w.yomi}</span>
                    <span className="tr-wko">{w.ko}</span>
                  </button>
                  <button className="tr-keep" onClick={() => keep(w)} aria-label={`${w.jp} 단어장에 담기`}>
                    <IconPlus />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 물어볼 말이 없어도 미리 알아 두는 자리. 접어 둔다 — 번역이 본업이다. */}
      <details className="tr-trend">
        <summary>요즘 일본어 알아보기</summary>
        <p className="vd-note">
          지금 젊은 사람들이 쓰는 말을 {TREND_COUNT}개씩 받아 와요. 예문이 같이 오니 그날 바로 써 볼 수 있어요.
          {' '}<b>모델이 아는 범위</b>라 진짜 요즘 것인지는 현지에서 확인하세요.
          {trendAt && ` (${trendAt}에 받음)`}
        </p>
        <button className="ghost-btn" disabled={trendBusy || !ai.apiKey} onClick={loadTrend}>
          {trendBusy ? '받는 중…' : (trends?.items?.length ? '다시 받기' : '받아 오기')}
        </button>

        {(trends?.items || []).map((t) => (
          <div key={t.jp} className="tr-trendrow">
            <span className={`tr-safe s-${t.safe}`}>{SAFE_HINT[t.safe] || t.safe}</span>
            <Line jp={t.jp} yomi={t.yomi} rate={rate} />
            <div className="tr-when"><b>{t.ko}</b>{t.when ? ` — ${t.when}` : ''}</div>
            {t.ex && (
              <div className="tr-ex">
                <button className="tr-exsay" onClick={() => speakJapanese(readingText(t.exYomi, t.ex), rate)}>
                  <IconSpeaker />
                </button>
                <span>
                  <b>{t.ex}</b>
                  <i>{readable(kanaToHangul(t.exYomi || t.ex))}</i>
                  {t.exKo && <em>{t.exKo}</em>}
                </span>
              </div>
            )}
            <button
              className="ghost-btn tr-trendkeep"
              onClick={() => keep({
                jp: t.jp, yomi: t.yomi, ko: t.ko, type: 'expr', level: 'N3',
                ex: t.ex, exYomi: t.exYomi, exKo: t.exKo,
              })}
            >
              단어장에 담기
            </button>
          </div>
        ))}
      </details>

      {history.length > 0 && (
        <>
          <div className="section-label">최근에 물어본 것</div>
          <div className="stack">
            {history.map((h) => (
              <div key={h.id} className={`card tr-item${h.id === openId ? ' on' : ''}`}>
                <button className="tr-open" onClick={() => setOpenId(h.id)}>
                  <div className="tr-ik">{h.korean}</div>
                  <div className="tr-ij">{h.jp}</div>
                </button>
                <button className="vd-del" onClick={() => drop(h.id)} aria-label="지우기"><IconTrash /></button>
              </div>
            ))}
          </div>
          <p className="vd-note">
            받아 둔 건 인터넷이 없어도 다시 볼 수 있어요. 비행기 모드에서도 그대로예요.
          </p>
        </>
      )}
    </>
  );
}
