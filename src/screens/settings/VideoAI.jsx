import { useState } from 'react';
import Toggle from './Toggle.jsx';
import {
  DEFAULT_GEMINI_MODEL, PROVIDERS, TRANSCRIBE_MINUTES,
  listGeminiModels, resolveProvider,
} from '../../lib/videoTutor.js';

/* 영상 설명을 만들 곳.
 *
 * Gemini 키는 음성 키와 같은 구글 API 키 형식이라, 따로 넣지 않으면 그 키를
 * 그대로 쓴다 — 같은 키를 두 번 넣게 할 이유가 없다.
 * 모델 이름은 자주 바뀐다. 내가 적어 둔 값이 낡으면 404가 나는데, 그때 왜 안
 * 되는지 알 길이 없으니 키로 목록을 직접 받아 고를 수 있게 해 둔다. */
export default function VideoAI({ settings, onChange, onToast }) {
  const { provider, apiKey, borrowed } = resolveProvider(settings);
  const gemini = provider === PROVIDERS.GEMINI;
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);

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
          자막으로 하는 학습은 키 없이도 됩니다. 뜻·문법 설명을 만들 때만 씁니다.
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
            <div className="set-title">구글 API 키</div>
            <div className="set-note">
              {borrowed
                ? '아래 음성 키를 그대로 쓰고 있어요. 그 키가 붙은 구글 프로젝트에서 Generative Language API를 켜 두어야 통합니다. 다른 키를 쓰려면 여기 넣으세요.'
                : '비워 두면 아래 음성 키를 그대로 씁니다. 키는 이 기기에만 저장돼요.'}
            </div>
            <input
              type="password"
              value={settings.geminiKey || ''}
              placeholder={settings.gttsKey ? '비우면 음성 키를 씁니다' : 'AIza...'}
              onChange={(e) => onChange({ geminiKey: e.target.value.trim() })}
            />
          </div>

          <div className="setrow col">
            <div className="set-title">모델</div>
            <div className="set-note">
              비우면 기본값을 씁니다. 이름이 맞지 않으면 아래에서 목록을 받아 고르세요.
            </div>
            <input
              value={settings.geminiModel || ''}
              placeholder={DEFAULT_GEMINI_MODEL}
              onChange={(e) => onChange({ geminiModel: e.target.value.trim() })}
            />
            <button className="ghost-btn" disabled={!apiKey || loading} onClick={loadModels}>
              {loading ? '받는 중…' : '쓸 수 있는 모델 보기'}
            </button>
            {models.length > 0 && (
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

