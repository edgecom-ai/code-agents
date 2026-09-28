import {
  COMMIT_COMMAND,
  DEPENDENCY_COMMAND,
  GATE_CONFIG,
  HOOK_BYPASS,
  SHELL_PATH_TOKEN,
  SHELL_SOURCE_TARGET,
  SHELL_WRITE,
  SKILLS_BEFORE,
  SUPPRESSION_DIRECTIVE,
} from './constants.mjs';
import { decide, readHookInput, repoPath } from './hosts.mjs';
import {
  listToolUses,
  missingSkills,
  skillReminder,
} from './session-history.mjs';

const payload = readHookInput();
const { command, host } = payload;

const gateConfigTouched = SHELL_WRITE.test(command)
  ? command
      .matchAll(SHELL_PATH_TOKEN)
      .map(match => repoPath(match[0], payload))
      .find(file => GATE_CONFIG.some(pattern => pattern.test(file)))
  : undefined;

if (gateConfigTouched !== undefined) {
  decide(
    host,
    'ask',
    `${gateConfigTouched} defines the gate itself. Changing it is a policy decision for a human, not a way to pass the gate — confirm before this command runs.`,
  );
} else if (HOOK_BYPASS.some(pattern => pattern.test(command))) {
  decide(
    host,
    'deny',
    'This skips a git hook or overwrites remote history unconditionally, which the repo forbids. Fix what the hook reported instead, or re-push a rebased branch with `--force-with-lease` — README.md → "Blocked by a rule?".',
  );
} else if (
  SUPPRESSION_DIRECTIVE.test(command) &&
  SHELL_WRITE.test(command) &&
  SHELL_SOURCE_TARGET.test(command)
) {
  decide(
    host,
    'deny',
    'This writes a lint or type-check suppression into a file. Fix the reported problem instead; the gate is never passed by silencing a rule (CLAUDE.md).',
  );
} else {
  const required = [
    ...(COMMIT_COMMAND.test(command) ? SKILLS_BEFORE.commit : []),
    ...(DEPENDENCY_COMMAND.test(command) ? SKILLS_BEFORE.dependency : []),
  ];
  const missing = missingSkills(required, listToolUses(payload));
  if (missing.length > 0) decide(host, 'deny', skillReminder(missing));
}
