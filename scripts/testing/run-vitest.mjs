import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  resolveRuntimeNode,
} from '../runtime/resolve-runtime-node.mjs';

const vitestCli = fileURLToPath(
  new URL(
    '../../node_modules/vitest/vitest.mjs',
    import.meta.url,
  ),
);

const result = spawnSync(
  resolveRuntimeNode(),
  [
    vitestCli,
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

process.exit(result.status ?? 1);
