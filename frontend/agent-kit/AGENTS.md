# AGENTS.md

> Template. Fill every `{{PLACEHOLDER}}`, delete every section that does not
> apply, and delete this block. Keep the result under ~150 lines — this file is
> read on every task, so anything that is only _sometimes_ relevant belongs in
> an area guide or a skill.

The normative rulebook for coding agents here. `{{HUMAN_DOC}}` (e.g. `README.md`)
is the human-facing tour and owns the layout tree, script list, env setup,
git-hook details, and deploy — go there for that depth rather than expecting a
copy.

## Agent compliance gate

A change is not complete or ready to merge if it violates this file or the area
guide covering it. Repository patterns override generic framework advice; keep
changes scoped, and never rewrite unrelated files or revert user work.

Every handoff owes these passes, in order. No exemption for small changes, and
all of them again after **any** follow-up edit — checked-then-changed is
unchecked. Say in the reply that they ran and what they found.

| Pass                                                                   | Owed by                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| `reuse-before-new` skill — checks nothing was re-implemented or forked | any new component, hook, query, type, or helper |
| `file-placement` skill — checks where the files landed                 | any change that adds or moves a file            |
| `code-quality` skill — reviews the diff                                | every code change                               |
| `ui-drift-check` skill — reviews the UI                                | any change that renders                         |
| `{{FORMAT_CMD}}`, then `{{GATE_CMD}}`                                  | every code change                               |

Never pass the gate by weakening configs, deleting rules, broadening `ignores`,
adding blanket disables (`{{DISABLE_PRAGMAS}}`), or hiding errors. If a command
cannot run locally, report the exact command, failure, and risk.

Lifecycle hooks in `{{AGENT_HOOKS_DIR}}` enforce the mechanical part of this,
wired for both Claude Code and Codex (`{{HUMAN_DOC}}` → "Agent guardrails"). A
hook denial is the rule applied, not an obstacle: do what its message says. An
edit it holds for confirmation changes the gate itself and waits for the human —
under Codex that is a manual-only denial, because a hook cannot raise the
prompt.

## Area guides (nested guide files)

Domain rules live next to the code they govern and bind exactly like this file.
Each is reachable as `AGENTS.md` in the same folder:

- `{{AREA_1_PATH}}` — {{one line on what it owns}}
- `{{AREA_2_PATH}}` — {{one line}}
- `{{AREA_3_PATH}}` — {{one line}}

## {{EXTERNAL_SOURCE}} starts at {{ENTRY_POINT}}

> Keep this section only if some authority outside the repo owns a class of
> answers — a design system, an API contract, a shared platform doc. Delete it
> otherwise.

Every {{EXTERNAL_SOURCE}} question — {{examples of what it settles}} — starts by
fetching <{{ENTRY_POINT_URL}}> and acting on the document it routes you to,
never on the index's blurb. {{Authoring upstream is out of scope.}}

Never answer one from memory or from a restatement here — upstream is
regenerated and therefore newer, and these guides carry only what is **specific
to this codebase** so each rule has one owner. Report a genuine conflict rather
than reconciling it silently. If the fetch is unavailable, say so and mark what
depended on it **unverified** instead of falling back to memory.

## Commands and layout

{{BUILD_TOOL}} runs every task from the repo root; `{{HUMAN_DOC}}` has the full
list.

```bash
{{DEV_CMD}}          # {{what it starts, on which ports}}
{{SCOPE_CMD}}        # scope any task to one package
{{AUTOFIX_CMD}}      # auto-fix and sort imports
```

{{One short paragraph: what lives where, what each top-level folder owns, and
the one constraint that follows from it — e.g. "shared code is consumed as raw
source with no build step, so keep it framework-clean and side-effect-free".}}

## Task skills (`{{SKILLS_DIR}}`)

Procedural rules that bind exactly like this file. Read the skill **before**
doing the thing it covers — none are optional, and skipping one is a violation:

| Skill                   | Read it before                                                         |
| ----------------------- | ---------------------------------------------------------------------- |
| `reuse-before-new`      | writing any new component, hook, query, type, or helper                |
| `file-placement`        | creating or moving a file, or splitting one past ~{{FILE_LINES}} lines |
| `dependency-policy`     | touching any dependency manifest                                       |
| `code-quality`          | running the gate — the diff review (see the compliance gate)           |
| `ui-drift-check`        | handing off UI — the design review (same table)                        |
| `commit-message`        | writing a commit message or PR title                                   |
| `implement-from-design` | building UI from a design file                                         |
| `{{LOCAL_SKILL}}`       | {{the repo-specific hazard it covers}}                                 |

`file-placement` is owed mid-task, when stopping to read it is least convenient,
so its load-bearing numbers are repeated here — it still owns them and settles
anything they leave open. Split a folder along real sub-domains past roughly
**{{FOLDER_FILES}} files**; group by domain, never by kind (`table/` ✓,
`hooks/` ✗, `utils/` ✗); **no barrel or `index` files**; keep hand-written files
near **{{FILE_LINES}} lines**.

## {{LANGUAGE}} / {{FRAMEWORK}}

- Strict mode via `{{TSCONFIG}}`. No `any`; type props explicitly rather than
  using a catch-all component type.
- Name things for what they mean — never a term reused for something it isn't or
  a flag named like data. No hardcoded wording, no unexplained magic numbers.
- Let the code explain itself; comments are a last resort — keep the non-obvious
  _why_, never a restatement of _what_. Enforced by `code-quality`.

## Git workflow

{{Commit convention}} enforced by {{COMMIT_LINTER}} + {{HOOK_RUNNER}}, on a
{{rebase-only}} workflow (hooks and a server-side linear-history rule block
merge commits). Details in `{{HUMAN_DOC}}`; message shape in the
`commit-message` skill. A push the pre-push hook or the host rejects is fixed
by rebasing onto the main branch, never by `--no-verify` or a bare force —
follow `{{HUMAN_DOC}}` → "Blocked by a rule?".
