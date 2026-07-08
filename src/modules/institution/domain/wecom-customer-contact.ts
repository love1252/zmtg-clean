import type { WeComAuthorizationRecord } from '@/modules/institution/domain/wecom-authorization';
import { sanitizeWeComAuthorizationText } from '@/modules/institution/domain/wecom-authorization';

export const weComCustomerContactSyncStatuses = [
  'not_synced',
  'mock_synced',
  'partial_synced',
  'sync_failed',
  'authorization_unavailable',
  'external_channel_disabled',
] as const;

export type WeComCustomerContactSyncStatus = (typeof weComCustomerContactSyncStatuses)[number];

export type WeComCustomerContactMockSource =
  | '到院咨询低敏线索'
  | '术后随访低敏线索'
  | '复购窗口低敏线索'
  | '企业微信客户联系 mock';

export type WeComCustomerContactMockRecord = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  authorizationRecordId: string;
  mockExternalContactId: string;
  customerDisplayName: string;
  weComCustomerRef: string;
  ownerEmployeeRef: string;
  ownerEmployeeDisplayName: string;
  mappedSystemEmployeeRef: string | null;
  ownerEmployeeMapped: boolean;
  source: WeComCustomerContactMockSource;
  tags: string[];
  remarkSummary: string;
  addedAt: string;
  lastSyncedAt: string | null;
  syncStatus: WeComCustomerContactSyncStatus;
  lastErrorReason: string | null;
  availableForFollowUp: boolean;
  linkedToSystemCustomer: boolean;
  customerId: string | null;
  notPersonalWechatFriend: true;
  noChatHistorySynced: true;
  createdAt: string;
  updatedAt: string;
};

export type WeComCustomerContactMockListItemView = Pick<
  WeComCustomerContactMockRecord,
  | 'mockExternalContactId'
  | 'customerDisplayName'
  | 'weComCustomerRef'
  | 'ownerEmployeeRef'
  | 'ownerEmployeeDisplayName'
  | 'mappedSystemEmployeeRef'
  | 'ownerEmployeeMapped'
  | 'source'
  | 'tags'
  | 'remarkSummary'
  | 'addedAt'
  | 'lastSyncedAt'
  | 'syncStatus'
  | 'lastErrorReason'
  | 'availableForFollowUp'
  | 'linkedToSystemCustomer'
  | 'customerId'
  | 'notPersonalWechatFriend'
  | 'noChatHistorySynced'
> & {
  syncStatusLabel: string;
};

export type WeComCustomerContactSyncDashboardView = {
  title: '企业微信客户联系 mock 同步';
  status: WeComCustomerContactSyncStatus;
  statusLabel: string;
  authorizationRecordId: string | null;
  externalContactCount: number;
  linkedSystemCustomerCount: number;
  unlinkedCustomerCount: number;
  availableForFollowUpCount: number;
  unavailableForFollowUpCount: number;
  mappedOwnerEmployeeCount: number;
  unmappedOwnerEmployeeCount: number;
  tagsSummary: string;
  sourceSummary: string;
  ownerEmployeeSummary: string;
  remarkSummary: string;
  lastSyncedAt: string | null;
  lastErrorReason: string | null;
  currentOnlyMock: true;
  notWeComLogin: true;
  notPersonalWechatFriendSync: true;
  notChatHistorySync: true;
  notConnectedToRealWeCom: true;
  noRealOutbound: true;
  noRealCustomerSync: true;
  sessionArchivePostponed: true;
  safeSummary: string;
  deliveryPrerequisites: {
    authorizationRequired: true;
    customerContactRequired: true;
    humanApprovalRequired: true;
    messageDeliveryRequired: true;
    description: string;
  };
  contacts: WeComCustomerContactMockListItemView[];
};

type CustomerContactSeed = {
  customerId?: string | null;
  customerDisplayName?: string | null;
  ownerEmployeeRef?: string | null;
  ownerEmployeeDisplayName?: string | null;
  mappedSystemEmployeeRef?: string | null;
  source?: WeComCustomerContactMockSource | string | null;
  tags?: string[] | null;
  remarkSummary?: string | null;
  addedAt?: string | null;
  lastSyncedAt?: string | null;
  syncStatus?: WeComCustomerContactSyncStatus | null;
  lastErrorReason?: string | null;
  availableForFollowUp?: boolean;
  linkedToSystemCustomer?: boolean;
};

const syncStatusLabels: Record<WeComCustomerContactSyncStatus, string> = {
  not_synced: '未同步',
  mock_synced: '模拟已同步',
  partial_synced: '部分同步',
  sync_failed: '同步失败',
  authorization_unavailable: '授权不可用',
  external_channel_disabled: '外部通道未启用',
};

const sourceOptions: WeComCustomerContactMockSource[] = [
  '到院咨询低敏线索',
  '术后随访低敏线索',
  '复购窗口低敏线索',
  '企业微信客户联系 mock',
];

const defaultTags = ['低敏标签', '需人工确认', 'mock'];

const forbiddenCustomerContactPatterns = [
  /\bww[0-9a-f]{6,}\b/iu,
  /(?:external|open)[_-]?user[_-]?id/iu,
  /user[_-]?id/iu,
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /\b(?:secret|access[_-]?token|refresh[_-]?token|encodingAESKey|callback[_-]?token|api[_-]?key|private[_-]?key)\b/iu,
  /\bHIS\b|his payload|完整聊天|聊天记录|consultationTranscript|raw response|raw payload/iu,
  /\b(?:provider|model|token|vendor|cost|prompt)\b/iu,
];

function containsUnsafeWeComCustomerContactText(input: string) {
  return forbiddenCustomerContactPatterns.some((pattern) => pattern.test(input));
}

function safeText(input: string | null | undefined, fallback: string, limit = 120) {
  const sanitized = sanitizeWeComAuthorizationText(input, fallback, limit);
  if (!sanitized || containsUnsafeWeComCustomerContactText(sanitized)) return fallback;
  return sanitized;
}

function safeId(input: string | null | undefined, fallback: string) {
  return safeText(input, fallback, 96);
}

function safeTags(input: string[] | null | undefined) {
  const tags = (input && input.length > 0 ? input : defaultTags)
    .map((tag) => safeText(tag, '低敏标签', 24))
    .filter(Boolean)
    .slice(0, 4);
  return [...new Set(tags)];
}

function isWeComCustomerContactSyncStatus(input: unknown): input is WeComCustomerContactSyncStatus {
  return typeof input === 'string' && (weComCustomerContactSyncStatuses as readonly string[]).includes(input);
}

function syncStatusForAuthorization(authorization: WeComAuthorizationRecord | null | undefined) {
  if (!authorization) return 'authorization_unavailable' as const;
  if (authorization.status === 'external_channel_disabled') return 'external_channel_disabled' as const;
  if (authorization.status !== 'mock_authorized') return 'authorization_unavailable' as const;
  if (!authorization.customerContactAuthorized || !authorization.externalContactSyncAuthorized || !authorization.customerOwnerSyncAuthorized) {
    return 'authorization_unavailable' as const;
  }
  return 'mock_synced' as const;
}

function aggregateStatus(records: readonly WeComCustomerContactMockRecord[], fallback: WeComCustomerContactSyncStatus) {
  if (records.length === 0) return fallback === 'mock_synced' ? 'not_synced' : fallback;
  if (records.some((record) => record.syncStatus === 'sync_failed')) return 'sync_failed';
  if (records.some((record) => record.syncStatus === 'partial_synced')) return 'partial_synced';
  if (records.every((record) => record.syncStatus === 'mock_synced')) return 'mock_synced';
  return records[0]?.syncStatus ?? fallback;
}

function contactId(input: { authorizationRecordId: string; index: number }) {
  return safeId(`wecom-contact:mock:${input.authorizationRecordId}:${input.index + 1}`, 'wecom-contact:mock-low-sensitive');
}

function mockExternalContactId(index: number) {
  return `mock-external-contact:${String(index + 1).padStart(2, '0')}`;
}

function defaultOwner(index: number) {
  const owners = [
    { ref: 'mock-employee:consultant-a', name: '企微员工A（低敏）', mapped: 'system-employee:consultant-a' },
    { ref: 'mock-employee:service-b', name: '企微员工B（低敏）', mapped: 'system-employee:service-b' },
    { ref: 'mock-employee:unmapped', name: '未映射企微员工（低敏）', mapped: null },
  ];
  return owners[index % owners.length];
}

export function weComCustomerContactSyncStatusLabel(status: WeComCustomerContactSyncStatus) {
  return syncStatusLabels[status];
}

export function createWeComCustomerContactMockRecord(input: {
  tenantId: string;
  institutionId: string | null;
  authorizationRecordId: string;
  seed: CustomerContactSeed;
  index: number;
  occurredAt: string;
  defaultSyncStatus?: WeComCustomerContactSyncStatus;
}): WeComCustomerContactMockRecord {
  const owner = defaultOwner(input.index);
  const syncStatus = isWeComCustomerContactSyncStatus(input.seed.syncStatus)
    ? input.seed.syncStatus
    : input.defaultSyncStatus ?? 'not_synced';
  const linkedToSystemCustomer = input.seed.linkedToSystemCustomer ?? Boolean(input.seed.customerId);
  const mappedSystemEmployeeRef = input.seed.mappedSystemEmployeeRef === undefined
    ? owner.mapped
    : input.seed.mappedSystemEmployeeRef;
  const ownerEmployeeMapped = Boolean(mappedSystemEmployeeRef);
  const availableForFollowUp = input.seed.availableForFollowUp ?? (
    syncStatus === 'mock_synced' &&
    linkedToSystemCustomer &&
    ownerEmployeeMapped
  );

  return {
    id: contactId({ authorizationRecordId: input.authorizationRecordId, index: input.index }),
    tenantId: safeId(input.tenantId, 'tenant:low-sensitive'),
    institutionId: input.institutionId ? safeId(input.institutionId, 'institution:low-sensitive') : null,
    authorizationRecordId: safeId(input.authorizationRecordId, 'wecom-auth:mock-low-sensitive'),
    mockExternalContactId: mockExternalContactId(input.index),
    customerDisplayName: safeText(input.seed.customerDisplayName, '低敏客户', 40),
    weComCustomerRef: safeId(`wecom-customer:mock:${input.index + 1}`, 'wecom-customer:mock-low-sensitive'),
    ownerEmployeeRef: safeId(input.seed.ownerEmployeeRef ?? owner.ref, 'mock-employee:low-sensitive'),
    ownerEmployeeDisplayName: safeText(input.seed.ownerEmployeeDisplayName ?? owner.name, '企微员工低敏名称', 40),
    mappedSystemEmployeeRef: mappedSystemEmployeeRef ? safeId(mappedSystemEmployeeRef, 'system-employee:low-sensitive') : null,
    ownerEmployeeMapped,
    source: sourceOptions.includes(input.seed.source as WeComCustomerContactMockSource)
      ? input.seed.source as WeComCustomerContactMockSource
      : sourceOptions[input.index % sourceOptions.length],
    tags: safeTags(input.seed.tags),
    remarkSummary: safeText(input.seed.remarkSummary, '备注仅保留低敏摘要，未包含联系方式、证件号或会话内容。', 120),
    addedAt: input.seed.addedAt ?? input.occurredAt,
    lastSyncedAt: input.seed.lastSyncedAt ?? (syncStatus === 'mock_synced' || syncStatus === 'partial_synced' ? input.occurredAt : null),
    syncStatus,
    lastErrorReason: input.seed.lastErrorReason ? safeText(input.seed.lastErrorReason, '低敏同步异常。', 120) : null,
    availableForFollowUp,
    linkedToSystemCustomer,
    customerId: input.seed.customerId ? safeId(input.seed.customerId, 'customer:low-sensitive') : null,
    notPersonalWechatFriend: true,
    noChatHistorySynced: true,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

export function createWeComCustomerContactMockRecords(input: {
  tenantId: string;
  institutionId: string | null;
  authorization: WeComAuthorizationRecord | null | undefined;
  customerSeeds?: CustomerContactSeed[];
  occurredAt: string;
}): WeComCustomerContactMockRecord[] {
  const defaultSyncStatus = syncStatusForAuthorization(input.authorization);
  if (defaultSyncStatus === 'authorization_unavailable' || defaultSyncStatus === 'external_channel_disabled') return [];

  const seeds = input.customerSeeds?.length ? input.customerSeeds : [
    {
      customerDisplayName: '低敏客户A',
      customerId: 'customer:mock-linked-a',
      tags: ['术后关怀', '低敏标签'],
      source: '术后随访低敏线索',
      remarkSummary: '术后随访候选，仅保留低敏摘要。',
    },
    {
      customerDisplayName: '低敏客户B',
      customerId: null,
      tags: ['到院咨询', '未关联'],
      source: '到院咨询低敏线索',
      remarkSummary: '外部联系人尚未关联系统客户。',
      mappedSystemEmployeeRef: null,
      linkedToSystemCustomer: false,
    },
  ];

  return seeds.map((seed, index) => createWeComCustomerContactMockRecord({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    authorizationRecordId: input.authorization?.id ?? 'wecom-auth:mock-low-sensitive',
    seed,
    index,
    occurredAt: input.occurredAt,
    defaultSyncStatus,
  }));
}

export function mapWeComCustomerContactRecordToListItem(
  record: WeComCustomerContactMockRecord,
): WeComCustomerContactMockListItemView {
  return {
    mockExternalContactId: record.mockExternalContactId,
    customerDisplayName: record.customerDisplayName,
    weComCustomerRef: record.weComCustomerRef,
    ownerEmployeeRef: record.ownerEmployeeRef,
    ownerEmployeeDisplayName: record.ownerEmployeeDisplayName,
    mappedSystemEmployeeRef: record.mappedSystemEmployeeRef,
    ownerEmployeeMapped: record.ownerEmployeeMapped,
    source: record.source,
    tags: record.tags,
    remarkSummary: record.remarkSummary,
    addedAt: record.addedAt,
    lastSyncedAt: record.lastSyncedAt,
    syncStatus: record.syncStatus,
    syncStatusLabel: weComCustomerContactSyncStatusLabel(record.syncStatus),
    lastErrorReason: record.lastErrorReason,
    availableForFollowUp: record.availableForFollowUp,
    linkedToSystemCustomer: record.linkedToSystemCustomer,
    customerId: record.customerId,
    notPersonalWechatFriend: true,
    noChatHistorySynced: true,
  };
}

function summarizeValues(values: readonly string[], fallback: string) {
  const uniqueValues = [...new Set(values.map((value) => safeText(value, '', 28)).filter(Boolean))];
  if (uniqueValues.length === 0) return fallback;
  return uniqueValues.slice(0, 4).join(' / ');
}

export function mapWeComCustomerContactsToDashboardView(input: {
  authorization: WeComAuthorizationRecord | null | undefined;
  contacts: WeComCustomerContactMockRecord[];
}): WeComCustomerContactSyncDashboardView {
  const fallbackStatus = syncStatusForAuthorization(input.authorization);
  const status = aggregateStatus(input.contacts, fallbackStatus);
  const linkedSystemCustomerCount = input.contacts.filter((contact) => contact.linkedToSystemCustomer).length;
  const availableForFollowUpCount = input.contacts.filter((contact) => contact.availableForFollowUp).length;
  const mappedOwnerEmployeeCount = input.contacts.filter((contact) => contact.ownerEmployeeMapped).length;
  const lastSyncedAt = input.contacts
    .map((contact) => contact.lastSyncedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  const lastErrorReason = input.contacts.find((contact) => contact.lastErrorReason)?.lastErrorReason ?? (
    status === 'authorization_unavailable'
      ? '企业微信授权不可用，客户联系 mock 同步保持安全空态。'
      : status === 'external_channel_disabled'
        ? '企业微信外部通道未启用，客户联系 mock 不会真实出网。'
        : status === 'not_synced'
          ? '尚未执行客户联系 mock 同步。'
          : null
  );

  return {
    title: '企业微信客户联系 mock 同步',
    status,
    statusLabel: weComCustomerContactSyncStatusLabel(status),
    authorizationRecordId: input.authorization?.id ?? null,
    externalContactCount: input.contacts.length,
    linkedSystemCustomerCount,
    unlinkedCustomerCount: input.contacts.length - linkedSystemCustomerCount,
    availableForFollowUpCount,
    unavailableForFollowUpCount: input.contacts.length - availableForFollowUpCount,
    mappedOwnerEmployeeCount,
    unmappedOwnerEmployeeCount: input.contacts.length - mappedOwnerEmployeeCount,
    tagsSummary: summarizeValues(input.contacts.flatMap((contact) => contact.tags), '暂无客户标签低敏摘要'),
    sourceSummary: summarizeValues(input.contacts.map((contact) => contact.source), '暂无客户来源低敏摘要'),
    ownerEmployeeSummary: summarizeValues(input.contacts.map((contact) => contact.ownerEmployeeDisplayName), '客户归属员工未映射，仅展示低敏空态'),
    remarkSummary: summarizeValues(input.contacts.map((contact) => contact.remarkSummary), '暂无客户备注低敏摘要'),
    lastSyncedAt,
    lastErrorReason,
    currentOnlyMock: true,
    notWeComLogin: true,
    notPersonalWechatFriendSync: true,
    notChatHistorySync: true,
    notConnectedToRealWeCom: true,
    noRealOutbound: true,
    noRealCustomerSync: true,
    sessionArchivePostponed: true,
    safeSummary: '当前仅 mock：未接真实企业微信，不真实出网，不同步真实客户，不同步真实外部联系人，不同步个人微信好友，不同步聊天记录。',
    deliveryPrerequisites: {
      authorizationRequired: true,
      customerContactRequired: true,
      humanApprovalRequired: true,
      messageDeliveryRequired: true,
      description: '后续企业微信触达必须先有授权状态、客户联系关系、人工确认和 MessageDelivery；当前不会真实发送。',
    },
    contacts: input.contacts.map(mapWeComCustomerContactRecordToListItem),
  };
}

export function createWeComCustomerContactSyncDashboardView(input: {
  tenantId: string;
  institutionId: string | null;
  authorization: WeComAuthorizationRecord | null | undefined;
  customerSeeds?: CustomerContactSeed[];
  occurredAt: string;
}) {
  const contacts = createWeComCustomerContactMockRecords(input);
  return mapWeComCustomerContactsToDashboardView({ authorization: input.authorization, contacts });
}

export function getDefaultWeComCustomerContactSyncDashboardView(): WeComCustomerContactSyncDashboardView {
  return mapWeComCustomerContactsToDashboardView({ authorization: null, contacts: [] });
}
