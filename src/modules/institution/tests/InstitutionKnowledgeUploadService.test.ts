import { describe, expect, it, vi } from 'vitest';
import {
  uploadAndParseInstitutionKnowledgeFileService,
  INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES,
} from '@/modules/institution/server/institution-knowledge-upload-service';

const validFile = (name = 'notes.txt') => ({
  name,
  type: 'text/plain',
  size: 1024,
  arrayBuffer: async () => new Uint8Array(512).buffer as ArrayBuffer,
});

const oversizedFile = (name = 'big.txt') => ({
  name,
  type: 'text/plain',
  size: INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES + 1,
  arrayBuffer: async () => new Uint8Array(INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES + 1).buffer as ArrayBuffer,
});

const pdfFile = (name = 'report.pdf') => ({
  name,
  type: 'application/pdf',
  size: 1024,
  arrayBuffer: async () => new Uint8Array(512).buffer as ArrayBuffer,
});

function createMocks() {
  const repository = {
    findKnowledgeItem: vi.fn(),
    createKnowledgeFile: vi.fn(),
    findKnowledgeFile: vi.fn(),
    findKnowledgeFileParse: vi.fn(),
    saveKnowledgeFileParseResult: vi.fn(),
    replaceKnowledgeFileParseChunks: vi.fn(),
    listKnowledgeFileParseChunks: vi.fn(),
    createInstitutionKnowledgeSource: vi.fn(),
    createInstitutionKnowledgeDocument: vi.fn(),
  };
  const storage = {
    save: vi.fn(),
    read: vi.fn(),
    delete: vi.fn(),
  };

  return { repository, storage };
}

describe('机构知识库上传解析 service', () => {
  it('成功上传 txt 文件并解析', async () => {
    const { repository, storage } = createMocks();
    repository.createInstitutionKnowledgeSource.mockResolvedValue({ sourceId: 'inst-src-test' });
    repository.createInstitutionKnowledgeDocument.mockResolvedValue({ documentId: 'inst-doc-test' });
    storage.save.mockResolvedValue({ storageKey: 'key/test', sha256: 'abc', sizeBytes: 512 });
    repository.createKnowledgeFile.mockResolvedValue({
      fileId: 'kb-file-test',
      tenantId: 'tenant-001',
      knowledgeId: 'inst-doc-test',
      originalFilename: 'notes.txt',
      mimeType: 'text/plain',
      sizeBytes: 512,
      status: 'active' as const,
      sha256: 'abc',
      storageKey: 'key/test',
      uploadedByUserId: 'user-001',
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    });
    repository.findKnowledgeItem.mockResolvedValue(null);
    repository.findKnowledgeFile.mockResolvedValue(null);
    repository.findKnowledgeFileParse.mockResolvedValue(null);
    repository.saveKnowledgeFileParseResult.mockResolvedValue({
      parseId: 'parse-001',
      tenantId: 'tenant-001',
      knowledgeId: 'inst-doc-test',
      fileId: 'kb-file-test',
      parseStatus: 'succeeded',
      failureReasonCode: null,
      safeFailureMessage: null,
      textContent: 'hello world',
      textLength: 11,
      chunkCount: 1,
      parserVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.replaceKnowledgeFileParseChunks.mockResolvedValue([{
      chunkId: 'chunk-001',
      tenantId: 'tenant-001',
      knowledgeId: 'inst-doc-test',
      fileId: 'kb-file-test',
      chunkIndex: 0,
      textPreview: 'hello world',
      charCount: 11,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    storage.read.mockResolvedValue(new Uint8Array(Buffer.from('hello world', 'utf-8')));

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 'tenant-001',
        institutionId: 'inst-001',
        uploadedByUserId: 'user-001',
        file: validFile(),
      },
    });

    expect(result.status).toBe('created');
    expect(result.knowledgeId).toBe('inst-doc-test');
    expect(result.sourceId).toBe('inst-src-test');
    expect(repository.createInstitutionKnowledgeSource).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
      sourceLabel: 'notes.txt',
    });
    expect(repository.createInstitutionKnowledgeDocument).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
      sourceId: 'inst-src-test',
      title: 'notes.txt',
    });
  });

  it('缺少 tenantId 返回 validation_failed', async () => {
    const { repository, storage } = createMocks();

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: { tenantId: null, institutionId: 'inst-001', uploadedByUserId: 'u', file: validFile() },
    });

    expect(result.status).toBe('validation_failed');
  });

  it('缺少 institutionId 返回 validation_failed', async () => {
    const { repository, storage } = createMocks();

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: { tenantId: 't', institutionId: null, uploadedByUserId: 'u', file: validFile() },
    });

    expect(result.status).toBe('validation_failed');
  });

  it('PDF 文件被拒绝', async () => {
    const { repository, storage } = createMocks();

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: { tenantId: 't', institutionId: 'inst', uploadedByUserId: 'u', file: pdfFile() },
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toContain('不支持');
  });

  it('超大文件被拒绝', async () => {
    const { repository, storage } = createMocks();

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: { tenantId: 't', institutionId: 'inst', uploadedByUserId: 'u', file: oversizedFile() },
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toContain('2MB');
  });

  it('空文件被拒绝', async () => {
    const { repository, storage } = createMocks();

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: {
        tenantId: 't',
        institutionId: 'inst',
        uploadedByUserId: 'u',
        file: { name: 'e.txt', type: 'text/plain', size: 0, arrayBuffer: async () => new Uint8Array(0).buffer },
      },
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toContain('不能为空');
  });

  it('结果为 success 且 parse 为 succeeded 时返回状态 created', async () => {
    const { repository, storage } = createMocks();
    repository.createInstitutionKnowledgeSource.mockResolvedValue({ sourceId: 'src' });
    repository.createInstitutionKnowledgeDocument.mockResolvedValue({ documentId: 'doc' });
    storage.save.mockResolvedValue({ storageKey: 'k', sha256: 's', sizeBytes: 100 });
    repository.createKnowledgeFile.mockResolvedValue({
      fileId: 'f', tenantId: 't', knowledgeId: 'doc', originalFilename: 'x.txt',
      mimeType: 'text/plain', sizeBytes: 100, status: 'active' as const, sha256: 's',
      storageKey: 'k', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    repository.findKnowledgeItem.mockResolvedValue({
      knowledgeId: 'doc',
      tenantId: 't',
      institutionId: 'i',
      title: 'x.txt',
      status: 'ready',
      visibleInstitutionIds: ['i'],
    } as unknown as Parameters<typeof repository.findKnowledgeItem>[0] extends never ? never : ReturnType<typeof repository.findKnowledgeItem> extends Promise<infer T> ? T : never);
    repository.findKnowledgeFile.mockResolvedValue({
      fileId: 'f', tenantId: 't', knowledgeId: 'doc', originalFilename: 'x.txt',
      storageKey: 'k', mimeType: 'text/plain', sizeBytes: 100, sha256: 's',
      status: 'active', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    repository.findKnowledgeFileParse.mockResolvedValue(null);
    repository.saveKnowledgeFileParseResult.mockResolvedValue({
      parseId: 'p', tenantId: 't', knowledgeId: 'doc', fileId: 'f', parseStatus: 'succeeded',
      failureReasonCode: null, safeFailureMessage: null, textContent: 'test', textLength: 4,
      chunkCount: 1, parserVersion: 'v1', createdAt: new Date(), updatedAt: new Date(),
    });
    repository.replaceKnowledgeFileParseChunks.mockResolvedValue([]);
    storage.read.mockResolvedValue(new Uint8Array(Buffer.from('test')));

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository, storage,
      input: { tenantId: 't', institutionId: 'i', uploadedByUserId: 'u', file: validFile() },
    });

    expect(result.status).toBe('created');
    expect(result.chunkCount).toBe(1);
  });

  it('JSON 文件上传解析成功且 chunks > 0', async () => {
    const { repository, storage } = createMocks();
    repository.createInstitutionKnowledgeSource.mockResolvedValue({ sourceId: 'src' });
    repository.createInstitutionKnowledgeDocument.mockResolvedValue({ documentId: 'doc' });
    storage.save.mockResolvedValue({ storageKey: 'k', sha256: 's', sizeBytes: 100 });
    repository.createKnowledgeFile.mockResolvedValue({
      fileId: 'f', tenantId: 't', knowledgeId: 'doc', originalFilename: 'data.json',
      mimeType: 'application/json', sizeBytes: 100, status: 'active' as const, sha256: 's',
      storageKey: 'k', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    repository.findKnowledgeItem.mockResolvedValue({
      knowledgeId: 'doc',
      tenantId: 't',
      institutionId: 'i',
      title: 'data.json',
      status: 'ready',
      visibleInstitutionIds: ['i'],
    } as unknown as Parameters<typeof repository.findKnowledgeItem>[0] extends never ? never : ReturnType<typeof repository.findKnowledgeItem> extends Promise<infer T> ? T : never);
    repository.findKnowledgeFile.mockResolvedValue({
      fileId: 'f', tenantId: 't', knowledgeId: 'doc', originalFilename: 'data.json',
      storageKey: 'k', mimeType: 'application/json', sizeBytes: 100, sha256: 's',
      status: 'active', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    repository.findKnowledgeFileParse.mockResolvedValue(null);
    repository.saveKnowledgeFileParseResult.mockResolvedValue({
      parseId: 'p', tenantId: 't', knowledgeId: 'doc', fileId: 'f', parseStatus: 'succeeded',
      failureReasonCode: null, safeFailureMessage: null, textContent: '{"a":1}', textLength: 7,
      chunkCount: 1, parserVersion: 'v1', createdAt: new Date(), updatedAt: new Date(),
    });
    repository.replaceKnowledgeFileParseChunks.mockResolvedValue([]);
    storage.read.mockResolvedValue(new Uint8Array(Buffer.from('{"key":"value","items":[1,2,3]}')));

    const jsonFile = { name: 'data.json', type: 'application/json', size: 100, arrayBuffer: async () => new Uint8Array(Buffer.from('{"key":"value"}')).buffer as ArrayBuffer };

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository, storage,
      input: { tenantId: 't', institutionId: 'i', uploadedByUserId: 'u', file: jsonFile },
    });

    // JSON is on the allowlist, so upload should proceed, then parse with real chunks
    expect(result.status).toBe('created');
    expect(result.chunkCount).toBeGreaterThan(0);
  });
});
