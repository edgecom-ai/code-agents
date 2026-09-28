---
name: code-quality
description: The code review owed on every change before the gate — comments, dead code, duplication, imports, file length, edge cases. Use once the edits are done and before running the gate, and again after any follow-up edit.
---

Read the current working diff (`git diff`, staged changes, untracked files) as
an independent critic. Report each item as pass or violation (`file:line`), fix
the violations, then run the gate.

## 1. Comments

The rule is in the root `AGENTS.md`; this is where it gets enforced. Delete any
comment that restates the identifier above it, the markup below it, or the
classes on the element. Keep only the non-obvious _why_: a workaround, an API
constraint, a hazard the next reader would otherwise re-introduce.

- One line. Two only when the hazard genuinely needs it.
- No doc block introducing a file, component, hook, or function. Writing one is
  the tell that the design is being explained to a reader instead of by the
  code — fix the code.
- Compare density against the surrounding file, not against the diff alone.

## 2. Dead on arrival

No field, prop, export, constant, or query key that nothing reads. A value
carried "in case" is a defect: the next reader has to prove it unused. Grep each
new symbol before handing off.

## 3. One source of truth

No second copy of config-like data — column definitions, option lists, route
tables, status maps. Every consumer derives from the one definition. A near-copy
is the `reuse-before-new` case: hoist and widen, never fork.

## 4. Framework and repo APIs first

Use the installed framework's API over a hand-rolled equivalent ({{e.g. the
router's own matching and params rather than parsing the pathname}}), and an
existing repo helper over a new lookalike.

## 5. Imports

Where a file landed is `file-placement`'s own gate row; this pass assumes it
ran. What is left here is the specifier: follow the depth rule in
{{`<area>/AGENTS.md`}} ({{alias at three or more `..` segments, relative within
two, shorter specifier wins}}).

## 6. File length

The toolchain enforces a **{{FILE_CAP}}-line hard ceiling** through
`{{FILE_LENGTH_CMD}}`, the pre-push hook, and PR CI (the kit's
`enforcement/file-length.md`). New source files may not exceed it; a legacy
file already over it may shrink or stay level, but never grow. The exceptions
manifest is the only escape hatch: each entry names one exact path, its
reviewed ceiling, and a substantive reason. A new or raised ceiling must equal
the file's current size, so it cannot pre-authorize growth.

The automated ceiling does not replace `file-placement`'s **~{{FILE_LINES}}-line
review target**, which nothing measures. For every source file the diff
touches, report its line count. Above the target, name the feature or component
boundary a safe split would use; if the file is more cohesive left whole, say
why rather than fragmenting it.

Getting past this gate is never the fix. Do not push with `--no-verify`, edit
the policy script or widen its generated-path exemptions, add or raise a
ceiling in the exceptions manifest to make room, relabel a hand-written file as
generated, or split mechanically into a barrel, `index`, or `*-helpers` bucket.
Split along a real domain boundary per `file-placement`, or report that the
file cannot be split safely and stop for the user to decide.

> No ceiling adopted? Then nothing in the toolchain measures this and it is
> checked here or not at all: count the lines (`wc -l`) of every file the diff
> touches, report the count beside the verdict, and flag the file the diff
> **pushes over** the target — that is the drift happening, not a pre-existing
> condition.

## 7. Boring edge cases

User input is trimmed, deduplicated, and checked for empty; a conflict the API
reports (409) reads as the outcome the customer wanted, not as a failure; a list
that fails to load says so instead of rendering as empty.
