# AI4POKER UI

## Product surface

A Chinese-language poker learning and practice tool. Preserve the dark background, green felt, real local game engine, beginner guide, configurable 2–8 player tables and recap. Prioritize understanding decisions over decorative effects. Do not present heuristic advice as solver-verified GTO.

## Visual system

- Neutral charcoal page #111318 and slate surfaces #1c2028. Main text #f4f3ef, secondary #aab1bd.
- Home practice settings use a warm off-white panel with dark text, visibly separated from the dark introduction.
- Green/teal is reserved for table felt. Primary action and current opponent: amber #e9c07a. Hero and calls: blue. Folds: red. Checks: slate. Coach: violet.
- Action meaning is always written in text and amount, never communicated only with color. Keep player action badges visible even when a folded player's cards/pod are dimmed.
- Preserve last actions across streets, explicitly label earlier-street actions, and keep an ordered history of the current hand. Opponent thinking must not cover the history.
- Warm ivory face-up cards, slate-blue backs. Chinese system font stack with tabular numeric controls.
- Restrained 10–16px surface radii and consistent spacing. Use contrast and typography to organize information.

## Composition

- Desktop setup: instructional introduction and clear tutorial action on the left, configurable practice controls on the right.
- Mobile setup: introduction and tutorial first, practice settings directly below.
- Game: table and action dock inside one viewport, with adjacent coach/history/guide tabs on desktop. A single viewport table and action dock on mobile, with native information dialogs for the coach, guide and recap.
- Home tutorial action is amber; table actions have distinct semantic colors and written labels. A dedicated turn indicator separates current activity from the latest completed action.
- All existing settings remain functional. Sound controls, volume, pause and live speed selection are available in the table toolbar. Audio must remain optional and must not replace visible feedback.

## References inspected (2026-10-18)

- https://mobbin.com/ — public examples and screen/flow organization, including its displayed onboarding and learning-app examples. Adapt the principle of contextual guidance and clear progression. Paid flow libraries were not accessed.
- https://ui.shadcn.com/ — inspected live components, typography hierarchy, segmented choices, switches and primary/secondary button treatments. Implemented with existing React/Tailwind dependencies; no new UI package added.

These are practical references, not a claim that a single website has a verified popularity ranking. The interface retains AI4POKER's own colors, content and behavior.

- Player seats use one compact pod: name/remaining stack, last action with street context, actual contribution for raises, current street total and hand total. Fold labels retain full contrast.
- Table never scrolls to reveal primary actions. Detailed information scrolls inside the sidebar/dialog. On small screens opening information pauses play and closing restores its previous state.
- Speed presets are 1.0 / 2.0 / 3.2 seconds (fast / normal / slow).

## Concise coaching refinement

- Default coach: one recommendation, one reason, call cost / estimated share / remaining BB. Range assumptions and alternatives are disclosed on demand. Recap shows the chosen action and a short explanation before optional details.
- Seats show an explicit action and its total, followed by current-round and hand contributions. Removed the duplicate added-chips row. Semantic left borders replace filled action boxes.
- Use warm white for coaching recommendations; reserve violet for optional accents rather than a large competing panel.

## Amount badges and expanded default analysis

- Seat action text and amount are separate: warm chip badges for bets/raises, blue for calls and neutral for blinds. “加注至” uses the round target; “跟注 +” uses the chips added. Round and hand totals remain below.
- Coach reasoning (cost, position/depth and range evidence) is visible by default. Detailed opponent combinations and alternatives stay expandable. Recap also exposes the original cost context before expanded details.

## Home cover · 2026-10-19

- Dark editorial cover with oversized AI 4 POKER typography, champagne gold accents and code-native playing cards. No image downloads or new dependencies.
- Keep existing practice choices on the right; remove only the home sound setting. Preserve stored sound preferences and in-game controls.
- Compact desktop spacing verified at 1280×720 and 1366×768 with no document overflow. Mobile stacks the cover and settings without horizontal scrolling.
- Footer credit: made by 秦睿涵Ryan.

## Town-inspired cover and separate setup · 2026-10-19

- Inspected https://www.siteinspire.com/website/13643-town visually. Adapted its warm light canvas, large serif statements, opposite-corner composition and space around a central entry action; retained original poker graphics and branding.
- Home headline: “Learn how to play with AI, then play your opponents.” The cover exposes one central “start playing” action.
- Flow: cover → settings → game. Settings retain all existing practice choices and the beginner lesson. Game return goes directly to settings and preserves the last configuration. Footer credit remains on both pages.
- Mobile cover checked at 320×568 with no overflow; desktop cover/setup checked at 1280×720. Settings use a vertical mobile layout, with beginner entry after the configuration.
