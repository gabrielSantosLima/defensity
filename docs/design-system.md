# Design system

Status: **draft v0.1** · direction **C — Terminal**

The specification lives in [docs/design-system/](design-system/README.md). This
page is the entry point; the values are not repeated here.

| Document | Contents |
| --- | --- |
| [README](design-system/README.md) | Scope, principles and document index |
| [Tokens](design-system/tokens.md) | Color, typography, spacing, shape, motion, focus, layers |
| [Components](design-system/components.md) | Anatomy, sizes and states of each base component |
| [Accessibility](design-system/accessibility.md) | Contrast, focus, keyboard, semantics, zoom |
| [Content](design-system/content.md) | Voice, casing, numbers, errors, terminology, localization |
| [Decisions](design-system/decisions.md) | What was chosen, what was rejected and why |
| [tokens.css](design-system/tokens.css) | Reference implementation of every token |

## Summary

- **Two families.** Inter reads; JetBrains Mono compares.
- **One signal.** Acid `#B6F24A` in dark, `#3F6B00` in light. Severity has its
  own semantic palette and never paints a row.
- **Grid, not shadow.** 1 px borders and surface steps. Shadows only for dialog,
  menu and toast.
- **Near-square.** Radius 2–4 px; 999 px only for the progress bar.
- **Dark first.** Light is a full variant, checked token by token.

## Visual reference

| File | Status |
| --- | --- |
| `docs/design-system-c.html` | Chosen direction with the final typography |

When the prototype and the specification disagree, the specification wins and the
prototype is updated.

## Not covered yet

Screen inventory, navigation structure, density options and chart tokens.
Those are tracked as open questions in
[decisions.md](design-system/decisions.md#open-questions).
