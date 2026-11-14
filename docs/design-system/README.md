# defensity design system

Status: **draft v0.1** · direction **C — Terminal**

This folder is the canonical specification for the desktop interface. It defines
the visual language only. Screen inventory, navigation flow and feature scope are
documented separately.

## Documents

| Document | Contents |
| --- | --- |
| [Tokens](tokens.md) | Color, typography, spacing, radius, elevation, motion |
| [Components](components.md) | Anatomy, sizes, states and rules for every base component |
| [Accessibility](accessibility.md) | Contrast, focus, keyboard, screen readers, motion |
| [Content](content.md) | Labels, casing, numbers, dates, errors, localization |
| [Decisions](decisions.md) | What was chosen, what was rejected and why |
| [tokens.css](tokens.css) | Reference implementation of every token |

## Principles

1. **Sans for reading, mono for comparing.** Inter carries everything read in
   sequence. JetBrains Mono carries everything compared in columns: labels,
   versions, paths, identifiers and numbers.
2. **Grid, not decoration.** A 1 px border carries structure. Shadows exist only
   for layers that float above the interface.
3. **One signal.** Acid is the only accent. Severity colors are semantic and are
   never used for actions.
4. **Density is a feature.** The default view is built for scanning many
   findings, not for whitespace.
5. **Dark first.** Dark is the default theme. Light is a supported variant with
   the same structural rules and the same contrast targets.

## How to use this spec

- Values live in [tokens.css](tokens.css). Do not hardcode a color, size or
  duration anywhere else.
- A component that is not covered here is not approved yet. Propose it in
  [components.md](components.md) before building it.
- The spec is versioned with the app. A change in a token is a change in the
  product, not a detail.

## Scope

In scope:

- Tokens, typography, spacing, color and states.
- Base components and their behavior.
- Accessibility and content rules.

Out of scope for this version:

- Screen inventory, layout of specific pages and navigation structure.
- Iconography beyond the stroke rule defined in [components.md](components.md).
- Illustration, marketing assets and installer branding.

## Visual reference

One HTML prototype remains as the visual proof of the specification:

| File | Status |
| --- | --- |
| `docs/design-system-c.html` | Chosen direction, with the final typography |

It is a reference, not the source of truth. When the two disagree, this folder
wins and the prototype is updated. The prototypes of the rejected directions and
the typography comparison were removed once the decisions were recorded here.
