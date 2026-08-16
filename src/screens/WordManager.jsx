import { useState } from 'react';
import { IconTrash } from '../components/Icons.jsx';
import { conjugate } from '../lib/conjugate.js';

// 내 단어 추가 · 전체 단어 목록 관리. 설정에서 열리는 서브 화면이다.
export default function WordManager({ words, customWords, onAddWord, onDeleteWord, onToast }) {
  const [tab, setTab] = useState('add');

  return (
    <>
      <div className="segment" style={{ marginBottom: 16 }}>
        <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>단어 추가</button>
        <button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>목록 관리</button>
      </div>

      {tab === 'add' ? (
        <AddWord
          onSubmit={(word) => {
            onAddWord(word);
            onToast(`「${word.mean}」를 추가했어요`);
            setTab('manage');
          }}
        />
      ) : (
        <ManageList
          defaultWords={words.filter((w) => !w.custom)}
          customWords={customWords}
          onDelete={onDeleteWord}
        />
      )}
    </>
  );
}

function AddWord({ onSubmit }) {
  const [kind, setKind] = useState('verb');
  const [kanji, setKanji] = useState('');
  const [kana, setKana] = useState('');
  const [mean, setMean] = useState('');
  const [example, setExample] = useState('');
  const [exampleKo, setExampleKo] = useState('');
  const [group, setGroup] = useState('2');
  const [wordKind, setWordKind] = useState('noun');

  const preview = kind === 'verb' && kana ? conjugate(kana, group) : null;
  const previewRows = preview ? [
    ['ます', preview.masu], ['て형', preview.te], ['ない', preview.nai],
    ['가능형', preview.potentialDict], ['의지형', preview.volitionalCasual],
  ] : [];

  const submit = () => {
    if (!kana.trim() || !mean.trim()) return;
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const base = {
      id,
      kanji: kanji.trim() || kana.trim(),
      kana: kana.trim(),
      mean: mean.trim(),
      example: example.trim() || undefined,
      exampleKo: exampleKo.trim() || undefined,
      custom: true,
    };
    onSubmit(kind === 'verb'
      ? { ...base, type: 'verb', group }
      : { ...base, type: wordKind });
    setKanji(''); setKana(''); setMean(''); setExample(''); setExampleKo('');
  };

  return (
    <>
      <div className="segment" style={{ marginBottom: 16 }}>
        <button className={kind === 'verb' ? 'active' : ''} onClick={() => setKind('verb')}>동사</button>
        <button className={kind === 'other' ? 'active' : ''} onClick={() => setKind('other')}>명사 · 형용사</button>
      </div>

      <div className="field"><label>한자 (선택)</label><input value={kanji} onChange={(e) => setKanji(e.target.value)} placeholder="食べる" /></div>
      <div className="field"><label>히라가나</label><input value={kana} onChange={(e) => setKana(e.target.value)} placeholder="たべる" /></div>
      <div className="field"><label>뜻</label><input value={mean} onChange={(e) => setMean(e.target.value)} placeholder="먹다" /></div>
      <div className="field"><label>예문 (선택)</label><input value={example} onChange={(e) => setExample(e.target.value)} placeholder="パンを食べます" /></div>
      <div className="field"><label>예문 해석 (선택)</label><input value={exampleKo} onChange={(e) => setExampleKo(e.target.value)} placeholder="빵을 먹습니다" /></div>

      {kind === 'verb' ? (
        <>
          <div className="field">
            <label>그룹</label>
            <div className="grouppick">
              {['2', '1', '3'].map((g) => (
                <button key={g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>{g}그룹</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>활용 미리보기</label>
            <div className="preview-grid">
              {preview ? previewRows.map(([k, v]) => (
                <div key={k} className="preview-cell"><div className="k">{k}</div><div className="v">{v}</div></div>
              )) : (
                <div className="preview-cell" style={{ gridColumn: '1/3', color: 'var(--ink-soft)' }}>히라가나를 입력하면 활용형이 보여요</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="field">
          <label>분류</label>
          <div className="grouppick">
            <button className={wordKind === 'noun' ? 'active' : ''} onClick={() => setWordKind('noun')}>명사</button>
            <button className={wordKind === 'adj' ? 'active' : ''} onClick={() => setWordKind('adj')}>형용사</button>
          </div>
        </div>
      )}

      <button className="submit-btn" onClick={submit}>등록하기</button>
    </>
  );
}

function ManageList({ defaultWords, customWords, onDelete }) {
  const [query, setQuery] = useState('');
  const match = (w) => (w.kanji + w.kana + w.mean).includes(query);
  const mine = customWords.filter(match);
  const base = defaultWords.filter(match);

  return (
    <>
      <input className="search-input" placeholder="단어 검색" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="manage-group-label">내가 추가한 단어 · {customWords.length}개</div>
      <div className="card" style={{ padding: '2px 12px' }}>
        {mine.length === 0 ? (
          <div className="manage-kr" style={{ padding: '10px 0' }}>아직 추가한 단어가 없어요</div>
        ) : mine.map((w) => (
          <div key={w.id} className="manage-row">
            <div>
              <div className="manage-jp">{w.kanji} <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>· {w.kana}</span></div>
              <div className="manage-kr">{w.mean}</div>
              {w.source?.video && (
                <div className="manage-src">영상에서 담음{w.source.title ? ` · ${w.source.title}` : ''}</div>
              )}
            </div>
            <button className="del-btn" onClick={() => onDelete(w.id)}><IconTrash /></button>
          </div>
        ))}
      </div>

      <div className="manage-group-label">기본 단어 · {defaultWords.length}개</div>
      <div className="card" style={{ padding: '2px 12px' }}>
        {base.map((w) => (
          <div key={w.id} className="manage-row">
            <div>
              <div className="manage-jp">{w.kanji} <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>· {w.kana}</span></div>
              <div className="manage-kr">{w.mean}</div>
            </div>
            <span className="badge-default">기본</span>
          </div>
        ))}
      </div>
    </>
  );
}
