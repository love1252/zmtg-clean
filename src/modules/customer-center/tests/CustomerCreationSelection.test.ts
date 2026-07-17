import { describe, expect, it, vi } from 'vitest';
import {
  resolveCustomerCreationSelection,
  type CustomerCreationSelectionFacts,
  type CustomerCreationSelectionPolicy,
} from '@/modules/customer-center/domain/customer-creation-selection';

function createProjectCatalog() {
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
    projectCatalog: createProjectCatalog(),
    ...overrides,
  };
}

const policy: CustomerCreationSelectionPolicy = {
  isApprovedDisplayName: (value) => value === '客户甲',
  isApprovedMaskedReference: (value) => value === '档案****0421',
};

function createInput() {
  return {
    displayName: '客户甲',
    ownerUserId: 'member_alpha',
    sourceCode: 'source_referral',
    selectedProjectIds: ['project_alpha'],
    primaryProjectId: 'project_alpha',
  };
}

function expectInvalid(
  input: unknown,
  facts: CustomerCreationSelectionFacts = createFacts(),
  selectionPolicy: CustomerCreationSelectionPolicy = policy,
) {
  expect(resolveCustomerCreationSelection(input, facts, selectionPolicy)).toEqual({
    ok: false,
    code: 'invalid_customer_creation_selection',
  });
}

describe('客户手工创建 pre-draft 选择组合守卫', () => {
  it('组合服务端稳定引用、成员、来源和单项目事实', () => {
    expect(resolveCustomerCreationSelection(createInput(), createFacts(), policy)).toEqual({
      ok: true,
      value: {
        displayName: '客户甲',
        stableReference: {
          sourceCode: 'source_referral',
          maskedReference: '档案****0421',
        },
        ownerUserId: 'member_alpha',
        sourceCode: 'source_referral',
        projects: [{ projectId: 'project_alpha', displayName: '项目甲' }],
        primaryProject: { projectId: 'project_alpha', displayName: '项目甲' },
      },
    });
  });

  it('保留多项目输入顺序，并只接受显式指定的集合内主项目', () => {
    const result = resolveCustomerCreationSelection(
      {
        ...createInput(),
        selectedProjectIds: ['project_gamma', 'project_alpha', 'project_beta'],
        primaryProjectId: 'project_beta',
      },
      createFacts({ requiredOwnerUserId: 'member_alpha' }),
      policy,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        displayName: '客户甲',
        stableReference: {
          sourceCode: 'source_referral',
          maskedReference: '档案****0421',
        },
        ownerUserId: 'member_alpha',
        sourceCode: 'source_referral',
        projects: [
          { projectId: 'project_gamma', displayName: '项目丙' },
          { projectId: 'project_alpha', displayName: '项目甲' },
          { projectId: 'project_beta', displayName: '项目乙' },
        ],
        primaryProject: { projectId: 'project_beta', displayName: '项目乙' },
      },
    });
  });

  it('只接受五字段草稿输入，拒绝引用、外部标识和 legacy 字段混入', () => {
    for (const input of [
      null,
      [],
      {},
      { ...createInput(), maskedReference: '档案****0421' },
      { ...createInput(), externalCustomerRef: 'source-reference-placeholder' },
      { ...createInput(), lifecycle: 'consulting' },
      { ...createInput(), priority: 'high' },
      { ...createInput(), projectInterest: 'legacy-placeholder' },
      { ...createInput(), referralSource: 'legacy-placeholder' },
      { ...createInput(), nextAction: 'legacy-placeholder' },
      { ...createInput(), notes: 'legacy-placeholder' },
    ]) {
      expectInvalid(input);
    }

    expectInvalid({ ...createInput(), [Symbol('unexpected')]: true });
  });

  it('缺失字段、错误类型、非枚举额外键和自定义原型均整组失败', () => {
    for (const key of Object.keys(createInput())) {
      const missingField: Record<string, unknown> = { ...createInput() };
      delete missingField[key];
      expectInvalid(missingField);
    }

    for (const input of [
      { ...createInput(), displayName: 1 },
      { ...createInput(), ownerUserId: null },
      { ...createInput(), sourceCode: [] },
      { ...createInput(), selectedProjectIds: [1] },
      { ...createInput(), primaryProjectId: null },
    ]) {
      expectInvalid(input);
    }

    const nonEnumerableExtra = createInput();
    Object.defineProperty(nonEnumerableExtra, 'unexpected', {
      value: true,
      enumerable: false,
    });
    expectInvalid(nonEnumerableExtra);

    const customPrototype = Object.assign(
      Object.create({ inheritedMarker: true }) as Record<string, unknown>,
      createInput(),
    );
    expectInvalid(customPrototype);
  });

  it('负责人必须来自已批准成员事实，并服从调用方注入的 HIS 唯一负责人', () => {
    expectInvalid({ ...createInput(), ownerUserId: 'member_unknown' });
    expectInvalid(
      createInput(),
      createFacts({ requiredOwnerUserId: 'member_beta' }),
    );
    expectInvalid(
      createInput(),
      createFacts({ requiredOwnerUserId: 'member_unknown' }),
    );
    expectInvalid(
      createInput(),
      createFacts({ requiredOwnerUserId: ' member_alpha' }),
    );

    expect(
      resolveCustomerCreationSelection(
        createInput(),
        createFacts({ requiredOwnerUserId: 'member_alpha' }),
        policy,
      ),
    ).toMatchObject({ ok: true, value: { ownerUserId: 'member_alpha' } });
  });

  it('来源必须来自受控事实，并与服务端稳定引用来源一致', () => {
    expectInvalid({ ...createInput(), sourceCode: 'source_unknown' });
    expectInvalid(
      createInput(),
      createFacts({
        stableReference: {
          sourceCode: 'source_walk_in',
          maskedReference: '档案****0421',
        },
      }),
    );
    expectInvalid(
      createInput(),
      createFacts({ approvedSourceCodes: new Set(['source_walk_in']) }),
    );
  });

  it('创建草稿要求至少一个项目和非空主项目，任一项目异常都整组失败', () => {
    for (const input of [
      { ...createInput(), selectedProjectIds: [], primaryProjectId: null },
      { ...createInput(), selectedProjectIds: [], primaryProjectId: 'project_alpha' },
      {
        ...createInput(),
        selectedProjectIds: ['project_alpha', 'project_alpha'],
      },
      { ...createInput(), selectedProjectIds: ['project_unknown'] },
      { ...createInput(), primaryProjectId: 'project_beta' },
      { ...createInput(), selectedProjectIds: 'project_alpha' },
    ]) {
      expectInvalid(input);
    }
  });

  it('显示名和脱敏引用必须通过低敏检查及调用方批准', () => {
    const phonePattern = ['138', '0000', '0000'].join('');
    const identityPattern = `${'0'.repeat(17)}X`;
    const secretPattern = ['api', 'key', 'placeholder'].join('_');
    const externalAccountPattern = ['external', 'id', 'placeholder'].join('_');

    for (const displayName of [
      phonePattern,
      identityPattern,
      'https://example.invalid/customer',
      secretPattern,
      externalAccountPattern,
      '客户\u0000甲',
    ]) {
      expectInvalid({ ...createInput(), displayName });
    }

    for (const maskedReference of [
      '',
      phonePattern,
      identityPattern,
      'https://example.invalid/reference',
      secretPattern,
      externalAccountPattern,
    ]) {
      expectInvalid(
        createInput(),
        createFacts({
          stableReference: { sourceCode: 'source_referral', maskedReference },
        }),
      );
    }

    expectInvalid(createInput(), createFacts(), {
      ...policy,
      isApprovedDisplayName: () => false,
    });
    expectInvalid(createInput(), createFacts(), {
      ...policy,
      isApprovedMaskedReference: () => false,
    });
  });

  it('低敏文本先规范化再交给 policy，policy 必须精确返回 true', () => {
    const displayPolicy = vi.fn((value: string) => value === '客户甲');
    const referencePolicy = vi.fn((value: string) => value === '档案****0421');
    const result = resolveCustomerCreationSelection(
      { ...createInput(), displayName: '  客户甲  ' },
      createFacts({
        stableReference: {
          sourceCode: 'source_referral',
          maskedReference: '  档案****0421  ',
        },
      }),
      {
        isApprovedDisplayName: displayPolicy,
        isApprovedMaskedReference: referencePolicy,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        displayName: '客户甲',
        stableReference: { maskedReference: '档案****0421' },
      },
    });
    expect(displayPolicy).toHaveBeenCalledWith('客户甲');
    expect(referencePolicy).toHaveBeenCalledWith('档案****0421');

    expectInvalid(createInput(), createFacts(), {
      ...policy,
      isApprovedDisplayName: () => 'true' as unknown as boolean,
    });
  });

  it('facts、policy 和稳定引用同样要求精确数据字段', () => {
    const factsWithExtra = {
      ...createFacts(),
      internalMarker: 'facts-extra-placeholder',
    } as CustomerCreationSelectionFacts;
    expectInvalid(createInput(), factsWithExtra);

    const factsWithSymbol = {
      ...createFacts(),
      [Symbol('unexpected')]: true,
    } as CustomerCreationSelectionFacts;
    expectInvalid(createInput(), factsWithSymbol);

    const stableReferenceWithExtra = {
      sourceCode: 'source_referral',
      maskedReference: '档案****0421',
      rawReferenceMarker: 'reference-extra-placeholder',
    } as CustomerCreationSelectionFacts['stableReference'];
    const referenceResult = resolveCustomerCreationSelection(
      createInput(),
      createFacts({ stableReference: stableReferenceWithExtra }),
      policy,
    );
    expect(referenceResult).toEqual({
      ok: false,
      code: 'invalid_customer_creation_selection',
    });
    expect(JSON.stringify(referenceResult)).not.toContain('reference-extra-placeholder');

    const policyWithExtra = {
      ...policy,
      internalMarker: true,
    } as CustomerCreationSelectionPolicy;
    expectInvalid(createInput(), createFacts(), policyWithExtra);
  });

  it('getter、抛错 Proxy、集合、目录和 policy 异常均固定 fail-closed', () => {
    const getter = vi.fn(() => '客户甲');
    const accessorInput = createInput();
    Object.defineProperty(accessorInput, 'displayName', {
      enumerable: true,
      get: getter,
    });
    expectInvalid(accessorInput);
    expect(getter).not.toHaveBeenCalled();

    const referenceGetter = vi.fn(() => '档案****0421');
    const accessorReference = {
      sourceCode: 'source_referral',
    } as { sourceCode: string; maskedReference: string };
    Object.defineProperty(accessorReference, 'maskedReference', {
      enumerable: true,
      get: referenceGetter,
    });
    expectInvalid(
      createInput(),
      createFacts({ stableReference: accessorReference }),
    );
    expect(referenceGetter).not.toHaveBeenCalled();

    const projectGetter = vi.fn(() => 'project_alpha');
    const accessorProjects = ['project_alpha'];
    Object.defineProperty(accessorProjects, 0, {
      enumerable: true,
      get: projectGetter,
    });
    expectInvalid({ ...createInput(), selectedProjectIds: accessorProjects });
    expect(projectGetter).not.toHaveBeenCalled();

    const throwingInput = new Proxy(createInput(), {
      ownKeys() {
        throw new Error('input-trap-placeholder');
      },
    });
    expectInvalid(throwingInput);

    const throwingMembers = {
      has() {
        throw new Error('member-catalog-placeholder');
      },
    } as unknown as ReadonlySet<string>;
    expectInvalid(createInput(), createFacts({ approvedMemberIds: throwingMembers }));

    const throwingSources = {
      has() {
        throw new Error('source-catalog-placeholder');
      },
    } as unknown as ReadonlySet<string>;
    expectInvalid(createInput(), createFacts({ approvedSourceCodes: throwingSources }));

    const throwingProjects = {
      get() {
        throw new Error('project-catalog-placeholder');
      },
    } as unknown as CustomerCreationSelectionFacts['projectCatalog'];
    expectInvalid(createInput(), createFacts({ projectCatalog: throwingProjects }));

    expectInvalid(createInput(), createFacts(), {
      ...policy,
      isApprovedDisplayName() {
        throw new Error('display-policy-placeholder');
      },
    });
    expectInvalid(createInput(), createFacts(), {
      ...policy,
      isApprovedMaskedReference() {
        throw new Error('reference-policy-placeholder');
      },
    });

    const policyGetter = vi.fn(() => () => true);
    const accessorPolicy = {
      isApprovedMaskedReference: policy.isApprovedMaskedReference,
    } as CustomerCreationSelectionPolicy;
    Object.defineProperty(accessorPolicy, 'isApprovedDisplayName', {
      enumerable: true,
      get: policyGetter,
    });
    expectInvalid(createInput(), createFacts(), accessorPolicy);
    expect(policyGetter).not.toHaveBeenCalled();
  });

  it('getPrototypeOf、descriptor、revoked Proxy 抛错被捕获，事实 getter 不执行', () => {
    for (const input of [
      new Proxy(createInput(), {
        getPrototypeOf() {
          throw new Error('prototype-trap-placeholder');
        },
      }),
      new Proxy(createInput(), {
        getOwnPropertyDescriptor() {
          throw new Error('descriptor-trap-placeholder');
        },
      }),
    ]) {
      expectInvalid(input);
    }

    const revocable = Proxy.revocable(createInput(), {});
    revocable.revoke();
    expectInvalid(revocable.proxy);

    const factsGetter = vi.fn(() => createFacts().stableReference);
    const accessorFacts = {
      approvedMemberIds: createFacts().approvedMemberIds,
      requiredOwnerUserId: null,
      approvedSourceCodes: createFacts().approvedSourceCodes,
      projectCatalog: createFacts().projectCatalog,
    } as CustomerCreationSelectionFacts;
    Object.defineProperty(accessorFacts, 'stableReference', {
      enumerable: true,
      get: factsGetter,
    });
    expectInvalid(createInput(), accessorFacts);
    expect(factsGetter).not.toHaveBeenCalled();

    const entryGetter = vi.fn(() => {
      throw new Error('project-entry-placeholder');
    });
    const projectEntry = { projectId: 'project_alpha' } as {
      projectId: string;
      displayName: string;
    };
    Object.defineProperty(projectEntry, 'displayName', {
      enumerable: true,
      get: entryGetter,
    });
    expectInvalid(
      createInput(),
      createFacts({ projectCatalog: new Map([['project_alpha', projectEntry]]) }),
    );
    expect(entryGetter).toHaveBeenCalledTimes(1);
  });

  it('失败只返回单一低敏码，不回显任何拒绝内容或部分事实', () => {
    const rejectedMarker = 'creation-selection-rejected-marker';
    const result = resolveCustomerCreationSelection(
      { ...createInput(), ownerUserId: rejectedMarker },
      createFacts(),
      policy,
    );

    expect(result).toEqual({
      ok: false,
      code: 'invalid_customer_creation_selection',
    });
    expect(result).not.toHaveProperty('value');
    expect(JSON.stringify(result)).not.toContain(rejectedMarker);
  });

  it('只输出白名单字段，权威事实和项目目录附加字段不会泄露', () => {
    const metadataMarker = 'internal-metadata-placeholder';
    const projectCatalog = new Map([
      [
        'project_alpha',
        {
          projectId: 'project_alpha',
          displayName: '项目甲',
          internalMetadata: metadataMarker,
        },
      ],
    ]);
    const result = resolveCustomerCreationSelection(
      createInput(),
      createFacts({ projectCatalog }),
      policy,
    );

    expect(result).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toContain(metadataMarker);
    expect(result).not.toHaveProperty('contractVersion');
    expect(result).not.toHaveProperty('authorized');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected_valid_creation_selection');
    expect(Object.keys(result).sort()).toEqual(['ok', 'value']);
    expect(Object.keys(result.value).sort()).toEqual([
      'displayName',
      'ownerUserId',
      'primaryProject',
      'projects',
      'sourceCode',
      'stableReference',
    ]);
    expect(Object.keys(result.value.stableReference).sort()).toEqual([
      'maskedReference',
      'sourceCode',
    ]);
    expect(Object.keys(result.value.projects[0] ?? {}).sort()).toEqual([
      'displayName',
      'projectId',
    ]);
    expect(Object.keys(result.value.primaryProject).sort()).toEqual([
      'displayName',
      'projectId',
    ]);
  });

  it('结果确定且全层使用新引用，输入和全部权威事实保持不变', () => {
    const input = {
      ...createInput(),
      selectedProjectIds: ['project_beta', 'project_alpha'],
      primaryProjectId: 'project_alpha',
    };
    const facts = createFacts();
    const inputBefore = structuredClone(input);
    const stableReferenceBefore = structuredClone(facts.stableReference);
    const memberIdsBefore = [...facts.approvedMemberIds];
    const sourceCodesBefore = [...facts.approvedSourceCodes];
    const projectsBefore = structuredClone([...facts.projectCatalog.entries()]);

    const first = resolveCustomerCreationSelection(input, facts, policy);
    const second = resolveCustomerCreationSelection(input, facts, policy);

    expect(first).toEqual(second);
    expect(input).toEqual(inputBefore);
    expect(facts.stableReference).toEqual(stableReferenceBefore);
    expect([...facts.approvedMemberIds]).toEqual(memberIdsBefore);
    expect([...facts.approvedSourceCodes]).toEqual(sourceCodesBefore);
    expect([...facts.projectCatalog.entries()]).toEqual(projectsBefore);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('expected_valid_creation_selection');

    expect(first).not.toBe(second);
    expect(first.value).not.toBe(second.value);
    expect(first.value.stableReference).not.toBe(facts.stableReference);
    expect(first.value.stableReference).not.toBe(second.value.stableReference);
    expect(second.value.stableReference).not.toBe(facts.stableReference);
    expect(first.value.projects).not.toBe(second.value.projects);
    expect(first.value.primaryProject).not.toBe(second.value.primaryProject);
    for (const [index, project] of first.value.projects.entries()) {
      expect(project).not.toBe(facts.projectCatalog.get(project.projectId));
      expect(project).not.toBe(second.value.projects[index]);
    }
    expect(first.value.primaryProject).not.toBe(
      first.value.projects.find(
        (project) => project.projectId === first.value.primaryProject.projectId,
      ),
    );
    expect(second.value.primaryProject).not.toBe(
      second.value.projects.find(
        (project) => project.projectId === second.value.primaryProject.projectId,
      ),
    );
  });

  it('冻结输入可以成功，成功结果不受调用后源对象变化影响', () => {
    const input = Object.freeze({
      ...createInput(),
      selectedProjectIds: Object.freeze(['project_alpha']),
    });
    const stableReference = {
      sourceCode: 'source_referral',
      maskedReference: '档案****0421',
    };
    const projectEntry = { projectId: 'project_alpha', displayName: '项目甲' };
    const facts = Object.freeze({
      stableReference,
      approvedMemberIds: new Set(['member_alpha']),
      requiredOwnerUserId: null,
      approvedSourceCodes: new Set(['source_referral']),
      projectCatalog: new Map([['project_alpha', projectEntry]]),
    });

    const result = resolveCustomerCreationSelection(input, facts, policy);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected_valid_creation_selection');

    stableReference.maskedReference = '档案****9999';
    projectEntry.displayName = '项目已变化';
    expect(result.value.stableReference.maskedReference).toBe('档案****0421');
    expect(result.value.projects).toEqual([
      { projectId: 'project_alpha', displayName: '项目甲' },
    ]);
    expect(result.value.primaryProject).toEqual({
      projectId: 'project_alpha',
      displayName: '项目甲',
    });
  });
});
