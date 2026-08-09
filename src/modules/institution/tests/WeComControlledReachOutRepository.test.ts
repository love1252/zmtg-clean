import { describe, expect, it, vi } from 'vitest';
import {
  messageDeliveryToTimelineMetadata,
  type MessageDelivery,
} from '@/modules/institution/domain/followup-message-deliveries';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  customers,
  followUpCustomerTimelineEvents,
  followUpMessageDrafts,
  followUpTasks,
} from '@/server/db/schema';

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'eq', value })),
);
const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({ conditions, operator: 'and' })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: andMock, eq: eqMock };
});

function delivery(id = 'msg-delivery:draft-a'): MessageDelivery {
  return {
    id,
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    customerId: 'customer-a',
    followUpTaskId: 'task-a',
    messageDraftId: 'draft-a',
    channelType: 'mock',
    deliveryMode: 'mock',
    recipientRef: 'customer:customer-a',
    contentSnapshot: '低敏草稿',
    status: 'mock_sent',
    failureReason: null,
    contactSafetyDecision: {
      code: 'allowed',
      allowed: true,
      status: 'mock_sent',
      deliveryMode: 'mock',
      failureReason: null,
      safeReasonLabel: '仅模拟',
      auditReason: 'contact_safety_allowed',
      boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送',
    },
    weComMockReachOut: null,
    createdBy: 'admin-a',
    confirmedBy: 'admin-a',
    createdAt: '2026-07-11T08:00:00.000Z',
    sentAt: '2026-07-11T08:00:00.000Z',
    updatedAt: '2026-07-11T08:00:00.000Z',
  };
}

function timelineRow(
  messageDelivery: MessageDelivery,
  overrides: Partial<{
    customerId: string;
    sourceId: string;
    safeReasonCode: string | null;
  }> = {},
) {
  return {
    customerId: 'customer-a',
    sourceId: `${messageDelivery.id}:created`,
    safeReasonCode: 'message_delivery_created',
    metadataJson: messageDeliveryToTimelineMetadata(messageDelivery),
    ...overrides,
  };
}

describe('WeCom controlled reach-out repository', () => {
  it('按唯一 messageDeliveryId 去重，多条 timeline 行不误判为多个 delivery', async () => {
    const first = delivery();
    const where = vi.fn(async () => [
      timelineRow(first),
      timelineRow(first, { sourceId: `${first.id}:status` }),
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    const result = await repository.listMessageDeliveriesForDraft({
      tenantId: 'tenant-a', institutionId: 'inst-a', draftId: 'draft-a',
    });

    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: followUpCustomerTimelineEvents.tenantId, operator: 'eq', value: 'tenant-a' },
        { column: followUpCustomerTimelineEvents.institutionId, operator: 'eq', value: 'inst-a' },
        { column: followUpCustomerTimelineEvents.sourceType, operator: 'eq', value: 'message_draft' },
      ],
      operator: 'and',
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: first.id,
      customerId: 'customer-a',
      channelType: 'mock',
      deliveryMode: 'mock',
      status: 'mock_sent',
      sentAt: '2026-07-11T08:00:00.000Z',
    });
  });

  it('同一 deliveryId 的 timeline 客户 scope 冲突时仍只返回一条并 fail closed', async () => {
    const first = delivery();
    const where = vi.fn(async () => [
      timelineRow(first, { customerId: 'customer-other' }),
      timelineRow(first, { sourceId: `${first.id}:status` }),
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    const result = await repository.listMessageDeliveriesForDraft({
      tenantId: 'tenant-a', institutionId: 'inst-a', draftId: 'draft-a',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: first.id,
      tenantId: 'scope_mismatch',
      institutionId: 'scope_mismatch',
      messageDraftId: 'scope_mismatch',
      customerId: 'scope_mismatch',
    });
  });

  it('同一 deliveryId 的坏身份快照不能被后来的好快照覆盖', async () => {
    const first = delivery();
    const conflicting = delivery();
    conflicting.tenantId = 'tenant-other';
    const where = vi.fn(async () => [
      timelineRow(conflicting, { sourceId: `${first.id}:status` }),
      timelineRow(first),
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    const result = await repository.listMessageDeliveriesForDraft({
      tenantId: 'tenant-a', institutionId: 'inst-a', draftId: 'draft-a',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: first.id, tenantId: 'scope_mismatch' });
  });

  it('缺少正式 approved draft delivery created 标记时不接受伪造 metadata', async () => {
    const first = delivery();
    const where = vi.fn(async () => [
      timelineRow(first, {
        sourceId: `${first.id}:status`,
        safeReasonCode: 'message_delivery_mock_sent',
      }),
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    const result = await repository.listMessageDeliveriesForDraft({
      tenantId: 'tenant-a', institutionId: 'inst-a', draftId: 'draft-a',
    });

    expect(result).toEqual([]);
  });

  it('draft lookup 的 draft 与关联 task/customer 查询均绑定 tenant + institution + customer', async () => {
    let selectCount = 0;
    const draftWhere = vi.fn(async () => [{ followUpTaskId: 'task-a', customerId: 'customer-a' }]);
    const taskWhere = vi.fn(async () => []);
    const taskInnerJoin = vi.fn(() => ({ where: taskWhere }));
    const from = vi.fn(() => {
      selectCount += 1;
      return selectCount === 1 ? { where: draftWhere } : { innerJoin: taskInnerJoin };
    });
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    const result = await repository.getFollowUpMessageDraftByTenantAndInstitution({
      tenantId: 'tenant-a', institutionId: 'inst-a', draftId: 'draft-a',
    });

    expect(result).toBeNull();
    expect(draftWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpMessageDrafts.tenantId, operator: 'eq', value: 'tenant-a' },
        { column: followUpMessageDrafts.institutionId, operator: 'eq', value: 'inst-a' },
        { column: followUpMessageDrafts.id, operator: 'eq', value: 'draft-a' },
      ],
      operator: 'and',
    });
    expect(taskInnerJoin).toHaveBeenCalledWith(customers, expect.any(Object));
    expect(taskWhere).toHaveBeenCalledWith({
      conditions: expect.arrayContaining([
        { column: followUpTasks.tenantId, operator: 'eq', value: 'tenant-a' },
        { column: followUpTasks.id, operator: 'eq', value: 'task-a' },
        { column: followUpTasks.customerId, operator: 'eq', value: 'customer-a' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-a' },
      ]),
      operator: 'and',
    });
  });

  it('legacy controlled reach-out draft Writer fail-closed，不再直接更新 followUpMessageDrafts', async () => {
    const update = vi.fn();
    const repository = createTenantBusinessRepository({ update } as unknown as TenantDatabase);
    await expect(repository.updateFollowUpMessageDraftControlledReachOut({
      tenantId: 'tenant-a', institutionId: 'inst-a', draftId: 'draft-a',
      expectedUpdatedAt: '2026-07-11T08:00:00.000Z', expectedMetadataJson: { existing: 'low-sensitive' },
      metadataJson: { existing: 'low-sensitive', weComControlledReachOut: { status: 'ready_no_send' } },
      occurredAt: '2026-07-11T09:00:00.000Z',
    })).rejects.toThrow('legacy_follow_up_message_draft_writer_disabled');
    expect(update).not.toHaveBeenCalled();
  });
});
