// Template. Everything an adopting repo changes lives in this one file; the
// guards import from it and stay as they are. Review, in order: GATE_CONFIG
// (the files that define your gate), SOURCE_ROOT (where source lives),
// SKILLS_BEFORE (your skill names), GATE_STEPS (your package manager and gate
// commands), then the commands DEPENDENCY_COMMAND and COMMIT_COMMAND match,
// and WORKSPACE_MARKER (the file that marks your repo root). The Codex patch
// directives and SKILL_DOCUMENT are protocol, not policy — leave them.

// Comments that switch a rule off at one call site.
export const SUPPRESSION_DIRECTIVE =
  /eslint-(?:disable|enable)\b|@ts-(?:ignore|nocheck)\b/v;

// Shell shapes that put text into a file, so a suppression inside a heredoc or
// a redirect is caught where the Edit tool never sees it. Only a write that
// names a source file counts — docs may quote the comments they forbid.
// A redirect to another descriptor or to /dev/null discards output rather than
// writing a file, so a gate run like `pnpm build 2>&1` is not an edit.
export const SHELL_WRITE =
  /<<|>>?\s*(?!&|\/dev\/null)\S|\btee\b|\bsed\s+-[A-Za-z]*i/v;
export const SHELL_SOURCE_TARGET = /\S\.(?:c|m)?(?:j|t)sx?\b/v;
export const SHELL_PATH_TOKEN = /[\w\-.\/@]+/gv;

// Ways past the git hooks or the push rules, matched on the git command that
// carries them so prose about a flag stays allowed. `--force-with-lease` and
// `--force-if-includes` are not among them: they abort when the remote moved,
// which is the only thing a blind force skips. README → "Blocked by a rule?".
export const HOOK_BYPASS = [
  /\bgit\s+(?:commit|push|merge|rebase|cherry-pick|revert|am)\b[^\n&;\|]*--no-verify\b/v,
  /\bgit\s+push\b[^\n&;\|]*\s(?:-f|--force(?!-with-lease|-if-includes))\b/v,
  /\b(?:LEFTHOOK(?:_EXCLUDE)?|HUSKY)=\S*\s+(?:\S+\s+)*?git\b/v,
  /\beslint\b[^\n&;\|]*--no-inline-config\b/v,
];

// The gate's own definition. Editing one is a policy change a human approves,
// never a step in passing the gate.
export const GATE_CONFIG = [
  /^\.claude\/(?:settings|hooks)\.json$/v,
  /^\.claude\/skills\//v,
  /^\.codex\//v,
  /^\.file-length-exceptions\.json$/v,
  /^\.github\/workflows\/quality\.yml$/v,
  /^\.prettierignore$/v,
  /^(?:.*\/)?CLAUDE\.md$/v,
  /^(?:.*\/)?eslint\.config\.js$/v,
  /^commitlint\.config\./v,
  /^lefthook\.yml$/v,
  /^packages\/config\//v,
  /^scripts\/(?:agent-hooks\/|check-|file-length-policy)/v,
];

export const SOURCE_FILE = /\.(?:c|m)?(?:j|t)sx?$/v;
export const SOURCE_ROOT = /^(?:apps|packages|scripts)\//v;

// A skill counts as read once its document was opened, whoever opened it:
// Claude Code invokes a Skill tool, Codex opens the listed SKILL.md path.
export const SKILL_DOCUMENT = /skills\/(?<skill>[\w\-]+)\/SKILL\.md/gv;

// The skills CLAUDE.md requires reading before an action, keyed by the action.
export const SKILLS_BEFORE = {
  newSourceFile: ['file-placement', 'reuse-before-new'],
  newFile: ['file-placement'],
  dependency: ['dependency-policy'],
  commit: ['commit-message'],
};

export const DEPENDENCY_FILE = /(?:^|\/)package\.json$|^pnpm-workspace\.yaml$/v;
// Matched where a command starts, so a grep or a log message naming them
// does not count as running them.
export const DEPENDENCY_COMMAND =
  /(?:^|[&;\|]\s*)pnpm\s+(?:(?:--filter|-F)\s+\S+\s+|-\S+\s+)*(?:add|remove|rm|update|up)\b/v;
export const COMMIT_COMMAND = /(?:^|[&;\|]\s*)git\s+commit\b/v;

// Each gate step CLAUDE.md owes after a code change, as it shows up in a shell
// command. All four must run after the last edit.
export const GATE_STEPS = [
  /\bpnpm\s+check\b/v,
  /\bpnpm\s+lint\b/v,
  /\bpnpm\s+format:check\b/v,
  /\bpnpm\s+build\b/v,
];

// Codex names an edit `apply_patch` and hands the whole patch over as one
// string, where Claude Code names the file and the new text in separate fields.
// A `Move to:` destination is new wherever it lands, so it reads as an add.
export const PATCH_FILE_DIRECTIVE =
  /^\*\*\* (?<action>Add|Update|Delete) File: (?<file>.+)$/v;
export const PATCH_MOVE_DIRECTIVE = /^\*\*\* Move to: (?<file>.+)$/v;

// Found by walking up from the session's directory, which is the checkout for
// Claude Code but may be any package under it for Codex.
export const WORKSPACE_MARKER = 'pnpm-workspace.yaml';
