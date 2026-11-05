import { useEffect, useRef, useState } from 'react';
import { geminiGenerate } from '../../lib/aiClient.js';
import Toggle from './Toggle.jsx';
import {
  DEFAULT_GEMINI_MODEL, FAST_GEMINI_MODEL, PROVIDERS, TRANSCRIBE_MINUTES,
  listGeminiModels, recommendModels, resolveProvider,
} from '../../lib/videoTutor.js';

/* 문장 첨삭·번역·영상의 AI 연결. Gemini 키와 음성 키는 별도로 설정한다. */
export default function VideoAI({ settings, onChange, onToast }) {
  const { provider, apiKey } = resolveProvider(settings);
  const gemini = provider === PROVIDERS.GEMINI;
  const [models, setModels] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState(null);
  const checkVersion = useRef(0);
  useEffect(() => {
    checkVersion.current += 1; setConnection(null); setChecking(false);
    return () => { checkVersion.current += 1; };
  }, [apiKey, settings.geminiModel, provider]);

  const checkConnection = async () => {
    if (!apiKey || checking) return;
    const version = ++checkVersion.current;
    setChecking(true); setConnection(null);
    try {
      await geminiGenerate({ apiKey, model: settings.geminiModel, body: {
        contents: [{ role: 'user', parts: [{ text: 'Reply only OK.' }] }],
        generationConfig: { maxOutputTokens: 16 },
      } });
      if (version === checkVersion.current) setConnection({ ok: true, text: `Gemini 문장 생성 요청이 연결됐어요(${settings.geminiModel || DEFAULT_GEMINI_MODEL}). 문장 만들기에서 첨삭을 받을 수 있어요.` });
    } catch (error) {
      if (version === checkVersion.current) setConnection({ ok: false, text: `${error.message} · 확인한 모델: ${settings.geminiModel || DEFAULT_GEMINI_MODEL}` });
    } finally { if (version === checkVersion.current) setChecking(false); }
  };

  const loadModels = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const list = await listGeminiModels(apiKey);
      setModels(list);
      onToast(list.length ? `쓸 수 있는 모델 ${list.length}개를 받았어요` : '쓸 수 있는 모델이 없어요');
    } catch (err) {
      onToast(err.message || '모델 목록을 받지 못했어요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="setrow col">
        <div className="set-title">설명을 만들 곳</div>
        <div className="set-note">
          문장 첨삭·번역·영상 설명에 사용해요. 자막으로 하는 학습은 키 없이도 됩니다.
        </div>
        <div className="pickrow-group">
          {[
            { id: PROVIDERS.GEMINI, label: 'Gemini', sub: '구글 · 무료 한도 있음' },
            { id: PROVIDERS.CLAUDE, label: 'Claude', sub: '유료 (쓴 만큼)' },
          ].map((o) => (
            <button
              key={o.id}
              className={`pickrow ai-pick${provider === o.id ? ' active' : ''}`}
              onClick={() => onChange({ aiProvider: o.id })}
            >
              <b>{o.label}</b><span>{o.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {gemini ? (
        <>
          <div className="setrow col">
            <label className="set-title" htmlFor="gemini-api-key">Gemini API 키 · 문장 생성·첨삭용</label>
            <div className="set-note">
              AI Studio에서 받은 생성용 키를 여기에 넣으세요. 문장 만들기·첨삭·번역·영상 설명에 사용하고, 읽기용 TTS 키는 대신 쓰지 않아요. 입력하면 자동으로 저장돼요.
              {' '}<a className="ghost-btn" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Gemini 키 만들기</a>
            </div>
            <input
              type="password"
              id="gemini-api-key"
              name="gemini-api-key"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={settings.geminiKey || ''}
              placeholder="생성용 Gemini API 키를 붙여넣으세요"
              onChange={(e) => onChange({ geminiKey: e.target.value.trim() })}
            />
            <div className="keystate">{apiKey ? '생성용 Gemini 키 저장됨 · 아래에서 연결을 확인하세요' : '아직 생성용 Gemini 키가 없어요'}</div>
          </div>

          <div className="setrow col">
            <div className="set-title">모델</div>
            <div className="set-note">
              안 고르면 추천 모델을 써요(문장 첨삭은 {DEFAULT_GEMINI_MODEL}, 궁금해요 질문은 가벼운 {FAST_GEMINI_MODEL}). 고르면 그 모델을 어디서나 써요.
            </div>
            {/* 이름을 손으로 치면 오타로 404가 난다 — 아래 목록에서 눌러서만 고른다 */}
            <div className="modelnow">
              <span>지금 쓰는 모델</span>
              <b>{settings.geminiModel || '추천(자동)'}</b>
              {settings.geminiModel && (
                <button className="ghost-btn modelreset" onClick={() => onChange({ geminiModel: '' })}>추천으로 되돌리기</button>
              )}
            </div>
            <button className="ghost-btn" disabled={!apiKey || loading} onClick={loadModels}>
              {loading ? '받는 중…' : '쓸 수 있는 모델 보기'}
            </button>
            {models.length > 0 && (
              <>
                {/* 추천 몇 개만 먼저. 나머지는 「전체 보기」를 눌러야 나온다 */}
                <div className="modellist modelrec">
                  {recommendModels(models).map((r) => (
                    <button
                      key={r.name}
                      className={`modelpick${settings.geminiModel === r.name ? ' on' : ''}`}
                      onClick={() => onChange({ geminiModel: r.name })}
                    >
                      <span className="modeltag">{r.tag}</span>
                      {r.name}
                    </button>
                  ))}
                </div>
                <button className="ghost-btn modelall" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? '전체 목록 접기' : `전체 ${models.length}개 보기`}
                </button>
                {showAll && (
                  <div className="modellist">
                    {models.map((m) => (
                      <button
                        key={m}
                        className={`modelpick${settings.geminiModel === m ? ' on' : ''}`}
                        onClick={() => onChange({ geminiModel: m })}
                      >{m}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button className="ghost-btn" disabled={!apiKey || checking} onClick={checkConnection}>
              {checking ? '연결 확인 중…' : 'Gemini 문장 첨삭 연결 확인'}
            </button>
            <div className="set-note">선택한 모델에 아주 짧은 문장 생성 요청을 보내요. API 사용량이 조금 발생할 수 있어요.</div>
            {connection && <p className={connection.ok ? 'set-note' : 'set-warn'} role={connection.ok ? 'status' : 'alert'}>{connection.text}</p>}
          </div>
        </>
      ) : (
        <div className="setrow col">
          <div className="set-title">Claude API 키</div>
          <div className="set-note">이 기기에만 저장되고 서버로 보내지 않아요.</div>
          <input
            type="password"
            value={settings.claudeKey || ''}
            placeholder="sk-ant-..."
            onChange={(e) => onChange({ claudeKey: e.target.value.trim() })}
          />
        </div>
      )}

      {/* 영상을 직접 듣게 하는 건 요금이 많이 든다. 기본은 꺼 두고, 알고 켜는
          사람만 쓰게 한다. Gemini만 유튜브를 볼 수 있어 Claude에서는 안 보인다. */}
      {gemini && (
        <>
          <Toggle
            label="영상에서 자막 직접 받아오기"
            sub={`Gemini가 영상을 ${TRANSCRIBE_MINUTES}분까지 듣고 받아 적어요`}
            on={Boolean(settings.videoTranscribe)}
            onClick={() => onChange({ videoTranscribe: !settings.videoTranscribe })}
          />
          <div className="setrow col">
            <div className="set-note">
              끄면 「Gemini 앱에 물어볼 말 복사」로 하시면 돼요 — 유튜브 자막을 그대로
              읽어 오고 요금이 안 듭니다.
              {' '}켜면 앱을 왔다갔다 안 해도 되는 대신 영상 10분에 3만 토큰쯤 써요.
              무료 한도가 금방 닳고, 사람이 만든 자막이 아니라 틀릴 수도 있습니다.
              {' '}자막이 아예 없는 영상에는 이쪽이 유일한 방법이에요.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

