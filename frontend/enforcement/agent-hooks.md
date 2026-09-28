# Agent hooks — the gate at the tool call

Git hooks catch a violation at commit or push, after the agent wrote it. Agent
hooks run at the tool call itself, so the same rules can stop the action — and
a denial arrives as feedback the agent acts on in the same turn, which is the
cheapest possible moment to correct it.

The scripts in [`agent-hooks/`](agent-hooks/) are the working set from the
original repo, Node only, no dependencies, and one policy runs unchanged under
both **Claude Code** and **Codex**. `constants.mjs` is the one file an adopter
edits; the guards import from it and stay as they are.

## The hooks

| Hook                   | Event                                                    | Decides                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guard-bash`           | `PreToolUse` on `Bash`                                   | **deny** a hook bypass (`--no-verify` on a git command, a blind force push, a hook runner's skip variable in front of a git command, `--no-inline-config`); **deny** a shell write into a source file that carries a suppression comment; **ask** before a shell write touches the gate's own config; **deny** `git commit` and `pnpm add`-style commands until the matching skill was read |
| `guard-edit`           | `PreToolUse` on the edit tools (`apply_patch` for Codex) | **deny** a suppression comment written into a source file; **ask** before any edit to the gate's own config; **deny** a new source file until `file-placement` and `reuse-before-new` were read, and a dependency-manifest edit until `dependency-policy` was; a many-file patch is judged by its strictest file                                                                            |
| `stop-gate`            | `Stop`                                                   | **block** ending a turn that edited source unless every gate step ran afterwards, naming the missing ones; fires once per handoff (`stop_hook_active`), never in a loop                                                                                                                                                                                                                     |
| `session-history-hook` | `PostToolUse` and `SessionEnd`, Codex only               | records the gate facts each call established to a private journal, and removes the journal when the session ends                                                                                                                                                                                                                                                                            |

A force push that checks the remote first is not a bypass: `--force-with-lease`
and `--force-if-includes` abort when the remote moved, which is the only thing a
blind force skips. Re-pushing a branch you just rebased is the one honest use
of a force, and that is the form the guard allows.

"Read" is detected from the session's history: a `Skill` invocation, or any
tool pointed at the skill's `SKILL.md` path — a `Read`, a shell command that
printed it, Codex's file reader. So a denial is cleared by opening the named
skill and retrying — which is exactly the behaviour the root guide asks for.

## Wire them

Claude Code reads `.claude/settings.json`; Codex reads `.codex/hooks.json`. Keep
both configs and the skills one copy with a symlink (`ln -s .claude .codex`) so
they cannot drift apart — the settings file and the hooks file then sit side by
side in `.claude/`.

```json
// .claude/settings.json — Claude Code, project scope, committed
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/{{AGENT_HOOKS_DIR}}/guard-bash.mjs",
            "timeout": 10
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/{{AGENT_HOOKS_DIR}}/guard-edit.mjs",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/{{AGENT_HOOKS_DIR}}/stop-gate.mjs",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

```json
// .claude/hooks.json — Codex, reached as .codex/hooks.json through the symlink
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)\"/{{AGENT_HOOKS_DIR}}/guard-bash.mjs --host=codex",
            "timeout": 10,
            "statusMessage": "Checking the command against the root guide"
          }
        ]
      },
      {
        "matcher": "^(?:apply_patch|Edit|Write)$",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)\"/{{AGENT_HOOKS_DIR}}/guard-edit.mjs --host=codex",
            "timeout": 10,
            "statusMessage": "Checking the patch against the root guide"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)\"/{{AGENT_HOOKS_DIR}}/session-history-hook.mjs --host=codex",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)\"/{{AGENT_HOOKS_DIR}}/session-history-hook.mjs --host=codex --cleanup",
            "timeout": 3
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)\"/{{AGENT_HOOKS_DIR}}/stop-gate.mjs --host=codex",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

Keep the scripts under a linted, formatted, length-checked folder (the original
uses `scripts/agent-hooks/`, next to the other repo scripts) rather than under
`.claude/`, which formatters usually ignore — the enforcement code should itself
pass the gate it enforces. Add `node --test {{AGENT_HOOKS_DIR}}/guards.test.mjs`
to the PR workflow beside any other script tests, and expose it as a package
script (the original: `pnpm test:agent-hooks`).

## Two hosts, one policy

Only the policy is shared verbatim; the two hosts describe the same events
differently, so two files translate:

- **`hosts.mjs`** normalizes what a hook is handed — which host (`--host=codex`
  or none), the file and the added text of every edit, and the repo root, walked
  up from the session's directory to `WORKSPACE_MARKER` (the checkout for Claude
  Code, but possibly any package under it for Codex).
- **`session-history.mjs`** normalizes what the session has already done: which
  calls edited source, which gate steps ran, which skills were opened.

The differences they absorb:

- **Edits.** Claude Code names the file and the new text in separate fields.
  Codex calls every edit `apply_patch` and hands over the whole patch as one
  string, so the guard reads the paths and the added lines back out of it (a
  `Move to:` destination counts as a new file) and judges a multi-file patch by
  its strictest file.
- **Asking a human.** Codex rejects `permissionDecision: "ask"` as unsupported
  and lets the call through, so an "ask" fails closed there as a **manual-only
  denial**: a human makes the reviewed policy change outside Codex. Under
  Claude Code it is a real prompt in the default permission mode; in auto mode
  the classifier answers it, so run in default mode when the gate itself is
  what you are changing.
- **Session history.** Claude Code's transcript is a stable record and the
  hooks read it directly. Codex documents its own as unstable, so the
  `PostToolUse` hook appends only the gate facts each call established to a
  private journal under the OS temp directory (directory `0700`, file `0600`);
  raw commands, patches, and tool inputs are never copied, and `SessionEnd`
  removes the file. Each entry carries a digest of the policy regexes it was
  judged by, so changing a rule retires the entries it judged instead of
  needing a version bump.
- **Trust.** Codex trusts the exact current hash of each hook definition, so
  every new or changed definition must be reviewed there (`/hooks`) before it
  runs. Claude Code shows the same list under `/hooks`. A personal opt-out
  belongs in `.claude/settings.local.json`, never in a committed file.

## Fill in `constants.mjs`

| Constant                                                         | What to put there                                                                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATE_CONFIG`                                                    | Every file that defines the gate: both hook configs, linter and compiler base config, the length policy and its exceptions, the guides, the skills, the hook scripts |
| `SOURCE_ROOT` / `SOURCE_FILE`                                    | Where source lives and what counts as a source file                                                                                                                  |
| `SKILLS_BEFORE`                                                  | Your skill names, keyed by the action that owes them                                                                                                                 |
| `GATE_STEPS`                                                     | The steps of `{{GATE_CMD}}` as they appear in a shell command — every one must run after the last edit                                                               |
| `DEPENDENCY_FILE` / `DEPENDENCY_COMMAND`                         | Your manifest names and your package manager's add/remove verbs                                                                                                      |
| `HOOK_BYPASS`                                                    | Add your hook runner's skip variable if it is not lefthook or Husky                                                                                                  |
| `WORKSPACE_MARKER`                                               | The file that marks your repo root (`pnpm-workspace.yaml`, `package.json`, …)                                                                                        |
| `SKILL_DOCUMENT`, `PATCH_FILE_DIRECTIVE`, `PATCH_MOVE_DIRECTIVE` | Protocol, not policy — leave them                                                                                                                                    |

One value lives outside `constants.mjs`: the journal folder name in
`session-history.mjs` (`agent-hooks-journal`) and the matching path in the
test. Rename both to your repo.

The tests in `guards.test.mjs` name real paths from the original repo as
fixtures (an existing source file, a gate config file, a skill). Point them at
your equivalents; the suite should pass before the hooks go live.

## Three behaviours to know

- **Prose is allowed.** The suppression check fires only on a write that names
  a source file, and the bypass check only on a git command that carries the
  flag — a README that documents `--no-verify` still saves. The tests spell
  forbidden tokens in fragments for the same reason: the shell command that
  writes the test file is itself scanned.
- **`ask` needs a human.** Under Codex it is a manual-only denial (above); under
  Claude Code, run in default mode when the gate itself is what is changing.
- **The journal holds facts, not content.** A Codex session's history is three
  booleans-worth per call — source edit or not, which gate steps, which skills.
  Nothing an agent typed is written anywhere the host did not already keep it.

## What stays with the skills

The hooks hold the mechanical half: was the skill opened, did the gate run,
was a bypass typed. Whether the skill was _applied_ — the file landed in the
right folder, the scope is the narrowest accurate one, nothing was forked — is
still the skill's judgment and the reply's report. A green hook is not evidence
about anything it never measured.
