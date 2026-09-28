# Agent Kit — a portable coding-agent rulebook

A repo-neutral extraction of the agent configuration this codebase runs on: one
normative root guide, nested area guides, a set of task skills that agents must
read **before** doing the thing they cover, and the hooks that hold the
mechanical part of the rules under Claude Code and Codex alike.

Nothing here names a product, a stack, or a design system. Every
codebase-specific value is a `{{PLACEHOLDER}}` you fill in once. Copy the folder
into a new repo, answer the placeholders, delete what does not apply.

## What's in here

| Path                               | What it is                                                               |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `AGENTS.md`                        | The root rulebook template — the one file every agent reads first.       |
| `guides/area-guide-template.md`    | Template + rules for the nested per-area guides.                         |
| `skills/`                          | Seven task skills, drop-in as `.claude/skills/<name>/SKILL.md`.          |
| `skills/_template/SKILL.md`        | How to write a new skill for a hazard specific to your repo.             |
| `reference/adoption-checklist.md`  | Port this into a new codebase, step by step, with the placeholder table. |
| `reference/design-notes.md`        | Why the setup is shaped this way — the principles behind it.             |
| `reference/local-hazard-skills.md` | Worked examples of repo-specific rules, so you can spot yours.           |
| `enforcement/git-hooks.md`         | The git-hook layer: staged-file fixes, message shape, the gate on push.  |
| `enforcement/git-hooks/`           | The pre-push merge-commit check as a drop-in script.                     |
| `enforcement/file-length.md`       | The hard file-length ceiling: rules, exceptions manifest, wiring.        |
| `enforcement/file-length/`         | That checker, its policy module, and their test suite.                   |
| `enforcement/agent-hooks.md`       | Hooks that apply the gate at the tool call, for Claude Code and Codex.   |
| `enforcement/agent-hooks/`         | Those hooks as drop-in scripts with their test suite.                    |

## The shape in one paragraph

A single root `AGENTS.md` carries what is true everywhere: the **compliance
gate** (the passes every handoff owes), where the area guides live, and the
language and naming rules. Domain rules live in **nested guides next to the code
they govern**, so each rule has exactly one owner. Procedural rules too long to
keep in context — and which must be read _before_ acting rather than recalled
afterwards — are **skills**, loaded on demand. Anything an upstream source owns
(a design system, an API contract) is fetched at use time and **outranks** any
restatement in the repo. Whatever a tool can check — a bypass flag, a
suppression comment, a skipped gate step, a file past the ceiling — a **hook**
checks, so the guides carry only what needs judgment.

## Install into a new repo

```
<repo>/
├── AGENTS.md                        ← from AGENTS.md here, placeholders filled in
├── CLAUDE.md                        ← symlink to AGENTS.md (or vice versa)
├── apps/AGENTS.md                   ← from guides/area-guide-template.md
├── packages/AGENTS.md               ← ditto, one per area that earns one
├── .claude/skills/<name>/SKILL.md   ← from skills/ here
├── .claude/settings.json            ← Claude Code hook wiring, see enforcement/agent-hooks.md
├── .claude/hooks.json               ← Codex hook wiring, same doc
├── .codex                           ← symlink to .claude, so both hosts share one copy
├── .file-length-exceptions.json     ← { "exceptions": [] }, see enforcement/file-length.md
└── scripts/
    ├── agent-hooks/                 ← from enforcement/agent-hooks/ here
    ├── check-no-merge-commits.mjs   ← from enforcement/git-hooks/
    └── check-file-length.mjs, file-length-policy.mjs, check-file-length.test.mjs
                                     ← from enforcement/file-length/
```

Claude Code reads `CLAUDE.md`; other agent tools read `AGENTS.md`. Keep one real
file and symlink the other so they cannot drift apart, and exclude the symlink
from any formatter that follows paths. The same goes for `.codex` → `.claude`:
one set of skills and hook scripts, two hosts.

Full sequence, including what to fill in and what to delete:
[`reference/adoption-checklist.md`](reference/adoption-checklist.md).

## Three rules that make the rest work

1. **Read the skill before the action, not after.** A skill consulted after the
   code is written is a review; the point is to change what gets written.
2. **Never pass the gate by weakening it.** Broadening an ignore list, adding a
   blanket disable, or deleting the failing rule is a violation, not a fix.
3. **Make the rule mechanical where a tool can hold it.** A directive comment is
   a lint error, the push runs the whole gate, a file past the ceiling fails
   the check, and an agent hook denies the bypass at the tool call — so the
   guides carry only what needs judgment.
