---
name: ui-drift-check
description: The UI review owed on any change that renders — design-system fidelity, state coverage, invented patterns, product tone rules. Use once the screen builds and before running the gate, and again after any follow-up edit.
---

Review the UI in the current working diff (`git diff`, staged changes, and
untracked files) as an independent critic — a verification pass, kept separate
from generation on purpose. Report each item as pass, violation (with
`file:line`), or not applicable. Everything that isn't UI belongs to the
`code-quality` skill; run that one too.

## 1. Ground truth over imagination

Sizes, variants, tokens, and interaction affordances come from the shared
component **as installed** — never from memory, and never from a design file
when the two disagree ({{area guide}}: the installed component + code outrank
the design file; flag the drift with evidence).

Whether a choice is _right_ rather than merely installed — the token for a role,
the variant for a meaning, type/spacing/radius scales, per-component
conventions, and the do's and don'ts — belongs to {{the design-system doc}}, not
to this file. Fetch <{{ENTRY_POINT_URL}}>, follow it there, and review the diff
against it clause by clause. Cite it when you call a violation; it is
regenerated upstream, so it outranks your recollection of it.

## 2. States are real, not implied

Loading, empty, and error must each be a **separate branch** of the query rather
than one collapsed path, and skeletons must mirror the resolved layout — same
columns, sizes, counts — derived from the same config the real content renders
from, not a re-hardcoded copy.

## 3. Nothing invented

No new pattern where the component library, the design file, or an existing
screen already defines one — select-all, toolbars, pagination, empty states,
pills, overflow chips. Search every app in the repo before concluding otherwise
(`reuse-before-new`).

## 4. Product rules

The part the design system leaves open — this repo's own conventions. Keep the
ones that are true here and delete the rest:

- **{{Tone requires an action.}}** {{An alert tone (red/amber) sits only on
  something the operator can act on from the page it links to. A read-only count
  stays neutral no matter how bad it reads — actionless red trains people to
  ignore the color.}}
- {{Second product rule.}}

## 5. Reconcile against the source

If the screen came from a design file, walk its enumerated checklist item by
item and mark each implemented or skipped-with-reason. An unchecked item is
unfinished work.

Fix violations, then run the gate.
