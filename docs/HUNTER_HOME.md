# 日本語 HUNTER home

The existing learning engines are retained. The home has three panes (Today, Map, Record); the wrong-answer pane was removed because the notebook lives in one place, the Review screen (see "One review screen"). The Today pane contains:

- Daily quests from the existing frozen daily plan and resumable session.
- Six explorable regions with 18 real routes into the existing courses and practice screens.
- Hunter XP, level, license and six badges derived from saved learning achievements.
- Grammar, vocabulary, listening and conversation learning indicators. Unmeasured areas show a dash; these are not official JLPT grades.
- The existing N4 grammar diagnosis (15 questions), N3 lessons, kanji structure/origin/mnemonic cards, review and mock exams.
- Five selectable character guides with actual character artwork. Selection uses the existing settings backup/sync path.

## Data and rewards

`src/lib/hunter.js` derives rewards from unique records in `review` and `progress`.
The same card, lesson, scenario or test cannot grant more XP through repetition.
There is no new reward counter, database migration or replacement of existing progress.
Self-reported known cards do not grant first-study XP.

The map is a suggested learning order and allows free exploration for personal study.
Opening a region does not mark it complete. Learning and completion stay with the existing engines.

Three different measures — never mix them up:

| Measure | Meaning | Where |
| --- | --- | --- |
| Hunter XP / level | reward for learning activity; never clears a region | `lib/hunter.js` |
| Region promotion | required training + promotion exam | `lib/regions.js` |
| N3 readiness | N3 course area records | `lib/n3.js` `readinessOf` |

## Growth map (`lib/regions.js`)

Goals, required training, the promotion exam and pass criteria for all six regions live in
`REGION_RULES`; the map (`GrowthMap.jsx`) only draws what `evaluateRegions` returns, so the
numbers on screen always equal the counted records.

- Required training is counted from existing records, so existing users keep their progress:
  confirmed words per level (`level >= 1`, i.e. met again on another day and answered correctly;
  merely opened/seen cards and self-declared known cards are not counted), basic-grammar topics
  (`progress.grammarDone`), cleared role-play stages, N3 course chapters/tracks/overall progress
  (loaded lazily on the map pane with the same functions the course uses).
- Promotion exam: N3 regions reuse the course tests already recorded in `progress.n3.tests`
  (`t:ch0`, `t:ch1`, `exam`; mock exam passes at 60%). N5/N4 regions have a region check quiz made of
  already-seen words of that level (`progress.regions[id].exam`, best/last/tries; merged with max so repeated sync
  never inflates). Pass is 80% unless the rule says otherwise.
- States: `train` → required training incomplete (exam closed) · `exam` → training done, no exam taken
  ("실력 확인 전") · `retry` → taken but below pass · `cleared` → training done and exam passed.
  A pass recorded before the training was complete still counts once the training is complete.
- Free exploration is kept (folded "자유 탐험" list), clearly separated from formal clear.
  Opening an N5/N4 region's level-bound screens (words, conjugation, stream, match, quiz) overrides
  the level filter only for that screen; the saved settings are not changed.

## Theme

Theme content lives in `src/data/hunterTheme.js`, its layout in `HunterDashboard.jsx`,
and styles in `src/styles/hunter.css`. Character asset attribution is in
`src/assets/hunter/characters/SOURCES.md`. Assets are bundled and included in offline precaching.

## Validation

`test/logic/hunter.mjs` checks rewards, repeat protection, level thresholds and non-mutating derivation.
`test/ui/hunter-ui.js` opens the real app with isolated test records and checks map selection,
kanji/diagnosis routes, guide saving, badges and home layout.

The full existing UI suite is divided across four CI runners using `--shard=0/4` through `3/4`.
Each test file belongs to exactly one shard; failure of any shard fails the workflow.
No existing checks are removed.

## Remembering mistakes

`progress.mistakes` stores the question, exact selected answer, correct answer,
explanation and content reference when an answer is finalized. Word quizzes,
Stream Quiz, N3 lessons/tests and sentence building/cloze/writing report to it.
The existing progress backup and account sync include this notebook via `mergeMistakes`.

Home and Review show a shared notebook with direct relearning links and a retest.
New word tests reserve slots for unresolved mistakes; N3 tests and mock exams also
prioritize missed questions and related content. Correct practice on two distinct
dates marks recovery, then schedules a check seven days later. Practiced items move
behind older pending items so one difficult question does not monopolize practice.

## One review screen

`Review` (Review & My record) is the single review entry with three areas:

1. Today's review — today's quota vs backlog (counts from `reviewLeftOf`), sentence review and full review.
2. Retake wrong answers — question, my answer, correct answer, explanation, relearn link, retest and the
   N3 course wrong-answer notebook (`WrongBook`).
3. Focus on weak points — weak words / weak grammar with reasons (`WeakHub`), weak quiz (a different question set),
   weak-first deck, weak grammar.

Today shows a short "오답 복습 N문제 시작" shortcut that opens the wrong-answer area. `wrongbook` / `weakbook`
routes still exist and open the same screen on the matching area. Units are explicit and never summed across kinds:
problems for wrong answers, words/grammar items for weak points.

### Linking records (`lib/retestlink.js`)

A retest in the wrong-answer notebook (`attempt.retest`) is applied once to all three stores:

- `progress.mistakes` (as before: correct on two distinct dates after the last wrong = solved, then a 7-day check),
- `progress.weak` for word refs (`quiz-right` lowers the weak score by 1, `quiz-wrong` raises it — one correct
  answer never wipes all weaknesses),
- `progress.n3.wrong` for N3 questions (same rule as the course: two correct in a row removes; a wrong resets).

`retestKey` makes a repeated delivery of the same answer a no-op (double click, retry, resent after sync).
Attempts from the existing quizzes never touch the weak ledger here, because those screens already report to it.
Stores are intentionally not merged and SRS intervals are untouched. Completion criteria by store:

| Store | Done / removed when |
| --- | --- |
| New wrong-answer notebook | correct on two distinct dates after the last wrong; checked again 7 days later |
| N3 course wrong answers | two correct in a row (a wrong resets the streak) |
| Weak ledger | each correct lowers the score by 1; leaves the weak list when error signals fall below the threshold |
| Review records | confirmed on review days only; one level per day |

Status labels (`mistakeStatus`) explain why an item is still there, e.g. "오답 해결 · 기억 확인 복습 2026-11-10 예정".

## Validation (growth map and review)

`test/logic/regions.mjs` (evaluation from existing records, exam states, merge idempotence, retest linking and dedupe)
and `test/ui/growth-map-ui.js` (map numbers, N5-only opening, shortcut, three areas, record linking, mobile width).
