# Adoption checklist

Porting the kit into a new codebase. Roughly an hour for the first pass; the
local-hazard skills accrue afterwards, one per bug that got shipped twice.

## 1. Copy the files

```bash
cp  agent-kit/AGENTS.md                              <repo>/AGENTS.md
ln -s AGENTS.md                                      <repo>/CLAUDE.md
mkdir -p <repo>/.claude/skills
cp -R agent-kit/skills/*                             <repo>/.claude/skills/
rm -rf <repo>/.claude/skills/_template               # keep it only if you'll write more skills
ln -s .claude                                        <repo>/.codex
mkdir -p <repo>/scripts
cp -R agent-kit/enforcement/agent-hooks              <repo>/scripts/agent-hooks
cp    agent-kit/enforcement/git-hooks/*.mjs          <repo>/scripts/
cp    agent-kit/enforcement/file-length/*.mjs        <repo>/scripts/
echo '{ "exceptions": [] }'                        > <repo>/.file-length-exceptions.json
```

Delete any skill whose subject the repo does not have — a UI review skill in a
CLI repo is noise that teaches agents the guides are optional.

## 2. Fill the placeholders

Grep for `{{` when you think you're done; nothing may remain.

| Placeholder                                         | What it is                                                   | Example                                                      |
| --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `{{HUMAN_DOC}}`                                     | The human-facing doc the guide defers to                     | `README.md`                                                  |
| `{{FORMAT_CMD}}`                                    | Formatter, run before the gate                               | `pnpm format`                                                |
| `{{GATE_CMD}}`                                      | The full verification chain                                  | `pnpm check && pnpm lint && pnpm format:check && pnpm build` |
| `{{FILE_LENGTH_CMD}}`                               | The file-length ceiling check, inside the gate               | `pnpm check:file-length`                                     |
| `{{PM}}` / `{{GENERATED_GLOB}}`                     | Package manager, and the generated files the lint hook skips | `pnpm`, `routeTree.gen.ts`                                   |
| `{{INSTALL_CMD}}`                                   | Install command                                              | `pnpm install`                                               |
| `{{DEV_CMD}}` / `{{SCOPE_CMD}}` / `{{AUTOFIX_CMD}}` | The three commands agents actually type                      | `pnpm dev`                                                   |
| `{{DISABLE_PRAGMAS}}`                               | The blanket-disable comments to name and ban                 | `eslint-disable`, `@ts-ignore`                               |
| `{{BUILD_TOOL}}`                                    | Task runner                                                  | Turborepo, Nx, Make                                          |
| `{{SKILLS_DIR}}`                                    | Where skills live                                            | `.claude/skills/`                                            |
| `{{AGENT_HOOKS_DIR}}`                               | Where the agent hook scripts live                            | `scripts/agent-hooks/`                                       |
| `{{AREA_N_PATH}}`                                   | Folders that earn an area guide                              | `apps/`, `packages/api/`                                     |
| `{{SHARED_PREFIX}}`                                 | Import prefix for shared packages                            | `@repo/`                                                     |
| `{{EXTERNAL_SOURCE}}` / `{{ENTRY_POINT_URL}}`       | The upstream authority and its entry doc                     | a design system's `llms.txt`                                 |
| `{{FILE_LINES}}`                                    | Hand-written file target, held by review                     | 350                                                          |
| `{{FILE_CAP}}`                                      | Hard ceiling, held by the checker                            | 500                                                          |
| `{{FOLDER_FILES}}`                                  | Split-the-folder threshold                                   | 8                                                            |
| `{{LANGUAGE}}` / `{{FRAMEWORK}}` / `{{TSCONFIG}}`   | Stack line in the root guide                                 | TypeScript / React                                           |
| `{{COMMIT_LINTER}}` / `{{HOOK_RUNNER}}`             | Message and hook enforcement                                 | commitlint, lefthook                                         |
| `{{LOCAL_SKILL}}`                                   | Your first repo-specific skill                               | —                                                            |

Values in `{{double braces}}` inside skill bodies are _illustrative_, not
required: replace them with your repo's real folders and commands, or drop the
sentence if the repo has no equivalent.

## 3. Decide the gate honestly

The gate is the load-bearing part. It must be:

- **Runnable locally, in one line**, and fast enough that an agent will actually
  run it before every handoff.
- **Complete** — file length, types, lint, format, build. A gate that skips the
  build lets agents hand off code that does not compile in CI; one that skips
  the ceiling lets files grow until nobody can split them.
- **Unweakenable by policy** — the root guide must say, in words, that widening
  an ignore list or adding a blanket disable is a violation. Without that
  sentence, a failing gate becomes a config edit.

If some part cannot run locally (a Java-based generator, a licensed tool, an
auth-pinned dev server), say so in the guide and tell agents to report the exact
command and failure rather than silently skipping it.

## 4. Write the area guides

One per folder with rules that are true there and false elsewhere. Use
`guides/area-guide-template.md`, and link each from the root guide's _Area
guides_ list — an unlinked guide is one nobody opens.

## 5. Wire the enforcement layer

See `enforcement/git-hooks.md`. Aim for: format and lint on staged files at
commit, message shape at commit-msg, and at pre-push the merge-commit check,
the file-length ceiling, then the **full gate** — the same `{{GATE_CMD}}` the
root guide owes, so a push cannot skip a step. Make the directive-comment ban a
lint error while you are in the linter config, and put the ceiling in the gate
per `enforcement/file-length.md`.

Then `enforcement/agent-hooks.md`: copy the scripts, fill in `constants.mjs`
(your gate's config files, source roots, skill names, gate commands, root
marker), point `.claude/settings.json` (Claude Code) and `.claude/hooks.json`
(Codex, via the `.codex` symlink) at them, run their tests, and review the hook
hashes in each host's `/hooks` before the first session. Everything neither
layer can check is what the skills are for — and the skills should say which of
the three they are.

## 6. Seed the first local-hazard skill

Every codebase has at least one "works on my machine, wrong in production"
class. Find it (ask: what got fixed twice?) and write it up with
`skills/_template/SKILL.md`. See `local-hazard-skills.md` for worked examples.

## 7. Verify with a cold agent

Open a fresh session and give it a small, real task. Watch for:

- Did it announce the passes it ran, per the gate's "say in the reply" rule?
- Did it open the skills it owed _before_ writing, or cite them afterwards?
- Did it invent something a guide already answers? That guide is buried or too
  long — fix the guide, don't repeat yourself in chat.
- Did a hook fire, and did the agent do what the denial said rather than
  argue with it? A denial nobody sees is a hook that is not wired.
