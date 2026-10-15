# ProgressBar

A thin reading-progress bar with a plain-language caption underneath.

**Specs.** Height 4, radius 2. Track `track` (ink at 14%), fill `accent`. Caption Nunito Sans 12/600 `ink-2`, 4px below: "58% · 181 of 312 pages".

**States.** 0% ("Not started"), in progress, 100% ("Finished"). Expose it as `role="progressbar"` with `aria-valuenow`.

**Do:** always show the caption.
**Don't:** make it thicker, colour it by status, or animate it on every view.
