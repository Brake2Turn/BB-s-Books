# BB's Books

A phone web app (PWA) that catalogues BB's books by scanning a barcode or cover. Plain HTML, CSS and ES modules: no build step, no framework. See `README.md` for features and hosting.

## Design: follow the style guide for every UI change

All UI work (new screens, components, restyles, copy) must follow the **BB's Books design system**:

- Source of truth: https://claude.ai/artifact/E2SRwHZcNvsaeYF65ApfRD
- Snapshot in this repo: `design/README.md` (brand book), `design/tokens.json` (every token), `design/components/*.md` (one spec per component), `design/hero-screen.html` (reference render of the approved H3 screen).

Before writing UI code, read `design/README.md` and the spec for each component you touch. If the live guide has changed since the snapshot, refresh `design/` from it first.

Rules that are easy to break:

- **Tokens only.** Token names and values in the `:root` block of `styles.css` match `design/tokens.json` one-to-one. Add a token there (and note it in `DESIGN_DECISIONS.md`) rather than writing a raw value in a component.
- **One accent.** Cobalt (`--accent`) is for the scan button, the one primary action on a screen, progress fills, dots and the profile icon. Never use it as small text on the washes.
- **Glass vs. tint.** Glass goes over the washes. On the pure-white top zone, use the tint kit instead: tint chips, white fields with `--outline`, solid ledges. Home's chips switch automatically (`renderHome` in `js/app.js`).
- **Type.** Fraunces for what a reader would say out loud (app name, counts, book titles), never bold. Only the word "Books" in the app title is italic. Nunito Sans for everything else, 600 or heavier.
- **Covers.** Always 2:3, `--radius-cover`, cropped, never letterboxed. Use the six placeholder pairs, chosen by book ID. No badges, ratings or labels on covers.
- **Layout.** The wash background and white top zone sit behind every main screen. 20px gutters, a 3-column shelf grid with a ledge under each row, and the floating tab bar with Scan centred. The header has no profile button (the owner asked for it to be removed).
- **Celebration.** The add-to-library celebration is the one place the guide's "celebrate quietly" is deliberately exceeded, at the owner's request. Keep it to the guide's colours and voice, and don't add celebrations elsewhere.
- **Voice.** Short, warm, plain. Use "Reading", "Want to read" and "Finished". No exclamation marks, no emoji. Sentence case, except eyebrows and cover authors.
- **Accessibility.** AA contrast, 44px tap targets, and support for Reduce Transparency and Reduce Motion (see the end of `styles.css`).

Where the guide is silent (camera, sheets, the book page, motion), follow `DESIGN_DECISIONS.md`. Record any new judgement call there.

## Working on the code

- `js/app.js`: screens (Home, Stats, Feedback, Profile), shelves, book page, backup, feedback sending. `js/scan-flow.js`: scanner UI and add-to-library motion. `js/scanner.js`: camera, barcode and cover reading. `js/lookup.js` and `js/covers.js`: book data, cover-scan ranking and edition covers. `js/genres.js`: genre mapping. `js/cover-picker.js`: the row of possible covers. `js/db.js`: IndexedDB.
- When you add or rename a file the app loads, add it to `SHELL_FILES` in `sw.js` and bump `VERSION`.
- Async work in the scanner (lookups, cover reading) must check `session` in `js/scan-flow.js` before touching the screen, so results that arrive after the scanner closed are dropped. Network calls go through `getJSON` in `js/lookup.js`, which has a timeout.
- Run locally with `npx http-server -p 8080 .`. Open `/?demo` for a sample shelf that never touches the real library.
- Lint: `npx eslint --no-config-lookup --rule '{"no-unused-vars":"error"}' js/*.js sw.js`

## Feedback

The Feedback tab emails the owner through FormSubmit (`FEEDBACK_TO` in `js/app.js`). Don't put any other personal details in the code.
