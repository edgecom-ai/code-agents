---
name: dependency-policy
description: Add, bump, or remove a dependency in this repo — where the version lives, install-script policy, and what must pass afterwards. Use before editing any dependency manifest or running an add command.
---

## One source of versions

> Single-package repos: keep only the "Verify" section and the "Leave these
> alone" list; delete the rest.

A version used by **2+ workspace packages** lives in the shared version block
({{`catalog:` in `pnpm-workspace.yaml`}}), and each manifest references it by
the placeholder string rather than a literal range:

```yaml
# {{pnpm-workspace.yaml}}
catalog:
  react: ^19.2.7
```

```json
// {{apps/<app>/package.json}}
"dependencies": { "react": "catalog:" }
```

When you add a dep that a second package already has — or bump one that is
already shared — update the shared entry, never the per-package range. When you
add a dep to a second package and find its version pinned inline in the first,
move it to the shared block and switch both call sites over as part of the
change.

A dep used by exactly one package stays pinned in that package's own manifest.
Don't pre-share on the guess that another package will want it.

## Install scripts are opt-in, explicitly

{{Any dep that ships install/build scripts must appear in the `allowBuilds`
block as `true` or `false`. Omitting it fails install outright with
`ERR_PNPM_IGNORED_BUILDS` — this is not a warning.}} Default to **denying** the
build; allow it only when the package is genuinely broken without it (native
bindings, a downloaded binary).

## Leave these alone

- {{`minimumReleaseAge: 0` is deliberate during active development. Leave it
  until the note in the file says otherwise.}}
- Do not add a dependency to work around a rule in `AGENTS.md` or an area guide.
  Check the shared packages and the existing dep list first — see the
  `reuse-before-new` skill.
- Do not bump an unrelated dependency in the same change. A lockfile diff nobody
  asked for is its own commit, or nobody's.

## Verify

Version knowledge goes stale: check the package registry for what actually
exists before writing a range — never assert a "latest" from memory. After any
dependency change, `{{INSTALL_CMD}}` must succeed and the full gate
(`{{GATE_CMD}}`) must pass — a version typo surfaces as a resolution error, not
a type error.
