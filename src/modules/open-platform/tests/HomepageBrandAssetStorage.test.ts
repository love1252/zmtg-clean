import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createLocalHomepageBrandAssetStorage,
  calculateHomepageBrandAssetSha256,
} from '@/modules/open-platform/server/homepage-brand-asset-storage';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'homepage-brand-assets-'));
  tempDirs.push(dir);
  return dir;
}

describe('首页与品牌素材本地存储', () => {
  it('保存素材时生成安全 storageKey、公开 URL 和 sha256', async () => {
    const rootDir = await createTempDir();
    const storage = createLocalHomepageBrandAssetStorage({ rootDir });
    const content = new TextEncoder().encode('image-bytes');

    const saved = await storage.save({
      assetId: 'asset-a',
      kind: 'logo',
      originalFilename: '../品牌标识.png',
      mimeType: 'image/png',
      content,
    });

    expect(saved).toEqual({
      storageKey: `homepage-brand/logo/asset-a-${calculateHomepageBrandAssetSha256(content)}.png`,
      publicUrl: `/uploads/homepage-brand/logo/asset-a-${calculateHomepageBrandAssetSha256(content)}.png`,
      sha256: calculateHomepageBrandAssetSha256(content),
      sizeBytes: content.byteLength,
    });
    expect(JSON.stringify(saved)).not.toContain('/Users/');
    expect(Array.from(await storage.read({ storageKey: saved.storageKey }))).toEqual(Array.from(content));
  });

  it('拒绝读取越界 storageKey', async () => {
    const rootDir = await createTempDir();
    const storage = createLocalHomepageBrandAssetStorage({ rootDir });

    await expect(storage.read({ storageKey: '../secret.png' })).rejects.toThrow('invalid storage key');
  });
});
