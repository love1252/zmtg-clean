import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeComCustomerMappingPanel } from '@/modules/institution/components/WeComCustomerMappingPanel';

const candidates = [
  {
    customerId: 'customer-a',
    displayName: '低敏客户 A',
    maskedPhone: '138****0000',
    maskedMedicalRecordNo: 'MR-***-01',
    lifecycle: 'consulting',
    priority: 'high',
  },
  {
    customerId: 'customer-b',
    displayName: '低敏客户 B',
    maskedPhone: '139****0000',
    maskedMedicalRecordNo: 'MR-***-02',
    lifecycle: 'scheduled',
    priority: 'medium',
  },
];

function mappingResponse(canWrite: boolean) {
  return {
    mapping: {
      proofContactId: 'live-contact-proof-01',
      proofEmployeeId: 'live-employee-proof-01',
      sourceMode: 'real_readonly_proof',
      status: 'unreviewed',
      customerId: null,
    },
    candidates,
    currentCustomer: null,
    canWrite,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WeComCustomerMappingPanel', () => {
  it('tenant_admin 展示低敏候选、边界文案并可人工确认', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(mappingResponse(true)))
      .mockResolvedValueOnce(
        response({
          outcome: 'updated',
          mapping: {
            proofContactId: 'live-contact-proof-01',
            proofEmployeeId: 'live-employee-proof-01',
            sourceMode: 'real_readonly_proof',
            status: 'confirmed',
            customerId: 'customer-a',
          },
        }),
      );

    const { container } = render(<WeComCustomerMappingPanel />);

    await waitFor(() => expect(screen.getByText('当前状态：')).toBeInTheDocument());
    expect(screen.getByText('待人工审核')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '本机构客户候选' })).toBeEnabled();
    expect(screen.getByRole('option', { name: /低敏客户 A/u })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /低敏客户 B/u })).toBeInTheDocument();
    expect(screen.getByText('仅人工关联')).toBeInTheDocument();
    expect(screen.getByText('不自动匹配')).toBeInTheDocument();
    expect(screen.getByText('不自动创建或合并客户')).toBeInTheDocument();
    expect(screen.getByText('关联不代表允许触达')).toBeInTheDocument();
    expect(screen.getByText('当前不调用真实企业微信')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认关联' }));

    await waitFor(() => expect(screen.getByText('人工映射操作成功。')).toBeInTheDocument());
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/institution/wecom-customer-mapping',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'confirm',
          proofContactId: 'live-contact-proof-01',
          customerId: 'customer-a',
        }),
      }),
    );
    expect(screen.getByText('已确认')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/external_userid|UserID|corpId|Secret|token/i);
  });

  it('tenant_operator 只读展示且确认、拒绝、撤销均禁用', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(mappingResponse(false)));

    render(<WeComCustomerMappingPanel />);

    await waitFor(() => expect(screen.getByText(/当前角色仅可只读查看/u)).toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: '本机构客户候选' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '确认关联' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '拒绝关联' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '撤销关联' })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])('加载返回 %s 时失败关闭且不发 mutation', async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ error: '没有访问权限' }, status));

    render(<WeComCustomerMappingPanel />);

    await waitFor(() =>
      expect(screen.getByText('无权限查看映射信息，所有操作已禁用。')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('combobox', { name: '本机构客户候选' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认关联' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('加载失败时不展示可写控件且不发 mutation', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network unavailable'));

    render(<WeComCustomerMappingPanel />);

    await waitFor(() =>
      expect(screen.getByText('映射信息加载失败，请稍后重试。')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('combobox', { name: '本机构客户候选' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认关联' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('冲突和 POST 403 提示受控并将 UI 切为只读', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(mappingResponse(true)))
      .mockResolvedValueOnce(response({ code: 'conflict', error: '映射状态已变化' }, 409))
      .mockResolvedValueOnce(response({ error: '没有访问权限' }, 403));

    render(<WeComCustomerMappingPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: '确认关联' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: '确认关联' }));
    await waitFor(() => expect(screen.getByText('映射状态发生冲突，请刷新后重试。')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '拒绝关联' }));
    await waitFor(() => expect(screen.getByText('没有写入权限，当前保持只读。')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '确认关联' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '拒绝关联' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '撤销关联' })).toBeDisabled();
  });
});
