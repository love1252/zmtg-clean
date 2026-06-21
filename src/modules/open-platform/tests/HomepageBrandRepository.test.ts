import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createHomepageBrandRepository } from '@/modules/open-platform/server/homepage-brand-repository';

describe('首页与品牌 repository', () => {
  it('导出可创建的 repository 并覆盖 service 所需方法', () => {
    const repository = createHomepageBrandRepository({} as never);

    expect(repository).toEqual(
      expect.objectContaining({
        findConfig: expect.any(Function),
        upsertConfigDraft: expect.any(Function),
        listVersions: expect.any(Function),
        findVersion: expect.any(Function),
        createVersion: expect.any(Function),
        markConfigPublished: expect.any(Function),
        createAuditLog: expect.any(Function),
        listAuditLogs: expect.any(Function),
      }),
    );
  });

  it('只通过 schema 表读写首页品牌数据且不读取环境变量', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/open-platform/server/homepage-brand-repository.ts'),
      'utf8',
    );

    expect(source).toContain('homepageBrandConfigs');
    expect(source).toContain('homepageBrandConfigVersions');
    expect(source).toContain('homepageBrandAssets');
    expect(source).toContain('homepageBrandAuditLogs');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('.env');
  });
});
