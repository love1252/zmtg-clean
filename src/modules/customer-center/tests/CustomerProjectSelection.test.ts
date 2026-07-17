import { describe, expect, it } from 'vitest';
import {
  resolveCustomerProjectSelection,
  type CustomerProjectCatalog,
} from '@/modules/customer-center/domain/customer-project-selection';

function createCatalog() {
  return new Map([
    [
      'project_alpha',
      {
        projectId: 'project_alpha',
        displayName: '项目甲',
      },
    ],
    [
      'project_beta',
      {
        projectId: 'project_beta',
        displayName: '项目乙',
      },
    ],
    [
      'project_gamma',
      {
        projectId: 'project_gamma',
        displayName: '项目丙',
      },
    ],
  ] satisfies Array<[string, { projectId: string; displayName: string }]>);
}

function expectInvalid(input: unknown, catalog: CustomerProjectCatalog = createCatalog()) {
  expect(resolveCustomerProjectSelection(input, catalog)).toEqual({
    ok: false,
    code: 'invalid_customer_project_selection',
  });
}

describe('客户中心受控项目选择', () => {
  it('允许空选择，并精确输出空项目关系', () => {
    expect(
      resolveCustomerProjectSelection(
        { selectedProjectIds: [], primaryProjectId: null },
        createCatalog(),
      ),
    ).toEqual({
      ok: true,
      value: {
        projects: [],
        primaryProject: null,
      },
    });
  });

  it('解析单项目和多项目，保留输入顺序且不默认首项为主项目', () => {
    expect(
      resolveCustomerProjectSelection(
        {
          selectedProjectIds: ['project_alpha'],
          primaryProjectId: 'project_alpha',
        },
        createCatalog(),
      ),
    ).toEqual({
      ok: true,
      value: {
        projects: [{ projectId: 'project_alpha', displayName: '项目甲' }],
        primaryProject: { projectId: 'project_alpha', displayName: '项目甲' },
      },
    });

    expect(
      resolveCustomerProjectSelection(
        {
          selectedProjectIds: ['project_gamma', 'project_alpha', 'project_beta'],
          primaryProjectId: 'project_beta',
        },
        createCatalog(),
      ),
    ).toEqual({
      ok: true,
      value: {
        projects: [
          { projectId: 'project_gamma', displayName: '项目丙' },
          { projectId: 'project_alpha', displayName: '项目甲' },
          { projectId: 'project_beta', displayName: '项目乙' },
        ],
        primaryProject: { projectId: 'project_beta', displayName: '项目乙' },
      },
    });
  });

  it('拒绝非精确输入、客户端展示名和 legacy 自由文本', () => {
    for (const input of [
      null,
      [],
      {},
      { selectedProjectIds: [] },
      { primaryProjectId: null },
      { selectedProjectIds: 'project_alpha', primaryProjectId: 'project_alpha' },
      { selectedProjectIds: [], primaryProjectId: 1 },
      {
        selectedProjectIds: [],
        primaryProjectId: null,
        projectInterest: 'legacy_placeholder',
      },
      {
        selectedProjectIds: [{ projectId: 'project_alpha', displayName: '项目甲' }],
        primaryProjectId: 'project_alpha',
      },
    ]) {
      expectInvalid(input);
    }

    const withSymbol = {
      selectedProjectIds: [],
      primaryProjectId: null,
      [Symbol('unexpected')]: true,
    };
    expectInvalid(withSymbol);
  });

  it('重复、未批准、空白或带首尾空白的项目 ID 使整组失败', () => {
    for (const selectedProjectIds of [
      ['project_alpha', 'project_alpha'],
      ['project_unknown'],
      [''],
      [' project_alpha'],
      ['project_alpha '],
      [1],
    ]) {
      expectInvalid({ selectedProjectIds, primaryProjectId: selectedProjectIds[0] ?? null });
    }
  });

  it('即使目录含记录，也拒绝不符合 A1 规范化规则的项目 ID', () => {
    for (const projectId of [
      'project alpha',
      'project/alpha',
      '项目甲',
      '_project_alpha',
      'https://example.invalid/project',
    ]) {
      const catalog = new Map([[projectId, { projectId, displayName: '项目甲' }]]);
      expectInvalid({ selectedProjectIds: [projectId], primaryProjectId: projectId }, catalog);
    }
  });

  it('非空选择必须有且只能引用集合内的主项目', () => {
    expectInvalid({ selectedProjectIds: ['project_alpha'], primaryProjectId: null });
    expectInvalid({
      selectedProjectIds: ['project_alpha'],
      primaryProjectId: 'project_beta',
    });
    expectInvalid({ selectedProjectIds: [], primaryProjectId: 'project_alpha' });
    expectInvalid({ selectedProjectIds: ['project_alpha'], primaryProjectId: ' project_alpha' });
  });

  it('目录键值冲突、空名称或非低敏名称使整组失败', () => {
    const mismatchedCatalog = new Map([
      ['project_alpha', { projectId: 'project_beta', displayName: '项目甲' }],
    ]);
    expectInvalid(
      { selectedProjectIds: ['project_alpha'], primaryProjectId: 'project_alpha' },
      mismatchedCatalog,
    );

    for (const displayName of ['', '   ', 'https://example.invalid/project', 'token placeholder']) {
      const catalog = new Map([
        ['project_alpha', { projectId: 'project_alpha', displayName }],
      ]);
      expectInvalid(
        { selectedProjectIds: ['project_alpha'], primaryProjectId: 'project_alpha' },
        catalog,
      );
    }
  });

  it('目录异常固定 fail-closed，失败结果不回显输入', () => {
    const rejectedMarker = 'project_rejected_marker';
    const throwingCatalog = {
      get() {
        throw new Error(rejectedMarker);
      },
    } as unknown as CustomerProjectCatalog;

    const result = resolveCustomerProjectSelection(
      {
        selectedProjectIds: ['project_alpha'],
        primaryProjectId: 'project_alpha',
      },
      throwingCatalog,
    );

    expect(result).toEqual({ ok: false, code: 'invalid_customer_project_selection' });
    expect(JSON.stringify(result)).not.toContain(rejectedMarker);
  });

  it('只输出规范项目字段，目录额外字段不会泄露', () => {
    const extraMarker = 'catalog_metadata_placeholder';
    const catalog = new Map([
      [
        'project_alpha',
        {
          projectId: 'project_alpha',
          displayName: '项目甲',
          internalMetadata: extraMarker,
        },
      ],
    ]);

    const result = resolveCustomerProjectSelection(
      {
        selectedProjectIds: ['project_alpha'],
        primaryProjectId: 'project_alpha',
      },
      catalog,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        projects: [{ projectId: 'project_alpha', displayName: '项目甲' }],
        primaryProject: { projectId: 'project_alpha', displayName: '项目甲' },
      },
    });
    expect(JSON.stringify(result)).not.toContain(extraMarker);
  });

  it('结果确定、输入与目录不变，项目和主项目均为新引用', () => {
    const input = {
      selectedProjectIds: ['project_beta', 'project_alpha'],
      primaryProjectId: 'project_alpha',
    } as const;
    const catalog = createCatalog();
    const inputBefore = structuredClone(input);
    const catalogBefore = structuredClone([...catalog.entries()]);

    const first = resolveCustomerProjectSelection(input, catalog);
    const second = resolveCustomerProjectSelection(input, catalog);

    expect(first).toEqual(second);
    expect(input).toEqual(inputBefore);
    expect([...catalog.entries()]).toEqual(catalogBefore);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('expected_valid_project_selection');

    expect(first).not.toBe(second);
    expect(first.value).not.toBe(second.value);
    expect(first.value.projects).not.toBe(second.value.projects);
    for (const selection of [first.value, second.value]) {
      for (const project of selection.projects) {
        expect(project).not.toBe(catalog.get(project.projectId));
      }
    }
    for (const [index, project] of first.value.projects.entries()) {
      expect(project).not.toBe(second.value.projects[index]);
    }
    expect(first.value.primaryProject).not.toBe(catalog.get('project_alpha'));
    expect(second.value.primaryProject).not.toBe(catalog.get('project_alpha'));
    expect(first.value.primaryProject).not.toBe(second.value.primaryProject);
    expect(first.value.primaryProject).not.toBe(first.value.projects[1]);
    expect(second.value.primaryProject).not.toBe(second.value.projects[1]);
  });
});
