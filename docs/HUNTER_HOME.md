# 日本語 HUNTER home

The existing four tabs and learning engines are retained. The Today tab now contains:

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
