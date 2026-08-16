import {
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-knowledge-document-metadata-reader',
  () => ({
    readCurrentInstitutionKnowledgeDocumentsV1:
      mocks.read,
  }),
);

import {
  GET,
} from '@/app/api/v1/institution/knowledge-documents/route';

const ready = Object.freeze({
  kind: 'ready' as const,
  records: Object.freeze([]),
  pageInfo: Object.freeze({
    page: 1,
    pageSize: 20 as const,
    hasMore: false,
  }),
});

beforeEach(() => {
  mocks.read.mockReset();
  mocks.read.mockResolvedValue(ready);
});

describe('GET /api/v1/institution/knowledge-documents', () => {
  it('返回低敏 exact body 与 no-store', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/v1/institution/knowledge-documents?page=1',
      ),
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.get('cache-control'),
    ).toBe('no-store');

    await expect(
      response.json(),
    ).resolves.toEqual({
      records: [],
      pageInfo: {
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
    });

    const params =
      mocks.read.mock.calls[0]?.[0] as URLSearchParams;

    expect(params.get('page')).toBe('1');
  });

  it.each([
    [
      {
        kind: 'invalid_query',
        code: 'invalid_knowledge_document_query',
      },
      400,
      {
        code: 'invalid_knowledge_document_query',
      },
    ],
    [
      {
        kind: 'forbidden',
      },
      403,
      {
        code:
          'institution_knowledge_documents_forbidden',
      },
    ],
    [
      {
        kind: 'unavailable',
      },
      503,
      {
        code:
          'institution_knowledge_documents_unavailable',
      },
    ],
  ] as const)(
    '%o 映射为 no-store HTTP %i',
    async (result, status, body) => {
      mocks.read.mockResolvedValueOnce(result);

      const response = await GET(
        new Request(
          'http://localhost/api/v1/institution/knowledge-documents',
        ),
      );

      expect(response.status).toBe(status);
      expect(
        response.headers.get('cache-control'),
      ).toBe('no-store');
      await expect(response.json()).resolves.toEqual(body);
    },
  );

  it('Route 仅导出 GET，并只连接 formal orchestration', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/v1/institution/knowledge-documents/route.ts',
      ),
      'utf8',
    );

    expect(source).toContain(
      'readCurrentInstitutionKnowledgeDocumentsV1',
    );
    expect(source).not.toContain('getDatabase');
    expect(source).not.toContain(
      'knowledgeFormalDocumentPublications',
    );
    expect(source).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:POST|PATCH|PUT|DELETE)/u,
    );
  });
});
