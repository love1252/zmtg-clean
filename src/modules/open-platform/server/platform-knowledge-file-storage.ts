import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { calculateSha256, type PlatformKnowledgeFileStorage } from './platform-knowledge-file-management-service';

type LocalPlatformKnowledgeFileStorageOptions = {
  rootDir?: string;
};

const defaultRootDir = join(process.cwd(), 'var', 'knowledge-files');

function assertSafeStorageKey(storageKey: string) {
  if (!storageKey || storageKey.startsWith('/') || storageKey.includes('\\')) {
    throw new Error('invalid storage key');
  }

  const normalized = normalize(storageKey);
  if (normalized.startsWith('..') || normalized.includes(`${sep}..${sep}`)) {
    throw new Error('invalid storage key');
  }

  return normalized;
}

function assertInsideRoot(rootDir: string, candidatePath: string) {
  const resolvedRoot = resolve(rootDir);
  const resolvedCandidate = resolve(candidatePath);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error('invalid storage key');
  }

  return resolvedCandidate;
}

export function createLocalPlatformKnowledgeFileStorage(
  options: LocalPlatformKnowledgeFileStorageOptions = {},
): PlatformKnowledgeFileStorage {
  const rootDir = options.rootDir ?? defaultRootDir;

  return {
    async save(input) {
      const sha256 = calculateSha256(input.content);
      const storageKey = [
        input.tenantId,
        input.knowledgeId,
        `${input.fileId}-${sha256}.bin`,
      ].join('/');
      const relativePath = assertSafeStorageKey(storageKey);
      const targetPath = assertInsideRoot(rootDir, join(rootDir, relativePath));

      await mkdir(resolve(targetPath, '..'), { recursive: true });
      await writeFile(targetPath, input.content);

      return {
        storageKey,
        sha256,
        sizeBytes: input.content.byteLength,
      };
    },

    async read(input) {
      const relativePath = assertSafeStorageKey(input.storageKey);
      const targetPath = assertInsideRoot(rootDir, join(rootDir, relativePath));

      return new Uint8Array(await readFile(targetPath));
    },

    async delete(input) {
      const relativePath = assertSafeStorageKey(input.storageKey);
      const targetPath = assertInsideRoot(rootDir, join(rootDir, relativePath));

      await unlink(targetPath);
    },
  };
}
