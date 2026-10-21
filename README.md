# BB's Books

A personal library for BB's books. Scan a book's barcode or its front cover to put it on the shelf. Tap a cover to open it full size, read the blurb, give it a rating out of five and write a review.

It's a web app you install on a phone's home screen. There's no app store, no account and no server. The library is saved on the phone itself.

## How it works

| | |
|---|---|
| **Start-up screen** | Each time the app opens it greets her by the time of day ("Good morning", "Good afternoon" or "Good evening") with "BB" below. A tap anywhere ripples out from her finger into the library. |
| **Barcode scan** | Point the camera at the ISBN barcode on the back. The book's details and blurb come from Google Books and Open Library. |
| **The right cover** | Covers are looked up by the exact ISBN on her copy (Amazon's image store, then Open Library, then Google), so the picture matches her edition. Below the found book is a row of every cover it might have: her edition first, then other editions from Open Library and Google, then **Take a photo** for her own copy. She taps one to use it. **Change cover** on a book's page brings the same choices back later. |
| **Cover scan** | Take a photo of the front cover. The app cleans up the photo (contrast, light-on-dark lettering), reads the words on it on the phone itself, and ignores cover clutter like "Sunday Times bestseller". It then searches several ways and puts the best match first. The words it read stay editable in case it slipped. Her photo is used as the cover by default, since it's exactly her copy. |
| **Scan chime** | A short, bright chime plays the moment a barcode or a cover is read. It mixes with music and follows the phone's silent switch. |
| **Search by title** | In the scanner, for a book whose barcode won't scan. |
| **Adding a book** | A sheet rises with the cover, title and author. The real cover fades in as it loads. **Add to library** starts a celebration: the cover springs up, confetti flies and the book's number is called out. Milestones (1st, 5th, 10th, 25th, 50th, 100th, then every 100th book) get gold confetti and a gold headline. It stays until she taps; then a ripple spreads from her finger and the cover lands in its spot on the shelf. **Not this one** goes back to the camera. |
| **Genres** | Each book gets a genre from the book databases, tidied into a short list (Fantasy, Romance, Mystery & thriller, and so on). Filter by genre on Home, or change a book's genre on its page. |
| **Use a photo instead** | Pick a photo of a barcode or cover rather than using the live camera. Handy on a laptop. |
| **Home** | The library count, the book she's reading now (with progress), then every book on plain white shelves of three, with search and one row of dropdown filters: status (Reading / To be read / Finished / Did not finish), genre and sort (newest, title, author by surname, rating). Scanning a book twice won't add a duplicate. |
| **Games** | **Spin the wheel** picks her next read from the books she hasn't read yet: it ticks as it turns, then shows the chosen cover and title, and a tap opens that book. **Book shower** tumbles every cover in the library down the screen. |
| **Profile** | Four rows: **Stats** (finished, reading, to be read, did not finish, audiobooks, loaned out, pages read, average rating, added this month, top genre), **Backup** (see below), **Appearance** (a choice of five accent colours) and **Settings** (empty for now). |
| **Lending** | On a book's page, mark it **Loaned out** and, optionally, who has it. A small dot shows at the top right of its cover. Home can show only loaned-out books, or sort them first. |
| **Feedback** | A message box that emails the app's maker directly (through FormSubmit, as the app has no server). |
| **Book page** | Large cover, blurb, To be read / Reading / Finished / Did not finish, Physical or Audiobook for finished books, page progress (or where she stopped, for Did not finish), 5-star rating and a written review. Reviews save automatically if she closes the book without tapping Save. |
| **Back up / Restore** | Under Profile → Backup. **Back up library** opens the share sheet, so the file can go to iCloud Drive, Google Drive, Files, email or AirDrop (computers download it). **Add books from a backup** merges: it adds missing books and updates older copies, and never deletes anything. |
| **Automatic copies** | The app keeps up to five copies of the whole library: one a day when something has changed, plus one before any app update that changes the data and before any restore. Any copy can be restored from Profile. |
| **Offline** | Once opened, the app and the covers she's already seen keep working without signal. Looking up new books needs internet. |

## Putting it on her phone

The camera only works on a secure (`https://`) address, so the app needs to be hosted somewhere. Any static host works because there's no build step. The files in this repo are the whole app.

**GitHub Pages** (free for public repos; private repos need a paid GitHub plan):

1. On GitHub, open **Settings → Pages**.
2. Under *Build and deployment*, pick **Deploy from a branch**, choose `main` and `/ (root)`, then save.
3. After a minute the site appears at `https://<your-username>.github.io/BB-s-Books/`.

**This app is live** at https://brake2turn.github.io/BB-s-Books/, served from the `main` branch. Anything pushed to `main` reaches BB's phone within a few minutes. See *Branches and updates* below.

**Netlify or Cloudflare Pages** also work if you'd rather keep the repo private. Point them at this repo and leave the build command empty.

Then on her phone:

- **iPhone:** open the link in **Safari**, tap **Share → Add to Home Screen**.
- **Android:** open the link in **Chrome**, tap **⋮ → Install app** (or *Add to Home screen*).

Open it from the home-screen icon and allow camera access when asked.

> **Good to know:** app updates never touch the library: they replace the app's code, and the library is stored separately on the phone. To keep it safe, install the app to the home screen (Safari can clear websites that aren't installed after weeks without a visit) and keep it at this same address. The library lives in the phone's browser storage. Deleting the app or clearing Safari/Chrome website data deletes the library too, so back it up from the Profile tab now and then.

## Feedback emails

Feedback is sent by [FormSubmit](https://formsubmit.co), a free form-to-email service, to the address in `FEEDBACK_TO` at the top of `js/app.js`. The **first** message sends an activation email to that address: click **Activate Form** in it, and every message after that arrives directly. FormSubmit's activation email also gives a random alias you can use in place of the email address, so the address doesn't sit in this public repo.

## Trying it out

Add `?demo` to the address (for example `https://brake2turn.github.io/BB-s-Books/?demo`) to open a separate sample shelf of 14 books. Ratings, reviews and scans there never touch the real library.

## Testing on a laptop

Open the same link in Chrome, Edge or Safari on your laptop. Everything works there too. Laptop webcams often can't focus on a barcode, so use **Use a photo** in the scanner and pick a photo of a barcode or cover (a phone snap you've sent yourself works fine). With no webcam at all, the photo option still works.

The laptop keeps its **own separate library**, so testing there won't put books on her phone. To copy her real library over, use **Profile → Back up library** on her phone and **Profile → Add books from a backup** on the laptop.

## Running it locally

```sh
npx http-server -p 8080 .
# then open http://localhost:8080
```

(`localhost` counts as secure, so the camera works on a laptop webcam.)

## Branches and updates

BB is using the app and her library is on her phone, so updates follow a simple routine:

1. **Work on a feature branch**, made from `main`. Pushing a feature branch changes nothing on her phone.
2. **Test locally** with `npx http-server -p 8080 .`, using `/?demo` for a sample shelf, and run `tests/run-all.sh`.
3. **Go live** by merging the feature branch into `main`, only once it's tested and the owner has said yes. GitHub Pages republishes in a minute or two. Her phone picks up the new code the next time she opens the app (the service worker's `VERSION` in `sw.js` must be bumped for that).

Her books are never part of a deploy: they live in her phone's browser storage, tied to the address. Code changes can't remove them as long as the address stays the same and database changes stay additive (see `CLAUDE.md`).

`main` became the live branch in October 2026. Before that, the app was published from `claude/happy-fermi-c9vv82`, which holds the same code.

## Tests

```sh
tests/run-all.sh                 # everything (about 3 minutes)
tests/run-all.sh data-safety     # one test
```

Browser tests drive the real app in headless Chromium with Playwright. They use a fake camera, stand-in book data and fresh browser profiles, so they never touch a real library. `tests/make-fixtures.sh` builds the test images and fake camera video on first run (into `tests/.fixtures/`, which isn't committed). A test passes when it exits cleanly and prints `errors: []`.

| Test | Checks |
|---|---|
| `data-safety` | Old libraries upgrade with nothing lost, reloads don't pile up copies, restores merge, backups work, automatic copies restore, and a library shaped like BB's current one survives the update |
| `scan-and-covers` | Barcode scan with the fake camera, edition cover, cover picker (instant change, row keeps its place), duplicate guard |
| `genres-and-celebration` | Genre mapping and filter, the add-to-library celebration and tap-to-continue |
| `milestones` | Milestone wording and gold confetti, count on every tab |
| `book-status` | To be read and Did not finish, Physical / Audiobook, author sort by surname, Stats rows, the scan chime on barcode and cover reads |
| `games-and-profile` | Tabs, the Profile hub and its screens, accent colours, Spin the wheel, Book shower, lending (dot, filter, sort, saving) |
| `home-and-feedback` | Search, filters, no profile button, feedback sending and failure |
| `no-camera` | Clear message when there's no camera |
| `start-screen` | Greeting by time of day, tap and Enter open the library |
| `cover-reading` | Reads five real-looking covers and picks the right book among decoys |
| `offline` | App opens with the server down |
| `updates` | An update arrives whole: no mix of new files and older copies the browser kept |

## Project layout

```
index.html            page structure
styles.css            design tokens and all styling
fonts/                Fraunces and Nunito Sans, self-hosted
design/               snapshot of the style guide (brand book, tokens, component specs)
js/app.js             Home, Stats, Feedback and Profile screens, book page, backup
js/scan-flow.js       scan screen, result sheet, search, add-to-shelf motion
js/scanner.js         camera, barcode reading, cover text recognition
js/lookup.js          Google Books / Open Library lookups
js/covers.js          edition cover search, cover tiles and placeholders
js/genres.js          turns database categories into a short genre list
js/cover-picker.js    the row of possible covers (result sheet and book page)
js/ripple.js          the tap ripple (start-up screen and celebration)
js/sound.js           the scan chime and the wheel's tick (Web Audio, no sound file)
js/games.js           Spin the wheel and Book shower
js/icons.js           line icons
js/demo.js            sample shelf for ?demo
js/db.js              on-device storage (IndexedDB)
sw.js                 offline support
tests/                browser tests (see Tests)
vendor/               bundled libraries: ZXing (barcodes), Tesseract.js (cover text), matter.js (book shower)
```

Barcode reading uses the phone's built-in detector when it has one (Android Chrome) and falls back to the bundled ZXing library (iPhone). Cover reading uses Tesseract.js running entirely on the device. About 7 MB of its files download the first time she scans a cover, then they're cached.

## Design

The look comes from the BB's Books design system: sorbet colour washes behind frosted glass, a white top zone, one cobalt accent, Fraunces and Nunito Sans. A copy lives in `design/`, and the live guide is at https://claude.ai/artifact/E2SRwHZcNvsaeYF65ApfRD. `CLAUDE.md` asks every future UI change to follow it, and `DESIGN_DECISIONS.md` covers what the guide leaves open.
