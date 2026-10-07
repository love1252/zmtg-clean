import {
  render,
  screen, fireEvent, waitFor, cleanup,
} from '@testing-library/react';
import {
  describe, afterEach, vi,
  expect,
  it,
} from 'vitest';

import { CareFollowUpCompletionForm } from '@/modules/care/components/CareFollowUpCompletionForm';
import { CareFollowUpControlledShell } from '@/modules/care/components/CareFollowUpControlledShell';
import type { FormalFollowUpDtoV1 } from '@/modules/care/application/formal-follow-up-view';

function record(
  overrides: Partial<FormalFollowUpDtoV1> = {},
): FormalFollowUpDtoV1 {
  return {
    taskId: 'task-1',
    customer: {
      customerId: 'customer-1',
      displayName: '客户A',
      maskedReference: null,
    },
    stageCode: 'manual_followup',
    actionCode: 'manual_contact',
    dueAt: '2026-08-18T02:00:00.000Z',
    state: 'pending',
    revision: 1,
    riskLevel: 'none',
    riskKind: null,
    completionCode: null,
    cancellationReason: null,
    assignment: {
      kind: 'role_pool',
      role: 'customer_service',
    },
    permissions: {
      canClaim: true,
      canOperate: false,
      canReassign: false,
      canUnclaim: false,
      canCancel: false,
    },
    createdAt: '2026-08-17T15:00:00.000Z',
    updatedAt: '2026-08-17T15:00:00.000Z',
    ...overrides,
  };
}

describe('CareFollowUpControlledShell', () => {
  it('authoritative empty has no synthetic business rows or send/HIS controls', () => {
    render(
      <CareFollowUpControlledShell
        records={[]}
        canCreate={false}
      />,
    );

    expect(
      screen.getByText(
        '当前正式机构范围内暂无人工随访任务。',
      ),
    ).toBeInTheDocument();

    for (const label of [
      '发送',
      '真实发送',
      'HIS',
      '自动触达',
    ]) {
      expect(
        screen.queryByRole(
          'button',
          { name: label },
        ),
      ).not.toBeInTheDocument();
    }
  });

  it('role-pool task exposes claim but not direct operation before claim', () => {
    render(
      <CareFollowUpControlledShell
        records={[record()]}
        canCreate={false}
      />,
    );

    expect(
      screen.getByRole(
        'button',
        { name: '认领' },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole(
        'button',
        { name: '开始处理' },
      ),
    ).not.toBeInTheDocument();
  });

  it('management create form contains only controlled stage/action semantics', () => {
    render(
      <CareFollowUpControlledShell
        records={[]}
        canCreate
      />,
    );

    expect(
      screen.getByRole(
        'heading',
        { name: '新建人工联系任务' },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /manual_followup.*manual_contact/u,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(
        /动作代码/u,
      ),
    ).not.toBeInTheDocument();
  });
});


afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const operatingRecord = () => record({ state: 'in_progress', permissions: { canClaim: false, canOperate: true, canReassign: false, canUnclaim: false, canCancel: false } });
it('受控完成结果与 240 字低敏摘要交给既有完成命令', async () => {
  const complete = vi.fn(async () => {});
  render(<CareFollowUpCompletionForm onComplete={complete} />);
  fireEvent.change(screen.getByRole('combobox', { name: '完成结果' }), { target: { value: 'customer_declined' } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '暂不需要联系' } });
  fireEvent.click(screen.getByRole('button', { name: '确认完成' }));
  await waitFor(() => expect(complete).toHaveBeenCalledWith({ code: 'customer_declined', feedback: { kind: 'manual_low_sensitivity', summary: '暂不需要联系' } }));
  expect(screen.queryByRole('option', { name: /HIS/ })).not.toBeInTheDocument();
});
it.each(['a'.repeat(241), '请联系13800138000', '身份证已登记', '病历记录', '摘要\n另一行'])('摘要校验拒绝非法内容且没有 mutation', async summary => {
  const complete = vi.fn(async () => {});
  render(<CareFollowUpCompletionForm onComplete={complete} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: summary } });
  fireEvent.click(screen.getByRole('button', { name: '确认完成' }));
  expect(screen.getByRole('alert')).toHaveTextContent('摘要最多 240 字');
  expect(complete).not.toHaveBeenCalled();
});
it('240 字边界与选填空摘要合法', () => {
  const complete = vi.fn(async () => {});
  render(<CareFollowUpCompletionForm onComplete={complete} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '字'.repeat(240) } });
  fireEvent.click(screen.getByRole('button', { name: '确认完成' }));
  expect(complete).toHaveBeenLastCalledWith({ code: 'contact_completed', feedback: { kind: 'manual_low_sensitivity', summary: '字'.repeat(240) } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: '确认完成' }));
  expect(complete).toHaveBeenLastCalledWith({ code: 'contact_completed', feedback: null });
});
it('保存中禁用全部操作，失败保留摘要和结果，可用原 revision 重试', async () => {
  let resolve!: (value: Response) => void;
  const fetchMock = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetchMock);
  render(<CareFollowUpControlledShell records={[operatingRecord()]} canCreate={false} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '已沟通安排' } });
  fireEvent.click(screen.getByRole('button', { name: '确认完成' }));
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('button', { name: '确认完成' })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  resolve(new Response('{}', { status: 503 }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('随访操作未完成'));
  expect(screen.getByRole('textbox')).toHaveValue('已沟通安排');
  expect(screen.getByRole('button', { name: '确认完成' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '确认完成' }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  expect(calls[0]?.[0]).toBe('/api/v1/institution/followups/task-1');
  expect(JSON.parse(String(calls[0]?.[1].body))).toEqual({ command: 'complete', expectedRevision: 1, code: 'contact_completed', feedback: { kind: 'manual_low_sensitivity', summary: '已沟通安排' } });
  expect(calls[0]?.[1].body).toEqual(calls[1]?.[1].body);
  resolve(new Response('{}', { status: 503 }));
  await waitFor(() => expect(screen.getByRole('button', { name: '确认完成' })).toBeEnabled());
});
it.each([401, 403, 409])('权限或版本已变化 %s 时停止写入并提示刷新', async status => {
  const fetchMock = vi.fn(async () => new Response('{}', { status }));
  vi.stubGlobal('fetch', fetchMock);
  render(<CareFollowUpControlledShell records={[operatingRecord()]} canCreate={false} />);
  fireEvent.click(screen.getByRole('button', { name: '确认完成' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('button', { name: '确认完成' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '刷新当前任务' })).toBeEnabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('完成历史回显与站内返回入口使用正式事实', () => {
  render(<CareFollowUpControlledShell records={[record({ state: 'completed', completionCode: 'customer_declined', completionFeedback: { kind: 'manual_low_sensitivity', summary: '暂不需要联系' } })]} canCreate={false} selectedTaskId="task-1" returnHref="/hospital/care/followups?page=6&pageSize=20" />);
  expect(screen.getByText('完成结果：客户拒绝')).toBeInTheDocument();
  expect(screen.getByText('低敏摘要：暂不需要联系')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '返回列表' })).toHaveAttribute('href', '/hospital/care/followups?page=6&pageSize=20');
  expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute('href', '/hospital');
  expect(screen.queryByRole('button', { name: '确认完成' })).not.toBeInTheDocument();
});
