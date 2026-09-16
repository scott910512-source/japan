import { lazy } from 'react';

// 화면을 처음 열 때 불러온다. 학습 데이터와 저장 형식은 그대로 유지한다.
export const StudyHub = lazy(() => import('../screens/StudyHub.jsx'));
export const Log = lazy(() => import('../screens/Log.jsx'));
export const Study = lazy(() => import('../screens/Study.jsx'));
export const Settings = lazy(() => import('../screens/Settings.jsx'));
export const Videos = lazy(() => import('../screens/Videos.jsx'));
export const NewPassword = lazy(() => import('../screens/NewPassword.jsx'));
export const WordDeck = lazy(() => import('../screens/WordDeck.jsx'));
export const Basics = lazy(() => import('../screens/Basics.jsx'));
export const GrammarHub = lazy(() => import('../screens/GrammarHub.jsx'));
export const Situations = lazy(() => import('../screens/Situations.jsx'));
export const Translate = lazy(() => import('../screens/Translate.jsx'));
export const Quiz = lazy(() => import('../screens/Quiz.jsx'));
export const Listen = lazy(() => import('../screens/Listen.jsx'));
/* 복습 탭 — 오늘 복습·틀린 문제·약점·전체 복습이 한 곳에 */
export const ReviewHub = lazy(() => import('../screens/ReviewHub.jsx'));
/* 듣기 고르기 — 학습 탭 「듣기」 칸이 연다 */
export const ListenHub = lazy(() => import('../screens/ListenHub.jsx'));
export const Conjugate = lazy(() => import('../screens/Conjugate.jsx'));
export const Match = lazy(() => import('../screens/Match.jsx'));
export const Rpg = lazy(() => import('../screens/Rpg.jsx'));
export const Repeat = lazy(() => import('../screens/Repeat.jsx'));
export const Adverb = lazy(() => import('../screens/Adverb.jsx'));
export const WordManager = lazy(() => import('../screens/WordManager.jsx'));
// 곁가지 — 일본어 회독과 무관하다. 기록에 안 붙는다.
export const SwissCourse = lazy(() => import('../screens/SwissCourse.jsx'));
/* 한 권으로 끝내는 N3 — 자료가 크다(문법 87꼭지·한자 300자·독해·청해). 열 때만 받는다. */
export const N3Course = lazy(() => import('../screens/N3Course.jsx'));
