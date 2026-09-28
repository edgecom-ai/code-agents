---
name: implement-from-design
description: Implement a page or screen from a design file (a design-tool export, a mockup link, or pasted markup) — enumerate it into a checklist, verify each item against the design system, build, then reconcile. Use whenever a design file is the source for UI work.
---

Implement the requested page or screen from the design file the user points to.
Do NOT start coding from a visual impression — attention over a long design file
is lossy, so work in three non-skippable phases:

## 1. Enumerate

Read the design file end to end and produce an inventory checklist **before any
implementation**: every component instance; every variant, size, and state
(hover, selected, disabled, empty, loading, error); every interactive behavior
(multi-select, combobox, select-all and bulk actions, sorting, pagination);
exact spacing and sizing values. Post the checklist in your response.

## 2. Verify against the design system

Resolve each checklist item to the real component and semantic tokens the repo
actually ships ({{see `<shared-ui>/AGENTS.md`}}). Start from
<{{ENTRY_POINT_URL}}>: its catalog settles whether a component exists for the
item at all, and the usage doc it routes you to settles the token, variant, and
convention each one should take.

Where the design file conflicts with the shipped components or existing code
(button sizes, cursor styles, stale icons, inverted tokens), **the code wins** —
mark the item "design-file drift", build the code version, and flag the drift in
your summary with evidence. Never invent a new UI pattern for something the
component library or an existing screen already renders; reuse per
`reuse-before-new`.

## 3. Implement, then reconcile

Build against the checklist. When done, walk it item by item and mark each one
✓ implemented or ✗ intentionally skipped (with the reason). An unchecked item is
unfinished work, not an optional nicety. Finish with the `ui-drift-check` skill
and the pre-handoff gate.
