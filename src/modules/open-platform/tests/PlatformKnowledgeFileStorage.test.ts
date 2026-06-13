import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';

let tempRoot: string | null = null;

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

describe('平台知识库本地受控文件存储', () => {
  it('生成服务端 storage key，不使用用户文件名作为路径并可按 key 读取', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'zmtg-kb-storage-'));
    const storage = createLocalPlatformKnowledgeFileStorage({ rootDir: tempRoot });
    const content = new TextEncoder().encode('safe file');

    const saved = await storage.save({
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-a',
      fileId: 'file-a',
      originalFilename: '../../护理资料.pdf',
      mimeType: 'application/pdf',
      content,
    });

    expect(saved.storageKey).toMatch(/^tenant-a\/knowledge-a\/file-a-[a-f0-9]{64}\.bin$/u);
    expect(saved.storageKey).not.toContain('护理资料');
    expect(saved.storageKey).not.toContain('..');
    expect(saved.sizeBytes).toBe(content.byteLength);
    expect(saved.sha256).toHaveLength(64);
    await expect(storage.read({ storageKey: '../outside.bin' })).rejects.toThrow('invalid storage key');
    await expect(storage.read({ storageKey: '/absolute/outside.bin' })).rejects.toThrow(
      'invalid storage key',
    );
    await expect(storage.read({ storageKey: saved.storageKey })).resolves.toSatisfy(
      (value: Uint8Array) => JSON.stringify(Array.from(value)) === JSON.stringify(Array.from(content)),
    );
    await expect(storage.delete({ storageKey: '../outside.bin' })).rejects.toThrow('invalid storage key');
    await expect(storage.delete({ storageKey: '/absolute/outside.bin' })).rejects.toThrow(
      'invalid storage key',
    );
    await expect(storage.delete({ storageKey: saved.storageKey })).resolves.toBeUndefined();
    await expect(storage.read({ storageKey: saved.storageKey })).rejects.toThrow();
  });
});
