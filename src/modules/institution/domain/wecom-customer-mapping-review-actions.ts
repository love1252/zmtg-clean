import { createHash } from 'node:crypto';
import { types as nodeTypes } from 'node:util';

export const weComCustomerMappingReviewActions = [
  'approve_candidate',
  'reject_candidate',
  'request_more_info',
  'mark_conflict',
  'reopen_review',
] as const;

export const weComCustomerMappingReviewStates = [
  'pending_review',
  'needs_more_info',
  'conflict',
  'approved_pending_link',
  'rejected',
  'reopened',
  'disabled',
] as const;

export type WeComCustomerMappingReviewAction = (typeof weComCustomerMappingReviewActions)[number];
export type WeComCustomerMappingReviewState = (typeof weComCustomerMappingReviewStates)[number];
export type WeComCustomerMappingReviewReasonCode =
  | 'manual_evidence_confirmed'
  | 'institution_record_match_confirmed'
  | 'evidence_not_sufficient'
  | 'candidate_not_same_person'
  | 'candidate_outdated'
  | 'missing_low_sensitive_evidence'
  | 'ownership_or_source_unclear'
  | 'multiple_candidate_conflict'
  | 'identity_evidence_conflict'
  | 'ownership_conflict'
  | 'new_low_sensitive_evidence'
  | 'prior_decision_reconsidered'
  | 'version_reconciliation';

export type WeComCustomerMappingReviewFailureCode =
  | 'unauthenticated'
  | 'permission_denied'
  | 'tenant_context_missing'
  | 'tenant_mismatch'
  | 'mapping_unavailable'
  | 'request_contract_invalid'
  | 'sensitive_input_blocked'
  | 'action_not_allowed'
  | 'version_conflict'
  | 'idempotency_key_invalid'
  | 'idempotency_conflict'
  | 'idempotency_in_progress'
  | 'idempotency_record_invalid'
  | 'idempotency_unavailable'
  | 'audit_unavailable'
  | 'transaction_failed'
  | 'response_contract_invalid';

export type WeComCustomerMappingReviewActionCommand = Readonly<{
  mappingId: string;
  action: WeComCustomerMappingReviewAction;
  expectedVersion: number;
  idempotencyKey: string;
  reasonCode: WeComCustomerMappingReviewReasonCode;
  note?: string;
}>;

export type WeComCustomerMappingReviewPermissionContext = Readonly<{
  authenticated: boolean;
  tenantId: string;
  institutionId: string;
  scope: 'tenant' | 'platform';
  capabilities: readonly string[];
}>;

export type WeComCustomerMappingReviewMapping = Readonly<{
  mappingId: string;
  tenantId: string;
  institutionId: string;
  state: WeComCustomerMappingReviewState;
  version: number;
}>;

export type WeComCustomerMappingReviewAuditEvent = Readonly<{
  eventType:
    | 'mapping_review_action_requested'
    | 'mapping_review_approved'
    | 'mapping_review_rejected'
    | 'mapping_review_more_info_requested'
    | 'mapping_review_conflict_marked'
    | 'mapping_review_reopened'
    | 'mapping_review_version_conflict'
    | 'mapping_review_idempotent_replay'
    | 'mapping_review_permission_denied'
    | 'mapping_review_tenant_mismatch'
    | 'mapping_review_audit_failed';
  mappingId: string | null;
  action: WeComCustomerMappingReviewAction | null;
  reasonCode: WeComCustomerMappingReviewReasonCode | WeComCustomerMappingReviewFailureCode;
  previousState: WeComCustomerMappingReviewState | null;
  nextState: WeComCustomerMappingReviewState | null;
  previousVersion: number | null;
  nextVersion: number | null;
  idempotencyKeyDigest: string | null;
}>;

export type WeComCustomerMappingReviewMutationResult = Readonly<{
  mappingId: string;
  action: WeComCustomerMappingReviewAction;
  reasonCode: WeComCustomerMappingReviewReasonCode;
  previousState: WeComCustomerMappingReviewState;
  nextState: WeComCustomerMappingReviewState;
  previousVersion: number;
  nextVersion: number;
  acceptedAuditReference: string;
  autoMergePerformed: false;
  realCustomerRelationshipWritten: false;
}>;

export type WeComCustomerMappingReviewIdempotencyRecord = Readonly<{
  tenantId: string;
  institutionId: string;
  mappingId: string;
  action: WeComCustomerMappingReviewAction;
  keyDigest: string;
  requestFingerprint: string;
  status: 'in_progress' | 'completed';
  completedResult: WeComCustomerMappingReviewMutationResult | null;
  completedResultDigest: string | null;
}>;

export type WeComCustomerMappingReviewAtomicBoundary = Readonly<{
  occupationResult:
    | 'acquired'
    | Readonly<{
      kind: 'existing';
      record: WeComCustomerMappingReviewIdempotencyRecord;
    }>;
  acceptedAuditReady: boolean;
  responseContractReady: boolean;
  transactionReady: boolean;
}>;

export type WeComCustomerMappingReviewSuccess = Readonly<{
  ok: true;
  idempotentReplay: boolean;
  mutationResult: WeComCustomerMappingReviewMutationResult;
  idempotencyRecord: WeComCustomerMappingReviewIdempotencyRecord;
  auditEvents: readonly WeComCustomerMappingReviewAuditEvent[];
}>;

export type WeComCustomerMappingReviewFailure = Readonly<{
  ok: false;
  reasonCode: WeComCustomerMappingReviewFailureCode;
  auditEvents: readonly WeComCustomerMappingReviewAuditEvent[];
}>;

export type WeComCustomerMappingReviewActionResult =
  | WeComCustomerMappingReviewSuccess
  | WeComCustomerMappingReviewFailure;

type CapturedObject = Readonly<Record<string, unknown>>;

const actionSet = new Set<string>(weComCustomerMappingReviewActions);
const stateSet = new Set<string>(weComCustomerMappingReviewStates);
const idempotencyKeyPattern = /^[A-Za-z0-9_-]{16,128}$/;
const safeIdentifierPattern = /^[A-Za-z0-9_-]{1,256}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const auditReferencePattern = /^audit:[0-9a-f]{32}$/;
const maxVersion = 2_147_483_647;

const reasonCodesByAction: Readonly<Record<WeComCustomerMappingReviewAction, readonly WeComCustomerMappingReviewReasonCode[]>> = {
  approve_candidate: ['manual_evidence_confirmed', 'institution_record_match_confirmed'],
  reject_candidate: ['evidence_not_sufficient', 'candidate_not_same_person', 'candidate_outdated'],
  request_more_info: ['missing_low_sensitive_evidence', 'ownership_or_source_unclear'],
  mark_conflict: ['multiple_candidate_conflict', 'identity_evidence_conflict', 'ownership_conflict'],
  reopen_review: ['new_low_sensitive_evidence', 'prior_decision_reconsidered', 'version_reconciliation'],
};

const nextStateByAction: Readonly<Record<WeComCustomerMappingReviewAction, WeComCustomerMappingReviewState>> = {
  approve_candidate: 'approved_pending_link',
  reject_candidate: 'rejected',
  request_more_info: 'needs_more_info',
  mark_conflict: 'conflict',
  reopen_review: 'reopened',
};

const allowedStatesByAction: Readonly<Record<WeComCustomerMappingReviewAction, readonly WeComCustomerMappingReviewState[]>> = {
  approve_candidate: ['pending_review', 'needs_more_info', 'reopened'],
  reject_candidate: ['pending_review', 'needs_more_info', 'conflict', 'reopened'],
  request_more_info: ['pending_review', 'conflict', 'reopened'],
  mark_conflict: ['pending_review', 'needs_more_info', 'reopened'],
  reopen_review: ['conflict', 'approved_pending_link', 'rejected'],
};

const acceptedEventByAction: Readonly<Record<WeComCustomerMappingReviewAction, WeComCustomerMappingReviewAuditEvent['eventType']>> = {
  approve_candidate: 'mapping_review_approved',
  reject_candidate: 'mapping_review_rejected',
  request_more_info: 'mapping_review_more_info_requested',
  mark_conflict: 'mapping_review_conflict_marked',
  reopen_review: 'mapping_review_reopened',
};

const capturedObjectPrototype = Object.prototype;
const capturedArrayPrototype = Array.prototype;
const capturedIsArray = Array.isArray;
const capturedIsInteger = Number.isSafeInteger;
const capturedIsProxy = nodeTypes.isProxy;
const capturedGetPrototypeOf = Object.getPrototypeOf;
const capturedOwnKeys = Reflect.ownKeys;
const capturedGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const capturedFreeze = Object.freeze;

const hash = (domain: string, fields: readonly string[]): string => {
  const hasher = createHash('sha256');
  hasher.update(`${Buffer.byteLength(domain, 'utf8')}:${domain}`);
  for (const field of fields) {
    hasher.update(`${Buffer.byteLength(field, 'utf8')}:${field}`);
  }
  return `sha256:${hasher.digest('hex')}`;
};

const deepFreeze = <T>(value: T, seen = new Set<object>()): T => {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const key of capturedOwnKeys(value)) {
    const descriptor = capturedGetOwnPropertyDescriptor(value, key);
    if (descriptor && 'value' in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return capturedFreeze(value);
};

const capturePlainObject = (
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): CapturedObject | null => {
  if (value === null || typeof value !== 'object' || capturedIsProxy(value)) {
    return null;
  }
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = capturedGetPrototypeOf(value);
    keys = capturedOwnKeys(value);
  } catch {
    return null;
  }
  if (prototype !== capturedObjectPrototype || keys.length > 64 || keys.some((key) => typeof key !== 'string')) {
    return null;
  }
  const stringKeys = keys as readonly string[];
  if (stringKeys.some((key) => !allowedKeys.includes(key)) || requiredKeys.some((key) => !stringKeys.includes(key))) {
    return null;
  }
  const captured: Record<string, unknown> = Object.create(null);
  for (const key of stringKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = capturedGetOwnPropertyDescriptor(value, key);
    } catch {
      return null;
    }
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || descriptor.get || descriptor.set) {
      return null;
    }
    Object.defineProperty(captured, key, {
      value: descriptor.value,
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }
  return captured;
};

const captureStringArray = (value: unknown, maximumLength: number): readonly string[] | null => {
  if (value === null || typeof value !== 'object' || capturedIsProxy(value) || !capturedIsArray(value)) {
    return null;
  }
  try {
    if (capturedGetPrototypeOf(value) !== capturedArrayPrototype || value.length > maximumLength) {
      return null;
    }
    const keys = capturedOwnKeys(value);
    if (keys.some((key) => typeof key === 'symbol') || keys.length !== value.length + 1) {
      return null;
    }
    const captured: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = capturedGetOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'string') {
        return null;
      }
      if (descriptor.value.length > 128 || !/^[A-Za-z0-9:_-]+$/.test(descriptor.value)) {
        return null;
      }
      captured.push(descriptor.value);
    }
    return captured;
  } catch {
    return null;
  }
};

const hasWellFormedUnicode = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return false;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
};

const maxNoteCodePoints = 512;
const maxNumericCandidateCodePoints = 64;
const unicodeUnsafeCategoryPattern = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Nl}]/u;
const numericConfusablePattern = /[\p{P}\p{Z}\p{M}\p{C}\p{S}\p{Lm}]/u;
const tokenIgnorablePattern = /\p{M}/u;
const tokenSeparatorPattern = /[\p{P}\p{Z}\p{C}\p{S}]/u;

const sensitiveSingleTokens = new Set([
  'token',
  'secret',
  'credential',
  'password',
  'cookie',
  'authorization',
  'payload',
  'chat',
  'conversation',
  'archive',
  'userid',
]);

const sensitiveCompactTokens = new Set([
  'accesstoken',
  'corpsecret',
  'rawpayload',
  'webhookpayload',
  'apiresponse',
  'rawresponse',
  'providerresponse',
  'externaluserid',
  'messagecontent',
  'conversationcontent',
  'archivecontent',
  'chatcontent',
  'sessionarchive',
]);

const sensitiveTokenPhrases = [
  ['access', 'token'],
  ['corp', 'secret'],
  ['raw', 'payload'],
  ['webhook', 'payload'],
  ['api', 'response'],
  ['raw', 'response'],
  ['provider', 'response'],
  ['external', 'user', 'id'],
  ['external', 'userid'],
  ['user', 'id'],
  ['message', 'content'],
  ['conversation', 'content'],
  ['conversation', 'archive'],
  ['archive', 'content'],
  ['chat', 'content'],
  ['session', 'archive'],
] as const;

const isNoncharacter = (codePoint: number): boolean => (codePoint >= 0xfdd0 && codePoint <= 0xfdef)
  || (codePoint & 0xffff) === 0xfffe
  || (codePoint & 0xffff) === 0xffff;

const noteHasValidUnicodeEnvelope = (note: string): boolean => {
  if (!hasWellFormedUnicode(note)) {
    return false;
  }
  let codePointCount = 0;
  for (const character of note) {
    codePointCount += 1;
    if (
      codePointCount > maxNoteCodePoints
      || unicodeUnsafeCategoryPattern.test(character)
      || isNoncharacter(character.codePointAt(0) as number)
    ) {
      return false;
    }
  }
  return true;
};

const asciiDigitFor = (character: string): string | null => {
  const codePoint = character.codePointAt(0) as number;
  if (codePoint >= 0x30 && codePoint <= 0x39) {
    return character;
  }
  if (codePoint >= 0xff10 && codePoint <= 0xff19) {
    return String(codePoint - 0xff10);
  }
  return null;
};

const numericSpecialFor = (character: string): '+' | 'x' | null => {
  if (character === '+' || character === '＋') {
    return '+';
  }
  if (character === 'x' || character === 'X' || character === 'ｘ' || character === 'Ｘ') {
    return 'x';
  }
  return null;
};

const isSensitiveNumericProjection = (projection: string): boolean => /^(?:1[3-9]\d{9}|\+861[3-9]\d{9}|00861[3-9]\d{9})$/.test(projection)
  || /^(?:\d{18}|\d{17}x)$/.test(projection);

const noteContainsSensitiveNumericSpan = (note: string): boolean => {
  let projection = '';
  let candidateCodePoints = 0;
  let active = false;

  const finishCandidate = (): boolean => {
    const sensitive = active && isSensitiveNumericProjection(projection);
    projection = '';
    candidateCodePoints = 0;
    active = false;
    return sensitive;
  };

  for (const character of note) {
    const digit = asciiDigitFor(character);
    const special = numericSpecialFor(character);
    if (digit !== null || special !== null) {
      if (special === '+' && active) {
        if (finishCandidate()) {
          return true;
        }
      }
      if (special === 'x' && !active) {
        continue;
      }
      active = true;
      candidateCodePoints += 1;
      projection += digit ?? special;
    } else if (active && numericConfusablePattern.test(character)) {
      candidateCodePoints += 1;
    } else if (finishCandidate()) {
      return true;
    }

    if (active && candidateCodePoints > maxNumericCandidateCodePoints) {
      return true;
    }
  }
  return finishCandidate();
};

const asciiTokenCharacterFor = (character: string): string | null => {
  const codePoint = character.codePointAt(0) as number;
  if ((codePoint >= 0x41 && codePoint <= 0x5a) || (codePoint >= 0x61 && codePoint <= 0x7a)) {
    return character.toLowerCase();
  }
  if (codePoint >= 0x30 && codePoint <= 0x39) {
    return character;
  }
  if (codePoint >= 0xff21 && codePoint <= 0xff3a) {
    return String.fromCharCode(codePoint - 0xff21 + 0x61);
  }
  if (codePoint >= 0xff41 && codePoint <= 0xff5a) {
    return String.fromCharCode(codePoint - 0xff41 + 0x61);
  }
  if (codePoint >= 0xff10 && codePoint <= 0xff19) {
    return String(codePoint - 0xff10);
  }
  return null;
};

const projectAsciiTokens = (note: string): readonly string[] => {
  const tokens: string[] = [];
  let token = '';
  const finishToken = (): void => {
    if (token.length > 0) {
      tokens.push(token);
      token = '';
    }
  };

  for (const character of note) {
    const projected = asciiTokenCharacterFor(character);
    if (projected !== null) {
      token += projected;
    } else if (tokenIgnorablePattern.test(character)) {
      continue;
    } else if (tokenSeparatorPattern.test(character) || character === '_') {
      finishToken();
    } else {
      finishToken();
    }
  }
  finishToken();
  return tokens;
};

const tokensContainPhrase = (tokens: readonly string[], phrase: readonly string[]): boolean => {
  if (phrase.length > tokens.length) {
    return false;
  }
  for (let start = 0; start <= tokens.length - phrase.length; start += 1) {
    if (phrase.every((word, offset) => tokens[start + offset] === word)) {
      return true;
    }
  }
  return false;
};

const noteContainsSensitiveMarker = (note: string): boolean => {
  const tokens = projectAsciiTokens(note);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (sensitiveCompactTokens.has(token)) {
      return true;
    }
    if (sensitiveSingleTokens.has(token)) {
      if (token === 'archive' && tokens[index + 1] === 'design') {
        continue;
      }
      return true;
    }
  }
  return sensitiveTokenPhrases.some((phrase) => tokensContainPhrase(tokens, phrase));
};

const noteContainsSensitiveText = (note: string): boolean => !noteHasValidUnicodeEnvelope(note)
  || noteContainsSensitiveNumericSpan(note)
  || noteContainsSensitiveMarker(note)
  || /(?:聊天内容|会话内容|会话存档|会话内容存档)/u.test(note);

const parseCommand = (
  rawCommand: unknown,
): { command: WeComCustomerMappingReviewActionCommand } | { reasonCode: 'request_contract_invalid' | 'idempotency_key_invalid' | 'sensitive_input_blocked' } => {
  const captured = capturePlainObject(
    rawCommand,
    ['mappingId', 'action', 'expectedVersion', 'idempotencyKey', 'reasonCode', 'note'],
    ['mappingId', 'action', 'expectedVersion', 'idempotencyKey', 'reasonCode'],
  );
  if (!captured) {
    return { reasonCode: 'request_contract_invalid' };
  }
  const { mappingId, action, expectedVersion, idempotencyKey, reasonCode, note } = captured;
  if (typeof idempotencyKey !== 'string' || !idempotencyKeyPattern.test(idempotencyKey)) {
    return { reasonCode: 'idempotency_key_invalid' };
  }
  if (
    typeof mappingId !== 'string'
    || !safeIdentifierPattern.test(mappingId)
    || typeof action !== 'string'
    || !actionSet.has(action)
    || !capturedIsInteger(expectedVersion)
    || (expectedVersion as number) < 0
    || (expectedVersion as number) > maxVersion
    || typeof reasonCode !== 'string'
    || !(reasonCodesByAction[action as WeComCustomerMappingReviewAction] as readonly string[]).includes(reasonCode)
  ) {
    return { reasonCode: 'request_contract_invalid' };
  }
  if (note !== undefined) {
    if (typeof note !== 'string') {
      return { reasonCode: 'request_contract_invalid' };
    }
    if (noteContainsSensitiveText(note)) {
      return { reasonCode: 'sensitive_input_blocked' };
    }
  }
  const noteRequired = action === 'request_more_info'
    || action === 'mark_conflict'
    || action === 'reopen_review'
    || reasonCode === 'candidate_not_same_person';
  if (noteRequired && (typeof note !== 'string' || note.length === 0)) {
    return { reasonCode: 'request_contract_invalid' };
  }
  return {
    command: {
      mappingId,
      action: action as WeComCustomerMappingReviewAction,
      expectedVersion: expectedVersion as number,
      idempotencyKey,
      reasonCode: reasonCode as WeComCustomerMappingReviewReasonCode,
      ...(note === undefined ? {} : { note }),
    },
  };
};

const parsePermissionContext = (rawContext: unknown): WeComCustomerMappingReviewPermissionContext | null => {
  const captured = capturePlainObject(
    rawContext,
    ['authenticated', 'tenantId', 'institutionId', 'scope', 'capabilities'],
    ['authenticated', 'tenantId', 'institutionId', 'scope', 'capabilities'],
  );
  if (!captured) {
    return null;
  }
  const capabilities = captureStringArray(captured.capabilities, 32);
  if (
    typeof captured.authenticated !== 'boolean'
    || typeof captured.tenantId !== 'string'
    || !safeIdentifierPattern.test(captured.tenantId)
    || typeof captured.institutionId !== 'string'
    || !safeIdentifierPattern.test(captured.institutionId)
    || (captured.scope !== 'tenant' && captured.scope !== 'platform')
    || !capabilities
  ) {
    return null;
  }
  return {
    authenticated: captured.authenticated,
    tenantId: captured.tenantId,
    institutionId: captured.institutionId,
    scope: captured.scope,
    capabilities,
  };
};

const parseMapping = (rawMapping: unknown): WeComCustomerMappingReviewMapping | null => {
  const captured = capturePlainObject(
    rawMapping,
    ['mappingId', 'tenantId', 'institutionId', 'state', 'version'],
    ['mappingId', 'tenantId', 'institutionId', 'state', 'version'],
  );
  if (
    !captured
    || typeof captured.mappingId !== 'string'
    || !safeIdentifierPattern.test(captured.mappingId)
    || typeof captured.tenantId !== 'string'
    || !safeIdentifierPattern.test(captured.tenantId)
    || typeof captured.institutionId !== 'string'
    || !safeIdentifierPattern.test(captured.institutionId)
    || typeof captured.state !== 'string'
    || !stateSet.has(captured.state)
    || !capturedIsInteger(captured.version)
    || (captured.version as number) < 0
    || (captured.version as number) > maxVersion
  ) {
    return null;
  }
  return captured as WeComCustomerMappingReviewMapping;
};

const validateCapturedMutationResult = (captured: CapturedObject): WeComCustomerMappingReviewMutationResult | null => {
  if (
    typeof captured.mappingId !== 'string'
    || !safeIdentifierPattern.test(captured.mappingId)
    || typeof captured.action !== 'string'
    || !actionSet.has(captured.action)
    || typeof captured.reasonCode !== 'string'
    || !(reasonCodesByAction[captured.action as WeComCustomerMappingReviewAction] as readonly string[]).includes(captured.reasonCode)
    || typeof captured.previousState !== 'string'
    || !stateSet.has(captured.previousState)
    || typeof captured.nextState !== 'string'
    || captured.nextState !== nextStateByAction[captured.action as WeComCustomerMappingReviewAction]
    || !(allowedStatesByAction[captured.action as WeComCustomerMappingReviewAction] as readonly string[]).includes(captured.previousState)
    || !capturedIsInteger(captured.previousVersion)
    || !capturedIsInteger(captured.nextVersion)
    || (captured.previousVersion as number) < 0
    || captured.nextVersion !== (captured.previousVersion as number) + 1
    || typeof captured.acceptedAuditReference !== 'string'
    || !auditReferencePattern.test(captured.acceptedAuditReference)
    || captured.autoMergePerformed !== false
    || captured.realCustomerRelationshipWritten !== false
  ) {
    return null;
  }
  return captured as WeComCustomerMappingReviewMutationResult;
};

const mutationResultKeys = [
  'mappingId',
  'action',
  'reasonCode',
  'previousState',
  'nextState',
  'previousVersion',
  'nextVersion',
  'acceptedAuditReference',
  'autoMergePerformed',
  'realCustomerRelationshipWritten',
] as const;

const parseMutationResultFromCaptured = (rawResult: unknown): WeComCustomerMappingReviewMutationResult | null => {
  if (rawResult === null || typeof rawResult !== 'object' || capturedIsProxy(rawResult)) {
    return null;
  }
  try {
    const prototype = capturedGetPrototypeOf(rawResult);
    if (prototype !== capturedObjectPrototype && prototype !== null) {
      return null;
    }
    const keys = capturedOwnKeys(rawResult);
    if (
      keys.length !== mutationResultKeys.length
      || keys.some((key) => typeof key !== 'string' || !mutationResultKeys.includes(key as (typeof mutationResultKeys)[number]))
    ) {
      return null;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of mutationResultKeys) {
      const descriptor = capturedGetOwnPropertyDescriptor(rawResult, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || descriptor.get || descriptor.set) {
        return null;
      }
      Object.defineProperty(captured, key, { value: descriptor.value, enumerable: true });
    }
    return validateCapturedMutationResult(captured);
  } catch {
    return null;
  }
};

const parseMutationResult = (rawResult: unknown): WeComCustomerMappingReviewMutationResult | null => {
  const captured = capturePlainObject(
    rawResult,
    mutationResultKeys,
    mutationResultKeys,
  );
  return captured ? validateCapturedMutationResult(captured) : null;
};

const mutationResultDigestFor = (result: WeComCustomerMappingReviewMutationResult): string => hash(
  'zmtg:05c-e3:mapping-review-result:v1',
  [
    result.mappingId,
    result.action,
    result.reasonCode,
    result.previousState,
    result.nextState,
    String(result.previousVersion),
    String(result.nextVersion),
    result.acceptedAuditReference,
    String(result.autoMergePerformed),
    String(result.realCustomerRelationshipWritten),
  ],
);

const parseIdempotencyRecord = (rawRecord: unknown): WeComCustomerMappingReviewIdempotencyRecord | null => {
  const captured = capturePlainObject(
    rawRecord,
    ['tenantId', 'institutionId', 'mappingId', 'action', 'keyDigest', 'requestFingerprint', 'status', 'completedResult', 'completedResultDigest'],
    ['tenantId', 'institutionId', 'mappingId', 'action', 'keyDigest', 'requestFingerprint', 'status', 'completedResult', 'completedResultDigest'],
  );
  if (
    !captured
    || typeof captured.tenantId !== 'string'
    || !safeIdentifierPattern.test(captured.tenantId)
    || typeof captured.institutionId !== 'string'
    || !safeIdentifierPattern.test(captured.institutionId)
    || typeof captured.mappingId !== 'string'
    || !safeIdentifierPattern.test(captured.mappingId)
    || typeof captured.action !== 'string'
    || !actionSet.has(captured.action)
    || typeof captured.keyDigest !== 'string'
    || !digestPattern.test(captured.keyDigest)
    || typeof captured.requestFingerprint !== 'string'
    || !digestPattern.test(captured.requestFingerprint)
    || (captured.status !== 'in_progress' && captured.status !== 'completed')
  ) {
    return null;
  }
  const completedResult = captured.completedResult === null
    ? null
    : parseMutationResultFromCaptured(captured.completedResult);
  if (
    (captured.status === 'in_progress' && (captured.completedResult !== null || captured.completedResultDigest !== null))
    || (captured.status === 'completed' && (
      !completedResult
      || typeof captured.completedResultDigest !== 'string'
      || !digestPattern.test(captured.completedResultDigest)
      || captured.completedResultDigest !== mutationResultDigestFor(completedResult)
    ))
  ) {
    return null;
  }
  return {
    tenantId: captured.tenantId,
    institutionId: captured.institutionId,
    mappingId: captured.mappingId,
    action: captured.action as WeComCustomerMappingReviewAction,
    keyDigest: captured.keyDigest,
    requestFingerprint: captured.requestFingerprint,
    status: captured.status,
    completedResult,
    completedResultDigest: captured.completedResultDigest as string | null,
  };
};

const defaultAtomicBoundary: WeComCustomerMappingReviewAtomicBoundary = deepFreeze({
  occupationResult: 'acquired',
  acceptedAuditReady: true,
  responseContractReady: true,
  transactionReady: true,
});

const parseAtomicBoundary = (rawBoundary: unknown): WeComCustomerMappingReviewAtomicBoundary | null => {
  if (rawBoundary === undefined) {
    return defaultAtomicBoundary;
  }
  const captured = capturePlainObject(
    rawBoundary,
    ['occupationResult', 'acceptedAuditReady', 'responseContractReady', 'transactionReady'],
    ['occupationResult', 'acceptedAuditReady', 'responseContractReady', 'transactionReady'],
  );
  if (
    !captured
    || typeof captured.acceptedAuditReady !== 'boolean'
    || typeof captured.responseContractReady !== 'boolean'
    || typeof captured.transactionReady !== 'boolean'
  ) {
    return null;
  }
  let occupationResult: WeComCustomerMappingReviewAtomicBoundary['occupationResult'];
  if (captured.occupationResult === 'acquired') {
    occupationResult = 'acquired';
  } else {
    const occupation = capturePlainObject(captured.occupationResult, ['kind', 'record'], ['kind', 'record']);
    const record = occupation?.kind === 'existing' ? parseIdempotencyRecord(occupation.record) : null;
    if (!occupation || occupation.kind !== 'existing' || !record) {
      return null;
    }
    occupationResult = { kind: 'existing', record };
  }
  return {
    occupationResult,
    acceptedAuditReady: captured.acceptedAuditReady,
    responseContractReady: captured.responseContractReady,
    transactionReady: captured.transactionReady,
  };
};

const auditEvent = (
  eventType: WeComCustomerMappingReviewAuditEvent['eventType'],
  reasonCode: WeComCustomerMappingReviewAuditEvent['reasonCode'],
  values: Partial<Omit<WeComCustomerMappingReviewAuditEvent, 'eventType' | 'reasonCode'>> = {},
): WeComCustomerMappingReviewAuditEvent => ({
  eventType,
  mappingId: values.mappingId ?? null,
  action: values.action ?? null,
  reasonCode,
  previousState: values.previousState ?? null,
  nextState: values.nextState ?? null,
  previousVersion: values.previousVersion ?? null,
  nextVersion: values.nextVersion ?? null,
  idempotencyKeyDigest: values.idempotencyKeyDigest ?? null,
});

const failure = (
  reasonCode: WeComCustomerMappingReviewFailureCode,
  auditEvents: readonly WeComCustomerMappingReviewAuditEvent[] = [],
): WeComCustomerMappingReviewFailure => deepFreeze({ ok: false, reasonCode, auditEvents: [...auditEvents] });

const fingerprintFor = (command: WeComCustomerMappingReviewActionCommand): string => hash(
  'zmtg:05c-e3:mapping-review-request:v1',
  [
    command.mappingId,
    command.action,
    String(command.expectedVersion),
    command.reasonCode,
    command.note === undefined ? 'note:absent' : `note:present:${command.note}`,
  ],
);

const keyDigestFor = (key: string): string => hash('zmtg:05c-e3:idempotency-key:v1', [key]);

const recordMatchesScope = (
  record: WeComCustomerMappingReviewIdempotencyRecord,
  command: WeComCustomerMappingReviewActionCommand,
  context: WeComCustomerMappingReviewPermissionContext,
  keyDigest: string,
): boolean => record.tenantId === context.tenantId
  && record.institutionId === context.institutionId
  && record.mappingId === command.mappingId
  && record.action === command.action
  && record.keyDigest === keyDigest;

const completedResultMatchesRecord = (
  record: WeComCustomerMappingReviewIdempotencyRecord,
  command: WeComCustomerMappingReviewActionCommand,
): boolean => record.completedResult !== null
  && record.completedResult.mappingId === record.mappingId
  && record.completedResult.mappingId === command.mappingId
  && record.completedResult.action === record.action
  && record.completedResult.action === command.action
  && record.completedResult.reasonCode === command.reasonCode
  && record.completedResult.previousVersion === command.expectedVersion;

const handleExistingRecord = (
  rawRecord: unknown,
  command: WeComCustomerMappingReviewActionCommand,
  context: WeComCustomerMappingReviewPermissionContext,
  keyDigest: string,
  fingerprint: string,
): WeComCustomerMappingReviewActionResult | null => {
  const record = parseIdempotencyRecord(rawRecord);
  if (!record || !recordMatchesScope(record, command, context, keyDigest)) {
    return failure('idempotency_record_invalid');
  }
  if (record.requestFingerprint !== fingerprint) {
    return failure('idempotency_conflict');
  }
  if (record.status === 'in_progress') {
    return failure('idempotency_in_progress');
  }
  if (!completedResultMatchesRecord(record, command) || !record.completedResult) {
    return failure('idempotency_record_invalid');
  }
  const replayAudit = auditEvent('mapping_review_idempotent_replay', record.completedResult.reasonCode, {
    mappingId: record.mappingId,
    action: record.action,
    previousState: record.completedResult.previousState,
    nextState: record.completedResult.nextState,
    previousVersion: record.completedResult.previousVersion,
    nextVersion: record.completedResult.nextVersion,
    idempotencyKeyDigest: record.keyDigest,
  });
  return deepFreeze({
    ok: true,
    idempotentReplay: true,
    mutationResult: record.completedResult,
    idempotencyRecord: record,
    auditEvents: [replayAudit],
  });
};

export function executeWeComCustomerMappingReviewAction(
  rawCommand: unknown,
  rawPermissionContext: unknown,
  rawCurrentMapping: unknown,
  rawExistingIdempotencyRecord: unknown = null,
  rawAtomicBoundary?: unknown,
): WeComCustomerMappingReviewActionResult {
  const parsedCommand = parseCommand(rawCommand);
  if ('reasonCode' in parsedCommand) {
    return failure(parsedCommand.reasonCode);
  }
  const { command } = parsedCommand;
  const context = parsePermissionContext(rawPermissionContext);
  if (!context) {
    return failure('tenant_context_missing');
  }
  if (!context.authenticated) {
    return failure('unauthenticated');
  }
  if (
    context.scope !== 'tenant'
    || !context.capabilities.includes('customer:read')
    || !context.capabilities.includes('customer:mapping_review')
  ) {
    return failure('permission_denied', [
      auditEvent('mapping_review_permission_denied', 'permission_denied', { action: command.action }),
    ]);
  }
  const currentMapping = parseMapping(rawCurrentMapping);
  if (!currentMapping || currentMapping.mappingId !== command.mappingId) {
    return failure('mapping_unavailable');
  }
  if (
    currentMapping.tenantId !== context.tenantId
    || currentMapping.institutionId !== context.institutionId
  ) {
    return failure('tenant_mismatch', [
      auditEvent('mapping_review_tenant_mismatch', 'tenant_mismatch', { action: command.action }),
    ]);
  }

  const keyDigest = keyDigestFor(command.idempotencyKey);
  const fingerprint = fingerprintFor(command);
  if (rawExistingIdempotencyRecord !== null) {
    return handleExistingRecord(
      rawExistingIdempotencyRecord,
      command,
      context,
      keyDigest,
      fingerprint,
    ) ?? failure('idempotency_record_invalid');
  }

  if (currentMapping.version !== command.expectedVersion) {
    return failure('version_conflict', [
      auditEvent('mapping_review_version_conflict', 'version_conflict', {
        mappingId: command.mappingId,
        action: command.action,
        previousState: currentMapping.state,
        nextState: currentMapping.state,
        previousVersion: currentMapping.version,
        nextVersion: currentMapping.version,
        idempotencyKeyDigest: keyDigest,
      }),
    ]);
  }
  if (!(allowedStatesByAction[command.action] as readonly string[]).includes(currentMapping.state)) {
    return failure('action_not_allowed', [
      auditEvent('mapping_review_rejected', 'action_not_allowed', {
        mappingId: command.mappingId,
        action: command.action,
        previousState: currentMapping.state,
        nextState: currentMapping.state,
        previousVersion: currentMapping.version,
        nextVersion: currentMapping.version,
        idempotencyKeyDigest: keyDigest,
      }),
    ]);
  }
  if (currentMapping.version === maxVersion) {
    return failure('transaction_failed');
  }

  const boundary = parseAtomicBoundary(rawAtomicBoundary);
  if (!boundary) {
    return failure('idempotency_unavailable');
  }
  if (boundary.occupationResult !== 'acquired') {
    return handleExistingRecord(
      boundary.occupationResult.record,
      command,
      context,
      keyDigest,
      fingerprint,
    ) ?? failure('idempotency_record_invalid');
  }

  const nextState = nextStateByAction[command.action];
  const requestedAudit = auditEvent('mapping_review_action_requested', command.reasonCode, {
    mappingId: command.mappingId,
    action: command.action,
    previousState: currentMapping.state,
    nextState,
    previousVersion: currentMapping.version,
    nextVersion: currentMapping.version + 1,
    idempotencyKeyDigest: keyDigest,
  });
  if (!boundary.acceptedAuditReady) {
    return failure('audit_unavailable', [
      requestedAudit,
      auditEvent('mapping_review_audit_failed', 'audit_unavailable', {
        mappingId: command.mappingId,
        action: command.action,
        previousState: currentMapping.state,
        nextState: currentMapping.state,
        previousVersion: currentMapping.version,
        nextVersion: currentMapping.version,
        idempotencyKeyDigest: keyDigest,
      }),
    ]);
  }

  const acceptedAuditReference = `audit:${hash(
    'zmtg:05c-e3:mapping-review-audit:v1',
    [context.tenantId, context.institutionId, command.mappingId, command.action, String(currentMapping.version + 1), fingerprint],
  ).slice('sha256:'.length, 'sha256:'.length + 32)}`;
  const mutationResult: WeComCustomerMappingReviewMutationResult = {
    mappingId: command.mappingId,
    action: command.action,
    reasonCode: command.reasonCode,
    previousState: currentMapping.state,
    nextState,
    previousVersion: currentMapping.version,
    nextVersion: currentMapping.version + 1,
    acceptedAuditReference,
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
  };
  const acceptedAudit = auditEvent(acceptedEventByAction[command.action], command.reasonCode, {
    mappingId: command.mappingId,
    action: command.action,
    previousState: currentMapping.state,
    nextState,
    previousVersion: currentMapping.version,
    nextVersion: currentMapping.version + 1,
    idempotencyKeyDigest: keyDigest,
  });
  const completedRecord: WeComCustomerMappingReviewIdempotencyRecord = {
    tenantId: context.tenantId,
    institutionId: context.institutionId,
    mappingId: command.mappingId,
    action: command.action,
    keyDigest,
    requestFingerprint: fingerprint,
    status: 'completed',
    completedResult: mutationResult,
    completedResultDigest: mutationResultDigestFor(mutationResult),
  };
  const candidateSuccess: WeComCustomerMappingReviewSuccess = {
    ok: true,
    idempotentReplay: false,
    mutationResult,
    idempotencyRecord: completedRecord,
    auditEvents: [requestedAudit, acceptedAudit],
  };

  if (!boundary.responseContractReady || !parseMutationResult(mutationResult)) {
    return failure('response_contract_invalid', [requestedAudit]);
  }
  if (!boundary.transactionReady) {
    return failure('transaction_failed', [requestedAudit]);
  }
  return deepFreeze(candidateSuccess);
}
