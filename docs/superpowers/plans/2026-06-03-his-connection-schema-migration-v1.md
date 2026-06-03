# HIS 连接配置 schema / migration v1 实施计划

> 实现同步：后续分支 `codex/his-connection-schema-migration` 已按本计划进入最小实现，只新增 `his_connections` schema、Drizzle migration、schema / migration 测试和轻量文档同步；仍不新增 API、repository、UI、凭证存储、测试连接、真实 HIS adapter，不修改 demo seed。

**目标：** 只做 HIS / 机构系统连接配置 schema / migration 实现 Plan Mode，明确未来 `his_connections` 表、状态枚举、索引 / 唯一约束、软删除、凭证引用、审计关系、migration 顺序和安全边界。

**架构：** 当前 PR 不改系统架构，只新增和同步 Markdown。未来 schema / migration PR 只能落地安全元数据表结构，不实现 API、repository、凭证存储、测试连接或真实 HIS adapter。

**技术栈：** Markdown 文档；不改 TypeScript、Drizzle schema、migration、测试、API route、权限、认证或租户隔离。

## 文件范围

新增：

- `docs/superpowers/specs/2026-06-03-his-connection-schema-migration-v1-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-schema-migration-v1.md`

轻量同步：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

不修改：

- `src/server/db/schema.ts`
- `drizzle/**`
- `src/server/db/tests/**`
- `src/modules/**`
- `app/api/**`
- demo seed 数据

## 边界

- 不写代码。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接真实 HIS。
- 不接机构系统。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做测试连接实现。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存任何真实凭证。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

## 当前事实

- 当前 main commit：`03d310f10013c161d05550846e64fd6095f9a46d`。
- PR #114 已合并：真实 HIS adapter 前置评估完成。
- PR #115 已合并：连接配置与凭证边界 Plan Mode 完成。
- PR #116 已合并：连接配置 schema / API 边界 Plan Mode 完成。
- 当前仍未新增连接配置 schema。
- 当前仍未新增连接配置 migration。
- 当前仍未新增连接配置 API。
- 当前仍未保存真实凭证。
- 当前仍未接真实 HIS / 机构系统。

## 只读检查

先只读检查：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`
- `docs/superpowers/specs/2026-06-03-his-connection-schema-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-schema-api-v1.md`
- `docs/superpowers/specs/2026-06-03-his-connection-credentials-boundary-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-credentials-boundary.md`
- `docs/superpowers/specs/2026-06-03-real-his-adapter-preflight-design.md`
- `docs/superpowers/plans/2026-06-03-real-his-adapter-preflight.md`

只读查看当前 schema / migration 风格：

- `src/server/db/schema.ts`
- `src/server/db/tests/*`
- `src/modules/open-platform/**`
- `src/modules/audit/**`
- `src/modules/institution/**`

只读搜索关键词：

- `tenantId`
- `audit`
- `quota`
- `apiKey`
- `credential`
- `connection`
- `status`
- `deletedAt`
- `createdAt`
- `updatedAt`

## 计划事项

### 1. 新增 schema / migration 设计文档

文件：`docs/superpowers/specs/2026-06-03-his-connection-schema-migration-v1-design.md`

- [ ] 写明本 PR 是 schema / migration 实现 Plan Mode。
- [ ] 写明本 PR 不是 schema 实现、migration、API、凭证存储、测试连接或 HIS adapter。
- [ ] 规划未来 `his_connections` 候选字段：`id`、`tenantId`、`connectionName`、`sourceSystem`、`vendorType`、`systemType`、`status`、`credentialRef`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`createdBy`、`updatedBy`、`createdAt`、`updatedAt`、`revokedAt`、`deletedAt`。
- [ ] 明确 `tenantId` 只能来自服务端可信上下文。
- [ ] 明确 `credentialRef` 只能是凭证引用，不是凭证明文。
- [ ] 明确不保存 token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串、raw HIS payload、完整请求体 / 响应体、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- [ ] 规划状态枚举：`draft`、`active`、`paused`、`revoked`、`deleted`、`error`。
- [ ] 明确 `revoked` 不应普通恢复到 `active`，`deleted` 是软删除 / 归档，`error` 只保存稳定错误状态。
- [ ] 规划索引和唯一约束候选：`tenantId + id`、`tenantId + status`、`tenantId + sourceSystem`、`tenantId + deletedAt`、`credentialRef`、`lastCheckedAt`、同租户连接名唯一和软删除唯一处理。
- [ ] 明确不做跨租户唯一，不用外部 ID 做主键。
- [ ] 规划审计事件和审计安全元数据。
- [ ] 明确审计禁止凭证、raw payload、SQL、stack、`DATABASE_URL` 和外部错误响应全文。
- [ ] 规划 migration 顺序和后续 PR 拆分。
- [ ] 写明 schema 只保存安全元数据，错误态只返回稳定 code。

### 2. 新增 schema / migration 计划文档

文件：`docs/superpowers/plans/2026-06-03-his-connection-schema-migration-v1.md`

- [ ] 写明目标、架构、文件范围和非目标。
- [ ] 记录只读检查范围。
- [ ] 记录实施步骤、验收标准、验证命令和 stop conditions。
- [ ] 明确当前 PR docs-only，不进入真实实现。

### 3. 轻量同步 README

文件：`README.md`

- [ ] 当前范围增加连接配置 schema / migration Plan Mode 已完成状态。
- [ ] Phase 22 后续状态增加 schema / migration 规划完成边界。
- [ ] 后续阶段保留 schema / migration 实现、API、凭证、测试连接和真实 adapter 仍需独立 PR。

### 4. 轻量同步 roadmap

文件：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

- [ ] 增加连接配置 schema / migration Plan Mode 已完成状态。
- [ ] 明确仍不实现 schema / migration / API / 权限 / 凭证 / 测试连接 / 真实 adapter。
- [ ] 保留后续 PR A-J 拆分。

### 5. 更新 devlog

文件：`docs/devlog/2026-06-03.md`

- [ ] 增加本次 Plan Mode 分支、目标、完成内容、边界和验证命令。
- [ ] 明确 docs-only，未跑 Vitest、typecheck 或 build。

## 验收标准

- 只新增 / 修改 Markdown 文档。
- 新设计文档明确当前 PR 不是实现。
- 文档覆盖 `his_connections` 候选字段和安全禁止项。
- 文档明确 `tenantId` 只能来自服务端可信上下文。
- 文档明确 `credentialRef` 只能是凭证引用。
- 文档覆盖状态枚举、索引 / 唯一约束、软删除和错误边界。
- 文档覆盖审计事件和审计禁止项。
- 文档覆盖 migration 顺序和后续 PR A-J 拆分。
- 没有代码、测试、API、schema、migration、权限、认证、租户隔离或 demo seed 变更。

## 验证

docs-only PR 只需运行：

```bash
git diff --check
git diff --cached --check
```

不需要跑 Vitest、typecheck、Next build，除非误改代码或测试。

## Stop conditions

如发现以下任一情况，停止并回报：

- 必须改 TypeScript 代码。
- 必须改测试。
- 必须改数据库 schema 或新增 migration。
- 必须新增或修改 API。
- 必须改权限、认证或租户隔离。
- 必须保存真实凭证或凭证密文。
- 必须接真实 HIS / 机构系统 / 企微 / AI。
- 必须处理真实客户数据或 raw HIS payload。
- 必须实现测试连接、Webhook、同步任务或真实 adapter。

## 后续 PR 拆分建议

- PR A：schema / migration Plan Mode（当前 PR）。
- PR B：schema / migration 实现。
- PR C：schema / repository tests。
- PR D：只读 repository。
- PR E：list / detail API。
- PR F：create / update API。
- PR G：pause / resume / revoke API。
- PR H：`credentialRef` 集成 Plan Mode。
- PR I：测试连接 Plan Mode。
- PR J：真实 HIS adapter Plan Mode。

真实 HIS adapter 和测试连接不得混在 schema / migration 实现 PR 里。凭证创建、更新、加密、轮换、撤销和销毁不得混在连接配置 schema / migration PR 里。
