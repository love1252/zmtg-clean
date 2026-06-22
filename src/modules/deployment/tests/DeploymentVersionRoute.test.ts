import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as versionGet } from '@/app/api/version/route';
import { getDeploymentVersion } from '@/modules/deployment/server/deployment-version';

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<Record<string, unknown>>;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('部署版本探针', () => {
  it('从部署环境变量返回 commit 和 buildAt', async () => {
    vi.stubEnv('ZMTG_DEPLOY_COMMIT', 'eeff904b5154b3fb720567be661082e941b4b842');
    vi.stubEnv('ZMTG_DEPLOY_BUILT_AT', '2026-06-23T00:16:00.000Z');

    const version = getDeploymentVersion();
    const response = await versionGet();
    const payload = await readJson(response);

    expect(version).toEqual({
      commit: 'eeff904b5154b3fb720567be661082e941b4b842',
      buildAt: '2026-06-23T00:16:00.000Z',
      source: 'env',
    });
    expect(response.status).toBe(200);
    expect(payload).toEqual(version);
  });

  it('没有部署变量时返回 unknown，避免误判三端一致', async () => {
    vi.stubEnv('ZMTG_DEPLOY_COMMIT', undefined);
    vi.stubEnv('ZMTG_DEPLOY_BUILT_AT', undefined);
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', undefined);
    vi.stubEnv('NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA', undefined);
    vi.stubEnv('SOURCE_VERSION', undefined);
    vi.stubEnv('GITHUB_SHA', undefined);

    const response = await versionGet();
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      commit: 'unknown',
      buildAt: 'unknown',
      source: 'unknown',
    });
  });

  it('没有部署变量时可以回退到构建期写入的 commit', () => {
    vi.stubEnv('ZMTG_DEPLOY_COMMIT', undefined);
    vi.stubEnv('ZMTG_DEPLOY_BUILT_AT', undefined);
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', undefined);
    vi.stubEnv('NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA', undefined);
    vi.stubEnv('SOURCE_VERSION', undefined);
    vi.stubEnv('GITHUB_SHA', undefined);
    vi.stubEnv('ZMTG_BUILD_COMMIT', '6135ebb-build-fallback');
    vi.stubEnv('ZMTG_BUILD_AT', '2026-06-23T00:20:00.000Z');

    expect(getDeploymentVersion()).toEqual({
      commit: '6135ebb-build-fallback',
      buildAt: '2026-06-23T00:20:00.000Z',
      source: 'build',
    });
  });
});
