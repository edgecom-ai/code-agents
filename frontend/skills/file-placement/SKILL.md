---
name: file-placement
description: Where a new file, folder, or constant belongs in this repo, and when to split one — co-location rules, folder thresholds, constants.ts, naming, file size. Use before creating or moving any file, and when a file grows past ~{{FILE_LINES}} lines.
---

## Co-locate with the feature that owns it

A feature's own components, state, and hooks live **under that feature's
folder**, in a private subfolder the router/build ignores:
{{`routes/<area>/-components/`, `routes/<area>/-data.ts`}}.

Promote only when a second consumer really exists:

| Used by                  | Home                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| One feature              | that feature's own private folder                                            |
| Two+ features in one app | the app's shared `{{src/components/}}` / `{{src/state/}}`                    |
| Genuinely app-agnostic   | the shared package ({{`{{SHARED_PREFIX}}ui`}} — its own guide's rules apply) |

Hoisting is the `reuse-before-new` skill's job; this skill only says where the
result lands.

## Group by domain, never by kind

Bucket files that together deliver **one capability**: `table/` ✓,
`role-wizard/` ✓. Never bucket files that merely share a _kind_: `hooks/` ✗,
`types/` ✗, `overlays/` ✗, `dialogs/` ✗, `utils/` ✗. If the folder name
describes a file type or a UI role rather than a domain concept, it is the wrong
split.

## Folder thresholds

- **Don't wrap a lone module in a folder.** `admin/-data.ts` ✓, never
  `admin/-data/tenants.ts` ✗.
- A folder earns its place at roughly **3+ cohesive files**, or immediately when
  it is a clear sub-domain.
- Past roughly **{{FOLDER_FILES}} files**, split along real sub-domains — not
  alphabetically, not by kind.
- Keep nesting shallow. Add a level when a group **has** emerged, never in
  anticipation of one.

## Naming

Name files and folders for the **domain concept**, kebab-case. No barrel or
`index` files anywhere — every import names its real module.

## constants.ts

Standing values — page sizes, fixed labels, thresholds, poll intervals — go in a
**`constants.ts` at the level that owns them**: one per folder that needs one,
at every level.

- ✗ a topic-named leaf (`page-size.ts`, `labels.ts`)
- ✗ the value inlined at its call site
- A constant that a level up starts using **moves up** to that level's
  `constants.ts` with it.

## File size

Keep hand-written files to **~{{FILE_LINES}} lines or fewer**, splitting along
feature or component boundaries. This is a maintainability target, not a
mandate: it is never a reason to fragment cohesive code, and it never applies to
generated or vendor files ({{list them: route trees, generated clients,
registry-installed components}}).

Above it sits a **{{FILE_CAP}}-line hard ceiling** that `{{FILE_LENGTH_CMD}}`
enforces on every changed source file (pre-push and PR CI). A file already over
it may shrink or stay level but never grow; the only escape hatch is a reviewed
entry in the exceptions manifest. The `code-quality` skill spells out how that
gate reads.
