import { describe, expect, it, vi } from 'vitest';

import {
  customerCreationOwnerRequirements,
  resolveCustomerCreationSelection,
  type CustomerCreationSelectionFacts,
  type CustomerCreationSelectionPolicy,
} from '@/modules/customer-center/domain/customer-creation-selection';

function createCatalog() {
  return new Map([
    ['project_alpha', { projectId: 'project_alpha', displayName: '项目甲' }],
    ['project_beta', { projectId: 'project_beta', displayName: '项目乙' }],
    ['project_gamma', { projectId: 'project_gamma', displayName: '项目丙' }],
  ]);
}

function createFacts(
  overrides: Partial<CustomerCreationSelectionFacts> = {},
): CustomerCreationSelectionFacts {
  return {
    stableReference: {
      sourceCode: 'source_referral',
      maskedReference: '档案****0421',
    },
    approvedMemberIds: new Set(['member_alpha', 'member_beta']),
    requiredOwnerUserId: null,
    approvedSourceCodes: new Set(['source_referral', 'source_walk_in']),
    projectCatalog: createCatalog(),
    ...overrides,
  };
}

const policy: CustomerCreationSelectionPolicy = {
  isApprovedDisplayName: (value) => value === '客户甲',
  isApprovedMaskedReference: (value) => value === '档案****0421',
};

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    displayName: '客户甲',
    ownerUserId: 'member_alpha',
    sourceCode: 'source_referral',
    selectedProjectIds: ['project_alpha'],
    primaryProjectId: 'project_alpha',
    ...overrides,
  };
}

function expectBlocked(
  input: unknown,
  facts: CustomerCreationSelectionFacts = createFacts(),
  selectionPolicy: CustomerCreationSelectionPolicy = policy,
) {
  expect(resolveCustomerCreationSelection(input, facts, selectionPolicy)).toEqual({
    kind: 'blocked',
    code: 'invalid_customer_creation_selection',
  });
}

describe('客户创建候选选择边界', () => {
  it('只返回冻结的 non-authorizing 低敏候选和固定 owner requirements', () => {
    const result = resolveCustomerCreationSelection(createInput(), createFacts(), policy);

    expect(result).toEqual({
      kind: 'non_authorizing_candidate',
      candidate: {
        displayName: '客户甲',
        maskedReference: '档案****0421',
        projectDisplayNames: ['项目甲'],
        primaryProjectIndex: 0,
        ownerRequirements: customerCreationOwnerRequirements,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind !== 'non_authorizing_candidate') throw new Error('expected_candidate');

    expect(Object.isFrozen(result.candidate)).toBe(true);
    expect(Object.isFrozen(result.candidate.projectDisplayNames)).toBe(true);
    expect(Object.keys(result.candidate).sort()).toEqual([
      'displayName',
      'maskedReference',
      'ownerRequirements',
      'primaryProjectIndex',
      'projectDisplayNames',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /customerId|ownerUserId|sourceCode|projectId|authorized|created|stableReference/i,
    );
  });

  it('保持项目输入顺序，并以 index 表达显式主项目关系', () => {
    const result = resolveCustomerCreationSelection(
      createInput({
        selectedProjectIds: ['project_gamma', 'project_alpha', 'project_beta'],
        primaryProjectId: 'project_beta',
      }),
      createFacts({ requiredOwnerUserId: 'member_alpha' }),
      policy,
    );

    expect(result).toEqual({
      kind: 'non_authorizing_candidate',
      candidate: expect.objectContaining({
        projectDisplayNames: ['项目丙', '项目甲', '项目乙'],
        primaryProjectIndex: 2,
      }),
    });
  });

  it.each([
    ['unapproved owner', createInput({ ownerUserId: 'member_unknown' })],
    ['required owner mismatch', createInput({ ownerUserId: 'member_beta' })],
    ['source mismatch', createInput({ sourceCode: 'source_walk_in' })],
    ['unknown source', createInput({ sourceCode: 'source_unknown' })],
    ['empty projects', createInput({ selectedProjectIds: [], primaryProjectId: null })],
    ['duplicate project', createInput({ selectedProjectIds: ['project_alpha', 'project_alpha'] })],
    ['unknown project', createInput({ selectedProjectIds: ['project_unknown'], primaryProjectId: 'project_unknown' })],
    ['non-canonical project', createInput({ selectedProjectIds: ['project/alpha'], primaryProjectId: 'project/alpha' })],
    ['oversized owner', createInput({ ownerUserId: `member_${'x'.repeat(128)}` })],
    ['sensitive display name', createInput({ displayName: 'https://unsafe.invalid' })],
  ])('blocks %s without a partial candidate', (_name, input) => {
    expectBlocked(
      input,
      _name === 'required owner mismatch'
        ? createFacts({ requiredOwnerUserId: 'member_alpha' })
        : createFacts(),
    );
  });

  it('fails closed for null-prototype, hidden, extra, symbol, accessor, and Proxy records', () => {
    const nullPrototype = Object.assign(Object.create(null), createInput());
    const hidden = createInput();
    Object.defineProperty(hidden, 'hidden', { value: 'ignored', enumerable: false });
    const extra = { ...createInput(), extra: 'ignored' };
    const symbol = Object.assign(createInput(), { [Symbol('extra')]: 'ignored' });
    const accessor = createInput();
    const getter = vi.fn(() => '客户甲');
    Object.defineProperty(accessor, 'displayName', { enumerable: true, get: getter });
    const proxy = new Proxy(createInput(), {});

    for (const input of [nullPrototype, hidden, extra, symbol, accessor, proxy]) {
      expectBlocked(input);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it('fails closed for sparse, accessor, Proxy, symbol, and oversized project selections', () => {
    const sparse = new Array<string>(1);
    const accessor = ['project_alpha'];
    const accessorGetter = vi.fn(() => 'project_alpha');
    Object.defineProperty(accessor, '0', { enumerable: true, get: accessorGetter });
    const symbol = Object.assign(['project_alpha'], { [Symbol('extra')]: 'ignored' });
    const oversized = Array.from({ length: 33 }, (_value, index) => `project_${index}`);

    for (const selectedProjectIds of [
      sparse,
      accessor,
      new Proxy(['project_alpha'], {}),
      symbol,
      oversized,
    ]) {
      expectBlocked(createInput({ selectedProjectIds }));
    }
    expect(accessorGetter).not.toHaveBeenCalled();
  });

  it('fails closed for malformed, extra, Proxy, or oversized authoritative facts', () => {
    const nullFacts = Object.assign(Object.create(null), createFacts()) as CustomerCreationSelectionFacts;
    const hiddenFacts = createFacts();
    Object.defineProperty(hiddenFacts, 'hidden', { value: 'ignored', enumerable: false });
    const stableAccessor = { sourceCode: 'source_referral' } as CustomerCreationSelectionFacts['stableReference'];
    const stableGetter = vi.fn(() => '档案****0421');
    Object.defineProperty(stableAccessor, 'maskedReference', { enumerable: true, get: stableGetter });
    const oversizedMembers = new Set(
      Array.from({ length: 513 }, (_value, index) => `member_${index}`),
    );
    const oversizedSources = new Set(
      Array.from({ length: 129 }, (_value, index) => `source_${index}`),
    );
    const oversizedCatalog = new Map(
      Array.from({ length: 257 }, (_value, index) => [
        `project_${index}`,
        { projectId: `project_${index}`, displayName: '项目甲' },
      ]),
    );

    for (const facts of [
      nullFacts,
      hiddenFacts,
      createFacts({ stableReference: stableAccessor }),
      createFacts({ approvedMemberIds: new Proxy(new Set(['member_alpha']), {}) }),
      createFacts({ approvedSourceCodes: oversizedSources }),
      createFacts({ approvedMemberIds: oversizedMembers }),
      createFacts({ projectCatalog: oversizedCatalog }),
      new Proxy(createFacts(), {}),
    ] as CustomerCreationSelectionFacts[]) {
      expectBlocked(createInput(), facts);
    }
    expect(stableGetter).not.toHaveBeenCalled();
  });

  it('fails closed when policies are malformed, proxied, accessor-backed, or throw', () => {
    const policyAccessor = {} as CustomerCreationSelectionPolicy;
    const policyGetter = vi.fn(() => policy.isApprovedDisplayName);
    Object.defineProperty(policyAccessor, 'isApprovedDisplayName', {
      enumerable: true,
      get: policyGetter,
    });
    Object.defineProperty(policyAccessor, 'isApprovedMaskedReference', {
      enumerable: true,
      value: policy.isApprovedMaskedReference,
    });

    for (const selectionPolicy of [
      policyAccessor,
      new Proxy(policy, {}),
      {
        isApprovedDisplayName: () => {
          throw new Error('policy-failure');
        },
        isApprovedMaskedReference: policy.isApprovedMaskedReference,
      },
      {
        isApprovedDisplayName: policy.isApprovedDisplayName,
        isApprovedMaskedReference: () => {
          throw new Error('policy-failure');
        },
      },
    ] as CustomerCreationSelectionPolicy[]) {
      expectBlocked(createInput(), createFacts(), selectionPolicy);
    }
    expect(policyGetter).not.toHaveBeenCalled();
  });

  it('does not mutate input or facts, and candidate remains stable after later mutations', () => {
    const input = createInput({ selectedProjectIds: ['project_beta', 'project_alpha'], primaryProjectId: 'project_alpha' });
    const stableReference = { sourceCode: 'source_referral', maskedReference: '档案****0421' };
    const projectAlpha = { projectId: 'project_alpha', displayName: '项目甲' };
    const facts = createFacts({
      stableReference,
      projectCatalog: new Map([
        ['project_alpha', projectAlpha],
        ['project_beta', { projectId: 'project_beta', displayName: '项目乙' }],
      ]),
    });
    const inputBefore = structuredClone(input);
    const result = resolveCustomerCreationSelection(input, facts, policy);

    expect(result.kind).toBe('non_authorizing_candidate');
    expect(input).toEqual(inputBefore);
    if (result.kind !== 'non_authorizing_candidate') throw new Error('expected_candidate');

    stableReference.maskedReference = '档案****9999';
    projectAlpha.displayName = '项目变化';
    expect(result.candidate).toMatchObject({
      maskedReference: '档案****0421',
      projectDisplayNames: ['项目乙', '项目甲'],
      primaryProjectIndex: 1,
    });
  });
});
