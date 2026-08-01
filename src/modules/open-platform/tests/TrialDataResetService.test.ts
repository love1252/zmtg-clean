import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  getTrialDataOverview: vi.fn(),
}));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock(
  '@/modules/open-platform/server/trial-data-reset-service',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/open-platform/server/trial-data-reset-service')
      >();
    return {
      ...actual,
      getTrialDataOverview: routeMocks.getTrialDataOverview,
    };
  },
);

import {
  resetTrialData,
  trialDataResetDisabledErrorCode,
  type TrialDataOverview,
  type TrialDataResetInput,
} from '@/modules/open-platform/server/trial-data-reset-service';
import {
  GET,
  POST,
} from '@/app/api/v1/open-platform/trial-data-reset/route';

const platformContext = {
  userId: 'platform-admin',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  institutionId: null,
  source: 'demo_session',
} satisfies AccessContext;

const tenantContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  source: 'demo_session',
} satisfies AccessContext;

const overview: TrialDataOverview = {
  tenantCount: 6,
  customerCount: 9,
  appointmentCount: 3,
  treatmentSummaryCount: 5,
  followUpTaskCount: 4,
  commercialRecordCount: 12,
  auditEventCount: 15,
};

const resetInput: TrialDataResetInput = {
  auditEvent: {
    eventId: 'audit-event-reset',
    actorId: 'demo-user-platform',
    actorRole: 'platform_admin',
    tenantId: null,
    scope: 'platform',
    resource: 'tenant',
    action: 'manage_status',
    result: 'transitioned',
    reason: 'manual_review_required',
    occurredAt: '2026-06-26T14:00:00.000Z',
    source: 'demo_session',
  },
};

function postRequest(json = vi.fn()) {
  return {
    json,
  } as unknown as Request;
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue({ database: 'overview-db' });
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.getTrialDataOverview.mockReset();
  routeMocks.getTrialDataOverview.mockResolvedValue(overview);
});

describe('体验数据重置关闭态', () => {
  it('保留只读概览类型契约', () => {
    expect(overview).toMatchObject({
      tenantCount: 6,
      customerCount: 9,
      appointmentCount: 3,
    });
  });

  it('直接调用 resetTrialData 固定关闭且不触碰传入 database 或 input', async () => {
    const databaseAccess = vi.fn();
    const inputAccess = vi.fn();
    const database = new Proxy(
      {},
      {
        get(_target, property) {
          databaseAccess(property);
          throw new Error('database_must_not_be_used');
        },
      },
    );
    const input = new Proxy(resetInput, {
      get(target, property, receiver) {
        inputAccess(property);
        return Reflect.get(target, property, receiver);
      },
    });

    await expect(
      resetTrialData(
        database as Parameters<typeof resetTrialData>[0],
        input,
      ),
    ).resolves.toEqual({
      status: 'capability_disabled',
      errorCode: trialDataResetDisabledErrorCode,
    });
    await expect(
      resetTrialData(
        database as Parameters<typeof resetTrialData>[0],
        input,
      ),
    ).resolves.toEqual({
      status: 'capability_disabled',
      errorCode: trialDataResetDisabledErrorCode,
    });

    expect(databaseAccess).not.toHaveBeenCalled();
    expect(inputAccess).not.toHaveBeenCalled();
  });

  it('GET 平台概览保持只读可用', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await GET(new Request('http://localhost/api/v1/open-platform/trial-data-reset'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, overview });
    expect(routeMocks.getDatabase).toHaveBeenCalledOnce();
    expect(routeMocks.getTrialDataOverview).toHaveBeenCalledOnce();
  });

  it.each([
    ['未认证', null, 401, 'UNAUTHORIZED'],
    ['非平台 scope', tenantContext, 403, 'FORBIDDEN'],
  ] as const)('%s GET 在取得数据库前拒绝', async (
    _label,
    context,
    status,
    errorCode,
  ) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(context);

    const response = await GET(new Request('http://localhost/api/v1/open-platform/trial-data-reset'));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ ok: false, errorCode });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.getTrialDataOverview).not.toHaveBeenCalled();
  });

  it('GET 概览异常继续返回固定低敏错误', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.getTrialDataOverview.mockRejectedValue(new Error('private database detail'));

    const response = await GET(new Request('http://localhost/api/v1/open-platform/trial-data-reset'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errorCode: 'TRIAL_DATA_OVERVIEW_UNAVAILABLE',
    });
  });

  it.each([
    ['未认证', null, 401, 'UNAUTHORIZED'],
    ['非平台 scope', tenantContext, 403, 'FORBIDDEN'],
  ] as const)('%s POST 在读取 body 和数据库前拒绝', async (
    _label,
    context,
    status,
    errorCode,
  ) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(context);
    const json = vi.fn().mockRejectedValue(new Error('body_must_not_be_read'));

    const response = await POST(postRequest(json));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ ok: false, errorCode });
    expect(json).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.getTrialDataOverview).not.toHaveBeenCalled();
  });

  it.each([
    ['确认请求', vi.fn().mockResolvedValue({ confirm: 'RESET' })],
    ['无效 JSON', vi.fn().mockRejectedValue(new Error('private body detail'))],
    ['缺少确认', vi.fn().mockResolvedValue({})],
  ])('平台 POST（%s）固定关闭且不读取 body、不取得数据库', async (
    _label,
    json,
  ) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await POST(postRequest(json));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errorCode: trialDataResetDisabledErrorCode,
    });
    expect(json).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.getTrialDataOverview).not.toHaveBeenCalled();
  });
});
