import { GUIDES } from './hunterTheme.js';
import satotsu from '../assets/hunter/characters/satotsu.gif';
import wing from '../assets/hunter/characters/wing.gif';
import zushi from '../assets/hunter/characters/zushi.gif';
import hanzo from '../assets/hunter/characters/hanzo.gif';
import menchi from '../assets/hunter/characters/menchi.gif';
import buhara from '../assets/hunter/characters/buhara.gif';
import netero from '../assets/hunter/characters/netero.gif';
import canary from '../assets/hunter/characters/canary.gif';

// These are learning roles and original app dialogue, not quotations from the series.
// Companion selection stays in GUIDES; lesson teachers are selected by context.
export const TUTORS = Object.fromEntries([
  ...GUIDES,
  { id: 'satotsu', name: '사토츠', role: '수련 안내', portrait: satotsu },
  { id: 'wing', name: '윙', role: '기초 원리 선생님', portrait: wing },
  { id: 'zushi', name: '즈시', role: '함께 배우는 동료', portrait: zushi },
  { id: 'hanzo', name: '한조', role: '집중 퀴즈 파트너', portrait: hanzo },
  { id: 'menchi', name: '멘치', role: '식당 회화 선생님', portrait: menchi },
  { id: 'buhara', name: '부하라', role: '음식 표현 파트너', portrait: buhara },
  { id: 'netero', name: '네테로', role: '시험과 성장 기록', portrait: netero },
  { id: 'canary', name: '카나리아', role: '정중한 표현 안내', portrait: canary },
].map((t) => [t.id, t]));

export const HUNTER_SCENES = {
  island: { name: '기린섬', label: '함께 떠나는 수련' },
  arena: { name: '하늘투기장', label: '원리를 익히는 수련' },
  city: { name: '요크신', label: '실생활 표현 연구' },
  cards: { name: '그리드 아일랜드', label: '한 장씩 쌓는 지식' },
  exam: { name: '헌터시험장', label: '배운 것을 확인하는 도전' },
};

// Only use this on teaching text / submitted answers, never an unanswered quiz.
export function conversationTutor(text = '') {
  if (/食|飲|料理|注文|メニュー|レストラン|ラーメン|弁当|ご飯|お箸|식당|음식|주문|먹|마시/.test(text)) return 'menchi';
  if (/ください|お願いします|いただ|ませんか|てもいい|정중|허락|부탁|거절/.test(text)) return 'canary';
  return 'leorio';
}

export function questionTutor(text = '') {
  if (/한자|유래|부수|구조|漢字/.test(text)) return 'kurapika';
  if (/문법|조사|활용|に와|で와|は와|が와/.test(text)) return 'wing';
  return conversationTutor(text);
}
