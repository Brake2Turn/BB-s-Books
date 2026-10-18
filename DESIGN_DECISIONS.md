# Design decisions

The app follows the BB's Books design system (`design/`, live at https://claude.ai/artifact/E2SRwHZcNvsaeYF65ApfRD). This file records where the guide is silent and the call made instead. Add to it whenever you make a new one.

## Screens the guide doesn't draw

The guide draws one screen (Home, board H3) and says new screens should reuse its frame, washes, white zone and rhythm. Each screen below is built from those parts.

- **Home holds the whole library.** Below the guide's header, count and reading card come:
  - a search field from the white-zone kit (white fill, `--outline`, pill)
  - the filter chips: All, Reading, Want to read, Finished. Four don't fit 350px, so the row scrolls sideways rather than wrapping.
  - the book count and a small sort control
  - every book on shelf rows of three
- **No profile button in the header.** It was removed at the owner's request, so the AppHeader is just the title. Backup lives on the Profile tab.
- **Tabs:** Home, Stats, Scan (centre), Feedback, Profile, keeping the guide's four tabs around Scan.
- **Stats tab:** a HeroCount of finished books ("7 finished") and a glass card listing reading, want to read, pages read, average rating and books added this month.
- **Profile tab:** the library count, then a glass card with Back up and Restore.
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
- **Count beside the title.** On Home and Profile the book count sits on the title's row, right-aligned and baseline-aligned: number in Fraunces 36 light, "books" in Fraunces 17 `--ink-2`. It replaces the big HeroCount, which freed up the top of the screen.
- **Filter dropdowns instead of chips.** Home's Reading / Want to read / Finished chips became one row of three pill dropdowns: status ("All books"), genre ("All genres") and sort ("Newest", "Title", "Author", "Rating").
  - They are styled exactly like the chips they replace: glass over the washes, tint kit on white, switching with the reading card.
  - A pill set to anything but its default takes the selected-chip look.
  - Each pill is sized to its current label rather than its longest option.
  - The "14 books" caption under the filters was removed.
- **Stats without the hero.** "Finished" is a normal row now. Labels and values are kept short ("This month: 3 added", "Top genre: Classics", "None yet") and never wrap. A very long value shortens with an ellipsis rather than spilling onto a second line.
- **Profile data card.** It shows whether the library is protected from browser clean-up, the last backup date, and a list of automatic copies with a Restore button each, in the existing glass-card and row styles.

## Components the guide doesn't specify

- **Primary button** (Add to library, Save review): built like the scan button. Cobalt pill, 52px tall, white 60% border, `--shadow-scan`, Nunito Sans 14/700. It is the screen's one cobalt action, as the guide asks.
- **Rating stars:** cobalt fill when chosen (a mark, not text), `--ink-2` outline otherwise, 44px targets.
- **Page inputs, review and feedback boxes:** the selected glass chip's fill, border and highlight. The review box uses a 16px radius: a pill can't hold several lines, and 24px looked too round at that size.
- **Toast:** a selected glass chip ("Added to your library").
- **Cover picker:** a sideways row of BookCover tiles at 56px wide (2:3, `--radius-cover`, `--shadow-cover-sm`).
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
  - The first book and milestones (5, 10, 25, 50, 75, 100, then every 50 or so) get their own line and extra confetti cannons from the bottom corners.
  - Copy follows the voice rules: no exclamation marks, no emoji.
  - It holds for about 2.4 seconds (3.2 for milestones), or until she taps. Then the cover swoops to its spot on Home, and the ledge dips under it.
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

## Kept from earlier work

- Edition-specific cover lookup by ISBN, and "Take a photo of yours" for the exact copy.
- Search by title as a fallback in the scanner.
- **Cover scans:** the words read from the cover appear in an editable search box above the matches, so a misread is a quick fix rather than a rescan.
