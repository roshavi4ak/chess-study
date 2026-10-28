# Collectible card illustrations

The collection uses a shared storybook cartoon style: expressive chess characters, friendly animal opponents, magical chess landscapes and warm lighting. Each supported tactical theme has a scene built around its motif. The defensive/defensiveMove and quiet/quietMove aliases share their respective illustrations.

## Assets

- 109 illustrations in `public/img/cards/`: 48 tactical scenes, 8 animals, 8 learning worlds, 32 opening scenes (29 named openings plus 3 fallbacks), 12 additional activities and 1 tournament scene.
- WebP delivery files are 640 × 640 pixels. Next Image supplies responsive sizes and lazy loading in the collection.
- `public/img/cards/full/` contains 109 additional WebP images at the original generated resolution. These load only when a viewer is opened, so zooming uses more detail without increasing the collection's initial image payload.
- All artwork was generated with the built-in `image_gen` tool. Exact prompts are saved in `docs/card-art-prompts.json`, `docs/activity-card-art-prompts.json` and `docs/new-opening-card-art-prompts.json`.
- `src/lib/cardArtwork.ts` selects artwork by card kind and theme. All 29 current opening practices have distinct illustrations matched by English and Bulgarian names. Unknown future practices and tags have a valid fallback.

## Presentation

`MasteryCardView` gives the illustration the full card width, adds metallic tier frames and one/two/three stars, and keeps the translated name, tier and progress visible. Unlocked (earned) cards show full-color artwork; locked cards show black-and-white artwork. The same rule applies in the fullscreen viewer. Hover movement respects reduced-motion preferences. The same artwork persists as a card progresses through its tiers.

Click or activate an illustration to open `CardArtworkDialog`, a native modal filling the viewport. Zoom buttons and the +/− keys adjust from 100% (fit) to 400%; Fit or 0 resets the view. Zoomed artwork scrolls in either direction. Close or Escape dismisses the modal, restores page scrolling and returns focus to the opening button. The native dialog keeps background controls inert while open.

Every card has a separate, locale-aware Start link. Practice cards open their exact drill, theme cards open matching puzzles, bot cards request their exact opponent (while respecting the opponent ladder), world cards open their world, and other cards open their activity. Race and duel links target the appropriate part of the lobby; tournaments and team goals require the child to choose an event or goal.

## Activity coverage and progress

The catalog currently includes 108 cards: 29 opening practices, 50 supported puzzle-theme labels, 8 animals, 8 mini-game worlds, 1 tournament card and 12 other activities. Practices and supported themes are visible while unstarted. Certificates and the collection itself are achievement pages rather than activities.

The additional activities are puzzles, endgames, defense, streaks, coordinates, solo chess, notation, club races, duels, level training, teamwork and full games. Most use bronze/silver/gold for completion on 3/5/10 distinct Sofia calendar days. Same-day replays count once. Puzzles require a successful solve; endgames require reaching the goal; defense and solo chess accept completed rounds with help; streaks, coordinates, notation and level practice require a positive score; level tests require a pass; races and duels reward participation in completed events. Teamwork uses actual contributions to 1/3/5 distinct team challenges or club goals; manual bonus points do not create automatic personal credit.

Existing tracked activity contributes immediately. Full Lichess games played through `/play` begin recording completion with this change, including draws and losses after at least two half-moves. Reconnecting to a recorded game is deduplicated. This reuses the existing PlaySession storage and requires no database migration.

## Preview

Run `node scripts/preview-card-art.cjs` for Bulgarian or append `en` for English. This renders the real component with sample progress into `docs/card-art-preview-bg.html` or `docs/card-art-preview-en.html`, alongside its JavaScript bundle. Open either HTML file in a browser to try the viewer, zoom controls and Start links. The preview uses `docs/card-practice-catalog.json`, a snapshot of current practice names and IDs, and reads artwork in `public/img/cards/`; it does not require a signed-in student session. The real collection reads the current database catalog, not this snapshot.

The preview is a local review artifact. Production deployment is separate.

## Verification

- All 109 thumbnail and 109 fullscreen WebP files exist. Thumbnails are 640 × 640. The 36 newly generated illustrations were visually reviewed in `docs/new-card-art-contact.webp`.
- All 50 supported skill-theme labels resolve to specific themed artwork (including the two aliases).
- TypeScript and targeted ESLint checks passed. The component diff passes whitespace checks.
- Both language previews render 108 cards plus four tier examples. The Bulgarian browser preview loaded all 112 images with no failures and every card has a Start link at least 44px tall. A Start link was clicked and opened the intended Bulgarian notation activity.
- Browser layout checks passed at 390px in light mode and 1280px in dark mode, with no overflowing card names or horizontal page overflow. Reduced-motion mode produces a zero-duration hover transition.
- The complete artwork was visually reviewed in `docs/card-art-contact-1.webp` and `docs/card-art-contact-2.webp`.
- Viewer interactions were checked in the browser on desktop and a 390 × 844 phone viewport: source-resolution image loading, zoom buttons and bounds, Fit, keyboard zoom/reset, closing with Close and Escape, scroll restoration and focus restoration. Keyboard zoom also works after a focused zoom button becomes disabled at its limit. The corrected color rule is full color for unlocked cards and monochrome for locked cards, in both the collection and viewer.
- `node --test scripts/test-card-activities.cjs`: 11 checks passed, including completion rules, day boundaries, full catalog loading, private progress scoping, signed-out behavior, link targets, and distinct artwork for all 29 practices. Existing review-schedule and fun-mode regression checks also passed.
