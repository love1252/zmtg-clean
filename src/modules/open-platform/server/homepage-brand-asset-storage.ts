import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';

import type { HomepageBrandAssetKind } from './homepage-brand-service';

export const HOMEPAGE_BRAND_ASSET_MAX_BYTES = 5 * 1024 * 1024;

type LocalHomepageBrandAssetStorageOptions = {
  rootDir?: string;
};

type HomepageBrandAssetStorageSaveInput = {
  assetId: string;
  kind: HomepageBrandAssetKind;
  originalFilename: string;
  mimeType: string;
  content: Uint8Array;
};

export type HomepageBrandAssetStorage = {
  save(input: HomepageBrandAssetStorageSaveInput): Promise<{
    storageKey: string;
    publicUrl: string;
    sha256: string;
    sizeBytes: number;
  }>;
  read(input: { storageKey: string }): Promise<Uint8Array>;
  delete(input: { storageKey: string }): Promise<void>;
};

const defaultRootDir = join(process.cwd(), 'var', 'homepage-brand-assets');

const extensionByMimeType = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

export function calculateHomepageBrandAssetSha256(content: Uint8Array) {
  return createHash('sha256').update(content).digest('hex');
}

function extensionForMimeType(mimeType: string) {
  return extensionByMimeType.get(mimeType.trim().toLowerCase()) ?? 'bin';
}

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

export function createLocalHomepageBrandAssetStorage(
  options: LocalHomepageBrandAssetStorageOptions = {},
): HomepageBrandAssetStorage {
  const rootDir = options.rootDir ?? defaultRootDir;

  return {
    async save(input) {
      const sha256 = calculateHomepageBrandAssetSha256(input.content);
      const extension = extensionForMimeType(input.mimeType);
      const storageKey = `homepage-brand/${input.kind}/${input.assetId}-${sha256}.${extension}`;
      const relativePath = assertSafeStorageKey(storageKey);
      const targetPath = assertInsideRoot(rootDir, join(rootDir, relativePath));

      await mkdir(resolve(targetPath, '..'), { recursive: true });
      await writeFile(targetPath, input.content);

      return {
        storageKey,
        publicUrl: `/uploads/${storageKey}`,
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
