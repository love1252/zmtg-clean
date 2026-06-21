import { describe, expect, it, vi } from 'vitest';

import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
  type HomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';
import {
  homepageBrandConfigId,
  getHomepageBrandManagementViewService,
  publishHomepageBrandConfigService,
  rollbackHomepageBrandConfigService,
  saveHomepageBrandDraftService,
  getPublishedHomepageBrandConfigService,
  uploadHomepageBrandAssetService,
  type HomepageBrandAuditLogRecord,
  type HomepageBrandConfigRecord,
  type HomepageBrandRepository,
  type HomepageBrandVersionRecord,
} from '@/modules/open-platform/server/homepage-brand-service';

const now = new Date('2026-06-20T08:00:00.000Z');

function changedConfig() {
  const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
  config.hero.titleLine = '让品牌首页';
  config.hero.accentLine = '保持真实可控';
  return config;
}

function createRepository() {
  const configs = new Map<string, HomepageBrandConfigRecord>();
  const versions: HomepageBrandVersionRecord[] = [];
  const auditLogs: HomepageBrandAuditLogRecord[] = [];
  const assets: Array<{
    id: string;
    kind: 'logo' | 'night_logo' | 'mark_logo' | 'hero_background' | 'share_image';
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    publicUrl: string;
    checksumSha256: string;
    uploadedBy: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const repository: HomepageBrandRepository & {
    createAsset(record: (typeof assets)[number]): Promise<(typeof assets)[number]>;
    listAssets(): Promise<typeof assets>;
  } = {
    findConfig: vi.fn(async (id: string) => configs.get(id) ?? null),
    upsertConfigDraft: vi.fn(async (record: HomepageBrandConfigRecord) => {
      configs.set(record.id, record);
      return record;
    }),
    listVersions: vi.fn(async (configId: string) =>
      versions.filter((version) => version.configId === configId),
    ),
    findVersion: vi.fn(async (versionId: string) =>
      versions.find((version) => version.id === versionId) ?? null,
    ),
    createVersion: vi.fn(async (record: HomepageBrandVersionRecord) => {
      versions.push(record);
      return record;
    }),
    markConfigPublished: vi.fn(async (input) => {
      const current = configs.get(input.id);
      const next: HomepageBrandConfigRecord = {
        id: input.id,
        status: 'published',
        draftConfig: input.draftConfig,
        publishedVersionId: input.publishedVersionId,
        draftUpdatedBy: input.actorId,
        publishedBy: input.actorId,
        publishedAt: input.publishedAt,
        createdAt: current?.createdAt ?? input.publishedAt,
        updatedAt: input.publishedAt,
      };
      configs.set(input.id, next);
      return next;
    }),
    createAuditLog: vi.fn(async (record: HomepageBrandAuditLogRecord) => {
      auditLogs.push(record);
      return record;
    }),
    listAuditLogs: vi.fn(async () => auditLogs),
    createAsset: vi.fn(async (record) => {
      assets.push(record);
      return record;
    }),
    listAssets: vi.fn(async () => assets),
  };

  return { assets, auditLogs, configs, repository, versions };
}

function createUploadFile(input: { name: string; type: string; bytes: Uint8Array }) {
  return {
    name: input.name,
    type: input.type,
    size: input.bytes.byteLength,
    arrayBuffer: vi.fn(async () => new Uint8Array(input.bytes).buffer),
  };
}

describe('首页与品牌配置 service', () => {
  it('保存草稿时校验配置并记录审计', async () => {
    const { auditLogs, configs, repository } = createRepository();
    const config = changedConfig();

    const result = await saveHomepageBrandDraftService({
      repository,
      input: { actorId: 'platform-user-a', config },
      now: () => now,
      createId: (prefix) => `${prefix}-a`,
    });

    expect(result.status).toBe('saved');
    expect(result.config.hero.titleLine).toBe('让品牌首页');
    expect(configs.get(homepageBrandConfigId)).toMatchObject({
      status: 'draft',
      draftUpdatedBy: 'platform-user-a',
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      id: 'homepage-brand-audit-a',
      action: 'save_draft',
      actorId: 'platform-user-a',
      summary: '保存首页与品牌草稿',
    });
  });

  it('配置不合法时拒绝保存且不写审计', async () => {
    const { auditLogs, repository } = createRepository();
    const config = changedConfig();
    config.hero.titleLine = '';

    const result = await saveHomepageBrandDraftService({
      repository,
      input: { actorId: 'platform-user-a', config },
      now: () => now,
      createId: (prefix) => `${prefix}-a`,
    });

    expect(result.status).toBe('validation_error');
    expect(result.errors).toContain('首页主标题不能为空');
    expect(repository.upsertConfigDraft).not.toHaveBeenCalled();
    expect(auditLogs).toHaveLength(0);
  });

  it('发布草稿时生成递增版本并把配置标记为已发布', async () => {
    const { auditLogs, repository, versions } = createRepository();
    await saveHomepageBrandDraftService({
      repository,
      input: { actorId: 'platform-user-a', config: changedConfig() },
      now: () => now,
      createId: (prefix) => `${prefix}-draft`,
    });

    const result = await publishHomepageBrandConfigService({
      repository,
      input: { actorId: 'platform-user-b', summary: '首版发布' },
      now: () => now,
      createId: (prefix) => `${prefix}-publish`,
    });

    expect(result.status).toBe('published');
    if (result.status !== 'published') throw new Error('expected published result');
    expect(result.version.versionNumber).toBe(1);
    expect(result.version.summary).toBe('首版发布');
    expect(versions).toHaveLength(1);
    expect(versions[0].config.hero.accentLine).toBe('保持真实可控');
    expect(auditLogs.at(-1)).toMatchObject({
      action: 'publish',
      actorId: 'platform-user-b',
      versionId: 'homepage-brand-version-publish',
    });
  });

  it('回滚历史版本时创建新的发布版本并写入回滚审计', async () => {
    const { auditLogs, repository } = createRepository();
    const firstConfig = changedConfig();
    await saveHomepageBrandDraftService({
      repository,
      input: { actorId: 'platform-user-a', config: firstConfig },
      now: () => now,
      createId: (prefix) => `${prefix}-first-draft`,
    });
    const firstPublish = await publishHomepageBrandConfigService({
      repository,
      input: { actorId: 'platform-user-a', summary: '首版发布' },
      now: () => now,
      createId: (prefix) => `${prefix}-first`,
    });
    if (firstPublish.status !== 'published') throw new Error('expected first publish result');

    const secondConfig: HomepageBrandConfig = changedConfig();
    secondConfig.hero.titleLine = '第二版标题';
    await saveHomepageBrandDraftService({
      repository,
      input: { actorId: 'platform-user-b', config: secondConfig },
      now: () => now,
      createId: (prefix) => `${prefix}-second-draft`,
    });
    await publishHomepageBrandConfigService({
      repository,
      input: { actorId: 'platform-user-b', summary: '第二版发布' },
      now: () => now,
      createId: (prefix) => `${prefix}-second`,
    });

    const rollback = await rollbackHomepageBrandConfigService({
      repository,
      input: { actorId: 'platform-user-c', versionId: firstPublish.version.id, summary: '回滚到首版' },
      now: () => now,
      createId: (prefix) => `${prefix}-rollback`,
    });

    expect(rollback.status).toBe('rolled_back');
    if (rollback.status !== 'rolled_back') throw new Error('expected rollback result');
    expect(rollback.version.versionNumber).toBe(3);
    expect(rollback.config.hero.titleLine).toBe(firstConfig.hero.titleLine);
    expect(auditLogs.at(-1)).toMatchObject({
      action: 'rollback',
      actorId: 'platform-user-c',
      versionId: 'homepage-brand-version-rollback',
      metadata: { fromVersionId: firstPublish.version.id },
    });
  });

  it('管理视图自动同步当前系统正在使用的品牌素材', async () => {
    const { repository } = createRepository();

    const view = await getHomepageBrandManagementViewService({ repository });

    expect(view.assets).toHaveLength(5);
    expect(view.assets.map((asset) => asset.publicUrl)).toEqual([
      defaultHomepageBrandConfig.assets.horizontalLogoUrl,
      defaultHomepageBrandConfig.assets.horizontalLogoNightUrl,
      defaultHomepageBrandConfig.assets.markLogoUrl,
      defaultHomepageBrandConfig.assets.heroBackgroundUrl,
      defaultHomepageBrandConfig.assets.shareImageUrl,
    ]);
    expect(view.assets.map((asset) => asset.uploadedBy)).toEqual([
      'system_sync',
      'system_sync',
      'system_sync',
      'system_sync',
      'system_sync',
    ]);
    expect(view.assets[0]).toMatchObject({
      id: 'homepage-brand-system-asset-logo',
      kind: 'logo',
      originalFilename: '横版标识（系统同步）',
      mimeType: 'image/png',
      sizeBytes: 0,
    });
  });

  it('上传品牌素材时写入资产记录并记录审计', async () => {
    const { assets, auditLogs, repository } = createRepository();
    const content = new TextEncoder().encode('png bytes');
    const storage = {
      save: vi.fn(async () => ({
        storageKey: 'homepage-brand/logo/homepage-brand-asset-a.png',
        publicUrl: '/uploads/homepage-brand/logo/homepage-brand-asset-a.png',
        sha256: 'b'.repeat(64),
        sizeBytes: content.byteLength,
      })),
      read: vi.fn(),
      delete: vi.fn(),
    };

    const result = await uploadHomepageBrandAssetService({
      repository,
      storage,
      input: {
        actorId: 'platform-user-a',
        kind: 'logo',
        file: createUploadFile({ name: '../品牌.png', type: 'image/png', bytes: content }),
      },
      now: () => now,
      createId: (prefix) => `${prefix}-a`,
    });

    expect(result.status).toBe('uploaded');
    expect(result.asset).toMatchObject({
      id: 'homepage-brand-asset-a',
      kind: 'logo',
      originalFilename: '品牌.png',
      publicUrl: '/uploads/homepage-brand/logo/homepage-brand-asset-a.png',
    });
    expect(assets).toHaveLength(1);
    expect(storage.save).toHaveBeenCalled();
    expect(auditLogs.at(-1)).toMatchObject({
      id: 'homepage-brand-audit-a',
      action: 'upload_asset',
      assetId: 'homepage-brand-asset-a',
      summary: '上传首页与品牌素材',
    });
  });

  it('上传素材时拒绝非图片文件', async () => {
    const { repository } = createRepository();
    const storage = {
      save: vi.fn(),
      read: vi.fn(),
      delete: vi.fn(),
    };

    const result = await uploadHomepageBrandAssetService({
      repository,
      storage,
      input: {
        actorId: 'platform-user-a',
        kind: 'logo',
        file: createUploadFile({
          name: '脚本.js',
          type: 'application/javascript',
          bytes: new TextEncoder().encode('alert(1)'),
        }),
      },
      now: () => now,
      createId: (prefix) => `${prefix}-a`,
    });

    expect(result.status).toBe('validation_error');
    expect(result.errors).toContain('素材类型仅支持 PNG、JPG、WEBP 图片');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('真实首页读取已发布版本，没有发布时回退默认配置', async () => {
    const { repository } = createRepository();

    const fallback = await getPublishedHomepageBrandConfigService({ repository });
    expect(fallback.hero.titleLine).toBe(defaultHomepageBrandConfig.hero.titleLine);

    await saveHomepageBrandDraftService({
      repository,
      input: { actorId: 'platform-user-a', config: changedConfig() },
      now: () => now,
      createId: (prefix) => `${prefix}-draft`,
    });
    await publishHomepageBrandConfigService({
      repository,
      input: { actorId: 'platform-user-a', summary: '发布给真实首页' },
      now: () => now,
      createId: (prefix) => `${prefix}-published`,
    });

    const published = await getPublishedHomepageBrandConfigService({ repository });
    expect(published.hero.titleLine).toBe('让品牌首页');
    expect(published.hero.accentLine).toBe('保持真实可控');
  });
});
