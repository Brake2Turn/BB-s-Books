# ReadingCard

The frosted card for the book you're reading now: small cover, eyebrow, title, author, progress.

**Glass.** Fill `glass-card` (white 0.38), 1px `glass-card-border` (white 0.75), backdrop blur 40px with saturate 1.8, radius 24, padding 14. Shadow `shadow-card`: a 1px cobalt hairline at 7%, a top inner highlight, a bottom inner lowlight and a soft 0 20px 50px cobalt lift.

**Contents.** Cover 54×80, radius 5, lifted 12px above the card's top padding (`cover-lift`), title in Fraunces 12/1.05, `shadow-cover-sm`. 14px gap to the text column. Eyebrow "READING NOW" (12/700 caps, 0.04em, 7px cobalt dot). Title Fraunces 21/1.15. Author Nunito Sans 13/700 `ink-2`. Progress bar 8px below, then the caption 12/600 "58% · 181 of 312 pages".

**Placement.** Directly under the hero count at y = 222. The white zone stays solid to about the card's middle, then fades, so the card straddles white and wash.

**States.** Reading (default), just started, nearly done. With no current book, hide the card rather than showing an empty one.

**Do:** one reading card per screen, real cover image when available.
**Don't:** put it on pure white, change the radius, or add buttons inside it (tap the whole card).
