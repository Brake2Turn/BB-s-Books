# Design decisions

The app follows the BB's Books design system (`design/`, live at https://claude.ai/artifact/E2SRwHZcNvsaeYF65ApfRD). This file records where the guide is silent and the call made instead. Add to it whenever you make a new one.

## Screens the guide doesn't draw

The guide draws one screen (Home, board H3) and says new screens should reuse its frame, washes, white zone and rhythm. Each screen below is built from those parts.

- **Home holds the whole library.** Below the guide's header, count and reading card come:
  - a search field from the white-zone kit (white fill, `--outline`, pill)
  - one row of dropdown pills: status, genre and sort (see "Filter dropdowns instead of chips" below)
  - every book on shelf rows of three
- **No profile button in the header.** It was removed at the owner's request, so the AppHeader is just the title. Backup lives under Profile.
- **Tabs:** Home, Activities, Scan (centre), Social, Profile, keeping the guide's four tabs around Scan. At the owner's request, Activities (first called Games) took Stats' place, and Social took Feedback's. Stats and Feedback moved into Profile.
- **Social tab:** a placeholder for now: the header and count, then a glass card with a "Coming soon" eyebrow and one line about what will go there.
- **Profile tab:** a hub. Under the header, one glass card of rows (Stats, Backup, Appearance, Feedback, Settings), each with its icon and a chevron, split by the card's hairline like the Stats rows.
  - Each row opens its own screen with the same frame: a tint back button at the top left (as on the book page), then the title with the count on its row. The Profile tab stays lit on all four.
  - **Stats:** a glass card of short one-line rows (see "Stats without the hero" below).
  - **Backup:** the old Profile cards: backup, restore and automatic copies (see "Profile data card" below).
  - **Appearance:** the accent colour (see "Accent colours" below).
  - **Feedback:** the feedback form, unchanged, now with the back button.
  - **Settings:** empty for now, with "Nothing here yet."
- **Activities tab:** renamed from Games once it held more than games. The header and count, a short intro line, then one glass card per activity (Reading goal, Series, Spin the wheel, Book shower): a tint circle with the game's icon in the accent (a mark, not text), the name in Nunito Sans 16/700, a one-line caption, and a chevron. See "Games" below.
- **Feedback tab:**
  - The header, with a short intro line where a count would be.
  - A glass card with a message box, an optional name field and a cobalt Send button.
  - Messages are emailed to the owner through FormSubmit (formsubmit.co), since the app has no server. The address is set by `FEEDBACK_TO` in `js/app.js`.
- **Book page:** the washes and white zone behind it.
  - A tint back button, then the cover (BookCover spec, centred).
  - The title in Fraunces 36/42 at weight 400, centred. 500 is kept for the app name, and the guide never makes Fraunces bold.
  - The author, and tint status chips.
  - Glass cards for progress, blurb, rating and review, each headed by an eyebrow.

## Changes the owner asked for

- **Plain white ledges.** The guide's glass ledges let the blurred washes show through as texture, and the owner asked for plain white shelves. Ledges are now solid `--white` with a 1px `--outline` and a soft shadow (`--shadow-ledge-plain`), with no blur. The glass-ledge tokens stay in `styles.css` to match `design/tokens.json`, but nothing uses them.
- **Start-up screen.** Shown every time the app opens:
  - On the washes: "Good morning" (5am to noon), "Good afternoon" (noon to 6pm) or "Good evening" (otherwise, late night included), in the hero unit style (Fraunces 22, `--ink-2`). Below it, "BB" in the hero count style (Fraunces 96 light).
  - No buttons, as asked. A faint "Tap anywhere to open your library" caption fades in after two seconds, so it's clear what to do.
  - A tap sends a soft white wave and three white rings (tokens `--ripple`, `--ripple-soft`, `--ripple-edge`) out from her finger. The screen melts away over about a second to show the library.
  - Enter or Space also opens it. Reduce Motion gives a plain fade.

- **One-style title.** "BB's Books" is Fraunces 36/42 at 500 throughout. The guide's italic "Books" was dropped at the owner's request, for a more standard title.
- **Count beside the title.** On every tab the book count sits on the title's row, right-aligned and baseline-aligned: number in Fraunces 36 light, "books" in Fraunces 17 `--ink-2`. It replaces the big HeroCount, which freed up the top of the screen.
- **Filter dropdowns instead of chips.** Home's Reading / To be read / Finished chips became one row of three pill dropdowns: status ("All books"), genre ("All genres") and sort ("Newest", "Title", "Author", "Rating").
  - They are styled exactly like the chips they replace: glass over the washes, tint kit on white, switching with the reading card.
  - A pill set to anything but its default takes the selected-chip look.
  - Each pill is sized to its current label rather than its longest option.
  - The "14 books" caption under the filters was removed.
- **Stats without the hero.** "Finished" is a normal row now. Labels and values are kept short ("This month: 3 added", "Top genre: Classics", "None yet") and never wrap. A very long value shortens with an ellipsis rather than spilling onto a second line.
- **Profile data card.** It shows whether the library is protected from browser clean-up, the last backup date, and a list of automatic copies with a Restore button each, in the existing glass-card and row styles.

- **Milestones in gold.** The 1st, 5th, 10th, 25th, 50th and 100th book, then every 100th, get their own celebration:
  - Gold confetti with glinting pieces, plus the corner cannons, instead of the colourful burst.
  - An "A milestone" eyebrow with a gold dot.
  - A headline sentence in bright gold that shimmers when it appears: "Your very first book", "Five books on the shelf", "Ten books and counting", "Twenty-five books strong", "Fifty books, half a century", "One hundred books", then "Two hundred books" and so on.
  - The owner asked for a brighter gold with no hard outline. The headline is a gradient of `--gold-text-bright` (#C28C14) with darker `--gold-text-light` ends. A soft blurred warm shadow (`--gold-edge`) and a gentle glow (`--gold-glow`) lift it off the washes. Trade-off: the bright gold sits a little under 3:1 on the pinkest washes. The headline is 36px, and the shadow and nearby text keep it readable.
  - When the words appear, a band of light (`--gold-sheen`, `--gold-sheen-peak`) sweeps across once straight away, then again every 3.6 seconds while the screen is up. Reduce Motion stops the sweep.
  - The confetti golds (`--gold-light`, `--gold`, `--gold-mid`, `--gold-deep`) are decoration only.
  - Gold is used nowhere else in the app.
- **"To be read" instead of "Want to read".** The owner's wording, used everywhere a status is named (book page, Home filter, Stats). Only the label changed: the saved value is still `want`, so no book needed changing.
- **Did not finish.** A fourth status, "Did not finish", after Finished. On the book page the four status chips wrap onto two centred rows on a phone (To be read, Reading, Finished, then Did not finish), which keeps every chip at full size and 44px tall rather than shrinking them. A Did not finish book keeps its "Page __ of __" card, captioned "Stopped at 35% · 96 of 273 pages", so she can note where she stopped. Its pages count towards "Pages read". It has its own option in the status filter and a row in Stats.
- **Physical or audiobook.** For finished books only, a second chip row, "Read as: Physical / Audiobook", sits under the status chips, in the same tint chips. The quiet "Read as" label (13/700, `--ink-2`) stops it reading as more statuses. Neither is chosen until she taps one, and tapping the chosen one again clears it. The choice is kept if the status changes, but only shown while the book is Finished. Stats gains an "Audiobooks" row (finished audiobooks).
- **Author sort is by surname.** "Author" sorts A to Z by the first author's surname, as a bookshop shelves them (Austen, Brontë, Clarke, du Maurier…). Particles like "du" and "van" stay with the surname, and "Surname, First" names are used as written. Before, it sorted by first name, which looked out of order.
- **Scan chime.** A short, bright, rising chime plays the moment a barcode is read or a cover's words are read (not on search results or failures). It's four bell notes climbing an E major arpeggio to a ringing high E, about half a second, the shape games use for a reward. It's made with Web Audio in `js/sound.js`, so there is no sound file. It plays alongside her music rather than pausing it, and follows the phone's silent switch. The guide has no sound rules, so this is new.
- **Celebration waits for a tap.** It no longer moves on by itself. "Tap to continue" stays until she taps (or presses Enter or Space). Taps in the first 0.7 seconds are ignored, so the tap that added the book can't skip it. The tap plays the same ripple as the start-up screen (`js/ripple.js`) while the cover flies to its shelf.

- **Accent colours.** The owner asked for a choice of accent. Profile → Appearance offers five: Cobalt (the guide's own, and the default), Berry `#B02A5E`, Plum `#7A45C2`, Forest `#2A7049` and Teal `#1B6F75`.
  - The "one accent" rule still holds: there is only ever one accent at a time, used where cobalt was.
  - Each choice changes `--accent`, `--accent-rgb` (for the accent-tinted shadows) and its own pale `--tint` and `--tint-border`. Those overrides live in `styles.css` under `:root[data-accent="…"]`.
  - Every choice passes AA both ways: white text on the accent is 5.2:1 to 6.3:1, and accent text on its tint is 5.0:1 to 5.4:1.
  - The choice is kept on the phone (`localStorage`), not in the library. It isn't part of a backup.
  - Swatches are 36px circles with a white edge, a label under each, and the guide's focus ring (2px in the swatch's colour, 3px offset) on the chosen one.
  - Gold stays for milestones only, and the washes don't change.
- **Loaned-out dot on covers.** The guide says no badges on covers, and the owner asked for one exception: a loaned-out book gets a small dot at the cover's top right (`--size-dot-loan`, 12px, accent fill, 2px white edge, the chip shadow). It sits just outside the corner so it never covers the art. It also shows on the book page's cover. Screen readers hear "loaned out" in the book's name.
- **Lending on the book page.** A glass card after the rating: "Lending" eyebrow, then two tint chips, "On my shelf" and "Loaned out".
  - When the book is loaned out, an optional "Who has it?" field and a caption ("With Sam since 20 October") appear.
  - Putting the book back on the shelf clears the name.
  - Home's "Show" menu gains "Loaned out", and sort gains "Loaned out" (lent books first, most recently lent at the top). Stats gains a "Loaned out" row.

## Games and activities

- **Reading goal.** It opens on its own full screen, like the wheel, and asks one question at a time. Each question is in Fraunces 28 with a short hint under it. Four slim bars under the title show how far through she is, filled in the accent. A cobalt Next button with an arrow moves on, and Back steps back. Each question slides up softly as it appears (a fade with Reduce Motion).
  1. "What's your time frame?" This month, The next three months, This year, or Pick an end date (a date field). Each choice shows when it ends ("Until 31 December").
  2. "How many books do you want to read?" A big Fraunces number between − and + buttons. It starts at her recent pace (books finished in the last 90 days, scaled to the window) or, before she has one, about one a fortnight.
  3. "Do audiobooks count?" Yes, or only books she reads.
  4. "Your goal": "12 books by 31 December", and Set goal.
  - Choices are white with an outline (the tint kit), because the questions start on the white zone and run onto the washes. The chosen one takes the tint with an accent ring.
  - **One goal at a time.** With a goal set, the screen opens on it instead: the goal, its progress bar, "4 of 12 · On track", then Set a new goal (it says the new one replaces the old) or Remove goal.
  - **Counting.** A book counts when she marks it Finished between the goal's start and end. Books now record `finishedAt` for this. Moving a book off Finished takes it off the goal again. Books finished before goals existed have no date, so they don't count.
  - **On Home:** a slim glass card under the reading card: "Reading goal" eyebrow with "4 of 12" in Fraunces 17 on the right, a progress bar, and a caption: "On track", "Ahead of pace" or "A little behind", then "· 71 days left". After that it reads "Goal reached" or "Ended 31 December". Tapping it opens the goal.
  - To fit both cards, the reading card shrank: a 44px cover (`--size-cover-compact`, was 54px), the title in Fraunces 19 on one line, and less padding. The two cards sit as a pair, a little closer together than the stack gap. The filter pills stay glass whenever either card shows.
  - The goal is kept in the settings store on the phone, not in backup files.
- **Series.** It opens on its own full screen with an intro ("2 series on your shelves, 1 complete") and a key of the three colours. Each series is a glass card with its name in Fraunces 21 and a status line, then its books side by side in reading order.
  - **Covers overlap:** each cover is 72px wide (`--size-cover-series`) and tucks about 40px under the next, so roughly half of each shows. Long series squeeze closer, down to 8px showing, so they always fit the card. Tapping a cover opens that book.
  - **The line around a series** (owner's request), 2px in place of the glass card's white edge:
    - gold, `--series-complete` `#C9971C` with a soft gold glow, when she has every book;
    - orange, `--series-incomplete` `#E07F22`, when some are missing;
    - light blue, `--series-upcoming` `#5AAEE6`, when a new book is coming. This wins over the other two, since a series with a book on the way isn't finished.
    - The status line always says the same in words ("All 3 · Complete", "3 of 5 · Missing some", "3 of 5 · New book coming"), so colour is never the only signal.
  - Gold was milestones-only. The owner asked for gold here, so it's now milestones and complete series. Everywhere else stays gold-free.
  - **Where series come from:** a new scan takes the series and number from Open Library's edition record, or from a title written "Title (Series, #2)". Books from before this are looked up once in the background, one at a time, like genres. On the book page a Series card has the name (suggesting series already on her shelves) and the number, both editable.
  - **Complete or not:** only she knows how many books are out, so "Edit details" on a series card asks for "Books out so far" and has a "A new book is coming" chip. These are saved on every book in the series, so backups carry them. Until she enters a count, a series shows orange with "How many are there?".

- **Spin the wheel.** It opens on its own full screen, like the book page: washes, white zone, back button, then "Spin the wheel" in the app-title style and an intro line ("5 books you haven't read yet are on the wheel").
  - The wheel holds every unread book: To be read, plus books with no status. A book nobody has marked might be unread, so it's included rather than left out.
  - Slices use the four washes and the placeholder cover tones, with ink titles along each slice, truncated with an ellipsis. Past 24 books the slices are too thin to label, so only the title under the pointer shows, in Fraunces 21 below the wheel. That line always shows the book the pointer is on.
  - The pointer is an accent triangle at the top, and the hub is white with an accent dot.
  - "Spin" is the screen's one primary button. The wheel turns five or six times and eases out over about five seconds, ticking softly at each slice (`tick()` in `js/sound.js`). It lands at a random point inside a random slice, so every book is equally likely.
  - The pick appears the way a scanned book does: the cover springs in with a little tilt and the shine sweeps across it, under a "Your next read" eyebrow, with the title in Fraunces 36 and the author below. The scan chime plays. There's no confetti, because the add-to-library celebration stays the only celebration.
  - Tapping the book opens its book page. "Spin again" spins straight away.
  - Reduce Motion skips the spin and goes straight to the pick.
  - With nothing unread, the wheel is hidden and the intro says so.
- **Book shower.** Every cover in the library tumbles down over the screen she is on.
  - The covers are real physics bodies (matter.js 0.20, MIT, bundled in `vendor/matter/` and loaded only when the shower starts). They fall in a random order from random spots, spinning, knocking into each other and piling on the bottom edge.
  - Each cover rests on the pile for about four seconds, then drops through and falls off the screen. So a big library never overflows the screen, and the shower ends by itself once every cover has fallen.
  - Covers are sized to the library: up to 96px wide for a small one, down to 48px.
  - A "Tap to stop" note shows for the first few seconds. Any tap, or Escape, ends it with a fade.
  - Reduce Motion shows up to 40 covers fading in where they'd land, then fading away.
  - This is the owner's request, and it's a game she starts herself, so it's motion she chose.

## Components the guide doesn't specify

- **Primary button** (Add to library, Save review): built like the scan button. Cobalt pill, 52px tall, white 60% border, `--shadow-scan`, Nunito Sans 14/700. It is the screen's one cobalt action, as the guide asks.
- **Rating stars:** cobalt fill when chosen (a mark, not text), `--ink-2` outline otherwise, 44px targets.
- **Page inputs, review and feedback boxes:** the selected glass chip's fill, border and highlight. The review box uses a 16px radius: a pill can't hold several lines, and 24px looked too round at that size.
- **Toast:** a selected glass chip ("Added to your library").
- **Cover picker:** tapping a cover changes it at once using the small version already on screen, then the sharp version replaces it quietly once it loads. The row only re-marks the chosen tile and is never redrawn, so it stays where she scrolled it. (It used to wait for the large image, then redraw and jump back to the start.)
- **Cover picker layout:** a sideways row of BookCover tiles at 56px wide (2:3, `--radius-cover`, `--shadow-cover-sm`).
  - The chosen tile gets the guide's focus treatment, a 2px cobalt ring with a 3px offset.
  - The last tile, "Take a photo", is a tint tile with a cobalt camera icon.
  - While covers are found, placeholder tiles pulse in the cover-loading tone.
  - It sits under the found book on the result sheet. On the book page it opens in a glass card from "Change cover".
- **Reading progress:** the guide's ProgressBar needs pages read, so the book page has "Page __ of __" inputs while a book is marked Reading. The reading card shows the most recently started book.

## Genres

- **Fixed list:** the databases' categories and subjects are mapped onto 18 reader-friendly genres (`js/genres.js`). Rules go from most specific (Children's, Young adult, Graphic novels) to broadest (Literary fiction, then Non-fiction).
- **Filter:** a quiet "All genres" menu beside sort, listing only the genres on her shelves.
- **Book page:** the genre is a tint chip that opens the full list, so she can fix a wrong one. With no genre it reads "Add a genre", in the unselected chip style.
- **Stats:** gains "Favourite genre".

## Camera and sheets

- **Camera surround:** `--ink`, never pure black. Viewfinder corners are 2px white, with the card radius.
- **Camera controls:** glass (close button, Barcode/Cover chips, Use a photo, Search by title). Glass belongs over imagery. The Scan button isn't shown here, as the guide's TabBar spec says.
- **Result and search sheets:** solid white with the card radius on top, because glass turns grey over the dark surround. Inside the sheets the white-zone kit applies: tint note box, outline field, eyebrow with a cobalt dot.

## Motion

The guide only says not to animate the washes or the count. So:

- Sheets rise in 320ms with `cubic-bezier(.22,.8,.3,1)`.
- On a scan, the cover glides in. The edition's real cover fades in over a placeholder.
- **On add, a celebration.** This deliberately goes past the guide's "celebrate quietly", because the owner asked for a moment that hypes her up. It stays within the guide's palette:
  - The camera gives way to the washes.
  - The cover springs to the centre with a little tilt and a shine sweeps across it.
  - Confetti in the four wash colours, cobalt and white bursts from behind it.
  - "Book 15" is called out in Fraunces 36 under an "Added to your library" eyebrow.
  - Milestones get gold instead (see "Milestones in gold" above).
  - Copy follows the voice rules: no exclamation marks, no emoji.
  - It stays until she taps (see "Celebration waits for a tap" above). Then the ripple plays, the cover swoops to its spot on Home, and the ledge dips under it.
  - No tick badge, because the guide forbids badges on covers.
  - Reduce Motion keeps the words, without springs or confetti.
- Opening a book grows its cover out of its place on the shelf.
- Reduce Motion swaps all of this for fades.

## Guide rules applied in code

- **Glass vs. tint:** Home's chips are glass when the reading card is showing (they sit over the washes, as on H3). With no reading card they move up onto white, so they switch to tint.
- **Reduce Transparency:** glass becomes opaque white, glass chips become tint, and ledges become solid.
- **Light only:** the guide is light-only, so the earlier dark mode was removed. `color-scheme: light` stops browsers darkening it.
- **Fonts** are self-hosted rather than loaded from Google Fonts, so the app works offline. Fraunces covers weights 300–500 and italic; Nunito Sans is the variable file.
- **Cover loading tone** is `#EDE7E4` (from the BookCover spec), as the token `--cover-loading`.

## Data safety

- **Automatic copies are cheap to check.** The time and fingerprint of the newest copy are kept in the small settings store (`lastSnapshot`), so opening the app never reads the copies themselves. With a large library and photo covers, reading all five copies on every launch was slowing start-up. Libraries from before this change fall back to reading only the newest copy, once.

## Kept from earlier work

- Edition-specific cover lookup by ISBN, and "Take a photo of yours" for the exact copy.
- Search by title as a fallback in the scanner.
- **Cover scans:** the words read from the cover appear in an editable search box above the matches, so a misread is a quick fix rather than a rescan.
