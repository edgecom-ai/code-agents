---
name: reuse-before-new
description: The mandatory search-and-promote pass before writing any new component, hook, query, type, or helper in this repo. Use whenever you are about to create one, or when a near-match exists and you are tempted to fork it.
---

Two copies of the same logic is a defect even when both copies work. This pass
runs **before** you write the new thing, not as a cleanup afterwards.

## 1. Prefer what already exists

Use an existing framework API, an installed dependency, or a repo utility before
hand-rolling what it already does. Check the framework docs for the version
actually installed before concluding you need custom code.

## 2. Search by behavior, not by name

Search the whole repo for what the thing _does_, not the name you were about to
give it — the existing version was almost certainly named differently. Search
order, most-likely first:

1. **The private, co-located folders of adjacent features** ({{`-components/`,
   `_internal/`, whatever this repo uses}}). This is where shared-looking code
   actually lives: it landed there when the first caller needed it and never got
   hoisted. Table controls, status pills, dialog shells, formatters, empty
   states, page-size selects — look here first.
2. The app's own shared folders ({{`src/components/`, `src/state/`}}).
3. Shared packages ({{`{{SHARED_PREFIX}}*`}}).
4. The **upstream catalog**, if one exists ({{fetch `{{ENTRY_POINT_URL}}`}}).
   It ships more than this repo has installed, so "not in our shared package" is
   not "not available"; if it is listed there, install it rather than writing
   one.

Search for the behavior and for the props or CSS it would need, across **every**
app in the repo — sibling apps solve the same problems and one usually got there
first.

## 3. Promote and reuse — never fork

When you find a match, including a near-match:

- Hoist it to the nearest shared home both callers can import — one level up
  from the two consumers, no higher.
- Widen it with a prop or a generic to cover the new case.
- **Update the original call site** in the same change. Leaving the old copy
  behind converts a reuse into a fork.
- Never reach into another feature's private folder by path. If you need what is
  in it, hoist it first.

A near-miss is a reason to generalize, not to copy. If the new caller's needs
really are different in kind, make that difference explicit in the name so the
next person doesn't merge them back by mistake.

## 4. Writing new is the exception

Write something new only when the search genuinely comes up empty, or when
reusing the existing code would spread a rule violation. Say which of the two
applies — an unexplained new file reads as a skipped search.
