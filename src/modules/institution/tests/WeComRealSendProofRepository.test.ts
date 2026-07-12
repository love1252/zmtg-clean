import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { createWeComRealSendProofRepository } from '@/modules/institution/server/wecom-real-send-proof-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  customerChannelFrequencyStates,
  weComRealSendProofOperations,
} from '@/server/db/schema';

function transactionDatabase(overrides: Record<string, unknown>) {
  const database = { ...overrides } as unknown as TenantDatabase;
  return {
    transaction: vi.fn(async (callback: (transaction: TenantDatabase) => unknown) => callback(database)),
  } as unknown as TenantDatabase;
}

describe('WeComRealSendProof repository', () => {
  it('issue/consume 的可信事实读取使用事务行锁并保持 consent → frequency 顺序', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/wecom-real-send-proof-repository.ts'),
      'utf8',
    );
    const mappingIndex = source.indexOf('.from(weComCustomerMappingStates)');
    const consentIndex = source.indexOf('.from(customerChannelContactConsents)');
    const frequencyIndex = source.indexOf('.from(customerChannelFrequencyStates)');
    expect(mappingIndex).toBeGreaterThan(-1);
    expect(consentIndex).toBeGreaterThan(mappingIndex);
    expect(consentIndex).toBeGreaterThan(-1);
    expect(frequencyIndex).toBeGreaterThan(consentIndex);
    expect(source.match(/\.for\('update'\)/gu)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(source).toContain('isEligibleControlledReachOutMockDelivery(delivery)');
    expect(source).toContain('delivery.tenantId !== input.tenantId');
    expect(source).toContain('delivery.institutionId !== input.institutionId');
    expect(source).toContain('delivery.customerId !== draft.customerId');
    expect(source).toContain('delivery.followUpTaskId !== draft.followUpTaskId');
    expect(source).toContain('delivery.messageDraftId !== draft.id');
    expect(source).toContain("delivery.id !== `msg-delivery:${draft.id}`.slice(0, 96)");
  });

  it('consume 使用 operation/token/operator/status/未消费/未过期条件更新并进入 attempted', async () => {
    const returning = vi.fn(async () => []);
    const where = vi.fn((condition: SQL) => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const repository = createWeComRealSendProofRepository(transactionDatabase({ update }));

    await repository.runInTransaction((tx) => tx.consumeConfirmation({
      operationRef: 'wrsproof-a', tenantId: 'tenant-a', institutionId: 'inst-a',
      tokenDigest: 'a'.repeat(64), operatorId: 'admin-a',
      now: new Date('2026-07-12T08:00:00.000Z'),
    }));

    expect(update).toHaveBeenCalledWith(weComRealSendProofOperations);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'attempted', attemptCount: 1 }));
    const condition = where.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    const sql = new PgDialect().sqlToQuery(condition!);
    expect(sql.sql).toContain('"operation_ref" =');
    expect(sql.sql).toContain('"tenant_id" =');
    expect(sql.sql).toContain('"institution_id" =');
    expect(sql.sql).toContain('"confirmation_token_digest" =');
    expect(sql.sql).toContain('"operator_id" =');
    expect(sql.sql).toContain('"status" =');
    expect(sql.sql).toContain('"confirmation_consumed_at" is null');
    expect(sql.sql).toContain('"confirmation_issued_at" <');
    expect(sql.sql).toContain('"confirmation_expires_at" >');
  });

  it('operation 锁定读取绑定 tenant + institution + operationRef', async () => {
    const forUpdate = vi.fn(async () => []);
    const where = vi.fn((condition: SQL) => ({ for: forUpdate, condition }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createWeComRealSendProofRepository(transactionDatabase({ select }));

    await repository.runInTransaction((tx) => tx.lockOperation({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      operationRef: 'wrsproof-a',
    }));

    expect(forUpdate).toHaveBeenCalledWith('update');
    const condition = where.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    const sql = new PgDialect().sqlToQuery(condition!);
    expect(sql.sql).toContain('"tenant_id" =');
    expect(sql.sql).toContain('"institution_id" =');
    expect(sql.sql).toContain('"operation_ref" =');
  });

  it('finalize success 基础先 SELECT FOR UPDATE 锁 operation 与 frequency', async () => {
    const frequencyRow = {
      id: 'frequency-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', channelType: 'wechat_work' as const,
      windowStartedAt: new Date('2026-07-12T00:00:00.000Z'), windowEndsAt: new Date('2026-07-13T00:00:00.000Z'),
      preparedCount: 1, completedCount: 0, maxPreparedCount: 1, maxCompletedCount: 1,
      nextAllowedAt: new Date('2026-07-13T00:00:00.000Z'), lastPreparedRef: 'wrsproof-a', lastCompletedRef: null,
      version: 1, createdAt: new Date(), updatedAt: new Date(),
    } satisfies typeof customerChannelFrequencyStates.$inferSelect;
    const forUpdate = vi.fn(async () => [frequencyRow]);
    const selectWhere = vi.fn(() => ({ for: forUpdate }));
    const from = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from }));
    const returning = vi.fn(async () => [frequencyRow]);
    const updateWhere = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const repository = createWeComRealSendProofRepository(transactionDatabase({ select, update }));

    const result = await repository.runInTransaction((tx) => tx.recordCompletedFrequency({
      operation: {
        id: 'operation-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', channelType: 'wechat_work', draftId: 'draft-a', deliveryId: 'delivery-a',
        sourceReadyNoSendRef: 'ready-a', sourceReadyNoSendDigest: 'a'.repeat(64), readinessFingerprint: 'b'.repeat(64), mappingId: 'mapping-a',
        consentId: 'consent-a', frequencyStateId: 'frequency-a', dryRunSnapshotId: 'snapshot-a', productionAttestationId: 'attestation-a',
        operationRef: 'wrsproof-a', contentHash: 'c'.repeat(64), recipientBindingRef: 'recipient-a', recipientBindingDigest: 'd'.repeat(64),
        status: 'attempted', confirmationTokenDigest: 'e'.repeat(64), confirmationIssuedAt: '2026-07-12T07:59:00.000Z',
        confirmationExpiresAt: '2026-07-12T08:03:00.000Z', confirmationConsumedAt: '2026-07-12T08:00:00.000Z', operatorId: 'admin-a',
        sessionProvenance: 'server_session', requestedAt: '2026-07-12T07:59:00.000Z', attemptedAt: '2026-07-12T08:00:00.000Z',
        terminalAt: null, attemptCount: 1, providerResultCategory: null, completedFrequencyRef: null, version: 2,
      },
      now: new Date('2026-07-12T08:01:00.000Z'),
    }));

    expect(forUpdate).toHaveBeenCalledWith('update');
    expect(update).toHaveBeenCalledWith(customerChannelFrequencyStates);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ completedCount: 1, lastCompletedRef: 'wrsproof-a' }));
    expect(result).not.toBeNull();
  });

  it('lastPreparedRef 不关联或 completed 达上限时拒绝回写', async () => {
    const row = {
      id: 'frequency-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', channelType: 'wechat_work' as const,
      windowStartedAt: new Date(), windowEndsAt: new Date(), preparedCount: 1, completedCount: 0, maxPreparedCount: 1, maxCompletedCount: 1,
      nextAllowedAt: new Date(), lastPreparedRef: 'other-operation', lastCompletedRef: null, version: 1, createdAt: new Date(), updatedAt: new Date(),
    } satisfies typeof customerChannelFrequencyStates.$inferSelect;
    const forUpdate = vi.fn(async () => [row]);
    const where = vi.fn(() => ({ for: forUpdate }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const update = vi.fn();
    const repository = createWeComRealSendProofRepository(transactionDatabase({ select, update }));

    const result = await repository.runInTransaction((tx) => tx.recordCompletedFrequency({
      operation: {
        id: 'operation-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', channelType: 'wechat_work', draftId: 'draft-a', deliveryId: 'delivery-a',
        sourceReadyNoSendRef: 'ready-a', sourceReadyNoSendDigest: 'a'.repeat(64), readinessFingerprint: 'b'.repeat(64), mappingId: 'mapping-a', consentId: 'consent-a',
        frequencyStateId: 'frequency-a', dryRunSnapshotId: 'snapshot-a', productionAttestationId: 'attestation-a', operationRef: 'wrsproof-a',
        contentHash: 'c'.repeat(64), recipientBindingRef: 'recipient-a', recipientBindingDigest: 'd'.repeat(64), status: 'attempted',
        confirmationTokenDigest: 'e'.repeat(64), confirmationIssuedAt: '', confirmationExpiresAt: '', confirmationConsumedAt: '', operatorId: 'admin-a',
        sessionProvenance: 'server_session', requestedAt: '', attemptedAt: '', terminalAt: null, attemptCount: 1, providerResultCategory: null,
        completedFrequencyRef: null, version: 1,
      }, now: new Date(),
    }));

    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
