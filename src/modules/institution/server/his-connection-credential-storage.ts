import { createHash, randomUUID } from 'node:crypto';

export type HisConnectionCredentialStorageProvider = 'in_memory_test_only';

export type HisConnectionCredentialStorageMetadata = {
  tenantId: string;
  connectionId: string;
  credentialRefDigest: string;
  provider: HisConnectionCredentialStorageProvider;
  storedAt: string;
  revokedAt: string | null;
};

export type StoreSyntheticCredentialReferenceInput = {
  tenantId: string;
  connectionId: string;
  placeholder: string;
  idempotencyKey?: string;
};

export type StoreSyntheticCredentialReferenceResult =
  | {
      status: 'stored';
      credentialRef: string;
      provider: HisConnectionCredentialStorageProvider;
      storedAt: string;
    }
  | { status: 'validation_failed' };

export type RevokeCredentialReferenceInput = {
  tenantId: string;
  connectionId: string;
  credentialRef: string;
};

export type RevokeCredentialReferenceResult =
  | { status: 'revoked'; revokedAt: string }
  | { status: 'not_found' }
  | { status: 'validation_failed' };

type StoredCredentialReference = {
  tenantId: string;
  connectionId: string;
  credentialRef: string;
  provider: HisConnectionCredentialStorageProvider;
  storedAt: string;
  revokedAt: string | null;
};

const provider: HisConnectionCredentialStorageProvider = 'in_memory_test_only';
const safePlaceholderPattern = /^synthetic_placeholder_[a-zA-Z0-9_-]{4,}$/;
const safeCredentialRefPattern = /^cred_ref_[a-zA-Z0-9_-]{12,}$/;
const forbiddenSensitivePattern =
  /sk_live|sk_test|token|secret|api[_-]?key|connection[_-]?string|password|oauth|basic[_-]?auth|private[_-]?key|raw[_-]?credential|raw[_-]?payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;

  return normalized;
}

function normalizeTenantId(value: unknown) {
  return normalizeText(value, 64);
}

function normalizeConnectionId(value: unknown) {
  return normalizeText(value, 64);
}

function normalizeIdempotencyKey(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;

  return normalizeText(value, 128);
}

function normalizeSafePlaceholder(value: unknown): string | null {
  const placeholder = normalizeText(value, 128);

  if (!placeholder) return null;
  if (!safePlaceholderPattern.test(placeholder)) return null;
  if (forbiddenSensitivePattern.test(placeholder)) return null;

  return placeholder;
}

function normalizeSafeCredentialRef(value: unknown): string | null {
  const credentialRef = normalizeText(value, 128);

  if (!credentialRef) return null;
  if (!safeCredentialRefPattern.test(credentialRef)) return null;
  if (forbiddenSensitivePattern.test(credentialRef)) return null;

  return credentialRef;
}

function createCredentialRef() {
  return `cred_ref_${randomUUID().replaceAll('-', '')}`;
}

function digestCredentialRef(credentialRef: string) {
  return createHash('sha256').update(credentialRef).digest('hex');
}

function mapStoredCredentialReferenceToMetadata(
  entry: StoredCredentialReference,
): HisConnectionCredentialStorageMetadata {
  return {
    tenantId: entry.tenantId,
    connectionId: entry.connectionId,
    credentialRefDigest: digestCredentialRef(entry.credentialRef),
    provider: entry.provider,
    storedAt: entry.storedAt,
    revokedAt: entry.revokedAt,
  };
}

export function createInMemoryHisConnectionCredentialStorage() {
  const entriesByRef = new Map<string, StoredCredentialReference>();
  const refsByIdempotencyKey = new Map<string, string>();

  return {
    async storeSyntheticCredentialReference(
      input: StoreSyntheticCredentialReferenceInput,
    ): Promise<StoreSyntheticCredentialReferenceResult> {
      const tenantId = normalizeTenantId(input.tenantId);
      const connectionId = normalizeConnectionId(input.connectionId);
      const placeholder = normalizeSafePlaceholder(input.placeholder);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

      if (!tenantId || !connectionId || !placeholder || idempotencyKey === null) {
        return { status: 'validation_failed' };
      }

      if (idempotencyKey !== undefined) {
        const existingRef = refsByIdempotencyKey.get(idempotencyKey);
        const existingEntry = existingRef ? entriesByRef.get(existingRef) : undefined;

        if (existingEntry) {
          return {
            status: 'stored',
            credentialRef: existingEntry.credentialRef,
            provider: existingEntry.provider,
            storedAt: existingEntry.storedAt,
          };
        }
      }

      const credentialRef = createCredentialRef();
      const storedAt = new Date().toISOString();
      entriesByRef.set(credentialRef, {
        tenantId,
        connectionId,
        credentialRef,
        provider,
        storedAt,
        revokedAt: null,
      });

      if (idempotencyKey !== undefined) {
        refsByIdempotencyKey.set(idempotencyKey, credentialRef);
      }

      return {
        status: 'stored',
        credentialRef,
        provider,
        storedAt,
      };
    },

    async revokeCredentialReference(
      input: RevokeCredentialReferenceInput,
    ): Promise<RevokeCredentialReferenceResult> {
      const tenantId = normalizeTenantId(input.tenantId);
      const connectionId = normalizeConnectionId(input.connectionId);
      const credentialRef = normalizeSafeCredentialRef(input.credentialRef);

      if (!tenantId || !connectionId || !credentialRef) {
        return { status: 'validation_failed' };
      }

      const entry = entriesByRef.get(credentialRef);

      if (!entry || entry.tenantId !== tenantId || entry.connectionId !== connectionId) {
        return { status: 'not_found' };
      }

      entry.revokedAt = entry.revokedAt ?? new Date().toISOString();

      return {
        status: 'revoked',
        revokedAt: entry.revokedAt,
      };
    },

    listStoredCredentialMetadataForTests(): HisConnectionCredentialStorageMetadata[] {
      return Array.from(entriesByRef.values()).map(mapStoredCredentialReferenceToMetadata);
    },
  };
}
