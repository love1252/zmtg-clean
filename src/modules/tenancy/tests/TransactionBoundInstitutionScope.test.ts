import { describe, expect, it, vi } from 'vitest';

import { createTransactionBoundInstitutionScopeAssertion } from '@/modules/tenancy/server/transaction-bound-institution-scope';
import type { TenantDatabase } from '@/server/db/client';
import { institutionScopes } from '@/server/db/schema';

function databaseWithRows(rows: unknown) {
  const forShare = vi.fn(async () => rows);
  const limit = vi.fn(() => ({ for: forShare }));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    database: { select } as unknown as TenantDatabase,
    select,
    from,
    where,
    limit,
    forShare,
  };
}

describe('transaction-bound institution Scope assertion', () => {
  it('在当前事务中锁定并返回 active Scope revision', async () => {
    const db = databaseWithRows([{
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      status: 'active',
      revision: 9,
    }]);
    const assertion = createTransactionBoundInstitutionScopeAssertion(
      db.database,
      () => true,
    );

    await expect(assertion.assertActive({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
    })).resolves.toEqual({
      kind: 'active_scope',
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      revision: 9,
    });
    expect(db.from).toHaveBeenCalledWith(institutionScopes);
    expect(db.limit).toHaveBeenCalledWith(2);
    expect(db.forShare).toHaveBeenCalledWith('share');
  });

  it.each([
    ['missing', [], 'scope_missing'],
    [
      'suspended',
      [{
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        status: 'suspended',
        revision: 9,
      }],
      'scope_inactive',
    ],
    [
      'duplicate',
      [
        {
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          status: 'active',
          revision: 9,
        },
        {
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          status: 'active',
          revision: 10,
        },
      ],
      'scope_invalid',
    ],
    [
      'tenant mismatch',
      [{
        tenantId: 'tenant-002',
        institutionId: 'institution-001',
        status: 'active',
        revision: 9,
      }],
      'scope_invalid',
    ],
    [
      'revision invalid',
      [{
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        status: 'active',
        revision: 0,
      }],
      'scope_invalid',
    ],
  ])('%s fail-closed', async (_label, rows, code) => {
    const db = databaseWithRows(rows);
    const assertion = createTransactionBoundInstitutionScopeAssertion(
      db.database,
      () => true,
    );
    await expect(assertion.assertActive({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
    })).resolves.toEqual({ kind: 'rejected', code });
  });

  it('查询异常、事务失效和回调结束后均 unavailable', async () => {
    const failing = databaseWithRows([]);
    failing.forShare.mockRejectedValueOnce(new Error('private database error'));
    const assertion = createTransactionBoundInstitutionScopeAssertion(
      failing.database,
      () => true,
    );
    await expect(assertion.assertActive({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
    })).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_unavailable',
    });

    const inactive = createTransactionBoundInstitutionScopeAssertion(
      databaseWithRows([]).database,
      () => false,
    );
    await expect(inactive.assertActive({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
    })).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_unavailable',
    });
  });
});
