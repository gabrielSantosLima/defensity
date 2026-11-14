# Accessibility

Target: **WCAG 2.2 level AA** for the desktop application. Platform assistive
technologies are part of the acceptance criteria, not a later pass.

## Contrast

| Content | Minimum | Notes |
| --- | --- | --- |
| Body text and labels | 4.5:1 | Check both themes |
| Large text (≥ 18 px or 14 px bold) | 3:1 | Display and headings |
| Control borders and icons | 3:1 | `--border-strong` against its surface |
| Decorative dividers | none | `--border` is structural only |

Token pairs are approved as a set. A new pair must be measured in both themes
before it is used. Never lower the opacity of text to create hierarchy; use
`--text-muted` or `--text-faint`, which are already contrast-safe.

## Focus

- Visible on every interactive element: 1 px `--accent` outline, 2 px offset.
- Never `outline: none` without an equivalent replacement.
- Focus order follows visual order: title bar → sidebar → app bar → content →
  status bar.
- A focused control inside a table row must not be hidden by the row hover.

## Keyboard

| Key | Behavior |
| --- | --- |
| `Tab` / `Shift+Tab` | Move focus |
| `Enter` / `Space` | Activate the focused control |
| `Escape` | Close the topmost layer (dialog, menu, tooltip) |
| `Arrow keys` | Move within tabs, segments and menus |
| `Home` / `End` | First and last item of a list or table |
| `PageUp` / `PageDown` | Scroll the focused table |

- Dialogs trap focus while open and return it to the trigger on close.
- Menus close on selection, `Escape` and outside click.
- Every action reachable by mouse has a keyboard path. The primary action of a
  dialog is reachable with `Enter` only after focus moves into the dialog.

## Semantics

| Element | Requirement |
| --- | --- |
| Tab list | `role="tablist"`, `aria-selected`, arrow-key navigation |
| Segmented control | `aria-pressed` per segment, or a radio group when it submits |
| Switch | `role="switch"` with `aria-checked` |
| Expandable panel | `aria-expanded` and `aria-controls` |
| Table | `<th scope="col">`, caption or `aria-label` |
| Sortable header | `aria-sort` on the active column |
| Dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Toast | `role="status"`; errors use `role="alert"` |
| Progress | `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| Icon-only button | `aria-label` |
| Live scan status | `aria-live="polite"` on the status bar segment |

Heading levels are sequential; a screen never starts at `h3` because of size.
Display type is visual only and does not change the heading level.

## Color independence

Severity is never conveyed by color alone. Every severity chip includes a word
and a shape; every delta includes a sign or a word; every state includes text.

Charts, if added later, need patterns or direct labels in addition to color.

## Motion and timing

- Respect `prefers-reduced-motion: reduce`; transitions drop to 0 ms while state
  changes remain.
- Nothing flashes more than three times per second.
- No information disappears before it can be read: toasts last 6 s, errors stay.
- Auto-refresh of scan status must not steal focus or reset scroll position.

## Sizing and zoom

- Text scales to 200% without loss of content or function.
- The window is usable at its minimum size; the sidebar collapses below 900 px
  of width and content never requires horizontal scrolling except for tables,
  which get their own scroll container.
- Hit targets are at least 24 × 24 px for small controls and 30 × 30 px for
  default ones. Table row actions respect this even when the row is dense.

## Language

- `<html lang>` reflects the active locale and updates when the locale changes.
- Uppercase is applied by CSS so assistive technology reads the original case.
- Labels, errors and empty states are translated; identifiers are not.
- A translated string never depends on word order in the source language.

## Checklist for a component

1. Contrast measured in both themes.
2. Focus visible and in a logical order.
3. Reachable and operable by keyboard.
4. Role, name and state exposed correctly.
5. Not dependent on color alone.
6. Works at 200% zoom and at the minimum window size.
7. Works with reduced motion.
