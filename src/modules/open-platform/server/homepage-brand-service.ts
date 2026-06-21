import { randomUUID } from 'node:crypto';

import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
  validateHomepageBrandConfig,
  type HomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';

export const homepageBrandConfigId = 'homepage-brand-default';

export type HomepageBrandConfigStatus = 'draft' | 'published' | 'archived';
export type HomepageBrandAssetKind = 'logo' | 'night_logo' | 'mark_logo' | 'hero_background' | 'share_image';
export type HomepageBrandAuditAction = 'save_draft' | 'upload_asset' | 'publish' | 'rollback';
export const homepageBrandAssetMaxBytes = 5 * 1024 * 1024;

export type HomepageBrandConfigRecord = {
  id: string;
  status: HomepageBrandConfigStatus;
  draftConfig: HomepageBrandConfig;
  publishedVersionId: string | null;
  draftUpdatedBy: string;
  publishedBy: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type HomepageBrandVersionRecord = {
  id: string;
  configId: string;
  versionNumber: number;
  config: HomepageBrandConfig;
  summary: string;
  publishedBy: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type HomepageBrandAuditLogRecord = {
  id: string;
  action: HomepageBrandAuditAction;
  configId: string | null;
  versionId: string | null;
  assetId: string | null;
  actorId: string;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: Date;
};

export type HomepageBrandAssetRecord = {
  id: string;
  kind: HomepageBrandAssetKind;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  publicUrl: string;
  checksumSha256: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HomepageBrandRepository = {
  findConfig(id: string): Promise<HomepageBrandConfigRecord | null>;
  upsertConfigDraft(record: HomepageBrandConfigRecord): Promise<HomepageBrandConfigRecord>;
  listVersions(configId: string): Promise<HomepageBrandVersionRecord[]>;
  findVersion(versionId: string): Promise<HomepageBrandVersionRecord | null>;
  createVersion(record: HomepageBrandVersionRecord): Promise<HomepageBrandVersionRecord>;
  markConfigPublished(input: {
    id: string;
    draftConfig: HomepageBrandConfig;
    publishedVersionId: string;
    actorId: string;
    publishedAt: Date;
  }): Promise<HomepageBrandConfigRecord>;
  createAuditLog(record: HomepageBrandAuditLogRecord): Promise<HomepageBrandAuditLogRecord>;
  listAuditLogs(configId: string): Promise<HomepageBrandAuditLogRecord[]>;
};

export type HomepageBrandAssetRepository = HomepageBrandRepository & {
  createAsset(record: HomepageBrandAssetRecord): Promise<HomepageBrandAssetRecord>;
  listAssets(): Promise<HomepageBrandAssetRecord[]>;
};

export type HomepageBrandUploadFileLike = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type HomepageBrandAssetStorageLike = {
  save(input: {
    assetId: string;
    kind: HomepageBrandAssetKind;
    originalFilename: string;
    mimeType: string;
    content: Uint8Array;
  }): Promise<{
    storageKey: string;
    publicUrl: string;
    sha256: string;
    sizeBytes: number;
  }>;
  delete(input: { storageKey: string }): Promise<void>;
};

type RuntimeDeps = {
  now?: () => Date;
  createId?: (prefix: string) => string;
};

type SaveDraftInput = {
  actorId: string;
  config: HomepageBrandConfig;
};

type PublishInput = {
  actorId: string;
  summary: string;
};

type RollbackInput = {
  actorId: string;
  versionId: string;
  summary: string;
};

type UploadAssetInput = {
  actorId: string;
  kind: HomepageBrandAssetKind;
  file: HomepageBrandUploadFileLike | null;
};

const allowedAssetMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const homepageBrandSystemAssetSyncedAt = new Date('1970-01-01T00:00:00.000Z');

const homepageBrandSystemAssetDefinitions: Array<{
  kind: HomepageBrandAssetKind;
  idSuffix: string;
  originalFilename: string;
  assetUrl: (config: HomepageBrandConfig) => string;
}> = [
  {
    kind: 'logo',
    idSuffix: 'logo',
    originalFilename: '横版标识（系统同步）',
    assetUrl: (config) => config.assets.horizontalLogoUrl,
  },
  {
    kind: 'night_logo',
    idSuffix: 'night-logo',
    originalFilename: '夜间横版标识（系统同步）',
    assetUrl: (config) => config.assets.horizontalLogoNightUrl,
  },
  {
    kind: 'mark_logo',
    idSuffix: 'mark-logo',
    originalFilename: '图形标识（系统同步）',
    assetUrl: (config) => config.assets.markLogoUrl,
  },
  {
    kind: 'hero_background',
    idSuffix: 'hero-background',
    originalFilename: '首页背景图（系统同步）',
    assetUrl: (config) => config.assets.heroBackgroundUrl,
  },
  {
    kind: 'share_image',
    idSuffix: 'share-image',
    originalFilename: '分享封面图（系统同步）',
    assetUrl: (config) => config.assets.shareImageUrl,
  },
];

function defaultNow() {
  return new Date();
}

function defaultCreateId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function getNow(deps: RuntimeDeps) {
  return deps.now?.() ?? defaultNow();
}

function createRecordId(deps: RuntimeDeps, prefix: string) {
  return (deps.createId ?? defaultCreateId)(prefix);
}

function defaultDraftRecord(actorId: string, now: Date): HomepageBrandConfigRecord {
  return {
    id: homepageBrandConfigId,
    status: 'draft',
    draftConfig: cloneHomepageBrandConfig(defaultHomepageBrandConfig),
    publishedVersionId: null,
    draftUpdatedBy: actorId,
    publishedBy: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function inferAssetMimeType(publicUrl: string) {
  const lowerUrl = publicUrl.toLowerCase();
  if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerUrl.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function buildHomepageBrandSystemAssets(config: HomepageBrandConfig): HomepageBrandAssetRecord[] {
  return homepageBrandSystemAssetDefinitions.map((definition) => {
    const publicUrl = definition.assetUrl(config);

    return {
      id: `homepage-brand-system-asset-${definition.idSuffix}`,
      kind: definition.kind,
      originalFilename: definition.originalFilename,
      mimeType: inferAssetMimeType(publicUrl),
      sizeBytes: 0,
      storageKey: publicUrl.replace(/^\/+/, ''),
      publicUrl,
      checksumSha256: `system-sync-${definition.idSuffix}`,
      uploadedBy: 'system_sync',
      createdAt: homepageBrandSystemAssetSyncedAt,
      updatedAt: homepageBrandSystemAssetSyncedAt,
    };
  });
}

async function recordAudit(input: {
  repository: HomepageBrandRepository;
  deps: RuntimeDeps;
  action: HomepageBrandAuditAction;
  actorId: string;
  summary: string;
  configId?: string | null;
  versionId?: string | null;
  assetId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: Date;
}) {
  return input.repository.createAuditLog({
    id: createRecordId(input.deps, 'homepage-brand-audit'),
    action: input.action,
    configId: input.configId ?? homepageBrandConfigId,
    versionId: input.versionId ?? null,
    assetId: input.assetId ?? null,
    actorId: input.actorId,
    summary: input.summary,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt,
  });
}

function nextVersionNumber(versions: HomepageBrandVersionRecord[]) {
  return versions.reduce((max, version) => Math.max(max, version.versionNumber), 0) + 1;
}

function normalizeSummary(summary: string, fallback: string) {
  const trimmed = summary.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 240) : fallback;
}

function sanitizeDisplayFilename(filename: string) {
  const normalized = filename.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? 'brand-asset';
  return normalized.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 180) || 'brand-asset';
}

function validateUploadFile(file: HomepageBrandUploadFileLike | null) {
  if (!file) return { ok: false as const, errors: ['请选择要上传的素材'] };

  const mimeType = file.type.trim().toLowerCase();
  if (!allowedAssetMimeTypes.has(mimeType)) {
    return { ok: false as const, errors: ['素材类型仅支持 PNG、JPG、WEBP 图片'] };
  }

  if (file.size <= 0) {
    return { ok: false as const, errors: ['素材内容不能为空'] };
  }

  if (file.size > homepageBrandAssetMaxBytes) {
    return { ok: false as const, errors: ['素材大小不能超过 5MB'] };
  }

  return {
    ok: true as const,
    originalFilename: sanitizeDisplayFilename(file.name),
    mimeType,
  };
}

export async function saveHomepageBrandDraftService(input: {
  repository: HomepageBrandRepository;
  input: SaveDraftInput;
} & RuntimeDeps) {
  const errors = validateHomepageBrandConfig(input.input.config);
  if (errors.length > 0) {
    return {
      status: 'validation_error' as const,
      errors,
      config: cloneHomepageBrandConfig(input.input.config),
    };
  }

  const now = getNow(input);
  const current = await input.repository.findConfig(homepageBrandConfigId);
  const record: HomepageBrandConfigRecord = {
    ...(current ?? defaultDraftRecord(input.input.actorId, now)),
    id: homepageBrandConfigId,
    status: current?.status === 'published' ? 'draft' : current?.status ?? 'draft',
    draftConfig: cloneHomepageBrandConfig(input.input.config),
    draftUpdatedBy: input.input.actorId,
    updatedAt: now,
  };

  const saved = await input.repository.upsertConfigDraft(record);
  await recordAudit({
    repository: input.repository,
    deps: input,
    action: 'save_draft',
    actorId: input.input.actorId,
    summary: '保存首页与品牌草稿',
    createdAt: now,
  });

  return {
    status: 'saved' as const,
    config: cloneHomepageBrandConfig(saved.draftConfig),
    record: saved,
  };
}

export async function getHomepageBrandManagementViewService(input: {
  repository: HomepageBrandAssetRepository;
}) {
  const configRecord = await input.repository.findConfig(homepageBrandConfigId);
  const versions = await input.repository.listVersions(homepageBrandConfigId);
  const assets = await input.repository.listAssets();
  const auditLogs = await input.repository.listAuditLogs(homepageBrandConfigId);
  const config = cloneHomepageBrandConfig(configRecord?.draftConfig ?? defaultHomepageBrandConfig);

  return {
    config,
    status: configRecord?.status ?? 'draft',
    publishedVersionId: configRecord?.publishedVersionId ?? null,
    publishedAt: configRecord?.publishedAt?.toISOString() ?? null,
    versions,
    assets: [...buildHomepageBrandSystemAssets(config), ...assets],
    auditLogs,
  };
}

export async function listHomepageBrandVersionsService(input: {
  repository: HomepageBrandRepository;
}) {
  return {
    versions: await input.repository.listVersions(homepageBrandConfigId),
  };
}

export async function getPublishedHomepageBrandConfigService(input: {
  repository: HomepageBrandRepository;
}) {
  const configRecord = await input.repository.findConfig(homepageBrandConfigId);
  if (!configRecord?.publishedVersionId) {
    return cloneHomepageBrandConfig(defaultHomepageBrandConfig);
  }

  const version = await input.repository.findVersion(configRecord.publishedVersionId);
  return cloneHomepageBrandConfig(version?.config ?? defaultHomepageBrandConfig);
}

export async function publishHomepageBrandConfigService(input: {
  repository: HomepageBrandRepository;
  input: PublishInput;
} & RuntimeDeps) {
  const now = getNow(input);
  const current = await input.repository.findConfig(homepageBrandConfigId);
  const draft = current ?? defaultDraftRecord(input.input.actorId, now);
  const errors = validateHomepageBrandConfig(draft.draftConfig);

  if (errors.length > 0) {
    return {
      status: 'validation_error' as const,
      errors,
      config: cloneHomepageBrandConfig(draft.draftConfig),
    };
  }

  const versions = await input.repository.listVersions(homepageBrandConfigId);
  const version: HomepageBrandVersionRecord = {
    id: createRecordId(input, 'homepage-brand-version'),
    configId: homepageBrandConfigId,
    versionNumber: nextVersionNumber(versions),
    config: cloneHomepageBrandConfig(draft.draftConfig),
    summary: normalizeSummary(input.input.summary, '发布首页与品牌配置'),
    publishedBy: input.input.actorId,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const savedVersion = await input.repository.createVersion(version);
  const published = await input.repository.markConfigPublished({
    id: homepageBrandConfigId,
    draftConfig: savedVersion.config,
    publishedVersionId: savedVersion.id,
    actorId: input.input.actorId,
    publishedAt: now,
  });

  await recordAudit({
    repository: input.repository,
    deps: input,
    action: 'publish',
    actorId: input.input.actorId,
    summary: '发布首页与品牌配置',
    versionId: savedVersion.id,
    createdAt: now,
  });

  return {
    status: 'published' as const,
    config: cloneHomepageBrandConfig(published.draftConfig),
    record: published,
    version: savedVersion,
  };
}

export async function rollbackHomepageBrandConfigService(input: {
  repository: HomepageBrandRepository;
  input: RollbackInput;
} & RuntimeDeps) {
  const now = getNow(input);
  const target = await input.repository.findVersion(input.input.versionId);

  if (!target) {
    return {
      status: 'not_found' as const,
      errors: ['发布版本不存在'],
      config: cloneHomepageBrandConfig(defaultHomepageBrandConfig),
    };
  }

  const versions = await input.repository.listVersions(homepageBrandConfigId);
  const version: HomepageBrandVersionRecord = {
    id: createRecordId(input, 'homepage-brand-version'),
    configId: homepageBrandConfigId,
    versionNumber: nextVersionNumber(versions),
    config: cloneHomepageBrandConfig(target.config),
    summary: normalizeSummary(input.input.summary, `回滚到版本 ${target.versionNumber}`),
    publishedBy: input.input.actorId,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const savedVersion = await input.repository.createVersion(version);
  const published = await input.repository.markConfigPublished({
    id: homepageBrandConfigId,
    draftConfig: savedVersion.config,
    publishedVersionId: savedVersion.id,
    actorId: input.input.actorId,
    publishedAt: now,
  });

  await recordAudit({
    repository: input.repository,
    deps: input,
    action: 'rollback',
    actorId: input.input.actorId,
    summary: '回滚首页与品牌配置',
    versionId: savedVersion.id,
    metadata: { fromVersionId: target.id },
    createdAt: now,
  });

  return {
    status: 'rolled_back' as const,
    config: cloneHomepageBrandConfig(published.draftConfig),
    record: published,
    version: savedVersion,
  };
}

export async function uploadHomepageBrandAssetService(input: {
  repository: HomepageBrandAssetRepository;
  storage: HomepageBrandAssetStorageLike;
  input: UploadAssetInput;
} & RuntimeDeps) {
  const validated = validateUploadFile(input.input.file);
  if (!validated.ok) {
    return {
      status: 'validation_error' as const,
      errors: validated.errors,
    };
  }

  const file = input.input.file;
  if (!file) {
    return {
      status: 'validation_error' as const,
      errors: ['请选择要上传的素材'],
    };
  }

  const content = new Uint8Array(await file.arrayBuffer());
  if (content.byteLength <= 0) {
    return {
      status: 'validation_error' as const,
      errors: ['素材内容不能为空'],
    };
  }
  if (content.byteLength > homepageBrandAssetMaxBytes) {
    return {
      status: 'validation_error' as const,
      errors: ['素材大小不能超过 5MB'],
    };
  }

  const now = getNow(input);
  const assetId = createRecordId(input, 'homepage-brand-asset');
  const saved = await input.storage.save({
    assetId,
    kind: input.input.kind,
    originalFilename: validated.originalFilename,
    mimeType: validated.mimeType,
    content,
  });

  let asset: HomepageBrandAssetRecord;
  try {
    asset = await input.repository.createAsset({
      id: assetId,
      kind: input.input.kind,
      originalFilename: validated.originalFilename,
      mimeType: validated.mimeType,
      sizeBytes: saved.sizeBytes,
      storageKey: saved.storageKey,
      publicUrl: saved.publicUrl,
      checksumSha256: saved.sha256,
      uploadedBy: input.input.actorId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    await input.storage.delete({ storageKey: saved.storageKey }).catch(() => undefined);
    throw error;
  }

  await recordAudit({
    repository: input.repository,
    deps: input,
    action: 'upload_asset',
    actorId: input.input.actorId,
    summary: '上传首页与品牌素材',
    assetId,
    metadata: { kind: input.input.kind },
    createdAt: now,
  });

  return {
    status: 'uploaded' as const,
    asset,
  };
}
