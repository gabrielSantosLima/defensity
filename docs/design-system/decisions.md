# Decisions

Short decision records for the design system. Each entry states context, the
decision and its consequences. A superseded entry is not deleted; it is marked
and linked to its replacement.

## DS-001 — Visual direction

**Status:** accepted.

**Context.** The app needed a visual identity before any screen was designed.
Three complete directions were prototyped and reviewed: Console (cool grays,
blue signal, dense), Atelier (warm paper, serif hierarchy, editorial) and
Terminal (near-black, acid signal, 1 px grid).

**Decision.** Terminal was chosen as the base: acid accent, 1 px grid, near-square
corners, dark theme as default.

**Consequences.**

- The interface reads as part of the pipeline, close to a CLI or editor.
- Density is high and requires the typography decision below to stay readable.
- The rejected directions are not kept as files; the decision record above is
  the only history that matters.

## DS-002 — Typography

**Status:** accepted. Supersedes the first draft of DS-001, which used mono for
everything.

**Context.** The chosen direction originally set all text in Cascadia Mono. In
review, prose at 13 px was tiring, and the mono slowed reading in tables and
dialogs.

**Decision.** Two families with distinct roles: **Inter** for everything read in
sequence, **JetBrains Mono** for everything compared in columns. Both SIL OFL,
bundled as `woff2`.

**Consequences.**

- The terminal character survives in labels, identifiers and the grid, not in
  prose.
- Two families increase the bundle by roughly 150–200 KB for the weights in use.
- The wordmark is unaffected: it is drawn from Cascadia Mono outlines.

**Considered and rejected.** IBM Plex Sans/Mono (kept as the closest
alternative), Geist (more contemporary, less neutral at small sizes), Source Sans
3 (excellent for long text, weaker presence in dense tables), JetBrains Mono for
all text (solves part of the fatigue, not the prose problem).

## DS-003 — Dark first

**Status:** accepted.

**Context.** A security tool is used for long sessions, often alongside a
terminal and an editor. Both themes were required regardless.

**Decision.** Dark is the default and the reference for contrast. Light is a
supported variant with identical structure and tokens.

**Consequences.**

- Every token must be verified in both themes before it is approved.
- The light theme is not an inverted dark theme: surfaces are warm and borders
  are darker relative to the background, not lighter.
- Screenshots and documentation default to dark.

## DS-004 — Severity presentation

**Status:** accepted.

**Context.** Severity is the most frequent signal in the product. Filled badges
and colored rows were both prototyped.

**Decision.** Outlined chips with a 1 px border in `currentColor`, a 4 px square
marker, an uppercase mono label and a tinted background. Rows are never colored.

**Consequences.**

- Severity remains legible without color, satisfying the color-independence
  rule.
- The table stays calm even with many critical findings; urgency comes from
  ordering and from the KPI row.

## DS-005 — Surface over shadow

**Status:** accepted.

**Context.** Panels, tables and cards could be separated by elevation or by
borders.

**Decision.** Structure uses 1 px borders and surface steps. `--shadow-float` is
reserved for dialog, menu and toast.

**Consequences.**

- The interface stays flat and grid-aligned, which matches the chosen direction.
- Floating layers must also carry a strong border, so the shadow is never the
  only separation.

## DS-006 — Tokens as CSS custom properties

**Status:** accepted.

**Context.** The renderer is React with CSS. Tokens could live in a theme object
or in CSS.

**Decision.** Tokens are CSS custom properties on `:root` and `[data-theme]`.
The reference file is [tokens.css](tokens.css). TypeScript consumes them through
`var(--token)` in styles, not through a duplicate object.

**Consequences.**

- One source of truth; theme switching is an attribute change, with no re-render
  required.
- A token that must be read in JS (rare) needs an explicit bridge; do not
  duplicate the palette.

## DS-007 — Logo and interface are separate systems

**Status:** accepted.

**Context.** The wordmark was derived from Cascadia Mono 600 outlines. The
interface moved to Inter and JetBrains Mono.

**Decision.** The logo stays as drawn. It does not adopt the interface
typefaces and does not change with the theme beyond its light/dark SVG variants.

**Consequences.**

- Brand and UI can evolve independently.
- The logo is always an SVG path, never live text, so it renders identically on
  every platform.

## DS-008 — Icon set

**Status:** accepted.

**Context.** Navigation, toolbars and table actions need one visual language. The
icon needs to sit on the 1.5 px stroke and 24 px grid used by the prototype.

**Decision.** **Lucide** (`lucide-react`, ISC). 24 px grid, 1.5 px stroke, round
caps, rendered at 15 px in navigation and 16 px in buttons.

**Consequences.**

- Import per icon; never import the whole set.
- No mixing with a second icon family. A missing glyph is drawn to the same grid.
- Icons are decorative or labeled; an icon alone always has an accessible name.

## DS-009 — Window chrome

**Status:** accepted, provisional.

**Context.** The app ships for Windows and Linux, and no screen is designed yet.
A custom title bar adds per-platform work — drag regions, window controls,
maximize behavior.

**Decision.** Ship with the **native window frame**. The 34 px title bar in
[components.md](components.md) is the reference for a custom frame later
(`titleBarStyle: "hidden"` with a native overlay), not a v1 requirement.

**Consequences.**

- No window-control logic to maintain now; the status bar remains inside the
  content area.
- If a custom frame is adopted, the title bar spec already covers height,
  control width and hover states.
- Revisit after the first screen exists.

## Open questions

| Question | Impact | Owner |
| --- | --- | --- |
| Density setting: expose compact/comfortable? | Table row height, spacing tokens | product |
| Do we need a second accent for charts? | Data visualization tokens | design |
| Which locales ship in the first release? | Content, date and number formats | product |
