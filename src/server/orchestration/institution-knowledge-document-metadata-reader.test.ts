import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeAuthorization: vi.fn(),
  createRepository: vi.fn(),
  getDatabase: vi.fn(),
  list: vi.fn(),
  resolveAuthorization: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-knowledge-read-authorization',
  () => ({
    consumeInstitutionKnowledgeReadAuthorizationV1:
      mocks.consumeAuthorization,
    resolveInstitutionKnowledgeReadAuthorizationV1:
      mocks.resolveAuthorization,
  }),
);

vi.mock(
  '@/modules/knowledge/server/institution-document-metadata-repository',
  () => ({
    createInstitutionDocumentMetadataRepository:
      mocks.createRepository,
  }),
);

vi.mock('@/server/db/client', () => ({
  getDatabase: mocks.getDatabase,
}));

import {
  readCurrentInstitutionKnowledgeDocumentsV1,
} from '@/server/orchestration/institution-knowledge-document-metadata-reader';

beforeEach(() => {
  Object.values(mocks).forEach(
    (mock) => mock.mockReset(),
  );

  mocks.resolveAuthorization.mockResolvedValue(
    Object.freeze({
      kind: 'allowed',
      authorization: Object.freeze({}),
    }),
  );

  mocks.consumeAuthorization.mockReturnValue(
    Object.freeze({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      observedAt: '2026-08-16T08:00:00.000Z',
    }),
  );

  mocks.getDatabase.mockReturnValue(
    Object.freeze({
      database: true,
    }),
  );

  mocks.createRepository.mockReturnValue(
    Object.freeze({
      list: mocks.list,
    }),
  );

  mocks.list.mockResolvedValue([]);
});

describe('Knowledge document metadata formal orchestration', () => {
  it('使用 one-shot exact pair，并把可信空 cohort 返回为 ready', async () => {
    await expect(
      readCurrentInstitutionKnowledgeDocumentsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'ready',
      records: [],
      pageInfo: {
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
    });

    expect(mocks.list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      limit: 21,
      offset: 0,
    });
  });

  it('forbidden 与 unavailable 不创建 Repository', async () => {
    mocks.resolveAuthorization.mockResolvedValueOnce(
      Object.freeze({
        kind: 'forbidden',
      }),
    );

    await expect(
      readCurrentInstitutionKnowledgeDocumentsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'forbidden',
    });

    expect(mocks.createRepository).not.toHaveBeenCalled();

    mocks.resolveAuthorization.mockResolvedValueOnce(
      Object.freeze({
        kind: 'unavailable',
      }),
    );

    await expect(
      readCurrentInstitutionKnowledgeDocumentsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('authorization handle 无法 consume 时 unavailable', async () => {
    mocks.consumeAuthorization.mockReturnValueOnce(null);

    await expect(
      readCurrentInstitutionKnowledgeDocumentsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });

    expect(mocks.createRepository).not.toHaveBeenCalled();
  });

  it('非法 query 返回 invalid_query，且不执行 Source list', async () => {
    await expect(
      readCurrentInstitutionKnowledgeDocumentsV1(
        new URLSearchParams(
          'tenantId=tenant-other',
        ),
      ),
    ).resolves.toEqual({
      kind: 'invalid_query',
      code: 'invalid_knowledge_document_query',
    });

    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('Repository 异常统一为低敏 unavailable', async () => {
    mocks.list.mockRejectedValueOnce(
      new Error('database secret'),
    );

    await expect(
      readCurrentInstitutionKnowledgeDocumentsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
