import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as assetsRoute from '@/app/api/v1/open-platform/homepage-brand/assets/route';
import * as draftRoute from '@/app/api/v1/open-platform/homepage-brand/draft/route';
import * as homepageRoute from '@/app/api/v1/open-platform/homepage-brand/route';
import * as publishRoute from '@/app/api/v1/open-platform/homepage-brand/publish/route';
import { cloneHomepageBrandConfig, defaultHomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import { createHomepageBrandRepository } from '@/modules/open-platform/server/homepage-brand-repository';
import type {
  HomepageBrandAssetRecord,
  HomepageBrandAuditLogRecord,
  HomepageBrandConfigRecord,
  HomepageBrandRepository,
  HomepageBrandVersionRecord,
} from '@/modules/open-platform/server/homepage-brand-service';
import { createLocalHomepageBrandAssetStorage } from '@/modules/open-platform/server/homepage-brand-asset-storage';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const database = { database: 'homepage-brand-route-db' };
const storage = {
  save: vi.fn(async () => ({
    storageKey: 'homepage-brand/logo/homepage-brand-asset-route.png',
    publicUrl: '/uploads/homepage-brand/logo/homepage-brand-asset-route.png',
    sha256: 'c'.repeat(64),
    sizeBytes: 9,
  })),
  read: vi.fn(),
  delete: vi.fn(),
};

const repositoryState: {
  config: HomepageBrandConfigRecord | null;
  versions: HomepageBrandVersionRecord[];
  assets: HomepageBrandAssetRecord[];
  auditLogs: HomepageBrandAuditLogRecord[];
} = {
  config: null,
  versions: [],
  assets: [],
  auditLogs: [],
};

const repository: HomepageBrandRepository & {
  createAsset(record: HomepageBrandAssetRecord): Promise<HomepageBrandAssetRecord>;
  listAssets(): Promise<HomepageBrandAssetRecord[]>;
} = {
  findConfig: vi.fn(async () => repositoryState.config),
  upsertConfigDraft: vi.fn(async (record) => {
    repositoryState.config = record;
    return record;
  }),
  listVersions: vi.fn(async () => repositoryState.versions),
  findVersion: vi.fn(async (versionId) =>
    repositoryState.versions.find((version) => version.id === versionId) ?? null,
  ),
  createVersion: vi.fn(async (record) => {
    repositoryState.versions.push(record);
    return record;
  }),
  markConfigPublished: vi.fn(async (input) => {
    const now = input.publishedAt;
    repositoryState.config = {
      id: input.id,
      status: 'published',
      draftConfig: input.draftConfig,
      publishedVersionId: input.publishedVersionId,
      draftUpdatedBy: input.actorId,
      publishedBy: input.actorId,
      publishedAt: now,
      createdAt: repositoryState.config?.createdAt ?? now,
      updatedAt: now,
    };
    return repositoryState.config;
  }),
  createAuditLog: vi.fn(async (record) => {
    repositoryState.auditLogs.push(record);
    return record;
  }),
  listAuditLogs: vi.fn(async () => repositoryState.auditLogs),
  createAsset: vi.fn(async (record) => {
    repositoryState.assets.push(record);
    return record;
  }),
  listAssets: vi.fn(async () => repositoryState.assets),
};

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/homepage-brand-repository', () => ({
  createHomepageBrandRepository: vi.fn(() => repository),
}));

vi.mock('@/modules/open-platform/server/homepage-brand-asset-storage', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/open-platform/server/homepage-brand-asset-storage')
  >('@/modules/open-platform/server/homepage-brand-asset-storage');

  return {
    ...actual,
    createLocalHomepageBrandAssetStorage: vi.fn(() => storage),
  };
});

function platformContext() {
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
    userId: 'platform-user',
    role: 'platform_admin',
    scope: 'platform',
    tenantId: null,
    institutionId: null,
    source: 'demo_session',
  });
}

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

describe('首页与品牌 API route', () => {
  beforeEach(() => {
    repositoryState.config = null;
    repositoryState.versions = [];
    repositoryState.assets = [];
    repositoryState.auditLogs = [];
    Object.values(repository).forEach((mock) => {
      if (typeof mock === 'function' && 'mockClear' in mock) {
        (mock as { mockClear: () => void }).mockClear();
      }
    });
    Object.values(storage).forEach((mock) => mock.mockClear());
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createHomepageBrandRepository).mockClear();
    vi.mocked(createLocalHomepageBrandAssetStorage).mockClear();
    vi.unstubAllEnvs();
  });

  it('未登录访问返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);

    const response = await homepageRoute.GET(new Request('http://localhost/api/v1/open-platform/homepage-brand'));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ ok: false, errorCode: 'UNAUTHORIZED' });
  });

  it('GET 返回默认配置、版本、素材和审计列表', async () => {
    platformContext();

    const response = await homepageRoute.GET(new Request('http://localhost/api/v1/open-platform/homepage-brand'));
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          hero: expect.objectContaining({ titleLine: defaultHomepageBrandConfig.hero.titleLine }),
        }),
        versions: [],
        assets: expect.arrayContaining([
          expect.objectContaining({
            id: 'homepage-brand-system-asset-logo',
            originalFilename: '横版标识（系统同步）',
            publicUrl: defaultHomepageBrandConfig.assets.horizontalLogoUrl,
            uploadedBy: 'system_sync',
          }),
          expect.objectContaining({
            id: 'homepage-brand-system-asset-hero-background',
            originalFilename: '首页背景图（系统同步）',
            publicUrl: defaultHomepageBrandConfig.assets.heroBackgroundUrl,
            uploadedBy: 'system_sync',
          }),
        ]),
        auditLogs: [],
      }),
    );
    expect((payload.assets as unknown[])).toHaveLength(5);
  });

  it('GET 配置服务不可用时返回 503 低敏错误', async () => {
    platformContext();
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(repository.findConfig).mockRejectedValueOnce(new Error('database_unavailable'));

    const response = await homepageRoute.GET(new Request('http://localhost/api/v1/open-platform/homepage-brand'));

    expect(response.status).toBe(503);
    expect(await readJson(response)).toEqual({ ok: false, errorCode: 'HOMEPAGE_BRAND_UNAVAILABLE' });
  });

  it('PUT draft 保存首页配置草稿', async () => {
    platformContext();
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.hero.titleLine = 'API 草稿标题';

    const response = await draftRoute.PUT(
      new Request('http://localhost/api/v1/open-platform/homepage-brand/draft', {
        method: 'PUT',
        body: JSON.stringify({ config }),
      }),
    );
    const payload = await readJson(response);
    expect(response.status).toBe(200);
    expect(payload.status).toBe('saved');
    expect(repository.upsertConfigDraft).toHaveBeenCalled();
  });

  it('PUT draft 持久化失败时返回 503 低敏错误', async () => {
    platformContext();
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(repository.upsertConfigDraft).mockRejectedValueOnce(new Error('database_unavailable'));

    const response = await draftRoute.PUT(
      new Request('http://localhost/api/v1/open-platform/homepage-brand/draft', {
        method: 'PUT',
        body: JSON.stringify({ config: defaultHomepageBrandConfig }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await readJson(response)).toEqual({ ok: false, errorCode: 'HOMEPAGE_BRAND_UNAVAILABLE' });
  });

  it('POST publish 发布当前草稿', async () => {
    platformContext();
    await draftRoute.PUT(
      new Request('http://localhost/api/v1/open-platform/homepage-brand/draft', {
        method: 'PUT',
        body: JSON.stringify({ config: defaultHomepageBrandConfig }),
      }),
    );

    const response = await publishRoute.POST(
      new Request('http://localhost/api/v1/open-platform/homepage-brand/publish', {
        method: 'POST',
        body: JSON.stringify({ summary: 'API 发布' }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe('published');
    expect(payload.version).toEqual(expect.objectContaining({ versionNumber: 1 }));
  });

  it('POST assets 上传品牌图片素材', async () => {
    platformContext();
    const formData = new FormData();
    formData.set('kind', 'logo');
    formData.set('file', new Blob([new TextEncoder().encode('png bytes')], { type: 'image/png' }), '品牌.png');

    const response = await assetsRoute.POST({ formData: async () => formData } as unknown as Request);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe('uploaded');
    expect(payload.asset).toEqual(
      expect.objectContaining({
        kind: 'logo',
        publicUrl: '/uploads/homepage-brand/logo/homepage-brand-asset-route.png',
      }),
    );
    expect(storage.save).toHaveBeenCalled();
  });
});
