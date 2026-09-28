# Local-hazard rules — worked examples

The portable skills cover process. The rules that save the most time are the
opposite: narrow, local, and unguessable. They pay for themselves because the
mistake they prevent is **silent** — it compiles, it renders, and it is wrong
somewhere the author cannot see.

Use these as a shopping list. For each, ask "does this repo have one of these?"
and if yes, write it up with `skills/_template/SKILL.md` or in the area guide.

## A. Display formatted for the developer's own machine

**Class:** dates, times, numbers, currency formatted with the platform default
locale/zone instead of the user's preference. Correct on the machine that wrote
it, wrong for half the users, and invisible to a reviewer in the same timezone.

**What the rule needs:** the one module allowed to build a formatter; the hook
to call inside components and the factory to call outside; the _bypasses_ —
`toLocaleDateString()`, a call-site `Intl.DateTimeFormat`, `toISOString().slice(0,10)`
— each paired with the lint rule that catches it; and a flat "never silence the
rule at a call site — widen the formatter module instead".

**Why it must be a skill:** the correct call is one line, but knowing which of
five near-identical one-liners is correct takes a page.

## B. Inbound vs outbound shape asymmetry

**Class:** an API that _returns_ one format and _accepts_ another — RFC 3339 out,
zone-free `YYYY-MM-DDTHH:mm:ss` in; ids as strings out, numbers in. The
generated types say `string` for both, so nothing fails at compile time.

**What the rule needs:** the exact accepted form, the enumerated list of
endpoints and field names on it (including naming asymmetries like
`expire_at` vs `expires_at`), the input control that already produces the right
shape, and the round-trip that reintroduces the bug.

## C. Empty-body responses parsed as data

**Class:** deletes, revokes, cancels answering `204 No Content` while the
generated client calls `.value()` on the empty body and throws. The call
succeeded; the UI reports a JSON error.

**What the rule needs:** the tell in the generated file (a method typed
`Promise<object>`), the variant to call instead (the raw/unparsed form), and
why the tempting alternative — a catch-all "return null on parse failure"
helper — is worse: it swallows real failures after the fact, where the raw
variant never asks for a body at all.

## D. Generated code and regen hazards

**Class:** any folder rewritten wholesale by a generator.

**What the rule needs:** which paths are generated (never hand-edit — a regen
overwrites), where the contract actually lives, the prerequisites a fresh clone
or worktree lacks (a JDK, a token in a gitignored env file), how to scope a run
to one module, and the two hazards that surprise everyone:

- regeneration **reverts unstaged edits to tracked files** — commit in-progress
  work first;
- a full regen legitimately pulls unrelated contract changes — keep and flag
  them, don't revert.

Add: "before claiming a generated model lacks a field, re-read the generated
file" — models assert absence from memory with great confidence.

## E. Mirrored-from-upstream source

**Class:** files installed by a CLI from a registry, which must match upstream
**byte-for-byte** apart from a mechanical import-alias rewrite.

**What the rule needs:** the mirror rule stated absolutely ("local enhancements
are not wanted, even useful ones — treat any divergence as drift and delete it
to match"), the re-sync recipe (fetch the registry JSON, take the file content,
rewrite only the alias, overwrite, diff to prove the alias is the sole
difference), the interactive-install prompts where the answer is _keep existing_
(curated files like a shared `utils` or a global stylesheet), and the wiring the
CLI depends on that must not be "improved" (export maps, path aliases).

## F. Load-bearing config that looks removable

**Class:** an export map with a catch-all entry, a pre-paint inline script in
`index.html`, a `no-cache` header on two specific files, an ignore entry with a
reason. Tidy-minded agents delete these.

**What the rule needs:** a "do not improve — these are load-bearing" heading,
one line per item saying what breaks, and the pairing rule when two places must
stay in step (an atom's storage keys and the inline script that reads them).

## G. Caching rules with an operational reason

**Class:** service-worker precache scope, retry policies, poll intervals.

**What the rule needs:** the boundary and its reason in the same sentence — "the
worker precaches the app shell only; operational data must never be served from
a cache" — plus the paired rule for retries: retry only _transient_ failures
(network, timeout, 5xx, 429), never deterministic ones (4xx, parse errors), and
scope it per query rather than globally.

## H. "Empty is not an error"

**Class:** a `null` or empty success normalized into a thrown error, so the UI
shows a failure where it should show an empty state.

**What the rule needs:** normalize in the fetch layer (`response.result?.data ?? []`),
never throw to mean "no data", and keep loading/empty/error as three separate
branches.

## The pattern behind all eight

Each one is: **a mistake that passes every automated check**, plus **a tell**,
plus **the correct call**, plus **the tempting shortcut, named and closed**. If
a candidate rule has no tell — if the failure is loud — it does not need a
skill. Let the tooling catch it.
