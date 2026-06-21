import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { cloneHomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import type {
  HomepageBrandAssetRecord,
  HomepageBrandAuditLogRecord,
  HomepageBrandConfigRecord,
  HomepageBrandRepository,
  HomepageBrandVersionRecord,
} from './homepage-brand-service';

type SerializedConfigRecord = Omit<HomepageBrandConfigRecord, 'createdAt' | 'updatedAt' | 'publishedAt'> & {
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

type SerializedVersionRecord = Omit<HomepageBrandVersionRecord, 'publishedAt' | 'createdAt' | 'updatedAt'> & {
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

type SerializedAssetRecord = Omit<HomepageBrandAssetRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type SerializedAuditLogRecord = Omit<HomepageBrandAuditLogRecord, 'createdAt'> & {
  createdAt: string;
};

type HomepageBrandLocalStore = {
  config: SerializedConfigRecord | null;
  versions: SerializedVersionRecord[];
  assets: SerializedAssetRecord[];
  auditLogs: SerializedAuditLogRecord[];
};

type HomepageBrandLocalRepositoryOptions = {
  storePath?: string;
};

const defaultStorePath = join(process.cwd(), 'var', 'homepage-brand-local-store.json');

function emptyStore(): HomepageBrandLocalStore {
  return {
    config: null,
    versions: [],
    assets: [],
    auditLogs: [],
  };
}

function serializeConfig(record: HomepageBrandConfigRecord): SerializedConfigRecord {
  return {
    ...record,
    draftConfig: cloneHomepageBrandConfig(record.draftConfig),
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function deserializeConfig(record: SerializedConfigRecord): HomepageBrandConfigRecord {
  return {
    ...record,
    draftConfig: cloneHomepageBrandConfig(record.draftConfig),
    publishedAt: record.publishedAt ? new Date(record.publishedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function serializeVersion(record: HomepageBrandVersionRecord): SerializedVersionRecord {
  return {
    ...record,
    config: cloneHomepageBrandConfig(record.config),
    publishedAt: record.publishedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function deserializeVersion(record: SerializedVersionRecord): HomepageBrandVersionRecord {
  return {
    ...record,
    config: cloneHomepageBrandConfig(record.config),
    publishedAt: new Date(record.publishedAt),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function serializeAsset(record: HomepageBrandAssetRecord): SerializedAssetRecord {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function deserializeAsset(record: SerializedAssetRecord): HomepageBrandAssetRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function serializeAuditLog(record: HomepageBrandAuditLogRecord): SerializedAuditLogRecord {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
  };
}

function deserializeAuditLog(record: SerializedAuditLogRecord): HomepageBrandAuditLogRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
  };
}

async function readStore(storePath: string) {
  try {
    return JSON.parse(await readFile(storePath, 'utf8')) as HomepageBrandLocalStore;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return emptyStore();
    throw error;
  }
}

async function writeStore(storePath: string, store: HomepageBrandLocalStore) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export function createLocalHomepageBrandRepository(
  options: HomepageBrandLocalRepositoryOptions = {},
): HomepageBrandRepository & {
  createAsset(record: HomepageBrandAssetRecord): Promise<HomepageBrandAssetRecord>;
  listAssets(): Promise<HomepageBrandAssetRecord[]>;
} {
  const storePath = options.storePath ?? defaultStorePath;

  return {
    async findConfig(id) {
      const store = await readStore(storePath);
      if (!store.config || store.config.id !== id) return null;
      return deserializeConfig(store.config);
    },

    async upsertConfigDraft(record) {
      const store = await readStore(storePath);
      store.config = serializeConfig(record);
      await writeStore(storePath, store);
      return deserializeConfig(store.config);
    },

    async listVersions(configId) {
      const store = await readStore(storePath);
      return store.versions
        .filter((version) => version.configId === configId)
        .sort((left, right) => right.versionNumber - left.versionNumber)
        .map(deserializeVersion);
    },

    async findVersion(versionId) {
      const store = await readStore(storePath);
      const version = store.versions.find((item) => item.id === versionId);
      return version ? deserializeVersion(version) : null;
    },

    async createVersion(record) {
      const store = await readStore(storePath);
      const serialized = serializeVersion(record);
      store.versions = [serialized, ...store.versions.filter((version) => version.id !== record.id)];
      await writeStore(storePath, store);
      return deserializeVersion(serialized);
    },

    async markConfigPublished(input) {
      const store = await readStore(storePath);
      const now = input.publishedAt;
      const record = serializeConfig({
        id: input.id,
        status: 'published',
        draftConfig: input.draftConfig,
        publishedVersionId: input.publishedVersionId,
        draftUpdatedBy: input.actorId,
        publishedBy: input.actorId,
        publishedAt: now,
        createdAt: store.config ? new Date(store.config.createdAt) : now,
        updatedAt: now,
      });
      store.config = record;
      await writeStore(storePath, store);
      return deserializeConfig(record);
    },

    async createAuditLog(record) {
      const store = await readStore(storePath);
      const serialized = serializeAuditLog(record);
      store.auditLogs = [serialized, ...store.auditLogs.filter((auditLog) => auditLog.id !== record.id)];
      await writeStore(storePath, store);
      return deserializeAuditLog(serialized);
    },

    async listAuditLogs(configId) {
      const store = await readStore(storePath);
      return store.auditLogs
        .filter((auditLog) => auditLog.configId === configId)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .slice(0, 50)
        .map(deserializeAuditLog);
    },

    async createAsset(record) {
      const store = await readStore(storePath);
      const serialized = serializeAsset(record);
      store.assets = [serialized, ...store.assets.filter((asset) => asset.id !== record.id)];
      await writeStore(storePath, store);
      return deserializeAsset(serialized);
    },

    async listAssets() {
      const store = await readStore(storePath);
      return store.assets
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .map(deserializeAsset);
    },
  };
}
