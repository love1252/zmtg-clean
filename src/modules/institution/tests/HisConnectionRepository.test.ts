import { describe, expect, it, vi } from 'vitest';

import {
  createHisConnectionRepository,
  mapHisConnectionRowToCredentialSummary,
  mapHisConnectionRowToReadModel,
} from '@/modules/institution/server/his-connection-repository';
import type { TenantDatabase } from '@/server/db/client';
import { hisConnections } from '@/server/db/schema';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'his_conn_1',
    tenantId: 'tenant-1',
    connectionName: 'HIS',
    sourceSystem: 'his',
    vendorType: 'vendor',
    systemType: 'his',
    status: 'active',
    credentialRef: 'cred_ref_abcdefghijkl',
    healthStatus: 'healthy',
    lastCheckedAt: new Date('2026-08-11T00:00:00.000Z'),
    lastErrorCode: null,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    revokedAt: null,
    deletedAt: null,
    ...overrides,
  } as typeof hisConnections.$inferSelect;
}

describe('legacy Institution HIS connection repository compatibility', () => {
  it('all legacy Writer entry points fail closed before DB mutation', async () => {
    const insert = vi.fn();
    const update = vi.fn();
    const repository = createHisConnectionRepository({
      insert,
      update,
    } as unknown as TenantDatabase);

    await expect(repository.createHisConnectionForTenant({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      connectionName: 'HIS',
      sourceSystem: 'his',
      vendorType: 'vendor',
      systemType: 'his',
    })).rejects.toThrow('legacy_institution_his_connection_writer_disabled');

    await expect(repository.pauseHisConnectionForTenant({
      tenantId: 'tenant-1',
      connectionId: 'his_conn_1',
      actorUserId: 'user-1',
    })).rejects.toThrow('legacy_institution_his_connection_writer_disabled');

    await expect(repository.setHisConnectionCredentialReferenceForTenant({
      tenantId: 'tenant-1',
      connectionId: 'his_conn_1',
      actorUserId: 'user-1',
      credentialRef: 'cred_ref_abcdefghijkl',
    })).rejects.toThrow('legacy_institution_his_connection_writer_disabled');

    await expect(repository.writeHisConnectionHealthSummaryForTenant({
      tenantId: 'tenant-1',
      connectionId: 'his_conn_1',
      healthStatus: 'healthy',
      checkedAt: new Date('2026-08-11T00:00:00.000Z'),
      lastErrorCode: null,
      actorUserId: 'user-1',
    })).rejects.toThrow('legacy_institution_his_connection_writer_disabled');

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('list/get/credential-summary Readers remain compatible', async () => {
    const rows=[row()];
    const orderBy=vi.fn(async () => rows);
    const listWhere=vi.fn(() => ({ orderBy }));
    const listFrom=vi.fn(() => ({ where: listWhere }));
    const listSelect=vi.fn(() => ({ from: listFrom }));

    const listRepository=createHisConnectionRepository({
      select: listSelect,
    } as unknown as TenantDatabase);
    await expect(listRepository.listHisConnectionsByTenant('tenant-1')).resolves.toHaveLength(1);

    const lookupWhere=vi.fn(async () => rows);
    const lookupFrom=vi.fn(() => ({ where: lookupWhere }));
    const lookupSelect=vi.fn(() => ({ from: lookupFrom }));
    const lookupRepository=createHisConnectionRepository({
      select: lookupSelect,
    } as unknown as TenantDatabase);

    await expect(lookupRepository.getHisConnectionByTenant({
      tenantId:'tenant-1', connectionId:'his_conn_1',
    })).resolves.toMatchObject({ tenantId:'tenant-1', connectionId:'his_conn_1' });

    expect(mapHisConnectionRowToReadModel(rows[0]!)).toMatchObject({
      credentialConfigured: true,
      healthStatus: 'healthy',
    });
    expect(mapHisConnectionRowToCredentialSummary(rows[0]!)).toMatchObject({
      credentialConfigured: true,
      credentialStatus: 'configured',
    });
  });
});
