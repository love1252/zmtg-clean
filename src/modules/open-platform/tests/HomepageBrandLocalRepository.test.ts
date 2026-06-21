import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';
import {
  homepageBrandConfigId,
  type HomepageBrandConfigRecord,
} from '@/modules/open-platform/server/homepage-brand-service';
import { createLocalHomepageBrandRepository } from '@/modules/open-platform/server/homepage-brand-local-repository';

const tempDirs: string[] = [];

async function tempStorePath() {
  const dir = await mkdtemp(join(tmpdir(), 'homepage-brand-local-repository-'));
  tempDirs.push(dir);
  return join(dir, 'store.json');
}

describe('首页与品牌本地持久化仓库', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('缺少数据库时可持久化草稿并在新实例中恢复', async () => {
    const storePath = await tempStorePath();
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.footer.phone = '0755-12345678';
    config.footer.email = 'local-repository@example.com';
    const now = new Date('2026-06-21T08:00:00.000Z');
    const record: HomepageBrandConfigRecord = {
      id: homepageBrandConfigId,
      status: 'draft',
      draftConfig: config,
      publishedVersionId: null,
      draftUpdatedBy: 'platform-user',
      publishedBy: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await createLocalHomepageBrandRepository({ storePath }).upsertConfigDraft(record);
    const restored = await createLocalHomepageBrandRepository({ storePath }).findConfig(homepageBrandConfigId);

    expect(restored?.draftConfig.footer.phone).toBe('0755-12345678');
    expect(restored?.draftConfig.footer.email).toBe('local-repository@example.com');
  });

  it('共享仓库入口在缺少 DATABASE_URL 时自动使用本地仓库', async () => {
    const storePath = await tempStorePath();
    vi.doMock('@/server/db/client', () => ({
      getDatabase: vi.fn(() => {
        throw new Error('DATABASE_URL is required to use tenant persistence');
      }),
    }));
    vi.doMock('@/modules/open-platform/server/homepage-brand-local-repository', async () => {
      const actual = await vi.importActual<
        typeof import('@/modules/open-platform/server/homepage-brand-local-repository')
      >('@/modules/open-platform/server/homepage-brand-local-repository');
      return {
        ...actual,
        createLocalHomepageBrandRepository: vi.fn(() =>
          actual.createLocalHomepageBrandRepository({ storePath }),
        ),
      };
    });

    const { getHomepageBrandRepository } = await import('@/app/api/v1/open-platform/homepage-brand/_shared');
    const repository = getHomepageBrandRepository();

    expect(await repository.listAssets()).toEqual([]);
  });

  it('数据库首页与品牌表未迁移时降级到本地 demo 持久化', async () => {
    const storePath = await tempStorePath();
    const now = new Date('2026-06-21T08:30:00.000Z');
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.sections.diagnosis.title = '缺表降级保存标题';
    const record: HomepageBrandConfigRecord = {
      id: homepageBrandConfigId,
      status: 'draft',
      draftConfig: config,
      publishedVersionId: null,
      draftUpdatedBy: 'platform-user',
      publishedBy: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const missingTableError = new Error('database_unavailable');
    const failingRepository = {
      findConfig: vi.fn(async () => {
        throw missingTableError;
      }),
      upsertConfigDraft: vi.fn(async () => {
        throw missingTableError;
      }),
      listVersions: vi.fn(async () => {
        throw missingTableError;
      }),
      findVersion: vi.fn(async () => {
        throw missingTableError;
      }),
      createVersion: vi.fn(async () => {
        throw missingTableError;
      }),
      markConfigPublished: vi.fn(async () => {
        throw missingTableError;
      }),
      createAuditLog: vi.fn(async () => {
        throw missingTableError;
      }),
      listAuditLogs: vi.fn(async () => {
        throw missingTableError;
      }),
      createAsset: vi.fn(async () => {
        throw missingTableError;
      }),
      listAssets: vi.fn(async () => {
        throw missingTableError;
      }),
    };
    const { createHomepageBrandRepositoryWithLocalFallback } = await import(
      '@/app/api/v1/open-platform/homepage-brand/_shared'
    );
    const repository = createHomepageBrandRepositoryWithLocalFallback(
      failingRepository,
      createLocalHomepageBrandRepository({ storePath }),
    );

    await repository.upsertConfigDraft(record);
    const restored = await repository.findConfig(homepageBrandConfigId);

    expect(restored?.draftConfig.sections.diagnosis.title).toBe('缺表降级保存标题');
  });
});
