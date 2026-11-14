# defensity logo

Wordmark-only logo system for **defensity**.

The lettering is derived from **Cascadia Mono** weight 600 (SIL Open Font
License 1.1) and converted to SVG outlines. No font files or `<text>` elements
are embedded in the final assets.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| Ink | `#111827` | Primary wordmark on light backgrounds |
| Paper | `#F9FAFB` | Wordmark on dark backgrounds; letter inside the favicon tile |

## Files

| File | Background | Color |
| --- | --- | --- |
| `logo.svg` | Light | Ink |
| `logo-dark.svg` | Dark (`#0B1220` or darker) | Paper |
| `logo-mono.svg` | Any | `currentColor` |
| `favicon.svg` | Rounded Ink tile | Paper |

The primary mark is the wordmark itself, so a separate `logo-wordmark.svg`
lockup is not needed.

## Usage

- Clear space: at least half the wordmark height on every side.
- Minimum wordmark height: 20 px. For 16 px, use `favicon.svg`.
- Do not stretch, rotate, outline, add shadows or gradients, or recolor outside
  the palette.
- For inline SVG, `logo-mono.svg` inherits the surrounding `color`.
