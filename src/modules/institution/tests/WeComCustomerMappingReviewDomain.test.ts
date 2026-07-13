import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createWeComCustomerMappingDomain,
  weComCustomerMappingActions,
  weComCustomerMappingStatuses,
} from '@/modules/institution/domain/wecom-customer-mapping-review';
import type {
  MappingCommandResult,
  SourceScopeRuntimeState,
  WeComCustomerMappingDomain,
} from '@/modules/institution/domain/wecom-customer-mapping-review';

const ZERO_DIGEST = `sha256:${'0'.repeat(64)}`;
const OCCURRED_AT = '2026-07-13T10:00:00.000Z';
const NEXT_OCCURRED_AT = '2026-07-13T11:00:00.000Z';
const AUDIT_KEYS = [
  'tenantId',
  'eventType',
  'reviewerRole',
  'action',
  'reasonCode',
  'mappingStatusBefore',
  'mappingStatusAfter',
  'candidateDigest',
  'timestamp',
  'sourceKind',
  'dataMode',
];

function digest(character: string) {
  return `sha256:${character.repeat(64)}`;
}

function sourceFor(tenantId = 'tenant-mock-001') {
  const dataMode = tenantId.includes('-demo-') ? 'demo' as const : 'mock' as const;
  const label = dataMode === 'mock' ? 'MOCK' : 'DEMO';
  return {
    externalContacts: [{
      tenantId,
      externalContactReference: `ref-${dataMode}-contact-001`,
      displayName: `[${label}] 客户甲`,
      externalUserIdDigest: digest('a'),
      followUsers: [{
        tenantId,
        followUserReference: `ref-${dataMode}-follow-001`,
        displayName: `[${label}] 顾问甲`,
        followUserIdDigest: digest('b'),
        ownershipStatus: 'active',
        institutionSummary: `[${label}] 机构甲`,
        dataMode,
        containsRealCustomerData: false,
      }],
      tags: [{
        tenantId,
        tagReference: `ref-${dataMode}-tag-001`,
        tagIdDigest: digest('c'),
        tagName: `[${label}] 重点客户`,
        sourceType: dataMode === 'mock' ? 'mock_enterprise' : 'demo_enterprise',
        tagStatus: 'active',
        dataMode,
        containsRealCustomerData: false,
      }],
      sourceType: 'other_mock',
      addedAtDate: '2026-07-10',
      remarkSummary: `[${label}] 已确认摘要`,
      sourceMappingStatus: 'unmatched',
      lastSyncedAt: '2026-07-12T00:00:00.000Z',
      syncStatus: 'mock_ready',
      manualReviewState: 'not_required',
      dataMode,
      containsRealCustomerData: false,
      fieldWhitelistApplied: true,
    }],
    systemCustomers: [{
      tenantId,
      customerReference: `ref-${dataMode}-customer-001`,
      mockCustomerNumber: `${label}-001`,
      displayNameSummary: `[${label}] 客户甲`,
      remarkSummary: `[${label}] 已确认摘要`,
      tagNames: [`[${label}] 重点客户`],
      sourceType: 'other_mock',
      addedAtDate: '2026-07-10',
      ownerSummary: `[${label}] 顾问甲`,
      customerDigest: digest('d'),
      statusSummary: 'active',
      dataMode,
      containsRealCustomerData: false,
      fieldWhitelistApplied: true,
    }],
    dataMode,
    sourceKind: dataMode === 'mock'
      ? 'controlled_mock_fixture' as const
      : 'controlled_demo_fixture' as const,
    manifestEntryReference: `ref-${dataMode}-entry-001`,
  };
}

function multiSourceFor(tenantId = 'tenant-mock-006') {
  const primary = sourceFor(tenantId);
  const dataMode = primary.dataMode;
  const label = dataMode === 'mock' ? 'MOCK' : 'DEMO';
  const firstContact = {
    ...primary.externalContacts[0],
    followUsers: [
      ...primary.externalContacts[0].followUsers,
      {
        tenantId,
        followUserReference: `ref-${dataMode}-follow-002`,
        displayName: `[${label}] 顾问乙`,
        followUserIdDigest: digest('e'),
        ownershipStatus: 'active',
        institutionSummary: `[${label}] 机构乙`,
        dataMode,
        containsRealCustomerData: false,
      },
    ],
    tags: [
      ...primary.externalContacts[0].tags,
      {
        tenantId,
        tagReference: `ref-${dataMode}-tag-002`,
        tagIdDigest: digest('f'),
        tagName: `[${label}] 稳健客户`,
        sourceType: dataMode === 'mock' ? 'mock_enterprise' : 'demo_enterprise',
        tagStatus: 'active',
        dataMode,
        containsRealCustomerData: false,
      },
    ],
  };
  const firstCustomer = {
    ...primary.systemCustomers[0],
    tagNames: [...primary.systemCustomers[0].tagNames, `[${label}] 稳健客户`],
  };
  const secondContact = {
    ...primary.externalContacts[0],
    externalContactReference: `ref-${dataMode}-contact-002`,
    displayName: `[${label}] 客户乙`,
    externalUserIdDigest: digest('e'),
    followUsers: [{
      ...primary.externalContacts[0].followUsers[0],
      followUserReference: `ref-${dataMode}-follow-003`,
      displayName: `[${label}] 顾问丙`,
      followUserIdDigest: digest('1'),
      institutionSummary: `[${label}] 机构丙`,
    }],
    tags: [{
      ...primary.externalContacts[0].tags[0],
      tagReference: `ref-${dataMode}-tag-003`,
      tagIdDigest: digest('2'),
      tagName: `[${label}] 新客户`,
    }],
    remarkSummary: `[${label}] 乙摘要`,
  };
  const secondCustomer = {
    ...primary.systemCustomers[0],
    customerReference: `ref-${dataMode}-customer-002`,
    mockCustomerNumber: `${label}-002`,
    displayNameSummary: `[${label}] 客户乙`,
    remarkSummary: `[${label}] 乙摘要`,
    tagNames: [`[${label}] 新客户`],
    ownerSummary: `[${label}] 顾问丙`,
    customerDigest: digest('f'),
  };
  return {
    externalContacts: [firstContact, secondContact],
    systemCustomers: [firstCustomer, secondCustomer],
    dataMode,
    sourceKind: primary.sourceKind,
    manifestEntryReferences: [`ref-${dataMode}-entry-001`, `ref-${dataMode}-entry-002`],
  };
}

function multiGenerationCommand(
  entryIndex: number | null,
  changes: Record<string, unknown> = {},
  tenantId = 'tenant-mock-006',
) {
  const source = multiSourceFor(tenantId);
  return {
    tenantId,
    action: 'generate_candidate',
    manifestEntryReference: entryIndex === null ? null : source.manifestEntryReferences[entryIndex],
    externalContacts: source.externalContacts,
    systemCustomers: source.systemCustomers,
    occurredAt: OCCURRED_AT,
    sourceKind: source.sourceKind,
    dataMode: source.dataMode,
    containsRealCustomerData: false,
    ...changes,
  };
}

function generationCommand(
  changes: Record<string, unknown> = {},
  tenantId = 'tenant-mock-001',
) {
  const source = sourceFor(tenantId);
  return {
    tenantId,
    action: 'generate_candidate',
    manifestEntryReference: source.manifestEntryReference,
    externalContacts: source.externalContacts,
    systemCustomers: source.systemCustomers,
    occurredAt: OCCURRED_AT,
    sourceKind: source.sourceKind,
    dataMode: source.dataMode,
    containsRealCustomerData: false,
    ...changes,
  };
}

function requireDomain(): WeComCustomerMappingDomain {
  const domain = createWeComCustomerMappingDomain();
  expect(domain).not.toMatchObject({ ok: false });
  return domain as WeComCustomerMappingDomain;
}

function generate(domain = requireDomain()) {
  const result = domain.generateCandidate(generationCommand(), null);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('fixture generation failed');
  return { domain, result, state: result.nextState };
}

function selectedAt(state: SourceScopeRuntimeState, position: number) {
  return state.mappings[position];
}

function selected(state: SourceScopeRuntimeState) {
  return selectedAt(state, 0);
}

function reviewCommand(
  state: SourceScopeRuntimeState,
  action: string,
  changes: Record<string, unknown> = {},
) {
  const mapping = selected(state);
  const historicalCandidateDigest = [...mapping.history.entries]
    .reverse()
    .find(({ targetSnapshot }) => targetSnapshot !== null)
    ?.targetSnapshot?.candidateDigest;
  return {
    tenantId: 'tenant-mock-001',
    mappingReference: mapping.aggregate.mappingReference,
    candidateDigest: mapping.aggregate.candidateDigest ?? historicalCandidateDigest,
    action,
    reviewerRole: 'institution_operator',
    occurredAt: NEXT_OCCURRED_AT,
    ...changes,
  };
}

function disableCommand(state: SourceScopeRuntimeState, changes: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-mock-001',
    mappingReference: selected(state).aggregate.mappingReference,
    action: 'disable_mapping',
    reviewerRole: 'platform_governance',
    occurredAt: NEXT_OCCURRED_AT,
    ...changes,
  };
}

function expectBlocked(
  result: MappingCommandResult,
  eventType: string,
  reasonCode: string,
) {
  expect(result).toEqual({
    ok: false,
    auditEvent: expect.objectContaining({ eventType, reasonCode }),
  });
  expect(Object.keys(result)).toEqual(['ok', 'auditEvent']);
  expect(Object.keys(result.auditEvent)).toEqual(AUDIT_KEYS);
  expect(result.auditEvent.mappingStatusAfter).not.toBe('matched');
}

function auditJson(result: MappingCommandResult) {
  return JSON.stringify(result.auditEvent);
}

function expectAuditSafe(result: MappingCommandResult, originals: string[] = []) {
  const serialized = auditJson(result);
  for (const original of originals) expect(serialized).not.toContain(original);
  expect(serialized).not.toMatch(
    /1[3-9]\d{9}|wm_|wo_|token|secret|credential|rawResponse|webhookPayload|apiResponse|聊天内容|会话存档/i,
  );
}

function committedState(result: MappingCommandResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected committed result');
  return result.nextState;
}

function jsonState(state: SourceScopeRuntimeState): SourceScopeRuntimeState {
  return JSON.parse(JSON.stringify(state)) as SourceScopeRuntimeState;
}

function lengthPrefix(value: string | Buffer) {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function canonicalEncode(value: unknown): Buffer {
  if (typeof value === 'string') return Buffer.concat([lengthPrefix('s'), lengthPrefix(value)]);
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return Buffer.concat([lengthPrefix('i'), lengthPrefix(String(value))]);
  }
  if (typeof value === 'boolean') {
    return Buffer.concat([lengthPrefix('b'), lengthPrefix(value ? 'true' : 'false')]);
  }
  if (value === null) return lengthPrefix('null');
  if (Array.isArray(value)) {
    return Buffer.concat([
      lengthPrefix('a'),
      lengthPrefix(String(value.length)),
      ...value.map(canonicalEncode),
    ]);
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    return Buffer.concat([
      lengthPrefix('o'),
      lengthPrefix(String(entries.length)),
      ...entries.flatMap(([key, nested]) => [lengthPrefix(key), canonicalEncode(nested)]),
    ]);
  }
  throw new TypeError('unsupported canonical test value');
}

function digestValues(domain: string, values: readonly unknown[]) {
  const hash = createHash('sha256');
  hash.update(lengthPrefix(domain));
  for (const value of values) hash.update(canonicalEncode(value));
  return `sha256:${hash.digest('hex')}`;
}

function rehashRuntimeIndex(state: SourceScopeRuntimeState) {
  const index = state.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
  index.indexDigest = digestValues('zmtg:05c-e1:source-scope-runtime-index:v2', [
    index.tenantId,
    index.sourceScopeReference,
    index.fixtureRegistryDigest,
    index.candidateManifestDigest,
    index.indexVersion,
    index.indexSnapshotComplete,
    index.generationCursor,
    index.generationComplete,
    index.records,
    index.lineageLockIndex,
    index.sourceKind,
    index.dataMode,
  ]);
  return state;
}

function rehashAllMappingsAndRuntime(state: SourceScopeRuntimeState) {
  const index = state.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
  const records = index.records as Array<Record<string, unknown>>;
  state.mappings.forEach((mapping, position) => {
    const aggregate = mapping.aggregate as unknown as Record<string, unknown>;
    const history = mapping.history as unknown as Record<string, unknown>;
    history.historyDigest = digestValues('zmtg:05c-e1:mapping-history:v1', [
      history.tenantId,
      history.sourceScopeReference,
      history.mappingReference,
      history.historyVersion,
      history.complete,
      history.entries,
      history.sourceKind,
      history.dataMode,
    ]);
    aggregate.historyDigest = history.historyDigest;
    records[position].historyDigest = history.historyDigest;
  });
  rehashRuntimeIndex(state);
  return state;
}

function rehashHistoryAndRuntime(state: SourceScopeRuntimeState) {
  const mapping = selected(state) as unknown as Record<string, unknown>;
  const aggregate = mapping.aggregate as Record<string, unknown>;
  const history = mapping.history as Record<string, unknown>;
  history.historyDigest = digestValues('zmtg:05c-e1:mapping-history:v1', [
    history.tenantId,
    history.sourceScopeReference,
    history.mappingReference,
    history.historyVersion,
    history.complete,
    history.entries,
    history.sourceKind,
    history.dataMode,
  ]);
  aggregate.historyDigest = history.historyDigest;
  const index = state.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
  const records = index.records as Array<Record<string, unknown>>;
  records[0].historyDigest = history.historyDigest;
  rehashRuntimeIndex(state);
  return state;
}

function rehashLineageAndRuntime(state: SourceScopeRuntimeState) {
  const index = state.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
  const lineage = index.lineageLockIndex as Record<string, unknown>;
  lineage.indexDigest = digestValues('zmtg:05c-e1:lineage-index:v1', [
    lineage.tenantId,
    lineage.sourceScopeReference,
    lineage.indexVersion,
    lineage.records,
    lineage.sourceKind,
    lineage.dataMode,
  ]);
  rehashRuntimeIndex(state);
  return state;
}

function withSelectedTargetDescriptor(
  state: SourceScopeRuntimeState,
  descriptor: PropertyDescriptor | null,
) {
  const copy = jsonState(state);
  const mapping = copy.mappings[0] as unknown as Record<string, unknown>;
  if (descriptor === null) delete mapping.target;
  else Object.defineProperty(mapping, 'target', { enumerable: true, configurable: true, ...descriptor });
  return copy;
}

function expectBlockedWithoutState(result: MappingCommandResult) {
  expect(result.ok).toBe(false);
  expect(Object.keys(result)).toEqual(['ok', 'auditEvent']);
  expect('nextState' in result).toBe(false);
}

describe('WeCom customer mapping mock domain', () => {
  it('声明完整状态和动作闭集', () => {
    expect(weComCustomerMappingStatuses).toEqual([
      'unmatched',
      'candidate',
      'manual_review_required',
      'conflict',
      'matched',
      'rejected',
      'needs_more_info',
      'stale',
      'disabled',
      'cleared_locked',
    ]);
    expect(weComCustomerMappingActions).toEqual([
      'generate_candidate',
      'approve',
      'reject',
      'request_more_info',
      'mark_conflict',
      'clear_candidate',
      'reopen',
      'expire_candidate',
      'disable_mapping',
    ]);
  });

  it('factory 只接受零参数且不会读取伪造依赖', () => {
    let reads = 0;
    const forged = Object.defineProperty({}, 'authorityKind', {
      get() {
        reads += 1;
        return 'controlled_fixture_registry_v2';
      },
    });
    const result = (createWeComCustomerMappingDomain as (...args: unknown[]) => unknown)(forged);
    expect(result).toEqual({ ok: false, reasonCode: 'fixture_registry_initialization_blocked' });
    expect(reads).toBe(0);
  });

  it.each([
    ['registry', {
      authorityKind: 'controlled_fixture_registry_v2',
      bundles: [{ entry: {}, externalContacts: [], systemCustomers: [], candidateManifest: {} }],
    }],
    ['manifest', {
      authorityKind: 'controlled_fixture_registry_v2',
      candidateManifest: { entries: [], candidateManifestDigest: digest('a') },
      fixtureRegistryDigest: digest('b'),
    }],
    ['scanner', {
      authorityKind: 'controlled_fixture_registry_v2',
      scanner: () => false,
      sourceScopeReference: 'ref-mock-scope-001',
    }],
    ['hash', {
      authorityKind: 'controlled_fixture_registry_v2',
      hash: () => digest('c'),
      candidateManifestDigest: digest('d'),
      fixtureRegistryDigest: digest('e'),
    }],
  ])('P1-5 调用方自签 %s 可信根不能初始化 domain', (_kind, forged) => {
    const factory = createWeComCustomerMappingDomain as (...args: unknown[]) => unknown;
    expect(factory(forged)).toEqual({
      ok: false,
      reasonCode: 'fixture_registry_initialization_blocked',
    });
  });

  it('P1C ambient Array.prototype.map 不能向 module source 注入 extra field', () => {
    const originalMap = Array.prototype.map;
    Object.defineProperty(Array.prototype, 'map', {
      configurable: true,
      writable: true,
      value: function <T, U>(
        this: T[],
        callback: (value: T, index: number, array: T[]) => U,
        thisArg?: unknown,
      ) {
        if (this.length === 7 && this.every((value) =>
          typeof value === 'object' && value !== null &&
          'registryEntry' in value && 'candidateManifest' in value)) {
          const bundle = this[0] as unknown as { externalContacts: Array<Record<string, unknown>> };
          bundle.externalContacts[0].rawResponse = 'opaque';
        }
        return originalMap.call(this, callback, thisArg);
      },
    });

    try {
      const domain = requireDomain();
      expect(domain.generateCandidate(generationCommand(), null).ok).toBe(true);
    } finally {
      Object.defineProperty(Array.prototype, 'map', {
        value: originalMap,
        configurable: true,
        writable: true,
      });
    }
  });

  it('P1C ambient Map constructor 不能劫持 module-owned registry readiness', () => {
    const OriginalMap = globalThis.Map;
    globalThis.Map = class<K, V> extends OriginalMap<K, V> {
      constructor(entries?: readonly (readonly [K, V])[] | null) {
        const pairs = entries ? [...entries] : [];
        const target = pairs.find(([key]) => key === 'tenant-mock-002')?.[1] as
          | { readiness?: { providerState?: string } }
          | undefined;
        if (target?.readiness) target.readiness.providerState = 'mock_only';
        super(pairs);
      }
    } as MapConstructor;

    try {
      const domain = requireDomain();
      const result = domain.generateCandidate(generationCommand({}, 'tenant-mock-002'), null);
      expectBlocked(result, 'mapping_provider_disabled', 'provider_disabled');
    } finally {
      globalThis.Map = OriginalMap;
    }
  });

  it('P1-5 module registry 通过 mock sourceScopeReference 全局唯一性自检后才暴露 domain', () => {
    const domain = createWeComCustomerMappingDomain();
    expect(domain).not.toMatchObject({
      ok: false,
      reasonCode: 'fixture_registry_initialization_blocked',
    });
    expect(domain).toMatchObject({
      generateCandidate: expect.any(Function),
      reviewCandidate: expect.any(Function),
      disableMapping: expect.any(Function),
    });
  });

  it('P1-5 完整 authorization temporal/law state 通过自检后才签发可执行 domain', () => {
    const domain = requireDomain();
    const result = domain.generateCandidate(generationCommand(), null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auditEvent).toMatchObject({
        tenantId: 'tenant-mock-001',
        eventType: 'mapping_candidate_generated',
      });
    }
  });

  it('P1C multi-entry manifest 第一条完成后按 cursor 继续第二条', () => {
    const domain = requireDomain();
    const first = domain.generateCandidate(multiGenerationCommand(0), null);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.nextState.sourceScopeRuntimeIndex).toMatchObject({
      generationCursor: 1,
      generationComplete: false,
    });

    const second = domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), first.nextState);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.nextState.sourceScopeRuntimeIndex).toMatchObject({
      generationCursor: 2,
      generationComplete: true,
    });
    expect(second.nextState.mappings).toHaveLength(2);
    expect(second.nextState.sourceScopeRuntimeIndex.records[1].manifestEntryReference)
      .toBe('ref-mock-entry-002');
  });

  it('P1C multi-entry continuation selector 不匹配当前 cursor 时固定 generation_incomplete', () => {
    const domain = requireDomain();
    const first = domain.generateCandidate(multiGenerationCommand(0), null);
    const state = committedState(first);
    const result = domain.generateCandidate(multiGenerationCommand(0, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), state);

    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('generation_incomplete');
  });

  it('P1C incomplete state 缺少合法 continuation selector 时固定 generation_incomplete', () => {
    const domain = requireDomain();
    const first = domain.generateCandidate(multiGenerationCommand(0), null);
    const incomplete = committedState(first);
    const result = domain.generateCandidate(multiGenerationCommand(null, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), incomplete);

    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('generation_incomplete');
  });

  it('P1C incomplete selector precedence 不得打开已处理 mapping target', () => {
    const domain = requireDomain();
    const first = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const corrupted = jsonState(first);
    (corrupted.mappings[0] as unknown as Record<string, unknown>).target = null;

    const result = domain.generateCandidate(multiGenerationCommand(0, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), corrupted);

    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('generation_incomplete');
  });

  it('P1C incomplete continuation 在 scope index version 上限时原子阻断', () => {
    const domain = requireDomain();
    const first = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const atCapacity = jsonState(first);
    (atCapacity.sourceScopeRuntimeIndex as unknown as Record<string, unknown>).indexVersion = 2_147_483_647;
    rehashRuntimeIndex(atCapacity);

    const result = domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), atCapacity);

    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('source_scope_index_capacity_exceeded');
  });

  it('P1C complete scope 的 mapping/record 不能脱离 manifest position 交换', () => {
    const domain = requireDomain();
    const first = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const complete = committedState(domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), first));
    const swapped = jsonState(complete);
    const mappings = swapped.mappings as unknown as Array<SourceScopeRuntimeState['mappings'][number]>;
    [mappings[0], mappings[1]] = [mappings[1], mappings[0]];
    const records = swapped.sourceScopeRuntimeIndex.records as unknown as Array<Record<string, unknown>>;
    const firstReference = records[0].manifestEntryReference;
    const secondReference = records[1].manifestEntryReference;
    [records[0], records[1]] = [records[1], records[0]];
    records[0].manifestEntryReference = firstReference;
    records[1].manifestEntryReference = secondReference;
    rehashRuntimeIndex(swapped);
    const target = selected(swapped).target;
    expect(target).not.toBeNull();
    if (!target) return;

    const result = domain.reviewCandidate({
      tenantId: 'tenant-mock-006',
      mappingReference: target.mappingReference,
      candidateDigest: target.candidateDigest,
      action: 'approve',
      reviewerRole: 'institution_operator',
      occurredAt: '2026-07-13T12:00:00.000Z',
    }, swapped);

    expectBlockedWithoutState(result);
  });

  it('P1C review incomplete precedence 不得打开 processed mapping target', () => {
    const domain = requireDomain();
    const incomplete = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const corrupted = jsonState(incomplete);
    (corrupted.mappings[0] as unknown as Record<string, unknown>).target = null;
    const aggregate = corrupted.mappings[0].aggregate;
    const historicalDigest = corrupted.mappings[0].history.entries[0].targetSnapshot?.candidateDigest;

    const result = domain.reviewCandidate({
      tenantId: 'tenant-mock-006',
      mappingReference: aggregate.mappingReference,
      candidateDigest: historicalDigest,
      action: 'approve',
      reviewerRole: 'institution_operator',
      occurredAt: '2026-07-13T11:00:00.000Z',
    }, corrupted);

    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('generation_incomplete');
  });

  it('P1C complete multi-entry scope 允许非首项 stale regeneration', () => {
    const domain = requireDomain();
    const first = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const complete = committedState(domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), first));
    const second = selectedAt(complete, 1);
    expect(second.target).not.toBeNull();
    if (!second.target) return;
    const stale = committedState(domain.reviewCandidate({
      tenantId: 'tenant-mock-006',
      mappingReference: second.aggregate.mappingReference,
      candidateDigest: second.target.candidateDigest,
      action: 'expire_candidate',
      reviewerRole: 'institution_operator',
      occurredAt: '2026-07-13T12:00:00.000Z',
    }, complete));

    const result = domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T13:00:00.000Z',
    }), stale);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextState.sourceScopeRuntimeIndex).toMatchObject({
        generationCursor: 2,
        generationComplete: true,
      });
      expect(selectedAt(result.nextState, 1).target?.candidateVersion).toBe(2);
    }
  });

  it('P1-1 stale state regeneration 不得退化为 generation_cursor_mismatch', () => {
    const { domain, state } = generate();
    const stale = committedState(domain.reviewCandidate(reviewCommand(state, 'expire_candidate'), state));
    const result = domain.generateCandidate(generationCommand({
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), stale);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action).toBe('generate_candidate');
      expect(selected(result.nextState).aggregate.mappingStatus).not.toBe('stale');
    } else {
      expect(result.auditEvent.reasonCode).not.toBe('generation_cursor_mismatch');
    }
  });

  it('P1-1 review_reopened state regeneration 不得退化为 generation_cursor_mismatch', () => {
    const { domain, state } = generate();
    const rejected = committedState(domain.reviewCandidate(reviewCommand(state, 'reject'), state));
    const reopened = committedState(domain.reviewCandidate(reviewCommand(rejected, 'reopen', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), rejected));
    const result = domain.generateCandidate(generationCommand({
      occurredAt: '2026-07-13T13:00:00.000Z',
    }), reopened);

    expect(result.ok).toBe(true);
    if (result.ok) expect(selected(result.nextState).aggregate.reasonCode).not.toBe('review_reopened');
    else expect(result.auditEvent.reasonCode).not.toBe('generation_cursor_mismatch');
  });

  it('P1-1 module-owned empty manifest 的 null selector 必须可达 committed no_candidate', () => {
    const tenantId = 'tenant-mock-005';
    const command = generationCommand({ manifestEntryReference: null }, tenantId);
    const result = requireDomain().generateCandidate(command, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      action: 'generate_candidate',
      resultKind: 'no_candidate',
      nextState: {
        sourceScopeRuntimeIndex: {
          generationCursor: 0,
          generationComplete: true,
          records: [],
        },
        mappings: [],
      },
      auditEvent: {
        eventType: 'mapping_candidate_generation_empty',
        reasonCode: 'no_eligible_candidate',
      },
    });
  });

  it('P1-1 非空 module manifest 不能由 null selector 伪装成 no_candidate 完成态', () => {
    const result = requireDomain().generateCandidate(
      generationCommand({ manifestEntryReference: null }),
      null,
    );

    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('generation_cursor_mismatch');
  });

  it('正常生成单个低敏 high candidate，但 high 不会自动 matched', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result, state } = generate();
    const mapping = selected(state);

    expect(result).toMatchObject({
      ok: true,
      action: 'generate_candidate',
      resultKind: 'candidate_generated',
      mappingReview: null,
      mappingDecision: null,
      mappingConflict: null,
      auditEvent: {
        eventType: 'mapping_candidate_generated',
        mappingStatusBefore: 'unmatched',
        mappingStatusAfter: 'candidate',
      },
    });
    expect(mapping.aggregate).toMatchObject({
      tenantId: 'tenant-mock-001',
      mappingStatus: 'candidate',
      reasonCode: 'candidate_evidence_available',
      containsRealCustomerData: false,
      autoMergePerformed: false,
      realCustomerRelationshipWritten: false,
    });
    expect(mapping.target).toMatchObject({
      confidenceScore: 80,
      confidenceLevel: 'high',
      candidateActive: true,
      autoMergePerformed: false,
      realCustomerRelationshipWritten: false,
    });
    expect(mapping.aggregate.mappingStatus).not.toBe('matched');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it.each([
    ['ordinaryExtra', 'unknown_field_blocked'],
    ['rawResponse', 'forbidden_field_blocked'],
    ['webhookPayload', 'forbidden_field_blocked'],
    ['apiResponse', 'forbidden_field_blocked'],
    ['candidateDigest', 'unknown_field_blocked'],
    ['status', 'unknown_field_blocked'],
    ['reasonCode', 'unknown_field_blocked'],
    ['auditReady', 'unknown_field_blocked'],
  ])('generation 顶层字段 %s fail-closed', (field, reasonCode) => {
    const result = requireDomain().generateCandidate(
      generationCommand({ [field]: field.includes('Response') || field.includes('Payload') ? {} : 'tampered' }),
      null,
    );
    expectBlocked(result, 'forbidden_field_blocked', reasonCode);
  });

  it.each(['rawResponse', 'webhookPayload', 'apiResponse'])('generation nested %s fail-closed', (field) => {
    const command = generationCommand();
    const contact = { ...command.externalContacts[0], [field]: { value: 'opaque' } };
    const result = requireDomain().generateCandidate({ ...command, externalContacts: [contact] }, null);
    expectBlocked(result, 'forbidden_field_blocked', 'forbidden_field_blocked');
    expectAuditSafe(result, [field]);
  });

  it.each(['rawResponse', 'webhookPayload', 'apiResponse'])('allowed scalar 承载 nested %s container 被阻断', (field) => {
    const result = requireDomain().generateCandidate(
      generationCommand({ manifestEntryReference: { [field]: 'opaque' } }),
      null,
    );
    expectBlocked(result, 'forbidden_field_blocked', 'nested_raw_payload_blocked');
  });

  it.each([
    'tenant-mock-abc',
    'tenant-mock-0001',
    'tenant-mock-a1-b2',
    'tenant-demo-client-2026',
    'tenant-mock-abcdefghijklmnopqrstuvwxyz123456',
  ])('P1C tenant grammar 接受 3–32 位 suffix 的小写字母数字和单连字符：%s', (tenantId) => {
    const command = generationCommand({ tenantId });
    const result = requireDomain().generateCandidate(command, null);
    expect(result.auditEvent.reasonCode).not.toBe('unsafe_tenant_id_blocked');
  });

  it.each([
    'tenant-mock-001\n',
    'tenant-mock-001\r\n',
    'tenant-mock-001 ',
    'tenant-mock-001 ',
    'tenant-mock-01',
    'tenant-mock-001-',
    'tenant-MOCK-001',
    ' tenant-mock-001',
  ])('非法 root tenantId 使用固定低敏占位：%j', (tenantId) => {
    const result = requireDomain().generateCandidate(generationCommand({ tenantId }), null);
    expectBlocked(result, 'unsafe_tenant_id_blocked', 'unsafe_tenant_id_blocked');
    expect(result.auditEvent).toMatchObject({
      tenantId: 'tenant_blocked',
      timestamp: '1970-01-01T00:00:00.000Z',
      candidateDigest: ZERO_DIGEST,
    });
    expectAuditSafe(result, [tenantId]);
  });

  it.each([
    'tenant-mock-001\nphone=13800138000',
    'tenant-mock-001\r\nsecret=opaque',
    'tenant-mock-001 externalUserId=wm_opaque',
    'tenant-mock-001 credential=opaque',
  ])('tenantId 全长 sensitive scan 优先于 grammar：%j', (tenantId) => {
    const result = requireDomain().generateCandidate(generationCommand({ tenantId }), null);
    expectBlocked(result, 'forbidden_field_blocked', 'sensitive_value_blocked');
    expect(result.auditEvent.tenantId).toBe('tenant_blocked');
    expectAuditSafe(result, [tenantId]);
  });

  it.each([
    '2026-07-13T10:00:00.000Z\n',
    '2026-07-13T10:00:00.000Z\r\n',
    '2026-07-13T10:00:00.000Z ',
    '2026-07-13T10:00:00.000Z ',
    '2026-02-30T10:00:00.000Z',
    '2026-07-13T10:00:00Z',
    '2026-07-13T18:00:00.000+08:00',
  ])('非 canonical occurredAt 使用固定安全时间：%j', (occurredAt) => {
    const result = requireDomain().generateCandidate(generationCommand({ occurredAt }), null);
    expectBlocked(result, 'unsafe_occurred_at_blocked', 'unsafe_occurred_at_blocked');
    expect(result.auditEvent.timestamp).toBe('1970-01-01T00:00:00.000Z');
    expectAuditSafe(result, [occurredAt]);
  });

  it.each([
    '2026-07-13T10:00:00.000Z\nphone=13800138000',
    '2026-07-13T10:00:00.000Z\r\nsecret=opaque',
    '2026-07-13T10:00:00.000Z externalUserId=wo_opaque',
    '2026-07-13T10:00:00.000Z credential=opaque',
  ])('occurredAt 全长 sensitive scan 优先于 timestamp grammar：%j', (occurredAt) => {
    const result = requireDomain().generateCandidate(generationCommand({ occurredAt }), null);
    expectBlocked(result, 'forbidden_field_blocked', 'sensitive_value_blocked');
    expect(result.auditEvent.timestamp).toBe('1970-01-01T00:00:00.000Z');
    expectAuditSafe(result, [occurredAt]);
  });

  it('P1C String.prototype.normalize 污染不得改变 scanner 或 domain 行为', () => {
    const normalize = vi.spyOn(String.prototype, 'normalize').mockImplementation(() => {
      throw new TypeError('ambient normalize poisoned');
    });
    try {
      const result = requireDomain().generateCandidate(generationCommand(), null);
      expect(result.ok).toBe(true);
    } finally {
      normalize.mockRestore();
    }
  });

  it('P1C nested string sensitive scan 优先于 scalar grammar reason', () => {
    const command = generationCommand();
    const nested = {
      ...command.externalContacts[0],
      followUsers: [{
        ...command.externalContacts[0].followUsers[0],
        ownershipStatus: 'phone=13800138000',
      }],
    };
    const result = requireDomain().generateCandidate({ ...command, externalContacts: [nested] }, null);
    expectBlocked(result, 'forbidden_field_blocked', 'sensitive_value_blocked');
  });

  it('P1C source hash 对 root 与 nested collection insertion order 规范化', () => {
    const command = multiGenerationCommand(0);
    const reordered = multiGenerationCommand(0);
    reordered.externalContacts.reverse();
    reordered.systemCustomers.reverse();
    reordered.externalContacts[1].followUsers.reverse();
    reordered.externalContacts[1].tags.reverse();
    reordered.systemCustomers[1].tagNames.reverse();

    const normal = requireDomain().generateCandidate(command, null);
    const permuted = requireDomain().generateCandidate(reordered, null);
    expect(normal.ok).toBe(true);
    expect(permuted.ok).toBe(true);
    if (normal.ok && permuted.ok) {
      expect(normal.nextState.sourceScopeRuntimeIndex.fixtureRegistryDigest)
        .toBe(permuted.nextState.sourceScopeRuntimeIndex.fixtureRegistryDigest);
      expect(selected(normal.nextState).aggregate.sourceSnapshotDigest)
        .toBe(selected(permuted.nextState).aggregate.sourceSnapshotDigest);
    }
  });

  it('P1C source hash 使用 schema 固定 nested object field order', () => {
    const command = generationCommand();
    const followUser = command.externalContacts[0].followUsers[0] as unknown as Record<string, unknown>;
    const tenantId = followUser.tenantId;
    delete followUser.tenantId;
    followUser.tenantId = tenantId;

    const result = requireDomain().generateCandidate(command, null);
    expect(result.ok).toBe(true);
  });

  it('P1C nested collection identity 重复必须 fail-closed', () => {
    const command = multiGenerationCommand(0);
    command.externalContacts[0].followUsers.push({ ...command.externalContacts[0].followUsers[0] });
    const result = requireDomain().generateCandidate(command, null);
    expectBlockedWithoutState(result);
  });

  it('nested tenant mismatch fail-closed 且不回显任一 tenant 原文', () => {
    const command = generationCommand();
    const customer = { ...command.systemCustomers[0], tenantId: 'tenant-mock-009' };
    const result = requireDomain().generateCandidate({ ...command, systemCustomers: [customer] }, null);
    expectBlocked(result, 'mapping_tenant_mismatch_blocked', 'tenant_mismatch');
    expect(result.auditEvent.tenantId).toBe('tenant_blocked');
    expectAuditSafe(result, ['tenant-mock-001', 'tenant-mock-009']);
  });

  it.each([
    ['tenant-mock-002', 'provider_disabled'],
    ['tenant-mock-003', 'external_provider_disabled'],
    ['tenant-demo-001', 'authorization_revoked'],
  ])('readiness guard 对 %s 生成低敏 audit', (tenantId, reasonCode) => {
    const result = requireDomain().generateCandidate(generationCommand({}, tenantId), null);
    expectBlocked(result, 'mapping_provider_disabled', reasonCode);
    expect(result.auditEvent.mappingStatusAfter).toBe('unmatched');
  });

  it('audit precondition 失败时不产生 candidate 或 partial state', () => {
    const result = requireDomain().generateCandidate(generationCommand({}, 'tenant-mock-004'), null);
    expectBlocked(result, 'mapping_audit_not_ready_blocked', 'audit_not_ready');
  });

  it.each(['approve', 'reject', 'request_more_info', 'mark_conflict', 'clear_candidate', 'expire_candidate'])(
    '%s 从 candidate 产生契约规定的状态且只提交一次',
    (action) => {
      const { domain, state } = generate();
      const result = domain.reviewCandidate(reviewCommand(state, action), state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const expectedByAction: Record<string, readonly [string, string]> = {
        approve: ['matched', 'approved_by_manual_review'],
        reject: ['rejected', 'rejected_by_manual_review'],
        request_more_info: ['needs_more_info', 'more_info_requested'],
        mark_conflict: ['conflict', 'mapping_conflict'],
        clear_candidate: ['cleared_locked', 'candidate_cleared_locked'],
        expire_candidate: ['stale', 'candidate_expired'],
      };
      const expected = expectedByAction[action];
      expect(selected(result.nextState).aggregate).toMatchObject({
        mappingStatus: expected[0],
        reasonCode: expected[1],
        autoMergePerformed: false,
        realCustomerRelationshipWritten: false,
      });
      expect(result.mappingReview).not.toBeNull();
      expect(result.mappingDecision).toMatchObject({ action, mappingStatusAfter: expected[0] });
      expect(selected(result.nextState).history.entries).toHaveLength(2);
    },
  );

  it.each(['matched', 'rejected', 'needs_more_info'] as const)('reopen 从 %s 进入 locked review state', (sourceStatus) => {
    const action = sourceStatus === 'matched'
      ? 'approve'
      : sourceStatus === 'rejected'
        ? 'reject'
        : 'request_more_info';
    const { domain, state } = generate();
    const first = domain.reviewCandidate(reviewCommand(state, action), state);
    const firstState = committedState(first);
    const second = domain.reviewCandidate(reviewCommand(firstState, 'reopen', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), firstState);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(selected(second.nextState).aggregate).toMatchObject({
      mappingStatus: 'manual_review_required',
      reasonCode: 'review_reopened',
    });
    expect(selected(second.nextState).target).toMatchObject({ candidateActive: false, lineageLocked: false });
  });

  it('conflict clear 后进入 cleared_locked，reopen 与 approve 均不能绕过 lock', () => {
    const { domain, state } = generate();
    const conflicted = domain.reviewCandidate(reviewCommand(state, 'mark_conflict'), state);
    const conflictState = committedState(conflicted);
    const cleared = domain.reviewCandidate(reviewCommand(conflictState, 'clear_candidate', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), conflictState);
    const clearedState = committedState(cleared);

    expect(selected(clearedState).aggregate.mappingStatus).toBe('cleared_locked');
    for (const action of ['approve', 'reopen']) {
      const blocked = domain.reviewCandidate(reviewCommand(clearedState, action, {
        occurredAt: '2026-07-13T13:00:00.000Z',
      }), clearedState);
      expectBlocked(blocked, 'mapping_invalid_transition_blocked', 'invalid_state_transition');
    }
  });

  it.each([
    ['unknown', 'unknown_field_blocked'],
    ['rawResponse', 'forbidden_field_blocked'],
    ['webhookPayload', 'forbidden_field_blocked'],
    ['apiResponse', 'forbidden_field_blocked'],
    ['status', 'unknown_field_blocked'],
    ['reasonCode', 'unknown_field_blocked'],
    ['sourceKind', 'unknown_field_blocked'],
    ['dataMode', 'unknown_field_blocked'],
    ['mappingReview', 'unknown_field_blocked'],
    ['mappingDecision', 'unknown_field_blocked'],
    ['mappingConflict', 'unknown_field_blocked'],
  ])('review 顶层注入 %s fail-closed', (field, reasonCode) => {
    const { domain, state } = generate();
    const result = domain.reviewCandidate(reviewCommand(state, 'approve', {
      [field]: field.includes('Response') || field.includes('Payload') ? {} : 'tampered',
    }), state);
    expectBlocked(result, 'forbidden_field_blocked', reasonCode);
  });

  it.each(['rawResponse', 'webhookPayload', 'apiResponse'])('review allowed scalar 的 nested %s fail-closed', (field) => {
    const { domain, state } = generate();
    const result = domain.reviewCandidate(reviewCommand(state, 'approve', {
      candidateDigest: { [field]: 'opaque' },
    }), state);
    expectBlocked(result, 'forbidden_field_blocked', 'nested_raw_payload_blocked');
  });

  it.each([
    'not-a-digest',
    `sha256:${'A'.repeat(64)}`,
    `sha256:${'a'.repeat(63)}`,
    `${digest('a')}\n`,
    `${digest('a')}\r\n`,
    `${digest('a')} `,
    `${digest('a')} `,
    ZERO_DIGEST,
  ])('candidateDigest 非 canonical 值被阻断：%j', (candidateDigest) => {
    const { domain, state } = generate();
    const result = domain.reviewCandidate(reviewCommand(state, 'approve', { candidateDigest }), state);
    expectBlocked(result, 'mapping_input_blocked', 'invalid_scalar_value');
    expect(result.auditEvent.candidateDigest).toBe(ZERO_DIGEST);
  });

  it.each([
    'phone=13800138000',
    'secret=opaque',
    'credential=opaque',
    'externalUserId=wm_opaque',
    `sha256:${'a'.repeat(20)}\nphone=13800138000`,
  ])('candidateDigest 的敏感值在 target lookup 前阻断：%j', (candidateDigest) => {
    const { domain, state } = generate();
    const result = domain.reviewCandidate(reviewCommand(state, 'approve', { candidateDigest }), state);
    expectBlocked(result, 'forbidden_field_blocked', 'sensitive_value_blocked');
    expect(result.auditEvent.candidateDigest).toBe(ZERO_DIGEST);
    expectAuditSafe(result, [candidateDigest]);
  });

  it.each([
    ['reviewerRole', 'domain_system'],
    ['reviewerRole', 'platform_admin'],
    ['action', 'auto_approve'],
    ['action', 'approve\nsecret=opaque'],
  ])('%s 篡改为 %j 时 fail-closed', (field, value) => {
    const { domain, state } = generate();
    const result = domain.reviewCandidate(reviewCommand(state, 'approve', { [field]: value }), state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.auditEvent.mappingStatusAfter).not.toBe('matched');
  });

  it('格式合法但不匹配 target 的 candidateDigest fail-closed', () => {
    const { domain, state } = generate();
    const result = domain.reviewCandidate(reviewCommand(state, 'approve', {
      candidateDigest: digest('f'),
    }), state);
    expectBlocked(result, 'mapping_candidate_guard_blocked', 'candidate_target_not_found');
  });

  it('review root tenantId 与 occurredAt 使用相同 scanner、grammar 和安全占位', () => {
    const { domain, state } = generate();
    const unsafeTenant = 'tenant-mock-001\nphone=13800138000';
    const tenantResult = domain.reviewCandidate(reviewCommand(state, 'approve', {
      tenantId: unsafeTenant,
    }), state);
    expectBlocked(tenantResult, 'forbidden_field_blocked', 'sensitive_value_blocked');
    expect(tenantResult.auditEvent.tenantId).toBe('tenant_blocked');
    expectAuditSafe(tenantResult, [unsafeTenant]);

    const unsafeTime = `${NEXT_OCCURRED_AT} externalUserId=wo_opaque`;
    const timeResult = domain.reviewCandidate(reviewCommand(state, 'approve', {
      occurredAt: unsafeTime,
    }), state);
    expectBlocked(timeResult, 'forbidden_field_blocked', 'sensitive_value_blocked');
    expect(timeResult.auditEvent.timestamp).toBe('1970-01-01T00:00:00.000Z');
    expectAuditSafe(timeResult, [unsafeTime]);
  });

  it.each(['rejected', 'stale', 'disabled', 'cleared_locked'] as const)(
    '状态 %s 下 approve 不可能产生 matched',
    (status) => {
      const { domain, state } = generate();
      let current = state;
      if (status === 'rejected') {
        current = committedState(domain.reviewCandidate(reviewCommand(current, 'reject'), current));
      } else if (status === 'stale') {
        current = committedState(domain.reviewCandidate(reviewCommand(current, 'expire_candidate'), current));
      } else if (status === 'cleared_locked') {
        current = committedState(domain.reviewCandidate(reviewCommand(current, 'clear_candidate'), current));
      } else {
        current = committedState(domain.disableMapping(disableCommand(current), current));
      }
      const result = domain.reviewCandidate(reviewCommand(current, 'approve', {
        occurredAt: '2026-07-13T12:00:00.000Z',
      }), current);
      expectBlocked(result, 'mapping_invalid_transition_blocked', 'invalid_state_transition');
      expect(auditJson(result)).not.toContain('"mappingStatusAfter":"matched"');
    },
  );

  it('P1-2 selected target missing 时 disable 必须 quarantine 后单向关闭', () => {
    const { domain, state } = generate();
    const missingTarget = withSelectedTargetDescriptor(state, null);
    const result = domain.disableMapping(disableCommand(state), missingTarget);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(selected(result.nextState)).toMatchObject({
      aggregate: { mappingStatus: 'disabled', candidateDigest: null },
      target: null,
    });
  });

  it('P1-2 selected target getter 不得被 full parse 抢先读取', () => {
    const { domain, state } = generate();
    const getter = vi.fn(() => selected(state).target);
    const accessorTarget = withSelectedTargetDescriptor(state, { get: getter });
    const result = domain.disableMapping(disableCommand(state), accessorTarget);

    expect(getter).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(selected(result.nextState).target).toBeNull();
  });

  it('P1C selected target non-enumerable data descriptor 仍 quarantine 后单向关闭', () => {
    const { domain, state } = generate();
    const quarantined = withSelectedTargetDescriptor(state, {
      value: selected(state).target,
      writable: true,
      enumerable: false,
    });

    const result = domain.disableMapping(disableCommand(state), quarantined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(selected(result.nextState).target).toBeNull();
  });

  it('P1-2 selected target Proxy 不得被普通解析触发', () => {
    const { domain, state } = generate();
    let traps = 0;
    const proxy = new Proxy(selected(state).target as object, {
      get() {
        traps += 1;
        throw new Error('selected target proxy must remain quarantined');
      },
      getOwnPropertyDescriptor() {
        traps += 1;
        throw new Error('selected target proxy must remain quarantined');
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error('selected target proxy must remain quarantined');
      },
      ownKeys() {
        traps += 1;
        throw new Error('selected target proxy must remain quarantined');
      },
    });
    const proxyTarget = withSelectedTargetDescriptor(state, { value: proxy, writable: true });
    const result = domain.disableMapping(disableCommand(state), proxyTarget);

    expect(traps).toBe(0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(selected(result.nextState).target).toBeNull();
  });

  it('P1-2 non-selected mapping accessor 仍必须 fail-closed 且 getter 零调用', () => {
    const { domain, state } = generate();
    const expanded = jsonState(state);
    const index = expanded.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
    const records = index.records as Array<Record<string, unknown>>;
    const mappings = expanded.mappings as unknown as Array<Record<string, unknown>>;
    records.push(JSON.parse(JSON.stringify(records[0])) as Record<string, unknown>);
    mappings.push(JSON.parse(JSON.stringify(mappings[0])) as Record<string, unknown>);
    index.generationCursor = 2;
    rehashRuntimeIndex(expanded);
    const getter = vi.fn(() => null);
    Object.defineProperty(mappings[1], 'target', { enumerable: true, configurable: true, get: getter });

    const result = domain.disableMapping(disableCommand(state), expanded);
    expectBlockedWithoutState(result);
    expect(getter).not.toHaveBeenCalled();
  });

  it('P1-2 selected mapping 只 quarantine target，额外字段仍 fail-closed 且 getter 零调用', () => {
    const { domain, state } = generate();
    const injected = jsonState(state);
    const getter = vi.fn(() => ({ opaque: true }));
    Object.defineProperty(
      injected.mappings[0] as unknown as Record<string, unknown>,
      'rawResponse',
      { enumerable: true, configurable: true, get: getter },
    );

    const result = domain.disableMapping(disableCommand(state), injected);
    expectBlockedWithoutState(result);
    expect(getter).not.toHaveBeenCalled();
  });

  it('P1-2 disable 在 materialize mappings keys 前拒绝超长稀疏数组', () => {
    const { domain, state } = generate();
    const oversized = jsonState(state);
    (oversized as unknown as Record<string, unknown>).mappings = new Array(101);

    const result = domain.disableMapping(disableCommand(state), oversized);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('source_scope_state_invalid');
  });

  it('P1-2 disable 在读取 mappings.length 前先拒绝 Proxy 且零 trap', () => {
    const { domain, state } = generate();
    const proxied = jsonState(state);
    let traps = 0;
    (proxied as unknown as Record<string, unknown>).mappings = new Proxy([], {
      get() {
        traps += 1;
        throw new Error('mappings proxy must remain unopened');
      },
    });

    const result = domain.disableMapping(disableCommand(state), proxied);
    expectBlockedWithoutState(result);
    expect(traps).toBe(0);
  });

  it('P1C containment 拒绝 non-selected duplicate manifest identity', () => {
    const domain = requireDomain();
    const first = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const complete = committedState(domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), first));
    const duplicated = jsonState(complete);
    const records = duplicated.sourceScopeRuntimeIndex.records as unknown as Array<Record<string, unknown>>;
    records[1].manifestEntryReference = records[0].manifestEntryReference;
    rehashRuntimeIndex(duplicated);

    const result = domain.disableMapping({
      tenantId: 'tenant-mock-006',
      mappingReference: duplicated.mappings[0].aggregate.mappingReference,
      action: 'disable_mapping',
      reviewerRole: 'platform_governance',
      occurredAt: '2026-07-13T12:00:00.000Z',
    }, duplicated);
    expectBlockedWithoutState(result);
  });

  it('P1C containment index invalid 优先于 selector 0-hit', () => {
    const { domain, state } = generate();
    const corrupted = jsonState(state);
    (corrupted.sourceScopeRuntimeIndex as unknown as Record<string, unknown>).indexDigest = digest('f');

    const result = domain.disableMapping(disableCommand(state, {
      mappingReference: `ref-mock-${'e'.repeat(48)}`,
    }), corrupted);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('source_scope_state_invalid');
  });

  it('P1C revoked Proxy state 返回 blocked 且不抛异常', () => {
    const { domain, state } = generate();
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    expect(() => domain.disableMapping(disableCommand(state), proxy)).not.toThrow();
    expectBlockedWithoutState(domain.disableMapping(disableCommand(state), proxy));
  });

  it('P1C ambient Object.freeze 污染不影响 committed recursive freeze', () => {
    const domain = requireDomain();
    const originalFreeze = Object.freeze;
    Object.freeze = ((value: object) => value) as typeof Object.freeze;
    try {
      const result = domain.generateCandidate(generationCommand(), null);
      expect(result.ok).toBe(true);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.auditEvent)).toBe(true);
      if (result.ok) expect(Object.isFrozen(result.nextState)).toBe(true);
    } finally {
      Object.freeze = originalFreeze;
    }
  });

  it('P1C selected aggregate material drift 在 containment 中 fail-closed', () => {
    const { domain, state } = generate();
    const tampered = jsonState(state);
    (selected(tampered).aggregate as unknown as Record<string, unknown>).candidatePairDigest = digest('f');
    const result = domain.disableMapping(disableCommand(state), tampered);
    expectBlockedWithoutState(result);
  });

  it('P1C selected history material drift 在 containment 中 fail-closed', () => {
    const { domain, state } = generate();
    const tampered = jsonState(state);
    const entries = selected(tampered).history.entries as unknown as Array<Record<string, unknown>>;
    (entries[0].targetSnapshot as Record<string, unknown>).systemCustomerSummary = '[MOCK] drift';
    const result = domain.disableMapping(disableCommand(state), tampered);
    expectBlockedWithoutState(result);
  });

  it('P1C selected lineage material drift 在 containment 中 fail-closed', () => {
    const { domain, state } = generate();
    const conflicted = committedState(domain.reviewCandidate(reviewCommand(state, 'mark_conflict'), state));
    const tampered = jsonState(conflicted);
    const index = tampered.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
    const lineage = index.lineageLockIndex as Record<string, unknown>;
    const records = lineage.records as Array<Record<string, unknown>>;
    records[0].sourceSnapshotDigest = digest('f');
    rehashLineageAndRuntime(tampered);
    const result = domain.disableMapping(disableCommand(conflicted, {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), tampered);
    expectBlockedWithoutState(result);
  });

  it('P1-3 regeneration 同样绑定 persisted source snapshot provenance', () => {
    const { domain, state } = generate();
    const stale = committedState(domain.reviewCandidate(reviewCommand(state, 'expire_candidate'), state));
    const tampered = jsonState(stale);
    (selected(tampered).aggregate as unknown as Record<string, unknown>).sourceSnapshotDigest = digest('f');

    const result = domain.generateCandidate(generationCommand({
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), tampered);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/provenance|integrity/);
  });

  it('P1-3 disable 不读取 registry，但必须绑定 persisted containment material', () => {
    const { domain, state } = generate();
    const tampered = jsonState(state);
    const aggregate = selected(tampered).aggregate as unknown as Record<string, unknown>;
    aggregate.sourceSnapshotDigest = digest('f');
    const historical = selected(tampered).history.entries[0].targetSnapshot;
    expect(historical).not.toBeNull();
    if (historical) {
      const index = tampered.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
      const lineage = index.lineageLockIndex as Record<string, unknown>;
      lineage.indexVersion = 2;
      lineage.records = [{
        tenantId: historical.tenantId,
        sourceScopeReference: aggregate.sourceScopeReference,
        mappingReference: historical.mappingReference,
        candidateDigest: historical.candidateDigest,
        externalContactDigest: historical.externalContactDigest,
        systemCustomerDigest: historical.systemCustomerDigest,
        candidatePairDigest: historical.candidatePairDigest,
        evidenceFingerprint: historical.evidenceFingerprint,
        sourceSnapshotDigest: digest('e'),
        lockType: 'conflict',
        conflictOrigin: 'manual_review_mark_conflict',
        conflictType: 'manual_marked',
        unresolvedConflictCount: 1,
        createdAt: historical.createdAt,
        sourceKind: historical.sourceKind,
        dataMode: historical.dataMode,
      }];
      rehashLineageAndRuntime(tampered);
    }

    const result = domain.disableMapping(disableCommand(state), tampered);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/lineage|integrity/);
  });

  it('P1-3 sourceSnapshotDigest 单字段篡改不能以 trusted mask 通过 approve', () => {
    const { domain, state } = generate();
    const tampered = jsonState(state);
    const aggregate = selected(tampered).aggregate as unknown as Record<string, unknown>;
    const sensitiveDigest = `sha256:${'a'.repeat(20)}13800138000${'b'.repeat(33)}`;
    aggregate.sourceSnapshotDigest = sensitiveDigest;

    const result = domain.reviewCandidate(reviewCommand(tampered, 'approve'), tampered);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.mappingStatusAfter).not.toBe('matched');
    expect(JSON.stringify(result)).not.toContain(sensitiveDigest);
  });

  it('P1-3 sourceSnapshotDigest 必须绑定 registry provenance，而非只验证 grammar', () => {
    const { domain, state } = generate();
    const tampered = jsonState(state);
    (selected(tampered).aggregate as unknown as Record<string, unknown>).sourceSnapshotDigest = digest('f');

    const result = domain.reviewCandidate(reviewCommand(tampered, 'approve'), tampered);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/provenance|integrity|lineage/);
  });

  it('P1C 旧 candidateVersion 的全部 snapshots 同步 material drift 仍 fail-closed', () => {
    const { domain, state } = generate();
    const stale = committedState(domain.reviewCandidate(reviewCommand(state, 'expire_candidate'), state));
    const regenerated = committedState(domain.generateCandidate(generationCommand({
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), stale));
    const drifted = jsonState(regenerated);
    const entries = selected(drifted).history.entries as unknown as Array<Record<string, unknown>>;
    for (const entry of entries) {
      const snapshot = entry.targetSnapshot as Record<string, unknown> | null;
      if (snapshot?.candidateVersion === 1) snapshot.systemCustomerSummary = '[MOCK] 漂移';
    }
    rehashHistoryAndRuntime(drifted);

    const result = domain.reviewCandidate(reviewCommand(drifted, 'approve', {
      occurredAt: '2026-07-13T13:00:00.000Z',
    }), drifted);
    expectBlockedWithoutState(result);
  });

  it('P1C 旧 history snapshot 状态 flags 必须匹配每条 entry after status', () => {
    const { domain, state } = generate();
    const matched = committedState(domain.reviewCandidate(reviewCommand(state, 'approve'), state));
    const drifted = jsonState(matched);
    const snapshot = selected(drifted).history.entries[0].targetSnapshot as unknown as Record<string, unknown>;
    snapshot.candidateSourceStatus = 'inactive';
    snapshot.candidateActive = false;
    rehashHistoryAndRuntime(drifted);

    const result = domain.reviewCandidate(reviewCommand(drifted, 'reopen', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), drifted);
    expectBlockedWithoutState(result);
  });

  it('P1C history entry field order 改写即使重算公开 digest 也 fail-closed', () => {
    const { domain, state } = generate();
    const reordered = jsonState(state);
    const history = selected(reordered).history as unknown as Record<string, unknown>;
    const entries = history.entries as Array<Record<string, unknown>>;
    const entry = entries[0];
    const tenantId = entry.tenantId;
    delete entry.tenantId;
    entry.tenantId = tenantId;
    rehashHistoryAndRuntime(reordered);

    const result = domain.reviewCandidate(reviewCommand(reordered, 'approve'), reordered);
    expectBlockedWithoutState(result);
  });

  it('P1C history entry tenant/scope/reference/source/mode 必须全链一致', () => {
    const { domain, state } = generate();
    const drifted = jsonState(state);
    const entry = selected(drifted).history.entries[0] as unknown as Record<string, unknown>;
    entry.tenantId = 'tenant-mock-009';
    rehashHistoryAndRuntime(drifted);

    const result = domain.reviewCandidate(reviewCommand(drifted, 'approve'), drifted);
    expectBlockedWithoutState(result);
  });

  it('P1C 任意历史 after snapshot material drift 即使重算公开 digest 也 fail-closed', () => {
    const { domain, state } = generate();
    const matched = committedState(domain.reviewCandidate(reviewCommand(state, 'approve'), state));
    const drifted = jsonState(matched);
    const entries = selected(drifted).history.entries as unknown as Array<Record<string, unknown>>;
    (entries[0].targetSnapshot as Record<string, unknown>).confidenceScore = 79;
    rehashAllMappingsAndRuntime(drifted);

    const result = domain.reviewCandidate(reviewCommand(drifted, 'reopen', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), drifted);
    expectBlockedWithoutState(result);
  });

  it('P1C disabled current-null 与 immutable historical non-null digest 合法闭环', () => {
    const { domain, state } = generate();
    const historicalDigest = selected(state).target?.candidateDigest;
    const disabled = domain.disableMapping(disableCommand(state), state);
    expect(disabled.ok).toBe(true);
    if (!disabled.ok) return;
    const mapping = selected(disabled.nextState);
    expect(mapping.target).toBeNull();
    expect(mapping.aggregate.candidateDigest).toBeNull();
    expect(mapping.history.entries[0].targetSnapshot?.candidateDigest).toBe(historicalDigest);
  });

  it('P1C disabled review 在 transition guard 前验证 historical pair binding', () => {
    const { domain, state } = generate();
    const disabled = committedState(domain.disableMapping(disableCommand(state), state));
    const drifted = jsonState(disabled);
    const aggregate = selected(drifted).aggregate as unknown as Record<string, unknown>;
    const records = drifted.sourceScopeRuntimeIndex.records as unknown as Array<Record<string, unknown>>;
    aggregate.candidatePairDigest = digest('f');
    records[0].candidatePairDigest = digest('f');
    rehashRuntimeIndex(drifted);

    const result = domain.reviewCandidate(reviewCommand(disabled, 'approve', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), drifted);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('aggregate_lineage_mismatch');
  });

  it('P1C disabled current-null 的 historical candidate digest 篡改必须 fail-closed', () => {
    const { domain, state } = generate();
    const disabled = committedState(domain.disableMapping(disableCommand(state), state));
    const drifted = jsonState(disabled);
    const entries = selected(drifted).history.entries as unknown as Array<Record<string, unknown>>;
    (entries[0].targetSnapshot as Record<string, unknown>).candidateDigest = digest('f');
    rehashAllMappingsAndRuntime(drifted);

    const result = domain.disableMapping(disableCommand(disabled, {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), drifted);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).not.toBe('mapping_already_disabled');
  });

  it('P1-4 current target 必须与 history 最后一条 after snapshot canonical 相等', () => {
    const { domain, state } = generate();
    const drifted = jsonState(state);
    const history = selected(drifted).history as unknown as Record<string, unknown>;
    const entries = history.entries as Array<Record<string, unknown>>;
    const snapshot = entries.at(-1)?.targetSnapshot as Record<string, unknown>;
    snapshot.candidateActive = false;
    history.historyDigest = digestValues('zmtg:05c-e1:mapping-history:v1', [
      history.tenantId,
      history.sourceScopeReference,
      history.mappingReference,
      history.historyVersion,
      history.complete,
      history.entries,
      history.sourceKind,
      history.dataMode,
    ]);
    (selected(drifted).aggregate as unknown as Record<string, unknown>).historyDigest = history.historyDigest;
    const index = drifted.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
    const records = index.records as Array<Record<string, unknown>>;
    records[0].historyDigest = history.historyDigest;
    rehashRuntimeIndex(drifted);

    const result = domain.reviewCandidate(reviewCommand(drifted, 'approve'), drifted);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/state|integrity|lineage|mismatch/);
  });

  it('P1-4 needs_more_info current target 漂移不能被 reopen 洗白', () => {
    const { domain, state } = generate();
    const moreInfo = committedState(domain.reviewCandidate(reviewCommand(state, 'request_more_info'), state));
    const drifted = jsonState(moreInfo);
    const target = selected(drifted).target as unknown as Record<string, unknown>;
    target.unresolvedConflictCount = 1;

    const result = domain.reviewCandidate(reviewCommand(drifted, 'reopen', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), drifted);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.mappingStatusAfter).toBe('needs_more_info');
  });

  it('P1-4 unlocked active candidate 携带 unresolved conflict lineage 时 approve 必须阻断', () => {
    const { domain, state } = generate();
    const locked = jsonState(state);
    const index = locked.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
    const lineage = index.lineageLockIndex as Record<string, unknown>;
    const target = selected(locked).target as unknown as Record<string, unknown>;
    const aggregate = selected(locked).aggregate as unknown as Record<string, unknown>;
    const record = {
      tenantId: target.tenantId,
      sourceScopeReference: aggregate.sourceScopeReference,
      mappingReference: target.mappingReference,
      candidateDigest: target.candidateDigest,
      externalContactDigest: target.externalContactDigest,
      systemCustomerDigest: target.systemCustomerDigest,
      candidatePairDigest: target.candidatePairDigest,
      evidenceFingerprint: target.evidenceFingerprint,
      sourceSnapshotDigest: aggregate.sourceSnapshotDigest,
      lockType: 'conflict',
      conflictOrigin: 'manual_review_mark_conflict',
      conflictType: 'manual_marked',
      unresolvedConflictCount: 1,
      createdAt: OCCURRED_AT,
      sourceKind: target.sourceKind,
      dataMode: target.dataMode,
    };
    lineage.indexVersion = 2;
    lineage.records = [record];
    lineage.indexDigest = digestValues('zmtg:05c-e1:lineage-index:v1', [
      lineage.tenantId,
      lineage.sourceScopeReference,
      lineage.indexVersion,
      lineage.records,
      lineage.sourceKind,
      lineage.dataMode,
    ]);
    rehashRuntimeIndex(locked);

    const result = domain.reviewCandidate(reviewCommand(locked, 'approve'), locked);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/conflict|lineage|lock/);
  });

  it('P1-4 persisted history candidateVersion 必须从 1 开始且 regeneration 连续递增', () => {
    const { domain, state } = generate();
    const stale = committedState(domain.reviewCandidate(reviewCommand(state, 'expire_candidate'), state));
    const forged = jsonState(stale);
    const target = selected(forged).target as unknown as Record<string, unknown>;
    const history = selected(forged).history as unknown as Record<string, unknown>;
    const entries = history.entries as Array<Record<string, unknown>>;
    for (const entry of entries) {
      const snapshot = entry.targetSnapshot as Record<string, unknown>;
      snapshot.candidateVersion = 2;
    }
    target.candidateVersion = 2;
    rehashHistoryAndRuntime(forged);

    const result = domain.generateCandidate(generationCommand({
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), forged);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/state|integrity|invalid/);
  });

  it('P1-4 regeneration 拒绝 current target 与 history 漂移及 candidateVersion 越界', () => {
    const { domain, state } = generate();
    const stale = committedState(domain.reviewCandidate(reviewCommand(state, 'expire_candidate'), state));
    const drifted = jsonState(stale);
    (selected(drifted).target as unknown as Record<string, unknown>).candidateVersion = 2_147_483_647;

    const result = domain.generateCandidate(generationCommand({
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), drifted);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/integrity|capacity/);
  });

  it('P1-4 persisted history action/role/transition 真值表不可自签改写', () => {
    const { domain, state } = generate();
    const matched = committedState(domain.reviewCandidate(reviewCommand(state, 'approve'), state));
    const forged = jsonState(matched);
    const entries = selected(forged).history.entries as unknown as Array<Record<string, unknown>>;
    entries.at(-1)!.action = 'reject';
    entries.at(-1)!.reviewerRole = 'domain_system';
    rehashHistoryAndRuntime(forged);

    const result = domain.reviewCandidate(reviewCommand(forged, 'reopen', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), forged);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toMatch(/state|integrity|invalid/);
  });

  it('P1-4 matched unresolvedConflictCount 不能被 reopen 洗白', () => {
    const { domain, state } = generate();
    const matched = committedState(domain.reviewCandidate(reviewCommand(state, 'approve'), state));
    const forged = jsonState(matched);
    const target = selected(forged).target as unknown as Record<string, unknown>;
    const entries = selected(forged).history.entries as unknown as Array<Record<string, unknown>>;
    const snapshot = entries.at(-1)!.targetSnapshot as Record<string, unknown>;
    target.unresolvedConflictCount = 1;
    snapshot.unresolvedConflictCount = 1;
    rehashHistoryAndRuntime(forged);

    const result = domain.reviewCandidate(reviewCommand(forged, 'reopen', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), forged);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.mappingStatusAfter).toBe('matched');
  });

  it('P1-4 lineage index envelope 与 runtime index 必须同 tenant/scope/mode', () => {
    const { domain, state } = generate();
    const forged = jsonState(state);
    const index = forged.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
    const lineage = index.lineageLockIndex as Record<string, unknown>;
    lineage.sourceScopeReference = 'ref-mock-scope-999';
    rehashLineageAndRuntime(forged);

    const result = domain.reviewCandidate(reviewCommand(forged, 'approve'), forged);
    expectBlockedWithoutState(result);
  });

  it('P1-6 captured intrinsic normalize 污染不影响 audit，mutation 保持原子提交', () => {
    const { domain, state } = generate();
    const originalNormalize = String.prototype.normalize;
    const normalize = vi.spyOn(String.prototype, 'normalize').mockImplementation(function (
      this: string,
      form?: string,
    ) {
      const value = String(this);
      if (value === 'approved_by_manual_review') return 'phone=13800138000';
      return originalNormalize.call(value, form);
    });

    try {
      const result = domain.reviewCandidate(reviewCommand(state, 'approve'), state);
      expect(result.ok).toBe(true);
      if (result.ok) expect(selected(result.nextState).aggregate.mappingStatus).toBe('matched');
    } finally {
      normalize.mockRestore();
    }
  });

  it('P1-6 primary 与 fallback audit scanner 不依赖 ambient normalize', () => {
    const { domain, state } = generate();
    const originalNormalize = String.prototype.normalize;
    const normalize = vi.spyOn(String.prototype, 'normalize').mockImplementation(function (
      this: string,
      form?: string,
    ) {
      const value = String(this);
      if (value === 'approved_by_manual_review' || value === 'mapping_audit_not_ready_blocked') {
        throw new TypeError('scanner unavailable');
      }
      return originalNormalize.call(value, form);
    });

    try {
      const result = domain.reviewCandidate(reviewCommand(state, 'approve'), state);
      expect(result.ok).toBe(true);
    } finally {
      normalize.mockRestore();
    }
  });

  it('P1-5 registry lookup 与 readiness 不受 Map.prototype.get 污染', () => {
    const domain = requireDomain();
    const originalGet = Map.prototype.get;
    const get = vi.spyOn(Map.prototype, 'get').mockImplementation(function <K, V>(
      this: Map<K, V>,
      key: K,
    ) {
      return originalGet.call(this, key);
    });

    try {
      const result = domain.generateCandidate(generationCommand({}, 'tenant-mock-002'), null);
      expectBlocked(result, 'mapping_provider_disabled', 'provider_disabled');
    } finally {
      get.mockRestore();
    }
  });

  it('P1C orphan conflict lock 不能生成 hybrid mappingConflict output', () => {
    const { domain, state } = generate();
    const conflicted = committedState(domain.reviewCandidate(reviewCommand(state, 'mark_conflict'), state));
    const forged = jsonState(conflicted);
    const index = forged.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
    const lineage = index.lineageLockIndex as Record<string, unknown>;
    const records = lineage.records as Array<Record<string, unknown>>;
    const legitimate = records[0];
    const orphan = {
      ...legitimate,
      mappingReference: `ref-mock-${'e'.repeat(48)}`,
      conflictOrigin: 'generation_multiple_system_customers',
      conflictType: 'multiple_system_customers_for_external_contact',
      unresolvedConflictCount: 2,
      createdAt: '2026-07-13T10:30:00.000Z',
    };
    lineage.records = [orphan, legitimate];
    lineage.indexVersion = Number(lineage.indexVersion) + 1;
    lineage.indexDigest = digestValues('zmtg:05c-e1:lineage-index:v1', [
      lineage.tenantId,
      lineage.sourceScopeReference,
      lineage.indexVersion,
      lineage.records,
      lineage.sourceKind,
      lineage.dataMode,
    ]);
    rehashRuntimeIndex(forged);

    const result = domain.reviewCandidate(reviewCommand(forged, 'clear_candidate', {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), forged);
    expectBlockedWithoutState(result);
  });

  it('P1C committed output 遇到 nested custom toJSON 不执行且不能绕过最终验证', () => {
    const { domain, state } = generate();
    const injected = jsonState(state);
    const toJSON = vi.fn(() => ({ phone: '13800138000' }));
    Object.defineProperty(
      (selected(injected).target?.evidence as unknown as Record<string, unknown>),
      'toJSON',
      { value: toJSON, configurable: true },
    );

    const result = domain.reviewCandidate(reviewCommand(injected, 'approve'), injected);
    expect(toJSON).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it('P1-7 Object.prototype.toJSON 污染不得被固定 audit serializer 执行', () => {
    const { domain, state } = generate();
    const inheritedToJSON = vi.fn(() => ({ phone: '13800138000' }));
    Object.defineProperty(Object.prototype, 'toJSON', {
      value: inheritedToJSON,
      configurable: true,
    });

    try {
      const result = domain.reviewCandidate(reviewCommand(state, 'approve'), state);
      expect(result.ok).toBe(true);
      expect(inheritedToJSON).not.toHaveBeenCalled();
      expect(auditJson(result)).not.toContain('13800138000');
    } finally {
      delete (Object.prototype as { toJSON?: unknown }).toJSON;
    }
  });

  it.each([
    ['candidate', [], 'reopen'],
    ['matched', ['approve'], 'reject'],
    ['rejected', ['reject'], 'approve'],
    ['needs_more_info', ['request_more_info'], 'approve'],
    ['conflict', ['mark_conflict'], 'approve'],
    ['cleared_locked', ['clear_candidate'], 'reopen'],
    ['stale', ['expire_candidate'], 'approve'],
    ['disabled', ['disable_mapping'], 'approve'],
  ] as const)('P1-7 persisted %s × %s 非法 transition 代表矩阵', (_status, setup, invalidAction) => {
    const { domain, state } = generate();
    let current = state;
    for (const action of setup) {
      const result = action === 'disable_mapping'
        ? domain.disableMapping(disableCommand(current), current)
        : domain.reviewCandidate(reviewCommand(current, action), current);
      current = committedState(result);
    }
    const result = domain.reviewCandidate(reviewCommand(current, invalidAction, {
      occurredAt: '2026-07-13T14:00:00.000Z',
    }), current);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.mappingStatusBefore).toBe(_status);
    expect(result.auditEvent.mappingStatusAfter).toBe(_status);
  });

  it('disable_mapping 是单向安全关闭且不产生 matched', () => {
    const { domain, state } = generate();
    const candidateDigest = selected(state).aggregate.candidateDigest;
    const result = domain.disableMapping(disableCommand(state), state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      resultKind: 'mapping_disabled',
      mappingReview: null,
      mappingDecision: null,
      mappingConflict: null,
      auditEvent: {
        eventType: 'mapping_disabled',
        mappingStatusAfter: 'disabled',
        candidateDigest: ZERO_DIGEST,
      },
    });
    expect(selected(result.nextState)).toMatchObject({
      aggregate: { mappingStatus: 'disabled', reasonCode: 'mapping_disabled', candidateDigest: null },
      target: null,
    });
    expect(JSON.stringify(result.nextState)).toContain(candidateDigest as string);
    expect(JSON.stringify(result.nextState)).not.toContain('"mappingStatus":"matched"');
  });

  it('disable command 拒绝 candidateDigest，重复 disable 固定阻断', () => {
    const { domain, state } = generate();
    const injected = domain.disableMapping(disableCommand(state, { candidateDigest: digest('a') }), state);
    expectBlocked(injected, 'forbidden_field_blocked', 'unknown_field_blocked');

    const disabled = committedState(domain.disableMapping(disableCommand(state), state));
    const repeated = domain.disableMapping(disableCommand(disabled, {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), disabled);
    expectBlocked(repeated, 'mapping_invalid_transition_blocked', 'mapping_already_disabled');
  });

  it('阻断路径不执行 toJSON、getter 或外部调用', () => {
    const { domain, state } = generate();
    const toJSON = vi.fn(() => ({ secret: 'opaque' }));
    const getter = vi.fn(() => 'opaque');
    const command = reviewCommand(state, 'approve') as Record<string, unknown>;
    Object.defineProperty(command, 'toJSON', { value: toJSON, enumerable: true });
    Object.defineProperty(command, 'rawResponse', { get: getter, enumerable: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = domain.reviewCandidate(command, state);
    expect(result.ok).toBe(false);
    expect(toJSON).not.toHaveBeenCalled();
    expect(getter).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('所有 audit stringify 后不含禁止内容且字段集合固定', () => {
    const domain = requireDomain();
    const results: MappingCommandResult[] = [
      domain.generateCandidate(generationCommand({ rawResponse: { secret: 'opaque' } }), null),
      domain.generateCandidate(generationCommand({ tenantId: 'tenant-mock-001\nphone=13800138000' }), null),
      domain.generateCandidate(generationCommand({ occurredAt: `${OCCURRED_AT}\nexternalUserId=wm_opaque` }), null),
      domain.generateCandidate(generationCommand({}, 'tenant-mock-002'), null),
      domain.generateCandidate(generationCommand({}, 'tenant-mock-003'), null),
      domain.generateCandidate(generationCommand({}, 'tenant-demo-001'), null),
      domain.generateCandidate(generationCommand({}, 'tenant-mock-004'), null),
    ];
    const generated = domain.generateCandidate(generationCommand(), null);
    results.push(generated);
    if (generated.ok) {
      results.push(domain.reviewCandidate(reviewCommand(generated.nextState, 'approve', {
        candidateDigest: 'secret=opaque',
      }), generated.nextState));
      results.push(domain.reviewCandidate(reviewCommand(generated.nextState, 'approve', {
        candidateDigest: digest('f'),
      }), generated.nextState));
    }

    for (const result of results) {
      expect(Object.keys(result.auditEvent)).toEqual(AUDIT_KEYS);
      expectAuditSafe(result);
    }
  });

  it('P1C review 与 disable 分别报告 source-scope index 容量', () => {
    const { domain, state } = generate();
    const atCapacity = jsonState(state);
    (atCapacity.sourceScopeRuntimeIndex as unknown as Record<string, unknown>).indexVersion = 2_147_483_647;
    rehashRuntimeIndex(atCapacity);

    const review = domain.reviewCandidate(reviewCommand(atCapacity, 'approve'), atCapacity);
    expectBlocked(review, 'mapping_input_blocked', 'source_scope_index_capacity_exceeded');

    const disable = domain.disableMapping(disableCommand(atCapacity), atCapacity);
    expectBlocked(disable, 'mapping_input_blocked', 'source_scope_index_capacity_exceeded');
  });

  it('P1C unique orphan lineage lock 不得随正常 review 提交', () => {
    const { domain, state } = generate();
    const forged = jsonState(state);
    const index = forged.sourceScopeRuntimeIndex as unknown as Record<string, unknown>;
    const lineage = index.lineageLockIndex as Record<string, unknown>;
    const aggregate = selected(forged).aggregate;
    lineage.records = [{
      tenantId: aggregate.tenantId,
      sourceScopeReference: aggregate.sourceScopeReference,
      mappingReference: `ref-mock-${'e'.repeat(48)}`,
      candidateDigest: digest('1'),
      externalContactDigest: digest('4'),
      systemCustomerDigest: digest('5'),
      candidatePairDigest: digest('2'),
      evidenceFingerprint: digest('3'),
      sourceSnapshotDigest: aggregate.sourceSnapshotDigest,
      lockType: 'conflict',
      conflictOrigin: 'manual_review_mark_conflict',
      conflictType: 'manual_marked',
      unresolvedConflictCount: 1,
      createdAt: OCCURRED_AT,
      sourceKind: aggregate.sourceKind,
      dataMode: aggregate.dataMode,
    }];
    lineage.indexVersion = 2;
    rehashLineageAndRuntime(forged);

    const result = domain.reviewCandidate(reviewCommand(forged, 'approve'), forged);
    expectBlockedWithoutState(result);
    expect(result.auditEvent.reasonCode).toBe('lineage_index_invalid');
  });

  it('P1C factory 不调用 ambient Object.isFrozen', () => {
    const originalIsFrozen = Object.isFrozen;
    Object.isFrozen = (() => {
      throw new Error('ambient Object.isFrozen must not execute');
    }) as typeof Object.isFrozen;
    try {
      expect(() => createWeComCustomerMappingDomain()).not.toThrow();
      const domain = createWeComCustomerMappingDomain();
      expect(domain).not.toMatchObject({ ok: false });
    } finally {
      Object.isFrozen = originalIsFrozen;
    }
  });

  it('P1C 首次加载时 freeze 与 isFrozen 双污染必须 initialization blocked', async () => {
    const originalFreeze = Object.freeze;
    const originalIsFrozen = Object.isFrozen;
    vi.resetModules();
    Object.freeze = (<Value>(value: Value) => value) as typeof Object.freeze;
    Object.isFrozen = (() => true) as typeof Object.isFrozen;
    try {
      const poisonedModule = await import('@/modules/institution/domain/wecom-customer-mapping-review');
      expect(poisonedModule.createWeComCustomerMappingDomain()).toEqual({
        ok: false,
        reasonCode: 'fixture_registry_initialization_blocked',
      });
    } finally {
      Object.freeze = originalFreeze;
      Object.isFrozen = originalIsFrozen;
      vi.resetModules();
    }
  });

  it('P1C module fixture trusted root 使用固定 manifest/registry/history KAT', () => {
    const { domain, state } = generate();
    expect(state.sourceScopeRuntimeIndex.candidateManifestDigest).toBe(
      'sha256:b8fea9b5925d84a32f82c25c2aa03b552a1bca0e58312de3fea6e810183df617',
    );
    expect(state.sourceScopeRuntimeIndex.fixtureRegistryDigest).toBe(
      'sha256:d8f0b88660fdcce23e6f8547b16a7dfbfca18945800810541d5e78ccc1273d75',
    );
    expect(selected(state).history.historyDigest).toBe(
      'sha256:62f2ac1cadbda5d8fef1d70587a7a90950052365ff9e8e798ceda8c464f18d37',
    );

    const reviewed = committedState(domain.reviewCandidate(reviewCommand(state, 'approve'), state));
    expect(selected(reviewed).history.historyDigest).toBe(
      'sha256:d72fe113ae259ef1d34e653e4a57ecca476d6b33a576f917dc18a9799864b61a',
    );

    const disabled = committedState(domain.disableMapping(disableCommand(reviewed, {
      occurredAt: '2026-07-13T12:00:00.000Z',
    }), reviewed));
    expect(selected(disabled).history.historyDigest).toBe(
      'sha256:e224f0734d7d8365aa53257e51e4954241ad3b83b0c5579bac16e5a07807b5f1',
    );
  });

  it('P1C ambient Array.prototype.map 不能重定义 module-owned fixture source', () => {
    const originalMap = Array.prototype.map;
    Object.defineProperty(Array.prototype, 'map', {
      configurable: true,
      writable: true,
      value: function <T, U>(
        this: T[],
        callback: (value: T, index: number, array: T[]) => U,
        thisArg?: unknown,
      ) {
        const output = originalMap.call(this, callback, thisArg) as U[];
        for (const value of output) {
          if (typeof value !== 'object' || value === null) continue;
          const record = value as Record<string, unknown>;
          if ('externalUserIdDigest' in record) record.displayName = '[POISON] 客户';
          if ('customerDigest' in record) record.displayNameSummary = '[POISON] 客户';
        }
        return output;
      },
    });

    try {
      const created = createWeComCustomerMappingDomain();
      expect(created).not.toMatchObject({ ok: false });
      const domain = created as WeComCustomerMappingDomain;
      const poisoned = generationCommand();
      poisoned.externalContacts[0].displayName = '[POISON] 客户';
      poisoned.systemCustomers[0].displayNameSummary = '[POISON] 客户';
      expectBlocked(
        domain.generateCandidate(poisoned, null),
        'mapping_input_blocked',
        'untrusted_fixture_provenance',
      );
    } finally {
      Object.defineProperty(Array.prototype, 'map', {
        value: originalMap,
        configurable: true,
        writable: true,
      });
    }
  });

  it('P1C valid multi-entry 的 non-selected target accessor 必须零调用并 fail-closed', () => {
    const domain = requireDomain();
    const first = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const complete = committedState(domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), first));
    const forged = jsonState(complete);
    const getter = vi.fn(() => selectedAt(complete, 1).target);
    Object.defineProperty(
      forged.mappings[1] as unknown as Record<string, unknown>,
      'target',
      { enumerable: true, configurable: true, get: getter },
    );

    const result = domain.disableMapping({
      tenantId: 'tenant-mock-006',
      mappingReference: selectedAt(complete, 0).aggregate.mappingReference,
      action: 'disable_mapping',
      reviewerRole: 'platform_governance',
      occurredAt: '2026-07-13T12:00:00.000Z',
    }, forged);
    expectBlocked(result, 'mapping_input_blocked', 'source_scope_state_invalid');
    expect(getter).not.toHaveBeenCalled();
  });

  it('P1C selected accessor target 在 non-monotonic 后置阻断下保持零调用和 descriptor identity', () => {
    const { domain, state } = generate();
    const getter = vi.fn(() => selected(state).target);
    const setter = vi.fn();
    const forged = withSelectedTargetDescriptor(state, { get: getter, set: setter });
    const before = Object.getOwnPropertyDescriptor(forged.mappings[0], 'target');

    const result = domain.disableMapping(disableCommand(state, {
      occurredAt: OCCURRED_AT,
    }), forged);
    expectBlocked(result, 'mapping_input_blocked', 'non_monotonic_occurred_at');
    expect(result.auditEvent.candidateDigest).toBe(ZERO_DIGEST);
    expect(getter).not.toHaveBeenCalled();
    expect(setter).not.toHaveBeenCalled();
    const after = Object.getOwnPropertyDescriptor(forged.mappings[0], 'target');
    expect(after?.get).toBe(before?.get);
    expect(after?.set).toBe(before?.set);
  });

  it('P1C multi-entry disable 只替换 selected mapping/record 并保留 scope progression', () => {
    const domain = requireDomain();
    const first = committedState(domain.generateCandidate(multiGenerationCommand(0), null));
    const complete = committedState(domain.generateCandidate(multiGenerationCommand(1, {
      occurredAt: '2026-07-13T11:00:00.000Z',
    }), first));
    const beforeIndex = complete.sourceScopeRuntimeIndex;
    const beforeOtherMapping = JSON.stringify(complete.mappings[1]);
    const beforeOtherRecord = JSON.stringify(beforeIndex.records[1]);
    const beforeLineage = JSON.stringify(beforeIndex.lineageLockIndex);

    const disabled = domain.disableMapping({
      tenantId: 'tenant-mock-006',
      mappingReference: complete.mappings[0].aggregate.mappingReference,
      action: 'disable_mapping',
      reviewerRole: 'platform_governance',
      occurredAt: '2026-07-13T12:00:00.000Z',
    }, complete);
    expect(disabled.ok).toBe(true);
    if (!disabled.ok) return;
    const nextIndex = disabled.nextState.sourceScopeRuntimeIndex;
    expect(disabled.nextState.mappings[0].aggregate.candidateDigest).toBeNull();
    expect(nextIndex.records[0].candidateDigest).toBeNull();
    expect(JSON.stringify(disabled.nextState.mappings[1])).toBe(beforeOtherMapping);
    expect(JSON.stringify(nextIndex.records[1])).toBe(beforeOtherRecord);
    expect(JSON.stringify(nextIndex.lineageLockIndex)).toBe(beforeLineage);
    expect(nextIndex.generationCursor).toBe(beforeIndex.generationCursor);
    expect(nextIndex.generationComplete).toBe(beforeIndex.generationComplete);
    expect(nextIndex.indexVersion).toBe(beforeIndex.indexVersion + 1);
  });

  it('P1C domain 创建后的 ambient Array.prototype.map throw 不得从 public command 逸出', () => {
    const { domain } = generate();
    const originalMap = Array.prototype.map;
    Object.defineProperty(Array.prototype, 'map', {
      configurable: true,
      writable: true,
      value() {
        throw new Error('ambient Array.prototype.map must not execute');
      },
    });

    try {
      expect(() => domain.generateCandidate(generationCommand(), null)).not.toThrow();
      expect(domain.generateCandidate(generationCommand(), null).ok).toBe(true);
    } finally {
      Object.defineProperty(Array.prototype, 'map', {
        value: originalMap,
        configurable: true,
        writable: true,
      });
    }
  });

  it('P1C freeze 探针不能被 freeze/isFrozen/Reflect.defineProperty 三重污染伪造', async () => {
    const originalFreeze = Object.freeze;
    const originalIsFrozen = Object.isFrozen;
    const originalDefineProperty = Reflect.defineProperty;
    vi.resetModules();
    Object.freeze = (<Value>(value: Value) => value) as typeof Object.freeze;
    Object.isFrozen = (() => true) as typeof Object.isFrozen;
    Reflect.defineProperty = (() => false) as typeof Reflect.defineProperty;
    try {
      const poisonedModule = await import('@/modules/institution/domain/wecom-customer-mapping-review');
      expect(poisonedModule.createWeComCustomerMappingDomain()).toEqual({
        ok: false,
        reasonCode: 'fixture_registry_initialization_blocked',
      });
    } finally {
      Object.freeze = originalFreeze;
      Object.isFrozen = originalIsFrozen;
      Reflect.defineProperty = originalDefineProperty;
      vi.resetModules();
    }
  });

  it('P1C 三个 public method 只接受 raw command 与 state 两个参数', () => {
    const { domain, state } = generate();
    const forgedContext = { auditReady: true, capabilityKind: 'forged' };
    const generateWithExtra = domain.generateCandidate as unknown as (...args: unknown[]) => MappingCommandResult;
    const reviewWithExtra = domain.reviewCandidate as unknown as (...args: unknown[]) => MappingCommandResult;
    const disableWithExtra = domain.disableMapping as unknown as (...args: unknown[]) => MappingCommandResult;

    expectBlocked(
      generateWithExtra(generationCommand(), null, forgedContext),
      'mapping_input_blocked',
      'invalid_payload_shape',
    );
    expectBlocked(
      reviewWithExtra(reviewCommand(state, 'approve'), state, forgedContext),
      'mapping_input_blocked',
      'invalid_payload_shape',
    );
    expectBlocked(
      disableWithExtra(disableCommand(state), state, forgedContext),
      'mapping_input_blocked',
      'invalid_payload_shape',
    );
  });

  it('所有 committed state 与 decision 均固定不自动合并、不写真实客户关系', () => {
    const { domain, state } = generate();
    for (const action of ['approve', 'reject', 'request_more_info', 'mark_conflict', 'clear_candidate']) {
      const result = domain.reviewCandidate(reviewCommand(state, action), state);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const mapping = selected(result.nextState);
      expect(mapping.aggregate).toMatchObject({
        containsRealCustomerData: false,
        autoMergePerformed: false,
        realCustomerRelationshipWritten: false,
      });
      expect(mapping.target).toMatchObject({
        containsRealCustomerData: false,
        autoMergePerformed: false,
        realCustomerRelationshipWritten: false,
      });
      expect(result.mappingDecision?.mappingStatusAfter === 'matched').toBe(action === 'approve');
    }
  });
});
