# BB's Books

A phone web app (PWA) that catalogues BB's books by scanning a barcode or cover. Plain HTML, CSS and ES modules: no build step, no framework. See `README.md` for features and hosting.

## Design: follow the style guide for every UI change

All UI work (new screens, components, restyles, copy) must follow the **BB's Books design system**:

- Source of truth: https://claude.ai/artifact/E2SRwHZcNvsaeYF65ApfRD
- Snapshot in this repo: `design/README.md` (brand book), `design/tokens.json` (every token), `design/components/*.md` (one spec per component), `design/hero-screen.html` (reference render of the approved H3 screen).

Before writing UI code, read `design/README.md` and the spec for each component you touch. If the live guide has changed since the snapshot, refresh `design/` from it first.

Rules that are easy to break:

- **Tokens only.** Token names and values in the `:root` block of `styles.css` match `design/tokens.json` one-to-one. Add a token there (and note it in `DESIGN_DECISIONS.md`) rather than writing a raw value in a component.
- **One accent.** The accent (`--accent`; cobalt by default, or the colour she picks in Profile → Appearance) is for the scan button, the one primary action on a screen, progress fills, dots and the profile icon. Never use it as small text on the washes. Never write the cobalt hex in a component: use `--accent`, or `rgba(var(--accent-rgb), a)` for tinted shadows, so the accent choice reaches it. Any new accent choice must pass AA both ways (see `DESIGN_DECISIONS.md`).
- **Glass vs. tint.** Glass goes over the washes. On the pure-white top zone, use the tint kit instead: tint chips and white fields with `--outline`. Home's chips switch automatically (`renderHome` in `js/app.js`).
- **Shelf ledges are plain white**, not glass, at the owner's request: `--white`, `--outline` and `--shadow-ledge-plain`, no blur.
- **Type.** Fraunces for what a reader would say out loud (app name, counts, book titles), never bold, never italic. The app title "BB's Books" is one style throughout (the owner asked for this; it replaces the guide's italic "Books"). Nunito Sans for everything else, 600 or heavier.
- **Covers.** Always 2:3, `--radius-cover`, cropped, never letterboxed. Use the six placeholder pairs, chosen by book ID. No badges, ratings or labels on covers, except the owner's loaned-out dot (`.loan-dot`, top right).
- **Layout.** The wash background and white top zone sit behind every main screen. 20px gutters, a 3-column shelf grid with a ledge under each row, and the floating tab bar with Scan centred (Home, Games, Scan, Feedback, Profile). Profile is a hub of rows (Stats, Backup, Appearance, Settings); each opens its own screen with a back button, and the Profile tab stays lit. The header has no profile button (the owner asked for it to be removed). The app opens on the start-up greeting (`initSplash` in `js/app.js`): keep it button-free. Every tab shows the book count on the title's row, right-aligned (`.header-count`). Home filters are one compact row of dropdown pills (status, genre, sort), not chips; keep it that way.
- **Celebration.** The add-to-library celebration is the one place the guide's "celebrate quietly" is deliberately exceeded, at the owner's request. It stays until she taps, then plays the start-up ripple (`js/ripple.js`, shared). Milestones (1st, 5th, 10th, 25th, 50th, 100th, then every 100th book) use gold confetti and a gold headline (`--gold-*` tokens, only ever used here). Keep it to the guide's voice, and don't add celebrations elsewhere. The wheel's pick reuses the cover spring and shine, but has no confetti.
- **Voice.** Short, warm, plain. Use "To be read", "Reading", "Finished" and "Did not finish" (the owner renamed "Want to read"; the saved value is still `want`). No exclamation marks, no emoji. Sentence case, except eyebrows and cover authors.
- **Accessibility.** AA contrast, 44px tap targets, and support for Reduce Transparency and Reduce Motion (see the end of `styles.css`).

Where the guide is silent (camera, sheets, the book page, motion), follow `DESIGN_DECISIONS.md`. Record any new judgement call there.

## Working on the code

- `js/app.js`: screens (Home, Stats, Feedback, Profile), shelves, book page, backup, feedback sending. `js/scan-flow.js`: scanner UI and add-to-library motion. `js/scanner.js`: camera, barcode and cover reading. `js/lookup.js` and `js/covers.js`: book data, cover-scan ranking and edition covers. `js/genres.js`: genre mapping. `js/cover-picker.js`: the row of possible covers. `js/ripple.js`: the tap ripple. `js/sound.js`: the scan chime and wheel tick. `js/games.js`: Spin the wheel and Book shower (matter.js from `vendor/matter/`, loaded on demand). `js/db.js`: IndexedDB.
- When you add or rename a file the app loads, add it to `SHELL_FILES` in `sw.js` and bump `VERSION`.
- Async work in the scanner (lookups, cover reading) must check `session` in `js/scan-flow.js` before touching the screen, so results that arrive after the scanner closed are dropped. Network calls go through `getJSON` in `js/lookup.js`, which has a timeout.
- Run locally with `npx http-server -p 8080 .`. Open `/?demo` for a sample shelf that never touches the real library.
- Lint: `npx eslint --no-config-lookup --rule '{"no-unused-vars":"error"}' js/*.js sw.js`

## Branches and deploying (a real user is on the live app)

- **Live branch: `main`.** GitHub Pages publishes `main` at https://brake2turn.github.io/BB-s-Books/. Every push to `main` reaches BB's phone within minutes. (`claude/happy-fermi-c9vv82` was the original build branch and published the app until October 2026. It holds the same code as `main`. Don't build on it, and don't delete it until Settings → Pages is confirmed to be on `main`.)
- **Work on a feature branch** made from `main` (for example `feature/<topic>`), unless the session names a different one. Never push to `main` without the owner's explicit OK. Don't open pull requests unless asked.
- **Going live** = merging the tested feature branch into `main`, with the owner's OK. Bump `VERSION` in `sw.js` in any change to shipped files, or phones keep the old cached code.

## Tests

- `tests/run-all.sh` runs every browser test (about 3 minutes). `tests/run-all.sh <name>` runs one. Run the whole suite before anything goes live, and add or extend a test for each new feature.
- They drive the real app in headless Chromium (Playwright is installed globally; `tests/pw.mjs` finds it). Each run uses a fresh profile, a fake camera (`tests/.fixtures/barcode.y4m`), mocked Google Books / Open Library / cover responses, and port 8123. `make-fixtures.sh` builds the fixtures on first run (needs python3 with Pillow, and ffmpeg). They are not committed.
- A test passes when it exits 0 and prints the line `errors: []`. Print an `errors:` array the same way in new tests.
- `data-safety` is the one that matters most. It covers upgrades from older libraries, restores, backups, automatic copies, and a library shaped like BB's current one. Extend it with every data change.
- Gotchas:
  - In Playwright, the route registered last wins.
  - `context.setOffline` doesn't reach the service worker, so `offline.mjs` stops the server instead.
  - Don't use a fake clock around animations.
  - When killing stray servers, use `pkill -f '[h]ttp-server'` so the pattern doesn't match your own shell.

## Her library's data: never lose it

The library lives in IndexedDB on her phone, separate from the code, so deploying new code never touches it. Keep it that way:

- **Same address.** The app must stay at https://brake2turn.github.io/BB-s-Books/. Browser storage belongs to an address, so renaming the repo, moving host or adding a custom domain opens an empty library. If a move is unavoidable, she must back up first and restore after.
- **Database changes are additive.** Read the rules at the top of `js/db.js`: never rename the database or the `books` store, and never delete or clear anything in an upgrade.
- **Record changes are additive.** Change a book's shape only in `normaliseBook` in `js/app.js`, and bump `DATA_VERSION` when you do. `protectLibrary` saves an automatic copy before upgrading, and unknown fields are always kept.
- **Automatic copies.** Up to 5 (`KEEP_SNAPSHOTS`). The newest copy's time and fingerprint live in the `meta` store as `lastSnapshot`, so launch never reads the copies. Keep it that way.
- **Restores merge.** "Add books from a backup" never deletes books. The newer copy of a book wins (`updatedAt`). Whole-library rollback is only through Profile → Automatic copies, which saves today's library first.
- **Test with an old library.** Before shipping a data change, open the app over a library saved by the previous version and check nothing is lost.

## Current state (October 2026)

Everything the owner has asked for so far is built and live, and all tests pass:
- start-up greeting and ripple
- Home with the reading card, search and dropdown filters
- plain white shelves and the count on every tab
- Stats, Feedback and Profile (backup, merge restore, automatic copies)
- barcode and cover scanning, the edition cover picker and genres
- the tap-to-continue celebration with gold milestones

`DATA_VERSION` is 3, the database version is 2 and `sw.js` is at `v13` on `main`. BB has installed it to her home screen and has a good number of books in it.

On `feature/content-v2` (not live yet):
- To be read (renamed from Want to read), Did not finish, Physical / Audiobook for finished books, author sort by surname, and the scan chime (`js/sound.js`).
- The cover picker changes the cover at once and keeps its scroll position.
- The Games tab (Spin the wheel, Book shower) in place of Stats.
- Profile as a hub (Stats, Backup, Appearance with accent colours, Settings).
- Lending (loaned-out marking, filter, sort and cover dot).

That branch takes `DATA_VERSION` to 4 (adds `format`, `loaned`, `loanedTo` and `loanedAt`; one bump, since 4 never went live) and `sw.js` to `v15`.

## Feedback

The Feedback tab emails the owner through FormSubmit (`FEEDBACK_TO` in `js/app.js`). Don't put any other personal details in the code.
