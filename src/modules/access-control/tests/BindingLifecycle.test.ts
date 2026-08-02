import { describe, expect, it } from 'vitest';

import {
  BINDING_MAX_VERSION,
  isBindingCurrent,
  isRuntimeBindingCommandId,
  isRuntimeBindingTransitionId,
  validateBindingOwnerCommand,
  validateBindingOwnerCommandIdentity,
  type BindingOwnerCommand,
} from '@/modules/access-control/domain/binding-lifecycle';
import {
  createBindingCommandId,
  createBindingTransitionId,
} from '@/modules/access-control/application/binding-command-service';

const COMMAND_ID = `bcmd1_${'A'.repeat(43)}`;

function createCommand(
  overrides: Record<string, unknown> = {},
): BindingOwnerCommand {
  return {
    kind: 'create',
    commandId: COMMAND_ID,
    tenantId: 'tenant-001',
    membershipId: 'member-001',
    accountId: 'user-001',
    expectedMembershipRevision: 4,
    bindingId: 'binding-002',
    institutionId: 'institution-002',
    assignmentSource: 'system',
    provenanceSource: 'access_control_command',
    actorId: 'actor-001',
    reasonCode: 'binding_create',
    occurredAt: '2026-08-03T00:00:00.000Z',
    expiresAt: null,
    ...overrides,
  } as BindingOwnerCommand;
}

describe('Binding lifecycle domain', () => {
  it('生成 canonical bcmd1／btr1 identity', () => {
    const commands = Array.from({ length: 8 }, createBindingCommandId);
    const transitions = Array.from({ length: 8 }, createBindingTransitionId);
    expect(new Set(commands).size).toBe(8);
    expect(new Set(transitions).size).toBe(8);
    for (const value of commands) {
      expect(isRuntimeBindingCommandId(value)).toBe(true);
      expect(value).toMatch(/^bcmd1_[A-Za-z0-9_-]{43}$/u);
      expect(Buffer.from(value.slice(6), 'base64url')).toHaveLength(32);
    }
    for (const value of transitions) {
      expect(isRuntimeBindingTransitionId(value)).toBe(true);
      expect(value).toMatch(/^btr1_[A-Za-z0-9_-]{43}$/u);
      expect(Buffer.from(value.slice(5), 'base64url')).toHaveLength(32);
    }
  });

  it.each([
    createCommand(),
    {
      kind: 'rebind',
      commandId: COMMAND_ID,
      tenantId: 'tenant-001',
      membershipId: 'member-001',
      accountId: 'user-001',
      expectedMembershipRevision: 4,
      bindingId: 'binding-001',
      expectedBindingVersion: 8,
      replacementBindingId: 'binding-003',
      institutionId: 'institution-002',
      assignmentSource: 'system',
      actorId: 'actor-001',
      reasonCode: 'binding_rebind',
      occurredAt: '2026-08-03T00:00:00.000Z',
      expiresAt: null,
    },
    {
      kind: 'revoke',
      commandId: COMMAND_ID,
      tenantId: 'tenant-001',
      membershipId: 'member-001',
      accountId: 'user-001',
      expectedMembershipRevision: 4,
      bindingId: 'binding-001',
      expectedBindingVersion: 8,
      actorId: 'actor-001',
      reasonCode: 'binding_revoke',
      occurredAt: '2026-08-03T00:00:00.000Z',
    },
    {
      kind: 'expire',
      commandId: COMMAND_ID,
      tenantId: 'tenant-001',
      membershipId: 'member-001',
      accountId: 'user-001',
      expectedMembershipRevision: 4,
      bindingId: 'binding-001',
      expectedBindingVersion: 8,
    },
  ] as BindingOwnerCommand[])('接受四类 canonical command', (command) => {
    expect(validateBindingOwnerCommandIdentity(command)).toBeNull();
    expect(validateBindingOwnerCommand(command)).toBeNull();
  });

  it('拒绝 extra key、错误 identity、时间、版本和 rebind self replacement', () => {
    expect(validateBindingOwnerCommand({
      ...createCommand(),
      extra: true,
    })).toBe('binding_command_shape_invalid');
    expect(validateBindingOwnerCommand(createCommand({
      commandId: 'bcmd1_bad',
    }))).toBe('binding_command_shape_invalid');
    expect(validateBindingOwnerCommand(createCommand({
      occurredAt: 'not-a-time',
    }))).toBe('binding_command_time_invalid');
    expect(validateBindingOwnerCommand({
      kind: 'expire',
      commandId: COMMAND_ID,
      tenantId: 'tenant-001',
      membershipId: 'member-001',
      accountId: 'user-001',
      expectedMembershipRevision: 4,
      bindingId: 'binding-001',
      expectedBindingVersion: 0,
    })).toBe('binding_version_invalid');
    expect(validateBindingOwnerCommand({
      kind: 'rebind',
      commandId: COMMAND_ID,
      tenantId: 'tenant-001',
      membershipId: 'member-001',
      accountId: 'user-001',
      expectedMembershipRevision: 4,
      bindingId: 'binding-001',
      expectedBindingVersion: 8,
      replacementBindingId: 'binding-001',
      institutionId: 'institution-002',
      assignmentSource: 'system',
      actorId: 'actor-001',
      reasonCode: 'binding_rebind',
      occurredAt: '2026-08-03T00:00:00.000Z',
      expiresAt: null,
    })).toBe('binding_command_shape_invalid');
  });

  it('current envelope 固定 active／revoked Shape 与 version 上限', () => {
    const base = {
      bindingId: 'binding-001',
      accountId: 'user-001',
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      status: 'active' as const,
      source: 'manual_admin' as const,
      assignedBy: 'actor-001',
      assignedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: null,
      revokedAt: null,
      version: 8,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    expect(isBindingCurrent(base)).toBe(true);
    expect(isBindingCurrent({
      ...base,
      status: 'revoked',
      revokedAt: '2026-08-03T00:00:00.000Z',
    })).toBe(true);
    expect(isBindingCurrent({ ...base, version: BINDING_MAX_VERSION + 1 }))
      .toBe(false);
    expect(isBindingCurrent({ ...base, status: 'revoked', revokedAt: null }))
      .toBe(false);
  });
});
