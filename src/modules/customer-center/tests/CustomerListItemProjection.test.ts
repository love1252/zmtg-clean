import { describe, expect, it } from 'vitest';
import {
  mapCustomerListItemV1,
  type CustomerListItemProjectionInput,
} from '@/modules/customer-center/domain/customer-list-item';
import {
  CUSTOMER_LIFECYCLES,
  CUSTOMER_PRIORITIES,
} from '@/modules/customer-center/domain/customer-query';
import type { CustomerOverviewProjectionPolicy } from '@/modules/customer-center/domain/customer-overview';

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

function createInput() {
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
  } satisfies CustomerListItemProjectionInput;
}

function requireListItem(input = createInput()) {
  const item = mapCustomerListItemV1(input, policy);
  expect(item).not.toBeNull();
  if (!item) throw new Error('expected_customer_list_item');
  return item;
}

describe('客户中心 CustomerListItemV1 本地投影', () => {
  it('只输出稳定低敏展示与排序白名单字段', () => {
    const item = requireListItem();

    expect(item).toEqual({
      contractVersion: 'v1',
      customer: {
        contractVersion: 'v1',
        customerId: 'customer_alpha',
        displayName: '客户甲',
        maskedReference: '档案****0421',
      },
      lifecycle: 'scheduled',
      priority: 'high',
      owner: { userId: 'member_alpha', displayName: '顾问甲' },
      primaryProject: { projectId: 'project_alpha', displayName: '项目甲' },
      tags: [{ tagCode: 'tag_followup', displayName: '待跟进' }],
      lastTouchedAt: '2026-07-17T08:00:00.000Z',
      updatedAt: '2026-07-17T09:00:00.000Z',
    });
    expect(Object.keys(item)).toEqual([
      'contractVersion',
      'customer',
      'lifecycle',
      'priority',
      'owner',
      'primaryProject',
      'tags',
      'lastTouchedAt',
      'updatedAt',
    ]);
    expect(Object.keys(item.customer)).toEqual([
      'contractVersion',
      'customerId',
      'displayName',
      'maskedReference',
    ]);
  });

  it('复用五类 lifecycle、三类 priority，规范化可排序时间', () => {
    for (const lifecycle of CUSTOMER_LIFECYCLES) {
      expect(mapCustomerListItemV1({ ...createInput(), lifecycle }, policy)?.lifecycle).toBe(
        lifecycle,
      );
    }
    for (const priority of CUSTOMER_PRIORITIES) {
      expect(mapCustomerListItemV1({ ...createInput(), priority }, policy)?.priority).toBe(
        priority,
      );
    }

    expect(
      requireListItem({
        ...createInput(),
        lastTouchedAt: '2026-07-17T16:00:00+08:00',
      }).lastTouchedAt,
    ).toBe('2026-07-17T08:00:00.000Z');
  });

  it('输入不变，输出所有嵌套值均为新引用', () => {
    const source = createInput();
    const before = structuredClone(source);
    const first = requireListItem(source);
    const second = requireListItem(source);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(source).toEqual(before);
    expect(first.customer).not.toBe(source.customer);
    expect(first.owner).not.toBe(source.owner);
    expect(first.primaryProject).not.toBe(source.primaryProject);
    expect(first.tags).not.toBe(source.tags);
    expect(first.tags[0]).not.toBe(source.tags[0]);

    source.customer.displayName = '客户乙';
    source.tags[0].displayName = '标签已变更';
    expect(first.customer.displayName).toBe('客户甲');
    expect(first.tags[0]?.displayName).toBe('待跟进');
  });
});
