import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as schema from '@/server/db/schema';

describe('首页与品牌第二阶段数据结构', () => {
  it('导出配置、版本、素材和审计表', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;

    expect(schemaModule.homepageBrandConfigs).toBeDefined();
    expect(schemaModule.homepageBrandConfigVersions).toBeDefined();
    expect(schemaModule.homepageBrandAssets).toBeDefined();
    expect(schemaModule.homepageBrandAuditLogs).toBeDefined();
  });

  it('导出配置状态、素材类型和审计动作枚举', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const statusEnum = schemaModule.homepageBrandConfigStatusEnum as { enumValues?: string[] } | undefined;
    const assetKindEnum = schemaModule.homepageBrandAssetKindEnum as { enumValues?: string[] } | undefined;
    const auditActionEnum = schemaModule.homepageBrandAuditActionEnum as { enumValues?: string[] } | undefined;

    expect(statusEnum?.enumValues).toEqual(['draft', 'published', 'archived']);
    expect(assetKindEnum?.enumValues).toEqual(['logo', 'night_logo', 'mark_logo', 'hero_background', 'share_image']);
    expect(auditActionEnum?.enumValues).toEqual(['save_draft', 'upload_asset', 'publish', 'rollback']);
  });

  it('migration 文件创建表并登记到 journal', () => {
    const root = process.cwd();
    const migration = fs.readFileSync(
      path.join(root, 'drizzle/0018_homepage_brand_phase2_runtime.sql'),
      'utf8',
    );
    const journal = JSON.parse(fs.readFileSync(path.join(root, 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries?: Array<{ idx: number; tag: string; breakpoints: boolean }>;
    };

    expect(migration).toContain('CREATE TYPE "homepage_brand_config_status"');
    expect(migration).toContain('CREATE TABLE "homepage_brand_configs"');
    expect(migration).toContain('CREATE TABLE "homepage_brand_config_versions"');
    expect(migration).toContain('CREATE TABLE "homepage_brand_assets"');
    expect(migration).toContain('CREATE TABLE "homepage_brand_audit_logs"');
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 18,
          tag: '0018_homepage_brand_phase2_runtime',
          breakpoints: true,
        }),
      ]),
    );
  });
});
