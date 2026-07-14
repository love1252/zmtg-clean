import {
  createWeComCustomerMappingDomain,
  type MappingCommittedResult,
  type WeComCustomerMappingDataMode,
  type WeComCustomerMappingDomain,
  type WeComCustomerMappingSourceKind,
} from '@/modules/institution/domain/wecom-customer-mapping-review';
import {
  createWeComCustomerMappingCandidatesFailClosedRawView,
  parseWeComCustomerMappingCandidatesReadonlyResponse,
  parseWeComCustomerMappingCandidatesResponse,
  weComCustomerMappingAuditEventTypes,
  weComCustomerMappingAuditReasonCodes,
  weComCustomerMappingFailClosedReasons,
  type WeComCustomerMappingAuditEventType,
  type WeComCustomerMappingAuditReasonCode,
  type WeComCustomerMappingAuthorizationStatus,
  type WeComCustomerMappingCandidatesRawView,
  type WeComCustomerMappingCandidatesResponse,
  type WeComCustomerMappingFailClosedReason,
  type WeComCustomerMappingProviderStatus,
} from '@/modules/institution/view-models/wecom-customer-mapping-candidates';

type FixtureMetadata = {
  fixtureTenantId: string;
  dataMode: WeComCustomerMappingDataMode;
  sourceKind: WeComCustomerMappingSourceKind;
  authorizationStatus: WeComCustomerMappingAuthorizationStatus;
  providerStatus: WeComCustomerMappingProviderStatus;
};

const fixtureMetadata: Record<string, FixtureMetadata> = {
  'tenant-mock-001': {
    fixtureTenantId: 'tenant-mock-001',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'tenant-mock-002': {
    fixtureTenantId: 'tenant-mock-002',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'disabled',
  },
  'tenant-mock-003': {
    fixtureTenantId: 'tenant-mock-003',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'external_disabled',
  },
  'tenant-demo-001': {
    fixtureTenantId: 'tenant-demo-001',
    dataMode: 'demo',
    sourceKind: 'controlled_demo_fixture',
    authorizationStatus: 'revoked',
    providerStatus: 'mock_only',
  },
  'tenant-mock-004': {
    fixtureTenantId: 'tenant-mock-004',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'tenant-mock-005': {
    fixtureTenantId: 'tenant-mock-005',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'trial-tenant-yunlan': {
    fixtureTenantId: 'tenant-mock-001',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'trial-tenant-baiyue': {
    fixtureTenantId: 'tenant-mock-001',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'starter-tenant-xinghe': {
    fixtureTenantId: 'tenant-mock-001',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'starter-tenant-yubai': {
    fixtureTenantId: 'tenant-mock-001',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'growth-tenant-chengxing': {
    fixtureTenantId: 'tenant-mock-001',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
  'growth-tenant-qingmang': {
    fixtureTenantId: 'tenant-mock-001',
    dataMode: 'mock',
    sourceKind: 'controlled_mock_fixture',
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
  },
};

function digest(character: string) {
  return `sha256:${character.repeat(64)}`;
}

function createFixtureCommand(tenantId: string, metadata: FixtureMetadata) {
  const label = metadata.dataMode === 'mock' ? 'MOCK' : 'DEMO';
  return {
    tenantId,
    action: 'generate_candidate',
    manifestEntryReference:
      tenantId === 'tenant-mock-005' ? null : `ref-${metadata.dataMode}-entry-001`,
    externalContacts: [{
      tenantId,
      externalContactReference: `ref-${metadata.dataMode}-contact-001`,
      displayName: `[${label}] 客户甲`,
      externalUserIdDigest: digest('a'),
      followUsers: [{
        tenantId,
        followUserReference: `ref-${metadata.dataMode}-follow-001`,
        displayName: `[${label}] 顾问甲`,
        followUserIdDigest: digest('b'),
        ownershipStatus: 'active',
        institutionSummary: `[${label}] 机构甲`,
        dataMode: metadata.dataMode,
        containsRealCustomerData: false,
      }],
      tags: [{
        tenantId,
        tagReference: `ref-${metadata.dataMode}-tag-001`,
        tagIdDigest: digest('c'),
        tagName: `[${label}] 重点客户`,
        sourceType: metadata.dataMode === 'mock' ? 'mock_enterprise' : 'demo_enterprise',
        tagStatus: 'active',
        dataMode: metadata.dataMode,
        containsRealCustomerData: false,
      }],
      sourceType: 'other_mock' as const,
      addedAtDate: '2026-07-10',
      remarkSummary: `[${label}] 已确认摘要`,
      sourceMappingStatus: 'unmatched',
      lastSyncedAt: '2026-07-12T00:00:00.000Z',
      syncStatus: 'mock_ready',
      manualReviewState: 'not_required',
      dataMode: metadata.dataMode,
      containsRealCustomerData: false,
      fieldWhitelistApplied: true,
    }],
    systemCustomers: [{
      tenantId,
      customerReference: `ref-${metadata.dataMode}-customer-001`,
      mockCustomerNumber: `${label}-001`,
      displayNameSummary: `[${label}] 客户甲`,
      remarkSummary: `[${label}] 已确认摘要`,
      tagNames: [`[${label}] 重点客户`],
      sourceType: 'other_mock' as const,
      addedAtDate: '2026-07-10',
      ownerSummary: `[${label}] 顾问甲`,
      customerDigest: digest('d'),
      statusSummary: 'active' as const,
      dataMode: metadata.dataMode,
      containsRealCustomerData: false,
      fieldWhitelistApplied: true,
    }],
    occurredAt: '2026-07-13T10:00:00.000Z',
    sourceKind: metadata.sourceKind,
    dataMode: metadata.dataMode,
    containsRealCustomerData: false,
  };
}

function blockedRawView(
  tenantId: string,
  metadata: FixtureMetadata | undefined,
  reason: WeComCustomerMappingFailClosedReason,
  auditEventType?: WeComCustomerMappingAuditEventType,
) {
  return createWeComCustomerMappingCandidatesFailClosedRawView({
    tenantId,
    reason,
    sourceKind: metadata?.sourceKind,
    dataMode: metadata?.dataMode,
    authorizationStatus: metadata?.authorizationStatus,
    providerStatus: metadata?.providerStatus,
    auditEventType,
  });
}

function controlledFailClosedReason(value: string): WeComCustomerMappingFailClosedReason {
  return (weComCustomerMappingFailClosedReasons as readonly string[]).includes(value)
    ? value as WeComCustomerMappingFailClosedReason
    : 'response_contract_invalid';
}

function controlledAuditReasonCode(value: string): WeComCustomerMappingAuditReasonCode {
  return (weComCustomerMappingAuditReasonCodes as readonly string[]).includes(value)
    ? value as WeComCustomerMappingAuditReasonCode
    : 'response_contract_invalid';
}

function controlledAuditEventType(value: string): WeComCustomerMappingAuditEventType {
  return (weComCustomerMappingAuditEventTypes as readonly string[]).includes(value)
    ? value as WeComCustomerMappingAuditEventType
    : 'mapping_input_blocked';
}

function buildRawView(
  tenantId: string,
  metadata: FixtureMetadata,
  result: MappingCommittedResult,
): WeComCustomerMappingCandidatesRawView {
  const mapping = result.nextState.mappings[0];
  const target = mapping?.target;
  const command = createFixtureCommand(metadata.fixtureTenantId, metadata);
  const contact = command.externalContacts[0];
  const customer = command.systemCustomers[0];

  if (!mapping || !target) {
    return {
      tenantId,
      sourceKind: metadata.sourceKind,
      dataMode: metadata.dataMode,
      mockDemo: true,
      readonly: true,
      authorizationStatus: metadata.authorizationStatus,
      providerStatus: metadata.providerStatus,
      candidates: [],
      mappingStatus: mapping?.aggregate.mappingStatus ?? 'unmatched',
      confidenceLevel: null,
      conflictSummary: { status: 'none', unresolvedCount: 0 },
      manualReviewStatus: 'not_required',
      auditSummary: {
        status: 'recorded',
        eventType: controlledAuditEventType(result.auditEvent.eventType),
        reasonCode: controlledAuditReasonCode(result.auditEvent.reasonCode),
      },
      failClosedReason: null,
      autoMergePerformed: false,
      realCustomerRelationshipWritten: false,
    };
  }

  const unresolvedCount = target.unresolvedConflictCount;
  const manualReviewStatus =
    mapping.aggregate.mappingStatus === 'manual_review_required' ||
    mapping.aggregate.mappingStatus === 'conflict'
      ? 'required' as const
      : 'not_required' as const;
  const conflictSummary = unresolvedCount > 0
    ? { status: 'unresolved' as const, unresolvedCount }
    : { status: 'none' as const, unresolvedCount: 0 };

  return {
    tenantId,
    sourceKind: metadata.sourceKind,
    dataMode: metadata.dataMode,
    mockDemo: true,
    readonly: true,
    authorizationStatus: metadata.authorizationStatus,
    providerStatus: metadata.providerStatus,
    candidates: [{
      externalContactSummary: {
        displayName: contact.displayName,
        ownerSummary: contact.followUsers[0].displayName,
        tagNames: contact.tags.map(({ tagName }) => tagName),
        sourceType: contact.sourceType,
        addedAtDate: contact.addedAtDate,
        remarkSummary: contact.remarkSummary,
      },
      systemCustomerSummary: {
        mockCustomerNumber: customer.mockCustomerNumber,
        displayNameSummary: customer.displayNameSummary,
        ownerSummary: customer.ownerSummary,
        tagNames: [...customer.tagNames],
        statusSummary: customer.statusSummary,
      },
      mappingStatus: mapping.aggregate.mappingStatus,
      confidenceLevel: target.confidenceLevel,
      conflictSummary,
      manualReviewStatus,
    }],
    mappingStatus: mapping.aggregate.mappingStatus,
    confidenceLevel: target.confidenceLevel,
    conflictSummary,
    manualReviewStatus,
    auditSummary: {
      status: 'recorded',
      eventType: controlledAuditEventType(result.auditEvent.eventType),
      reasonCode: controlledAuditReasonCode(result.auditEvent.reasonCode),
    },
    failClosedReason: null,
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
  };
}

export type WeComCustomerMappingCandidatesResponseReadResult =
  | { ok: true; data: WeComCustomerMappingCandidatesResponse }
  | {
      ok: false;
      reason: 'response_unavailable' | 'response_json_invalid' | 'response_contract_invalid';
    };

export async function readWeComCustomerMappingCandidatesResponse(
  response: Response,
): Promise<WeComCustomerMappingCandidatesResponseReadResult> {
  if (!response.ok) {
    return { ok: false, reason: 'response_unavailable' };
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return { ok: false, reason: 'response_json_invalid' };
  }

  const data = parseWeComCustomerMappingCandidatesReadonlyResponse(value);
  return data
    ? { ok: true, data }
    : { ok: false, reason: 'response_contract_invalid' };
}

export function readWeComCustomerMappingCandidates(
  tenantId: string,
): WeComCustomerMappingCandidatesResponse {
  const metadata = fixtureMetadata[tenantId];
  if (!metadata) {
    const raw = blockedRawView(tenantId, undefined, 'tenant_fixture_unavailable');
    return parseWeComCustomerMappingCandidatesResponse(raw, tenantId)!;
  }

  const domain = createWeComCustomerMappingDomain();
  if ('ok' in domain && domain.ok === false) {
    const raw = blockedRawView(
      tenantId,
      metadata,
      controlledFailClosedReason(domain.reasonCode),
    );
    return parseWeComCustomerMappingCandidatesResponse(raw, tenantId)!;
  }

  const result = (domain as WeComCustomerMappingDomain).generateCandidate(
    createFixtureCommand(metadata.fixtureTenantId, metadata),
    null,
  );
  const raw = result.ok
    ? buildRawView(tenantId, metadata, result)
    : blockedRawView(
        tenantId,
        metadata,
        controlledFailClosedReason(result.auditEvent.reasonCode),
        controlledAuditEventType(result.auditEvent.eventType),
      );
  const parsed = parseWeComCustomerMappingCandidatesResponse(raw, tenantId);
  if (parsed) return parsed;

  return parseWeComCustomerMappingCandidatesResponse(
    blockedRawView(tenantId, metadata, 'response_contract_invalid'),
    tenantId,
  )!;
}
