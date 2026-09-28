# Area guides — template and rules

An area guide is a guide file sitting **in the folder it governs**, binding
exactly like the root `AGENTS.md`. It exists so a rule has one owner and so an
agent working in that folder gets the rule without carrying every other area's
rules in context.

## When a folder earns one

Write an area guide when the folder has rules that are **true there and false
elsewhere**. Typical earners:

| Area                   | The kind of rule it owns                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| The app layer          | Routing, imports/aliases, data fetching, loading & error states, product conventions     |
| Shared packages        | Which package a promoted thing belongs in, the last-resort bucket, framework-clean rules |
| Generated code         | What is generated vs hand-written, regen hazards, contract source of truth               |
| Design-system consumer | Where components come from, the mirror rule, the install ritual                          |
| Infra / deploy         | Environments, secrets, what a release actually does                                      |

Do **not** write one for a folder whose only rules are already in the root file,
and never restate a root rule in an area guide — link to it.

## Rules for writing one

1. **Open by scoping it**: "These rules extend the root `AGENTS.md` and apply to
   every change under `<path>`."
2. **One owner per rule.** If a rule is true repo-wide it belongs in the root
   file; if it belongs to an upstream source, link out and say upstream wins.
3. **Write the hazard, not the tour.** Every section should be something an
   agent would otherwise get wrong. A description of what the folder contains is
   the human doc's job.
4. **Give the tell.** Where a mistake is silent (it compiles, it renders, it
   works on your machine), say how to recognize it. That is what makes a guide
   worth reading twice.
5. **Prefer ✓/✗ pairs and small tables** over prose. They survive skimming.
6. Keep it under ~120 lines. Past that, the area has sub-areas, or a procedure
   inside it should become a skill.

## Template

```markdown
# <area>/ conventions

These rules extend the root `AGENTS.md` and apply to every change under
`<path>` (<the concrete members, if it is a glob>).

## <Subsystem> — <library or mechanism>

- <Rule, imperative.> <Why, only if non-obvious.>
- <The generated/derived file nobody may hand-edit, and what regenerates it.>
- <The API to use instead of the hand-rolled version.>

## Imports

- <The alias rule and its exact boundary, with a ✓ and a ✗ example.>
- <Who owns import order, and the command that fixes it.>

## <The thing that silently goes wrong here>

- <The failure.> <The tell.> <The fix.>

## Boundaries

- <What this area explicitly does NOT own, and which guide does.>
```

## Making both agent tools see it

Different agent tools look for different filenames. Keep one real file and
symlink the other, in every folder that has a guide:

```bash
ln -s CLAUDE.md AGENTS.md    # or the reverse; be consistent repo-wide
```

Exclude the symlink from formatters that resolve paths, or they will format the
same content twice and report a conflict.
