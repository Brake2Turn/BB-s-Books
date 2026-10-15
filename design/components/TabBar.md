# TabBar

The floating glass tab bar: Home, Library, Scan, Stats, Profile, with Scan as the only solid colour.

**Bar.** 64 tall, radius 32, `glass-tabbar` (white 0.42), 1px `glass-tabbar-border`, backdrop blur 40px with saturate 1.8, `shadow-tabbar`. Inset 14px from the sides and 18px from the bottom, padding 0 8, items spaced evenly.

**Tabs.** 44px tap targets, 22px outline icons (stroke 1.9, round caps and joins). Idle icons are `ink-2`. The active icon is `ink` with a 4px `accent` dot under it.

**Scan button.** 52px circle, `accent` fill, 1px white-60% border, `shadow-scan` (top highlight + 0 12px 28px cobalt glow), white scan icon. Pressed: scale 0.94, glow tightens.

**Accessibility.** Every icon button carries an `aria-label` ("Home", "Library", "Scan a book", "Stats", "Profile"), and the active tab sets `aria-current="page"`.

**Do:** keep Scan centred and cobalt on every screen except the camera.
**Don't:** add text labels, change icon weight, or tint the bar.
