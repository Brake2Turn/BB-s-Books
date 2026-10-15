# HeroCount

The library count: one big, light Fraunces number with the word "books" beside it. The quietest loud thing on the screen.

**Specs.** Number Fraunces 96/96, weight 300, −0.03em, ink. Unit Fraunces 22, `ink-2`, baseline-aligned, 10px gap. Top at y = 100, 20px from the left, on the white zone.

**States.** 0 ("0 books"), 1 ("1 book"), many, and thousands (with a comma, e.g. "1,204"; tighten tracking to −0.04em only if it would hit the profile column).

**Do:** one count per screen, always on white.
**Don't:** animate it with a counter roll, colour it cobalt, or pair it with other stats at the same size.
