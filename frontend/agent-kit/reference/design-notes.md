# Design notes — why the kit is shaped this way

The eight principles the original setup encodes. Read these before rewriting any
of it for a new repo; each one is a reaction to a specific failure mode.

## 1. One owner per rule

A rule stated twice drifts, and the drift is silent — both copies look
authoritative. So: repo-wide facts live in the root guide, area facts live in
the area's own guide, procedures live in skills, and anything an upstream source
owns is fetched, not copied. Cross-link instead of restating.

The one deliberate exception is documented as an exception: `file-placement`'s
numbers are repeated in the root guide **because they are owed mid-task**, when
stopping to open a skill is least convenient — and the root guide says the skill
still owns them.

## 2. Read before, not after

A rule consulted after the code is written is a review; a rule consulted before
changes what gets written. Hence skills are described by their **trigger action**
("use before rendering any timestamp"), not by their topic, and the root guide
frames skipping one as a violation rather than an oversight.

## 3. A gate, not a wishlist

The compliance gate is a table of passes with an explicit "owed by" column, run
in order, restated in the reply. Two details make it work:

- **After any follow-up edit, all of it again.** Checked-then-changed is
  unchecked — this is where most agent handoffs actually rot.
- **Say in the reply that it ran and what it found.** An unreported pass is
  indistinguishable from a skipped one.

## 4. The gate may never be weakened

The single most valuable sentence in the root guide is the one forbidding
`eslint-disable`, `@ts-ignore`, broadened `ignores`, and rule deletion as ways
to make the gate pass. Without it, a red gate becomes a config diff — and the
next agent inherits a repo whose gate proves nothing.

Then make the sentence redundant wherever a tool can hold it: the directive
comment is a lint error, the push runs the whole gate, a file past the ceiling
fails the check, and an agent hook — under Claude Code or Codex — denies the
bypass at the tool call and holds an edit to the gate's own config for a human.
The guide still says it — the hook is what makes it true when the guide was not
read.

## 5. Upstream outranks memory

Model knowledge is stale by construction. Anything regenerated elsewhere — a
design system, a package registry, an API contract — must be **fetched at use
time**, and the guide must say what to do when the fetch fails: mark the
dependent work _unverified_, never fall back to recollection. Same reflex for
version numbers: check the registry, don't assert a "latest".

## 6. Name the tell for silent mistakes

The rules worth writing down are the ones whose violations look fine: a
timestamp formatted in the developer's own timezone, a `204` response parsed as
JSON, a skeleton that doesn't match the table it precedes. Each such rule gets
**the tell** — how to spot it — and, where a linter can catch it, the rule's
name plus an explicit "never silence it at the call site".

## 7. Say what nothing enforces

`code-quality` states outright which half of file length the tooling holds —
the hard ceiling — and that the review target above it is measured by nobody,
so it is reported there or not at all. `commit-message` states that the hook
validates shape only, so scope and type accuracy are decided by the skill. The
agent-hooks doc says the same of the hooks: they know a skill was opened, not
that it was applied. This calibrates the agent: a green build is not evidence
about anything the tooling never measured.

## 8. Reuse is a pass, not a virtue

"Don't duplicate code" is unactionable. `reuse-before-new` turns it into a
procedure with a search order (private co-located folders first — that's where
shared-looking code actually hides), a promotion rule (hoist one level, widen
with a prop, **update the original call site**), and an explicit exception
clause the agent must invoke out loud. The search order is the part to re-derive
per repo; the rest ports as-is.

## What deliberately isn't here

- **Style rules a formatter owns.** Prettier settles them; writing them down
  again just gives an agent something to get wrong.
- **A tour of the repo layout.** That is the human doc's job, and it goes stale
  fastest. The guide links to it.
- **Anything only sometimes relevant.** It becomes an area guide or a skill —
  the root file is read on every task, so its length is a tax on every task.
