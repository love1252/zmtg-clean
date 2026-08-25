import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateMocks = vi.hoisted(() => ({
  isInstitutionV11HospitalSyncEnabled: vi.fn(),
}));
const authorizationMocks = vi.hoisted(() => {
  const authorizeCurrentInstitutionNavigationV1 = vi.fn();
  const authorization = Object.freeze({
    authorizeCurrentInstitutionNavigationV1,
  });
  return {
    authorization,
    authorizeCurrentInstitutionNavigationV1,
    isInstitutionNavigationAuthorizationV1: vi.fn(),
    isInstitutionRequestAuthorizationV1: vi.fn(),
    resolveInstitutionServerAuthorizationV1: vi.fn(),
  };
});
const assetMocks = vi.hoisted(() => ({
  readApprovedPrototypeAsset: vi.fn(),
}));

vi.mock(
  '@/modules/institution-v11-preview/server/visual-preview-gate',
  () => gateMocks,
);
vi.mock(
  '@/modules/institution/server/institution-server-runtime',
  () => ({
    resolveInstitutionServerAuthorizationV1:
      authorizationMocks.resolveInstitutionServerAuthorizationV1,
  }),
);
vi.mock(
  '@/modules/security/server/institution-request-authorization',
  () => ({
    isInstitutionRequestAuthorizationV1:
      authorizationMocks.isInstitutionRequestAuthorizationV1,
  }),
);
vi.mock(
  '@/modules/security/server/institution-section-guard',
  () => ({
    isInstitutionNavigationAuthorizationV1:
      authorizationMocks.isInstitutionNavigationAuthorizationV1,
  }),
);
vi.mock(
  '@/modules/institution-v11-preview/server/approved-prototype-assets',
  () => assetMocks,
);

import { GET } from '@/app/hospital/institution-v1-1-approved/route';

describe('/hospital/institution-v1-1-approved', () => {
  beforeEach(() => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReset();
    authorizationMocks.authorizeCurrentInstitutionNavigationV1.mockReset();
    authorizationMocks.isInstitutionNavigationAuthorizationV1.mockReset();
    authorizationMocks.isInstitutionRequestAuthorizationV1.mockReset();
    authorizationMocks.resolveInstitutionServerAuthorizationV1.mockReset();
    assetMocks.readApprovedPrototypeAsset.mockReset();
    authorizationMocks.isInstitutionRequestAuthorizationV1.mockImplementation(
      (value: unknown) => value === authorizationMocks.authorization,
    );
    authorizationMocks.isInstitutionNavigationAuthorizationV1.mockImplementation(
      (value: unknown) =>
        value !== null &&
        typeof value === 'object' &&
        'kind' in value &&
        value.kind === 'institution_navigation_authorization',
    );
  });

  it('非本地开发环境直接保持 404，且不触碰授权和原型文件', async () => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(
      authorizationMocks.resolveInstitutionServerAuthorizationV1,
    ).not.toHaveBeenCalled();
    expect(assetMocks.readApprovedPrototypeAsset).not.toHaveBeenCalled();
  });

  it('机构工作台授权未通过时保持 404，且不读取 Approved 原型', async () => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReturnValue(true);
    authorizationMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValue(
      null,
    );

    const response = await GET();

    expect(response.status).toBe(404);
    expect(assetMocks.readApprovedPrototypeAsset).not.toHaveBeenCalled();
  });

  it('仅向已授权的本地医生端会话返回无缓存、不可联网的 Approved 界面', async () => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReturnValue(true);
    authorizationMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValue(
      authorizationMocks.authorization,
    );
    authorizationMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValue(
      Object.freeze({
        kind: 'institution_navigation_authorization',
        targetSectionId: 'workbench',
        targetAccess: 'allowed',
        availableSectionIds: Object.freeze(['workbench']),
      }),
    );
    assetMocks.readApprovedPrototypeAsset.mockResolvedValue({
      bytes: Buffer.from('<!doctype html><title>Approved</title>', 'utf8'),
      contentType: 'text/html; charset=utf-8',
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Approved</title>');
    expect(assetMocks.readApprovedPrototypeAsset).toHaveBeenCalledWith([
      'institution.html',
    ]);
    expect(
      authorizationMocks.authorizeCurrentInstitutionNavigationV1,
    ).toHaveBeenCalledWith({ targetSectionId: 'workbench' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "connect-src 'none'",
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'self'",
    );
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });
});
