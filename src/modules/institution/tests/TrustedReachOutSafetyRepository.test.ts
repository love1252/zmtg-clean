import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  createTrustedReachOutSafetyRepository,
  type InstitutionChannelDryRunSnapshot,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  customerChannelContactConsents,
  institutionChannelDryRunSnapshots,
} from '@/server/db/schema';

const scope = { tenantId: 'tenant-1', institutionId: 'institution-1', customerId: 'customer-1' };
const consentRow = {
  id: 'consent-1',
  ...scope,
  channelType: 'wechat_work' as const,
  status: 'consented' as const,
  sourceType: 'customer_explicit_written' as const,
  evidenceRef: 'wcc_generated-1',
  recordedBy: 'admin-1',
  recordedAt: new Date('2026-07-11T00:00:00.000Z'),
  version: 1,
  createdAt: new Date('2026-07-11T00:00:00.000Z'),
  updatedAt: new Date('2026-07-11T00:00:00.000Z'),
} satisfies typeof customerChannelContactConsents.$inferSelect;

const snapshotInput: Omit<InstitutionChannelDryRunSnapshot, 'version' | 'evaluatedAt'> & { evaluatedAt: Date } = {
  id: 'snapshot-1',
  tenantId: 'tenant-1',
  institutionId: 'institution-1',
  channelType: 'wechat_work',
  officialRoute: 'official_wecom_self_built',
  proofInstitutionRef: 'institution-placeholder-1',
  callbackPlaceholderRef: 'callback-placeholder-example-test',
  configStatus: 'dry_run_ready',
  preflightStatus: 'mock_ready',
  proofEligibleMock: true,
  evaluatedBy: 'admin-1',
  evaluatedAt: new Date('2026-07-11T02:00:00.000Z'),
  allowRealSend: false,
  externalChannelEnabled: false,
  realSendAllowed: false,
  dryRunOnly: true,
};

describe('TrustedReachOutSafetyRepository', () => {
  it('事务写链路通过 SELECT FOR UPDATE 锁定 consent row', async () => {
    const forLock = vi.fn(async () => [consentRow]);
    const where = vi.fn(() => ({ for: forLock }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTrustedReachOutSafetyRepository({ select } as unknown as TenantDatabase);

    const result = await repository.findConsentForUpdate(scope);

    expect(forLock).toHaveBeenCalledWith('update');
    expect(result).toEqual(expect.objectContaining({ status: 'consented', version: 1 }));
  });

  it('快照 ON CONFLICT 仅在现有 evaluatedAt 更早时更新，stale 返回 null', async () => {
    const returning = vi.fn(async () => []);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const repository = createTrustedReachOutSafetyRepository({ insert } as unknown as TenantDatabase);

    const result = await repository.upsertDryRunSnapshot(snapshotInput);
    const conflict = onConflictDoUpdate.mock.calls[0][0] as {
      setWhere: SQL;
      set: { version: SQL };
    };
    const query = new PgDialect().sqlToQuery(conflict.setWhere);

    expect(insert).toHaveBeenCalledWith(institutionChannelDryRunSnapshots);
    expect(query.sql).toContain('"evaluated_at" < $1');
    expect(query.params).toEqual([snapshotInput.evaluatedAt]);
    expect(conflict.set.version).toBeDefined();
    expect(result).toBeNull();
  });
});
