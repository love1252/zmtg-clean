import { describe, expect, it } from 'vitest';
import { DEMO_SESSION_COOKIE, encodeDemoSession } from '@/modules/auth/server/demo-session';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

function requestWithSession(sessionValue: string) {
  return new Request('http://localhost/api/example', {
    headers: {
      cookie: `${DEMO_SESSION_COOKIE}=${sessionValue}`,
    },
  });
}

function unsignedSession(session: unknown) {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

describe('访问上下文', () => {
  it('把机构管理员演示会话转换为租户访问上下文', () => {
    const session = encodeDemoSession({
      user: {
        id: 'demo-user-admin',
        username: 'admin',
        name: '系统管理员',
        role: 'tenant_admin',
        tenantId: 'demo-tenant-001',
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toEqual({
      userId: 'demo-user-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-a',
      source: 'demo_session',
    });
  });

  it('把平台管理员演示会话转换为平台访问上下文', () => {
    const session = encodeDemoSession({
      user: {
        id: 'demo-user-platform',
        username: 'platform',
        name: '超级管理员',
        role: 'platform_admin',
        tenantId: null,
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toEqual({
      userId: 'demo-user-platform',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
      source: 'demo_session',
    });
  });

  it('把安全审计员演示会话转换为平台访问上下文', () => {
    const session = encodeDemoSession({
      user: {
        id: 'demo-user-auditor',
        username: 'auditor',
        name: '安全审计员',
        role: 'security_auditor',
        tenantId: null,
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toEqual({
      userId: 'demo-user-auditor',
      role: 'security_auditor',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
      source: 'demo_session',
    });
  });

  it('请求没有有效会话时返回空值', () => {
    expect(getDemoAccessContextFromRequest(new Request('http://localhost/api/example'))).toBeNull();
  });

  it('拒绝伪造的未签名演示会话 cookie', () => {
    const forged = unsignedSession({
      user: {
        id: 'forged-platform-user',
        username: 'forged',
        name: '伪造平台管理员',
        role: 'platform_admin',
        tenantId: null,
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(forged))).toBeNull();
  });

  it('请求会话已过期时返回空值', () => {
    const session = encodeDemoSession({
      user: {
        id: 'expired-user',
        username: 'expired',
        name: '过期用户',
        role: 'tenant_admin',
        tenantId: 'demo-tenant-001',
      },
      expiresAt: Date.now() - 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toBeNull();
  });

  it('租户角色没有租户编号时返回空值', () => {
    const session = encodeDemoSession({
      user: {
        id: 'bad-tenant-user',
        username: 'bad',
        name: '错误租户用户',
        role: 'tenant_admin',
        tenantId: null,
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toBeNull();
  });
});
