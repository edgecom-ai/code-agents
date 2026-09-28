import path from 'node:path';

export const FILE_LENGTH_LIMIT = 500;
export const FILE_LENGTH_TARGET = 350;

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);
const GENERATED_PATHS = [
  /^apps\/(?:captain|portal)\/src\/routeTree\.gen\.ts$/v,
  /^packages\/api\/src\/generated\//v,
  /^packages\/ui\/src\/components\/ui\//v,
];

export function countLines(contents) {
  if (contents.length === 0) return 0;

  const endings = contents.match(/\r\n|\n|\r/gv)?.length ?? 0;
  return endings + (/(?:\r\n|\n|\r)$/v.test(contents) ? 0 : 1);
}

export function isCheckedSource(filePath) {
  const normalized = normalizeRepoPath(filePath);
  return (
    SOURCE_EXTENSIONS.has(path.posix.extname(normalized)) &&
    GENERATED_PATHS.every(pattern => !pattern.test(normalized))
  );
}

export function parseExceptionManifest(contents, label) {
  let manifest;
  try {
    manifest = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }

  if (
    !manifest ||
    typeof manifest !== 'object' ||
    !Array.isArray(manifest.exceptions)
  ) {
    throw new Error(`${label} must contain an "exceptions" array`);
  }

  const exceptions = new Map();
  for (const [index, entry] of manifest.exceptions.entries()) {
    const entryLabel = `${label} exceptions[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${entryLabel} must be an object`);
    }

    const filePath = validateExceptionPath(entry.path, entryLabel);
    if (exceptions.has(filePath)) {
      throw new Error(`${entryLabel} duplicates ${filePath}`);
    }

    if (
      !Number.isSafeInteger(entry.maxLines) ||
      entry.maxLines <= FILE_LENGTH_LIMIT
    ) {
      throw new Error(
        `${entryLabel}.maxLines must be an integer greater than ${FILE_LENGTH_LIMIT}`,
      );
    }

    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) {
      throw new Error(
        `${entryLabel}.reason must explain the exception in at least 20 characters`,
      );
    }

    exceptions.set(filePath, {
      maxLines: entry.maxLines,
    });
  }

  return exceptions;
}

export function evaluateFileChange(change, exception) {
  if (change.currentLines <= FILE_LENGTH_LIMIT) return undefined;

  let reason;
  if (change.baseLines === undefined) {
    reason = 'new source file exceeds the hard limit';
  } else if (change.baseLines <= FILE_LENGTH_LIMIT) {
    reason = `crossed the hard limit from ${change.baseLines} lines`;
  } else if (change.currentLines > change.baseLines) {
    reason = `grew from ${change.baseLines} lines while already over the limit`;
  }

  if (!reason || (exception && change.currentLines <= exception.maxLines)) {
    return undefined;
  }

  return { ...change, reason };
}

export function validateExceptionCeiling({
  filePath,
  exception,
  baseException,
  currentLines,
}) {
  if (!isCheckedSource(filePath)) {
    return `${filePath}: exceptions may only target checked, non-generated source files`;
  }

  if (currentLines === undefined) {
    return `${filePath}: exception targets a file that does not exist`;
  }

  if (currentLines <= FILE_LENGTH_LIMIT) {
    return `${filePath}: exception is stale because the file is ${currentLines} lines`;
  }

  if (currentLines > exception.maxLines) {
    return `${filePath}: ${currentLines} lines exceeds its approved ${exception.maxLines}-line ceiling`;
  }

  if (
    (!baseException || exception.maxLines > baseException.maxLines) &&
    exception.maxLines !== currentLines
  ) {
    return `${filePath}: a new or raised exception must equal its current ${currentLines}-line size`;
  }

  return undefined;
}

function validateExceptionPath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `${label}.path must be a non-empty repository-relative path`,
    );
  }

  const normalized = path.posix.normalize(normalizeRepoPath(value));
  if (
    normalized !== value ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(
      `${label}.path must be a normalized repository-relative path`,
    );
  }

  return normalized;
}

function normalizeRepoPath(filePath) {
  return filePath.replaceAll('\\', '/');
}
