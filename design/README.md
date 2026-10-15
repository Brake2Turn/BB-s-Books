# BB's Books

Scan a book and it lands in your virtual library. BB's Books looks like a **sorbet-coloured glass shelf**: soft colour washes behind frosted glass, a clean white top zone that fades into the colour, and one confident cobalt accent. Warm and bookish, never corporate. Light mode only for now.

This guide documents the approved **H3 · Title 36, italic Books** board from the *BB's Books directions* canvas exactly. The **HeroScreen** card reproduces that screen with callouts, and every other component is taken from it.

## Colour

| Role | Token | Value | Used for |
|---|---|---|---|
| Base | `bg-base` | #FFF6F3 | Screen background under the washes |
| White | `white` | #FFFFFF | The white top zone; text and icons on cobalt |
| Ink | `ink` | #15141C | Title, count, book titles, selected chip, active tab |
| Secondary ink | `ink-2` | #3F3E4C | Authors, eyebrows, captions, "books", unselected chips, idle icons |
| Accent (cobalt) | `accent` | #2F5BD9 | Scan button, progress fill, eyebrow dot, active tab dot, profile icon, tint chip text |
| Cobalt tint | `tint` | #E9EFFC | Chips and the profile button on pure white |
| Tint border | `tint-border` | #D9E3FA | Profile button outline (as drawn on H3) |
| Outline | `outline` | #E3E6F0 | Unselected tint chips on white |
| Solid ledge | `ledge-solid` / `ledge-solid-border` | #EEF1F8 / #E3E7F2 top | Shelf ledge on pure white |
| Progress track | `track` | rgba(21,20,28,0.14) | Empty part of a progress bar |
| Washes | `wash-coral` `wash-pink` `wash-sky` `wash-apricot` | #FFC9B8 #FFC4DA #C8E6FA #FFE0B8 | Large circles, blur 50px, 75–90% opacity |

**Cover placeholders** (background / text): sage #C9D7C4 / #1D2A1F, periwinkle #C8CDEE / #232849, cream #EFE6D2 / #3A3220, mist #D5E2EC / #1E3342, peach #F2D3BC / #4A2A18, lilac #DCD3EA / #2E2442. Use them only when a real cover image is missing, chosen from the book's ID so a book always gets the same one.

**The accent is never used as small text on the washes.** Cobalt measures 3.9:1 on coral and pink, below AA. As text it sits only on white (5.80:1), base (5.45:1) or the tint (5.03:1). On the washes it appears only as fills and marks (scan button, progress, dots), which need 3:1 and pass on every wash.

### Contrast (WCAG 2.1 AA)

Glass pairs are measured on the worst case: the glass at its stated opacity over a fully opaque wash colour. Real screens blur the washes to 75–90%, which only raises these numbers.

| Text | Background | Ratio | Size used | AA |
|---|---|---|---|---|
| Ink #15141C | Base #FFF6F3 | 17.17 | all | Pass |
| Ink | White | 18.28 | all | Pass |
| Ink-2 #3F3E4C | Base | 9.84 | 12–22px | Pass |
| Ink-2 | White | 10.48 | 12–22px | Pass |
| White | Cobalt #2F5BD9 | 5.80 | icons, 14px+ | Pass |
| Cobalt | Tint #E9EFFC | 5.03 | 14px chip, profile icon | Pass |
| Cobalt | White | 5.80 | links on white | Pass |
| Ink | Glass card over coral / pink / sky / apricot | 14.49 / 14.32 / 15.62 / 15.84 | 21px title | Pass |
| Ink-2 | Glass card over coral / pink / sky / apricot | 8.30 / 8.20 / 8.95 / 9.07 | 12–13px | Pass |
| Ink | Selected chip over coral / pink / sky / apricot | 16.94 / 16.91 / 17.37 / 17.47 | 14px | Pass |
| Ink-2 | Unselected chip over coral / pink / sky / apricot | 8.01 / 7.98 / 8.76 / 8.87 | 14px | Pass |
| Ink-2 | Bare wash, worst (pink) | 7.06 | 12px | Pass |
| Sage ink #1D2A1F | Sage #C9D7C4 | 9.98 | 9–17px | Pass |
| Periwinkle ink #232849 | Periwinkle #C8CDEE | 9.12 | 9–17px | Pass |
| Cream ink #3A3220 | Cream #EFE6D2 | 10.21 | 9–17px | Pass |
| Mist ink #1E3342 | Mist #D5E2EC | 9.90 | 9–17px | Pass |
| Peach ink #4A2A18 | Peach #F2D3BC | 9.06 | 9–17px | Pass |
| Lilac ink #2E2442 | Lilac #DCD3EA | 10.05 | 9–17px | Pass |
| Cobalt | Coral / pink / sky / apricot wash | 3.95 / 3.91 / 4.46 / 4.59 | **not used as text** | Fails AA text; fine for marks (≥3:1) |

## Typography

**Fraunces** (display) and **Nunito Sans** (UI), both from Google Fonts.

- **App title:** Fraunces 36/42, weight 500, −0.02em. "BB's" upright, "Books" weight-400 italic.
- **Hero count:** Fraunces 96, weight 300, −0.03em. "books" beside it in Fraunces 22, secondary ink, 10px gap, on the baseline.
- **Reading card title:** Fraunces 21/1.15. **Cover titles:** Fraunces 17/1.05 (12/1.05 on the small card cover).
- **Eyebrow:** Nunito Sans 12, 700, uppercase, 0.04em, with a 7px cobalt dot 6px before it.
- **Body and captions:** Nunito Sans 13 and 12, weights 600–700. **Chips:** 14, 700. **Cover author:** 9, 700, uppercase, 0.14em.

**Pairing rules.** Fraunces for what a reader would say out loud (the name, the count, book titles). Nunito Sans for everything you tap or scan past. Only "Books" is italic. Fraunces is never bold, and Nunito Sans never drops below 600 at these small sizes. See the **TypeScale** card.

## Surfaces and depth

- **Glass card (reading card):** fill rgba(255,255,255,0.38), 1px border rgba(255,255,255,0.75), backdrop blur 40px with saturate 1.8, radius 24, padding 14. Shadow stack: `0 0 0 1px rgba(47,91,217,0.07), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.25), 0 20px 50px rgba(47,91,217,0.14)`.
- **Glass chips:** height 36, fully rounded. Selected: rgba(255,255,255,0.8), border 0.95, top highlight plus `0 6px 18px rgba(47,91,217,0.13)`. Unselected: rgba(255,255,255,0.3), border 0.7, backdrop blur 24px with saturate 1.6.
- **Glass shelf ledges:** 12px tall, radius 6, rgba(255,255,255,0.45), border 0.8, backdrop blur 20px, shadow `inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px -8px rgba(47,91,217,0.25)`, 6px below each row of covers.
- **Glass tab bar:** floating, 64px tall, radius 32, rgba(255,255,255,0.42), border 0.8, blur 40px with saturate 1.8, inset 14px from the sides and 18px from the bottom. Scan button: 52px cobalt circle with a white 60% border and `0 12px 28px -6px rgba(47,91,217,0.65)` glow.
- **White top zone:** solid white behind the title and count, solid to about the middle of the reading card (282px), then fading to transparent just below it (394px). No hard edge, no radius, no shadow.
- **Rule:** glass looks grey on flat white, so on pure white use the **pale cobalt tint** chips (and the solid ledge) instead of glass.
- **Covers:** 2:3, radius 5, shadow `0 14px 22px -10px rgba(21,20,28,0.4)`. The small reading-card cover is drawn with `0 14px 24px -12px rgba(21,20,28,0.5)` on H3.

## Layout and spacing

- Screen 390 × 844. Side gutters 20.
- Title at y = 50, count at y = 100, profile button at y = 54 (right).
- Reading card at y = 222, just under the count, with its 54×80 cover **lifted 12px** above the card's top padding.
- 16px between the card, the chips and the shelves. Chips 8px apart.
- Book grid: **3 columns, 12px gap, 14px between rows**, ledge 6px below each row.
- Icons: **22px outline, stroke 1.9, round caps and joins**. Tab tap targets 44px.

## Components

| Card | What it documents |
|---|---|
| HeroScreen | The H3 screen, annotated |
| Palette | Every colour with its role |
| TypeScale | Type specimen and pairing rules |
| AppHeader | Title plus profile button, with states |
| HeroCount | The big light count, with 0 / 1 / thousands |
| ReadingCard | The glass reading-now card |
| FilterChips | Glass chips on washes, tint chips on white |
| BookCover | Cover tile, placeholders, loading and focus |
| ShelfRow | Three covers on a glass or solid ledge |
| TabBar | Floating glass bar and the scan button |
| ProgressBar | Thin cobalt bar with its caption |
| WashBackground | The six washes and the white top zone |

## Do / Don't

**Do**
- Keep cobalt for the one thing that matters on each screen (Scan) and for small marks.
- Put the title and count on the white zone, and let the reading card straddle white and wash.
- Switch to tint chips and solid ledges whenever something sits on pure white.
- Load real covers, cropped to 2:3, and fall back to the placeholder pairs.
- Keep the same wash arrangement on every main screen.

**Don't**
- Use cobalt as small text on the washes, or add a second accent.
- Put glass on flat white, or tint glass with colour.
- Bold Fraunces, or italicise anything other than "Books".
- Give the white zone an edge, radius or shadow.
- Add badges, ratings or labels on top of covers.

## Accessibility

- Every text pair above passes WCAG AA. The only failing pair (cobalt as text on a wash) is banned by rule.
- Cobalt fills and marks keep at least 3:1 against every wash, so the scan button, progress and dots stay visible.
- Tap targets are at least 44×44 (tabs 44, scan 52, profile 40 inside a 44 hit area, chips 36 tall inside a 44 hit area).
- Icon-only buttons carry labels: "Profile", "Home", "Library", "Scan a book", "Stats". The active tab sets `aria-current="page"`, and chips use `aria-pressed`.
- Progress is exposed as `role="progressbar"` with its value, and the caption says it in words ("58% · 181 of 312 pages").
- Status never depends on colour alone. The active tab has a dot and a darker icon, and the selected chip has a brighter fill, shadow and ink text.
- Honour Reduce Transparency: swap glass for its opaque equivalent (`white` cards, tint chips, solid ledges). Honour Reduce Motion: no wash or count animation.
- Fraunces and Nunito Sans should scale with Dynamic Type. The grid stays 3 columns and covers shrink. Text wraps and is never truncated mid-title.

## Voice

Short, warm, plain language. No jargon.

- Say what happened: "Added to your library", not "Item successfully created".
- Use readers' words: "Reading", "Want to read", "Finished". Never "status", "entries" or "records".
- Give numbers in words people use: "58% · 181 of 312 pages", "1 book", "128 books".
- Celebrate quietly: "3 scanned". No exclamation marks and no emoji.
- Never nag or guilt: say "Pick up where you left off", not "You haven't read in 5 days".
- Sentence case everywhere, except the uppercase eyebrows and cover authors.

## Source

Values are taken from `TitleItalic.dc.html` (board H3) on the *BB's Books directions* canvas. Where the brief and the board differ in detail, this guide follows the board and says so: the profile button's border is #D9E3FA, and the small reading-card cover uses its own shadow.
