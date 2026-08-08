
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

const scope = {
  tenantId: 'tenant-1',
  institutionId: 'institution-1',
  customerId: 'customer-1',
};

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

const snapshotInput: Omit<
  InstitutionChannelDryRunSnapshot,
  'version' | 'evaluatedAt'
> & { evaluatedAt: Date } = {
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

describe('TrustedReachOutSafetyRepository legacy compatibility', () => {
  it('保留 consent SELECT FOR UPDATE read compatibility', async () => {
    const forLock = vi.fn(async () => [consentRow]);
    const where = vi.fn(() => ({ for: forLock }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTrustedReachOutSafetyRepository(
      { select } as unknown as TenantDatabase,
    );

    await expect(repository.findConsentForUpdate(scope)).resolves.toMatchObject({
      status: 'consented',
      version: 1,
    });
    expect(forLock).toHaveBeenCalledWith('update');
  });

  it('保留 dry-run snapshot SELECT FOR UPDATE read compatibility', async () => {
    const forLock = vi.fn(async () => [snapshotRow]);
    const where = vi.fn(() => ({ for: forLock }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTrustedReachOutSafetyRepository(
      { select } as unknown as TenantDatabase,
    );

    await expect(
      repository.findDryRunSnapshotForUpdate({
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
      }),
    ).resolves.toMatchObject({
      configStatus: 'dry_run_ready',
      version: 1,
    });
    expect(forLock).toHaveBeenCalledWith('update');
  });

  it('legacy Safety direct Writer 全部 fail-closed 且不触发 insert/update', async () => {
    const insert = vi.fn();
    const update = vi.fn();
    const repository = createTrustedReachOutSafetyRepository(
      { insert, update } as unknown as TenantDatabase,
    );

    await expect(
      repository.upsertConsent({
        ...scope,
        id: 'consent-2',
        status: 'consented',
        sourceType: 'customer_explicit_written',
        evidenceRef: 'evidence-a',
        recordedBy: 'admin-a',
        recordedAt: new Date(),
        expectedVersion: null,
      }),
    ).rejects.toThrow('legacy_wecom_reachout_safety_writer_disabled');

    await expect(
      repository.createFrequencyIfAbsent({
        ...scope,
        id: 'frequency-a',
        operationRef: 'wrop-a',
        now: new Date(),
        windowEndsAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toThrow('legacy_wecom_reachout_safety_writer_disabled');

    await expect(
      repository.updateFrequencyWhenVersion({
        ...scope,
        operationRef: 'wrop-a',
        now: new Date(),
        windowStartedAt: new Date(),
        windowEndsAt: new Date(Date.now() + 60_000),
        preparedCount: 1,
        completedCount: 0,
        nextAllowedAt: new Date(Date.now() + 60_000),
        expectedVersion: 1,
      }),
    ).rejects.toThrow('legacy_wecom_reachout_safety_writer_disabled');

    await expect(
      repository.upsertDryRunSnapshot(snapshotInput),
    ).rejects.toThrow('legacy_wecom_reachout_safety_writer_disabled');

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
