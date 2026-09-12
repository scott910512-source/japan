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
export const ReviewTab = lazy(() => import('../screens/ReviewTab.jsx'));
export const Conjugate = lazy(() => import('../screens/Conjugate.jsx'));
export const Match = lazy(() => import('../screens/Match.jsx'));
export const Rpg = lazy(() => import('../screens/Rpg.jsx'));
export const Repeat = lazy(() => import('../screens/Repeat.jsx'));
export const Adverb = lazy(() => import('../screens/Adverb.jsx'));
export const WordManager = lazy(() => import('../screens/WordManager.jsx'));
