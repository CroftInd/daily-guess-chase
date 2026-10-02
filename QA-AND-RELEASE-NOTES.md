# Daily Guess — polished release

This release includes the full feature set requested in the project conversation plus a visual polish pass.

## Visual polish
- Responsive glass-style navigation and cards
- Gradient hero treatment and improved hierarchy
- Animated buttons, progress bar, score reveal, answer reveal, achievement cards and countdown
- Improved hover/focus states
- Mobile layout refinements
- Reduced-motion accessibility support
- Visual emphasis for perfect 16/16 days

## Hardening fixes included
- Submission player-name LIKE escaping corrected
- Leaderboard personal-best aggregation corrected
- Existing secure-video, daily-draw, repeatable-challenge and poster-transition fixes retained

## Validation
- ZIP contents checked after packaging
- TypeScript parser check performed with the globally available compiler; dependency/type-resolution errors remain when node_modules is absent in the sandbox, but no new syntax errors were reported in the project source
- A full npm install/build could not be completed in the sandbox because package installation timed out
