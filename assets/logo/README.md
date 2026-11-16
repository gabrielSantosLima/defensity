# defensity logo

Wordmark and app mark system for **defensity**.

The lettering is derived from **Cascadia Mono** weight 600 (SIL Open Font
License 1.1) and converted to SVG outlines. No font files or `<text>` elements
are embedded in the final assets.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| Ink | `#111827` | Primary wordmark and app mark on light backgrounds |
| Paper | `#F9FAFB` | Wordmark and app mark on dark backgrounds; inside the icon tile |
| Acid | `#B6F24A` | App mark accent on dark backgrounds |
| Acid light | `#3F6B00` | App mark accent on light backgrounds |

## Wordmark

| File | Background | Color |
| --- | --- | --- |
| `logo.svg` | Light | Ink |
| `logo-dark.svg` | Dark (`#0B1220` or darker) | Paper |
| `logo-mono.svg` | Any | `currentColor` |
| `lockup.svg` | Light | Ink + `#3F6B00` |
| `lockup-dark.svg` | Dark | Paper + Acid |
| `favicon.svg` | Rounded Ink tile (app mark) | Paper + Acid |

The wordmark is the primary signature. `lockup.svg` and `lockup-dark.svg`
add the app mark to it for places that need both at once.

## App mark

Square mark for the app icon, installer, favicon and avatar. It is drawn on the
same 64 px grid as the wordmark and uses the same palette, so the two can appear
together without a new visual language.

| File | Background | Color |
| --- | --- | --- |
| `app/mark.svg` | Light | Ink with `#3F6B00` accent |
| `app/mark-dark.svg` | Dark | Paper with Acid accent |
| `app/mark-mono.svg` | Any | `currentColor` |
| `app/app-icon.svg` | Rounded Ink tile | Paper with Acid accent |

Concept: an intact block with one corner removed and the accent marking the gap.
At 16 px the silhouette still reads as a square with a notch; the accent square
is the first detail to disappear, and that is acceptable.

## Usage

Wordmark:

- Clear space: at least half the wordmark height on every side.
- Minimum height: 20 px. For 16 px, use an icon.
- Do not stretch, rotate, outline, add shadows or gradients, or recolor outside
  the palette.
- For inline SVG, `logo-mono.svg` inherits the surrounding `color`.

App mark:

- Clear space: at least one quarter of the mark height on every side.
- Minimum size: 16 px.
- Use `app-icon.svg` when a square tile is required; use `app/mark*.svg` when the
  mark sits directly on the surface.
- Do not rotate, stretch, outline or add shadows. The accent is part of the mark,
  except in the mono variant.
- `favicon.svg` now carries the app mark; `app/app-icon.svg` is its source.
- The lockups place the mark before the wordmark with a gap equal to half the
  mark height. Do not reflow them into a vertical stack.
