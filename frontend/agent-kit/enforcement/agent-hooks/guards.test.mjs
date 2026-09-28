import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { after, test } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../..');
const NO_TRANSCRIPT = '/nonexistent-transcript.jsonl';
const CODEX = ['--host=codex'];
const CODEX_SESSIONS = new Set();

after(() => {
  for (const session of CODEX_SESSIONS) {
    runHook(
      'session-history-hook.mjs',
      hookInput('', undefined, [['session_id', session]]),
      [...CODEX, '--cleanup'],
    );
  }
});

// Forbidden tokens are assembled at runtime so this file never trips the
// guards that watch the shell command writing it.
const noVerify = '--no-verify';
const disableNextLine = 'eslint-disable-next-line';
const tsIgnore = '@ts-ignore';

// The hook protocol's keys are snake_case, so payloads are built from entries.
function hookInput(toolName, toolInput, extra = []) {
  return Object.fromEntries([
    ['cwd', ROOT],
    ['transcript_path', NO_TRANSCRIPT],
    ['tool_name', toolName],
    ['tool_input', toolInput],
    ...extra,
  ]);
}

function runHook(script, input, argv = []) {
  return execFileSync(
    'node',
    [path.join(import.meta.dirname, script), ...argv],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
      input: JSON.stringify(input),
    },
  );
}

function decisionOf(script, input, argv = []) {
  const stdout = runHook(script, input, argv);
  if (stdout === '') return 'allow';

  const output = JSON.parse(stdout);
  return output.hookSpecificOutput?.permissionDecision ?? output.decision;
}

const bash = command =>
  decisionOf('guard-bash.mjs', hookInput('Bash', { command }));
function editDecision(toolName, file, fields) {
  const toolInput = Object.fromEntries([
    ['file_path', path.join(ROOT, file)],
    ...fields,
  ]);
  return decisionOf('guard-edit.mjs', hookInput(toolName, toolInput));
}

const edit = (file, newString) =>
  editDecision('Edit', file, [
    ['old_string', 'x'],
    ['new_string', newString],
  ]);
const write = (file, content) =>
  editDecision('Write', file, [['content', content]]);

test('bash guard denies hook and history bypasses on git commands', () => {
  assert.equal(bash(`git commit ${noVerify} -m x`), 'deny');
  assert.equal(bash('git push -f origin main'), 'deny');
  assert.equal(bash('git push --force origin main'), 'deny');
  assert.equal(bash('LEFTHOOK=0 git push'), 'deny');
  assert.equal(bash('pnpm exec eslint --no-inline-config .'), 'deny');
});

test('bash guard allows a force push that checks the remote first', () => {
  assert.equal(bash('git push --force-with-lease'), 'allow');
  assert.equal(bash('git push --force-with-lease=main:abc123 origin'), 'allow');
  assert.equal(
    bash('git push --force-with-lease --force-if-includes origin topic'),
    'allow',
  );
});

test('bash guard leaves prose and reads about the flags alone', () => {
  assert.equal(
    bash(`cat >> README.md <<EOF\ndenies ${noVerify}\nEOF`),
    'allow',
  );
  assert.equal(bash(`grep -rn ${disableNextLine} apps`), 'allow');
  assert.equal(bash('git log --oneline'), 'allow');
});

test('bash guard denies a suppression written into a source file', () => {
  assert.equal(bash(`cat > a.ts <<EOF\n// ${disableNextLine}\nEOF`), 'deny');
  assert.equal(
    bash(`python3 - <<EOF\nopen("x.tsx","w").write("// ${tsIgnore}")\nEOF`),
    'deny',
  );
  assert.equal(bash(`cat > notes.md <<EOF\n${tsIgnore}\nEOF`), 'allow');
});

test('bash guard requires the commit and dependency skills first', () => {
  assert.equal(bash('git commit -m "feat: x"'), 'deny');
  assert.equal(bash('pnpm add left-pad'), 'deny');
  assert.equal(
    bash('cd apps/portal && pnpm --filter portal add left-pad'),
    'deny',
  );
  assert.equal(bash('pnpm install'), 'allow');
  assert.equal(bash('git log --grep "git commit"'), 'allow');
});

test('bash guard asks before a shell write reaches the gate definition', () => {
  assert.equal(bash('cat > lefthook.yml <<EOF\nx\nEOF'), 'ask');
  assert.equal(bash('sed -i "" s/a/b/ packages/config/eslint.base.js'), 'ask');
  assert.equal(bash('cat > .claude/hooks.json <<EOF\nx\nEOF'), 'ask');
  assert.equal(bash('cat lefthook.yml'), 'allow');
});

test('edit guard denies a suppression in source and allows it in docs', () => {
  assert.equal(edit('apps/portal/src/main.tsx', `// ${tsIgnore}`), 'deny');
  assert.equal(edit('README.md', `\`${disableNextLine}\``), 'allow');
});

test('edit guard asks before the gate definition changes', () => {
  assert.equal(edit('lefthook.yml', 'x'), 'ask');
  assert.equal(edit('CLAUDE.md', 'x'), 'ask');
  assert.equal(edit('packages/config/eslint.base.js', 'x'), 'ask');
  assert.equal(edit('scripts/agent-hooks/constants.mjs', 'x'), 'ask');
  assert.equal(edit('.claude/skills/code-quality/SKILL.md', 'x'), 'ask');
});

test('edit guard requires the placement skills before a new source file', () => {
  assert.equal(write('apps/portal/src/brand-new.tsx', 'x'), 'deny');
  assert.equal(write('apps/portal/src/brand-new.css', 'x'), 'deny');
  assert.equal(edit('apps/portal/src/main.tsx', 'x'), 'allow');
  assert.equal(edit('apps/portal/package.json', 'x'), 'deny');
});

// A transcript holding one assistant turn per Bash command, in order.
function transcriptOf(commands) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'hooks-'));
  const file = path.join(directory, 't.jsonl');
  const lines = commands.map(command =>
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Bash', input: { command } }],
      },
    }),
  );
  writeFileSync(file, lines.join('\n'));
  return file;
}

const stop = commands =>
  decisionOf(
    'stop-gate.mjs',
    hookInput('', undefined, [['transcript_path', transcriptOf(commands)]]),
  );

const GATE = 'pnpm check && pnpm lint && pnpm format:check && pnpm build';

test('stop gate allows when nothing was edited or the reminder already fired', () => {
  assert.equal(decisionOf('stop-gate.mjs', hookInput('', undefined)), 'allow');
  assert.equal(
    decisionOf(
      'stop-gate.mjs',
      hookInput('', undefined, [['stop_hook_active', true]]),
    ),
    'allow',
  );
  assert.equal(stop(['git status', `${GATE} 2>&1 | tail -5`]), 'allow');
});

test('stop gate blocks an edit the gate did not follow', () => {
  assert.equal(stop(['cat > apps/portal/src/a.ts <<EOF\nx\nEOF']), 'block');
  assert.equal(
    stop([GATE, 'cat > apps/portal/src/a.ts <<EOF\nx\nEOF']),
    'block',
  );
  assert.equal(
    stop(['cat > a.ts <<EOF\nx\nEOF', 'pnpm lint && pnpm build']),
    'block',
  );
});

test('stop gate allows once every step ran after the last edit', () => {
  assert.equal(
    stop(['cat > a.ts <<EOF\nx\nEOF', `pnpm format >/dev/null; ${GATE}`]),
    'allow',
  );
  assert.equal(stop([`cat > a.ts <<EOF\nx\nEOF\n${GATE}`]), 'allow');
});

// Codex names every edit `apply_patch` and carries the whole patch in the same
// `command` field a shell call uses.
function patchOf(entries) {
  const body = entries.flatMap(([directive, ...added]) => [
    `*** ${directive}`,
    ...added.map(line => `+${line}`),
  ]);
  return ['*** Begin Patch', ...body, '*** End Patch'].join('\n');
}

const codexPatch = entries =>
  decisionOf(
    'guard-edit.mjs',
    hookInput('apply_patch', { command: patchOf(entries) }),
    CODEX,
  );

test('codex edit guard reads the files and the new lines out of a patch', () => {
  assert.equal(
    codexPatch([['Update File: apps/portal/src/main.tsx', `// ${tsIgnore}`]]),
    'deny',
  );
  assert.equal(
    codexPatch([['Update File: README.md', `\`${disableNextLine}\``]]),
    'allow',
  );
  assert.equal(
    codexPatch([['Update File: apps/portal/src/main.tsx', 'x']]),
    'allow',
  );
});

test('codex edit guard requires the placement skills for an added file', () => {
  assert.equal(
    codexPatch([['Add File: apps/portal/src/brand-new.tsx', 'x']]),
    'deny',
  );
  assert.equal(codexPatch([['Move to: apps/portal/src/moved.tsx']]), 'deny');
  assert.equal(
    codexPatch([['Delete File: apps/portal/src/main.tsx']]),
    'allow',
  );
});

test('codex turns a gate-definition ask into a deny it cannot prompt for', () => {
  assert.equal(codexPatch([['Update File: lefthook.yml', 'x']]), 'deny');
  const stdout = runHook(
    'guard-bash.mjs',
    hookInput('Bash', { command: 'cat > lefthook.yml <<EOF\nx\nEOF' }),
    CODEX,
  );
  const output = JSON.parse(stdout).hookSpecificOutput;
  assert.equal(output.permissionDecision, 'deny');
  assert.match(output.permissionDecisionReason, /manual-only/v);
  assert.doesNotMatch(output.permissionDecisionReason, /retry/v);
});

test('codex judges a many-file patch by its strictest file', () => {
  assert.equal(
    codexPatch([
      ['Update File: lefthook.yml', 'x'],
      ['Update File: apps/portal/src/main.tsx', `// ${tsIgnore}`],
    ]),
    'deny',
  );
});

// Codex's transcript format is unstable, so its history is the journal the
// PostToolUse hook appends to — these drive the real recorder.
function codexSession(calls) {
  const session = randomUUID();
  CODEX_SESSIONS.add(session);
  for (const [toolName, toolInput] of calls) {
    runHook(
      'session-history-hook.mjs',
      hookInput(toolName, toolInput, [['session_id', session]]),
      CODEX,
    );
  }

  return session;
}

function codexJournal(session) {
  const id = createHash('sha256').update(session).digest('hex');
  return path.join(os.tmpdir(), 'edgecom-agent-hooks', `${id}.jsonl`);
}

function modeOf(file) {
  return statSync(file).mode.toString(8).slice(-3);
}

const codexStop = calls =>
  decisionOf(
    'stop-gate.mjs',
    hookInput('', undefined, [['session_id', codexSession(calls)]]),
    CODEX,
  );

test('codex stop gate tracks edits and gate runs through the journal', () => {
  assert.equal(codexStop([['Bash', { command: 'git status' }]]), 'allow');
  assert.equal(
    codexStop([
      [
        'apply_patch',
        { command: patchOf([['Update File: apps/portal/src/a.ts', 'x']]) },
      ],
    ]),
    'block',
  );
  assert.equal(
    codexStop([
      [
        'apply_patch',
        { command: patchOf([['Update File: apps/portal/src/a.ts', 'x']]) },
      ],
      ['Bash', { command: GATE }],
    ]),
    'allow',
  );
});

test('codex clears a skill requirement once the SKILL.md was opened', () => {
  const commit = session =>
    decisionOf(
      'guard-bash.mjs',
      hookInput('Bash', { command: 'git commit -m "feat: x"' }, [
        ['session_id', session],
      ]),
      CODEX,
    );

  assert.equal(commit(codexSession([])), 'deny');
  assert.equal(
    commit(
      codexSession([
        ['read_file', { path: '.claude/skills/commit-message/SKILL.md' }],
      ]),
    ),
    'allow',
  );
});

test('codex journal keeps only private gate facts and is removed at session end', () => {
  const secret = `private-journal-marker-${randomUUID()}`;
  const session = codexSession([
    [
      'apply_patch',
      {
        command: patchOf([
          ['Update File: apps/portal/src/a.ts', `const url = '${secret}';`],
        ]),
      },
    ],
  ]);
  const journal = codexJournal(session);
  const contents = readFileSync(journal, 'utf8');

  const { version, ...facts } = JSON.parse(contents);

  assert.equal(contents.includes(secret), false);
  assert.deepEqual(facts, { sourceEdit: true, gateSteps: [], skills: [] });
  // A digest of the policy, so changing a rule retires the entries it judged.
  assert.match(version, /^[0-9a-f]{12}$/v);

  const directoryMode =
    process.platform === 'win32' ? '700' : modeOf(path.dirname(journal));
  const journalMode = process.platform === 'win32' ? '600' : modeOf(journal);
  assert.equal(directoryMode, '700');
  assert.equal(journalMode, '600');

  runHook(
    'session-history-hook.mjs',
    hookInput('', undefined, [['session_id', session]]),
    [...CODEX, '--cleanup'],
  );
  assert.equal(existsSync(journal), false);
});
