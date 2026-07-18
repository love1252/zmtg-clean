import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';

const createdCustomer = {
  id: 'cust_accessibility_created',
  tenantId: 'demo-tenant-001',
  displayName: '林女士',
  lifecycle: 'consulting',
  priority: 'observe',
  ownerUserId: 'consultant-lin',
  projectInterest: '皮肤管理',
  maskedPhone: '138****1208',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '初次咨询',
  nextAction: '预约到店',
  tags: [],
  gender: '',
  birthDate: '',
  referralSource: '',
  notes: '',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockCustomerFetch(responses: Response[]) {
  const fetchMock = vi.fn(async () => {
    const response = responses.shift();
    if (!response) {
      throw new Error('没有配置更多 fetch 响应');
    }

    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function fillCreateCustomerForm() {
  fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
  fireEvent.change(screen.getByLabelText('负责人 ID'), {
    target: { value: 'consultant-lin' },
  });
  fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
  fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), {
    target: { value: '138****1208' },
  });
  fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), {
    target: { value: 'MR****001' },
  });
  fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
  fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CustomerCenterShell 无障碍错误告警', () => {
  it('初始状态和打开操作面板时不渲染空告警', async () => {
    mockCustomerFetch([jsonResponse({ records: [] })]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新建客户' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('新建客户校验失败通过唯一即时告警呈现且不发送请求', async () => {
    const fetchMock = mockCustomerFetch([jsonResponse({ records: [] })]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新建客户' }));
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('字段 客户姓名 必须填写');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('新建客户服务端失败只播报受控错误，重试成功后清除告警', async () => {
    const rawError = 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret';
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ error: rawError }, 503),
      jsonResponse({ record: createdCustomer }, 201),
    ]);

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新建客户' }));
    fillCreateCustomerForm();
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('数据服务暂时不可用');
    expect(container.textContent).not.toContain(rawError);
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText('林女士')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: '新建客户' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('导入校验和服务端失败使用即时告警，成功预检后清除告警', async () => {
    const rawError = 'Error: stack includes sk_test_should_not_render';
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ error: rawError }, 503),
      jsonResponse({
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        canExecute: true,
        importBatch: { importBatchId: 'customer-import:accessibility-success', rows: [] },
        importedCustomerIds: [],
        auditRecorded: true,
      }),
    ]);

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '低敏导入' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const input = screen.getByLabelText('导入 JSON 数组');
    fireEvent.change(input, { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: '导入预检' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('导入内容必须是合法 JSON');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: '[]' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '导入预检' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('数据服务暂时不可用');
    expect(container.textContent).not.toContain(rawError);

    fireEvent.click(screen.getByRole('button', { name: '导入预检' }));
    expect(await screen.findByText('customer-import:accessibility-success')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
