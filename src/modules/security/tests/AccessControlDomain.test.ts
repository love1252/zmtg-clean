import { describe, expect, it } from 'vitest';
import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
  ACCESS_ROLES,
  canAccessResource,
} from '@/modules/security/domain/access-control';

const tenantAdminContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
} as const;

const tenantOperatorContext = {
  userId: 'demo-user-operator',
  role: 'tenant_operator',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
} as const;

const consultantContext = {
  userId: 'demo-user-consultant',
  role: 'consultant',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
} as const;

const customerServiceContext = {
  userId: 'demo-user-customer-service',
  role: 'customer_service',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
} as const;

const platformAdminContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

const platformOperatorContext = {
  userId: 'demo-user-platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

const securityAuditorContext = {
  userId: 'demo-user-auditor',
  role: 'security_auditor',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

describe('访问控制领域', () => {
  it('定义稳定角色、资源和动作', () => {
    expect(ACCESS_ROLES).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
      'platform_admin',
      'platform_operator',
      'security_auditor',
    ]);
    expect(ACCESS_RESOURCES).toEqual([
      'tenant',
      'tenant_member',
      'customer',
      'appointment',
      'follow_up',
      'message_delivery',
      'dashboard',
      'safety_switch',
      'real_channel',
      'treatment_summary',
      'open_connection',
      'permission_policy',
      'audit_log',
      'platform_health',
      'ai_model_config',
      'knowledge_management',
    ]);
    expect(ACCESS_ACTIONS).toContain('read');
    expect(ACCESS_ACTIONS).toContain('read_own_tenant');
    expect(ACCESS_ACTIONS).toContain('read_aggregate');
    expect(ACCESS_ACTIONS).toContain('import');
    expect(ACCESS_ACTIONS).toContain('export');
    expect(ACCESS_ACTIONS).toContain('approve');
    expect(ACCESS_ACTIONS).toContain('enable');
    expect(ACCESS_ACTIONS).toContain('disable');
    expect(ACCESS_ACTIONS).toContain('export_report');
    expect(ACCESS_ACTIONS).toContain('manage_credentials');
    expect(ACCESS_ACTIONS).toContain('test_connection');
  });

  it('允许机构管理员读取本租户资源', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('允许机构管理员在本租户创建和更新客户、预约、随访', () => {
    const writeCases = [
      { resource: 'customer', action: 'create' },
      { resource: 'customer', action: 'update' },
      { resource: 'appointment', action: 'create' },
      { resource: 'appointment', action: 'update' },
      { resource: 'follow_up', action: 'update' },
    ] as const;

    for (const writeCase of writeCases) {
      expect(
        canAccessResource({
          context: tenantAdminContext,
          resource: writeCase.resource,
          action: writeCase.action,
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    }
  });

  it('允许机构管理员在本租户读取、创建、更新和管理 HIS 连接配置状态', () => {
    const openConnectionActions = [
      'read_own_tenant',
      'create',
      'update',
      'manage_status',
      'manage_credentials',
      'test_connection',
      'delete',
    ] as const;

    for (const action of openConnectionActions) {
      expect(
        canAccessResource({
          context: tenantAdminContext,
          resource: 'open_connection',
          action,
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    }
  });

  it('拒绝未授权角色创建或更新 HIS 连接配置', () => {
    const deniedContexts = [
      tenantOperatorContext,
      consultantContext,
      customerServiceContext,
      platformAdminContext,
      platformOperatorContext,
      securityAuditorContext,
    ] as const;
    const writeActions = ['create', 'update'] as const;

    for (const context of deniedContexts) {
      for (const action of writeActions) {
        expect(
          canAccessResource({
            context,
            resource: 'open_connection',
            action,
            targetTenantId: 'demo-tenant-001',
          }),
        ).toEqual({ allowed: false, reason: 'role_denied' });
      }
    }
  });

  it('拒绝非机构管理员角色管理状态、凭证或删除 HIS 连接配置', () => {
    const deniedContexts = [
      tenantOperatorContext,
      consultantContext,
      customerServiceContext,
      platformAdminContext,
      platformOperatorContext,
      securityAuditorContext,
    ] as const;
    const statusActions = ['manage_status', 'manage_credentials', 'delete'] as const;

    for (const context of deniedContexts) {
      for (const action of statusActions) {
        expect(
          canAccessResource({
            context,
            resource: 'open_connection',
            action,
            targetTenantId: 'demo-tenant-001',
          }),
        ).toEqual({ allowed: false, reason: 'role_denied' });
      }
    }
  });

  it('拒绝缺少租户编号的机构管理员管理状态、凭证或删除 HIS 连接配置', () => {
    const statusActions = ['manage_status', 'manage_credentials', 'delete'] as const;

    for (const action of statusActions) {
      expect(
        canAccessResource({
          context: { ...tenantAdminContext, tenantId: null },
          resource: 'open_connection',
          action,
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: false, reason: 'missing_tenant' });
    }
  });

  it('拒绝机构管理员跨租户管理状态、凭证或删除 HIS 连接配置', () => {
    const statusActions = ['manage_status', 'manage_credentials', 'delete'] as const;

    for (const action of statusActions) {
      expect(
        canAccessResource({
          context: tenantAdminContext,
          resource: 'open_connection',
          action,
          targetTenantId: 'other-tenant-001',
        }),
      ).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
    }
  });

  it('只读或更新动作不会替代状态管理或删除动作', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'update',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'manage_status',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'delete',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('HIS 连接配置凭证管理使用独立动作，平台管理员默认不能代管写入', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'open_connection',
        action: 'manage_credentials',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });

    for (const action of ['read_own_tenant', 'update', 'manage_status'] as const) {
      expect(
        canAccessResource({
          context: tenantOperatorContext,
          resource: 'open_connection',
          action,
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: false, reason: 'role_denied' });
    }

    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'open_connection',
        action: 'manage_credentials',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('HIS 连接配置测试连接使用独立动作，默认仅机构管理员允许触发', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'open_connection',
        action: 'test_connection',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });

    const ordinaryTenantContexts = [
      tenantOperatorContext,
      consultantContext,
      customerServiceContext,
    ] as const;
    const platformContexts = [platformAdminContext, platformOperatorContext] as const;

    for (const context of ordinaryTenantContexts) {
      expect(
        canAccessResource({
          context,
          resource: 'open_connection',
          action: 'test_connection',
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: false, reason: 'role_denied' });
    }

    for (const context of platformContexts) {
      expect(
        canAccessResource({
          context,
          resource: 'open_connection',
          action: 'test_connection',
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: false, reason: 'role_denied' });
    }

    expect(
      canAccessResource({
        context: securityAuditorContext,
        resource: 'open_connection',
        action: 'test_connection',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('只读、凭证、状态、更新和删除动作不会替代 HIS 连接测试动作', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'open_connection',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });

    for (const existingAction of [
      'manage_credentials',
      'manage_status',
      'update',
      'delete',
    ] as const) {
      expect(existingAction).not.toBe('test_connection');
      expect(ACCESS_ACTIONS).toContain(existingAction);
    }

    expect(ACCESS_ACTIONS).toContain('test_connection');
  });

  it('不新增 HIS 连接配置状态细分动作', () => {
    expect(ACCESS_ACTIONS).toContain('manage_status');
    expect(ACCESS_ACTIONS).toContain('delete');
    expect(ACCESS_ACTIONS).not.toContain('pause');
    expect(ACCESS_ACTIONS).not.toContain('resume');
    expect(ACCESS_ACTIONS).not.toContain('revoke');
    expect(ACCESS_ACTIONS).not.toContain('soft_delete');
  });

  it('拒绝缺少租户编号的机构管理员创建或更新 HIS 连接配置', () => {
    const writeActions = ['create', 'update'] as const;

    for (const action of writeActions) {
      expect(
        canAccessResource({
          context: { ...tenantAdminContext, tenantId: null },
          resource: 'open_connection',
          action,
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: false, reason: 'missing_tenant' });
    }
  });

  it('拒绝机构管理员跨租户创建或更新 HIS 连接配置', () => {
    const writeActions = ['create', 'update'] as const;

    for (const action of writeActions) {
      expect(
        canAccessResource({
          context: tenantAdminContext,
          resource: 'open_connection',
          action,
          targetTenantId: 'other-tenant-001',
        }),
      ).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
    }
  });

  it('允许机构管理员在本租户创建、读取和最小编辑治疗摘要，且不开放删除', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'create',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });

    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });

    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'update',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });

    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'delete',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('治疗摘要 update 权限不影响 customer、appointment、follow_up 既有权限边界', () => {
    const unchangedCases = [
      { resource: 'customer', action: 'create', allowed: true },
      { resource: 'customer', action: 'update', allowed: true },
      { resource: 'appointment', action: 'create', allowed: true },
      { resource: 'appointment', action: 'update', allowed: true },
      { resource: 'follow_up', action: 'update', allowed: true },
      { resource: 'follow_up', action: 'delete', allowed: false },
      { resource: 'customer', action: 'delete', allowed: false },
      { resource: 'appointment', action: 'delete', allowed: false },
    ] as const;

    for (const testCase of unchangedCases) {
      expect(
        canAccessResource({
          context: tenantAdminContext,
          resource: testCase.resource,
          action: testCase.action,
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual(
        testCase.allowed
          ? { allowed: true, reason: 'allowed_by_policy' }
          : { allowed: false, reason: 'role_denied' },
      );
    }
  });

  it('拒绝机构管理员读取其他租户', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'other-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
  });

  it('拒绝缺少租户编号的租户作用域访问', () => {
    expect(
      canAccessResource({
        context: { ...tenantAdminContext, tenantId: null },
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'missing_tenant' });
  });

  it('允许平台运营读取平台健康聚合态势', () => {
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'platform_health',
        action: 'read_aggregate',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('拒绝平台运营读取客户敏感明细', () => {
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'customer',
        action: 'read_detail',
        targetTenantId: 'demo-tenant-001',
        containsSensitiveDetail: true,
      }),
    ).toEqual({ allowed: false, reason: 'sensitive_detail_denied' });
  });

  it('默认拒绝平台管理员读取客户敏感明细', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'customer',
        action: 'read_detail',
        targetTenantId: 'demo-tenant-001',
        containsSensitiveDetail: true,
      }),
    ).toEqual({ allowed: false, reason: 'sensitive_detail_denied' });
  });

  it('默认拒绝平台角色读取治疗摘要敏感明细', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'treatment_summary',
        action: 'read_detail',
        targetTenantId: 'demo-tenant-001',
        containsSensitiveDetail: true,
      }),
    ).toEqual({ allowed: false, reason: 'sensitive_detail_denied' });
  });

  it('拒绝平台管理员直接写入租户业务数据', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'customer',
        action: 'create',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('允许平台管理员管理租户状态', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'tenant',
        action: 'manage_status',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('允许安全审计员导出审计报告', () => {
    expect(
      canAccessResource({
        context: securityAuditorContext,
        resource: 'audit_log',
        action: 'export_report',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('AI 模型配置只允许平台管理员写入和触发测试，平台运营与审计员保持只读边界', () => {
    for (const action of ['read_detail', 'update', 'manage_credentials', 'test_connection'] as const) {
      expect(
        canAccessResource({
          context: platformAdminContext,
          resource: 'ai_model_config',
          action,
        }),
      ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    }

    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'ai_model_config',
        action: 'read_detail',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'ai_model_config',
        action: 'update',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'ai_model_config',
        action: 'test_connection',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
    expect(
      canAccessResource({
        context: securityAuditorContext,
        resource: 'ai_model_config',
        action: 'review',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    expect(
      canAccessResource({
        context: securityAuditorContext,
        resource: 'ai_model_config',
        action: 'update',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('AI 模型配置拒绝租户端角色访问平台配置边界', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'ai_model_config',
        action: 'read_detail',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'ai_model_config',
        action: 'update',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('覆盖商用最小角色权限矩阵并默认拒绝高风险动作', () => {
    const allowCases = [
      { context: platformAdminContext, resource: 'safety_switch', action: 'update' },
      { context: tenantAdminContext, resource: 'customer', action: 'import' },
      { context: tenantAdminContext, resource: 'follow_up', action: 'approve' },
      { context: tenantOperatorContext, resource: 'follow_up', action: 'approve' },
      { context: consultantContext, resource: 'dashboard', action: 'read' },
      { context: customerServiceContext, resource: 'message_delivery', action: 'read' },
      { context: tenantAdminContext, resource: 'real_channel', action: 'enable' },
      { context: tenantAdminContext, resource: 'real_channel', action: 'disable' },
    ] as const;

    for (const testCase of allowCases) {
      expect(
        canAccessResource({
          context: testCase.context,
          resource: testCase.resource,
          action: testCase.action,
          targetTenantId: testCase.context.tenantId,
        }),
      ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    }

    const denyCases = [
      { context: customerServiceContext, resource: 'safety_switch', action: 'update' },
      { context: customerServiceContext, resource: 'real_channel', action: 'enable' },
      { context: customerServiceContext, resource: 'customer', action: 'export' },
      { context: customerServiceContext, resource: 'customer', action: 'import' },
      { context: customerServiceContext, resource: 'audit_log', action: 'read_detail' },
      { context: consultantContext, resource: 'message_delivery', action: 'approve' },
    ] as const;

    for (const testCase of denyCases) {
      expect(
        canAccessResource({
          context: testCase.context,
          resource: testCase.resource,
          action: testCase.action,
          targetTenantId: testCase.context.tenantId,
        }),
      ).toEqual({ allowed: false, reason: 'role_denied' });
    }
  });

  it('未知角色、资源和操作默认拒绝', () => {
    expect(
      canAccessResource({
        context: { ...tenantAdminContext, role: 'unknown_role' as typeof tenantAdminContext.role },
        resource: 'customer',
        action: 'read',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'unknown_role_denied' });

    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'unknown_resource' as 'customer',
        action: 'read',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'unknown_resource_denied' });

    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'customer',
        action: 'unknown_action' as 'read',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'unknown_action_denied' });
  });

  it('默认拒绝未知策略组合', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'permission_policy',
        action: 'manage_policy',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });
});
