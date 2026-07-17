import { describe, expect, it, vi } from 'vitest';
import { mapCustomerListItemV1 } from '@/modules/customer-center/domain/customer-list-item';
import type {
  CustomerOverviewProjectionInput,
  CustomerOverviewProjectionPolicy,
} from '@/modules/customer-center/domain/customer-overview';

const policy: CustomerOverviewProjectionPolicy = {
  allowedLifecycleBasisCodes: new Set(['basis_appointment_confirmed']),
  allowedLifecycleBasisSourceKinds: new Set(['source_appointment']),
  isTrustedCustomerId: (customerId) => customerId === 'customer_alpha',
  isApprovedDisplayName: (displayName) => displayName === '客户甲',
  isApprovedMaskedReference: (maskedReference) => maskedReference === '档案****0421',
  isApprovedOwner: (userId, displayName) =>
    userId === 'member_alpha' && displayName === '顾问甲',
  isApprovedProject: (projectId, displayName) =>
    projectId === 'project_alpha' && displayName === '项目甲',
  isApprovedTag: (tagCode, displayName) =>
    tagCode === 'tag_followup' && displayName === '待跟进',
  isTrustedLifecycleBasisSourceId: (sourceId) => sourceId === 'source_alpha',
};

function createInput(): CustomerOverviewProjectionInput & { lastTouchedAt: string } {
  return {
    customer: {
      customerId: 'customer_alpha',
      displayName: '客户甲',
      maskedReference: '档案****0421',
    },
    lifecycle: 'scheduled',
    priority: 'high',
    owner: { userId: 'member_alpha', displayName: '顾问甲' },
    primaryProject: { projectId: 'project_alpha', displayName: '项目甲' },
    projects: [{ projectId: 'project_alpha', displayName: '项目甲' }],
    tags: [{ tagCode: 'tag_followup', displayName: '待跟进' }],
    lifecycleBasis: {
      basisCode: 'basis_appointment_confirmed',
      sourceKind: 'source_appointment',
      sourceId: 'source_alpha',
      occurredAt: '2026-07-17T00:00:00.000Z',
    },
    lastTouchedAt: '2026-07-17T08:00:00.000Z',
    updatedAt: '2026-07-17T09:00:00.000Z',
  };
}

describe('客户中心 CustomerListItemV1 边界', () => {
  it('未知字段、自由文本 nextAction、敏感字段与 scope 暗示整体 fail-closed', () => {
    for (const [key, value] of [
      ['nextAction', 'legacy_next_action'],
      ['notes', 'legacy_note'],
      ['maskedPhone', 'legacy_contact'],
      ['tenantId', 'tenant_other'],
      ['institutionId', 'institution_other'],
      ['unexpected', 'unexpected_value'],
    ]) {
      expect(mapCustomerListItemV1({ ...createInput(), [key]: value }, policy)).toBeNull();
    }
  });

  it('accessor 与抛错 Proxy 不读取、不回显且 fail-closed', () => {
    const source = createInput();
    const lastTouchedGetter = vi.fn(() => '2026-07-17T08:00:00.000Z');
    Object.defineProperty(source, 'lastTouchedAt', {
      enumerable: true,
      get: lastTouchedGetter,
    });
    expect(mapCustomerListItemV1(source, policy)).toBeNull();
    expect(lastTouchedGetter).not.toHaveBeenCalled();

    const proxy = new Proxy(createInput(), {
      ownKeys() {
        throw new Error('private_marker');
      },
    });
    expect(mapCustomerListItemV1(proxy, policy)).toBeNull();
  });

  it('来源夹带的嵌套敏感 accessor 不执行且绝不进入列表 DTO', () => {
    const source = createInput();
    const sensitiveGetter = vi.fn(() => {
      throw new Error('private_contact_marker');
    });
    Object.defineProperty(source.customer, 'rawContact', {
      enumerable: true,
      get: sensitiveGetter,
    });

    const item = mapCustomerListItemV1(source, policy);
    expect(item).not.toBeNull();
    expect(JSON.stringify(item)).not.toContain('private_contact_marker');
    expect(sensitiveGetter).not.toHaveBeenCalled();
  });

  it('非法 ID、时间、legacy 枚举或敏感客户引用不产生假占位', () => {
    const sensitiveDisplayName = ['138', '0000', '0000'].join('');
    for (const input of [
      { ...createInput(), customer: { ...createInput().customer, customerId: 'customer id' } },
      { ...createInput(), updatedAt: 'not-a-time' },
      { ...createInput(), lastTouchedAt: '2026-07-17T08:00:00' },
      { ...createInput(), lastTouchedAt: null },
      { ...createInput(), lifecycle: 'legacy_stage' },
      { ...createInput(), priority: 'observe' },
      {
        ...createInput(),
        customer: { ...createInput().customer, displayName: sensitiveDisplayName },
      },
    ]) {
      expect(mapCustomerListItemV1(input, policy)).toBeNull();
    }
  });

  it('未批准关系不投影，非 null 主项目不可靠时整体 fail-closed', () => {
    const relationshipLimited = mapCustomerListItemV1(
      {
        ...createInput(),
        owner: { userId: 'member_other', displayName: '顾问甲' },
        primaryProject: null,
        projects: [{ projectId: 'project_other', displayName: '项目其他' }],
        tags: [{ tagCode: 'tag_other', displayName: '待跟进' }],
      },
      policy,
    );
    expect(relationshipLimited).not.toBeNull();
    expect(relationshipLimited?.owner).toBeNull();
    expect(relationshipLimited?.primaryProject).toBeNull();
    expect(relationshipLimited?.tags).toEqual([]);

    expect(
      mapCustomerListItemV1(
        {
          ...createInput(),
          primaryProject: { projectId: 'project_other', displayName: '项目其他' },
        },
        policy,
      ),
    ).toBeNull();
  });
});
