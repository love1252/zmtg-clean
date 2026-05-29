import { existsSync } from 'node:fs';

const codexSignedNode = '/Users/dongxiaolong/.cache/zmtg-runtime/node';

export function resolveRuntimeNode() {
  return existsSync(codexSignedNode) ? codexSignedNode : process.execPath;
}
