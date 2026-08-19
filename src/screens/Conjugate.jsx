import { useMemo, useState } from 'react';
import {
  FORMS, BASIC_KEYS, MORE_KEYS, ASK_KEYS, GROUP_LABEL,
  conjugate, planDrill, applyDrill, drillRate, canDrill,
} from '../lib/verbform.js';
import { kanaToHangul } from '../lib/hangul.js';
import { speakJapanese } from '../lib/tts.js';
import { IconCheck, IconX, IconSpeaker, IconArrowLeft } from '../components/Icons.jsx';

const GROUPS = ['1', '2', '3'];
const COUNTS = [10, 20, 30];

/* 활용표는 여섯 줄이면 충분하다 — 릴에 나오는 그 여섯이다.
   て형과 정중 부정은 켠 사람에게만 더 보여 준다. */
function TableRows({ forms, keys, rate, mark }) {
  return (
    <div className="cj-table">
      {keys.map((k) => {
        const f = FORMS.find((x) => x.key === k);
        const v = forms[k];
        return (
          <div key={k} className={`cj-row${mark === k ? ' on' : ''}`}>
            <span className="cj-label">{f.ko}</span>
            <span className="cj-val">
              <b>{v.jp}</b>
              <i>{kanaToHangul(v.yomi)}</i>
            </span>
            <button
              className="cj-say"
              onClick={() => speakJapanese(v.yomi, rate)}
              aria-label={`${f.ko} 발음 듣기`}
            >
              <IconSpeaker />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function Conjugate({ words, progress, onProgress, settings, onToast }) {
  const stats = progress.conj || { forms: {}, words: {} };

  const [groups, setGroups] = useState(GROUPS);
  const [withMore, setWithMore] = useState(false);
  const [count, setCount] = useState(10);
  const [run, setRun] = useState(null); // { list, at, right, answers: {id: 고른답} }
  const [look, setLook] = useState(null); // 활용표만 펼쳐 보기

  const rate = settings.speechRate || 1;

  /* 활용은 동사만 된다. 그리고 N5부터 다 외우는 게 목표라 레벨 순으로 둔다 —
     설정에서 고른 레벨이 있으면 그 안에서. */
  const verbs = useMemo(() => {
    const levels = settings.levels?.length ? settings.levels : null;
    return words.filter((w) => canDrill(w) && (!levels || levels.includes(w.level)));
  }, [words, settings.levels]);

  const pool = useMemo(
    () => verbs.filter((w) => groups.includes(String(w.group))),
    [verbs, groups],
  );

  /* 몇 개나 봤는지. "다 외운다"는 이 숫자가 채워지는 것이다. */
  const seen = useMemo(
    () => pool.filter((w) => stats.words?.[w.id]).length,
    [pool, stats.words],
  );

  const keys = withMore ? ASK_KEYS : BASIC_KEYS;

  const start = () => {
    const list = planDrill(pool, { count, groups, keys, wordStats: stats.words, seed: seen });
    if (!list.length) { onToast('풀 동사가 없어요'); return; }
    setRun({ list, at: 0, right: 0, answers: {} });
  };

  const answer = (q, picked) => {
    if (run.answers[q.id]) return;
    const good = picked === q.answer.jp;
    /* 그룹×모양 성적과 동사별 성적을 같이 남긴다. 앞엣것은 어디가 약한지
       보여 주는 표에 쓰고, 뒤엣것은 다음 판에 아직 안 본 동사를 먼저 내는 데 쓴다. */
    const next = applyDrill(stats.forms || {}, q.word, q.formKey, good);
    const w = stats.words?.[q.word.id] || { right: 0, wrong: 0 };
    onProgress({
      forms: next,
      words: { ...(stats.words || {}), [q.word.id]: { right: w.right + (good ? 1 : 0), wrong: w.wrong + (good ? 0 : 1) } },
    });
    setRun((r) => ({ ...r, right: r.right + (good ? 1 : 0), answers: { ...r.answers, [q.id]: picked } }));
  };

  // ── 문제 푸는 중 ──
  if (run) {
    const q = run.list[run.at];
    const picked = run.answers[q.id];
    const done = run.at >= run.list.length - 1 && picked;
    const pct = Math.round((run.at / run.list.length) * 100);

    return (
      <div className="cj">
        <div className="quizhead">
          <div className="qh-row">
            <button className="sh-close" onClick={() => setRun(null)} aria-label="그만두기"><IconArrowLeft /></button>
            <div className="sh-title">{run.at + 1} / {run.list.length}</div>
            <div className="qh-score">{run.right}점</div>
          </div>
          <div className="sh-bar"><i style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="quizcard">
          <div className="qc-tag">
            <span className="cj-gtag">{GROUP_LABEL[q.word.group]}</span>
            <span>{q.label}</span>
          </div>
          <div className="cj-ask">
            <b>{q.forms.dict.jp}</b>
            <i>{kanaToHangul(q.forms.dict.yomi)}</i>
            <em>{q.word.mean}</em>
          </div>
          <button className="qc-speak" onClick={() => speakJapanese(q.forms.dict.yomi, rate)} aria-label="발음 듣기">
            <IconSpeaker />
          </button>
        </div>

        <div className="qoptions">
          {q.choices.map((c, i) => {
            const isAnswer = c === q.answer.jp;
            const isMine = picked === c;
            let cls = 'qopt';
            if (picked) {
              if (isAnswer) cls += ' correct';
              else if (isMine) cls += ' wrong';
              else cls += ' dim';
            }
            return (
              <button key={c} className={cls} disabled={Boolean(picked)} onClick={() => answer(q, c)}>
                <span className="qo-num">{i + 1}</span>
                <span className="qo-body"><b>{c}</b></span>
                {picked && isAnswer && <span className="qo-mark ok"><IconCheck /> 정답</span>}
                {picked && isMine && !isAnswer && <span className="qo-mark no"><IconX /> 내가 고른 답</span>}
              </button>
            );
          })}
        </div>

        {/* 답을 고른 뒤에 여섯 모양을 한 번에 펼친다. 릴에서 하는 방식이 그거고,
            틀린 자리만 알려 주는 것보다 표를 통째로 다시 보는 게 남는다. */}
        {picked && (
          <>
            <div className="section-label">{q.forms.dict.jp} 활용</div>
            <TableRows forms={q.forms} keys={['dict', ...keys]} rate={rate} mark={q.formKey} />
            {done ? (
              <button className="bigstart" onClick={() => { setRun(null); onToast(`${run.right} / ${run.list.length} 맞혔어요`); }}>
                <span className="bs-t">끝내기</span>
                <span className="bs-s">{run.right} / {run.list.length} 맞힘</span>
              </button>
            ) : (
              <button className="bigstart" onClick={() => setRun((r) => ({ ...r, at: r.at + 1 }))}>
                <span className="bs-t">다음 문제</span>
                <span className="bs-s">{run.at + 2} / {run.list.length}</span>
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // ── 시작 화면 ──
  return (
    <div className="cj">
      <p className="vd-note">
        동사를 기본형에서 시제로 바꾸는 연습이에요. 1형(五段)·2형(一段)·3형(불규칙)마다 규칙이 달라서,
        어느 형인지를 아는 게 반이에요. 답을 고르면 여섯 모양을 한 번에 펼쳐 보여 줘요.
      </p>

      <div className="section-label" style={{ marginTop: 0 }}>동사 형태</div>
      <div className="chiprow">
        {GROUPS.map((g) => (
          <button
            key={g}
            className={`chip${groups.includes(g) ? ' active' : ''}`}
            onClick={() => setGroups((prev) => (
              prev.includes(g) ? (prev.length > 1 ? prev.filter((x) => x !== g) : prev) : [...prev, g]
            ))}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="section-label">물어볼 모양</div>
      <div className="card">
        {/* 설정 화면과 같은 모양으로 둔다. 네모 체크칸은 손가락으로 짚기엔 너무 작다 */}
        <button className="toggle-row setrow" onClick={() => setWithMore((v) => !v)} aria-pressed={withMore}>
          <span>
            <span className="set-title">て형 · 정중 부정까지</span>
            <span className="set-sub">기본은 기초 시제 다섯 개예요</span>
          </span>
          <span className={`toggle${withMore ? ' on' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <div className="cj-keys">
        {keys.map((k) => <span key={k} className="cj-keychip">{FORMS.find((f) => f.key === k).ko}</span>)}
      </div>

      <div className="section-label">문항 수</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">한 번에 <span className="set-val">{count}문항</span></div>
          <div className="grouppick">
            {COUNTS.map((n) => (
              <button key={n} className={count === n ? 'active' : ''} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <button className="bigstart" onClick={start} disabled={pool.length === 0}>
        <span className="bs-t">활용 연습 시작</span>
        <span className="bs-s">
          {pool.length ? `동사 ${pool.length}개 중 ${seen}개 봤어요` : '고른 형태에 동사가 없어요'}
        </span>
      </button>

      {/* 어디가 약한지 한 표에. 안 본 자리를 0%로 그리면 틀린 것처럼 읽혀서 빈칸으로 둔다. */}
      <div className="section-label">형태별 성적</div>
      <div className="cj-grid" style={{ '--cols': keys.length }}>
        <div className="cj-gh" />
        {keys.map((k) => <div key={k} className="cj-gh">{FORMS.find((f) => f.key === k).ko}</div>)}
        {GROUPS.map((g) => (
          <div key={g} className="cj-grow">
            <div className="cj-gname">{g}형</div>
            {keys.map((k) => {
              const r = drillRate(stats.forms || {}, g, k);
              const cls = r === null ? 'cj-cell none' : `cj-cell ${r >= 0.8 ? 'good' : r >= 0.5 ? 'mid' : 'bad'}`;
              return <div key={k} className={cls}>{r === null ? '·' : `${Math.round(r * 100)}`}</div>;
            })}
          </div>
        ))}
      </div>
      <p className="set-note">숫자는 맞힌 비율이에요. 점은 아직 안 물어본 자리예요.</p>

      {/* 시험 말고 그냥 표만 보고 싶을 때 */}
      <details className="tr-trend">
        <summary>활용표만 펼쳐 보기</summary>
        <div className="cj-look">
          <input
            className="search-input"
            placeholder="동사를 찾아 보세요 — 예: 飲む, のむ, 마시다"
            value={look || ''}
            onChange={(e) => setLook(e.target.value)}
          />
          {(look || '').trim() && (() => {
            const q = look.trim();
            const hit = verbs.filter((w) => w.kanji.includes(q) || w.kana.includes(q) || w.mean.includes(q)).slice(0, 5);
            if (!hit.length) return <p className="set-note">찾는 동사가 없어요</p>;
            return hit.map((w) => (
              <div key={w.id} className="cj-lookone">
                <div className="cj-lookhead">
                  <b>{w.kanji}</b>
                  <span>{w.mean}</span>
                  <span className="cj-gtag">{GROUP_LABEL[w.group]}</span>
                </div>
                <TableRows forms={conjugate(w)} keys={['dict', ...keys]} rate={rate} />
              </div>
            ));
          })()}
        </div>
      </details>
    </div>
  );
}

export { MORE_KEYS };
