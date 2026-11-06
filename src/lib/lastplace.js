/* 마지막에 있던 자리를 기억해 두었다가, 앱이 다시 떠도 거기서 이어서 연다.
 *
 * 이 앱에는 주소가 없다. 그래서 폰이 메모리가 모자라 앱을 내렸다가 다시 올리면(다른 앱을 쓰다 오랜만에 돌아온 때) 어디에 있었든
 * 늘 홈으로 돌아왔다. 어디에 있었는지를 저장소에 적어 두고, 오래되지 않았으면 그 자리로 연다.
 *
 * 너무 오래된 것은 쓰지 않는다. 다음 날 아침에 앱을 열었는데 어제 저녁 화면이 뜨면 「오늘 퀘스트」가 있는 홈으로 못 온다.
 * 그래서 6시간 안이고 같은 날일 때만 잇는다. 회독 판(deck)은 따로 「하던 학습 이어하기」가 있어서 여기서 다루지 않는다. */
import { todayKey } from './review.js';

export const PLACE_KEY = 'jp_nav_v1';
export const PLACE_MAX_AGE = 6 * 60 * 60 * 1000;
const TABS = ['home', 'study', 'me', 'settings', 'videos'];

const ok = (v) => (v == null || typeof v === 'object' || typeof v === 'string');

/* 저장돼 있던 자리를 돌려준다. 없거나 낡았거나 모양이 이상하면 null(= 홈에서 시작) */
export function readPlace({ now = Date.now(), today = todayKey(), validSubs = null, storage = globalThis.localStorage } = {}) {
  try {
    const raw = storage?.getItem(PLACE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    if (typeof p.at !== 'number' || now - p.at > PLACE_MAX_AGE || now < p.at - 60000) return null;
    if (p.day !== today) return null;
    const tab = TABS.includes(p.tab) ? p.tab : 'home';
    const sub = typeof p.sub === 'string' && (!validSubs || validSubs.includes(p.sub)) ? p.sub : null;
    const parent = sub && typeof p.parent === 'string' && (!validSubs || validSubs.includes(p.parent)) ? p.parent : null;
    if (tab === 'home' && !sub) return null;
    return {
      tab, sub, parent,
      n3View: ok(p.n3View) ? p.n3View ?? null : null,
      swissView: ok(p.swissView) ? p.swissView ?? null : null,
      listenMode: p.listenMode === 'shadow' ? 'shadow' : 'listen',
    };
  } catch { return null; }
}

export function writePlace({ tab, sub, parent, n3View, swissView, listenMode }, { now = Date.now(), today = todayKey(), storage = globalThis.localStorage } = {}) {
  try {
    storage?.setItem(PLACE_KEY, JSON.stringify({ tab, sub, parent, n3View, swissView, listenMode, at: now, day: today }));
  } catch { /* 저장 못 해도 이번 접속은 계속된다 */ }
}
