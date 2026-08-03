import { and, eq } from 'drizzle-orm';

import type {
  TransactionBoundInstitutionScopeAssertion,
  TransactionBoundInstitutionScopeResolution,
} from '@/modules/tenancy/ports/transaction-bound-institution-scope';
import type { TenantDatabase } from '@/server/db/client';
import { institutionScopes } from '@/server/db/schema';

type ScopeRow = Readonly<{
  tenantId: string;
  institutionId: string;
  status: 'active' | 'suspended';
  revision: number;
}>;

function rejected(
  code: Extract<
    TransactionBoundInstitutionScopeResolution,
    { kind: 'rejected' }
  >['code'],
): TransactionBoundInstitutionScopeResolution {
  return Object.freeze({ kind: 'rejected', code });
}

function isCanonicalId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 64 &&
    value.trim() === value &&
    value.normalize('NFC') === value
  );
}

function isPositiveRevision(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= 2_147_483_647
  );
}

function mapScopeRow(
  value: unknown,
  input: Readonly<{ tenantId: string; institutionId: string }>,
): TransactionBoundInstitutionScopeResolution {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return rejected('scope_invalid');
  }
  const row = value as Partial<ScopeRow>;
  if (
    !isCanonicalId(row.tenantId) ||
    !isCanonicalId(row.institutionId) ||
    (row.status !== 'active' && row.status !== 'suspended') ||
    !isPositiveRevision(row.revision) ||
    row.tenantId !== input.tenantId ||
    row.institutionId !== input.institutionId
  ) {
    return rejected('scope_invalid');
  }
  if (row.status !== 'active') return rejected('scope_inactive');
  return Object.freeze({
    kind: 'active_scope',
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    revision: row.revision,
  });
}

/**
 * 只使用调用方已经开启的外层事务。该 adapter 不创建 transaction、
 * 不缓存 Scope，也不自动 retry。
 */
export function createTransactionBoundInstitutionScopeAssertion(
  database: TenantDatabase,
  isActive: () => boolean,
): TransactionBoundInstitutionScopeAssertion {
  return Object.freeze({
    async assertActive(
      input: Readonly<{ tenantId: string; institutionId: string }>,
    ) {
      if (
        !isActive() ||
        !isCanonicalId(input.tenantId) ||
        !isCanonicalId(input.institutionId)
      ) {
        return rejected('scope_unavailable');
      }

      let rows: readonly ScopeRow[];
      try {
        rows = await database
          .select({
            tenantId: institutionScopes.tenantId,
            institutionId: institutionScopes.institutionId,
            status: institutionScopes.status,
            revision: institutionScopes.revision,
          })
          .from(institutionScopes)
          .where(and(
            eq(institutionScopes.tenantId, input.tenantId),
            eq(institutionScopes.institutionId, input.institutionId),
          ))
          .limit(2)
          .for('share') as readonly ScopeRow[];
      } catch {
        return rejected('scope_unavailable');
      }

      if (!isActive()) return rejected('scope_unavailable');
      if (!Array.isArray(rows)) return rejected('scope_invalid');
      if (rows.length === 0) return rejected('scope_missing');
      if (rows.length !== 1) return rejected('scope_invalid');
      return mapScopeRow(rows[0], input);
    },
  });
}
