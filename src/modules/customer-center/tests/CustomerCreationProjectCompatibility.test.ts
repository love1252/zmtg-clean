import { describe, expect, it } from 'vitest';
import {
  resolveCustomerCreationSelection,
  type CustomerCreationSelectionFacts,
} from '@/modules/customer-center/domain/customer-creation-selection';
import { resolveCustomerProjectSelection } from '@/modules/customer-center/domain/customer-project-selection';

function createProjectCatalog() {
  return new Map([
    ['project_alpha', { projectId: 'project_alpha', displayName: '项目甲' }],
    ['project_beta', { projectId: 'project_beta', displayName: '项目乙' }],
  ]);
}

function createFacts(): CustomerCreationSelectionFacts {
  return {
    stableReference: {
      sourceCode: 'source_referral',
      maskedReference: '档案****0421',
    },
    approvedMemberIds: new Set(['member_alpha']),
    requiredOwnerUserId: null,
    approvedSourceCodes: new Set(['source_referral']),
    projectCatalog: createProjectCatalog(),
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

describe('客户创建选择与 A2 项目选择兼容', () => {
  it('复用 A2 的项目顺序与显式主项目结果', () => {
    const projectInput = {
      selectedProjectIds: ['project_beta', 'project_alpha'],
      primaryProjectId: 'project_alpha',
    } as const;
    const catalog = createProjectCatalog();
    const projectSelection = resolveCustomerProjectSelection(projectInput, catalog);
    const creationSelection = resolveCustomerCreationSelection(
      createInput(projectInput.selectedProjectIds, projectInput.primaryProjectId),
      { ...createFacts(), projectCatalog: catalog },
      policy,
    );

    expect(projectSelection.ok).toBe(true);
    expect(creationSelection.ok).toBe(true);
    if (!projectSelection.ok || !creationSelection.ok) {
      throw new Error('expected_compatible_project_selection');
    }

    expect(creationSelection.value.projects).toEqual(projectSelection.value.projects);
    expect(creationSelection.value.primaryProject).toEqual(
      projectSelection.value.primaryProject,
    );
  });

  it('A2 项目选择可接受空项目，但创建 pre-draft 必须整组拒绝', () => {
    const catalog = createProjectCatalog();
    const projectSelection = resolveCustomerProjectSelection(
      { selectedProjectIds: [], primaryProjectId: null },
      catalog,
    );
    const creationSelection = resolveCustomerCreationSelection(
      createInput([], null),
      { ...createFacts(), projectCatalog: catalog },
      policy,
    );

    expect(projectSelection).toEqual({
      ok: true,
      value: { projects: [], primaryProject: null },
    });
    expect(creationSelection).toEqual({
      ok: false,
      code: 'invalid_customer_creation_selection',
    });
  });

  it('A2 拒绝的重复、未知和不规范项目不会产生部分创建结果', () => {
    for (const projectInput of [
      {
        selectedProjectIds: ['project_alpha', 'project_alpha'],
        primaryProjectId: 'project_alpha',
      },
      {
        selectedProjectIds: ['project_unknown'],
        primaryProjectId: 'project_unknown',
      },
      {
        selectedProjectIds: ['project/alpha'],
        primaryProjectId: 'project/alpha',
      },
    ]) {
      const result = resolveCustomerCreationSelection(
        createInput(projectInput.selectedProjectIds, projectInput.primaryProjectId),
        createFacts(),
        policy,
      );
      expect(result).toEqual({
        ok: false,
        code: 'invalid_customer_creation_selection',
      });
      expect(result).not.toHaveProperty('value');
    }
  });

  it('创建守卫复制 A2 结果，不共享项目或主项目引用', () => {
    const catalog = createProjectCatalog();
    const projectInput = {
      selectedProjectIds: ['project_beta', 'project_alpha'],
      primaryProjectId: 'project_alpha',
    } as const;
    const projectSelection = resolveCustomerProjectSelection(projectInput, catalog);
    const creationSelection = resolveCustomerCreationSelection(
      createInput(projectInput.selectedProjectIds, projectInput.primaryProjectId),
      { ...createFacts(), projectCatalog: catalog },
      policy,
    );

    expect(projectSelection.ok).toBe(true);
    expect(creationSelection.ok).toBe(true);
    if (!projectSelection.ok || !creationSelection.ok) {
      throw new Error('expected_compatible_project_selection');
    }

    expect(creationSelection.value.projects).not.toBe(projectSelection.value.projects);
    expect(creationSelection.value.primaryProject).not.toBe(
      projectSelection.value.primaryProject,
    );
    for (const [index, project] of creationSelection.value.projects.entries()) {
      expect(project).not.toBe(projectSelection.value.projects[index]);
    }
  });
});
