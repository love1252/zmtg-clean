import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createHisConnectionCommandRepository } from '@/modules/institution-system/server/his-connection-command-repository';
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
    status: 'draft',
    credentialRef: null,
    healthStatus: 'unknown',
    lastCheckedAt: null,
    lastErrorCode: null,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    revokedAt: null,
    deletedAt: null,
    ...overrides,
  } as typeof hisConnections.$inferSelect;
}

function insertDb(returned = row()) {
  const returning = vi.fn(async () => [returned]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  return { database: { insert } as unknown as TenantDatabase, insert, values };
}

function updateDb(current: unknown[], returned: unknown[]) {
  const returning = vi.fn(async () => returned);
  const updateWhere = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const lookupWhere = vi.fn(async () => current);
  const from = vi.fn(() => ({ where: lookupWhere }));
  const select = vi.fn(() => ({ from }));
  return {
    database: { select, update } as unknown as TenantDatabase,
    select, update, set, updateWhere,
  };
}

describe('Institution System HIS connection canonical repository', () => {
  it('owns exactly six production hisConnections direct mutation call sites', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution-system/server/his-connection-command-repository.ts'),
      'utf8',
    );
    const calls = source.match(/\bdatabase\s*\.\s*(?:insert|update|delete)\s*\(\s*hisConnections\s*\)/g) ?? [];
    expect(calls).toHaveLength(6);
    expect(source.match(/\bdatabase\s*\.\s*insert\s*\(\s*hisConnections\s*\)/g) ?? []).toHaveLength(1);
    expect(source.match(/\bdatabase\s*\.\s*update\s*\(\s*hisConnections\s*\)/g) ?? []).toHaveLength(5);
  });

  it('creates only under explicit tenant scope', async () => {
    const fixture = insertDb();
    const repository = createHisConnectionCommandRepository(fixture.database);
    const result = await repository.createHisConnectionForTenant({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      connectionName: 'HIS',
      sourceSystem: 'his',
      vendorType: 'vendor',
      systemType: 'his',
    });
    expect(fixture.insert).toHaveBeenCalledWith(hisConnections);
    expect(fixture.values).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      updatedBy: 'user-1',
    }));
    expect(result).toMatchObject({ status: 'ok', record: { tenantId: 'tenant-1' } });
  });

  it('preserves transition, credential and health tenant predicates', async () => {
    const fixture = updateDb([row({ status: 'active' })], [row({ status: 'paused' })]);
    const repository = createHisConnectionCommandRepository(fixture.database);

    await expect(repository.pauseHisConnectionForTenant({
      tenantId: 'tenant-1', connectionId: 'his_conn_1', actorUserId: 'user-1',
    })).resolves.toMatchObject({ status: 'ok' });

    expect(fixture.update).toHaveBeenCalledWith(hisConnections);
    expect(fixture.set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'paused',
      updatedBy: 'user-1',
    }));
  });
});
