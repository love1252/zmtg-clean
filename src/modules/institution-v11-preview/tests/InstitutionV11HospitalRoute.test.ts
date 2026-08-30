import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateMocks = vi.hoisted(() => ({
  isInstitutionV11HospitalSyncEnabled: vi.fn(),
}));
const contextMocks = vi.hoisted(() => ({
  resolveApprovedPrototypeRuntimeContextV1: vi.fn(),
}));
const assetMocks = vi.hoisted(() => ({
  readApprovedPrototypeAsset: vi.fn(),
}));

vi.mock(
  '@/modules/institution-v11-preview/server/visual-preview-gate',
  () => gateMocks,
);
vi.mock(
  '@/modules/institution-v11-preview/server/approved-prototype-runtime-context',
  () => contextMocks,
);
vi.mock(
  '@/modules/institution-v11-preview/server/approved-prototype-assets',
  () => assetMocks,
);

import { GET } from '@/app/hospital/institution-v1-1-approved/route';

describe('/hospital/institution-v1-1-approved', () => {
  beforeEach(() => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReset();
    contextMocks.resolveApprovedPrototypeRuntimeContextV1.mockReset();
    assetMocks.readApprovedPrototypeAsset.mockReset();
  });

  it('非本地开发环境直接保持 404，且不触碰授权和原型文件', async () => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(
      contextMocks.resolveApprovedPrototypeRuntimeContextV1,
    ).not.toHaveBeenCalled();
    expect(assetMocks.readApprovedPrototypeAsset).not.toHaveBeenCalled();
  });

  it('机构工作台授权未通过时保持 404，且不读取 Approved 原型', async () => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReturnValue(true);
    contextMocks.resolveApprovedPrototypeRuntimeContextV1.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(assetMocks.readApprovedPrototypeAsset).not.toHaveBeenCalled();
  });

  it('仅向已授权的本地机构端会话返回无缓存、仅可同源请求的 Approved 界面', async () => {
    gateMocks.isInstitutionV11HospitalSyncEnabled.mockReturnValue(true);
    const runtimeContext = Object.freeze({
      tenantId: 'tenant-1',
      institutionId: 'institution-1',
      institutionName: '澄星医疗美容',
    });
    contextMocks.resolveApprovedPrototypeRuntimeContextV1.mockResolvedValue(
      runtimeContext,
    );
    assetMocks.readApprovedPrototypeAsset.mockResolvedValue(
      Object.freeze({
        bytes: Buffer.from('<!doctype html><title>Approved</title>', 'utf8'),
        contentType: 'text/html; charset=utf-8',
      }),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Approved</title>');
    expect(assetMocks.readApprovedPrototypeAsset).toHaveBeenCalledWith(
      ['institution.html'],
      undefined,
      runtimeContext,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "connect-src 'self'",
    );
    expect(response.headers.get('content-security-policy')).not.toContain(
      'https:',
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'self'",
    );
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });
});
