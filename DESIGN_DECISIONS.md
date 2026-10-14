# Design decisions

Choices the design brief didn't settle, or where it had to bend, and why.

## Open choices from the brief

- **Platform:** web app (PWA), installed to the home screen. No app store, works on iPhone and Android, and can be tested on a laptop. Haptics use `navigator.vibrate`, which Android supports. iPhones don't allow web haptics, so they just skip that step.
- **Theme:** light by default; dark follows the phone's system setting.

## Where the brief bent

- **Button text contrast.** Light-mode terracotta `#B4623F` with paper text gives 3.9:1, below WCAG AA (4.5:1) for 16px labels. Filled buttons use `--accent-fill: #A35939`: the same hue, slightly deeper, at 4.6:1. Everywhere else the accent stays `#B4623F`. Dark mode passes as specified (5.1:1).
- **The add-to-library moment.** Earlier the owner asked for a "whizz in, reveal, plop down" moment. The brief asks for quiet motion and no confetti or sparkles. Both are kept in a toned-down form:
  - The cover glides in from the side with a slight tilt as the sheet rises.
  - It starts as a typographic stand-in and the real cover fades in over it once the edition's picture loads (the reveal).
  - On add, it travels to its exact spot on the shelf and settles with one small, heavily damped give (the plop).
  - Stars, spin, blur and bounce were removed.
- **"Settles toward the library tab".** The app has no tab bar: the library is the home screen. So the cover lands in its real place in the grid or shelf, and the sage tick appears on the book itself.
- **Opening a book.** The owner asked for the cover to "maximise" when tapped. The detail page fades and rises as the brief asks, and the cover grows from its spot on the shelf to its large size (320ms, brief easing). Reduced-motion users get a plain fade.

## Small calls

- **Radii beyond 4/10/16:**
  - Segmented-control thumbs use 8px, so they sit concentric inside their 10px track.
  - The camera shutter is a circle, by long camera convention.
  - The sheet's drag handle is a 4px pill.
- **Tiny section labels** (Blurb, Your rating) use letter-spaced caps at 12px, as the brief allows. Everything else is sentence case.
- **Rating on the grid** is a row of small ochre stars under the cover rather than a badge, so nothing sits on top of the cover art.
- **Shelf mode:**
  - Spine thickness comes from page count and height varies a little by title, so a shelf looks lived-in rather than uniform.
  - Spine colour is the cover's dominant colour pulled 22% toward `paper-sunk`. If the image host blocks colour reading, the spine falls back to the same title-derived tone the placeholders use.
- **Placeholder tones** are desaturated sage, ochre, dusty blue and terracotta in two depths (8 tones). Each title always maps to the same tone. Text on them is ink or paper, whichever has more contrast.
- **The camera surround** is always umber (`#221C18`), in both themes, so the camera view never looks black and the paper-coloured brackets read well over it.
- **Paper grain** is an SVG noise layer at 5% opacity. It's only visible if you look for it.
- **Fonts** are self-hosted (Fraunces and Instrument Sans variable files, about 300 KB total). They work offline and never fall back to a system font after the first visit.
- **Status** (Want to read, Reading, Read) starts empty for a newly scanned book, because an owned book isn't automatically one she wants to read. Tapping the selected status again clears it.
- **Search by title** is in the scanner, as the brief's fallback for books that won't scan. Books are still only ever added from the scan screen.
