import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  countLines,
  evaluateFileChange,
  FILE_LENGTH_LIMIT,
  FILE_LENGTH_TARGET,
  isCheckedSource,
  parseExceptionManifest,
  validateExceptionCeiling,
} from './file-length-policy.mjs';

const EXCEPTIONS_PATH = '.file-length-exceptions.json';

function git(arguments_, options = {}) {
  return execFileSync('git', arguments_, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

function resolveCommit(revision) {
  try {
    return git(['rev-parse', '--verify', revision + '^{commit}']).trim();
  } catch {
    throw new Error(
      `Cannot resolve base revision "${revision}". Fetch it or pass --base <revision>.`,
    );
  }
}

function readBlob(commit, filePath) {
  try {
    return git(['show', `${commit}:${filePath}`], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

function isSymlinkAtCommit(commit, filePath) {
  return git(['ls-tree', commit, '--', filePath], {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).startsWith('120000 ');
}

function readCurrentFile(filePath, headCommit) {
  if (headCommit) {
    if (isSymlinkAtCommit(headCommit, filePath)) {
      throw new Error(
        `${filePath}: checked source files may not be symbolic links`,
      );
    }

    return readBlob(headCommit, filePath);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) return undefined;
  if (lstatSync(absolutePath).isSymbolicLink()) {
    throw new Error(
      `${filePath}: checked source files may not be symbolic links`,
    );
  }

  return readFileSync(absolutePath, 'utf8');
}

function parseNameStatus(output) {
  if (output.length === 0) return [];

  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();

  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    const kind = status[0];
    if (kind === 'R' || kind === 'C') {
      const oldPath = fields[index++];
      const filePath = fields[index++];
      changes.push({
        status: kind,
        oldPath: kind === 'R' ? oldPath : undefined,
        filePath,
      });
    } else {
      changes.push({ status: kind, filePath: fields[index++] });
    }
  }

  return changes;
}

function getChanges(baseCommit, headCommit) {
  const arguments_ = [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    baseCommit,
  ];
  if (headCommit) arguments_.push(headCommit);
  arguments_.push('--');

  const changes = parseNameStatus(git(arguments_));
  if (headCommit) return changes;

  const trackedPaths = new Set(changes.map(change => change.filePath));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .filter(filePath => !trackedPaths.has(filePath))
    .map(filePath => ({ status: 'A', filePath }));

  return [...changes, ...untracked];
}

function loadCurrentExceptions(headCommit) {
  const contents = readCurrentFile(EXCEPTIONS_PATH, headCommit);
  if (contents === undefined) {
    throw new Error(`${EXCEPTIONS_PATH} is missing`);
  }

  return parseExceptionManifest(contents, EXCEPTIONS_PATH);
}

function loadBaseExceptions(baseCommit) {
  const contents = readBlob(baseCommit, EXCEPTIONS_PATH);
  return contents
    ? parseExceptionManifest(
        contents,
        `${EXCEPTIONS_PATH} at the base revision`,
      )
    : new Map();
}

function parseArguments(arguments_) {
  let base = 'origin/main';
  let head;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument !== '--base' && argument !== '--head') {
      throw new Error(`Unknown argument "${argument}"`);
    }

    const value = arguments_[index + 1];
    if (!value) throw new Error(`${argument} requires a revision`);
    if (argument === '--base') base = value;
    else head = value;
    index += 1;
  }

  return { base, head };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const compareCommit = resolveCommit(options.head ?? 'HEAD');
  const requestedBase = resolveCommit(options.base);
  const baseCommit = git(['merge-base', requestedBase, compareCommit]).trim();
  const headCommit = options.head ? compareCommit : undefined;
  const exceptions = loadCurrentExceptions(headCommit);
  const baseExceptions = loadBaseExceptions(baseCommit);
  const errors = [];

  for (const [filePath, exception] of exceptions) {
    const contents = readCurrentFile(filePath, headCommit);
    const error = validateExceptionCeiling({
      filePath,
      exception,
      baseException: baseExceptions.get(filePath),
      currentLines: contents === undefined ? undefined : countLines(contents),
    });
    if (error) errors.push(error);
  }

  const checked = [];
  const advisories = [];
  const violations = [];
  for (const change of getChanges(baseCommit, headCommit)) {
    if (change.status === 'D' || !isCheckedSource(change.filePath)) continue;

    const contents = readCurrentFile(change.filePath, headCommit);
    if (contents === undefined) continue;

    const baseContents = readBlob(
      baseCommit,
      change.oldPath ?? change.filePath,
    );
    const fileChange = {
      filePath: change.filePath,
      baseLines:
        baseContents === undefined ? undefined : countLines(baseContents),
      currentLines: countLines(contents),
    };
    checked.push(fileChange);

    const violation = evaluateFileChange(
      fileChange,
      exceptions.get(change.filePath),
    );
    if (violation) violations.push(violation);
    if (fileChange.currentLines > FILE_LENGTH_TARGET)
      advisories.push(fileChange);
  }

  if (errors.length > 0 || violations.length > 0) {
    console.error(
      `File length check failed (${FILE_LENGTH_LIMIT}-line hard limit).`,
    );
    for (const error of errors) console.error(`- ${error}`);
    for (const violation of violations) {
      console.error(
        `- ${violation.filePath}: ${violation.currentLines} lines; ${violation.reason}.`,
      );
    }

    console.error(
      `Split the file along a domain boundary. Do not bypass this check: no --no-verify, no edits to the checker or its exemptions, and a ceiling in ${EXCEPTIONS_PATH} only when the file cannot be split safely.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `File length check passed for ${checked.length} changed source file(s).`,
  );
  if (advisories.length > 0) {
    console.log(`Review target (${FILE_LENGTH_TARGET} lines):`);
    for (const advisory of advisories) {
      console.log(`- ${advisory.filePath}: ${advisory.currentLines} lines`);
    }
  }
}

const isEntryPoint = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isEntryPoint) {
  try {
    main();
  } catch (error) {
    console.error(`File length check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
