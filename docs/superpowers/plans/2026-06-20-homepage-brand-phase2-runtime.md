# 首页与品牌第二阶段 Runtime 实施计划

> **面向智能体执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项执行。本计划使用复选框跟踪。当前用户已明确批准第二阶段 runtime 范围：允许修改 `src/**`、新增或修改数据库 schema、创建 migration、实现 API、repository、service、文件上传、真实首页配置接入、发布、回滚和审计；仍禁止读取 `.env/.env.local`，禁止运行 migration，禁止提交、推送、创建 PR，除非后续明确批准。

**目标：** 将「首页与品牌」从前端临时编辑器升级为真实可保存、可上传、可预览、可发布、可回滚、可审计的首页与品牌管理系统，并确保管理端预览与真实首页渲染一致。

**架构：** 第二阶段采用「配置版本系统」。管理端编辑草稿配置，真实首页只读取已发布配置；发布生成版本快照，回滚把历史版本重新发布；素材上传生成可引用资产；所有保存、上传、发布、回滚动作写低敏审计。真实首页和管理端草稿预览共用同一套配置类型和渲染输入，避免第一阶段 mock 预览与真实首页漂移。

**技术栈：** Next.js、React、TypeScript、Drizzle、PostgreSQL、Vitest、Testing Library、本地文件存储。

---

## 文件结构

- 新增 `src/modules/marketing/domain/homepageBrandConfig.ts`：首页与品牌配置类型、默认配置、校验、深拷贝与版本摘要。
- 新增 `src/modules/marketing/components/MarketingHomeRenderer.tsx`：真实首页渲染组件，接收配置对象；管理端预览和真实首页共用。
- 修改 `src/modules/marketing/components/MarketingHome.tsx`：从默认已发布配置渲染，后续接入服务端读取。
- 修改 `src/modules/marketing/tests/MarketingHome.test.tsx`：覆盖默认配置与首页文案、导航、按钮一致。
- 修改 `src/server/db/schema.ts`：新增首页品牌配置、版本、素材、审计相关表与枚举。
- 新增 `drizzle/0018_homepage_brand_phase2_runtime.sql`：第二阶段 schema migration 文件；只创建，不运行。
- 修改 `drizzle/meta/_journal.json`：登记 migration；如项目要求快照，后续用 Drizzle 工具生成或人工补齐，但不得运行 migration。
- 新增 `src/modules/open-platform/server/homepage-brand-repository.ts`：数据库读写边界。
- 新增 `src/modules/open-platform/server/homepage-brand-service.ts`：业务动作：读取、保存草稿、发布、回滚、审计。
- 新增 `src/modules/open-platform/server/homepage-brand-asset-storage.ts`：本地素材存储，限制路径、大小、类型。
- 新增 API：
  - `src/app/api/v1/open-platform/homepage-brand/route.ts`
  - `src/app/api/v1/open-platform/homepage-brand/draft/route.ts`
  - `src/app/api/v1/open-platform/homepage-brand/publish/route.ts`
  - `src/app/api/v1/open-platform/homepage-brand/rollback/route.ts`
  - `src/app/api/v1/open-platform/homepage-brand/assets/route.ts`
  - `src/app/api/v1/open-platform/homepage-brand/versions/route.ts`
- 修改 `src/modules/open-platform/components/HomepageBrandPanel.tsx`：由本地临时状态升级为 API 驱动草稿编辑、上传、发布、回滚、审计视图。
- 新增和修改测试：
  - `src/modules/open-platform/tests/HomepageBrandConfig.test.ts`
  - `src/modules/open-platform/tests/HomepageBrandSchema.test.ts`
  - `src/modules/open-platform/tests/HomepageBrandService.test.ts`
  - `src/modules/open-platform/tests/HomepageBrandApiRoute.test.ts`
  - `src/modules/open-platform/tests/HomepageBrandAssetStorage.test.ts`
  - `src/modules/open-platform/tests/HomepageBrandPanel.test.tsx`

---

## 任务 1：抽离首页配置类型与默认配置

**文件：**
- 新增：`src/modules/marketing/domain/homepageBrandConfig.ts`
- 修改：`src/modules/marketing/components/MarketingHome.tsx`
- 新增测试：`src/modules/open-platform/tests/HomepageBrandConfig.test.ts`

- [ ] **步骤 1：写失败测试**

在 `src/modules/open-platform/tests/HomepageBrandConfig.test.ts` 新增测试，锁定真实首页默认文案、导航和按钮：

```ts
import { describe, expect, it } from 'vitest';
import {
  defaultHomepageBrandConfig,
  validateHomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';

describe('首页与品牌默认配置', () => {
  it('默认配置与当前真实首页首屏文案一致', () => {
    expect(defaultHomepageBrandConfig.hero.eyebrow).toBe('智美天工 · 医美 AI 增长操作系统');
    expect(defaultHomepageBrandConfig.hero.titleLine).toBe('让医美经营');
    expect(defaultHomepageBrandConfig.hero.accentLine).toBe('更懂每位客户');
    expect(defaultHomepageBrandConfig.hero.description).toContain('让咨询师从处理消息，升级为经营长期客户关系');
    expect(defaultHomepageBrandConfig.hero.note).toContain('先让增长动作持续发生');
    expect(defaultHomepageBrandConfig.hero.primaryAction.label).toBe('预约增长诊断 →');
    expect(defaultHomepageBrandConfig.hero.primaryAction.href).toBe('/login');
    expect(defaultHomepageBrandConfig.hero.secondaryAction.href).toBe('#journey');
  });

  it('默认导航区分普通链接和行动按钮', () => {
    expect(defaultHomepageBrandConfig.navigation.links.map((item) => item.href)).toEqual([
      '#diagnosis',
      '#agents',
      '#journey',
      '#cases',
    ]);
    expect(defaultHomepageBrandConfig.navigation.cta.href).toBe('/login');
    expect(defaultHomepageBrandConfig.navigation.cta.label).toBe('预约演示');
  });

  it('默认配置可以通过校验', () => {
    expect(validateHomepageBrandConfig(defaultHomepageBrandConfig)).toEqual([]);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandConfig.test.ts
```

预期：失败，提示找不到 `homepageBrandConfig` 模块。

- [ ] **步骤 3：实现配置类型与默认配置**

在 `src/modules/marketing/domain/homepageBrandConfig.ts` 新增：

```ts
export type HomepageBrandAction = {
  label: string;
  href: string;
};

export type HomepageBrandNavigationLink = {
  id: string;
  label: string;
  href: string;
  visible: boolean;
};

export type HomepageBrandAssetConfig = {
  horizontalLogoUrl: string;
  horizontalLogoNightUrl: string;
  markLogoUrl: string;
  heroBackgroundUrl: string;
  shareImageUrl: string;
};

export type HomepageBrandConfig = {
  brand: {
    platformName: string;
    consoleName: string;
    subtitle: string;
  };
  metadata: {
    title: string;
    description: string;
    shareTitle: string;
    shareDescription: string;
  };
  assets: HomepageBrandAssetConfig;
  navigation: {
    links: HomepageBrandNavigationLink[];
    cta: HomepageBrandAction;
  };
  hero: {
    eyebrow: string;
    titleLine: string;
    accentLine: string;
    description: string;
    note: string;
    primaryAction: HomepageBrandAction;
    secondaryAction: HomepageBrandAction;
  };
  metrics: Array<{ id: string; value: string; label: string; visible: boolean }>;
  growthCard: {
    title: string;
    subtitle: string;
    badge: string;
    rows: Array<{ id: string; label: string; value: string; percent: number; tone: 'blue' | 'teal' | 'rose' | 'gold' }>;
    insight: {
      eyebrow: string;
      title: string;
      confidence: string;
      description: string;
      chips: string[];
    };
  };
};

export const defaultHomepageBrandConfig: HomepageBrandConfig = {
  brand: {
    platformName: '智美天工',
    consoleName: '智美天工管理后台',
    subtitle: '平台控制台',
  },
  metadata: {
    title: '智美天工 | AI智能运营中台',
    description: '服务医美机构的 AI 智能运营中台。',
    shareTitle: '智美天工',
    shareDescription: '医美增长操作系统',
  },
  assets: {
    horizontalLogoUrl: '/brand/zmtg-logo-horizontal-luxury-clean.png',
    horizontalLogoNightUrl: '/brand/zmtg-logo-horizontal-night-clean.png',
    markLogoUrl: '/brand/logo-mark.png',
    heroBackgroundUrl: '/homepage/zmtg-luxury-clinic-bg.png',
    shareImageUrl: '/homepage/zmtg-luxury-clinic-bg.png',
  },
  navigation: {
    links: [
      { id: 'diagnosis', label: '增长诊断', href: '#diagnosis', visible: true },
      { id: 'agents', label: '智能体方案', href: '#agents', visible: true },
      { id: 'journey', label: '客户旅程', href: '#journey', visible: true },
      { id: 'cases', label: '案例数据', href: '#cases', visible: true },
    ],
    cta: { label: '预约演示', href: '/login' },
  },
  hero: {
    eyebrow: '智美天工 · 医美 AI 增长操作系统',
    titleLine: '让医美经营',
    accentLine: '更懂每位客户',
    description: '用 AI 智能体识别高意向客户、推荐跟进节奏、编排术后关怀与复购召回，让咨询师从处理消息，升级为经营长期客户关系。',
    note: '7 天跑通核心旅程：新客咨询、到院提醒、术后关怀、复购召回，先让增长动作持续发生。',
    primaryAction: { label: '预约增长诊断 →', href: '/login' },
    secondaryAction: { label: '查看客户旅程', href: '#journey' },
  },
  metrics: [
    { id: 'repurchase', value: '35%', label: '复购率提升案例', visible: true },
    { id: 'response', value: '2.4x', label: '咨询响应效率', visible: true },
    { id: 'alwaysOn', value: '7×24', label: '智能体持续接待', visible: true },
    { id: 'journeySteps', value: '4步', label: '上线核心旅程', visible: true },
  ],
  growthCard: {
    title: '今日增长机会',
    subtitle: 'AI 已为咨询团队排好优先级',
    badge: '运行中',
    rows: [
      { id: 'newConsults', label: '新增咨询', value: '1,284', percent: 92, tone: 'blue' },
      { id: 'aiHandled', label: 'AI 已承接', value: '916', percent: 74, tone: 'teal' },
      { id: 'manualHandoff', label: '高意向转人工', value: '216', percent: 48, tone: 'rose' },
      { id: 'appointments', label: '预约到院', value: '88', percent: 34, tone: 'gold' },
    ],
    insight: {
      eyebrow: '下一步建议',
      title: '优先承接 18 位复购窗口客户',
      confidence: '92%匹配',
      description: '她们处于术后第 21-30 天，近期咨询补水与修复项目，建议由资深咨询师人工跟进。',
      chips: ['高意向', '复购窗口', '需人工承接'],
    },
  },
};

const allowedHrefs = new Set(['/login', '#diagnosis', '#agents', '#journey', '#cases']);

export function cloneHomepageBrandConfig(config: HomepageBrandConfig): HomepageBrandConfig {
  return JSON.parse(JSON.stringify(config)) as HomepageBrandConfig;
}

export function validateHomepageBrandConfig(config: HomepageBrandConfig) {
  const errors: string[] = [];
  if (!config.brand.platformName.trim()) errors.push('平台名称不能为空');
  if (!config.metadata.title.trim()) errors.push('首页标题不能为空');
  if (!config.hero.titleLine.trim()) errors.push('首页主标题不能为空');
  if (!config.hero.accentLine.trim()) errors.push('首页强调标题不能为空');
  if (!config.hero.primaryAction.label.trim() || !config.hero.secondaryAction.label.trim()) errors.push('首页按钮文字不能为空');
  for (const link of config.navigation.links) {
    if (!link.label.trim()) errors.push('导航名称不能为空');
    if (!allowedHrefs.has(link.href)) errors.push(`导航地址不在白名单：${link.href}`);
  }
  if (!allowedHrefs.has(config.navigation.cta.href)) errors.push(`行动按钮地址不在白名单：${config.navigation.cta.href}`);
  if (!allowedHrefs.has(config.hero.primaryAction.href)) errors.push(`主按钮地址不在白名单：${config.hero.primaryAction.href}`);
  if (!allowedHrefs.has(config.hero.secondaryAction.href)) errors.push(`辅助按钮地址不在白名单：${config.hero.secondaryAction.href}`);
  return errors;
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandConfig.test.ts
```

预期：通过。

---

## 任务 2：创建第二阶段 schema 与 migration

**文件：**
- 修改：`src/server/db/schema.ts`
- 新增：`drizzle/0018_homepage_brand_phase2_runtime.sql`
- 修改：`drizzle/meta/_journal.json`
- 新增测试：`src/modules/open-platform/tests/HomepageBrandSchema.test.ts`

- [ ] **步骤 1：写失败测试**

在 `src/modules/open-platform/tests/HomepageBrandSchema.test.ts` 新增：

```ts
import { describe, expect, it } from 'vitest';
import {
  homepageBrandAssets,
  homepageBrandAuditLogs,
  homepageBrandConfigs,
  homepageBrandVersions,
} from '@/server/db/schema';

describe('首页与品牌第二阶段 schema', () => {
  it('导出配置、素材、版本和审计表', () => {
    expect(homepageBrandConfigs).toBeDefined();
    expect(homepageBrandAssets).toBeDefined();
    expect(homepageBrandVersions).toBeDefined();
    expect(homepageBrandAuditLogs).toBeDefined();
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandSchema.test.ts
```

预期：失败，提示 schema 未导出这些表。

- [ ] **步骤 3：修改 schema**

在 `src/server/db/schema.ts` 中新增枚举：

```ts
export const homepageBrandConfigStatusEnum = pgEnum('homepage_brand_config_status', [
  'draft',
  'published',
  'archived',
]);

export const homepageBrandAssetKindEnum = pgEnum('homepage_brand_asset_kind', [
  'horizontal_logo',
  'horizontal_logo_night',
  'mark_logo',
  'hero_background',
  'share_image',
]);

export const homepageBrandAuditActionEnum = pgEnum('homepage_brand_audit_action', [
  'draft_saved',
  'asset_uploaded',
  'published',
  'rolled_back',
]);
```

新增表：

```ts
export const homepageBrandConfigs = pgTable(
  'homepage_brand_configs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    status: homepageBrandConfigStatusEnum('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    publishedVersionId: varchar('published_version_id', { length: 64 }),
    updatedBy: varchar('updated_by', { length: 128 }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusIdx: index('homepage_brand_configs_status_idx').on(table.status),
    updatedAtIdx: index('homepage_brand_configs_updated_at_idx').on(table.updatedAt),
  }),
);

export const homepageBrandAssets = pgTable(
  'homepage_brand_assets',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    kind: homepageBrandAssetKindEnum('kind').notNull(),
    fileName: varchar('file_name', { length: 240 }).notNull(),
    contentType: varchar('content_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    publicUrl: varchar('public_url', { length: 512 }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    uploadedBy: varchar('uploaded_by', { length: 128 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    kindIdx: index('homepage_brand_assets_kind_idx').on(table.kind),
    shaIdx: index('homepage_brand_assets_sha_idx').on(table.sha256),
  }),
);

export const homepageBrandVersions = pgTable(
  'homepage_brand_versions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    version: integer('version').notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    summary: text('summary').notNull(),
    publishedBy: varchar('published_by', { length: 128 }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    versionUniqueIdx: uniqueIndex('homepage_brand_versions_version_unique_idx').on(table.version),
    publishedAtIdx: index('homepage_brand_versions_published_at_idx').on(table.publishedAt),
  }),
);

export const homepageBrandAuditLogs = pgTable(
  'homepage_brand_audit_logs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    action: homepageBrandAuditActionEnum('action').notNull(),
    actorId: varchar('actor_id', { length: 128 }).notNull(),
    targetId: varchar('target_id', { length: 128 }).notNull(),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionOccurredIdx: index('homepage_brand_audit_logs_action_occurred_idx').on(table.action, table.occurredAt),
    actorOccurredIdx: index('homepage_brand_audit_logs_actor_occurred_idx').on(table.actorId, table.occurredAt),
  }),
);
```

- [ ] **步骤 4：新增 SQL migration**

新增 `drizzle/0018_homepage_brand_phase2_runtime.sql`，内容与 schema 对齐，包含 enum、四张表、索引。不要运行 migration。

- [ ] **步骤 5：更新 journal**

在 `drizzle/meta/_journal.json` 追加：

```json
{
  "idx": 18,
  "version": "7",
  "when": 1781967600000,
  "tag": "0018_homepage_brand_phase2_runtime",
  "breakpoints": true
}
```

- [ ] **步骤 6：运行测试确认通过**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandSchema.test.ts
```

预期：通过。

---

## 任务 3：实现 Repository 与 Service

**文件：**
- 新增：`src/modules/open-platform/server/homepage-brand-repository.ts`
- 新增：`src/modules/open-platform/server/homepage-brand-service.ts`
- 新增测试：`src/modules/open-platform/tests/HomepageBrandService.test.ts`

- [ ] **步骤 1：写失败测试**

测试应覆盖：

- 没有数据库记录时返回默认配置。
- 保存草稿只更新 draft，不产生 published 版本。
- 发布草稿生成版本、更新 published 状态、写审计。
- 回滚版本重新发布历史配置、写审计。

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandService.test.ts
```

预期：失败，提示 service 不存在。

- [ ] **步骤 2：实现内存可测试 repository 接口**

Repository 接口必须独立于 Drizzle，便于 service 单元测试：

```ts
export type HomepageBrandRepository = {
  getDraft(): Promise<HomepageBrandConfig | null>;
  saveDraft(input: { config: HomepageBrandConfig; actorId: string }): Promise<void>;
  getPublished(): Promise<{ config: HomepageBrandConfig; version: number } | null>;
  createVersion(input: { config: HomepageBrandConfig; actorId: string; summary: string }): Promise<{ versionId: string; version: number }>;
  publishVersion(input: { versionId: string; actorId: string }): Promise<void>;
  getVersion(version: number): Promise<{ config: HomepageBrandConfig; version: number } | null>;
  listVersions(): Promise<Array<{ version: number; summary: string; publishedAt: string }>>;
  writeAudit(input: { action: 'draft_saved' | 'published' | 'rolled_back'; actorId: string; targetId: string; summary: string }): Promise<void>;
};
```

- [ ] **步骤 3：实现 service**

Service 必须：

- 调用 `validateHomepageBrandConfig`。
- 草稿保存不影响 published。
- 发布前必须校验草稿。
- 回滚必须校验目标版本存在。
- 审计只写低敏摘要。

- [ ] **步骤 4：运行测试确认通过**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandService.test.ts
```

预期：通过。

---

## 任务 4：实现素材上传存储

**文件：**
- 新增：`src/modules/open-platform/server/homepage-brand-asset-storage.ts`
- 新增测试：`src/modules/open-platform/tests/HomepageBrandAssetStorage.test.ts`

- [ ] **步骤 1：写失败测试**

测试必须覆盖：

- 允许 `image/png`、`image/jpeg`、`image/webp`、`image/svg+xml`。
- 拒绝非图片类型。
- 拒绝超过限制大小。
- 阻止 `..`、绝对路径、反斜杠路径。
- 返回 `storageKey`、`publicUrl`、`sha256`、`sizeBytes`。

- [ ] **步骤 2：实现本地存储**

参考 `platform-knowledge-file-storage.ts`，默认根目录使用 `var/homepage-brand-assets`，公开 URL 使用 `/uploads/homepage-brand/<kind>/<fileId>-<sha>.<ext>`。

- [ ] **步骤 3：运行测试确认通过**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandAssetStorage.test.ts
```

预期：通过。

---

## 任务 5：实现 API 路由

**文件：**
- 新增 API route 文件。
- 新增测试：`src/modules/open-platform/tests/HomepageBrandApiRoute.test.ts`

- [ ] **步骤 1：写失败测试**

测试必须覆盖：

- `GET /api/v1/open-platform/homepage-brand` 返回 draft、published、versions、auditSummary。
- `PUT /api/v1/open-platform/homepage-brand/draft` 保存草稿。
- `POST /api/v1/open-platform/homepage-brand/publish` 发布草稿。
- `POST /api/v1/open-platform/homepage-brand/rollback` 回滚版本。
- `POST /api/v1/open-platform/homepage-brand/assets` 上传素材并返回 asset。

- [ ] **步骤 2：实现 route**

所有 route 返回中文错误信息；禁止返回 SQL、stack、env、secret、token、原始 request body。

- [ ] **步骤 3：运行测试确认通过**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandApiRoute.test.ts
```

预期：通过。

---

## 任务 6：真实首页渲染组件化

**文件：**
- 新增：`src/modules/marketing/components/MarketingHomeRenderer.tsx`
- 修改：`src/modules/marketing/components/MarketingHome.tsx`
- 修改测试：`src/modules/marketing/tests/MarketingHome.test.tsx`

- [ ] **步骤 1：写失败测试**

测试必须证明：

- 传入配置后首页渲染对应文案。
- 导航链接来自配置。
- CTA 按钮来自配置。
- metrics 和 growthCard 来自配置。

- [ ] **步骤 2：抽出 renderer**

`MarketingHomeRenderer` 接收：

```ts
type MarketingHomeRendererProps = {
  config: HomepageBrandConfig;
  previewMode?: 'live' | 'draft';
};
```

真实首页和管理端预览必须使用同一个组件。

- [ ] **步骤 3：运行测试确认通过**

运行：

```bash
pnpm test -- src/modules/marketing/tests/MarketingHome.test.tsx
```

预期：通过。

---

## 任务 7：管理端接入真实草稿、上传、发布、回滚和审计

**文件：**
- 修改：`src/modules/open-platform/components/HomepageBrandPanel.tsx`
- 修改测试：`src/modules/open-platform/tests/HomepageBrandPanel.test.tsx`

- [ ] **步骤 1：写失败测试**

测试必须覆盖：

- 初始加载显示 API 返回的草稿和发布版本。
- 保存草稿调用 API。
- 上传素材显示预览和错误提示。
- 发布前显示检查结果。
- 发布成功后版本号更新。
- 回滚需要确认。
- 审计记录显示最近动作。
- 草稿预览和真实首页 renderer 使用相同配置字段。

- [ ] **步骤 2：实现 UI 接入**

将当前本地 state 保留为编辑中的 form state，但数据来源和保存动作改为 API。

- [ ] **步骤 3：运行测试确认通过**

运行：

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandPanel.test.tsx
```

预期：通过。

---

## 任务 8：总体验证与审查

- [ ] **步骤 1：运行目标测试**

```bash
pnpm test -- src/modules/open-platform/tests/HomepageBrandConfig.test.ts
pnpm test -- src/modules/open-platform/tests/HomepageBrandSchema.test.ts
pnpm test -- src/modules/open-platform/tests/HomepageBrandService.test.ts
pnpm test -- src/modules/open-platform/tests/HomepageBrandAssetStorage.test.ts
pnpm test -- src/modules/open-platform/tests/HomepageBrandApiRoute.test.ts
pnpm test -- src/modules/open-platform/tests/HomepageBrandPanel.test.tsx
pnpm test -- src/modules/marketing/tests/MarketingHome.test.tsx
pnpm typecheck
git diff --check
```

- [ ] **步骤 2：用 Claude Code 终端审查**

要求 Claude Code 检查：

- schema 与 migration 是否一致。
- API 是否低敏。
- 上传是否有格式、大小和路径保护。
- 发布和回滚是否写审计。
- 管理端预览是否复用真实首页 renderer。
- 是否仍存在假按钮或误导性文案。

- [ ] **步骤 3：完成清单**

确认：

- 不读取 `.env/.env.local`。
- 不运行 migration。
- 不提交、推送、创建 PR。
- 所有第二阶段能力都有测试证据。

---

## 自审结果

- 规格覆盖：计划覆盖真实保存、上传、预览、发布、回滚、审计、真实首页一致性。
- 占位扫描：无 `TBD`、无 `TODO`、无“以后再补”的实现步骤。
- 边界确认：用户已明确批准 runtime、schema、migration、上传、发布、回滚和审计；但仍禁止读取环境变量、运行 migration、提交、推送和创建 PR。
- 风险拆分：先做配置类型和 schema 地基，再做服务、API、上传、真实首页复用和管理端 UI，避免一次性大改。
