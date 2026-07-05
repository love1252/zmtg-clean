import type { KnowledgeIndexingJobRecord } from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';
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

const imageFile = (name: string, type: string) => ({
  name,
  type,
  size: 1024,
  arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer,
});

const visibleKnowledgeRecord = {
  knowledgeId: 'doc',
  tenantId: 't',
  tenantName: '租户',
  institutionId: 'i',
  workspaceId: 'workspace',
  title: 'x.txt',
  version: 'v1',
  sourceKind: 'demo' as const,
  status: 'ready' as const,
  readonlyStatus: 'readonly' as const,
  category: '机构知识',
  descriptionPreview: '低敏摘要',
  chunkCount: 1,
  visibleInstitutionIds: ['i'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMocks() {
  let createdIndexingJob: KnowledgeIndexingJobRecord | null = null;
  const repository = {
    findKnowledgeItem: vi.fn(),
    createKnowledgeFile: vi.fn(),
    findKnowledgeFile: vi.fn(),
    findKnowledgeFileParse: vi.fn(),
    saveKnowledgeFileParseResult: vi.fn(),
    replaceKnowledgeFileParseChunks: vi.fn(),
    listKnowledgeFileParseChunks: vi.fn(),
    createKnowledgeIndexingJob: vi.fn(async (record: KnowledgeIndexingJobRecord) => {
      createdIndexingJob = record;
      return record;
    }),
    updateKnowledgeIndexingJob: vi.fn(async (input: { patch: Partial<KnowledgeIndexingJobRecord> }) => {
      if (!createdIndexingJob) return null;
      createdIndexingJob = { ...createdIndexingJob, ...input.patch };
      return createdIndexingJob;
    }),
    findKnowledgeIndexingJob: vi.fn(async (input: { tenantId: string; jobId: string }) => (
      createdIndexingJob?.tenantId === input.tenantId && createdIndexingJob.jobId === input.jobId
        ? createdIndexingJob
        : null
    )),
    listKnowledgeIndexingJobs: vi.fn(async () => createdIndexingJob ? [createdIndexingJob] : []),
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
    repository.findKnowledgeItem.mockResolvedValue({ ...visibleKnowledgeRecord, knowledgeId: 'inst-doc-test', tenantId: 'tenant-001', institutionId: 'inst-001', visibleInstitutionIds: ['inst-001'] });
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

  it('PDF 文件允许上传并触发解析任务', async () => {
    const { repository, storage } = createMocks();
    repository.createInstitutionKnowledgeSource.mockResolvedValue({ sourceId: 'src-pdf' });
    repository.createInstitutionKnowledgeDocument.mockResolvedValue({ documentId: 'doc-pdf' });
    storage.save.mockResolvedValue({ storageKey: 'k-pdf', sha256: 's-pdf', sizeBytes: 512 });
    repository.createKnowledgeFile.mockResolvedValue({
      fileId: 'f-pdf', tenantId: 't', knowledgeId: 'doc-pdf', originalFilename: 'report.pdf',
      mimeType: 'application/pdf', sizeBytes: 512, status: 'active' as const, sha256: 's-pdf',
      storageKey: 'k-pdf', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    repository.findKnowledgeItem.mockResolvedValue({ ...visibleKnowledgeRecord, knowledgeId: 'doc-pdf', tenantId: 't', institutionId: 'inst', visibleInstitutionIds: ['inst'] });
    repository.findKnowledgeFile.mockResolvedValue({
      fileId: 'f-pdf', tenantId: 't', knowledgeId: 'doc-pdf', originalFilename: 'report.pdf',
      storageKey: 'k-pdf', mimeType: 'application/pdf', sizeBytes: 512, sha256: 's-pdf',
      status: 'active', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    const parseRecord = {
      parseId: 'p-pdf', tenantId: 't', knowledgeId: 'doc-pdf', fileId: 'f-pdf', parseStatus: 'failed',
      failureReasonCode: 'ocr_required', safeFailureMessage: '该文件需要 OCR 识别；当前为 OCR-ready 最小闭环，尚未接入生产 OCR 服务', textContent: '', textLength: 0,
      chunkCount: 0, parserVersion: 'v1', createdAt: new Date(), updatedAt: new Date(),
    };
    repository.findKnowledgeFileParse.mockResolvedValue(parseRecord);
    repository.saveKnowledgeFileParseResult.mockResolvedValue(parseRecord);
    repository.replaceKnowledgeFileParseChunks.mockResolvedValue([]);
    storage.read.mockResolvedValue(new Uint8Array(Buffer.from('%PDF-1.4\n/image-only scan bytes\n%%EOF')));

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: { tenantId: 't', institutionId: 'inst', uploadedByUserId: 'u', file: pdfFile() },
    });

    expect(result.status).toBe('created');
    expect(result.parseStatus).toBe('failed');
    expect(result.parse?.failureReasonCode).toBe('ocr_required');
    expect(result.file?.ocrStatus).toBe('ocr_required');
    expect(repository.createKnowledgeIndexingJob).toHaveBeenCalledWith(expect.objectContaining({ jobType: 'parse_file' }));
  });

  it.each([
    ['照片.png', 'image/png', 'PNG'],
    ['照片.jpg', 'image/jpeg', 'JPG'],
    ['照片.jpeg', 'image/jpeg', 'JPEG'],
  ])('PNG/JPG 图片允许上传并进入 OCR-ready 低敏失败态：%s', async (name, mimeType, fileType) => {
    const { repository, storage } = createMocks();
    repository.createInstitutionKnowledgeSource.mockResolvedValue({ sourceId: 'src-image' });
    repository.createInstitutionKnowledgeDocument.mockResolvedValue({ documentId: 'doc-image' });
    storage.save.mockResolvedValue({ storageKey: 'k-image', sha256: 's-image', sizeBytes: 4 });
    repository.createKnowledgeFile.mockResolvedValue({
      fileId: 'f-image', tenantId: 't', knowledgeId: 'doc-image', originalFilename: name,
      mimeType, sizeBytes: 4, status: 'active' as const, sha256: 's-image',
      storageKey: 'k-image', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    repository.findKnowledgeItem.mockResolvedValue({ ...visibleKnowledgeRecord, knowledgeId: 'doc-image', tenantId: 't', institutionId: 'inst', visibleInstitutionIds: ['inst'] });
    repository.findKnowledgeFile.mockResolvedValue({
      fileId: 'f-image', tenantId: 't', knowledgeId: 'doc-image', originalFilename: name,
      storageKey: 'k-image', mimeType, sizeBytes: 4, sha256: 's-image',
      status: 'active', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    const parseRecord = {
      parseId: 'p-image', tenantId: 't', knowledgeId: 'doc-image', fileId: 'f-image', parseStatus: 'failed',
      failureReasonCode: 'ocr_required', safeFailureMessage: '该文件需要 OCR 识别；当前为 OCR-ready 最小闭环，尚未接入生产 OCR 服务', textContent: '', textLength: 0,
      chunkCount: 0, parserVersion: 'v1', createdAt: new Date(), updatedAt: new Date(),
    };
    repository.findKnowledgeFileParse.mockResolvedValue(parseRecord);
    repository.saveKnowledgeFileParseResult.mockResolvedValue(parseRecord);
    repository.replaceKnowledgeFileParseChunks.mockResolvedValue([]);
    storage.read.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository,
      storage,
      input: { tenantId: 't', institutionId: 'inst', uploadedByUserId: 'u', file: imageFile(name, mimeType) },
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe('created');
    expect(result.file).toEqual(expect.objectContaining({
      originalFilename: name,
      mimeType,
      fileType,
      parseStatus: 'failed',
      ocrStatus: 'ocr_required',
      failureReasonCode: 'ocr_required',
      chunkCount: 0,
    }));
    expect(repository.createKnowledgeIndexingJob).toHaveBeenCalledWith(expect.objectContaining({ jobType: 'parse_file' }));
    expect(serialized).not.toMatch(/storageKey|signedUrl|ocrProviderType|provider|model|token|cost|vendor|secret|textContent/i);
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
    repository.findKnowledgeItem.mockResolvedValue(visibleKnowledgeRecord);
    repository.findKnowledgeFile.mockResolvedValue({
      fileId: 'f', tenantId: 't', knowledgeId: 'doc', originalFilename: 'x.txt',
      storageKey: 'k', mimeType: 'text/plain', sizeBytes: 100, sha256: 's',
      status: 'active', uploadedByUserId: 'u', createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
    });
    const parseRecord = {
      parseId: 'p', tenantId: 't', knowledgeId: 'doc', fileId: 'f', parseStatus: 'succeeded',
      failureReasonCode: null, safeFailureMessage: null, textContent: 'test', textLength: 4,
      chunkCount: 1, parserVersion: 'v1', createdAt: new Date(), updatedAt: new Date(),
    };
    repository.findKnowledgeFileParse.mockResolvedValue(parseRecord);
    repository.saveKnowledgeFileParseResult.mockResolvedValue(parseRecord);
    repository.replaceKnowledgeFileParseChunks.mockResolvedValue([]);
    storage.read.mockResolvedValue(new Uint8Array(Buffer.from('test')));

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository, storage,
      input: { tenantId: 't', institutionId: 'i', uploadedByUserId: 'u', file: validFile() },
    });

    expect(result.status).toBe('created');
    expect(result.chunkCount).toBe(1);
  });

  it('JSON 文件不在机构上传白名单内', async () => {
    const { repository, storage } = createMocks();
    const jsonFile = { name: 'data.json', type: 'application/json', size: 100, arrayBuffer: async () => new Uint8Array(Buffer.from('{"key":"value"}')).buffer as ArrayBuffer };

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      repository, storage,
      input: { tenantId: 't', institutionId: 'i', uploadedByUserId: 'u', file: jsonFile },
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toBe('文件类型暂不支持，当前支持 TXT、MD、PDF、DOCX、XLSX、CSV、PNG、JPG 格式');
    expect(repository.createInstitutionKnowledgeSource).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
  });
});
