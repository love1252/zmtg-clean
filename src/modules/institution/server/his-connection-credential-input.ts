export type HisConnectionCredentialType =
  | 'api_key'
  | 'oauth_client'
  | 'oauth_token'
  | 'basic_auth'
  | 'signature_key'
  | 'mtls'
  | 'sftp'
  | 'other';

export type HisConnectionCredentialMutationInput = {
  credentialType: HisConnectionCredentialType;
  syntheticPlaceholder: string;
  idempotencyKey: string;
  reasonCode?: string;
};

export type HisConnectionCredentialReasonInput = {
  reasonCode?: string;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: 'validation_failed' };

const mutationFields = [
  'credentialType',
  'syntheticPlaceholder',
  'idempotencyKey',
  'reasonCode',
] as const;
const reasonFields = ['reasonCode'] as const;
const credentialTypes = [
  'api_key',
  'oauth_client',
  'oauth_token',
  'basic_auth',
  'signature_key',
  'mtls',
  'sftp',
  'other',
] as const satisfies readonly HisConnectionCredentialType[];

const mutationFieldSet = new Set<string>(mutationFields);
const reasonFieldSet = new Set<string>(reasonFields);
const credentialTypeSet = new Set<string>(credentialTypes);
const forbiddenFields = [
  'tenantId',
  'id',
  'connectionId',
  'credentialRef',
  'credentialConfigured',
  'status',
  'healthStatus',
  'lastCheckedAt',
  'lastErrorCode',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'revokedAt',
  'deletedAt',
  'token',
  'secret',
  'apiKey',
  'API key',
  'api_key',
  'oauthToken',
  'OAuth token',
  'oauth_token',
  'basicAuth',
  'basic auth',
  'basic_auth',
  'signingKey',
  'signing key',
  'signing_key',
  'privateKey',
  'private key',
  'private_key',
  'connectionString',
  'connection string',
  'connection_string',
  'rawCredential',
  'raw credential',
  'raw_credential',
  'rawPayload',
  'raw payload',
  'raw_payload',
  'rawHisPayload',
  'raw HIS payload',
  'externalSecretPath',
  'external secret path',
  'secretPath',
  'storageProvider',
  'requestBody',
  'responseBody',
  'sql',
  'stack',
  'DATABASE_URL',
] as const;
const normalizedForbiddenFieldSet = new Set<string>(forbiddenFields.map(normalizeFieldKey));
const safePlaceholderPattern = /^synthetic_placeholder_[a-zA-Z0-9_-]{4,}$/;
const safeIdempotencyKeyPattern = /^[a-zA-Z0-9._-]{4,128}$/;
const safeReasonCodePattern = /^[a-zA-Z0-9._-]{1,96}$/;
const sensitiveContentPattern =
  /sk_live|sk_test|token|secret|api[_\s-]?key|connection[_\s-]?string|password|oauth|basic[_\s-]?auth|private[_\s-]?key|signing[_\s-]?key|raw[_\s-]?credential|raw[_\s-]?payload|external[_\s-]?secret|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|\bSQL\b|stack/i;

function normalizeFieldKey(key: string) {
  return key.normalize('NFKC').replace(/[\s_-]+/g, '').toLowerCase();
}

function isPlainJsonObject(input: unknown): input is Record<string, unknown> {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) === Object.prototype
  );
}

function isForbiddenField(key: string) {
  return normalizedForbiddenFieldSet.has(normalizeFieldKey(key));
}

function parsePayloadObject(
  input: unknown,
  allowedFieldSet: ReadonlySet<string>,
): ParseResult<Record<string, unknown>> {
  if (!isPlainJsonObject(input)) {
    return { ok: false, error: 'validation_failed' };
  }

  for (const key of Object.keys(input)) {
    if (allowedFieldSet.has(key) && !isForbiddenField(key)) {
      continue;
    }

    return { ok: false, error: 'validation_failed' };
  }

  return { ok: true, value: input };
}

function normalizeRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;

  return normalized;
}

function parseCredentialType(value: unknown): HisConnectionCredentialType | null {
  const credentialType = normalizeRequiredText(value, 32);

  if (!credentialType || !credentialTypeSet.has(credentialType)) {
    return null;
  }

  return credentialType as HisConnectionCredentialType;
}

function parseSyntheticPlaceholder(value: unknown): string | null {
  const syntheticPlaceholder = normalizeRequiredText(value, 128);

  if (!syntheticPlaceholder) return null;
  if (!safePlaceholderPattern.test(syntheticPlaceholder)) return null;
  if (sensitiveContentPattern.test(syntheticPlaceholder)) return null;

  return syntheticPlaceholder;
}

function parseIdempotencyKey(value: unknown): string | null {
  const idempotencyKey = normalizeRequiredText(value, 128);

  if (!idempotencyKey) return null;
  if (!safeIdempotencyKeyPattern.test(idempotencyKey)) return null;
  if (sensitiveContentPattern.test(idempotencyKey)) return null;

  return idempotencyKey;
}

function parseOptionalReasonCode(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;

  const reasonCode = normalizeRequiredText(value, 96);

  if (!reasonCode) return null;
  if (!safeReasonCodePattern.test(reasonCode)) return null;
  if (sensitiveContentPattern.test(reasonCode)) return null;

  return reasonCode;
}

function parseMutationInput(input: unknown): ParseResult<HisConnectionCredentialMutationInput> {
  const payload = parsePayloadObject(input, mutationFieldSet);

  if (!payload.ok) {
    return payload;
  }

  const credentialType = parseCredentialType(payload.value.credentialType);
  const syntheticPlaceholder = parseSyntheticPlaceholder(payload.value.syntheticPlaceholder);
  const idempotencyKey = parseIdempotencyKey(payload.value.idempotencyKey);
  const reasonCode = parseOptionalReasonCode(payload.value.reasonCode);

  if (!credentialType || !syntheticPlaceholder || !idempotencyKey || reasonCode === null) {
    return { ok: false, error: 'validation_failed' };
  }

  return {
    ok: true,
    value: {
      credentialType,
      syntheticPlaceholder,
      idempotencyKey,
      ...(reasonCode === undefined ? {} : { reasonCode }),
    },
  };
}

function parseReasonInput(input: unknown): ParseResult<HisConnectionCredentialReasonInput> {
  const payload = parsePayloadObject(input, reasonFieldSet);

  if (!payload.ok) {
    return payload;
  }

  const reasonCode = parseOptionalReasonCode(payload.value.reasonCode);

  if (reasonCode === null) {
    return { ok: false, error: 'validation_failed' };
  }

  return {
    ok: true,
    value: reasonCode === undefined ? {} : { reasonCode },
  };
}

export function parseCreateHisConnectionCredentialInput(
  input: unknown,
): ParseResult<HisConnectionCredentialMutationInput> {
  return parseMutationInput(input);
}

export function parseUpdateHisConnectionCredentialInput(
  input: unknown,
): ParseResult<HisConnectionCredentialMutationInput> {
  return parseMutationInput(input);
}

export function parseRotateHisConnectionCredentialInput(
  input: unknown,
): ParseResult<HisConnectionCredentialMutationInput> {
  return parseMutationInput(input);
}

export function parseClearHisConnectionCredentialInput(
  input: unknown,
): ParseResult<HisConnectionCredentialReasonInput> {
  return parseReasonInput(input);
}

export function parseRevokeHisConnectionCredentialInput(
  input: unknown,
): ParseResult<HisConnectionCredentialReasonInput> {
  return parseReasonInput(input);
}
