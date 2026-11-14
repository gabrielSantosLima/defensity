# Tokens

Every value here exists once, in [tokens.css](tokens.css). Components consume
tokens; they never declare literal colors, sizes or durations.

## Color

Semantic names describe intent, not appearance. `--accent` is the signal color in
both themes even though its value changes.

### Surfaces and text

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#070A0C` | `#F2F3EE` | Application background, inputs |
| `--surface` | `#0D1215` | `#FFFFFF` | Panels, table body, sidebar |
| `--surface-2` | `#121A1F` | `#EAEBE4` | Headers, toolbars, hover |
| `--surface-3` | `#18232A` | `#DFE1D8` | Pressed state, window controls |
| `--border` | `#1D2A31` | `#D5D8CC` | Grid lines, dividers |
| `--border-strong` | `#2C3D47` | `#B6BBAB` | Inputs, outlined controls |
| `--text` | `#E7EEF2` | `#0D1215` | Primary text |
| `--text-muted` | `#8AA0AC` | `#55605A` | Secondary text, body copy |
| `--text-faint` | `#5B6F7A` | `#89928B` | Metadata, placeholders, disabled labels |

### Signal

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--accent` | `#B6F24A` | `#3F6B00` | Primary action, focus, links, active nav |
| `--accent-hover` | `#C8FF66` | `#325600` | Hover on filled accent |
| `--accent-soft` | `#1C2A10` | `#E8F5CF` | Selected row, callout, inline highlight |
| `--on-accent` | `#0A1404` | `#FFFFFF` | Text and icons on accent |

### Severity

Severity is a state of a finding, never an action. Each level has a foreground
and a tinted background used by the outlined chip.

| Token pair | Dark | Light | Meaning |
| --- | --- | --- | --- |
| `--critical` / `--critical-soft` | `#FF6B5E` / `#2A1311` | `#B3261E` / `#FBE9E7` | Reachable from user input |
| `--high` / `--high-soft` | `#FFA657` / `#2A1D10` | `#A35800` / `#FDF0E2` | Reachable with a precondition |
| `--medium` / `--medium-soft` | `#E3C341` / `#26220F` | `#7A6400` / `#F8F2D6` | Reachable with configuration |
| `--low` / `--low-soft` | `#7FB3D5` / `#122029` | `#2C5F80` / `#E7F0F6` | Not reachable, informational |
| `--ok` / `--ok-soft` | `#5EE0A0` / `#0F261B` | `#0B6B45` / `#E4F4EC` | Fixed and verified |

### Color rules

- A severity color never fills a button, a link or a whole table row.
- `--accent` never encodes severity.
- Never place `--text-muted` on `--surface-2` for body copy; use `--text`.
- The accent is a foreground token. A large accent area is limited to the
  primary button and the focus ring.
- Light and dark must stay at the same semantic contrast; when changing one,
  check the other at the same time.

## Typography

### Families

| Token | Family | Role |
| --- | --- | --- |
| `--font-sans` | Inter | Everything read in sequence: titles, body, navigation, dialogs |
| `--font-mono` | JetBrains Mono | Everything compared in columns: labels, identifiers, versions, paths, numbers |

Both are SIL Open Font License 1.1. Bundle the `woff2` files with the
application and load them from `file://` inside the bundle. Do not depend on a
CDN, an installed font or the operating system.

Fallbacks exist only to avoid a blank frame during load: keep the stack from
[tokens.css](tokens.css) and never design for it.

### Scale

| Role | Font | Size | Line | Weight | Tracking | Case |
| --- | --- | --- | --- | --- | --- | --- |
| Display | sans | 38 | 40 | 700 | −0.025em | Sentence |
| Heading 1 | sans | 24 | 30 | 650 | −0.02em | Sentence |
| Heading 2 | sans | 18 | 24 | 600 | −0.012em | Sentence |
| Body | sans | 13.5 | 23 | 400 | 0 | Sentence |
| Small | sans | 11.5 | 18 | 400 | 0 | Sentence |
| Label | mono | 9.5 | 14 | 600 | 0.2em | UPPERCASE |
| Data | mono | 12 | 19 | 500 | 0 | Sentence |

### Typography rules

- Display is reserved for a single statement per screen. It is not a section
  header.
- Heading 1 and 2 stay in sentence case. Uppercase is only for the Label role
  and table headers.
- Body copy never exceeds 72 characters per line.
- Mono never carries prose. A paragraph in mono is a code block and must be
  marked as one.
- Uppercase labels are produced with `text-transform: uppercase`, never by
  typing capitals, so translators and screen readers keep the original word.
- Identifiers, versions and paths inside prose use `--font-mono` at the Body
  size, not the Data size.
- Numerals: JetBrains Mono already has fixed advance. In Inter contexts that
  show changeable numbers, enable `font-variant-numeric: tabular-nums`.

### Loading

- Preload the two regular and semibold `woff2` files; everything else loads on
  demand.
- Use `font-display: swap`.
- Define `size-adjust` on the fallback so the first paint does not jump more
  than one line.

## Spacing

Base 4. Use the step, never an arbitrary value.

| Token | Value | Typical use |
| --- | --- | --- |
| `--s1` | 4px | Icon to label gap |
| `--s2` | 8px | Inside chips, compact stacks |
| `--s3` | 12px | Panel gaps, table cell padding |
| `--s4` | 16px | Content padding, dialog padding |
| `--s5` | 20px | Section rhythm inside a panel |
| `--s6` | 28px | Gap between blocks |
| `--s7` | 40px | Gap between sections |
| `--s8` | 56px | Page-level separation only |

## Shape

| Token | Value | Applies to |
| --- | --- | --- |
| `--r-sm` | 2px | Buttons, inputs, chips, tabs, nav items |
| `--r-md` | 3px | Panels, window, dialogs, toast |
| `--r-lg` | 4px | Large overlays |
| `--r-pill` | 999px | Progress bar only |

Any other radius is out of system. Circles are reserved for avatars, status dots
and the switch handle.

## Borders

- Default structure: `1px solid var(--border)`.
- Interactive outline: `1px solid var(--border-strong)`.
- Active or focused: `1px solid var(--accent)`.
- Dividers inside tables: `1px solid var(--border)`, both axes.
- Never use 2 px borders for structure. The only 2 px line in the system is the
  active navigation marker.

## Elevation

| Token | Use |
| --- | --- |
| none | Panels, tables, cards, page headers |
| `--shadow-float` | Dialog, dropdown menu, toast only |

A floating layer also receives `1px solid var(--border-strong)`; the shadow is
never the only separation from the background.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-instant` | 0ms | State change on focus |
| `--dur-fast` | 110ms | Hover, background, border, color |
| `--dur-base` | 160ms | Overlay and dialog entrance |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | All transitions |

Rules:

- Animate color, border and opacity. Do not animate layout, size or position.
- No bounce, no spring, no scale on hover.
- Respect `prefers-reduced-motion: reduce`: keep the state change, drop the
  transition duration to `--dur-instant`.

## Focus

```css
outline: 1px solid var(--accent);
outline-offset: 2px;
```

- Focus is a 1 px outline. No glow, no outer shadow, no rounded halo.
- Never remove focus styling. If the outline clashes with a border, keep both.
- Focus order follows the visual order of the interface.

## Layers

| Token | Value | Use |
| --- | --- | --- |
| `--z-sticky` | 10 | Sticky toolbars |
| `--z-dropdown` | 100 | Menus and popovers |
| `--z-modal` | 1000 | Dialogs |
| `--z-toast` | 1100 | Toasts, above dialogs |

Numbers outside this list are not allowed; if a new layer is needed, add a token
here first.
