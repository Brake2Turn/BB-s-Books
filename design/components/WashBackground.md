# WashBackground

The screen background: six soft colour washes on a blush base, with a white zone across the top that fades into them.

**Washes.** Base `bg-base`. Six circles with `filter: blur(50px)`, placed to bleed off the edges (390×844 frame):
| Circle | Size | Position | Opacity |
|---|---|---|---|
| Coral | 320 | left −120, top 20 | 80% |
| Pink | 300 | right −130, top 80 | 75% |
| Sky | 260 | left −80, top 320 | 85% |
| Apricot | 240 | right −50, top 360 | 90% |
| Sky | 280×240 | left −60, bottom −90 | 85% |
| Pink | 240×220 | right −50, bottom −80 | 75% |

**White top zone.** A 404px band with `linear-gradient(180deg, #FFF 0, #FFF 282px, transparent 394px)`. It stays solid to about the middle of the reading card, then fades out just below it. No hard edge, no radius, no shadow.

**Do:** keep the same arrangement on every main screen so the app feels like one place.
**Don't:** animate the washes, add new hues, or put the washes in front of content.
