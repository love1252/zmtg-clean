
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  createWeComRealSendProofRepository,
  createWeComRealSendProofTransactionRepository,
} from '@/modules/institution/server/wecom-real-send-proof-repository';
import type { TenantDatabase } from '@/server/db/client';
import { mintVerifiedInstitutionAuditAttributionForOrchestrationV1 } from '@/modules/audit/domain/audit-events';

const auditAttribution = mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
  formalPair: { tenantId: 'tenant-a', institutionId: 'inst-a', observedAt: '2026-07-12T08:00:00.000Z' },
  businessPair: { tenantId: 'tenant-a', institutionId: 'inst-a' },
})!;
if (!auditAttribution) throw new Error('test audit attribution unavailable');

describe('WeComRealSendProof repository compatibility', () => {
  it('可信事实 read / lock 逻辑保留，但 direct business Writer 已移除', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/institution/server/wecom-real-send-proof-repository.ts',
      ),
      'utf8',
    );

    const mappingIndex = source.indexOf('.from(weComCustomerMappingStates)');
    const consentIndex = source.indexOf('.from(customerChannelContactConsents)');
    const frequencyIndex = source.indexOf('.from(customerChannelFrequencyStates)');

    expect(mappingIndex).toBeGreaterThan(-1);
    expect(consentIndex).toBeGreaterThan(mappingIndex);
    expect(frequencyIndex).toBeGreaterThan(consentIndex);
    expect(source.match(/\.for\('update'\)/gu)?.length ?? 0).toBeGreaterThanOrEqual(5);

    expect(source).not.toMatch(
      /\.(?:insert|update)\((?:weComRealSendProofOperations|customerChannelFrequencyStates|auditEvents)\)/u,
    );
    expect(source).not.toContain('mapAuditEventToInsert');
    expect(source).toContain('runWeComRealSendProofTransaction');
  });

  it('operation / frequency write methods 全部委托 Messaging canonical Writer', async () => {
    const writer = {
      createRealSendOperation: vi.fn(async () => ({ operationRef: 'a' })),
      consumeRealSendConfirmation: vi.fn(async () => ({ operationRef: 'a' })),
      abortRealSendOperation: vi.fn(async () => ({ operationRef: 'a' })),
      finalizeRealSendNonSuccess: vi.fn(async () => ({ operationRef: 'a' })),
      recordCompletedFrequency: vi.fn(async () => ({ lastCompletedRef: 'a' })),
      markRealSendSucceeded: vi.fn(async () => ({ operationRef: 'a' })),
    };
    const auditRepository = {
      recordAttributed: vi.fn(async () => undefined),
    };

    const repository = createWeComRealSendProofTransactionRepository(
      {} as unknown as TenantDatabase,
      writer as never,
      auditRepository,
      auditAttribution,
    );

    await repository.createOperation({ id: 'a' } as never);
    await repository.consumeConfirmation({ operationRef: 'a' } as never);
    await repository.abortOperation({ operationRef: 'a' } as never);
    await repository.finalizeNonSuccess({ operationRef: 'a' } as never);
    await repository.recordCompletedFrequency({ operation: {} } as never);
    await repository.markSucceeded({ operationRef: 'a' } as never);

    expect(writer.createRealSendOperation).toHaveBeenCalledOnce();
    expect(writer.consumeRealSendConfirmation).toHaveBeenCalledOnce();
    expect(writer.abortRealSendOperation).toHaveBeenCalledOnce();
    expect(writer.finalizeRealSendNonSuccess).toHaveBeenCalledOnce();
    expect(writer.recordCompletedFrequency).toHaveBeenCalledOnce();
    expect(writer.markRealSendSucceeded).toHaveBeenCalledOnce();
  });

  it('audit evidence 委托 Audit canonical repository', async () => {
    const auditRepository = {
      recordAttributed: vi.fn(async () => undefined),
    };
    const repository = createWeComRealSendProofTransactionRepository(
      {} as unknown as TenantDatabase,
      {} as never,
      auditRepository,
      auditAttribution,
    );

    const event = {
      eventId: 'event-a',
    } as never;

    await repository.recordAudit(event);

    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(event);
  });

  it('public repository 仅保留 orchestration transaction compatibility 入口', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/institution/server/wecom-real-send-proof-repository.ts',
      ),
      'utf8',
    );

    expect(source).toContain(
      '@/server/orchestration/wecom-reachout-transaction',
    );
    expect(source).not.toContain(
      'operation(createTransactionRepository(',
    );

    const repository = createWeComRealSendProofRepository(
      {} as unknown as TenantDatabase,
    );
    expect(repository.runInTransaction).toEqual(expect.any(Function));
  });
});
