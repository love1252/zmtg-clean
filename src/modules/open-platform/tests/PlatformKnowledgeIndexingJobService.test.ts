import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  cancelKnowledgeIndexingJob,
  createAndRunGenerateEmbeddingsJob,
  createAndRunRebuildKnowledgeIndexJob,
  createKnowledgeIndexingJob,
  listInstitutionKnowledgeIndexingJobs,
  type KnowledgeIndexingJobRecord,
} from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';

const now = new Date('2026-07-05T08:00:00.000Z');

const visibleKnowledge: PlatformKnowledgeRepositoryRecord = {
  knowledgeId: 'knowledge-visible',
  tenantId: 'tenant-a',
  tenantName: '租户 A',
  institutionId: 'inst-owner',
  workspaceId: 'workspace-a',
  title: '授权知识',
  version: 'v1',
  sourceKind: 'demo',
  status: 'ready',
  readonlyStatus: 'readonly',
  category: '护理',
  descriptionPreview: '低敏摘要',
  chunkCount: 1,
  visibleInstitutionIds: ['inst-current'],
  createdAt: now,
  updatedAt: now,
};

const hiddenKnowledge: PlatformKnowledgeRepositoryRecord = {
  ...visibleKnowledge,
  knowledgeId: 'knowledge-hidden',
  institutionId: 'inst-other',
  visibleInstitutionIds: [],
};

function createJobRepository() {
  const jobs = new Map<string, KnowledgeIndexingJobRecord>();
  return {
    jobs,
    createKnowledgeIndexingJob: vi.fn(async (record: KnowledgeIndexingJobRecord) => {
      jobs.set(record.jobId, record);
      return record;
    }),
    updateKnowledgeIndexingJob: vi.fn(async (input: {
      tenantId: string;
      jobId: string;
      patch: Partial<KnowledgeIndexingJobRecord>;
    }) => {
      const current = jobs.get(input.jobId);
      if (!current || current.tenantId !== input.tenantId) return null;
      const updated = { ...current, ...input.patch };
      jobs.set(input.jobId, updated);
      return updated;
    }),
    findKnowledgeIndexingJob: vi.fn(async (input: { tenantId: string; jobId: string }) => {
      const job = jobs.get(input.jobId);
      return job?.tenantId === input.tenantId ? job : null;
    }),
    listKnowledgeIndexingJobs: vi.fn(async (input: { tenantId: string; institutionId?: string | null }) =>
      Array.from(jobs.values()).filter((job) =>
        job.tenantId === input.tenantId && (!input.institutionId || job.institutionId === input.institutionId)
      )
    ),
  };
}

function createEmbeddingRepository(options: { knowledge?: PlatformKnowledgeRepositoryRecord | null } = {}) {
  return {
    ...createJobRepository(),
    findKnowledgeItem: vi.fn(async () => options.knowledge ?? visibleKnowledge),
    findKnowledgeFile: vi.fn(async () => ({
      fileId: 'file-visible',
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-visible',
      originalFilename: '护理.txt',
      storageKey: 'safe-storage-key',
      mimeType: 'text/plain',
      sizeBytes: 16,
      sha256: 'hash',
      status: 'active' as const,
      uploadedByUserId: 'user-a',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      fileType: 'TXT',
      sizeLabel: '1 KB',
      parseStatus: 'succeeded' as const,
      failureReasonCode: null,
      safeFailureMessage: null,
      textLength: 16,
      chunkCount: 1,
      parserVersion: 'test-parser',
    })),
    listKnowledgeItems: vi.fn(async () => [visibleKnowledge]),
    listKnowledgeEmbeddingCandidates: vi.fn(async () => [
      {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-visible',
        knowledgeTitle: '授权知识',
        fileId: 'file-visible',
        fileName: '护理.txt',
        fileStatus: 'active' as const,
        parseStatus: 'succeeded' as const,
        chunkId: 'chunk-a',
        chunkIndex: 0,
        textPreview: '术后护理需要冷敷。',
      },
    ]),
    listKnowledgeVectorSearchCandidates: vi.fn(async () => []),
    saveKnowledgeChunkEmbeddings: vi.fn(async () => [
      {
        embeddingId: 'embedding-a',
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
        chunkId: 'chunk-a',
        embeddingDimensions: 8,
        status: 'ready' as const,
        failureReasonCode: null,
      },
    ]),
  };
}

describe('platform knowledge indexing job service', () => {
  it('创建并执行 generate_embeddings job，返回低敏任务 DTO', async () => {
    const repository = createEmbeddingRepository();

    const result = await createAndRunGenerateEmbeddingsJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        actorUserId: 'user-a',
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
      },
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe('succeeded');
    expect('job' in result ? result.job : null).toEqual(expect.objectContaining({
      jobType: 'generate_embeddings',
      status: 'succeeded',
      knowledgeId: 'knowledge-visible',
      fileId: 'file-visible',
      totalCount: 1,
      processedCount: 1,
      failedCount: 0,
    }));
    expect(repository.createKnowledgeIndexingJob).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      jobType: 'generate_embeddings',
      status: 'pending',
    }));
    expect(repository.updateKnowledgeIndexingJob).toHaveBeenCalledWith(expect.objectContaining({
      patch: expect.objectContaining({ status: 'running' }),
    }));
    expect(repository.updateKnowledgeIndexingJob).toHaveBeenCalledWith(expect.objectContaining({
      patch: expect.objectContaining({ status: 'succeeded' }),
    }));
    expect(serialized).not.toContain('embeddingVectorJson');
    expect(serialized).not.toMatch(/provider|model|token|cost|vendor|prompt|baseUrl|secret/i);
  });

  it('失败时记录低敏 failureReasonCode 与 safeMessage', async () => {
    const repository = createEmbeddingRepository();
    repository.saveKnowledgeChunkEmbeddings.mockRejectedValueOnce(new Error('DATABASE_URL token secret stack'));

    const result = await createAndRunGenerateEmbeddingsJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        actorUserId: 'user-a',
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
      },
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe('failed');
    expect('job' in result ? result.job : null).toEqual(expect.objectContaining({
      status: 'failed',
      failureReasonCode: 'job_execution_failed',
      safeMessage: '知识库索引任务执行失败，请稍后重试',
    }));
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
  });

  it('同 tenant 其他机构不可见 knowledge 不创建任务且不执行 embedding', async () => {
    const repository = createEmbeddingRepository({ knowledge: hiddenKnowledge });

    const result = await createAndRunGenerateEmbeddingsJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        actorUserId: 'user-a',
        knowledgeId: 'knowledge-hidden',
        fileId: 'file-hidden',
      },
    });

    expect(result).toEqual({ status: 'forbidden' });
    expect(repository.createKnowledgeIndexingJob).not.toHaveBeenCalled();
    expect(repository.listKnowledgeEmbeddingCandidates).not.toHaveBeenCalled();
    expect(repository.saveKnowledgeChunkEmbeddings).not.toHaveBeenCalled();
  });

  it('支持重建当前知识索引 job', async () => {
    const repository = createEmbeddingRepository();

    const result = await createAndRunRebuildKnowledgeIndexJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        actorUserId: 'user-a',
        knowledgeId: 'knowledge-visible',
      },
    });

    expect(result.status).toBe('succeeded');
    expect('job' in result ? result.job : null).toEqual(expect.objectContaining({
      jobType: 'rebuild_knowledge_index',
      status: 'succeeded',
      fileId: null,
    }));
    expect(repository.listKnowledgeEmbeddingCandidates).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-visible',
      fileId: undefined,
    });
  });

  it('只允许 pending 任务取消，running 不强杀', async () => {
    const repository = createJobRepository();
    const pending = await createKnowledgeIndexingJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        actorUserId: 'user-a',
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
        jobType: 'parse_file',
      },
    });
    expect(pending.status).toBe('created');

    const cancelled = await cancelKnowledgeIndexingJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        jobId: pending.status === 'created' ? pending.record.jobId : '',
      },
    });
    expect(cancelled.status).toBe('cancelled');

    const running = await createKnowledgeIndexingJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        actorUserId: 'user-a',
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
        jobType: 'parse_file',
      },
    });
    if (running.status !== 'created') throw new Error('job create failed');
    await repository.updateKnowledgeIndexingJob({
      tenantId: 'tenant-a',
      jobId: running.record.jobId,
      patch: { status: 'running', startedAt: now, updatedAt: now },
    });
    const runningCancel = await cancelKnowledgeIndexingJob({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        jobId: running.record.jobId,
      },
    });
    expect(runningCancel).toEqual(expect.objectContaining({
      status: 'running_not_cancelled',
      message: '运行中的任务不做强制取消',
    }));
  });

  it('机构端只能列出本机构任务', async () => {
    const repository = createJobRepository();
    await repository.createKnowledgeIndexingJob({
      jobId: 'job-current',
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      actorUserId: 'user-a',
      knowledgeId: 'knowledge-visible',
      fileId: 'file-visible',
      jobType: 'parse_file',
      status: 'succeeded',
      totalCount: 1,
      processedCount: 1,
      failedCount: 0,
      failureReasonCode: null,
      safeMessage: '完成',
      metadataJson: {},
      startedAt: now,
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await repository.createKnowledgeIndexingJob({
      jobId: 'job-other',
      tenantId: 'tenant-a',
      institutionId: 'inst-other',
      actorUserId: 'user-b',
      knowledgeId: 'knowledge-other',
      fileId: 'file-other',
      jobType: 'parse_file',
      status: 'succeeded',
      totalCount: 1,
      processedCount: 1,
      failedCount: 0,
      failureReasonCode: null,
      safeMessage: '完成',
      metadataJson: {},
      startedAt: now,
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const result = await listInstitutionKnowledgeIndexingJobs({
      repository,
      input: { tenantId: 'tenant-a', institutionId: 'inst-current' },
    });

    expect(result.status).toBe('succeeded');
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.jobId).toBe('job-current');
  });
});
