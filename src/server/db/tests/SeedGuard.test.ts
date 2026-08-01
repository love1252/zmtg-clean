import { describe, expect, it, vi } from 'vitest';

import { demoSeedDatabaseWriteDisabledMessage, runSeed } from '@/server/db/seed-demo-data';
import { assertDemoSeedAllowed } from '@/server/db/seed-guard';

function localSeedEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    ZMTG_DEMO_SEED_TARGET: 'local',
    ZMTG_DEMO_SEED_CONFIRMATION: 'SEED_LOCAL_DEMO',
    DATABASE_URL: 'postgres://seed-user:seed-password@localhost:5432/zmtg_demo',
    ...overrides,
  };
}

describe('demo seed guard', () => {
  it('production 或 staging 环境一律拒绝，即使提供旧放行变量', () => {
    expect(() =>
      assertDemoSeedAllowed(
        localSeedEnv({ NODE_ENV: 'production', ZMTG_ENABLE_DEMO_SEED: 'true' }),
      ),
    ).toThrow('production/staging');
    expect(() =>
      assertDemoSeedAllowed(localSeedEnv({ ZMTG_ENV: 'staging' })),
    ).toThrow('production/staging');
    expect(() =>
      assertDemoSeedAllowed(localSeedEnv({ VERCEL_ENV: 'preview' })),
    ).toThrow('production/staging');
    expect(() => assertDemoSeedAllowed(localSeedEnv({ NODE_ENV: 'test' }))).toThrow(
      'production/staging',
    );
  });

  it('非 localhost 数据库拒绝', () => {
    expect(() =>
      assertDemoSeedAllowed({
        ...localSeedEnv(),
        DATABASE_URL: 'postgres://user:password@cloud.example/zmtg_demo',
      }),
    ).toThrow('loopback');
  });

  it('缺显式 target 或 local/demo confirmation 时拒绝', () => {
    expect(() =>
      assertDemoSeedAllowed(localSeedEnv({ ZMTG_DEMO_SEED_TARGET: undefined })),
    ).toThrow('TARGET');
    expect(() =>
      assertDemoSeedAllowed(localSeedEnv({ ZMTG_DEMO_SEED_CONFIRMATION: undefined })),
    ).toThrow('人工确认');
    expect(() =>
      assertDemoSeedAllowed(localSeedEnv({ ZMTG_DEMO_SEED_CONFIRMATION: 'WRONG' })),
    ).toThrow('人工确认');
  });

  it('local demo 数据库和显式 confirmation 允许', () => {
    expect(assertDemoSeedAllowed(localSeedEnv())).toMatchObject({
      target: 'local',
      host: 'localhost',
      database: 'zmtg_demo',
    });
    expect(
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: 'postgres://user:password@[::1]/zmtg_demo' }),
      ).host,
    ).toBe('::1');
  });

  it('生产或 staging 标记的数据库名拒绝', () => {
    expect(() =>
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: 'postgres://user:password@localhost/zmtg_production' }),
      ),
    ).toThrow('数据库名');
    expect(() =>
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: 'postgres://user:password@localhost/zmtg_staging' }),
      ),
    ).toThrow('数据库名');
    expect(() =>
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: 'postgres://user:password@localhost/prodbackup_demo' }),
      ),
    ).toThrow('数据库名');
    expect(() =>
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: 'postgres://user:password@localhost/myproduction_demo' }),
      ),
    ).toThrow('数据库名');
    expect(() =>
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: 'postgres://user:password@localhost/stagecopy_demo' }),
      ),
    ).toThrow('数据库名');
    expect(() =>
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: 'postgres://user:password@localhost/mystaging_demo' }),
      ),
    ).toThrow('数据库名');
  });

  it('拒绝日志不包含 DATABASE_URL 密码', () => {
    const password = 'seed-guard-secret-password';
    let message = '';
    try {
      assertDemoSeedAllowed(
        localSeedEnv({ DATABASE_URL: `postgres://user:${password}@cloud.example/zmtg_demo` }),
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain(password);
  });

  it('任意环境的 runSeed 均固定关闭且不会创建数据库 client', async () => {
    const createClient = vi.fn();
    const dependencies = {
      createPostgresClient: createClient,
      createDatabase: vi.fn(),
      seedDemoData: vi.fn(),
    } as unknown as NonNullable<Parameters<typeof runSeed>[1]>;

    await expect(runSeed(localSeedEnv(), dependencies)).rejects.toThrow(
      demoSeedDatabaseWriteDisabledMessage,
    );
    await expect(runSeed(localSeedEnv({ NODE_ENV: 'test' }), dependencies)).rejects.toThrow(
      demoSeedDatabaseWriteDisabledMessage,
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(dependencies.createDatabase).not.toHaveBeenCalled();
    expect(dependencies.seedDemoData).not.toHaveBeenCalled();
  });
});
