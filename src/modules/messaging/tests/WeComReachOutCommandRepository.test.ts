
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import type { WeComRealSendProofOperation } from '@/modules/institution/domain/wecom-real-send-proof';
import { createWeComReachOutCommandRepository } from '@/modules/messaging/server/wecom-reachout-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  customerChannelFrequencyStates,
  weComRealSendProofOperations,
} from '@/server/db/schema';

const scope = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  customerId: 'customer-a',
};

function operation(
  overrides: Partial<WeComRealSendProofOperation> = {},
): WeComRealSendProofOperation {
  return {
    id: 'operation-a',
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    customerId: scope.customerId,
    channelType: 'wechat_work',
    draftId: 'draft-a',
    deliveryId: 'delivery-a',
    sourceReadyNoSendRef: 'ready-a',
    sourceReadyNoSendDigest: 'a'.repeat(64),
    readinessFingerprint: 'b'.repeat(64),
    mappingId: 'mapping-a',
    consentId: 'consent-a',
    frequencyStateId: 'frequency-a',
    dryRunSnapshotId: 'snapshot-a',
    productionAttestationId: 'attestation-a',
    operationRef: 'wrsproof-a',
    contentHash: 'c'.repeat(64),
    recipientBindingRef: 'recipient-a',
    recipientBindingDigest: 'd'.repeat(64),
    status: 'attempted',
    confirmationTokenDigest: 'e'.repeat(64),
    confirmationIssuedAt: '2026-08-08T15:00:00.000Z',
    confirmationExpiresAt: '2026-08-08T15:04:00.000Z',
    confirmationConsumedAt: '2026-08-08T15:01:00.000Z',
    operatorId: 'admin-a',
    sessionProvenance: 'server_session',
    requestedAt: '2026-08-08T15:00:00.000Z',
    attemptedAt: '2026-08-08T15:01:00.000Z',
    terminalAt: null,
    attemptCount: 1,
    providerResultCategory: null,
    completedFrequencyRef: null,
    version: 2,
    ...overrides,
  };
}

describe('WeComReachOutCommandRepository', () => {
  it('frequency update 使用 tenant + institution + customer + channel + version CAS', async () => {
    const returning = vi.fn(async () => []);
    const where = vi.fn((condition: SQL) => ({ returning, condition }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const repository = createWeComReachOutCommandRepository(
      { update } as unknown as TenantDatabase,
    );

    await repository.updateFrequencyWhenVersion({
      ...scope,
      operationRef: 'wrop-a',
      now: new Date('2026-08-08T15:00:00.000Z'),
      windowStartedAt: new Date('2026-08-08T00:00:00.000Z'),
      windowEndsAt: new Date('2026-08-09T00:00:00.000Z'),
      preparedCount: 1,
      completedCount: 0,
      nextAllowedAt: new Date('2026-08-09T00:00:00.000Z'),
      expectedVersion: 3,
    });

    expect(update).toHaveBeenCalledWith(customerChannelFrequencyStates);
    const condition = where.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    const query = new PgDialect().sqlToQuery(condition!);
    for (const column of [
      '"tenant_id"',
      '"institution_id"',
      '"customer_id"',
      '"channel_type"',
      '"version"',
    ]) {
      expect(query.sql).toContain(column);
    }
  });

  it('consume confirmation 强制 scope、token、operator、status 与时间窗口', async () => {
    const returning = vi.fn(async () => []);
    const where = vi.fn((condition: SQL) => ({ returning, condition }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const repository = createWeComReachOutCommandRepository(
      { update } as unknown as TenantDatabase,
    );

    await repository.consumeRealSendConfirmation({
      operationRef: 'wrsproof-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      tokenDigest: 'f'.repeat(64),
      operatorId: 'admin-a',
      now: new Date('2026-08-08T15:01:00.000Z'),
    });

    expect(update).toHaveBeenCalledWith(weComRealSendProofOperations);
    const condition = where.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    const query = new PgDialect().sqlToQuery(condition!);
    for (const fragment of [
      '"operation_ref"',
      '"tenant_id"',
      '"institution_id"',
      '"confirmation_token_digest"',
      '"operator_id"',
      '"status"',
      '"confirmation_consumed_at" is null',
      '"confirmation_issued_at" <',
      '"confirmation_expires_at" >',
    ]) {
      expect(query.sql).toContain(fragment);
    }
  });

  it('completedCount 只在同 scope、同 preparedRef、未达上限时 CAS 更新', async () => {
    const frequencyRow = {
      id: 'frequency-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      customerId: 'customer-a',
      channelType: 'wechat_work' as const,
      windowStartedAt: new Date('2026-08-08T00:00:00.000Z'),
      windowEndsAt: new Date('2026-08-09T00:00:00.000Z'),
      preparedCount: 1,
      completedCount: 0,
      maxPreparedCount: 1,
      maxCompletedCount: 1,
      nextAllowedAt: new Date('2026-08-09T00:00:00.000Z'),
      lastPreparedRef: 'wrsproof-a',
      lastCompletedRef: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies typeof customerChannelFrequencyStates.$inferSelect;

    const forUpdate = vi.fn(async () => [frequencyRow]);
    const readWhere = vi.fn(() => ({ for: forUpdate }));
    const from = vi.fn(() => ({ where: readWhere }));
    const select = vi.fn(() => ({ from }));

    const updatedRow = {
      ...frequencyRow,
      completedCount: 1,
      lastCompletedRef: 'wrsproof-a',
      version: 2,
    };
    const returning = vi.fn(async () => [updatedRow]);
    const updateWhere = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));

    const repository = createWeComReachOutCommandRepository(
      { select, update } as unknown as TenantDatabase,
    );

    const result = await repository.recordCompletedFrequency({
      operation: operation(),
      now: new Date('2026-08-08T15:02:00.000Z'),
    });

    expect(forUpdate).toHaveBeenCalledWith('update');
    expect(update).toHaveBeenCalledWith(customerChannelFrequencyStates);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        completedCount: 1,
        lastCompletedRef: 'wrsproof-a',
        version: 2,
      }),
    );
    expect(result).toMatchObject({
      completedCount: 1,
      lastCompletedRef: 'wrsproof-a',
      version: 2,
    });
  });

  it('frequency invariant 不满足时不发出 completedCount update', async () => {
    const invalidFrequency = {
      id: 'frequency-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      customerId: 'customer-a',
      channelType: 'wechat_work' as const,
      windowStartedAt: new Date(),
      windowEndsAt: new Date(),
      preparedCount: 1,
      completedCount: 0,
      maxPreparedCount: 1,
      maxCompletedCount: 1,
      nextAllowedAt: new Date(),
      lastPreparedRef: 'other-operation',
      lastCompletedRef: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies typeof customerChannelFrequencyStates.$inferSelect;

    const forUpdate = vi.fn(async () => [invalidFrequency]);
    const readWhere = vi.fn(() => ({ for: forUpdate }));
    const from = vi.fn(() => ({ where: readWhere }));
    const select = vi.fn(() => ({ from }));
    const update = vi.fn();

    const repository = createWeComReachOutCommandRepository(
      { select, update } as unknown as TenantDatabase,
    );

    await expect(
      repository.recordCompletedFrequency({
        operation: operation(),
        now: new Date(),
      }),
    ).resolves.toBeNull();

    expect(update).not.toHaveBeenCalled();
  });

  it('W1C-P2 direct Writer 只存在于 Messaging canonical repository', () => {
    const canonical = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/messaging/server/wecom-reachout-command-repository.ts',
      ),
      'utf8',
    );
    const legacySafety = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution/server/trusted-reachout-safety-repository.ts',
      ),
      'utf8',
    );
    const legacyRealSend = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution/server/wecom-real-send-proof-repository.ts',
      ),
      'utf8',
    );

    for (const marker of [
      '.insert(customerChannelContactConsents)',
      '.insert(customerChannelFrequencyStates)',
      '.update(customerChannelFrequencyStates)',
      '.insert(institutionChannelDryRunSnapshots)',
      '.insert(weComRealSendProofOperations)',
      '.update(weComRealSendProofOperations)',
    ]) {
      expect(canonical).toContain(marker);
    }

    expect(legacySafety).not.toMatch(
      /\.(?:insert|update)\((?:customerChannelContactConsents|customerChannelFrequencyStates|institutionChannelDryRunSnapshots)\)/u,
    );
    expect(legacyRealSend).not.toMatch(
      /\.(?:insert|update)\((?:customerChannelFrequencyStates|weComRealSendProofOperations|auditEvents)\)/u,
    );
    expect(canonical).not.toContain('auditEvents');
  });
});
