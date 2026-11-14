# Components

Base components only. Any component not listed here is not approved; propose it
in this file before building it.

## Status

| Component | Status |
| --- | --- |
| Button, Icon button | Implemented in the prototype |
| Text input, Search | Implemented |
| Checkbox, Switch, Segmented control | Implemented |
| Tabs, Pill, Severity chip | Implemented |
| Table, Panel, KPI | Implemented |
| Dialog, Toast, Progress | Implemented |
| Navigation, Title bar, Status bar | Implemented |
| Select, Menu, Tooltip, Empty state | Specified, not yet in the prototype |

## Common rules

**Sizes.** Components are `md` (default) or `sm`. There is no `lg`.

**States.** Every interactive component defines: rest, hover, focus, active,
disabled. Focus always uses the global 1 px accent outline. Disabled is
`opacity: 0.4` with `cursor: not-allowed` and no hover change.

**Labels.** Buttons, tabs and segments use the Label role: mono, 9.5–11 px,
uppercase, tracking 0.08–0.1em. The uppercase comes from CSS, never from the
string.

**Loading.** A component in a pending state keeps its size and replaces its
label with a 1 px animated indicator or a static ellipsis, never with a spinner
that changes layout.

**Icons.** Lucide (ISC), 24 px viewBox, 1.5 px stroke, round caps and joins, no
fills. Rendered at 15 px in navigation, 16 px in buttons and 12–13 px inline. An
icon never appears without a text label in primary navigation.

## Actions

### Button

Anatomy: optional icon, label, no border unless outlined.

| Property | `md` | `sm` |
| --- | --- | --- |
| Height | 30 px | 24 px |
| Horizontal padding | 12 px | 8 px |
| Label | 11 px / 600 / 0.08em | 10 px / 600 / 0.08em |
| Radius | `--r-sm` | `--r-sm` |
| Gap icon–label | `--s1` | `--s1` |

Variants:

| Variant | Rest | Hover |
| --- | --- | --- |
| Primary | `--accent` background, `--on-accent` label | `--accent-hover` |
| Secondary | Transparent, `--border-strong` outline, `--text` label | Border and label become `--accent` |
| Ghost | Transparent, `--text-muted` label | Background `--surface-2`, label `--text` |
| Danger | Transparent, `--critical` at 50% outline, `--critical` label | Background `--critical-soft` |

Rules:

- Only one primary button per view.
- Danger is outlined until hover; it is never a filled red button.
- Destructive labels state the verb and the object: “Ignore findings”, not
  “Confirm”.

### Icon button

Same heights as Button, square: 30 × 30 (`md`) and 24 × 24 (`sm`). Uses Ghost or
Secondary. Always carries an accessible name through `aria-label` and a tooltip.

## Inputs

### Text input

| Property | Value |
| --- | --- |
| Height | 32 px |
| Horizontal padding | 9 px |
| Background | `--bg` |
| Border | 1 px `--border-strong` |
| Radius | `--r-sm` |
| Text | `--font-mono`, 12 px |
| Placeholder | `--text-faint` |
| Focus | 1 px `--accent` outline, offset 0 |

Field structure: label (mono, 10 px, uppercase, 0.1em, `--text-muted`), control,
hint (10 px, `--text-faint`). The gap between elements is `--s1` / `--s2`.

Inputs are mono because they usually hold identifiers, paths or query syntax. A
field that holds natural language uses Inter at the same size.

### Search

Text input with a leading 12 px search icon, `--surface-2` background and no
label, sized 180–210 px in a toolbar. It filters as the user types; it never
triggers navigation on Enter unless the result set is ambiguous.

### Select

Same box as Text input with a trailing 12 px chevron. The menu is a floating
layer: `--surface`, 1 px `--border-strong`, `--shadow-float`, `--r-md`. Options
are 28 px tall with `--s2`/`--s3` padding; the selected option shows the accent
as text, not as a filled background.

## Selection

### Checkbox

14 × 14 px, 1 px `--border-strong`, `--r-sm`, background `--bg`. Checked: accent
fill, `--on-accent` check at 9 px, 3 px stroke. Label sits 8 px to the right in
the Body role. The whole label is clickable.

### Switch

32 × 18 px, `--r-pill`, 14 px handle inset 2 px. Off: `--surface-3` track,
`--text-faint` handle. On: `--accent` track, `--on-accent` handle. Used for a
setting that applies immediately; a setting that requires saving uses a
checkbox.

### Segmented control

Container with 1 px `--border-strong` and `--r-sm`, no gap. Segments are 26 px
tall with 10 px uppercase labels. Active segment is filled with `--accent` and
`--on-accent`, with `1px` separators between segments. Used for two to four
mutually exclusive modes; more than four becomes a select.

## Navigation and structure

### Tabs

32 px tall, boxed with 1 px `--border` on the right of each tab and a 1 px
baseline. Active tab: `--surface-2` background, `--accent` label, 1 px accent
line on the bottom edge. Inactive: `--text-muted`. No pill tabs, no underline
without a box.

### Navigation (sidebar)

- Width 216 px, fixed. Hidden below 900 px of window width.
- Background `--surface`, 1 px `--border` on the right.
- Section label: 9 px, uppercase, 0.18em, `--text-faint`, 8 px horizontal inset.
- Item: 30 px tall, `--r-sm`, 15 px icon, 12.5 px label (Inter).
- Hover: `--surface-2`, `--text`.
- Active: 2 px `--accent` left marker, `--surface-2` background, `--accent`
  label, weight 600.
- Counts on the right use mono 9.5 px and inherit the item color.

### Title bar

34 px tall, `--surface-2`, 1 px bottom border. Left: wordmark at 12 px height
and the project name in mono 10 px uppercase. Right: window controls, 40 px
wide each, 11 px glyphs, hover `--surface-3`, close hover `--critical`.

### Status bar

24 px tall, `--surface-2`, 1 px top border, mono 9.5 px `--text-faint`. Left:
status dot (5 px square, `--accent` when healthy) and current operation. Right:
branch, revision and time. Always present at the bottom of the window.

## Data display

### Table

The most important component of the product.

| Property | Value |
| --- | --- |
| Header | mono 9.5 px / 600 / 0.14em, uppercase, `--text-faint`, `--surface-2` |
| Cell padding | 9 px vertical, 12 px horizontal |
| Cell border | 1 px `--border` on the right and bottom |
| Row hover | `--surface-2` |
| Cell text | Data role; identifiers keep `--font-mono` |
| Numeric column | Right-aligned, mono, `--text-muted` |
| Last row | No bottom border |

Rules:

- The full grid is drawn. Tables never use zebra stripes.
- A selected row uses `--accent-soft` and a 2 px accent marker on the left.
- Sortable headers show direction with a 10 px chevron after the label.
- Severity column is always first when present.
- Rows are not clickable as a whole unless the row has a single destination; use
  a dedicated cell action otherwise.

### Panel

1 px `--border`, `--r-md`, `--surface`, no shadow. Header is 8–9 px vertical
padding with a mono uppercase title and optional right-aligned metadata. Body
padding follows content type: `--s3` for tables (which own their padding),
`--s4` for text.

### KPI

Padding `--s3`. Label: mono 9 px, uppercase, 0.14em. Value: 24 px / 700, mono,
`--text`. Delta: 9.5 px, `--text-faint`, `--ok` for improvement and `--critical`
for regression.

KPI blocks share the 1 px grid with the table: no radius, no gap, one shared
border.

### Pill

19 px tall, `--r-sm`, 1 px `--border-strong`, mono 9.5 px `--text-muted`. Used
for scope and tags (`runtime`, `build`, `dev`). A pill is not interactive and
never uses a severity color.

### Severity chip

20 px tall, `--r-sm`, 1 px `currentColor`, 4 px square marker, mono 9.5 px / 600
/ 0.1em uppercase, tinted background from the matching `--*-soft` token.
Always carries a word, never only a color.

## Feedback

### Dialog

- Width `min(392px, 100%)`, `--r-md`, `--surface`, 1 px `--border-strong`,
  `--shadow-float`.
- Header bar: mono 10 px uppercase, `--surface-2`, `--border` bottom, optional
  `Esc` hint on the right.
- Body padding `--s4`. Title 15 px / 650, description 12.5 px `--text-muted`.
- Actions right-aligned, `--s2` gap, secondary first.
- Destructive confirmation names the object and the consequence.

### Toast

Padding 9/11 px, `--surface-2`, 1 px `--border-strong`, 2 px semantic left
border, `--r-md`, `--shadow-float`, 11 px text. Auto-dismiss after 6 s; errors
stay until dismissed. Maximum three stacked, newest on top.

### Progress

5 px tall, 1 px `--border-strong`, `--bg` track, `--accent` fill. Deterministic
only: a progress bar always has a known total. Without a total, use an
indeterminate status in the status bar instead.

### Empty state

Centered, maximum 320 px wide, `--s6` vertical padding. 1 px dashed
`--border-strong` container, `--text` title at 15 px, `--text-muted` body at
12.5 px, one secondary action. No illustration, no icon larger than 24 px.

### Tooltip

`--surface`, 1 px `--border-strong`, `--r-sm`, `--shadow-float`, mono 10.5 px,
maximum 240 px wide, `--s2`/`--s3` padding, appears after 400 ms and hides on
blur or Escape. Never the only carrier of essential information.
