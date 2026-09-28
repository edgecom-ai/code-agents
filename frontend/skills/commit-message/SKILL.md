---
name: commit-message
description: Write a commit message (or PR title) for this repo — Conventional Commits with the narrowest accurate scope. Use before `git commit`, when revising a message, and whenever a reply has to suggest one.
---

Conventional Commits are enforced by {{COMMIT_LINTER}} via the `commit-msg`
hook, on a rebase-only workflow — `git commit -m` on a non-compliant message
fails the hook, it is not a style preference.

The hook only validates the **shape**: that a type exists and the subject is
present and cased right. Everything below — whether the scope is the narrowest
accurate one, whether the type matches what the change does — is unchecked by
any tool. A passing hook says nothing about it, so it gets decided here.

## Shape

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`,
`chore`, `style`, `revert`. Pick by what the change does for a reader of the
log, not by which files moved — a rename that changes no behavior is
`refactor`, a fix to a component you also renamed is still `fix`.

## Scope — the narrowest accurate thing

The scope names the **feature, route, or component the change touches**, not the
app or package that contains it. Ask: what would a reader grep for to find this
change again? That is the scope.

| Change                                      | ✓                     | ✗                    |
| ------------------------------------------- | --------------------- | -------------------- |
| A select inside a request-access dialog     | `fix(request-access)` | `fix({{app}})`       |
| Row-click handling in the shared data table | `fix(table)`          | `fix({{app}})`       |
| A detail drawer                             | `refactor(detail)`    | `refactor({{area}})` |
| Every app's color-theme state               | `feat(theme)`         | —                    |

Reach for a package- or app-wide scope ({{`api`, `ui`, `auth`, `build`}}) only
when the change really is that wide — a build config, a
package-wide regen, a cross-cutting provider. One narrow scope beats a broad one
plus a subject that re-explains where the change lives.

Touching two unrelated areas is a sign the work should be two commits. When it
genuinely is one change spanning areas, scope it to the shared concept the
change serves, not to a list.

## Subject

Imperative mood, lower case, no trailing period, under ~72 chars total. Say what
the change makes true, not what you did: `show region labels in selects` ✓,
`fixed the select bug` ✗. Do not restate the scope in the subject.

Add a body only for the non-obvious _why_ — a constraint, a rejected
alternative, an upstream quirk. `BREAKING CHANGE:` in the footer when a shared
package's API changes.
