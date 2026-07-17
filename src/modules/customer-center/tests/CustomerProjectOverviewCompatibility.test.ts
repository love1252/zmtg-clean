import { describe, expect, it } from 'vitest';
import {
  mapCustomerOverviewV1,
  type CustomerOverviewProjectionInput,
  type CustomerOverviewProjectionPolicy,
} from '@/modules/customer-center/domain/customer-overview';
import { resolveCustomerProjectSelection } from '@/modules/customer-center/domain/customer-project-selection';

const overviewPolicy: CustomerOverviewProjectionPolicy = {
  allowedLifecycleBasisCodes: new Set(['basis_controlled']),
  allowedLifecycleBasisSourceKinds: new Set(['source_controlled']),
  isTrustedCustomerId: (customerId) => customerId === 'customer_alpha',
  isApprovedDisplayName: (displayName) => displayName === '客户甲',
  isApprovedMaskedReference: (maskedReference) => maskedReference === '档案****0421',
  isApprovedOwner: () => false,
  isApprovedProject: (projectId, displayName) =>
    (projectId === 'project_alpha' && displayName === '项目甲') ||
    (projectId === 'project_beta' && displayName === '项目乙'),
  isApprovedTag: () => false,
  isTrustedLifecycleBasisSourceId: () => false,
};

function createOverviewInput(
  projectSelection: Pick<CustomerOverviewProjectionInput, 'projects' | 'primaryProject'>,
): CustomerOverviewProjectionInput {
  return {
    customer: {
      customerId: 'customer_alpha',
      displayName: '客户甲',
      maskedReference: '档案****0421',
    },
    lifecycle: 'scheduled',
    priority: 'high',
    owner: null,
    ...projectSelection,
    tags: [],
    lifecycleBasis: null,
    updatedAt: '2026-07-17T08:30:00.000Z',
  };
}

describe('客户项目选择与 A1 overview 兼容', () => {
  it('成功选择可直接组成 overview 输入，主项目仍属于项目集合', () => {
    const selection = resolveCustomerProjectSelection(
      {
        selectedProjectIds: ['project_beta', 'project_alpha'],
        primaryProjectId: 'project_alpha',
      },
      new Map([
        ['project_alpha', { projectId: 'project_alpha', displayName: '项目甲' }],
        ['project_beta', { projectId: 'project_beta', displayName: '项目乙' }],
      ]),
    );
    expect(selection.ok).toBe(true);
    if (!selection.ok) throw new Error('expected_valid_project_selection');

    const overview = mapCustomerOverviewV1(
      createOverviewInput(selection.value),
      overviewPolicy,
    );

    expect(overview?.projects).toEqual([
      { projectId: 'project_beta', displayName: '项目乙' },
      { projectId: 'project_alpha', displayName: '项目甲' },
    ]);
    expect(overview?.primaryProject).toEqual({
      projectId: 'project_alpha',
      displayName: '项目甲',
    });
    expect(overview?.projects).toContainEqual(overview?.primaryProject);
  });

  it('空选择保持 overview 的空项目与空主项目语义', () => {
    const selection = resolveCustomerProjectSelection(
      { selectedProjectIds: [], primaryProjectId: null },
      new Map(),
    );
    expect(selection.ok).toBe(true);
    if (!selection.ok) throw new Error('expected_empty_project_selection');

    const overview = mapCustomerOverviewV1(
      createOverviewInput(selection.value),
      overviewPolicy,
    );

    expect(overview?.projects).toEqual([]);
    expect(overview?.primaryProject).toBeNull();
  });

  it('无效选择没有可供 A1 overview 消费的部分项目结果', () => {
    const rejectedMarker = 'project_rejected_marker';
    const selection = resolveCustomerProjectSelection(
      {
        selectedProjectIds: ['project_alpha', rejectedMarker],
        primaryProjectId: 'project_alpha',
      },
      new Map([['project_alpha', { projectId: 'project_alpha', displayName: '项目甲' }]]),
    );

    expect(selection).toEqual({
      ok: false,
      code: 'invalid_customer_project_selection',
    });
    expect(JSON.stringify(selection)).not.toContain(rejectedMarker);
    expect(selection).not.toHaveProperty('value');
  });

  it('A1 会拒绝的非规范项目 ID 在选择阶段即整组失败', () => {
    const incompatibleProjectId = 'project/alpha';
    const selection = resolveCustomerProjectSelection(
      {
        selectedProjectIds: [incompatibleProjectId],
        primaryProjectId: incompatibleProjectId,
      },
      new Map([
        [
          incompatibleProjectId,
          { projectId: incompatibleProjectId, displayName: '项目甲' },
        ],
      ]),
    );

    expect(selection).toEqual({
      ok: false,
      code: 'invalid_customer_project_selection',
    });
    expect(selection).not.toHaveProperty('value');
  });
});
