import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  PLATFORM_KNOWLEDGE_FILE_MAX_BYTES,
  archivePlatformKnowledgeFileService,
  downloadPlatformKnowledgeFileService,
  listPlatformKnowledgeFilesService,
  uploadPlatformKnowledgeFileService,
  type PlatformKnowledgeFileRepositoryRecord,
  type PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import {
  downloadInstitutionKnowledgeFileService,
  listInstitutionKnowledgeFilesService,
} from '@/modules/institution/server/institution-knowledge-file-management-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const forbiddenPayloadFields = [
  'content',
  'rawContent',
  'parsedContent',
  'embedding',
  'embeddingVectorJson',
  'trainingContent',
  'storageKey',
  'storagePath',
  '/Users/',
  'var/knowledge-files',
];

const knowledgeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '术后护理知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '低敏摘要。',
    chunkCount: 0,
    visibleInstitutionIds: ['inst-visible-a'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-unshared-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '未授权知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '内部知识',
    descriptionPreview: '不应被其他机构看到。',
    chunkCount: 0,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-b',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-owner-b',
    workspaceId: 'workspace-b',
    title: '跨租户知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: 'tenant A 不可见。',
    chunkCount: 0,
    visibleInstitutionIds: ['inst-visible-b'],
    createdAt: now,
    updatedAt: now,
  },
];

function createUploadFile(input: {
  name: string;
  type: string;
  bytes: Uint8Array;
}) {
  return {
    name: input.name,
    type: input.type,
    size: input.bytes.byteLength,
    arrayBuffer: vi.fn(async () =>
      input.bytes.buffer.slice(
        input.bytes.byteOffset,
        input.bytes.byteOffset + input.bytes.byteLength,
      ),
    ),
  };
}

function expectNoForbiddenFilePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenPayloadFields.forEach((field) => {
    expect(serialized).not.toContain(field);
  });
}

function createFixture() {
  const files: PlatformKnowledgeFileRepositoryRecord[] = [];
  const stored = new Map<string, Uint8Array>();
  const repository = {
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      knowledgeRecords.filter((record) => record.tenantId === input.tenantId),
    ),
    findKnowledgeItem: vi.fn(async (input: { tenantId: string; knowledgeId: string }) =>
      knowledgeRecords.find(
        (record) => record.tenantId === input.tenantId && record.knowledgeId === input.knowledgeId,
      ) ?? null,
    ),
    listKnowledgeFiles: vi.fn(async (input: { tenantId: string; knowledgeId: string }) =>
      files.filter(
        (file) => file.tenantId === input.tenantId && file.knowledgeId === input.knowledgeId,
      ),
    ),
    findKnowledgeFile: vi.fn(async (input: {
      tenantId: string;
      knowledgeId: string;
      fileId: string;
    }) =>
      files.find(
        (file) =>
          file.tenantId === input.tenantId &&
          file.knowledgeId === input.knowledgeId &&
          file.fileId === input.fileId,
      ) ?? null,
    ),
    createKnowledgeFile: vi.fn(async (record: PlatformKnowledgeFileRepositoryRecord) => {
      files.push(record);
      return record;
    }),
    archiveKnowledgeFile: vi.fn(async (input: {
      tenantId: string;
      knowledgeId: string;
      fileId: string;
    }) => {
      const file = files.find(
        (record) =>
          record.tenantId === input.tenantId &&
          record.knowledgeId === input.knowledgeId &&
          record.fileId === input.fileId,
      );
      if (!file) return null;

      const archived = {
        ...file,
        status: 'archived' as const,
        archivedAt: new Date('2026-06-13T09:00:00.000Z'),
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      };
      files.splice(files.indexOf(file), 1, archived);
      return archived;
    }),
  };

  const storage: PlatformKnowledgeFileStorage = {
    save: vi.fn(async ({ tenantId, knowledgeId, fileId, content }) => {
      const storageKey = `${tenantId}/${knowledgeId}/${fileId}.bin`;
      stored.set(storageKey, content);
      return {
        storageKey,
        sha256: 'a'.repeat(64),
        sizeBytes: content.byteLength,
      };
    }),
    read: vi.fn(async ({ storageKey }) => stored.get(storageKey) ?? new Uint8Array()),
  };

  return { files, repository, storage };
}

describe('知识库文件管理 service', () => {
  it('平台端上传成功时写入元数据并使用服务端生成 storage key', async () => {
    const { repository, storage } = createFixture();
    const file = createUploadFile({
      name: '../术后护理.pdf',
      type: 'application/pdf',
      bytes: new TextEncoder().encode('pdf bytes'),
    });

    const response = await uploadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        uploadedByUserId: 'platform-user-a',
        file,
      },
    });

    expect(response.status).toBe('uploaded');
    expect(response.file).toMatchObject({
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-a',
      originalFilename: '术后护理.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9,
      status: 'active',
      uploadedByUserId: 'platform-user-a',
    });
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
      }),
    );
    expect(JSON.stringify(response.file)).not.toContain('..');
    expect(JSON.stringify(response.file)).not.toContain('术后护理.pdf.bin');
    expectNoForbiddenFilePayload(response);
  });

  it.each([
    {
      label: '非法类型',
      file: createUploadFile({
        name: '护理.exe',
        type: 'application/x-msdownload',
        bytes: new Uint8Array([1]),
      }),
      expectedMessage: '文件类型暂不支持',
    },
    {
      label: '超大文件',
      file: {
        name: '护理.pdf',
        type: 'application/pdf',
        size: PLATFORM_KNOWLEDGE_FILE_MAX_BYTES + 1,
        arrayBuffer: vi.fn(async () => new ArrayBuffer(1)),
      },
      expectedMessage: '文件大小不能超过 20MB',
    },
    {
      label: '空文件',
      file: createUploadFile({
        name: '空文件.txt',
        type: 'text/plain',
        bytes: new Uint8Array(),
      }),
      expectedMessage: '文件内容不能为空',
    },
  ])('平台端上传失败：$label', async ({ file, expectedMessage }) => {
    const { repository, storage } = createFixture();

    const response = await uploadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        uploadedByUserId: 'platform-user-a',
        file,
      },
    });

    expect(response).toEqual({
      status: 'validation_failed',
      message: expectedMessage,
    });
    expect(storage.save).not.toHaveBeenCalled();
    expect(repository.createKnowledgeFile).not.toHaveBeenCalled();
  });

  it('平台端不能上传、下载或归档跨 tenant 知识库文件', async () => {
    const { repository, storage } = createFixture();
    const file = createUploadFile({
      name: '跨租户.pdf',
      type: 'application/pdf',
      bytes: new Uint8Array([1]),
    });

    const upload = await uploadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-b',
        uploadedByUserId: 'platform-user-a',
        file,
      },
    });
    expect(upload).toEqual({ status: 'not_found' });
    expect(storage.save).not.toHaveBeenCalled();

    const download = await downloadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-b',
        fileId: 'file-b',
      },
    });
    expect(download).toEqual({ status: 'not_found' });

    const archived = await archivePlatformKnowledgeFileService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-b',
        fileId: 'file-b',
      },
    });
    expect(archived).toEqual({ status: 'not_found' });
  });

  it('平台端列表、归档和下载只返回低敏文件 payload', async () => {
    const { repository, storage } = createFixture();
    const file = createUploadFile({
      name: '护理.md',
      type: 'text/markdown',
      bytes: new TextEncoder().encode('# care'),
    });
    const upload = await uploadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        uploadedByUserId: 'platform-user-a',
        file,
      },
    });
    if (upload.status !== 'uploaded') throw new Error('upload failed');

    const listed = await listPlatformKnowledgeFilesService({
      repository,
      params: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', page: 1, pageSize: 10 },
    });
    if ('status' in listed) throw new Error('list failed');
    expect(listed.records).toEqual([
      expect.objectContaining({
        fileId: upload.file.fileId,
        originalFilename: '护理.md',
        status: 'active',
      }),
    ]);
    expectNoForbiddenFilePayload(listed);

    const downloaded = await downloadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId: upload.file.fileId,
      },
    });
    expect(downloaded).toMatchObject({
      status: 'ready',
      fileName: '护理.md',
      mimeType: 'text/markdown',
    });
    expect(JSON.stringify(downloaded)).not.toContain('/Users/');
    expect(JSON.stringify(downloaded)).not.toContain('var/knowledge-files');

    const archived = await archivePlatformKnowledgeFileService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId: upload.file.fileId,
      },
    });
    expect(archived).toMatchObject({
      status: 'archived',
      file: expect.objectContaining({
        fileId: upload.file.fileId,
        status: 'archived',
      }),
    });

    const afterArchive = await listPlatformKnowledgeFilesService({
      repository,
      params: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', page: 1, pageSize: 10 },
    });
    if ('status' in afterArchive) throw new Error('list failed');
    expect(afterArchive.records).toEqual([
      expect.objectContaining({
        fileId: upload.file.fileId,
        status: 'archived',
      }),
    ]);
  });

  it('机构端只能查看和下载本机构归属或平台授权知识库下的 active 文件', async () => {
    const { repository, storage } = createFixture();
    const active = await uploadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        uploadedByUserId: 'platform-user-a',
        file: createUploadFile({
          name: '授权护理.pdf',
          type: 'application/pdf',
          bytes: new Uint8Array([1, 2, 3]),
        }),
      },
    });
    if (active.status !== 'uploaded') throw new Error('upload failed');
    const archived = await uploadPlatformKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        uploadedByUserId: 'platform-user-a',
        file: createUploadFile({
          name: '已归档.pdf',
          type: 'application/pdf',
          bytes: new Uint8Array([4]),
        }),
      },
    });
    if (archived.status !== 'uploaded') throw new Error('upload failed');
    await archivePlatformKnowledgeFileService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId: archived.file.fileId,
      },
    });

    const visible = await listInstitutionKnowledgeFilesService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-visible-a',
        knowledgeId: 'knowledge-a',
        page: 1,
        pageSize: 10,
      },
    });
    if ('status' in visible) throw new Error('institution list failed');
    expect(visible.records).toEqual([
      expect.objectContaining({
        fileId: active.file.fileId,
        originalFilename: '授权护理.pdf',
        status: 'active',
      }),
    ]);
    expectNoForbiddenFilePayload(visible);

    const downloaded = await downloadInstitutionKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-visible-a',
        knowledgeId: 'knowledge-a',
        fileId: active.file.fileId,
      },
    });
    expect(downloaded).toMatchObject({
      status: 'ready',
      fileName: '授权护理.pdf',
    });

    const institutionB = await listInstitutionKnowledgeFilesService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-other-a',
        knowledgeId: 'knowledge-a',
        page: 1,
        pageSize: 10,
      },
    });
    expect(institutionB).toEqual({ status: 'forbidden' });

    const tenantB = await listInstitutionKnowledgeFilesService({
      repository,
      params: {
        tenantId: 'tenant-b',
        institutionId: 'inst-visible-b',
        knowledgeId: 'knowledge-a',
        page: 1,
        pageSize: 10,
      },
    });
    expect(tenantB).toEqual({ status: 'not_found' });
  });
});
