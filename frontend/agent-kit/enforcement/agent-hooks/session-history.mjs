import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  GATE_STEPS,
  SHELL_WRITE,
  SKILL_DOCUMENT,
  SOURCE_FILE,
  SOURCE_ROOT,
} from './constants.mjs';
import { CODEX, normalizeToolUse } from './hosts.mjs';

// Codex transcripts are unstable, so persist only gate facts; raw commands,
// patches, and tool inputs stay in Codex's own transcript.
const JOURNAL_DIRECTORY = path.join(os.tmpdir(), 'edgecom-agent-hooks');

// An entry freezes its verdict and indexes into GATE_STEPS by position, so a
// policy change has to invalidate the journal. Deriving the version from the
// policy's own text makes that automatic instead of a bump to remember.
const JOURNAL_VERSION = createHash('sha256')
  .update(
    [SHELL_WRITE, SKILL_DOCUMENT, SOURCE_FILE, SOURCE_ROOT, ...GATE_STEPS].join(
      '\n',
    ),
  )
  .digest('hex')
  .slice(0, 12);

function journalFile(sessionId) {
  const id = createHash('sha256')
    .update(sessionId || 'unknown')
    .digest('hex');
  return path.join(JOURNAL_DIRECTORY, `${id}.jsonl`);
}

function historyEntry({ name, skill, command, edits, paths }) {
  const skills = new Set(skill ? [skill] : []);

  for (const text of [command, ...(paths ?? [])]) {
    for (const match of String(text ?? '').matchAll(SKILL_DOCUMENT)) {
      skills.add(match.groups.skill);
    }
  }

  return {
    version: JOURNAL_VERSION,
    sourceEdit:
      edits.some(
        ({ file }) => SOURCE_ROOT.test(file) && SOURCE_FILE.test(file),
      ) ||
      (name === 'Bash' && SHELL_WRITE.test(command)),
    gateSteps: GATE_STEPS.flatMap((step, index) =>
      step.test(command) ? [index] : [],
    ),
    skills: [...skills],
  };
}

function lockDown(file) {
  if (process.platform !== 'win32') chmodSync(file, 0o600);
}

export function recordToolUse(payload) {
  mkdirSync(JOURNAL_DIRECTORY, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') chmodSync(JOURNAL_DIRECTORY, 0o700);

  const file = journalFile(payload.sessionId);
  appendFileSync(file, `${JSON.stringify(historyEntry(payload))}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  lockDown(file);
}

export function clearSessionHistory({ sessionId }) {
  rmSync(journalFile(sessionId), { force: true });
}

// Every tool call the session has made, oldest first.
export function listToolUses(payload) {
  const lines = readLines(
    payload.host === CODEX
      ? journalFile(payload.sessionId)
      : payload.transcriptPath,
  );

  return payload.host === CODEX
    ? lines
        .map(line => parseLine(line))
        .filter(entry => entry?.version === JOURNAL_VERSION)
    : lines
        .flatMap(line => claudeToolUses(line, payload))
        .map(use => historyEntry(use));
}

function readLines(file) {
  if (!file) return [];

  try {
    return readFileSync(file, 'utf8').split('\n');
  } catch {
    return [];
  }
}

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

// The transcript is JSONL with one assistant turn per line; lines that are not
// turns are skipped.
function claudeToolUses(line, place) {
  if (!line.includes('"tool_use"')) return [];

  const content = parseLine(line)?.message?.content;
  if (!Array.isArray(content)) return [];

  return content
    .filter(block => block.type === 'tool_use')
    .map(block => normalizeToolUse('claude', block.name, block.input, place));
}

export function missingSkills(required, toolUses) {
  const read = new Set(toolUses.flatMap(use => use.skills));
  return required.filter(skill => !read.has(skill));
}

export function skillReminder(missing) {
  const list = missing.map(skill => `\`${skill}\``).join(' and ');
  const noun = missing.length === 1 ? 'skill' : 'skills';
  return `CLAUDE.md requires reading the ${list} ${noun} before this action. Read each one's SKILL.md, then retry.`;
}
