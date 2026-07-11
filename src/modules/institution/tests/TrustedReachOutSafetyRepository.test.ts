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
const snapshotRow = {
  ...snapshotInput,
  version: 1,
  createdAt: new Date('2026-07-11T02:00:00.000Z'),
  updatedAt: new Date('2026-07-11T02:00:00.000Z'),
} satisfies typeof institutionChannelDryRunSnapshots.$inferSelect;

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

  it('受控触达事务通过 SELECT FOR UPDATE 锁定 dry-run snapshot', async () => {
    const forLock = vi.fn(async () => [snapshotRow]);
    const where = vi.fn(() => ({ for: forLock }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTrustedReachOutSafetyRepository({ select } as unknown as TenantDatabase);

    const result = await repository.findDryRunSnapshotForUpdate({
      tenantId: 'tenant-1', institutionId: 'institution-1',
    });

    expect(forLock).toHaveBeenCalledWith('update');
    expect(result).toEqual(expect.objectContaining({
      configStatus: 'dry_run_ready', officialRoute: 'official_wecom_self_built', version: 1,
    }));
  });

  it('incoming ready 的冲突条件只编码较新 evaluatedAt', async () => {
    const returning = vi.fn(async () => []);
    const onConflictDoUpdate = vi.fn((_config: unknown) => ({ returning }));
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
    expect(query.sql).not.toContain('"evaluated_at" =');
    expect(query.sql).not.toContain('"config_status"');
    expect(query.params).toEqual(['2026-07-11T02:00:00.000Z']);
    expect(query.params.every(parameter => !(parameter instanceof Date))).toBe(true);
    expect(conflict.set.version).toBeDefined();
    expect(result).toBeNull();
  });

  it('incoming blocked 的冲突条件编码较新评估与同时间 ready → blocked', async () => {
    const returning = vi.fn(async () => []);
    const onConflictDoUpdate = vi.fn((_config: unknown) => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const repository = createTrustedReachOutSafetyRepository({ insert } as unknown as TenantDatabase);

    const result = await repository.upsertDryRunSnapshot({
      ...snapshotInput,
      configStatus: 'blocked_missing_callback_url',
    });
    const conflict = onConflictDoUpdate.mock.calls[0][0] as {
      setWhere: SQL;
      set: { version: SQL };
    };
    const query = new PgDialect().sqlToQuery(conflict.setWhere);

    expect(insert).toHaveBeenCalledWith(institutionChannelDryRunSnapshots);
    expect(query.sql).toContain('"evaluated_at" < $1');
    expect(query.sql).toContain('"evaluated_at" = $2');
    expect(query.sql).toContain('"config_status" = $3');
    expect(query.params).toEqual([
      '2026-07-11T02:00:00.000Z',
      '2026-07-11T02:00:00.000Z',
      'dry_run_ready',
    ]);
    expect(query.params.every(parameter => !(parameter instanceof Date))).toBe(true);
    expect(conflict.set.version).toBeDefined();
    expect(result).toBeNull();
  });
});
