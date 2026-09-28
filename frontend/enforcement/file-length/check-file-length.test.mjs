import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  countLines,
  evaluateFileChange,
  FILE_LENGTH_LIMIT,
  isCheckedSource,
  parseExceptionManifest,
  validateExceptionCeiling,
} from './file-length-policy.mjs';

const exception = {
  maxLines: FILE_LENGTH_LIMIT + 12,
};
const checkerPath = fileURLToPath(
  new URL('check-file-length.mjs', import.meta.url),
);

function sourceWithLines(lineCount) {
  return `${Array.from({ length: lineCount }, (_, index) => `x${index}`).join('\n')}\n`;
}

function git(cwd, arguments_) {
  return execFileSync('git', arguments_, { cwd, encoding: 'utf8' });
}

function commitAll(cwd, message) {
  git(cwd, ['add', '.']);
  git(cwd, [
    '-c',
    'user.name=File Length Test',
    '-c',
    'user.email=file-length@example.com',
    'commit',
    '-m',
    message,
  ]);
}

function createRepository(files = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'file-length-check-'));
  git(directory, ['init', '--initial-branch=main']);
  writeFileSync(
    path.join(directory, '.file-length-exceptions.json'),
    '{\n  "exceptions": []\n}\n',
  );
  for (const [filePath, contents] of Object.entries(files)) {
    writeFileSync(path.join(directory, filePath), contents);
  }

  commitAll(directory, 'baseline');

  return directory;
}

function runChecker(cwd, ...arguments_) {
  const checkerArguments =
    arguments_.length > 0 ? arguments_ : ['--base', 'HEAD'];
  return spawnSync(process.execPath, [checkerPath, ...checkerArguments], {
    cwd,
    encoding: 'utf8',
  });
}

test('counts a final line without a newline', () => {
  assert.equal(countLines('first\nsecond'), 2);
  assert.equal(countLines('first\nsecond\n'), 2);
  assert.equal(countLines(''), 0);
});

test('checks source files and preserves narrow generated exemptions', () => {
  assert.equal(isCheckedSource('apps/portal/src/feature.tsx'), true);
  assert.equal(isCheckedSource('apps/portal/src/routeTree.gen.ts'), false);
  assert.equal(
    isCheckedSource('packages/api/src/generated/service/model.ts'),
    false,
  );
  assert.equal(
    isCheckedSource('packages/ui/src/components/ui/button.tsx'),
    false,
  );
  assert.equal(isCheckedSource('docs/architecture.md'), false);
});

test('rejects a new source file over the hard limit', () => {
  assert.deepEqual(
    evaluateFileChange({
      filePath: 'feature.ts',
      baseLines: undefined,
      currentLines: FILE_LENGTH_LIMIT + 1,
    }),
    {
      filePath: 'feature.ts',
      baseLines: undefined,
      currentLines: FILE_LENGTH_LIMIT + 1,
      reason: 'new source file exceeds the hard limit',
    },
  );
});

test('rejects crossing the limit and growth in legacy oversized files', () => {
  assert.ok(
    evaluateFileChange({
      filePath: 'crossed.ts',
      baseLines: FILE_LENGTH_LIMIT,
      currentLines: FILE_LENGTH_LIMIT + 1,
    }),
  );
  assert.ok(
    evaluateFileChange({
      filePath: 'legacy.ts',
      baseLines: 600,
      currentLines: 601,
    }),
  );
});

test('allows an oversized legacy file to stay level or shrink', () => {
  assert.equal(
    evaluateFileChange({
      filePath: 'unchanged.ts',
      baseLines: 600,
      currentLines: 600,
    }),
    undefined,
  );
  assert.equal(
    evaluateFileChange({
      filePath: 'shrinking.ts',
      baseLines: 600,
      currentLines: 550,
    }),
    undefined,
  );
});

test('allows only growth covered by an explicit ceiling', () => {
  assert.equal(
    evaluateFileChange(
      {
        filePath: 'exception.ts',
        baseLines: 505,
        currentLines: exception.maxLines,
      },
      exception,
    ),
    undefined,
  );
  assert.ok(
    evaluateFileChange(
      {
        filePath: 'exception.ts',
        baseLines: 505,
        currentLines: exception.maxLines + 1,
      },
      exception,
    ),
  );
});

test('validates exception paths, reasons, and ceilings', () => {
  const parsed = parseExceptionManifest(
    JSON.stringify({
      exceptions: [
        {
          path: 'apps/portal/src/feature.ts',
          maxLines: FILE_LENGTH_LIMIT + 1,
          reason: 'This parser must remain atomic for correctness.',
        },
      ],
    }),
    '.file-length-exceptions.json',
  );
  assert.equal(parsed.get('apps/portal/src/feature.ts')?.maxLines, 501);

  assert.throws(
    () =>
      parseExceptionManifest(
        JSON.stringify({
          exceptions: [
            {
              path: '../outside.ts',
              maxLines: 501,
              reason: 'This path must not escape the repository root.',
            },
          ],
        }),
        '.file-length-exceptions.json',
      ),
    /normalized repository-relative path/v,
  );
  assert.throws(
    () =>
      parseExceptionManifest(
        JSON.stringify({
          exceptions: [
            {
              path: 'apps/portal/../../outside.ts',
              maxLines: 501,
              reason: 'This path must not escape through a parent segment.',
            },
          ],
        }),
        '.file-length-exceptions.json',
      ),
    /normalized repository-relative path/v,
  );
  assert.throws(
    () =>
      parseExceptionManifest(
        JSON.stringify({
          exceptions: [
            {
              path: 'apps/portal/src/feature.ts',
              maxLines: 501,
              reason: 'too short',
            },
          ],
        }),
        '.file-length-exceptions.json',
      ),
    /at least 20 characters/v,
  );
  assert.match(
    validateExceptionCeiling({
      filePath: 'apps/portal/src/feature.ts',
      exception,
      baseException: undefined,
      currentLines: exception.maxLines - 1,
    }),
    /must equal its current/v,
  );
});

test('CLI rejects an untracked source file over the limit', t => {
  const repository = createRepository();
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  writeFileSync(
    path.join(repository, 'new-feature.ts'),
    sourceWithLines(FILE_LENGTH_LIMIT + 1),
  );

  const result = runChecker(repository);
  t.assert.strictEqual(result.status, 1);
  t.assert.match(result.stderr, /new source file exceeds the hard limit/v);
});

test('CLI enforces the committed head used by pull-request CI', t => {
  const repository = createRepository();
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  writeFileSync(
    path.join(repository, 'new-feature.ts'),
    sourceWithLines(FILE_LENGTH_LIMIT + 1),
  );
  commitAll(repository, 'add oversized source');

  const result = runChecker(repository, '--base', 'HEAD~1', '--head', 'HEAD');
  t.assert.strictEqual(result.status, 1);
  t.assert.match(result.stderr, /new source file exceeds the hard limit/v);
});

test('CLI rejects source-file symlinks', t => {
  const repository = createRepository({
    'payload.txt': sourceWithLines(FILE_LENGTH_LIMIT + 1),
  });
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  symlinkSync('payload.txt', path.join(repository, 'linked.ts'));

  const result = runChecker(repository);
  t.assert.strictEqual(result.status, 1);
  t.assert.match(result.stderr, /may not be symbolic links/v);
});

test('CLI rejects legacy growth but permits shrinkage', t => {
  const repository = createRepository({
    'legacy.ts': sourceWithLines(FILE_LENGTH_LIMIT + 10),
  });
  t.after(() => rmSync(repository, { recursive: true, force: true }));

  writeFileSync(
    path.join(repository, 'legacy.ts'),
    sourceWithLines(FILE_LENGTH_LIMIT + 11),
  );
  t.assert.strictEqual(runChecker(repository).status, 1);

  writeFileSync(
    path.join(repository, 'legacy.ts'),
    sourceWithLines(FILE_LENGTH_LIMIT + 5),
  );
  t.assert.strictEqual(runChecker(repository).status, 0);
});

test('CLI permits a staged rename without resetting the legacy ceiling', t => {
  const repository = createRepository({
    'legacy.ts': sourceWithLines(FILE_LENGTH_LIMIT + 10),
  });
  t.after(() => rmSync(repository, { recursive: true, force: true }));

  renameSync(
    path.join(repository, 'legacy.ts'),
    path.join(repository, 'renamed.ts'),
  );
  git(repository, ['add', '--all']);

  t.assert.strictEqual(runChecker(repository).status, 0);
});

test('CLI accepts a reviewed exception only at the exact current size', t => {
  const currentLines = FILE_LENGTH_LIMIT + 11;
  const repository = createRepository({
    'legacy.ts': sourceWithLines(FILE_LENGTH_LIMIT + 10),
  });
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  writeFileSync(
    path.join(repository, 'legacy.ts'),
    sourceWithLines(currentLines),
  );
  writeFileSync(
    path.join(repository, '.file-length-exceptions.json'),
    `${JSON.stringify(
      {
        exceptions: [
          {
            path: 'legacy.ts',
            maxLines: currentLines,
            reason: 'This fixture verifies the reviewed exception path.',
          },
        ],
      },
      undefined,
      2,
    )}\n`,
  );

  t.assert.strictEqual(runChecker(repository).status, 0);
});
