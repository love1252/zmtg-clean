import {
  render,
  screen,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
} from 'vitest';

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
