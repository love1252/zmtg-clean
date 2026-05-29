import { describe, expect, it } from 'vitest';
import {
  auditEventCatalog,
  capabilityLifecycleGroups,
  governanceForbiddenTerms,
  openPlatformPermissions,
  platformRoleCatalog,
  tenantIsolationPrinciples,
} from '@/modules/open-platform/domain/governance';

describe('开放平台治理领域模型', () => {
  it('定义租户隔离原则，且不信任浏览器状态', () => {
    expect(tenantIsolationPrinciples).toHaveLength(4);
    expect(tenantIsolationPrinciples.map((item) => item.title)).toEqual([
      '服务端租户上下文',
      '平台聚合可观测',
      '机构租户最小权限',
      '敏感数据默认不可见',
    ]);
    expect(tenantIsolationPrinciples.map((item) => item.risk).join(' ')).not.toContain('localStorage');
  });

  it('保持角色权限显式且有边界', () => {
    expect(platformRoleCatalog.map((role) => role.id)).toEqual([
      'platform_super_admin',
      'platform_operator',
      'security_auditor',
      'tenant_admin',
    ]);

    expect(openPlatformPermissions).toContainEqual({
      roleId: 'platform_super_admin',
      resource: 'tenant',
      actions: ['read_aggregate', 'read_detail', 'manage_status'],
      boundary: '可管理租户运营状态，但第一阶段不能读取租户客户 PII。',
    });
    expect(openPlatformPermissions).toContainEqual({
      roleId: 'tenant_admin',
      resource: 'open_connection',
      actions: ['read_own_tenant'],
      boundary: '只能查看本租户开放连接态势，不能管理平台级策略。',
    });
  });

  it('定义 API Key、OAuth、Webhook 生命周期，但不包含真实密钥或回调能力', () => {
    expect(capabilityLifecycleGroups.map((group) => group.id)).toEqual(['api_key', 'oauth_app', 'webhook']);

    const apiKey = capabilityLifecycleGroups.find((group) => group.id === 'api_key');
    expect(apiKey?.states.map((state) => state.id)).toEqual(['draft', 'active', 'rotating', 'revoked']);
    expect(apiKey?.transitions).toContainEqual({ from: 'active', to: 'rotating', trigger: '轮换遮罩凭证预览' });

    const oauth = capabilityLifecycleGroups.find((group) => group.id === 'oauth_app');
    expect(oauth?.states.map((state) => state.id)).toEqual(['draft', 'configured', 'published', 'suspended']);

    const webhook = capabilityLifecycleGroups.find((group) => group.id === 'webhook');
    expect(webhook?.states.map((state) => state.id)).toEqual(['draft', 'enabled', 'degraded', 'disabled']);
    expect(webhook?.transitions).toContainEqual({ from: 'enabled', to: 'degraded', trigger: '投递健康低于策略阈值' });
  });

  it('定义审计事件词汇和必填字段', () => {
    expect(auditEventCatalog.map((event) => event.category)).toEqual([
      'tenant_boundary',
      'permission_policy',
      'connection_lifecycle',
      'security_review',
    ]);
    expect(auditEventCatalog[0].requiredFields).toEqual([
      'eventId',
      'actorId',
      'actorRole',
      'tenantScope',
      'resourceType',
      'resourceId',
      'action',
      'result',
      'occurredAt',
    ]);
  });

  it('第一阶段演示数据不包含真实凭证风险词', () => {
    const serialized = JSON.stringify({
      tenantIsolationPrinciples,
      platformRoleCatalog,
      openPlatformPermissions,
      capabilityLifecycleGroups,
      auditEventCatalog,
    }).toLowerCase();

    governanceForbiddenTerms.forEach((term) => {
      expect(serialized).not.toContain(term.toLowerCase());
    });
  });
});
