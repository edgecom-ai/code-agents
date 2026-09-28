import process from 'node:process';

import { readHookInput } from './hosts.mjs';
import { clearSessionHistory, recordToolUse } from './session-history.mjs';

const payload = readHookInput();

if (process.argv.includes('--cleanup')) clearSessionHistory(payload);
else recordToolUse(payload);
