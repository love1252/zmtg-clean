import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeComExternalContactReadonlyPanel } from '@/modules/institution/components/WeComExternalContactReadonlyPanel';
import { createWeComExternalContactReadonlyApiPayload } from '@/modules/institution/view-models/wecom-external-contact-readonly-view-model';

const payload = createWeComExternalContactReadonlyApiPayload({
  tenantId: 'tenant-panel-mock-001',
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetch(body: unknown = payload, status = 200) {
  const fetchMock = vi.fn(async () => jsonResponse(body, status));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderedContent(container: HTMLElement) {
  return container.textContent ?? '';
}

function expectNoForbiddenContent(container: HTMLElement) {
  const content = renderedContent(container);
  for (const value of [
    'tenant-panel-mock-001',
    'sha256:',
    'access_token',
    'secret',
    'external_userid',
    'userid',
    '13800138000',
    '11010519491231002X',
    'mock raw chat content',
    'mock archive key',
    'raw webhook payload',
    'raw API response',
  ]) {
    expect(content).not.toContain(value);
  }
}

function expectNoOutboundActions() {
  for (const label of [
    '真实同步',
    '立即同步',
    '发送',
    '读取聊天记录',
    '会话内容存档',
  ]) {
    expect(screen.queryByRole('button', { name: new RegExp(label, 'u') })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: new RegExp(label, 'u') })).not.toBeInTheDocument();
  }
}

describe('企业微信外部联系人只读面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('展示 mock/demo 标记、低敏联系人和状态摘要', async () => {
    const fetchMock = mockFetch();
    const { container } = render(<WeComExternalContactReadonlyPanel />);

    expect(screen.getByRole('heading', { name: '外部联系人只读视图' })).toBeInTheDocument();
    expect(screen.getByText('MOCK / DEMO · 只读')).toBeInTheDocument();
    expect(screen.getByText('正在加载外部联系人 mock / demo 只读视图...')).toBeInTheDocument();

    expect(await screen.findByText('[MOCK] 外部联系人 01')).toBeInTheDocument();
    expect(screen.getByText('[MOCK] 外部联系人 04')).toBeInTheDocument();
    expect(screen.getByText('已授权（mock）')).toBeInTheDocument();
    expect(screen.getAllByText('mock 数据就绪').length).toBeGreaterThan(0);
    expect(screen.getByText('受控 mock / demo fixture')).toBeInTheDocument();
    expect(screen.getAllByText('[MOCK] 归属员工 01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('[MOCK] 低敏标签').length).toBe(4);
    expect(screen.getByText('候选匹配')).toBeInTheDocument();
    expect(screen.getByText('已匹配')).toBeInTheDocument();
    expect(screen.getByText('匹配冲突')).toBeInTheDocument();
    expect(screen.getAllByText('待人工复核').length).toBeGreaterThan(0);
    expect(screen.getByText('待复核')).toBeInTheDocument();
    expect(screen.getByText('已通过')).toBeInTheDocument();
    expect(screen.getByText('已拒绝')).toBeInTheDocument();
    expect(screen.getByText('需补充信息')).toBeInTheDocument();
    expect(screen.getByText('外部 provider 保持关闭；当前仅展示受控 mock / demo 低敏数据。')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/wecom/external-contacts', {
      cache: 'no-store',
    });
    expectNoForbiddenContent(container);
    expectNoOutboundActions();
  });

  it('fail-closed 响应不展示联系人、匹配或复核数据', async () => {
    const blockedPayload = createWeComExternalContactReadonlyApiPayload({
      tenantId: 'tenant-panel-mock-001',
      scenario: 'provider_disabled',
    });
    const responseWithInjectedRestrictedData = {
      ...blockedPayload,
      contacts: [{
        contactReference: 'other-tenant-contact',
        displayName: '[MOCK] 不应显示的跨租户联系人',
        owners: [],
        tags: [],
        sourceType: 'other_mock',
        addedAtDate: '2026-07-10',
        remarkSummary: 'should_not_render',
        mappingStatus: 'matched',
        lastSyncedAt: null,
        syncStatus: 'mock_ready',
        manualReviewStatus: 'approved',
      }],
      mappingCandidates: [{
        mappingReference: 'other-mapping',
        contactReference: 'other-tenant-contact',
        systemCustomerReference: 'other-customer',
        mappingStatus: 'matched',
        confidenceLevel: 'high',
        matchReasonCode: 'mock_digest_candidate',
        manualReviewStatus: 'approved',
        updatedAt: '2026-07-12T00:00:00.000Z',
      }],
      manualReview: [{
        reviewReference: 'other-review',
        contactReference: 'other-tenant-contact',
        reviewStatus: 'approved',
        reasonCode: 'mapping_approved',
        reviewedAt: '2026-07-12T00:00:00.000Z',
        nextAction: 'none',
      }],
    };
    mockFetch(responseWithInjectedRestrictedData);
    const { container } = render(<WeComExternalContactReadonlyPanel />);

    expect(await screen.findByText('外部联系人数据已按 fail-closed 阻断')).toBeInTheDocument();
    expect(screen.getByText('同步已禁用')).toBeInTheDocument();
    expect(screen.queryByText('[MOCK] 不应显示的跨租户联系人')).not.toBeInTheDocument();
    expect(renderedContent(container)).not.toContain('should_not_render');
    expectNoForbiddenContent(container);
    expectNoOutboundActions();
  });

  it('API 响应混入禁止字段时 fail-closed 且不展示任何联系人', async () => {
    const injectedPayload = {
      ...payload,
      access_token: 'api-access-token-should-not-render',
      secret: 'api-secret-should-not-render',
      external_userid: 'raw-external-id-should-not-render',
      contacts: payload.contacts.map((contact, index) => index === 0
        ? {
            ...contact,
            userid: 'raw-user-id-should-not-render',
            phone: '13800138000',
            idCard: '11010519491231002X',
            chatContent: 'mock raw chat content',
            chatArchiveKey: 'mock archive key',
            webhookPayload: 'raw webhook payload',
            apiResponse: 'raw API response',
          }
        : contact),
    };
    mockFetch(injectedPayload);
    const { container } = render(<WeComExternalContactReadonlyPanel />);

    expect(await screen.findByText('只读响应未通过字段白名单校验')).toBeInTheDocument();
    expect(screen.queryByText('[MOCK] 外部联系人 01')).not.toBeInTheDocument();
    expectNoForbiddenContent(container);
    expectNoOutboundActions();
  });

  it.each([
    [401, '登录状态已失效，请重新登录'],
    [403, '当前账号没有查看外部联系人只读视图的权限'],
    [500, '企业微信外部联系人只读视图暂时不可用'],
  ])('API 返回 %s 时显示稳定错误提示且不泄漏响应详情', async (status, message) => {
    mockFetch({
      error: 'secret access_token external_userid userid 13800138000 raw chat content',
    }, status);
    const { container } = render(<WeComExternalContactReadonlyPanel />);

    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/正在加载/u)).not.toBeInTheDocument());
    expectNoForbiddenContent(container);
    expectNoOutboundActions();
  });
});
