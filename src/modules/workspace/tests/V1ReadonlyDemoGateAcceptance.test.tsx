import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HospitalPage from '@/app/hospital/page';

type KnowledgeBaseDemoReadonlyMockStatus = 'disabled' | 'denied' | 'empty' | 'ready';

type WorkspaceDashboardReadonlyAggregationMockStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'partial'
  | 'stale'
  | 'ready';

type ReadonlyDemoGateFetchOptions = {
  knowledgeBaseDemoReadonlyError?: { status: number; message: string };
  knowledgeBaseDemoReadonlyPending?: boolean;
  knowledgeBaseDemoReadonlyResponse?: unknown;
  workspaceDashboardReadonlyAggregationError?: { status: number; message: string };
  workspaceDashboardReadonlyAggregationPending?: boolean;
  workspaceDashboardReadonlyAggregationResponse?: unknown;
};

const forbiddenReadonlyDemoFragments = [
  '上传',
  '编辑',
  '删除',
  '发布',
  '下架',
  '回滚',
  '创建任务',
  '预约',
  '触达',
  '营销',
  '成交',
  '支付',
  '合同',
  '发票',
  'raw',
  'payload',
  'token',
  'secret',
  'credential',
  'HIS',
  '真实客户',
  '模型',
  'embedding',
  'vector',
  'retrieval',
] as const;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function fetchPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function buildKnowledgeBaseDemoReadonlyMockResponse(status: KnowledgeBaseDemoReadonlyMockStatus) {
  const hasContent = status === 'ready';
  const statusTextByStatus = {
    disabled: 'disabled / skipped',
    denied: 'denied / denied',
    empty: 'empty / empty',
    ready: 'ready / readonly',
  } satisfies Record<KnowledgeBaseDemoReadonlyMockStatus, string>;
  const descriptionByStatus = {
    disabled: '该知识库 demo readonly API 暂未开启',
    denied: '当前账号没有访问知识库 demo readonly API 的权限',
    empty: '暂无可展示知识库 demo readonly 内容',
    ready: '知识库 demo readonly API 可用于低敏只读演示',
  } satisfies Record<KnowledgeBaseDemoReadonlyMockStatus, string>;

  return {
    requestId: `gate-knowledge-base-demo-readonly-${status}`,
    tenantId: 'demo-tenant-a',
    institutionId: 'demo-inst-a',
    workspaceId: 'demo-workspace-a',
    status,
    summary: {
      title: '知识库 demo readonly API 契约',
      statusText: statusTextByStatus[status],
      description: descriptionByStatus[status],
    },
    categories: hasContent
      ? [
          {
            categoryId: 'platform-knowledge-base',
            label: '平台知识库',
            summary: 'platform:1 / ready:1',
            readonly: true,
          },
          {
            categoryId: 'institution-knowledge-base',
            label: '机构知识库',
            summary: 'institution:1 / draft:1',
            readonly: true,
          },
        ]
      : [],
    folders: hasContent
      ? [
          {
            folderId: 'catalog-summary',
            label: '目录总览',
            summary: '平台知识库 / FAQ；机构知识库 / FAQ',
            readonly: true,
          },
        ]
      : [],
    knowledgeItems: hasContent
      ? [
          {
            itemId: 'version-summary',
            title: '版本总览',
            summary: 'v1；v2-review',
            status,
            readonly: true,
          },
        ]
      : [],
    taskRecords: [
      {
        recordId: `demo-readonly-facade-${status}`,
        status: hasContent ? 'ready' : status,
        title: '知识库 demo readonly facade',
        failureReason: hasContent ? 'not_available' : descriptionByStatus[status],
        readonly: true,
      },
    ],
    searchPreview: {
      mode: 'mock_demo_preview',
      query: '知识库 demo 只读预览',
      resultCount: hasContent ? 1 : 0,
      results: hasContent
        ? [
            {
              previewId: 'platform-knowledge-base-preview',
              title: '平台知识库 demo 预览',
              snippet: 'platform:1 / ready:1',
              sourceKind: 'demo',
              readonly: true,
            },
          ]
        : [],
      readonly: true,
    },
    facade: {
      status,
      facadeStatus: status,
      governanceSummary: hasContent ? '治理总览：ready demo readonly' : 'not_available',
      demoSourceSummary: hasContent ? 'demo source ready' : 'not_available',
      readonly: true,
    },
    riskFlags: hasContent ? ['none'] : [],
    recommendedReadonlyActions: hasContent ? ['review_demo_readonly_summary'] : [],
    readonly: true,
  };
}

function buildKnowledgeBaseDemoReadonlyUnsafeMockResponse() {
  const response = buildKnowledgeBaseDemoReadonlyMockResponse('ready');

  return {
    ...response,
    summary: {
      ...response.summary,
      title: '真实客户姓名 张三 知识库',
      description: 'raw HIS payload credential token secret 模型 embedding vector retrieval',
    },
    categories: [
      {
        categoryId: 'unsafe-category',
        label: '真实客户标签',
        summary: '手机号 13800001252 身份证 110101199001010011',
        readonly: true,
      },
    ],
    folders: [
      {
        folderId: 'unsafe-folder',
        label: 'HIS 原始目录',
        summary: 'credential token secret',
        readonly: true,
      },
    ],
    knowledgeItems: [
      {
        itemId: 'unsafe-item',
        title: '模型输出摘要',
        summary: 'embedding vector retrieval',
        status: 'ready',
        readonly: true,
      },
    ],
    taskRecords: [
      {
        recordId: 'unsafe-task',
        status: 'ready',
        title: '创建任务 预约 触达 营销 成交',
        failureReason: '支付 合同 发票 worker stack /tmp/demo',
        readonly: true,
      },
    ],
    searchPreview: {
      ...response.searchPreview,
      query: 'retrieval 真实检索',
      results: [
        {
          previewId: 'unsafe-preview',
          title: '真实客户知识',
          snippet: '完整病历 raw payload embedding vector retrieval',
          sourceKind: 'demo',
          readonly: true,
        },
      ],
    },
  };
}

function buildWorkspaceDashboardReadonlyAggregationMockResponse(
  status: WorkspaceDashboardReadonlyAggregationMockStatus,
) {
  const hasContent = status === 'partial' || status === 'stale' || status === 'ready';
  const statusTextByStatus = {
    disabled: 'disabled / skipped',
    denied: 'denied / denied',
    empty: 'empty / empty',
    partial: 'partial / partial',
    stale: 'stale / stale',
    ready: 'ready / readonly',
  } satisfies Record<WorkspaceDashboardReadonlyAggregationMockStatus, string>;
  const descriptionByStatus = {
    disabled: '该 workspace dashboard 只读聚合能力暂未开启',
    denied: '当前账号没有访问权限',
    empty: '暂无可展示 workspace dashboard 只读聚合',
    partial: 'workspace dashboard 部分来源不完整，仅展示可用只读摘要',
    stale: 'workspace dashboard 只读聚合可能已过期',
    ready: 'workspace dashboard 只读聚合可用于 demo 摘要展示',
  } satisfies Record<WorkspaceDashboardReadonlyAggregationMockStatus, string>;
  const summary = hasContent ? 'ready / items:2 / blocked:1' : 'not_available';

  return {
    requestId: `gate-workspace-dashboard-readonly-${status}`,
    tenantId: 'demo-tenant-a',
    institutionId: 'demo-inst-a',
    workspaceId: 'demo-workspace-a',
    status,
    dashboardStatus: status,
    summary: {
      title: 'workspace dashboard readonly aggregation API 契约',
      statusText: statusTextByStatus[status],
      description: descriptionByStatus[status],
    },
    businessLoop: {
      sectionId: 'business-loop',
      label: '业务闭环只读聚合',
      summary,
      readonly: true,
    },
    managementConfig: {
      sectionId: 'management-config',
      label: '管理配置只读聚合',
      summary,
      readonly: true,
    },
    knowledgeGovernance: {
      sectionId: 'knowledge-governance',
      label: '知识库治理只读聚合',
      summary,
      readonly: true,
    },
    readonlyPolicy: {
      sectionId: 'readonly-policy',
      label: '只读策略与低敏白名单',
      summary,
      readonly: true,
    },
    taskRecords: [
      {
        recordId: `workspace-dashboard-readonly-aggregation-${status}`,
        status: hasContent ? status : status === 'disabled' ? 'skipped' : status,
        title: 'workspace dashboard readonly aggregation',
        failureReason: hasContent ? 'not_available' : descriptionByStatus[status],
        readonly: true,
      },
    ],
    aggregation: {
      status,
      reasonCode: `workspace_dashboard_readonly_aggregation_${status}`,
      resultCode: status === 'ready' ? 'readonly' : status,
      dashboardStatus: status,
      businessLoopSummary: summary,
      managementConfigSummary: summary,
      knowledgeGovernanceSummary: summary,
      fieldWhitelistSummary: hasContent ? 'ready / unknown:0 / forbidden:0' : 'not_available',
      readonlyFeaturePolicySummary: hasContent ? 'ready / readonly' : 'not_available',
      readonly: true,
    },
    riskFlags: hasContent ? ['reviewing_version_present'] : [],
    recommendedReadonlyActions: hasContent ? ['review_knowledge_governance_risks_readonly'] : [],
    readonly: true,
  };
}

function buildWorkspaceDashboardReadonlyAggregationUnsafeMockResponse() {
  const response = buildWorkspaceDashboardReadonlyAggregationMockResponse('ready');

  return {
    ...response,
    summary: {
      ...response.summary,
      description: 'raw payload token secret credential HIS 真实客户 模型 embedding vector retrieval',
    },
    aggregation: {
      ...response.aggregation,
      businessLoopSummary: '上传 编辑 删除 发布 下架 回滚',
      managementConfigSummary: '创建任务 预约 触达 营销 成交',
      knowledgeGovernanceSummary: '支付 合同 发票',
    },
    taskRecords: [
      {
        recordId: 'unsafe-workspace-task',
        status: 'ready',
        title: '创建任务 预约 触达 营销 成交',
        failureReason: 'raw payload worker stack /tmp/demo',
        readonly: true,
      },
    ],
    riskFlags: ['raw_payload_present'],
    recommendedReadonlyActions: ['createTask', 'autoMarketing'],
  };
}

function mockReadonlyDemoGateFetch(options: ReadonlyDemoGateFetchOptions = {}) {
  const {
    knowledgeBaseDemoReadonlyError,
    knowledgeBaseDemoReadonlyPending = false,
    knowledgeBaseDemoReadonlyResponse = buildKnowledgeBaseDemoReadonlyMockResponse('ready'),
    workspaceDashboardReadonlyAggregationError,
    workspaceDashboardReadonlyAggregationPending = false,
    workspaceDashboardReadonlyAggregationResponse =
      buildWorkspaceDashboardReadonlyAggregationMockResponse('ready'),
  } = options;

  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const path = fetchPath(input);

      if (path === '/api/auth/session') {
        return jsonResponse({ authenticated: true, user: { role: 'tenant_admin' } });
      }

      if (path === '/api/v1/knowledge-base/demo-readonly') {
        if (knowledgeBaseDemoReadonlyPending) {
          return new Promise<Response>(() => {});
        }

        if (knowledgeBaseDemoReadonlyError) {
          return jsonResponse(
            { error: knowledgeBaseDemoReadonlyError.message },
            { status: knowledgeBaseDemoReadonlyError.status },
          );
        }

        return jsonResponse(knowledgeBaseDemoReadonlyResponse);
      }

      if (path === '/api/v1/workspace-dashboard/readonly-aggregation') {
        if (workspaceDashboardReadonlyAggregationPending) {
          return new Promise<Response>(() => {});
        }

        if (workspaceDashboardReadonlyAggregationError) {
          return jsonResponse(
            { error: workspaceDashboardReadonlyAggregationError.message },
            { status: workspaceDashboardReadonlyAggregationError.status },
          );
        }

        return jsonResponse(workspaceDashboardReadonlyAggregationResponse);
      }

      if (path === '/api/institution/follow-up-path-analysis') {
        return jsonResponse({
          templateSuggestionCount: 0,
          confirmedSourceTaskCount: 0,
          completedTaskCount: 0,
          overdueTaskCount: 0,
          voidedSummaryBlockedCount: 0,
          duplicateSourceTaskConflictCount: 0,
          notes: [],
          warnings: [],
          dataSourceNote: 'demo readonly gate',
          boundaryNote: '只读聚合指标',
        });
      }

      if (path.startsWith('/api/institution/treatment-summaries')) {
        return jsonResponse({ records: [], pageInfo: { hasMore: false, limit: 50, nextCursor: null } });
      }

      if (path === '/api/institution/audit-events') {
        return jsonResponse({ records: [], pageInfo: { hasMore: false, limit: 50, nextCursor: null } });
      }

      if (path === '/api/institution/his-connections') {
        return jsonResponse({ records: [] });
      }

      if (
        path === '/api/institution/customers' ||
        path === '/api/institution/appointments' ||
        path === '/api/institution/followups'
      ) {
        return jsonResponse({ records: [] });
      }

      if (path.startsWith('/api/institution/followups?')) {
        return jsonResponse({ records: [] });
      }

      return jsonResponse({ records: [] });
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function readonlyDemoSections() {
  const knowledgeBaseEntry = (await screen.findByRole('heading', {
    name: '知识库 demo readonly',
  })).closest('section');
  const workspaceAggregationEntry = (await screen.findByRole('heading', {
    name: 'workspace dashboard readonly aggregation',
  })).closest('section');

  expect(knowledgeBaseEntry).not.toBeNull();
  expect(workspaceAggregationEntry).not.toBeNull();

  return {
    knowledgeBaseEntry: knowledgeBaseEntry as HTMLElement,
    workspaceAggregationEntry: workspaceAggregationEntry as HTMLElement,
  };
}

describe('V1 readonly demo 总验收门禁', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('同时锁住 workspace dashboard readonly aggregation 与 knowledge base demo readonly 的 GET-only 只读入口', async () => {
    const fetchMock = mockReadonlyDemoGateFetch();
    render(<HospitalPage />);

    const { knowledgeBaseEntry, workspaceAggregationEntry } = await readonlyDemoSections();
    const knowledgeBaseView = within(knowledgeBaseEntry);
    const workspaceAggregationView = within(workspaceAggregationEntry);

    expect(await knowledgeBaseView.findByText('知识库 demo readonly 已就绪')).toBeInTheDocument();
    expect(
      await workspaceAggregationView.findByText(
        'workspace dashboard readonly aggregation 已就绪',
      ),
    ).toBeInTheDocument();

    expect(knowledgeBaseView.getByText('只调用现有 GET API')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('只读入口')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('低敏字段')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('只调用既有 GET route')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('只读摘要')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('低敏字段')).toBeInTheDocument();

    expect(knowledgeBaseView.queryByRole('button')).not.toBeInTheDocument();
    expect(workspaceAggregationView.queryByRole('button')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          '/api/v1/knowledge-base/demo-readonly',
          expect.objectContaining({ cache: 'no-store' }),
        ],
        [
          '/api/v1/workspace-dashboard/readonly-aggregation',
          expect.objectContaining({ cache: 'no-store' }),
        ],
      ]),
    );
    expect(
      fetchMock.mock.calls.every(([input, init]) => {
        const path = fetchPath(input);

        if (
          path !== '/api/v1/knowledge-base/demo-readonly' &&
          path !== '/api/v1/workspace-dashboard/readonly-aggregation'
        ) {
          return true;
        }

        return (init?.method ?? 'GET') === 'GET' && init?.body === undefined;
      }),
    ).toBe(true);
  });

  it.each([
    ['disabled', '知识库 demo readonly 暂未开启', 'disabled / skipped'],
    ['denied', '当前账号没有知识库 demo readonly 访问权限', 'denied / denied'],
    ['empty', '暂无可展示知识库 demo readonly 内容', 'empty / empty'],
    ['ready', '知识库 demo readonly 已就绪', 'ready / readonly'],
  ] as const)('覆盖 knowledge base demo readonly 的 %s 状态', async (status, label, statusText) => {
    mockReadonlyDemoGateFetch({
      knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyMockResponse(status),
    });
    render(<HospitalPage />);

    const { knowledgeBaseEntry } = await readonlyDemoSections();
    const knowledgeBaseView = within(knowledgeBaseEntry);

    expect((await knowledgeBaseView.findAllByText(label)).length).toBeGreaterThan(0);
    expect(knowledgeBaseView.getAllByText(statusText).length).toBeGreaterThan(0);
    expect(knowledgeBaseView.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    ['disabled', 'workspace dashboard readonly aggregation 暂未开启', 'disabled / skipped'],
    ['denied', '当前账号没有 workspace dashboard readonly aggregation 访问权限', 'denied / denied'],
    ['empty', '暂无可展示 workspace dashboard readonly aggregation', 'empty / empty'],
    ['partial', 'workspace dashboard readonly aggregation 部分可用', 'partial / partial'],
    ['stale', 'workspace dashboard readonly aggregation 可能已过期', 'stale / stale'],
    ['ready', 'workspace dashboard readonly aggregation 已就绪', 'ready / readonly'],
  ] as const)(
    '覆盖 workspace dashboard readonly aggregation 的 %s 状态',
    async (status, label, statusText) => {
      mockReadonlyDemoGateFetch({
        workspaceDashboardReadonlyAggregationResponse:
          buildWorkspaceDashboardReadonlyAggregationMockResponse(status),
      });
      render(<HospitalPage />);

      const { workspaceAggregationEntry } = await readonlyDemoSections();
      const workspaceAggregationView = within(workspaceAggregationEntry);

      expect((await workspaceAggregationView.findAllByText(label)).length).toBeGreaterThan(0);
      expect(workspaceAggregationView.getAllByText(statusText).length).toBeGreaterThan(0);
      expect(workspaceAggregationView.queryByRole('button')).not.toBeInTheDocument();
    },
  );

  it('覆盖两条 readonly demo 链路的 loading 与低敏 error 状态', async () => {
    const pendingFetchMock = mockReadonlyDemoGateFetch({
      knowledgeBaseDemoReadonlyPending: true,
      workspaceDashboardReadonlyAggregationPending: true,
    });
    const { unmount } = render(<HospitalPage />);
    const pendingSections = await readonlyDemoSections();

    expect(
      within(pendingSections.knowledgeBaseEntry).getByText('正在加载知识库 demo readonly...'),
    ).toBeInTheDocument();
    expect(
      within(pendingSections.workspaceAggregationEntry).getByText(
        '正在加载 workspace dashboard readonly aggregation...',
      ),
    ).toBeInTheDocument();
    expect(pendingFetchMock).toHaveBeenCalled();
    unmount();
    vi.unstubAllGlobals();

    mockReadonlyDemoGateFetch({
      knowledgeBaseDemoReadonlyError: {
        status: 503,
        message: 'worker stack /tmp/demo dependency error',
      },
      workspaceDashboardReadonlyAggregationError: {
        status: 503,
        message: 'worker stack /tmp/demo dependency error',
      },
    });
    render(<HospitalPage />);

    const { knowledgeBaseEntry, workspaceAggregationEntry } = await readonlyDemoSections();
    expect(
      await within(knowledgeBaseEntry).findByText('知识库 demo readonly 暂时不可用'),
    ).toBeInTheDocument();
    expect(
      await within(workspaceAggregationEntry).findByText(
        'workspace dashboard readonly aggregation 暂时不可用',
      ),
    ).toBeInTheDocument();
    const errorText = `${knowledgeBaseEntry.textContent ?? ''} ${
      workspaceAggregationEntry.textContent ?? ''
    }`;
    expect(errorText).not.toContain('worker');
    expect(errorText).not.toContain('/tmp/demo');
    expect(errorText).not.toContain('dependency error');
  });

  it('锁住 workspace 状态总览、核心聚合摘要、治理提示与只读动作提示分组', async () => {
    mockReadonlyDemoGateFetch({
      workspaceDashboardReadonlyAggregationResponse:
        buildWorkspaceDashboardReadonlyAggregationMockResponse('ready'),
    });
    render(<HospitalPage />);

    const { workspaceAggregationEntry } = await readonlyDemoSections();
    const workspaceAggregationView = within(workspaceAggregationEntry);

    expect(
      await workspaceAggregationView.findByText(
        'workspace dashboard readonly aggregation 已就绪',
      ),
    ).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('状态总览')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('status / dashboardStatus')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('核心聚合摘要')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('businessLoopSummary')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('managementConfigSummary')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('knowledgeGovernanceSummary')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('fieldWhitelistSummary')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('readonlyFeaturePolicySummary')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('治理提示')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('riskFlags')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('只读动作提示')).toBeInTheDocument();
    expect(workspaceAggregationView.getByText('recommendedReadonlyActions')).toBeInTheDocument();
  });

  it('锁住 knowledge base categories / folders / knowledgeItems / taskRecords / searchPreview 与 demo preview 边界', async () => {
    mockReadonlyDemoGateFetch({
      knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyMockResponse('ready'),
    });
    render(<HospitalPage />);

    const { knowledgeBaseEntry } = await readonlyDemoSections();
    const knowledgeBaseView = within(knowledgeBaseEntry);

    expect(await knowledgeBaseView.findByText('知识库 demo readonly 已就绪')).toBeInTheDocument();
    expect(knowledgeBaseView.getAllByText('mock / seed / demo / readonly').length).toBeGreaterThan(0);
    expect(knowledgeBaseView.getByText('知识库展示结构')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('分类摘要 categories')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('目录摘要 folders')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('知识条目 knowledgeItems')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('只读任务 taskRecords')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('demo 预览 searchPreview')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('categories')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('folders')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('knowledgeItems')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('taskRecords')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('searchPreview')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('mock_demo_preview')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('知识库 demo 只读预览')).toBeInTheDocument();
    expect(knowledgeBaseView.getByText('仅展示 demo 预览，不进行真实查找')).toBeInTheDocument();
  });

  it('两条 readonly demo 链路不渲染敏感字段、真实检索字段或 mutation 文案', async () => {
    mockReadonlyDemoGateFetch({
      knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyUnsafeMockResponse(),
      workspaceDashboardReadonlyAggregationResponse:
        buildWorkspaceDashboardReadonlyAggregationUnsafeMockResponse(),
    });
    render(<HospitalPage />);

    const { knowledgeBaseEntry, workspaceAggregationEntry } = await readonlyDemoSections();
    await within(knowledgeBaseEntry).findByText('知识库 demo readonly 已就绪');
    await within(workspaceAggregationEntry).findByText(
      'workspace dashboard readonly aggregation 已就绪',
    );

    const combinedReadonlyDemoText = `${knowledgeBaseEntry.textContent ?? ''} ${
      workspaceAggregationEntry.textContent ?? ''
    }`;
    expect(combinedReadonlyDemoText).toContain('低敏摘要已隐藏');

    for (const fragment of forbiddenReadonlyDemoFragments) {
      expect(combinedReadonlyDemoText).not.toContain(fragment);
    }
    expect(within(knowledgeBaseEntry).queryByRole('button')).not.toBeInTheDocument();
    expect(within(workspaceAggregationEntry).queryByRole('button')).not.toBeInTheDocument();
  });
});
