# BookCover

A book shown face-out at 2:3, using the real cover image, with a placeholder tile when there isn't one.

**Specs.** Aspect 2:3, radius 5 (`radius-cover`), `shadow-cover` (0 14px 22px −10px ink at 40%). In the grid, width is a third of the content width minus gaps (about 108px at 390).

**Real cover.** Look the image up by ISBN after a scan and crop it to 2:3 (`object-fit: cover`). Never stretch or letterbox it.

**Placeholder.** Shown while the image loads (flat `#EDE7E4`) or when none exists: one of the six pairs (sage, periwinkle, cream, mist, peach, lilac), chosen from the book's ID so it never changes. Padding 9, title top in Fraunces 17/1.05, author at the foot in Nunito Sans 9/700, uppercase, 0.14em.

**States.** Loading, image, placeholder, pressed (scale 0.98), focus (2px cobalt ring, 3px offset).

**Do:** keep the 2:3 ratio and radius 5 at every size.
**Don't:** add borders, badges or ratings on the cover, or invent new placeholder colours.
