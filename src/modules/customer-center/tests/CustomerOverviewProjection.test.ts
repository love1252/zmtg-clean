import { describe, expect, it } from 'vitest';
import {
  mapCustomerOverviewV1,
  type CustomerOverviewProjectionInput,
  type CustomerOverviewProjectionPolicy,
} from '@/modules/customer-center/domain/customer-overview';
import {
  CUSTOMER_LIFECYCLES,
  CUSTOMER_PRIORITIES,
} from '@/modules/customer-center/domain/customer-query';

const policy: CustomerOverviewProjectionPolicy = {
  allowedLifecycleBasisCodes: new Set(['basis_appointment_confirmed']),
  allowedLifecycleBasisSourceKinds: new Set(['source_appointment']),
  isTrustedCustomerId: (customerId) => customerId.startsWith('customer_'),
  isApprovedDisplayName: (displayName) => displayName.startsWith('客户'),
  isApprovedMaskedReference: (maskedReference) => /^档案\*{4}\d{4}$/u.test(maskedReference),
  isApprovedOwner: (userId, displayName) =>
    userId === 'member_alpha' && displayName.startsWith('顾问'),
  isApprovedProject: (projectId, displayName) =>
    ['project_alpha', 'project_beta'].includes(projectId) && displayName.startsWith('项目'),
  isApprovedTag: (tagCode, displayName) =>
    tagCode === 'tag_followup' && displayName === '待跟进',
  isTrustedLifecycleBasisSourceId: (sourceId) => sourceId === 'source_alpha',
};

function createOverviewInput() {
  return {
    customer: {
      customerId: 'customer_alpha',
      displayName: '客户甲',
      maskedReference: '档案****0421',
    },
    lifecycle: 'scheduled',
    priority: 'high',
    owner: {
      userId: 'member_alpha',
      displayName: '顾问甲',
    },
    primaryProject: {
      projectId: 'project_alpha',
      displayName: '项目甲',
    },
    projects: [
      { projectId: 'project_alpha', displayName: '项目甲' },
      { projectId: 'project_beta', displayName: '项目乙' },
    ],
    tags: [{ tagCode: 'tag_followup', displayName: '待跟进' }],
    lifecycleBasis: {
      basisCode: 'basis_appointment_confirmed',
      sourceKind: 'source_appointment',
      sourceId: 'source_alpha',
      occurredAt: '2026-07-16T08:00:00.000Z',
    },
    updatedAt: '2026-07-17T08:30:00.000Z',
  } satisfies CustomerOverviewProjectionInput;
}

function requireOverview(input: CustomerOverviewProjectionInput = createOverviewInput()) {
  const overview = mapCustomerOverviewV1(input, policy);
  expect(overview).not.toBeNull();
  if (!overview) throw new Error('expected_customer_overview');
  return overview;
}

describe('客户中心 CustomerOverviewV1 纯投影', () => {
  it('输出精确顶层与嵌套字段，不声明公共客户引用形状', () => {
    const nestedLegacyMarker = 'nested_legacy_placeholder';
    const customerWithLegacyFields = {
      ...createOverviewInput().customer,
      maskedPhone: nestedLegacyMarker,
      notes: nestedLegacyMarker,
    };
    const overview = requireOverview({
      ...createOverviewInput(),
      customer: customerWithLegacyFields,
    });

    expect(overview).toEqual({
      contractVersion: 'v1',
      customer: {
        customerId: 'customer_alpha',
        displayName: '客户甲',
        maskedReference: '档案****0421',
      },
      lifecycle: 'scheduled',
      priority: 'high',
      owner: {
        userId: 'member_alpha',
        displayName: '顾问甲',
      },
      primaryProject: {
        projectId: 'project_alpha',
        displayName: '项目甲',
      },
      projects: [
        { projectId: 'project_alpha', displayName: '项目甲' },
        { projectId: 'project_beta', displayName: '项目乙' },
      ],
      tags: [{ tagCode: 'tag_followup', displayName: '待跟进' }],
      lifecycleBasis: {
        basisCode: 'basis_appointment_confirmed',
        sourceKind: 'source_appointment',
        sourceId: 'source_alpha',
        occurredAt: '2026-07-16T08:00:00.000Z',
      },
      updatedAt: '2026-07-17T08:30:00.000Z',
    });
    expect(Object.keys(overview)).toEqual([
      'contractVersion',
      'customer',
      'lifecycle',
      'priority',
      'owner',
      'primaryProject',
      'projects',
      'tags',
      'lifecycleBasis',
      'updatedAt',
    ]);
    expect(Object.keys(overview.customer)).toEqual([
      'customerId',
      'displayName',
      'maskedReference',
    ]);
    expect(Object.keys(overview.owner ?? {})).toEqual(['userId', 'displayName']);
    expect(Object.keys(overview.projects[0] ?? {})).toEqual(['projectId', 'displayName']);
    expect(Object.keys(overview.tags[0] ?? {})).toEqual(['tagCode', 'displayName']);
    expect(Object.keys(overview.lifecycleBasis ?? {})).toEqual([
      'basisCode',
      'sourceKind',
      'sourceId',
      'occurredAt',
    ]);
    expect(JSON.stringify(overview)).not.toContain(nestedLegacyMarker);
  });

  it('精确接受五种 lifecycle 与 high/medium/watch，拒绝 observe', () => {
    for (const lifecycle of CUSTOMER_LIFECYCLES) {
      expect(
        mapCustomerOverviewV1({ ...createOverviewInput(), lifecycle }, policy)?.lifecycle,
      ).toBe(lifecycle);
    }

    for (const priority of CUSTOMER_PRIORITIES) {
      expect(
        mapCustomerOverviewV1({ ...createOverviewInput(), priority }, policy)?.priority,
      ).toBe(priority);
    }

    expect(
      mapCustomerOverviewV1({ ...createOverviewInput(), priority: 'observe' }, policy),
    ).toBeNull();
    expect(
      mapCustomerOverviewV1({ ...createOverviewInput(), lifecycle: 'legacy_stage' }, policy),
    ).toBeNull();
  });

  it('支持四个 nullable 事实与空 projects/tags', () => {
    const overview = requireOverview({
      ...createOverviewInput(),
      customer: {
        ...createOverviewInput().customer,
        maskedReference: null,
      },
      owner: null,
      primaryProject: null,
      projects: [],
      tags: [],
      lifecycleBasis: null,
    });

    expect(overview.customer.maskedReference).toBeNull();
    expect(overview.owner).toBeNull();
    expect(overview.primaryProject).toBeNull();
    expect(overview.projects).toEqual([]);
    expect(overview.tags).toEqual([]);
    expect(overview.lifecycleBasis).toBeNull();
  });

  it('primaryProject 只能取自 projects 中完全匹配的规范化引用', () => {
    const missing = requireOverview({
      ...createOverviewInput(),
      primaryProject: { projectId: 'project_beta', displayName: '项目乙' },
      projects: [{ projectId: 'project_alpha', displayName: '项目甲' }],
    });
    expect(missing.primaryProject).toBeNull();

    const mismatchedLabel = requireOverview({
      ...createOverviewInput(),
      primaryProject: { projectId: 'project_alpha', displayName: '项目甲别名' },
    });
    expect(mismatchedLabel.primaryProject).toBeNull();

    const validInput = createOverviewInput();
    const valid = requireOverview(validInput);
    expect(valid.primaryProject).toEqual(valid.projects[0]);
    expect(valid.primaryProject).not.toBe(validInput.primaryProject);
  });

  it('lifecycleBasis 仅接收受控 code/kind、规范化 sourceId 和有效时间', () => {
    const cases: CustomerOverviewProjectionInput['lifecycleBasis'][] = [
      { ...createOverviewInput().lifecycleBasis, basisCode: 'basis_unapproved' },
      { ...createOverviewInput().lifecycleBasis, sourceKind: 'source_unapproved' },
      { ...createOverviewInput().lifecycleBasis, sourceId: 'source id' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: 'not-a-time' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: '2026-07-16T08:00:00' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: '07/16/2026' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: '2026-02-30T08:00:00.000Z' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: '2026-07-16T24:00:00.000Z' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: '2026-07-16T08:60:00.000Z' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: '2026-07-16T08:00:60.000Z' },
      { ...createOverviewInput().lifecycleBasis, occurredAt: '2026-07-16T08:00:00+24:00' },
    ];

    for (const lifecycleBasis of cases) {
      expect(
        requireOverview({ ...createOverviewInput(), lifecycleBasis }).lifecycleBasis,
      ).toBeNull();
    }

    expect(
      requireOverview({
        ...createOverviewInput(),
        lifecycleBasis: {
          ...createOverviewInput().lifecycleBasis,
          occurredAt: '2026-07-16T16:00:00+08:00',
        },
      }).lifecycleBasis?.occurredAt,
    ).toBe('2026-07-16T08:00:00.000Z');
  });

  it('不从 legacy 下一步、项目意向、备注、联系方式或业务正文推断字段', () => {
    const legacyMarker = 'legacy_field_placeholder';
    const source = {
      ...createOverviewInput(),
      owner: null,
      primaryProject: null,
      projects: [],
      lifecycleBasis: null,
      nextAction: legacyMarker,
      projectInterest: legacyMarker,
      notes: legacyMarker,
      contactDetail: legacyMarker,
      treatmentBody: legacyMarker,
      conversationBody: legacyMarker,
    };

    const overview = requireOverview(source);
    const serialized = JSON.stringify(overview);

    expect(serialized).not.toContain(legacyMarker);
    for (const key of [
      'nextAction',
      'projectInterest',
      'notes',
      'contactDetail',
      'treatmentBody',
      'conversationBody',
    ]) {
      expect(overview).not.toHaveProperty(key);
    }
    expect(overview.owner).toBeNull();
    expect(overview.projects).toEqual([]);
    expect(overview.lifecycleBasis).toBeNull();
  });

  it('结果确定、输入不变且所有嵌套引用均为新对象', () => {
    const source = createOverviewInput();
    const before = structuredClone(source);

    const first = requireOverview(source);
    const second = requireOverview(source);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(source).toEqual(before);
    expect(first.customer).not.toBe(source.customer);
    expect(first.owner).not.toBe(source.owner);
    expect(first.projects).not.toBe(source.projects);
    expect(first.projects[0]).not.toBe(source.projects[0]);
    expect(first.tags).not.toBe(source.tags);
    expect(first.tags[0]).not.toBe(source.tags[0]);
    expect(first.lifecycleBasis).not.toBe(source.lifecycleBasis);

    source.customer.displayName = '客户乙';
    source.projects[0].displayName = '项目已变更';
    source.projects.push({ projectId: 'project_gamma', displayName: '项目丙' });
    source.tags[0].displayName = '标签已变更';

    expect(first.customer.displayName).toBe('客户甲');
    expect(first.projects).toHaveLength(2);
    expect(first.projects[0]?.displayName).toBe('项目甲');
    expect(first.tags[0]?.displayName).toBe('待跟进');
  });

  it('必需客户事实、生命周期、优先级或更新时间不可靠时 fail-closed', () => {
    expect(
      mapCustomerOverviewV1(
        {
          ...createOverviewInput(),
          customer: { ...createOverviewInput().customer, customerId: 'customer id' },
        },
        policy,
      ),
    ).toBeNull();
    expect(
      mapCustomerOverviewV1({ ...createOverviewInput(), updatedAt: 'not-a-time' }, policy),
    ).toBeNull();
    expect(
      mapCustomerOverviewV1(
        { ...createOverviewInput(), updatedAt: '2026-07-17T08:30:00' },
        policy,
      ),
    ).toBeNull();
  });

  it('客户与关系引用必须通过调用者信任门禁且不含明显敏感原文', () => {
    const permissiveCustomerTextPolicy: CustomerOverviewProjectionPolicy = {
      ...policy,
      isApprovedDisplayName: () => true,
      isApprovedMaskedReference: () => true,
    };
    for (const customer of [
      { ...createOverviewInput().customer, displayName: ['138', '0000', '0000'].join('') },
      { ...createOverviewInput().customer, maskedReference: 'https://example.invalid/customer' },
      { ...createOverviewInput().customer, maskedReference: 'external_id_opaque' },
    ]) {
      expect(
        mapCustomerOverviewV1(
          { ...createOverviewInput(), customer },
          permissiveCustomerTextPolicy,
        ),
      ).toBeNull();
    }
    for (const customer of [
      { ...createOverviewInput().customer, customerId: 'source_alpha' },
      { ...createOverviewInput().customer, maskedReference: '档案未遮蔽' },
    ]) {
      expect(mapCustomerOverviewV1({ ...createOverviewInput(), customer }, policy)).toBeNull();
    }

    const untrustedRelations = requireOverview({
      ...createOverviewInput(),
      owner: { userId: 'member_unknown', displayName: '顾问甲' },
      primaryProject: { projectId: 'project_unknown', displayName: '项目未知' },
      projects: [{ projectId: 'project_unknown', displayName: '项目未知' }],
      tags: [{ tagCode: 'tag_unknown', displayName: '待跟进' }],
      lifecycleBasis: { ...createOverviewInput().lifecycleBasis, sourceId: 'source_unknown' },
    });
    expect(untrustedRelations.owner).toBeNull();
    expect(untrustedRelations.primaryProject).toBeNull();
    expect(untrustedRelations.projects).toEqual([]);
    expect(untrustedRelations.tags).toEqual([]);
    expect(untrustedRelations.lifecycleBasis).toBeNull();

    const permissiveRelationshipPolicy: CustomerOverviewProjectionPolicy = {
      ...policy,
      isApprovedOwner: () => true,
      isApprovedProject: () => true,
      isApprovedTag: () => true,
    };
    const sensitiveRelationships = mapCustomerOverviewV1(
      {
        ...createOverviewInput(),
        owner: { userId: 'member_alpha', displayName: ['138', '0000', '0000'].join('') },
        primaryProject: { projectId: 'project_alpha', displayName: 'https://example.invalid' },
        projects: [{ projectId: 'project_alpha', displayName: 'https://example.invalid' }],
        tags: [{ tagCode: 'tag_followup', displayName: 'token placeholder' }],
      },
      permissiveRelationshipPolicy,
    );
    expect(sensitiveRelationships?.owner).toBeNull();
    expect(sensitiveRelationships?.primaryProject).toBeNull();
    expect(sensitiveRelationships?.projects).toEqual([]);
    expect(sensitiveRelationships?.tags).toEqual([]);
  });
});
