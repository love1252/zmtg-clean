import {
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import type {
  ReactNode,
} from 'react';

import {
  render,
  screen,
} from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const requestOwners =
  vi.hoisted(() => new WeakSet<object>());
const navigationOwners =
  vi.hoisted(() => new WeakSet<object>());

const mocks = vi.hoisted(() => ({
  authorizeNavigation: vi.fn(),
  read: vi.fn(),
  resolveCapability: vi.fn(),
  resolveServerAuthorization: vi.fn(),
}));

vi.mock(
  '@/modules/institution/server/institution-server-runtime',
  () => ({
    resolveInstitutionServerAuthorizationV1:
      mocks.resolveServerAuthorization,
  }),
);

vi.mock(
  '@/modules/security/server/institution-request-authorization',
  () => ({
    isInstitutionRequestAuthorizationV1(
      value: unknown,
    ) {
      return (
        value !== null
        && typeof value === 'object'
        && requestOwners.has(value)
      );
    },
  }),
);

vi.mock(
  '@/modules/security/server/institution-section-guard',
  () => ({
    isInstitutionNavigationAuthorizationV1(
      value: unknown,
    ) {
      return (
        value !== null
        && typeof value === 'object'
        && navigationOwners.has(value)
      );
    },
    readInstitutionNavigationWorkspaceScopeKeyV1(value: unknown) {
      return value !== null
        && typeof value === 'object'
        && navigationOwners.has(value)
        ? 'Z'.repeat(43)
        : null;
    },
    matchesInstitutionNavigationAuthorizationScopeV1(value: unknown) {
      return value !== null
        && typeof value === 'object'
        && navigationOwners.has(value);
    },
  }),
);

vi.mock(
  '@/server/orchestration/institution-capability-authority',
  () => ({
    resolveInstitutionCapabilityAuthorityStatusV1:
      mocks.resolveCapability,
  }),
);

vi.mock(
  '@/server/orchestration/institution-knowledge-document-metadata-reader',
  () => ({
    readCurrentInstitutionKnowledgeDocumentsV1:
      mocks.read,
  }),
);

vi.mock(
  '@/modules/institution/components/InstitutionNavigationShell',
  () => ({
    InstitutionNavigationShell: ({
      children,
    }: {
      children: ReactNode;
    }) => (
      <div data-testid="navigation-shell">
        {children}
      </div>
    ),
  }),
);

vi.mock(
  '@/modules/institution/components/InstitutionPageState',
  () => ({
    InstitutionPageState: ({
      title,
      description,
    }: {
      title: string;
      description: string;
    }) => (
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    ),
  }),
);

vi.mock(
  '@/modules/institution/components/InstitutionCapabilityOffPage',
  () => ({
    resolveInstitutionCapabilityOffRouteV1: () => ({
      pageLabel: '知识库',
      section: 'knowledge',
    }),
    InstitutionCapabilityOffPage: () => (
      <div>knowledge-capability-off</div>
    ),
  }),
);

import HospitalKnowledgePage, {
  dynamic,
} from '@/app/hospital/knowledge/page';

const allSections = Object.freeze([
  'workbench',
  'customers',
  'conversations',
  'care',
  'knowledge',
  'analytics',
  'system',
] as const);

const requestAuthorization =
  Object.freeze({
    authorizeCurrentInstitutionNavigationV1:
      mocks.authorizeNavigation,
  });

function navigation(
  targetAccess: 'allowed' | 'blocked',
) {
  const value = Object.freeze({
    kind:
      'institution_navigation_authorization',
    targetSectionId: 'knowledge',
    targetAccess,
    availableSectionIds: allSections,
  });

  navigationOwners.add(value);
  return value;
}

function capability(
  decision: 'read_only' | 'hidden' =
    'read_only',
) {
  return Object.freeze({
    contractVersion: 'v1',
    scope: Object.freeze({ tenantId: 'tenant-knowledge-test', institutionId: 'institution-knowledge-test' }),
    readiness: 'ready',
    failureCode: null,
    partitions: Object.freeze([
      Object.freeze({
        key: 'page_knowledge_library',
        readiness: 'ready',
        failureCode: null,
      }),
    ]),
    data: Object.freeze({
      capabilities: Object.freeze([
        Object.freeze({
          key: 'page_knowledge_library',
          decision,
          dimensions: Object.freeze({
            codeMaturity: 'verified',
            institutionAuthorization:
              'authorized',
            connectionAvailability:
              'not_required',
            dataReadiness: 'ready',
            productionRelease:
              decision === 'read_only'
                ? 'pilot_released'
                : 'not_released',
          }),
          safeSummary:
            decision === 'read_only'
              ? '知识库资料仅供查看'
              : null,
        }),
      ]),
    }),
  });
}

const emptyReady = Object.freeze({
  kind: 'ready' as const,
  records: Object.freeze([]),
  pageInfo: Object.freeze({
    page: 1,
    pageSize: 20 as const,
    hasMore: false,
  }),
});

beforeEach(() => {
  Object.values(mocks).forEach(
    (mock) => mock.mockReset(),
  );

  requestOwners.add(requestAuthorization);

  mocks.resolveServerAuthorization
    .mockResolvedValue(requestAuthorization);
  mocks.authorizeNavigation
    .mockResolvedValue(navigation('allowed'));
  mocks.resolveCapability
    .mockResolvedValue(capability());
  mocks.read.mockResolvedValue(emptyReady);
});

describe('/hospital/knowledge formal readonly page', () => {
  it('force-dynamic，并正确呈现 authoritative empty cohort', async () => {
    expect(dynamic).toBe('force-dynamic');

    render(
      await HospitalKnowledgePage({
        searchParams: Promise.resolve({
          page: '1',
        }),
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: '知识库资料',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText('暂无正式知识库资料'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        '当前机构尚未发布可供查看的正式知识库资料。',
      ),
    ).toBeInTheDocument();

    expect(
      mocks.authorizeNavigation,
    ).toHaveBeenCalledWith({
      targetSectionId: 'knowledge',
    });
  });

  it('非空结果仅展示低敏 metadata', async () => {
    mocks.read.mockResolvedValueOnce(
      Object.freeze({
        kind: 'ready',
        records: Object.freeze([
          Object.freeze({
            contractVersion: 'v1',
            documentId: 'document-001',
            title: '术后护理规范',
            version: 2,
            sourceLabel: '机构正式资料',
            publishedAt:
              '2026-08-16T08:00:00.000Z',
          }),
        ]),
        pageInfo: Object.freeze({
          page: 1,
          pageSize: 20,
          hasMore: false,
        }),
      }),
    );

    render(
      await HospitalKnowledgePage({}),
    );

    expect(
      screen.getByText('术后护理规范'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '来源：机构正式资料 · 版本 2',
      ),
    ).toBeInTheDocument();
  });

  it('navigation blocked 仅读取 Shell capability，不读取业务数据', async () => {
    mocks.authorizeNavigation
      .mockResolvedValueOnce(
        navigation('blocked'),
      );

    render(
      await HospitalKnowledgePage({}),
    );

    expect(
      screen.getByText(
        '当前账号不可访问知识库资料',
      ),
    ).toBeInTheDocument();

    expect(
      mocks.resolveCapability,
    ).toHaveBeenCalledTimes(1);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('capability hidden 不调用 formal Reader', async () => {
    mocks.resolveCapability
      .mockResolvedValueOnce(
        capability('hidden'),
      );

    render(
      await HospitalKnowledgePage({}),
    );

    expect(
      screen.getByText(
        'knowledge-capability-off',
      ),
    ).toBeInTheDocument();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('Reader invalid query 显示受控错误', async () => {
    mocks.read.mockResolvedValueOnce(
      Object.freeze({
        kind: 'invalid_query',
        code: 'invalid_knowledge_document_query',
      }),
    );

    render(
      await HospitalKnowledgePage({
        searchParams: Promise.resolve({
          page: ['1', '2'],
        }),
      }),
    );

    expect(
      screen.getByText(
        '知识库资料查询条件无效',
      ),
    ).toBeInTheDocument();
  });

  it('生产页面和组件没有 mutation、正文、digest、actor 或 legacy Runtime 依赖', () => {
    const production = [
      'src/app/hospital/knowledge/page.tsx',
      'src/modules/knowledge/components/KnowledgeDocumentMetadataReadonlyShell.tsx',
    ].map((relativePath) =>
      readFileSync(
        resolve(process.cwd(), relativePath),
        'utf8',
      ),
    ).join('\n');

    expect(production).toContain(
      'readCurrentInstitutionKnowledgeDocumentsV1',
    );

    expect(production).not.toMatch(
      /knowledge-management\/items|knowledge-base\/runtime|upload|download|parse|ocr|embedding|index|qa|prompt|answer|textContent|documentReferenceDigest|provenanceReferenceDigest|approvedBy|publishedBy|\?create=1|export\s+(?:async\s+)?function\s+(?:POST|PATCH|PUT|DELETE)/iu,
    );
  });
});
