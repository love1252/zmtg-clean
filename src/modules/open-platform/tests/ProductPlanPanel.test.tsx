import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductPlanPanel } from '@/modules/open-platform/components/ProductPlanPanel';

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

const planCatalogPayload = {
  summary: {
    planCount: 2,
    draftVersionCount: 1,
    publishedVersionCount: 2,
    retiredVersionCount: 1,
  },
  plans: [
    {
      planId: 'plan-starter',
      planName: 'Starter 基础版',
      planCode: 'starter',
      planDescription: '适合单机构试运行',
      planStatus: 'active',
      publishedVersionId: 'plan-version-starter-published',
      draftVersionId: null,
      versions: [
        {
          versionId: 'plan-version-starter-published',
          planId: 'plan-starter',
          versionCode: '2026-06-v1',
          status: 'published',
          displayName: 'Starter 基础版',
          displayPrice: '¥999/月',
          priceNote: '展示价，线下确认',
          agentLimit: 1,
          seatLimit: 12,
          monthlyAiCallLimit: 50000,
          knowledgeStorageGb: 20,
          connectorEntitlementsJson: { connectors: ['企微'] },
          serviceEntitlementsJson: { services: ['基础培训'] },
          featureEntitlementsJson: { modules: ['客户运营'] },
          quotaEntitlementsJson: { aiCallsPerMonth: 50000 },
          changeSummary: '首次发布',
          createdBy: 'platform-user',
          updatedBy: 'platform-user',
          publishedBy: 'platform-user',
          publishedAt: '2026-06-21T08:00:00.000Z',
          retiredAt: null,
          createdAt: '2026-06-20T08:00:00.000Z',
          updatedAt: '2026-06-21T08:00:00.000Z',
        },
      ],
    },
    {
      planId: 'plan-professional',
      planName: 'Professional 专业版',
      planCode: 'professional',
      planDescription: '适合增长期机构',
      planStatus: 'active',
      publishedVersionId: 'plan-version-professional-published',
      draftVersionId: 'plan-version-professional-draft',
      versions: [
        {
          versionId: 'plan-version-professional-draft',
          planId: 'plan-professional',
          versionCode: '2026-06-v2',
          status: 'draft',
          displayName: 'Professional 专业版',
          displayPrice: '¥3999/月',
          priceNote: '展示价，线下确认',
          agentLimit: 5,
          seatLimit: 60,
          monthlyAiCallLimit: 500000,
          knowledgeStorageGb: 200,
          connectorEntitlementsJson: {
            connectors: ['企微', 'HIS'],
            api_key: 'sk_test_should_not_render',
          },
          serviceEntitlementsJson: { services: ['实施支持', '季度复盘'] },
          featureEntitlementsJson: { modules: ['客户运营', '知识库'] },
          quotaEntitlementsJson: { aiCallsPerMonth: 500000 },
          changeSummary: '增加 AI 调用',
          createdBy: 'platform-user',
          updatedBy: 'platform-user',
          publishedBy: null,
          publishedAt: null,
          retiredAt: null,
          createdAt: '2026-06-22T08:00:00.000Z',
          updatedAt: '2026-06-22T08:00:00.000Z',
        },
        {
          versionId: 'plan-version-professional-published',
          planId: 'plan-professional',
          versionCode: '2026-06-v1',
          status: 'published',
          displayName: 'Professional 专业版',
          displayPrice: '¥2999/月',
          priceNote: '展示价，线下确认',
          agentLimit: 3,
          seatLimit: 40,
          monthlyAiCallLimit: 300000,
          knowledgeStorageGb: 100,
          connectorEntitlementsJson: { connectors: ['企微', 'HIS', 'CRM'] },
          serviceEntitlementsJson: { services: ['实施支持'] },
          featureEntitlementsJson: { modules: ['客户运营'] },
          quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
          changeSummary: '首次发布',
          createdBy: 'platform-user',
          updatedBy: 'platform-user',
          publishedBy: 'platform-user',
          publishedAt: '2026-06-21T08:00:00.000Z',
          retiredAt: null,
          createdAt: '2026-06-20T08:00:00.000Z',
          updatedAt: '2026-06-21T08:00:00.000Z',
        },
        {
          versionId: 'plan-version-professional-retired',
          planId: 'plan-professional',
          versionCode: '2026-05-v1',
          status: 'retired',
          displayName: 'Professional 专业版',
          displayPrice: '¥2599/月',
          priceNote: '历史展示价',
          agentLimit: 2,
          seatLimit: 30,
          monthlyAiCallLimit: 200000,
          knowledgeStorageGb: 80,
          connectorEntitlementsJson: { connectors: ['企微'] },
          serviceEntitlementsJson: { services: ['历史支持'] },
          featureEntitlementsJson: { modules: ['客户运营'] },
          quotaEntitlementsJson: { aiCallsPerMonth: 200000 },
          changeSummary: '历史版本',
          createdBy: 'platform-user',
          updatedBy: 'platform-user',
          publishedBy: 'platform-user',
          publishedAt: '2026-05-21T08:00:00.000Z',
          retiredAt: '2026-06-21T08:00:00.000Z',
          createdAt: '2026-05-20T08:00:00.000Z',
          updatedAt: '2026-06-21T08:00:00.000Z',
        },
      ],
    },
  ],
};

function mockPlanCatalogFetch() {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const path = fetchPath(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (path === '/api/v1/open-platform/plan-catalog' && method === 'GET') {
      return jsonResponse(planCatalogPayload);
    }
    if (
      path === '/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft' &&
      method === 'PUT'
    ) {
      return jsonResponse({
        status: 'draft_saved',
        version: {
          ...planCatalogPayload.plans[1].versions[0],
          displayPrice: '¥4599/月',
          agentLimit: 6,
          updatedAt: '2026-06-23T08:00:00.000Z',
        },
      });
    }
    if (
      path === '/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft/publish' &&
      method === 'POST'
    ) {
      return jsonResponse({
        status: 'published',
        version: {
          ...planCatalogPayload.plans[1].versions[0],
          status: 'published',
          publishedAt: '2026-06-23T08:00:00.000Z',
          updatedAt: '2026-06-23T08:00:00.000Z',
        },
      });
    }
    if (
      path === '/api/v1/open-platform/plan-catalog/plan-starter/versions' &&
      method === 'POST'
    ) {
      return jsonResponse({
        status: 'draft_created',
        version: {
          ...planCatalogPayload.plans[0].versions[0],
          versionId: 'plan-version-starter-draft',
          versionCode: '2026-06-draft',
          status: 'draft',
          publishedBy: null,
          publishedAt: null,
        },
      });
    }

    throw new Error(`没有为 ${method} ${path} 配置 fetch mock`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectNoSensitivePlanContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('sk_test_should_not_render');
  expect(text).not.toContain('api_key');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('webhook_secret');
  expect(text).not.toContain('payment_token');
  expect(text).not.toContain('contract_body');
  expect(text).not.toContain('真实支付');
  expect(text).not.toContain('立即支付');
  expect(text).not.toContain('自动扣费');
  expect(text).not.toContain('自动扣款');
  expect(text).not.toContain('在线开票');
}

describe('产品与套餐面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('从套餐目录 API 加载配置台，展示概览、套餐版本和安全边界', async () => {
    const fetchMock = mockPlanCatalogFetch();
    const { container } = render(<ProductPlanPanel />);

    expect(screen.getByRole('heading', { name: '产品与套餐' })).toBeInTheDocument();
    expect(screen.getByText('正在加载套餐目录...')).toBeInTheDocument();

    expect(await screen.findByText('套餐目录配置台')).toBeInTheDocument();
    expect(screen.getByText('套餐模板')).toBeInTheDocument();
    expect(screen.getByText('已发布版本')).toBeInTheDocument();
    expect(screen.getByText('草稿版本')).toBeInTheDocument();
    expect(screen.getByText('停用版本')).toBeInTheDocument();
    expect(screen.getByText('Professional 专业版')).toBeInTheDocument();
    expect(screen.getAllByText('当前 published 版本').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-06-v1').length).toBeGreaterThan(0);
    expect(screen.getByText('可编辑 draft 版本')).toBeInTheDocument();
    expect(screen.getByText('2026-06-v2')).toBeInTheDocument();
    expect(screen.getAllByText('¥2999/月').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agent 数量').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '编辑 Professional 专业版 草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制 Starter 基础版 为草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '套餐目录' })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchPath(fetchMock.mock.calls[0]?.[0] ?? '')).toBe('/api/v1/open-platform/plan-catalog');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ cache: 'no-store' });
    expectNoSensitivePlanContent(container);
  });

  it('支持编辑草稿、保存展示价和权益字段，并发布草稿版本', async () => {
    const fetchMock = mockPlanCatalogFetch();
    const { container } = render(<ProductPlanPanel />);

    await screen.findByText('套餐目录配置台');
    fireEvent.click(screen.getByRole('button', { name: '编辑 Professional 专业版 草稿' }));

    const editor = screen.getByRole('region', { name: '套餐草稿编辑器' });
    expect(within(editor).getByLabelText('展示价格')).toHaveValue('¥3999/月');
    fireEvent.change(within(editor).getByLabelText('展示价格'), { target: { value: '¥4599/月' } });
    fireEvent.change(within(editor).getByLabelText('Agent 数量'), { target: { value: '6' } });
    fireEvent.click(within(editor).getByRole('button', { name: '保存草稿' }));

    await waitFor(() => expect(screen.getByText('草稿已保存')).toBeInTheDocument());
    const saveCall = fetchMock.mock.calls.find(([input, init]) => (
      fetchPath(input) === '/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft' &&
      String(init?.method).toUpperCase() === 'PUT'
    ));
    expect(saveCall).toBeDefined();
    expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        displayPrice: '¥4599/月',
        agentLimit: 6,
        seatLimit: 60,
        monthlyAiCallLimit: 500000,
        knowledgeStorageGb: 200,
      }),
    );
    expect(String(saveCall?.[1]?.body)).not.toMatch(/status|payment_token|api_key|webhook_secret/i);

    fireEvent.click(within(editor).getByRole('button', { name: '发布草稿' }));

    await waitFor(() => expect(screen.getByText('草稿已发布')).toBeInTheDocument());
    await waitFor(() => {
      expect(within(screen.getByText('已发布版本').parentElement as HTMLElement).getByText('2')).toBeInTheDocument();
      expect(within(screen.getByText('停用版本').parentElement as HTMLElement).getByText('2')).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.some(([input, init]) => (
      fetchPath(input) ===
        '/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft/publish' &&
      String(init?.method).toUpperCase() === 'POST'
    ))).toBe(true);
    expectNoSensitivePlanContent(container);
  });

  it('展示权益对照、版本记录和商业化预留边界，不出现真实交易动作', async () => {
    const fetchMock = mockPlanCatalogFetch();
    const { container } = render(<ProductPlanPanel />);

    await screen.findByText('套餐目录配置台');
    fireEvent.click(screen.getByRole('button', { name: '权益对照' }));

    expect(screen.getByRole('table', { name: '套餐权益对照预览' })).toBeInTheDocument();
    expect(screen.getByText('知识库存储')).toBeInTheDocument();
    expect(screen.getByText('企微 / HIS / CRM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '版本记录' }));
    expect(screen.getByText(/2026-05-v1/)).toBeInTheDocument();
    expect(screen.getByText('retired')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '商业化预留' }));
    expect(screen.getByText('订单')).toBeInTheDocument();
    expect(screen.getByText('合同')).toBeInTheDocument();
    expect(screen.getByText('发票')).toBeInTheDocument();
    expect(screen.getByText('支付')).toBeInTheDocument();
    expect(screen.getByText(/仅作为人工记录状态预留/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(1);
    expectNoSensitivePlanContent(container);
  });
});
