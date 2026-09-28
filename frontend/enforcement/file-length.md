# File length — the ceiling a tool holds

`file-placement` keeps hand-written files near ~{{FILE_LINES}} lines. That is
judgment, and stays with the skill. Above it the original repo adds a
**{{FILE_CAP}}-line hard ceiling** that a script enforces on every changed
source file — in the gate, at pre-push, and in PR CI — so the number the review
holds you to is backed by one the tooling refuses.

The scripts in [`file-length/`](file-length/) are the working set, Node only,
no dependencies:

| File                         | Role                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `file-length-policy.mjs`     | The numbers, what counts as checked source, and the rules for the exceptions manifest — the one file an adopter edits      |
| `check-file-length.mjs`      | The CLI: diffs the working tree (or `--head <sha>`) against `--base <revision>` (default `origin/main`) and exits non-zero |
| `check-file-length.test.mjs` | The suite, run with `node --test`                                                                                          |

## The rules it applies

- A **new** source file may not exceed the limit.
- A file already over it may **shrink or stay level, never grow**. A rename
  keeps the file's history, so a moved file is judged against its old size.
- The only escape hatch is `.file-length-exceptions.json`: one entry per exact
  path, with a `maxLines` ceiling and a `reason` of at least twenty characters.
  A **new or raised ceiling must equal the file's current size**, so it cannot
  pre-authorize growth; an entry for a file that shrank back under the limit,
  or that does not exist, is itself an error.
- Generated and vendor paths are exempt by pattern, never by comment.
- A checked source path may not be a symbolic link.

Seed the manifest as `{ "exceptions": [] }` and commit it — the checker fails
when it is missing, so an adopter cannot "fix" a violation by deleting it.

## Wire it

```json
// package.json
"check": "{{PM}} check:file-length && <types>",
"check:file-length": "node scripts/check-file-length.mjs",
"test:file-length": "node --test scripts/check-file-length.test.mjs"
```

- **The gate.** Put `check:file-length` inside `{{GATE_CMD}}` (the original
  runs it first in `pnpm check`), so an agent's handoff and the pre-push hook
  both pay it.
- **Pre-push** — `{{FILE_LENGTH_CMD}} --head HEAD`, before the full gate
  (`git-hooks.md`).
- **CI** — on pull requests, with a full-depth checkout so the base is
  reachable:

```yaml
- name: Enforce file-length policy
  env:
    BASE_SHA: ${{ github.event.pull_request.base.sha }}
    HEAD_SHA: ${{ github.event.pull_request.head.sha }}
  run: node scripts/check-file-length.mjs --base "$BASE_SHA" --head "$HEAD_SHA"
```

## Fill in `file-length-policy.mjs`

| Constant                                   | What to put there                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `FILE_LENGTH_LIMIT` / `FILE_LENGTH_TARGET` | The ceiling the tool refuses and the target the review reports (500 / 350)           |
| `SOURCE_EXTENSIONS`                        | What counts as hand-written source                                                   |
| `GENERATED_PATHS`                          | Route trees, generated clients, registry-installed components — by path, with reason |

The test names paths from the original repo (`apps/portal/...`) as fixtures for
the generated-path check; point them at yours.

## Name the gate in the guides

The ceiling is only half the rule; the other half is the sentence that closes
the escape hatches. `code-quality` in this kit carries it: never push with
`--no-verify`, edit the policy script, widen its exemptions, raise a ceiling to
make room, relabel a hand-written file as generated, or split mechanically into
a barrel or a `*-helpers` bucket. Add the policy script, its test, the manifest,
and the CI workflow to `GATE_CONFIG` in the agent hooks' `constants.mjs`, so an
edit to any of them is held for a human.
