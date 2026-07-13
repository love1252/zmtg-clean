import {
  createWeComExternalContactMockFixture,
  createWeComExternalContactReadonlyView,
  weComAuditEventTypes,
  weComAuthorizationStatuses,
  weComSyncStatuses,
} from '@/modules/institution/domain/wecom-external-contact-readonly';
import type {
  WeComAuditEventType,
  WeComAuthorizationStatus,
  WeComExternalContactMockFixture,
  WeComReadonlyDataMode,
  WeComSyncStatus,
  WeComTenantAuthorization,
} from '@/modules/institution/domain/wecom-external-contact-readonly';

export const weComGovernanceProviderStates = [
  'mock_only',
  'disabled',
  'external_disabled',
] as const;

export type WeComGovernanceProviderState =
  (typeof weComGovernanceProviderStates)[number];

export type WeComGovernanceReason =
  | 'mock_readonly_ready'
  | 'authorization_not_available'
  | 'provider_disabled'
  | 'external_provider_disabled'
  | 'forbidden_field_blocked';

export type WeComGovernanceTenantSummary = {
  tenantReference: string;
  tenantDisplayName: string;
  authorizationStatus: WeComAuthorizationStatus;
  providerState: WeComGovernanceProviderState;
  syncStatus: WeComSyncStatus;
  failClosed: boolean;
  reason: WeComGovernanceReason;
  lastMockSnapshotAt: string | null;
};

type StatusCount<T extends string> = Record<T, number>;

export type WeComPlatformGovernancePayload = {
  sourceKind: 'controlled_mock_governance_summary';
  mockDemo: true;
  dataMode: WeComReadonlyDataMode;
  readonly: true;
  containsRealCustomerData: false;
  generatedAt: string;
  latestMockSnapshotAt: string;
  authorizationStatusSummary: {
    totalTenants: number;
    counts: StatusCount<WeComAuthorizationStatus>;
  };
  providerStatusSummary: {
    counts: StatusCount<WeComGovernanceProviderState>;
    externalCapabilityEnabled: false;
  };
  syncHealthSummary: {
    counts: StatusCount<WeComSyncStatus>;
    healthyTenantCount: number;
    blockedTenantCount: number;
  };
  anomalousTenants: WeComGovernanceTenantSummary[];
  fieldBlockingSummary: {
    whitelistApplied: true;
    defaultDeny: true;
    forbiddenFieldsReturned: false;
    blockedTenantCount: number;
    blockedAttemptCount: number;
    allowedCategories: readonly [
      'governance_status',
      'authorization_state',
      'sync_health',
      'audit_counts',
    ];
    blockedCategories: readonly [
      'credential_material',
      'direct_identity',
      'contact_detail',
      'communication_payload',
    ];
  };
  auditSummary: {
    eventCount: number;
    blockedEventCount: number;
    containsSensitivePayload: false;
    latestEventAt: string;
    eventsByType: Array<{
      eventType: WeComAuditEventType;
      count: number;
      blockedCount: number;
    }>;
  };
  failClosedStatus: {
    enabled: true;
    blockedTenantCount: number;
    externalCallsAllowed: false;
    notice: 'authorization_provider_and_field_policy_default_deny';
  };
};

const topLevelKeys = new Set([
  'sourceKind',
  'mockDemo',
  'dataMode',
  'readonly',
  'containsRealCustomerData',
  'generatedAt',
  'latestMockSnapshotAt',
  'authorizationStatusSummary',
  'providerStatusSummary',
  'syncHealthSummary',
  'anomalousTenants',
  'fieldBlockingSummary',
  'auditSummary',
  'failClosedStatus',
]);
const authorizationSummaryKeys = new Set(['totalTenants', 'counts']);
const providerSummaryKeys = new Set(['counts', 'externalCapabilityEnabled']);
const syncHealthSummaryKeys = new Set([
  'counts',
  'healthyTenantCount',
  'blockedTenantCount',
]);
const tenantSummaryKeys = new Set([
  'tenantReference',
  'tenantDisplayName',
  'authorizationStatus',
  'providerState',
  'syncStatus',
  'failClosed',
  'reason',
  'lastMockSnapshotAt',
]);
const fieldBlockingSummaryKeys = new Set([
  'whitelistApplied',
  'defaultDeny',
  'forbiddenFieldsReturned',
  'blockedTenantCount',
  'blockedAttemptCount',
  'allowedCategories',
  'blockedCategories',
]);
const auditSummaryKeys = new Set([
  'eventCount',
  'blockedEventCount',
  'containsSensitivePayload',
  'latestEventAt',
  'eventsByType',
]);
const auditEventSummaryKeys = new Set(['eventType', 'count', 'blockedCount']);
const failClosedStatusKeys = new Set([
  'enabled',
  'blockedTenantCount',
  'externalCallsAllowed',
  'notice',
]);
const allowedCategories = [
  'governance_status',
  'authorization_state',
  'sync_health',
  'audit_counts',
] as const;
const blockedCategories = [
  'credential_material',
  'direct_identity',
  'contact_detail',
  'communication_payload',
] as const;
const governanceReasons: readonly WeComGovernanceReason[] = [
  'mock_readonly_ready',
  'authorization_not_available',
  'provider_disabled',
  'external_provider_disabled',
  'forbidden_field_blocked',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>) {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.size && actualKeys.every((key) => keys.has(key));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isCatalogValue<T extends string>(value: unknown, catalog: readonly T[]): value is T {
  return typeof value === 'string' && catalog.includes(value as T);
}

function isExactCountRecord<T extends string>(value: unknown, catalog: readonly T[]) {
  if (!isRecord(value) || !hasExactKeys(value, new Set(catalog))) return false;
  return catalog.every((key) => isNonNegativeInteger(value[key]));
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function hasExactArrayValues(value: unknown, expected: readonly string[]) {
  return Array.isArray(value) && value.length === expected.length &&
    value.every((entry, index) => entry === expected[index]);
}

function isTenantSummary(value: unknown): value is WeComGovernanceTenantSummary {
  if (!isRecord(value) || !hasExactKeys(value, tenantSummaryKeys)) return false;
  return typeof value.tenantReference === 'string' &&
    /^mock-governance-tenant-\d{2}$/u.test(value.tenantReference) &&
    typeof value.tenantDisplayName === 'string' &&
    /^\[MOCK\] 治理租户 \d{2}$/u.test(value.tenantDisplayName) &&
    isCatalogValue(value.authorizationStatus, weComAuthorizationStatuses) &&
    isCatalogValue(value.providerState, weComGovernanceProviderStates) &&
    isCatalogValue(value.syncStatus, weComSyncStatuses) &&
    value.failClosed === true &&
    isCatalogValue(value.reason, governanceReasons) &&
    (value.lastMockSnapshotAt === null || isIsoTimestamp(value.lastMockSnapshotAt));
}

function isAuditEventSummary(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, auditEventSummaryKeys)) return false;
  return isCatalogValue(value.eventType, weComAuditEventTypes) &&
    isNonNegativeInteger(value.count) &&
    isNonNegativeInteger(value.blockedCount);
}

export function parseWeComPlatformGovernancePayload(
  value: unknown,
): WeComPlatformGovernancePayload | null {
  if (!isRecord(value) || !hasExactKeys(value, topLevelKeys)) return null;
  if (
    value.sourceKind !== 'controlled_mock_governance_summary' ||
    value.mockDemo !== true ||
    value.dataMode !== 'mock' ||
    value.readonly !== true ||
    value.containsRealCustomerData !== false ||
    !isIsoTimestamp(value.generatedAt) ||
    !isIsoTimestamp(value.latestMockSnapshotAt) ||
    !isRecord(value.authorizationStatusSummary) ||
    !hasExactKeys(value.authorizationStatusSummary, authorizationSummaryKeys) ||
    !isNonNegativeInteger(value.authorizationStatusSummary.totalTenants) ||
    !isExactCountRecord(value.authorizationStatusSummary.counts, weComAuthorizationStatuses) ||
    !isRecord(value.providerStatusSummary) ||
    !hasExactKeys(value.providerStatusSummary, providerSummaryKeys) ||
    !isExactCountRecord(value.providerStatusSummary.counts, weComGovernanceProviderStates) ||
    value.providerStatusSummary.externalCapabilityEnabled !== false ||
    !isRecord(value.syncHealthSummary) ||
    !hasExactKeys(value.syncHealthSummary, syncHealthSummaryKeys) ||
    !isExactCountRecord(value.syncHealthSummary.counts, weComSyncStatuses) ||
    !isNonNegativeInteger(value.syncHealthSummary.healthyTenantCount) ||
    !isNonNegativeInteger(value.syncHealthSummary.blockedTenantCount) ||
    !Array.isArray(value.anomalousTenants) ||
    !value.anomalousTenants.every(isTenantSummary) ||
    !isRecord(value.fieldBlockingSummary) ||
    !hasExactKeys(value.fieldBlockingSummary, fieldBlockingSummaryKeys) ||
    value.fieldBlockingSummary.whitelistApplied !== true ||
    value.fieldBlockingSummary.defaultDeny !== true ||
    value.fieldBlockingSummary.forbiddenFieldsReturned !== false ||
    !isNonNegativeInteger(value.fieldBlockingSummary.blockedTenantCount) ||
    !isNonNegativeInteger(value.fieldBlockingSummary.blockedAttemptCount) ||
    !hasExactArrayValues(value.fieldBlockingSummary.allowedCategories, allowedCategories) ||
    !hasExactArrayValues(value.fieldBlockingSummary.blockedCategories, blockedCategories) ||
    !isRecord(value.auditSummary) ||
    !hasExactKeys(value.auditSummary, auditSummaryKeys) ||
    !isNonNegativeInteger(value.auditSummary.eventCount) ||
    !isNonNegativeInteger(value.auditSummary.blockedEventCount) ||
    value.auditSummary.containsSensitivePayload !== false ||
    !isIsoTimestamp(value.auditSummary.latestEventAt) ||
    !Array.isArray(value.auditSummary.eventsByType) ||
    !value.auditSummary.eventsByType.every(isAuditEventSummary) ||
    !isRecord(value.failClosedStatus) ||
    !hasExactKeys(value.failClosedStatus, failClosedStatusKeys) ||
    value.failClosedStatus.enabled !== true ||
    !isNonNegativeInteger(value.failClosedStatus.blockedTenantCount) ||
    value.failClosedStatus.externalCallsAllowed !== false ||
    value.failClosedStatus.notice !== 'authorization_provider_and_field_policy_default_deny'
  ) return null;

  return value as WeComPlatformGovernancePayload;
}

type GovernanceScenario =
  | 'ready'
  | 'provider_disabled'
  | 'external_disabled'
  | 'not_configured'
  | 'expired'
  | 'field_guard_blocked';

type ScenarioDefinition = {
  tenantReference: string;
  tenantDisplayName: string;
  scenario: GovernanceScenario;
};

const generatedAt = '2026-07-13T00:00:00.000Z';
const snapshotAt = '2026-07-12T00:00:00.000Z';

const scenarioDefinitions: readonly ScenarioDefinition[] = [
  {
    tenantReference: 'mock-governance-tenant-01',
    tenantDisplayName: '[MOCK] 治理租户 01',
    scenario: 'ready',
  },
  {
    tenantReference: 'mock-governance-tenant-02',
    tenantDisplayName: '[MOCK] 治理租户 02',
    scenario: 'provider_disabled',
  },
  {
    tenantReference: 'mock-governance-tenant-03',
    tenantDisplayName: '[MOCK] 治理租户 03',
    scenario: 'external_disabled',
  },
  {
    tenantReference: 'mock-governance-tenant-04',
    tenantDisplayName: '[MOCK] 治理租户 04',
    scenario: 'not_configured',
  },
  {
    tenantReference: 'mock-governance-tenant-05',
    tenantDisplayName: '[MOCK] 治理租户 05',
    scenario: 'expired',
  },
  {
    tenantReference: 'mock-governance-tenant-06',
    tenantDisplayName: '[MOCK] 治理租户 06',
    scenario: 'field_guard_blocked',
  },
];

function countBy<T extends string>(values: readonly T[], catalog: readonly T[]) {
  const counts = Object.fromEntries(catalog.map((value) => [value, 0])) as StatusCount<T>;
  for (const value of values) counts[value] += 1;
  return counts;
}

function authorizationForScenario(
  authorization: WeComTenantAuthorization,
  scenario: GovernanceScenario,
): WeComTenantAuthorization {
  if (scenario === 'provider_disabled' || scenario === 'external_disabled') {
    return {
      ...authorization,
      providerState: scenario === 'provider_disabled' ? 'disabled' : 'external_disabled',
    };
  }
  if (scenario === 'not_configured' || scenario === 'expired') {
    return {
      ...authorization,
      authorizationStatus: scenario,
    };
  }
  return authorization;
}

function contactsForScenario(
  fixture: WeComExternalContactMockFixture,
  scenario: GovernanceScenario,
): readonly unknown[] {
  if (scenario !== 'field_guard_blocked') return fixture.externalContacts;
  return fixture.externalContacts.map((contact, index) => index === 0
    ? { ...contact, unexpectedRawField: 'blocked_mock_value' }
    : contact);
}

function auditEventTypeFor(summary: WeComGovernanceTenantSummary): WeComAuditEventType {
  if (summary.reason === 'forbidden_field_blocked') return 'forbidden_field_blocked';
  if (
    summary.reason === 'provider_disabled' ||
    summary.reason === 'external_provider_disabled'
  ) return 'external_provider_disabled';
  if (summary.reason === 'authorization_not_available') {
    return 'authorization_status_changed';
  }
  return 'mock_snapshot_generated';
}

function buildTenantSummary(definition: ScenarioDefinition): WeComGovernanceTenantSummary {
  const fixture = createWeComExternalContactMockFixture({
    tenantId: definition.tenantReference,
    dataMode: 'mock',
  });
  const authorization = authorizationForScenario(fixture.authorization, definition.scenario);
  const view = createWeComExternalContactReadonlyView({
    tenantId: definition.tenantReference,
    authorization,
    contacts: contactsForScenario(fixture, definition.scenario),
    dataMode: fixture.dataMode,
    occurredAt: fixture.syncSnapshot.finishedAt,
  });

  return {
    tenantReference: definition.tenantReference,
    tenantDisplayName: definition.tenantDisplayName,
    authorizationStatus: view.authorizationStatus,
    providerState: authorization.providerState,
    syncStatus: view.syncStatus,
    failClosed: view.failClosed,
    reason: view.reason,
    lastMockSnapshotAt: view.failClosed ? null : fixture.syncSnapshot.finishedAt,
  };
}

export function createWeComPlatformGovernancePayload(): WeComPlatformGovernancePayload {
  const tenantSummaries = scenarioDefinitions.map(buildTenantSummary);
  const anomalousTenants = tenantSummaries.filter((tenant) => tenant.failClosed);
  const events = tenantSummaries.map((tenant) => ({
    eventType: auditEventTypeFor(tenant),
    blocked: tenant.failClosed,
  }));
  const eventTypes = [...new Set(events.map((event) => event.eventType))];
  const fieldBlockedTenantCount = tenantSummaries.filter(
    (tenant) => tenant.reason === 'forbidden_field_blocked',
  ).length;

  return {
    sourceKind: 'controlled_mock_governance_summary',
    mockDemo: true,
    dataMode: 'mock',
    readonly: true,
    containsRealCustomerData: false,
    generatedAt,
    latestMockSnapshotAt: snapshotAt,
    authorizationStatusSummary: {
      totalTenants: tenantSummaries.length,
      counts: countBy(
        tenantSummaries.map((tenant) => tenant.authorizationStatus),
        weComAuthorizationStatuses,
      ),
    },
    providerStatusSummary: {
      counts: countBy(
        tenantSummaries.map((tenant) => tenant.providerState),
        weComGovernanceProviderStates,
      ),
      externalCapabilityEnabled: false,
    },
    syncHealthSummary: {
      counts: countBy(
        tenantSummaries.map((tenant) => tenant.syncStatus),
        weComSyncStatuses,
      ),
      healthyTenantCount: tenantSummaries.filter((tenant) => !tenant.failClosed).length,
      blockedTenantCount: anomalousTenants.length,
    },
    anomalousTenants,
    fieldBlockingSummary: {
      whitelistApplied: true,
      defaultDeny: true,
      forbiddenFieldsReturned: false,
      blockedTenantCount: fieldBlockedTenantCount,
      blockedAttemptCount: fieldBlockedTenantCount,
      allowedCategories: [
        'governance_status',
        'authorization_state',
        'sync_health',
        'audit_counts',
      ],
      blockedCategories: [
        'credential_material',
        'direct_identity',
        'contact_detail',
        'communication_payload',
      ],
    },
    auditSummary: {
      eventCount: events.length,
      blockedEventCount: events.filter((event) => event.blocked).length,
      containsSensitivePayload: false,
      latestEventAt: generatedAt,
      eventsByType: eventTypes.map((eventType) => {
        const matchingEvents = events.filter((event) => event.eventType === eventType);
        return {
          eventType,
          count: matchingEvents.length,
          blockedCount: matchingEvents.filter((event) => event.blocked).length,
        };
      }),
    },
    failClosedStatus: {
      enabled: true,
      blockedTenantCount: anomalousTenants.length,
      externalCallsAllowed: false,
      notice: 'authorization_provider_and_field_policy_default_deny',
    },
  };
}
