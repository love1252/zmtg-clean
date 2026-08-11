import { describe, expect, it, vi } from 'vitest';

import {
  createHisConnectionCommandService,
  decideHisConnectionStatusTransition,
  type HisConnectionCommandPersistence,
} from '@/modules/institution-system/application/his-connection-command-service';

function persistence(): HisConnectionCommandPersistence {
  return {
    createHisConnectionForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    updateHisConnectionForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    pauseHisConnectionForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    resumeHisConnectionForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    revokeHisConnectionForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    softDeleteHisConnectionForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    setHisConnectionCredentialReferenceForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    rotateHisConnectionCredentialReferenceForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    clearHisConnectionCredentialReferenceForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    revokeHisConnectionCredentialReferenceForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
    writeHisConnectionHealthSummaryForTenant: vi.fn(async () => ({ status: 'validation_failed' as const })),
  };
}

describe('Institution System HIS connection command service', () => {
  it('accepts exact trusted create identity and delegates only normalized fields', async () => {
    const port = persistence();
    vi.mocked(port.createHisConnectionForTenant).mockResolvedValueOnce({ status: 'conflict' });
    const service = createHisConnectionCommandService(port);

    await expect(service.createHisConnectionForTenant({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      connectionName: 'HIS',
      sourceSystem: 'his',
      vendorType: 'vendor',
      systemType: 'his',
    })).resolves.toEqual({ status: 'conflict' });

    expect(port.createHisConnectionForTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      connectionName: 'HIS',
      sourceSystem: 'his',
      vendorType: 'vendor',
      systemType: 'his',
    });
  });

  it.each([
    { tenantId: ' tenant-1', actorUserId: 'user-1', connectionName: 'HIS', sourceSystem: 'his', vendorType: 'v', systemType: 'his' },
    { tenantId: 'tenant-1', actorUserId: '', connectionName: 'HIS', sourceSystem: 'his', vendorType: 'v', systemType: 'his' },
  ])('fails closed on non-exact create identity', async (input) => {
    const port = persistence();
    const service = createHisConnectionCommandService(port);
    await expect(service.createHisConnectionForTenant(input)).resolves.toEqual({
      status: 'validation_failed',
    });
    expect(port.createHisConnectionForTenant).not.toHaveBeenCalled();
  });

  it('validates credential reference and health summary contracts', async () => {
    const port = persistence();
    const service = createHisConnectionCommandService(port);

    await expect(service.setHisConnectionCredentialReferenceForTenant({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      actorUserId: 'user-1',
      credentialRef: 'secret_value',
    })).resolves.toEqual({ status: 'validation_failed' });

    await expect(service.writeHisConnectionHealthSummaryForTenant({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      healthStatus: 'healthy',
      checkedAt: new Date('2026-08-11T00:00:00.000Z'),
      lastErrorCode: 'provider_timeout',
      actorUserId: 'user-1',
    })).resolves.toEqual({ status: 'validation_failed' });
  });

  it('preserves current status transition rules', () => {
    expect(decideHisConnectionStatusTransition('pause', 'active')).toEqual({
      status: 'ok', nextStatus: 'paused',
    });
    expect(decideHisConnectionStatusTransition('resume', 'active')).toEqual({
      status: 'conflict',
    });
    expect(decideHisConnectionStatusTransition('revoke', 'draft')).toMatchObject({
      status: 'ok', nextStatus: 'revoked', setRevokedAt: true,
    });
    expect(decideHisConnectionStatusTransition('delete', 'deleted')).toEqual({
      status: 'conflict',
    });
  });
});
