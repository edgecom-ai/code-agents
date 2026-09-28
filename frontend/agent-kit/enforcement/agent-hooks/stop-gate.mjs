import process from 'node:process';

import { GATE_STEPS } from './constants.mjs';
import { readHookInput } from './hosts.mjs';
import { listToolUses } from './session-history.mjs';

function gateStepsSkipped(payload) {
  // Blocking a stop re-runs the turn, and that turn's stop fires this hook
  // again with the flag set — one reminder per handoff, never a loop.
  if (payload.stopHookActive) return [];

  const toolUses = listToolUses(payload);
  const lastEdit = toolUses.findLastIndex(use => use.sourceEdit);
  if (lastEdit === -1) return [];

  // The editing command itself counts: `write && pnpm build` ran the gate after
  // the write.
  const completed = new Set(
    toolUses.slice(lastEdit).flatMap(use => use.gateSteps),
  );

  return GATE_STEPS.flatMap((step, index) =>
    completed.has(index)
      ? []
      : [
          step.source
            .replaceAll(String.raw`\b`, '')
            .replaceAll(String.raw`\s+`, ' '),
        ],
  );
}

const skipped = gateStepsSkipped(readHookInput());

if (skipped.length > 0) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason: `Code changed since the gate last ran. CLAUDE.md owes \`pnpm format\`, then \`pnpm check && pnpm lint && pnpm format:check && pnpm build\` after every edit — still missing: ${skipped.join(', ')}. Run them, report the result, then finish.`,
    }),
  );
}
