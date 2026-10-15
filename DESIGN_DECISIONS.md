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

## Components the guide doesn't specify

- **Primary button** (Add to library, Save review): built like the scan button. Cobalt pill, 52px tall, white 60% border, `--shadow-scan`, Nunito Sans 14/700. It is the screen's one cobalt action, as the guide asks.
- **Rating stars:** cobalt fill when chosen (a mark, not text), `--ink-2` outline otherwise, 44px targets.
- **Page inputs, review and feedback boxes:** the selected glass chip's fill, border and highlight. The review box uses a 16px radius: a pill can't hold several lines, and 24px looked too round at that size.
- **Toast:** a selected glass chip ("Added to your library").
- **Reading progress:** the guide's ProgressBar needs pages read, so the book page has "Page __ of __" inputs while a book is marked Reading. The reading card shows the most recently started book.

## Camera and sheets

- **Camera surround:** `--ink`, never pure black. Viewfinder corners are 2px white, with the card radius.
- **Camera controls:** glass (close button, Barcode/Cover chips, Use a photo, Search by title). Glass belongs over imagery. The Scan button isn't shown here, as the guide's TabBar spec says.
- **Result and search sheets:** solid white with the card radius on top, because glass turns grey over the dark surround. Inside the sheets the white-zone kit applies: tint note box, outline field, eyebrow with a cobalt dot.

## Motion

The guide only says not to animate the washes or the count. So:

- Sheets rise in 320ms with `cubic-bezier(.22,.8,.3,1)`.
- On a scan, the cover glides in. The edition's real cover fades in over a placeholder.
- On add, the cover travels to its spot on Home and settles with one small give. No tick badge, because the guide forbids badges on covers.
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
