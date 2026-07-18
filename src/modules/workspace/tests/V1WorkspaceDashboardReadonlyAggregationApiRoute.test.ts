import { describe, expect, it } from 'vitest';
import * as workspaceDashboardRoute from '@/app/api/v1/workspace-dashboard/readonly-aggregation/route';

const routeUrl = 'http://localhost/api/v1/workspace-dashboard/readonly-aggregation';

describe('V1 workspace dashboard readonly aggregation API route', () => {
  it('route 存在且只暴露只读 GET', () => {
    expect(workspaceDashboardRoute.GET).toEqual(expect.any(Function));
    expect(Object.keys(workspaceDashboardRoute).sort()).toEqual(['GET']);
  });

  it('GET 固定返回 capability disabled 且禁止缓存', async () => {
    const response = workspaceDashboardRoute.GET(new Request(routeUrl));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      code: 'capability_disabled',
      error: '工作台聚合能力暂未启用。',
    });
  });

  it('不读取敌意 Request，也不返回 demo 聚合或请求内容', async () => {
    const hostileRequest = new Proxy({} as Request, {
      get() {
        throw new Error('request must not be inspected');
      },
    });
    const response = workspaceDashboardRoute.GET(hostileRequest);
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(503);
    expect(serialized).not.toMatch(/demo|mock|seed|tenant|institution|workspace|customer/i);
  });
});
