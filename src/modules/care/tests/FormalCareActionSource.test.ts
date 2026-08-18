import { describe, expect, it } from 'vitest';

import { buildFormalCareActionSourceV1 } from '@/modules/care/application/formal-care-action-source';
import type { FormalFollowUpTaskRecordV1 } from '@/modules/care/ports/formal-follow-up-store';

function task(
  overrides: Partial<FormalFollowUpTaskRecordV1> = {},
): FormalFollowUpTaskRecordV1 {
  return {
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    taskId: 'task-1',
    customerId: 'customer-1',
    customerDisplayName: '客户A',
    customerMaskedReference: null,
    stageCode: 'manual_followup',
    actionCode: 'manual_contact',
    dueAt: '2026-08-17T04:00:00.000Z',
    state: 'pending',
    revision: 1,
    riskLevel: 'none',
    riskKind: null,
    riskEventId: null,
    completionCode: null,
    completionFeedback: null,
    cancellationReason: null,
    assignment: {
      kind: 'role_pool',
      role: 'customer_service',
    },
    idempotencyKey: 'manual-idempotency-001',
    requestDigest: 'a'.repeat(64),
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    createdAt: '2026-08-17T01:00:00.000Z',
    updatedAt: '2026-08-17T01:00:00.000Z',
    ...overrides,
  };
}

describe('Formal CareActionSourceV1', () => {
  it('keeps appointment partitions disabled and publishes only formal follow-up actions', () => {
    const source = buildFormalCareActionSourceV1({
      tenantId: 'tenant-1',
      institutionId: 'institution-1',
      tasks: [task()],
      referenceTime: '2026-08-17T06:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: '1',
    });

    expect(source.readiness).toBe('partial');
    expect(source.failureCode).toBe('data_incomplete');
    expect(source.partitions.slice(0, 2)).toEqual([
      expect.objectContaining({
        readiness: 'disabled',
        failureCode: 'not_released',
      }),
      expect.objectContaining({
        readiness: 'disabled',
        failureCode: 'not_released',
      }),
    ]);
    expect(source.data?.actions).toHaveLength(1);
    expect(source.data?.actions[0]).toMatchObject({
      entityType: 'followup',
      objectId: 'task-1',
      businessState: 'pending',
      owner: {
        kind: 'role_pool',
        role: 'customer_service',
      },
    });
    expect(JSON.stringify(source)).not.toMatch(
      /message_body|his_payload|provider_payload|raw_payload/iu,
    );
  });

  it('never projects another institution task into the current action source', () => {
    const source = buildFormalCareActionSourceV1({
      tenantId: 'tenant-1',
      institutionId: 'institution-1',
      tasks: [
        task({
          taskId: 'foreign-task',
          institutionId: 'institution-other',
        }),
      ],
      referenceTime: '2026-08-17T06:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: '1',
    });

    expect(source.data?.actions).toEqual([]);
    expect(source.data?.cards).toEqual([
      expect.objectContaining({
        key: 'overdue_followups',
        count: 0,
      }),
      expect.objectContaining({
        key: 'today_due_followups',
        count: 0,
      }),
    ]);
  });
});
