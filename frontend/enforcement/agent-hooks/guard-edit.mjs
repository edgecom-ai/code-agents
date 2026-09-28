import {
  DEPENDENCY_FILE,
  GATE_CONFIG,
  SKILLS_BEFORE,
  SOURCE_FILE,
  SOURCE_ROOT,
  SUPPRESSION_DIRECTIVE,
} from './constants.mjs';
import { decide, readHookInput } from './hosts.mjs';
import {
  listToolUses,
  missingSkills,
  skillReminder,
} from './session-history.mjs';

const payload = readHookInput();
const { edits, host } = payload;

// One Codex patch can touch several files, so each is judged on its own and the
// strictest answer carries the whole call.
function verdict({ file, added }) {
  if (GATE_CONFIG.some(pattern => pattern.test(file))) {
    return [
      'ask',
      `${file} defines the gate itself. Changing it is a policy decision for a human, not a way to pass the gate — confirm before this edit lands.`,
    ];
  }

  if (SOURCE_FILE.test(file) && SUPPRESSION_DIRECTIVE.test(added)) {
    return [
      'deny',
      'This adds a lint or type-check suppression. Fix the reported problem instead; the gate is never passed by silencing a rule (CLAUDE.md).',
    ];
  }

  return undefined;
}

function requiredSkills({ file, isNew }) {
  if (DEPENDENCY_FILE.test(file)) return SKILLS_BEFORE.dependency;
  if (!isNew || !SOURCE_ROOT.test(file)) return [];

  return SOURCE_FILE.test(file)
    ? SKILLS_BEFORE.newSourceFile
    : SKILLS_BEFORE.newFile;
}

const verdicts = edits.map(edit => verdict(edit)).filter(Boolean);
const blocking =
  verdicts.find(([decision]) => decision === 'deny') ?? verdicts[0];

if (blocking === undefined) {
  const required = [...new Set(edits.flatMap(edit => requiredSkills(edit)))];
  const missing = missingSkills(required, listToolUses(payload));
  if (missing.length > 0) decide(host, 'deny', skillReminder(missing));
} else {
  decide(host, ...blocking);
}
