import { describe, expect, it } from 'vitest';

import {
  resolveCustomerCreationSelection,
  type CustomerCreationSelectionFacts,
} from '@/modules/customer-center/domain/customer-creation-selection';
import { resolveCustomerProjectSelection } from '@/modules/customer-center/domain/customer-project-selection';

function createCatalog() {
  return new Map([
    ['project_alpha', { projectId: 'project_alpha', displayName: '项目甲' }],
    ['project_beta', { projectId: 'project_beta', displayName: '项目乙' }],
  ]);
}

function createFacts(): CustomerCreationSelectionFacts {
  return {
    stableReference: { sourceCode: 'source_referral', maskedReference: '档案****0421' },
    approvedMemberIds: new Set(['member_alpha']),
    requiredOwnerUserId: null,
    approvedSourceCodes: new Set(['source_referral']),
    projectCatalog: createCatalog(),
  };
}

const policy = {
  isApprovedDisplayName: (value: string) => value === '客户甲',
  isApprovedMaskedReference: (value: string) => value === '档案****0421',
};

function createInput(selectedProjectIds: readonly string[], primaryProjectId: string | null) {
  return {
    displayName: '客户甲',
    ownerUserId: 'member_alpha',
    sourceCode: 'source_referral',
    selectedProjectIds,
    primaryProjectId,
  };
}

describe('客户创建候选与 A2 项目选择兼容', () => {
  it('保留 A2 的项目顺序和主项目位置，但不泄漏项目 ID', () => {
    const projectInput = {
      selectedProjectIds: ['project_beta', 'project_alpha'],
      primaryProjectId: 'project_alpha',
    } as const;
    const catalog = createCatalog();
    const projectSelection = resolveCustomerProjectSelection(projectInput, catalog);
    const candidate = resolveCustomerCreationSelection(
      createInput(projectInput.selectedProjectIds, projectInput.primaryProjectId),
      { ...createFacts(), projectCatalog: catalog },
      policy,
    );

    expect(projectSelection.ok).toBe(true);
    expect(candidate).toEqual({
      kind: 'non_authorizing_candidate',
      candidate: expect.objectContaining({
        projectDisplayNames: ['项目乙', '项目甲'],
        primaryProjectIndex: 1,
      }),
    });
    expect(JSON.stringify(candidate)).not.toContain('project_alpha');
    expect(JSON.stringify(candidate)).not.toContain('project_beta');
  });

  it('A2 可接受空项目，但创建候选始终整组 blocked', () => {
    const catalog = createCatalog();
    expect(resolveCustomerProjectSelection({ selectedProjectIds: [], primaryProjectId: null }, catalog)).toEqual({
      ok: true,
      value: { projects: [], primaryProject: null },
    });
    expect(
      resolveCustomerCreationSelection(createInput([], null), { ...createFacts(), projectCatalog: catalog }, policy),
    ).toEqual({ kind: 'blocked', code: 'invalid_customer_creation_selection' });
  });

  it.each([
    { selectedProjectIds: ['project_alpha', 'project_alpha'], primaryProjectId: 'project_alpha' },
    { selectedProjectIds: ['project_unknown'], primaryProjectId: 'project_unknown' },
    { selectedProjectIds: ['project/alpha'], primaryProjectId: 'project/alpha' },
  ])('carries no candidate when A2 rejects %o', (projectInput) => {
    const result = resolveCustomerCreationSelection(
      createInput(projectInput.selectedProjectIds, projectInput.primaryProjectId),
      createFacts(),
      policy,
    );
    expect(result).toEqual({ kind: 'blocked', code: 'invalid_customer_creation_selection' });
    expect(result).not.toHaveProperty('candidate');
  });
});
