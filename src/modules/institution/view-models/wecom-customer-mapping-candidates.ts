import type {
  WeComCustomerMappingDataMode,
  WeComCustomerMappingSourceKind,
  WeComCustomerMappingStatus,
} from '@/modules/institution/domain/wecom-customer-mapping-review';

export const weComCustomerMappingCandidatesResponseKeys = [
  'sourceKind',
  'dataMode',
  'mockDemo',
  'readonly',
  'authorizationStatus',
  'providerStatus',
  'candidates',
  'mappingStatus',
  'confidenceLevel',
  'conflictSummary',
  'manualReviewStatus',
  'auditSummary',
  'failClosedReason',
  'autoMergePerformed',
  'realCustomerRelationshipWritten',
] as const;

const rawResponseKeys = ['tenantId', ...weComCustomerMappingCandidatesResponseKeys] as const;
const candidateKeys = [
  'externalContactSummary',
  'systemCustomerSummary',
  'mappingStatus',
  'confidenceLevel',
  'conflictSummary',
  'manualReviewStatus',
] as const;
const externalContactSummaryKeys = [
  'displayName',
  'ownerSummary',
  'tagNames',
  'sourceType',
  'addedAtDate',
  'remarkSummary',
] as const;
const systemCustomerSummaryKeys = [
  'mockCustomerNumber',
  'displayNameSummary',
  'ownerSummary',
  'tagNames',
  'statusSummary',
] as const;
const conflictSummaryKeys = ['status', 'unresolvedCount'] as const;
const auditSummaryKeys = ['status', 'eventType', 'reasonCode'] as const;

const authorizationStatuses = [
  'not_configured',
  'authorized',
  'revoked',
  'expired',
  'disabled',
  'external_disabled',
  'manual_review_required',
  'unavailable',
] as const;
const providerStatuses = ['mock_only', 'disabled', 'external_disabled', 'unavailable'] as const;
const mappingStatuses = [
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
] as const;
const auditStatuses = ['recorded', 'blocked'] as const;
export const weComCustomerMappingAuditEventTypes = [
  'mapping_candidate_generated',
  'mapping_provider_disabled',
  'mapping_external_provider_disabled',
  'mapping_authorization_revoked',
  'mapping_candidates_read_blocked',
  'mapping_input_blocked',
] as const;
export const weComCustomerMappingAuditReasonCodes = [
  'candidate_evidence_available',
  'provider_disabled',
  'external_provider_disabled',
  'authorization_revoked',
  'tenant_fixture_unavailable',
  'fixture_registry_initialization_blocked',
  'audit_not_ready',
  'manifest_entry_missing',
  'response_contract_invalid',
  'response_json_invalid',
  'response_unavailable',
] as const;
export const weComCustomerMappingFailClosedReasons = [
  'provider_disabled',
  'external_provider_disabled',
  'authorization_revoked',
  'tenant_fixture_unavailable',
  'fixture_registry_initialization_blocked',
  'audit_not_ready',
  'manifest_entry_missing',
  'response_contract_invalid',
  'response_json_invalid',
  'response_unavailable',
] as const;

export type WeComCustomerMappingAuthorizationStatus = (typeof authorizationStatuses)[number];
export type WeComCustomerMappingProviderStatus = (typeof providerStatuses)[number];
export type WeComCustomerMappingAuditEventType =
  (typeof weComCustomerMappingAuditEventTypes)[number];
export type WeComCustomerMappingAuditReasonCode =
  (typeof weComCustomerMappingAuditReasonCodes)[number];
export type WeComCustomerMappingFailClosedReason =
  (typeof weComCustomerMappingFailClosedReasons)[number];

export type WeComCustomerMappingConflictSummary = {
  status: 'none' | 'unresolved' | 'unavailable';
  unresolvedCount: number;
};

export type WeComCustomerMappingAuditSummary = {
  status: (typeof auditStatuses)[number];
  eventType: WeComCustomerMappingAuditEventType;
  reasonCode: WeComCustomerMappingAuditReasonCode;
};

export type WeComCustomerMappingCandidateSummary = {
  externalContactSummary: {
    displayName: string;
    ownerSummary: string;
    tagNames: string[];
    sourceType: 'qr_code' | 'employee_share' | 'group_chat' | 'other_mock';
    addedAtDate: string;
    remarkSummary: string;
  };
  systemCustomerSummary: {
    mockCustomerNumber: string;
    displayNameSummary: string;
    ownerSummary: string;
    tagNames: string[];
    statusSummary: 'active' | 'inactive' | 'manual_review_required';
  };
  mappingStatus: WeComCustomerMappingStatus;
  confidenceLevel: 'low' | 'medium' | 'high';
  conflictSummary: WeComCustomerMappingConflictSummary;
  manualReviewStatus: 'not_required' | 'pending' | 'required' | 'unavailable';
};

export type WeComCustomerMappingCandidatesResponse = {
  sourceKind: WeComCustomerMappingSourceKind;
  dataMode: WeComCustomerMappingDataMode;
  mockDemo: true;
  readonly: true;
  authorizationStatus: WeComCustomerMappingAuthorizationStatus;
  providerStatus: WeComCustomerMappingProviderStatus;
  candidates: WeComCustomerMappingCandidateSummary[];
  mappingStatus: WeComCustomerMappingStatus;
  confidenceLevel: 'low' | 'medium' | 'high' | null;
  conflictSummary: WeComCustomerMappingConflictSummary;
  manualReviewStatus: 'not_required' | 'pending' | 'required' | 'unavailable';
  auditSummary: WeComCustomerMappingAuditSummary;
  failClosedReason: WeComCustomerMappingFailClosedReason | null;
  autoMergePerformed: false;
  realCustomerRelationshipWritten: false;
};

export type WeComCustomerMappingCandidatesRawView = WeComCustomerMappingCandidatesResponse & {
  tenantId: string;
};

type SafeRecord = Record<string, unknown>;

type NodeProcessWithBuiltinModule = {
  getBuiltinModule?: (specifier: string) => {
    types?: { isProxy?: (value: unknown) => boolean };
  } | undefined;
};

const nodeIsProxy = (() => {
  try {
    const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const processValue = processDescriptor && 'value' in processDescriptor
      ? processDescriptor.value as NodeProcessWithBuiltinModule
      : processDescriptor?.get
        ? Reflect.apply(processDescriptor.get, globalThis, []) as NodeProcessWithBuiltinModule
        : undefined;
    const getBuiltinModule = processValue?.getBuiltinModule;
    if (typeof getBuiltinModule !== 'function') return null;
    const util = Reflect.apply(getBuiltinModule, processValue, ['node:util']);
    return typeof util?.types?.isProxy === 'function' ? util.types.isProxy : null;
  } catch {
    return null;
  }
})();

function isNativeProxy(value: unknown) {
  try {
    return nodeIsProxy?.(value) ?? false;
  } catch {
    return true;
  }
}

function isPlainDataRecord(value: unknown): value is SafeRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || isNativeProxy(value)) return false;
  let prototype: object | null;
  let descriptors: ReturnType<typeof Object.getOwnPropertyDescriptors>;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(descriptors);
  return keys.every((key) => {
    const descriptor = descriptors[key as keyof typeof descriptors];
    return Boolean(
      descriptor &&
      'value' in descriptor &&
      descriptor.enumerable === true &&
      typeof descriptor.get !== 'function' &&
      typeof descriptor.set !== 'function',
    );
  });
}

function dataEntries(value: SafeRecord) {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).some((key) => typeof key === 'symbol')) return null;
    return Object.entries(descriptors).map(
      ([key, descriptor]) => [key, descriptor.value] as const,
    );
  } catch {
    return null;
  }
}

function hasExactKeys(value: SafeRecord, expected: readonly string[]) {
  const entries = dataEntries(value);
  if (!entries) return false;
  const keys = entries.map(([key]) => key);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function ownDataValue(value: SafeRecord, key: string) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function isSafeText(value: unknown, maximum = 160): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value.trim() === value &&
    !Array.from(value).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
    })
  );
}

function arrayDataDescriptors(value: unknown[]) {
  if (isNativeProxy(value)) return null;
  let prototype: object | null;
  let descriptors: ReturnType<typeof Object.getOwnPropertyDescriptors>;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  if (prototype !== Array.prototype) return null;
  const descriptorKeys = Reflect.ownKeys(descriptors);
  const allowedKeys = new Set([
    'length',
    ...Array.from({ length: value.length }, (_, index) => String(index)),
  ]);
  if (
    descriptorKeys.some((key) => typeof key === 'symbol' || !allowedKeys.has(key)) ||
    Array.from({ length: value.length }, (_, index) => descriptors[index]).some(
      (descriptor) => !descriptor || !('value' in descriptor) || descriptor.enumerable !== true,
    )
  ) {
    return null;
  }
  return descriptors;
}

function isSafeTextList(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > 20) return false;
  const descriptors = arrayDataDescriptors(value);
  if (!descriptors) return false;
  const items = Array.from({ length: value.length }, (_, index) => descriptors[index]?.value);
  return items.every((item) => isSafeText(item)) && new Set(items).size === items.length;
}

const replaceText = Function.call.bind(String.prototype.replace) as (
  value: string,
  searchValue: RegExp,
  replaceValue: string,
) => string;
const lowerCaseText = Function.call.bind(String.prototype.toLowerCase) as (value: string) => string;
const testPattern = Function.call.bind(RegExp.prototype.test) as (
  pattern: RegExp,
  value: string,
) => boolean;
const sensitiveAsciiTokenPattern = /(?:^|[^a-z0-9])(?:token|payload|conversation|archive)(?=$|[^a-z0-9])/iu;
const unsafeUnicodeCategoryPattern = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Nl}]/u;
const numericCandidateBridgePattern = /[\p{P}\p{Z}\p{M}\p{C}\p{S}\p{Lm}]/u;
const ordinaryLetterBoundaryPattern = /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]/u;
const maximumDisplayStringCodePoints = 512;
const maximumNumericCandidateCodePoints = 64;
const maximumNumericBridgeLookaheadCodePoints = 64;
const maximumNumericCandidates = 32;
const maximumStringTraversalDepth = 12;

type NumericScanResult = 'safe' | 'sensitive' | 'limit-exceeded';

function foldFullwidthAscii(value: string) {
  let folded = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0xFF01 && codePoint <= 0xFF5E) {
      folded += String.fromCodePoint(codePoint - 0xFEE0);
    } else if (codePoint === 0x3000) {
      folded += ' ';
    } else {
      folded += character;
    }
  }
  return folded;
}

function asciiDigit(character: string) {
  const codePoint = character.codePointAt(0) ?? -1;
  if (codePoint >= 0x30 && codePoint <= 0x39) return character;
  if (codePoint >= 0xFF10 && codePoint <= 0xFF19) {
    return String.fromCodePoint(codePoint - 0xFEE0);
  }
  return null;
}

function isUnicodeNoncharacter(codePoint: number) {
  return (
    (codePoint >= 0xFDD0 && codePoint <= 0xFDEF) ||
    (codePoint <= 0x10FFFF && (codePoint & 0xFFFF) >= 0xFFFE)
  );
}

function hasUnsafeUnicode(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (isUnicodeNoncharacter(codePoint) || testPattern(unsafeUnicodeCategoryPattern, character)) {
      return true;
    }
  }
  return false;
}

function candidateToken(character: string) {
  const digit = asciiDigit(character);
  if (digit !== null) return digit;
  if (character === '+' || character === '＋') return '+';
  if (character === 'X' || character === 'x' || character === 'Ｘ' || character === 'ｘ') return 'X';
  return null;
}

function isNumericCandidateStart(character: string) {
  const token = candidateToken(character);
  return token === '+' || (token !== null && token !== 'X');
}

function isOrdinaryLetterBoundary(character: string) {
  return testPattern(ordinaryLetterBoundaryPattern, character);
}

function isNumericCandidateBridge(character: string) {
  return testPattern(numericCandidateBridgePattern, character);
}

function isSensitiveNumericProjection(projection: string, hasPhonePrefix: boolean) {
  const matchesPhone = hasPhonePrefix
    ? /^(?:\+86|0086)1[3-9]\d{9}$/u.test(projection)
    : /^1[3-9]\d{9}$/u.test(projection);
  return matchesPhone || /^(?:\d{18}|\d{17}X)$/u.test(projection);
}

type NumericBridgeLookahead =
  | { kind: 'continuation'; index: number; bridgeLength: number; modifierCount: number }
  | { kind: 'boundary' }
  | { kind: 'limit-exceeded' };

function isModifierLetter(character: string) {
  return testPattern(/\p{Lm}/u, character);
}

function lookAheadNumericContinuation(
  characters: readonly string[],
  startIndex: number,
): NumericBridgeLookahead {
  let cursor = startIndex;
  let bridgeLength = 0;
  let modifierCount = 0;

  while (cursor < characters.length) {
    const character = characters[cursor];
    const token = candidateToken(character);
    if (token !== null && token !== '+') {
      return { kind: 'continuation', index: cursor, bridgeLength, modifierCount };
    }
    if (isOrdinaryLetterBoundary(character) || !isNumericCandidateBridge(character)) {
      return { kind: 'boundary' };
    }
    bridgeLength += 1;
    if (isModifierLetter(character)) modifierCount += 1;
    if (bridgeLength > maximumNumericBridgeLookaheadCodePoints) {
      return { kind: 'limit-exceeded' };
    }
    cursor += 1;
  }

  return { kind: 'boundary' };
}

function hasNumericContinuationAfter(
  characters: readonly string[],
  startIndex: number,
): NumericBridgeLookahead {
  if (startIndex >= characters.length) return { kind: 'boundary' };
  const token = candidateToken(characters[startIndex]);
  if (token !== null && token !== '+') {
    return { kind: 'continuation', index: startIndex, bridgeLength: 0, modifierCount: 0 };
  }
  if (isOrdinaryLetterBoundary(characters[startIndex]) || !isNumericCandidateBridge(characters[startIndex])) {
    return { kind: 'boundary' };
  }
  return lookAheadNumericContinuation(characters, startIndex);
}

function scanBoundedNumericCandidates(characters: readonly string[]): NumericScanResult {
  let candidateCount = 0;
  let index = 0;

  while (index < characters.length) {
    if (!isNumericCandidateStart(characters[index])) {
      index += 1;
      continue;
    }

    candidateCount += 1;
    if (candidateCount > maximumNumericCandidates) return 'limit-exceeded';

    let projection = candidateToken(characters[index]) ?? '';
    let hasPhonePrefix = projection === '+';
    let spanLength = 1;
    let separatorCount = 0;
    let modifierCount = 0;
    let cursor = index + 1;

    while (cursor < characters.length) {
      const character = characters[cursor];
      const token = candidateToken(character);

      if (token !== null && token !== '+' && token !== 'X') {
        projection += token;
        if (projection === '0086') hasPhonePrefix = true;
        spanLength += 1;
        if (spanLength > maximumNumericCandidateCodePoints) return 'limit-exceeded';
        cursor += 1;
        continue;
      }

      if (token === 'X') {
        const continuation = hasNumericContinuationAfter(characters, cursor + 1);
        if (continuation.kind === 'limit-exceeded') return 'limit-exceeded';
        if (continuation.kind === 'continuation') return 'sensitive';
        spanLength += 1;
        if (spanLength > maximumNumericCandidateCodePoints) return 'limit-exceeded';
        cursor += 1;
        if (/^\d{17}$/u.test(projection)) projection += 'X';
        break;
      }

      if (isOrdinaryLetterBoundary(character) || !isNumericCandidateBridge(character)) break;

      const continuation = lookAheadNumericContinuation(characters, cursor);
      if (continuation.kind === 'limit-exceeded') return 'limit-exceeded';
      if (continuation.kind === 'boundary') break;
      spanLength += continuation.bridgeLength;
      separatorCount += continuation.bridgeLength - continuation.modifierCount;
      modifierCount += continuation.modifierCount;
      if (spanLength > maximumNumericCandidateCodePoints) return 'limit-exceeded';
      cursor = continuation.index;
    }

    if (isSensitiveNumericProjection(projection, hasPhonePrefix)) return 'sensitive';
    void separatorCount;
    void modifierCount;
    index = cursor;
  }

  return 'safe';
}

function hasSensitiveText(value: string) {
  if (value.length > maximumDisplayStringCodePoints * 2) return true;
  const characters: string[] = [];
  for (const character of value) {
    characters.push(character);
    if (characters.length > maximumDisplayStringCodePoints) return true;
  }
  if (
    isOneOf(value, authorizationStatuses) ||
    isOneOf(value, weComCustomerMappingAuditEventTypes) ||
    isOneOf(value, weComCustomerMappingAuditReasonCodes) ||
    isOneOf(value, weComCustomerMappingFailClosedReasons)
  ) {
    return false;
  }
  if (hasUnsafeUnicode(value)) return true;

  const folded = foldFullwidthAscii(value);
  const compact = lowerCaseText(replaceText(folded, /[ :：=._\-/\\]+/gu, ''));
  if (testPattern(sensitiveAsciiTokenPattern, folded)) return true;
  if (scanBoundedNumericCandidates(characters) !== 'safe') return true;
  return [
    'externaluserid',
    'userid',
    'accesstoken',
    'secret',
    'credential',
    'authorization',
    'rawresponse',
    'rawpayload',
    'apiresponse',
    'webhookpayload',
    '原始payload',
    '聊天正文',
    '消息正文',
    'conversationcontent',
    'conversationarchive',
    'sessionarchive',
    'chatcontent',
    'messagecontent',
    '聊天内容',
    '会话内容',
    '消息内容',
    '原始异常',
    'exceptionmessage',
    'errormessage',
    'stacktrace',
    'providerresponse',
    '提供方响应',
    '供应商响应',
  ].some((marker) => compact.includes(marker));
}

function allStringsAreLowSensitive(value: unknown, depth = 0): boolean {
  if (depth > maximumStringTraversalDepth) return false;
  if (typeof value === 'string') return !hasSensitiveText(value);
  if (Array.isArray(value)) {
    const descriptors = arrayDataDescriptors(value);
    if (!descriptors) return false;
    return Array.from({ length: value.length }, (_, index) => descriptors[index]?.value)
      .every((nested) => allStringsAreLowSensitive(nested, depth + 1));
  }
  if (typeof value === 'object' && value !== null) {
    if (!isPlainDataRecord(value)) return false;
    const entries = dataEntries(value);
    return Boolean(entries?.every(([, nested]) => allStringsAreLowSensitive(nested, depth + 1)));
  }
  return true;
}

function isOneOf<const T extends readonly unknown[]>(value: unknown, choices: T): value is T[number] {
  return choices.includes(value);
}

function parseConflictSummary(value: unknown): WeComCustomerMappingConflictSummary | null {
  if (!isPlainDataRecord(value) || !hasExactKeys(value, conflictSummaryKeys)) return null;
  const status = ownDataValue(value, 'status');
  const unresolvedCount = ownDataValue(value, 'unresolvedCount');
  if (
    !isOneOf(status, ['none', 'unresolved', 'unavailable'] as const) ||
    !Number.isSafeInteger(unresolvedCount) ||
    (unresolvedCount as number) < 0 ||
    (unresolvedCount as number) > 100
  ) {
    return null;
  }
  if (status === 'none' && unresolvedCount !== 0) return null;
  if (status === 'unresolved' && unresolvedCount === 0) return null;
  if (status === 'unavailable' && unresolvedCount !== 0) return null;
  return { status, unresolvedCount: unresolvedCount as number };
}

function parseAuditSummary(value: unknown): WeComCustomerMappingAuditSummary | null {
  if (!isPlainDataRecord(value) || !hasExactKeys(value, auditSummaryKeys)) return null;
  const status = ownDataValue(value, 'status');
  const eventType = ownDataValue(value, 'eventType');
  const reasonCode = ownDataValue(value, 'reasonCode');
  if (
    !isOneOf(status, auditStatuses) ||
    !isOneOf(eventType, weComCustomerMappingAuditEventTypes) ||
    !isOneOf(reasonCode, weComCustomerMappingAuditReasonCodes)
  ) {
    return null;
  }
  return { status, eventType, reasonCode };
}

function parseCandidate(value: unknown): WeComCustomerMappingCandidateSummary | null {
  if (!isPlainDataRecord(value) || !hasExactKeys(value, candidateKeys)) return null;
  const external = ownDataValue(value, 'externalContactSummary');
  const customer = ownDataValue(value, 'systemCustomerSummary');
  const conflict = parseConflictSummary(ownDataValue(value, 'conflictSummary'));
  const mappingStatus = ownDataValue(value, 'mappingStatus');
  const confidenceLevel = ownDataValue(value, 'confidenceLevel');
  const manualReviewStatus = ownDataValue(value, 'manualReviewStatus');
  if (
    !isPlainDataRecord(external) ||
    !hasExactKeys(external, externalContactSummaryKeys) ||
    !isPlainDataRecord(customer) ||
    !hasExactKeys(customer, systemCustomerSummaryKeys) ||
    !conflict
  ) {
    return null;
  }

  const externalDisplayName = ownDataValue(external, 'displayName');
  const externalOwnerSummary = ownDataValue(external, 'ownerSummary');
  const externalTagNames = ownDataValue(external, 'tagNames');
  const externalSourceType = ownDataValue(external, 'sourceType');
  const externalAddedAtDate = ownDataValue(external, 'addedAtDate');
  const externalRemarkSummary = ownDataValue(external, 'remarkSummary');
  const customerNumber = ownDataValue(customer, 'mockCustomerNumber');
  const customerDisplayName = ownDataValue(customer, 'displayNameSummary');
  const customerOwnerSummary = ownDataValue(customer, 'ownerSummary');
  const customerTagNames = ownDataValue(customer, 'tagNames');
  const customerStatus = ownDataValue(customer, 'statusSummary');

  if (
    !isSafeText(externalDisplayName) ||
    !isSafeText(externalOwnerSummary) ||
    !isSafeTextList(externalTagNames) ||
    !isOneOf(externalSourceType, ['qr_code', 'employee_share', 'group_chat', 'other_mock'] as const) ||
    typeof externalAddedAtDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(externalAddedAtDate) ||
    !isSafeText(externalRemarkSummary) ||
    !isSafeText(customerNumber, 32) ||
    !isSafeText(customerDisplayName) ||
    !isSafeText(customerOwnerSummary) ||
    !isSafeTextList(customerTagNames) ||
    !isOneOf(customerStatus, ['active', 'inactive', 'manual_review_required'] as const) ||
    !isOneOf(mappingStatus, mappingStatuses) ||
    !isOneOf(confidenceLevel, ['low', 'medium', 'high'] as const) ||
    !isOneOf(manualReviewStatus, ['not_required', 'pending', 'required', 'unavailable'] as const)
  ) {
    return null;
  }

  return {
    externalContactSummary: {
      displayName: externalDisplayName,
      ownerSummary: externalOwnerSummary,
      tagNames: [...externalTagNames],
      sourceType: externalSourceType,
      addedAtDate: externalAddedAtDate,
      remarkSummary: externalRemarkSummary,
    },
    systemCustomerSummary: {
      mockCustomerNumber: customerNumber,
      displayNameSummary: customerDisplayName,
      ownerSummary: customerOwnerSummary,
      tagNames: [...customerTagNames],
      statusSummary: customerStatus,
    },
    mappingStatus,
    confidenceLevel,
    conflictSummary: conflict,
    manualReviewStatus,
  };
}

export function createWeComCustomerMappingCandidatesFailClosedRawView(input: {
  tenantId: string;
  reason: WeComCustomerMappingFailClosedReason;
  sourceKind?: WeComCustomerMappingSourceKind;
  dataMode?: WeComCustomerMappingDataMode;
  authorizationStatus?: WeComCustomerMappingAuthorizationStatus;
  providerStatus?: WeComCustomerMappingProviderStatus;
  auditEventType?: WeComCustomerMappingAuditEventType;
}): WeComCustomerMappingCandidatesRawView {
  return {
    tenantId: input.tenantId,
    sourceKind: input.sourceKind ?? 'controlled_mock_fixture',
    dataMode: input.dataMode ?? 'mock',
    mockDemo: true,
    readonly: true,
    authorizationStatus: input.authorizationStatus ?? 'unavailable',
    providerStatus: input.providerStatus ?? 'unavailable',
    candidates: [],
    mappingStatus: 'disabled',
    confidenceLevel: null,
    conflictSummary: { status: 'unavailable', unresolvedCount: 0 },
    manualReviewStatus: 'unavailable',
    auditSummary: {
      status: 'blocked',
      eventType: input.auditEventType ?? 'mapping_candidates_read_blocked',
      reasonCode: input.reason,
    },
    failClosedReason: input.reason,
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
  };
}

function parseResponseRecord(
  value: unknown,
  expectedKeys: readonly string[],
): WeComCustomerMappingCandidatesResponse | null {
  if (!isPlainDataRecord(value) || !hasExactKeys(value, expectedKeys)) return null;
  if (!allStringsAreLowSensitive(value)) return null;

  const sourceKind = ownDataValue(value, 'sourceKind');
  const dataMode = ownDataValue(value, 'dataMode');
  const mockDemo = ownDataValue(value, 'mockDemo');
  const readonly = ownDataValue(value, 'readonly');
  const authorizationStatus = ownDataValue(value, 'authorizationStatus');
  const providerStatus = ownDataValue(value, 'providerStatus');
  const candidatesValue = ownDataValue(value, 'candidates');
  const mappingStatus = ownDataValue(value, 'mappingStatus');
  const confidenceLevel = ownDataValue(value, 'confidenceLevel');
  const manualReviewStatus = ownDataValue(value, 'manualReviewStatus');
  const failClosedReason = ownDataValue(value, 'failClosedReason');
  const autoMergePerformed = ownDataValue(value, 'autoMergePerformed');
  const realCustomerRelationshipWritten = ownDataValue(value, 'realCustomerRelationshipWritten');

  if (
    !isOneOf(sourceKind, ['controlled_mock_fixture', 'controlled_demo_fixture'] as const) ||
    !isOneOf(dataMode, ['mock', 'demo'] as const) ||
    mockDemo !== true ||
    readonly !== true ||
    !isOneOf(authorizationStatus, authorizationStatuses) ||
    !isOneOf(providerStatus, providerStatuses) ||
    !Array.isArray(candidatesValue) ||
    !arrayDataDescriptors(candidatesValue) ||
    candidatesValue.length > 20 ||
    !isOneOf(mappingStatus, mappingStatuses) ||
    !(confidenceLevel === null || isOneOf(confidenceLevel, ['low', 'medium', 'high'] as const)) ||
    !isOneOf(manualReviewStatus, ['not_required', 'pending', 'required', 'unavailable'] as const) ||
    !(failClosedReason === null || isOneOf(failClosedReason, weComCustomerMappingFailClosedReasons)) ||
    autoMergePerformed !== false ||
    realCustomerRelationshipWritten !== false
  ) {
    return null;
  }

  const candidates = candidatesValue.map(parseCandidate);
  const conflictSummary = parseConflictSummary(ownDataValue(value, 'conflictSummary'));
  const auditSummary = parseAuditSummary(ownDataValue(value, 'auditSummary'));
  if (candidates.some((candidate) => candidate === null) || !conflictSummary || !auditSummary) {
    return null;
  }
  if (failClosedReason !== null && candidates.length > 0) return null;
  if (failClosedReason !== null && auditSummary.reasonCode !== failClosedReason) return null;
  if (failClosedReason === null && auditSummary.status !== 'recorded') return null;
  if (failClosedReason !== null && auditSummary.status !== 'blocked') return null;
  if (dataMode === 'mock' && sourceKind !== 'controlled_mock_fixture') return null;
  if (dataMode === 'demo' && sourceKind !== 'controlled_demo_fixture') return null;

  return {
    sourceKind,
    dataMode,
    mockDemo: true,
    readonly: true,
    authorizationStatus,
    providerStatus,
    candidates: candidates as WeComCustomerMappingCandidateSummary[],
    mappingStatus,
    confidenceLevel,
    conflictSummary,
    manualReviewStatus,
    auditSummary,
    failClosedReason,
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
  };
}

export function parseWeComCustomerMappingCandidatesReadonlyResponse(
  value: unknown,
): WeComCustomerMappingCandidatesResponse | null {
  if (isNativeProxy(value)) return null;
  return parseResponseRecord(value, weComCustomerMappingCandidatesResponseKeys);
}

export function parseWeComCustomerMappingCandidatesResponse(
  value: unknown,
  expectedTenantId: string,
): WeComCustomerMappingCandidatesResponse | null {
  if (isNativeProxy(value)) return null;
  if (!isPlainDataRecord(value) || !hasExactKeys(value, rawResponseKeys)) return null;
  if (ownDataValue(value, 'tenantId') !== expectedTenantId) return null;
  const entries = dataEntries(value);
  if (!entries) return null;
  const readonlyValue = Object.fromEntries(entries.filter(([key]) => key !== 'tenantId'));
  return parseWeComCustomerMappingCandidatesReadonlyResponse(readonlyValue);
}
