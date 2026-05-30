import { describe, expect, it } from 'vitest';
import {
  auditForbiddenTerms,
  createAuditEvent,
  createDeniedAccessAuditEvent,
} from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';

const tenantAdminContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

describe('审计事件领域模型', () => {
  it('创建允许访问审计事件并包含完整字段', () => {
    expect(
      createAuditEvent({
        eventId: 'audit_evt_001',
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-30T09:00:00.000Z',
      }),
    ).toEqual({
      eventId: 'audit_evt_001',
      actorId: 'demo-user-admin',
      actorRole: 'tenant_admin',
      tenantId: 'demo-tenant-001',
      scope: 'tenant',
      resource: 'customer',
      action: 'read_own_tenant',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: '2026-05-30T09:00:00.000Z',
      source: 'demo_session',
    });
  });

  it('创建拒绝访问审计事件', () => {
    expect(
      createDeniedAccessAuditEvent({
        eventId: 'audit_evt_denied_001',
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        reason: 'cross_tenant_denied',
        occurredAt: '2026-05-30T09:01:00.000Z',
      }),
    ).toMatchObject({
      result: 'denied',
      reason: 'cross_tenant_denied',
      resource: 'customer',
      action: 'read_own_tenant',
    });
  });

  it('审计事件风险词列表覆盖凭证明文模式', () => {
    expect(auditForbiddenTerms).toEqual([
      'client_secret',
      'access_token',
      'refresh_token',
      'private_key',
      'webhook_secret',
      'sk_live',
      'sk_test',
      'zmtg_sk_',
    ]);

    const serialized = JSON.stringify(
      createAuditEvent({
        eventId: 'audit_evt_002',
        context: tenantAdminContext,
        resource: 'follow_up',
        action: 'review',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-30T09:02:00.000Z',
      }),
    ).toLowerCase();

    auditForbiddenTerms.forEach((term) => {
      expect(serialized).not.toContain(term);
    });
  });
});
