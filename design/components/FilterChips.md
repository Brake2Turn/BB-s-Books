# FilterChips

Single-select filters for the library (All, Reading, Want to read). There are two versions, picked by what's behind them.

**Glass (on the washes).** Height 36, fully rounded, padding 0 14, label Nunito Sans 14/700, 8px apart.
- Selected: `glass-chip-on` (white 0.8), 1px `glass-chip-on-border`, `shadow-chip-on` (top highlight + 0 6px 18px cobalt at 13%), text `ink`.
- Unselected: `glass-chip-off` (white 0.3), 1px `glass-chip-off-border`, backdrop blur 24px with saturate 1.6, `shadow-chip-off`, text `ink-2`.

**Tint (on pure white).**
- Selected: `tint` fill, `accent` text (5.03:1).
- Unselected: white fill, 1px `outline`, `ink-2` text.

**States.** Selected, unselected, pressed (fill steps up one level) and focus (2px cobalt ring). Exactly one is selected. Use `aria-pressed`.

**Do:** pick glass or tint from the background, not by taste.
**Don't:** use glass on white, mix both kinds in one row, or fill a chip with cobalt.
