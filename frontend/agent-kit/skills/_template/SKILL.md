---
name: {{skill-name}}
description: {{What it covers}} — {{the two or three things it settles}}. Use before {{the action}}, and again when {{the recurring trigger}}.
---

> Template for a skill covering a hazard specific to your repo. Delete this
> block. Keep the whole file under ~70 lines: a skill is read mid-task, and one
> nobody finishes is one nobody follows.

## Frontmatter is the routing layer

`description` is the only part an agent sees before deciding to open the file,
so it must answer _when do I need this?_ — name the **trigger action**, not the
topic. `Use before rendering any timestamp` routes; `Date utilities` does not.

## What belongs in a skill (vs. a guide)

| Put it in a skill                                      | Put it in an area guide                      |
| ------------------------------------------------------ | -------------------------------------------- |
| A **procedure** with steps and an order                | A **fact** about how this area works         |
| Something read _before_ an action, then closed         | Something true of every change in the folder |
| Long enough that carrying it always would cost context | One or two lines                             |

If it is neither — if it is true everywhere and short — it belongs in the root
`AGENTS.md`.

## The shape that works

```markdown
<One-sentence statement of the defect this prevents, and when the pass runs.>

## 1. <First step, imperative>

<The rule.> <The reason, only when non-obvious.>

## 2. <The tell>

<How to recognize the mistake when it is silent — it compiles, it renders, it
works on the machine that wrote it.>

| <Bypass / mistake>      | <Caught by>                                            |
| ----------------------- | ------------------------------------------------------ |
| <the tempting shortcut> | <the lint rule, or "nothing — that's why this exists"> |

## 3. <Boundaries>

- <What this skill does NOT cover, and which skill or guide does.>
```

## Rules of thumb

- **Name the escape hatch and close it.** Every rule an agent can satisfy by
  silencing a linter needs an explicit "never silence it at the call site".
- **Say what is unenforced.** If no tool checks a rule, say so — that is exactly
  why the skill exists, and it tells the reader a green build proves nothing.
- **Cross-link, never restate.** Each rule has one owner; a second copy drifts.
- **Prefer the ✓/✗ pair** over a paragraph explaining the distinction.
