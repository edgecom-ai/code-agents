# The enforcement layer

Guides and skills are read by agents; hooks are not optional for anyone. Put a
rule in a hook whenever it is mechanically checkable — then the skill covering it
can shrink to the part no tool can decide.

Shown with [lefthook](https://github.com/evilmartians/lefthook); Husky,
pre-commit, or a Makefile target work the same way. Install it from the
package's `prepare` script so a fresh clone is protected without a manual step.

## The four hooks

```yaml
# lefthook.yml — installed via the `prepare` script on install
pre-commit:
  parallel: true
  commands:
    format:
      glob: '*.{ts,tsx,js,jsx,mjs,cjs,json,css,md,yml,yaml}'
      # AGENTS.md is a symlink to the real guide — formatters error on explicit
      # symlink paths, and formatting the target already covers its content.
      exclude:
        - 'AGENTS.md'
        - '**/AGENTS.md'
      run: {{PM}} exec prettier --write {staged_files}
      stage_fixed: true
    lint:
      glob: '*.{ts,tsx,js,jsx,mjs,cjs}'
      # Generated files are lint-ignored; passing them explicitly makes the
      # linter warn "File ignored because of a matching ignore pattern".
      exclude:
        - '**/{{GENERATED_GLOB}}'
      run: {{PM}} exec eslint --fix {staged_files}
      stage_fixed: true

commit-msg:
  commands:
    commitlint:
      run: {{PM}} exec commitlint --edit {1}

pre-push:
  commands:
    # Catches merge commits that pre-merge-commit cannot see: a conflicted merge
    # is finalized with a plain `git commit`, which never fires that hook.
    no-merge-commits:
      priority: 1
      use_stdin: true
      run: node scripts/check-no-merge-commits.mjs {1}
    file-length:
      run: {{FILE_LENGTH_CMD}} --head HEAD
    # The same gate the root guide owes on every handoff, so a push cannot skip
    # a step the agent's reply merely claimed to have run.
    verify:
      run: {{GATE_CMD}}

# Rebase-only workflow: block any merge that would create a merge commit.
# (Fast-forward merges/pulls don't trigger this, so `git pull --rebase` works.
# A server-side linear-history rule is the backstop for clones without hooks.)
pre-merge-commit:
  commands:
    no-merge-commits:
      run: |
        echo "❌ Merge commits are disabled in this repository."
        echo "   Sync with rebase instead:  git pull --rebase   (or  git rebase <branch>)"
        exit 1
```

[`git-hooks/check-no-merge-commits.mjs`](git-hooks/check-no-merge-commits.mjs)
is the pre-push script, drop-in and dependency-free: it reads the refs git
feeds a pre-push hook on stdin, lists the merge commits in each outgoing range,
and refuses the push naming them. The `file-length` step is its own layer —
[`file-length.md`](file-length.md).

## Why this split

| Hook               | Checks                                                                                  | Left to the skills                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pre-commit`       | Formatting and lint on **staged files only** — fast enough to never be bypassed         | File placement, dead code, duplication (`code-quality`, `file-placement`)                          |
| `commit-msg`       | Message **shape**: a valid type, a present, correctly-cased subject                     | Whether the type matches the change and the scope is the narrowest accurate one (`commit-message`) |
| `pre-push`         | History shape, the file-length ceiling, then the full gate — format, lint, types, build | Whether the reply reported the gate honestly (`code-quality`)                                      |
| `pre-merge-commit` | History shape, at the moment a merge would be created                                   | —                                                                                                  |

Two details worth copying:

- **`stage_fixed: true`** on the auto-fixers, so an agent's commit doesn't fail
  on formatting it could have fixed itself.
- **The `exclude` comments.** Every exclusion carries its reason inline;
  otherwise the next agent reads it as a rule that may be widened. Widening an
  ignore list to make a check pass is the exact violation the root guide names.

## Tell people how to recover

Every rejection above has the same cure, and every message points at the same
place: put the commits back in a straight line on top of the main branch, then
push again. Write that section once in `{{HUMAN_DOC}}` (the original calls it
"Blocked by a rule?") and have the root guide link to it:

- A merge commit in the push, or the host's linear-history rule: `git fetch`
  then `git rebase origin/main`; a plain rebase drops the merge commit and
  replays only your own commits.
- A diverged local main branch: the same rebase — never overwrite the remote.
- Re-pushing a branch you just rebased is the one case that needs a force, and
  `--force-with-lease` is the form: it aborts if the remote moved under you.
  Neither `--no-verify` nor a bare force ever fixes anything; both only move the
  failure to the next gate, and the agent hooks deny them anyway.

## Ban directive comments in the linter

The root guide forbids `eslint-disable` and `@ts-ignore` as ways past the gate.
Make the linter say the same thing, so the ban does not depend on an agent
reading the guide:

```js
// shared ESLint config
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';

plugins: { '@eslint-community/eslint-comments': eslintComments },
rules: {
  // A directive comment is a rule turned off at one call site — the gate is
  // passed by fixing the code, never by silencing the rule.
  '@eslint-community/eslint-comments/no-use': ['error', { allow: [] }],
},
```

`@ts-ignore` and `@ts-nocheck` are already errors under typescript-eslint's
recommended preset (`ban-ts-comment`); `@ts-expect-error` with a description
stays available as the one honest escape hatch. Vendor or generated folders that
legitimately carry directives belong in the linter's `ignores`, with the reason
inline — never in an `allow` list on this rule.

## Agent hooks

Git hooks fire at commit and push, after the agent has already written the
code. Agent hooks fire at the tool call, before it: they can deny the
suppression comment as it is typed, hold an edit to the gate's own config for a
human, and refuse to end a turn whose gate never ran — under Claude Code and
Codex alike. See [`agent-hooks.md`](agent-hooks.md).

## The rule about hooks

An agent may not bypass a hook (`--no-verify`) or edit hook config to make a
change land. If a hook is genuinely wrong, that is its own commit, with the
reason in the message — never a side effect of unrelated work.
