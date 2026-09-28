import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  PATCH_FILE_DIRECTIVE,
  PATCH_MOVE_DIRECTIVE,
  WORKSPACE_MARKER,
} from './constants.mjs';

const CLAUDE_EDIT_TOOLS = new Set([
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'Write',
]);

export const CODEX = 'codex';

export function readHookInput() {
  const raw = JSON.parse(readFileSync(0, 'utf8'));
  const host = process.argv.includes(`--host=${CODEX}`) ? CODEX : 'claude';
  const cwd = raw.cwd ?? process.cwd();
  const place = { root: repoRoot(cwd), cwd };

  return {
    ...place,
    host,
    sessionId: raw.session_id ?? '',
    transcriptPath: raw.transcript_path ?? '',
    stopHookActive: raw.stop_hook_active === true,
    ...normalizeToolUse(host, raw.tool_name ?? '', raw.tool_input, place),
  };
}

// Also replays a recorded call, so live and historical calls cannot drift.
export function normalizeToolUse(host, name, toolInput, place) {
  const input = toolInput ?? {};
  const command = String(input.command ?? '');

  if (host === CODEX) {
    return {
      name,
      skill: '',
      command: name === 'Bash' ? command : '',
      edits: name === 'apply_patch' ? patchEdits(command, place) : [],
      paths: pathsIn(input),
    };
  }

  const file = input.file_path ?? input.notebook_path ?? '';
  return {
    name,
    skill: name === 'Skill' ? String(input.skill ?? '') : '',
    command: name === 'Bash' ? command : '',
    edits: CLAUDE_EDIT_TOOLS.has(name) ? [claudeEdit(file, input, place)] : [],
    paths: typeof file === 'string' && file !== '' ? [file] : [],
  };
}

function claudeEdit(file, input, place) {
  const added = [
    input.content,
    input.new_string,
    input.new_source,
    ...(input.edits ?? []).map(edit => edit.new_string),
  ]
    .filter(value => typeof value === 'string')
    .join('\n');

  return {
    file: repoPath(file, place),
    added,
    isNew: file !== '' && !existsSync(file),
  };
}

// Codex sends the patch verbatim, so only a `+` line is new text — a directive
// line starts with `*` and a removed line with `-`.
function patchEdits(patch, place) {
  const edits = [];
  let current;

  for (const line of patch.split('\n')) {
    const named =
      PATCH_FILE_DIRECTIVE.exec(line) ?? PATCH_MOVE_DIRECTIVE.exec(line);
    if (named !== null) {
      current = {
        file: repoPath(named.groups.file.trim(), place),
        added: [],
        isNew: (named.groups.action ?? 'Add') === 'Add',
      };
      edits.push(current);
    } else if (current !== undefined && line.startsWith('+')) {
      current.added.push(line.slice(1));
    }
  }

  return edits.map(edit => ({ ...edit, added: edit.added.join('\n') }));
}

// Any path a tool was pointed at, so opening a SKILL.md counts as reading it
// whichever tool Codex opened it with.
function pathsIn(value) {
  if (typeof value === 'string') return value.includes('/') ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(item => pathsIn(item));
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(item => pathsIn(item));
  }

  return [];
}

function repoRoot(cwd) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;

  let directory = cwd;
  while (!existsSync(path.join(directory, WORKSPACE_MARKER))) {
    const parent = path.dirname(directory);
    if (parent === directory) return cwd;
    directory = parent;
  }

  return directory;
}

export function repoPath(file, { root, cwd }) {
  return path.relative(root, path.resolve(cwd, file)).replaceAll('\\', '/');
}

// Codex cannot turn a PreToolUse decision into a human prompt, so policy edits
// stay manual-only there instead of suggesting that a retry could be approved.
export function decide(host, permissionDecision, permissionDecisionReason) {
  const isCodexAsk = host === CODEX && permissionDecision === 'ask';

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: isCodexAsk ? 'deny' : permissionDecision,
        permissionDecisionReason: isCodexAsk
          ? `${permissionDecisionReason} Codex cannot raise that prompt from a hook, so this edit is manual-only. Have a human make the reviewed change outside Codex; if a hook definition changes, review its new hash with /hooks.`
          : permissionDecisionReason,
      },
    }),
  );
}
