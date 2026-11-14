# Content

Rules for interface language. Multi-language behavior itself follows the
repository policy: English in code and documentation, user-facing strings
localized through the project's locale files, never hardcoded twice.

## Voice

- Direct and factual. State what happened, then what to do.
- Calm. The product reports risk; it does not perform alarm.
- No blame, no jokes, no exclamation marks, no emoji.
- Verbs in the imperative for actions: “Run scan”, “Export findings”.
- Prefer the concrete noun over the abstraction: “3 reachable packages” over
  “3 issues detected”.

## Casing

| Context | Case | Example |
| --- | --- | --- |
| Navigation, buttons, tabs (Label role) | UPPERCASE via CSS | `RUN SCAN` |
| Table headers (Label role) | UPPERCASE via CSS | `PACKAGE` |
| Titles, headings, body | Sentence case | “Findings from the last scan” |
| Proper names and products | As branded | `defensity`, `npm`, `CVE-2020-8203` |
| File paths and identifiers | Exactly as stored | `lodash.merge@4.17.21` |

Never type a string in capitals to achieve the uppercase look. Apply the Label
role and let CSS transform it.

## Numbers and units

| Value | Format | Example |
| --- | --- | --- |
| Count | Locale grouping | `1,284` (en) · `1.284` (pt-BR) |
| CVSS | One decimal, mono | `9.8` |
| Confidence | Integer percentage | `98%` |
| Duration | Short units, no space | `4 min`, `1.2 s` |
| Version | As declared | `4.17.21` |
| Revision | Seven characters, mono | `4f2a1c` |
| Date | Locale date, no timezone name | `13 Nov 2026` |
| Time | 24-hour | `12:41` |

Numbers that can change are rendered with tabular figures. Counts always use the
locale separator; never hardcode a dot as a thousands separator.

## Severity and state

| Internal | Display (en) | Meaning |
| --- | --- | --- |
| critical | Critical | Reachable from user input |
| high | High | Reachable with a precondition |
| medium | Medium | Reachable with configuration |
| low | Low | Not reachable or informational |
| resolved | Resolved | Fixed and verified |

A finding has two independent axes: severity and reachability
(`runtime`, `build`, `dev`). Never merge them into one word.

State words are short and non-judgmental: `open`, `triaged`, `ignored`,
`resolved`. “Ignored” requires a reason in the data model, even if the interface
does not show it in the list.

## Actions and confirmations

- The button says exactly what it does: “Ignore 3 findings”, not “Yes”.
- Destructive actions name the object and the consequence in the description.
- A confirmation offers the safe option first and focused.
- Never ask a question in a title and answer it with a verb in the button.

## Errors

Structure: what failed, why (when known), what to do next.

- “Could not read the lockfile. The file is not valid JSON.”
- “Scan stopped: the repository is not reachable. Check the remote URL and try
  again.”

Rules:

- No stack traces in interface text; logs are a separate surface.
- No generic “Something went wrong”.
- Never expose secrets, tokens or full URLs with credentials.
- An error that the user cannot act on is a bug in the interface.

## Empty states

- Explain why the area is empty before offering an action.
- “No findings yet. Run a scan to populate this list.”
- “No results for `severity:critical`. Clear the filter to see all findings.”
- One action maximum, secondary style, matching the explanation.

## Terminology

| Term | Use for | Avoid |
| --- | --- | --- |
| finding | A confirmed or suspected weakness | issue, bug, alert |
| scan | One analysis run over a target | analysis, job |
| package | A resolved dependency | library, module (unless exact) |
| reachability | Whether code executes at runtime | exploitability |
| confidence | Model certainty in a finding | score, probability |
| policy | Rule that decides what is reported | ruleset, config |
| target | Repository or artifact being scanned | project (reserved for UI grouping) |

## Localization

- Source strings are English keys; translations live in locale files.
- Keep locales in sync in the same change that touches a string.
- Allow at least 30% more width for translated labels; never fix a button width
  to the English label.
- Do not concatenate sentences from fragments.
- Placeholders are named, not positional: `{count} findings`, not `%s`.
- Icons and colors carry no meaning that a translation must guess.
