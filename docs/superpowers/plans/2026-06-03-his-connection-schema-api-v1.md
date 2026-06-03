# HIS 连接配置 schema / API v1 实施计划

> **给自动化执行者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行本计划。步骤使用复选框（`- [ ]`）语法跟踪。
> 实现同步：后续分支 `codex/his-connection-read-repository` 已按本计划中的 list / detail 前置数据访问边界进入只读 repository 最小实现；后续分支 `codex/his-connection-read-api` 已进入机构端 list / detail 只读 API 最小实现；仍不新增 schema / migration、写入 API、写入 repository、权限模型改动、凭证存储、测试连接或真实 HIS adapter。

**目标：** 只做 HIS / 机构系统连接配置 schema / API Plan Mode，明确未来连接配置能力进入实现前的 schema、API、权限、审计、DTO、错误态、凭证引用和租户隔离边界。

**架构：** 当前 PR 不改系统架构，只新增和同步 Markdown。未来连接配置 schema / API 只能保存安全元数据和 `credentialRef`，凭证创建 / 更新 / 加密 / 轮换 / 撤销必须拆到凭证管理 Plan Mode；测试连接和真实 HIS adapter 必须后续单独规划。

**技术栈：** 当前 PR 只涉及 Markdown。后续如单独批准实现，才可能涉及 TypeScript、Vitest、Drizzle、API route、权限检查、审计写入、凭证引用和连接健康检查。

---

## 0. 当前 PR 范围

新增：

- `docs/superpowers/specs/2026-06-03-his-connection-schema-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-schema-api-v1.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

当前 PR 不做：

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
- 不做测试连接实现。

验证命令：

```bash
git diff --check
git diff --cached --check
```

本 PR 不需要跑 Vitest、typecheck 或 Next build，除非误改了代码或测试。

## 1. 只读检查结论

本次按要求只读检查了：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`
- `docs/superpowers/specs/2026-06-03-real-his-adapter-preflight-design.md`
- `docs/superpowers/plans/2026-06-03-real-his-adapter-preflight.md`
- `docs/superpowers/specs/2026-06-03-his-connection-credentials-boundary-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-credentials-boundary.md`

并只读搜索了：

- `tenant`
- `audit`
- `permission`
- `platform`
- `quota`
- `apiKey`
- `credential`
- `connection`

已确认：

- 当前 main HEAD 为 `4cd0aaa58675aafad9bf57fd26336667ae6b2ac1`。
- 当前工作区开始时干净，本 PR 从 `docs/his-connection-schema-api-plan` 分支执行。
- PR #114 已合并，真实 HIS adapter 前置评估只完成 docs-only 规划，尚未进入真实 adapter 实现。
- PR #115 已合并，连接配置与凭证边界只完成 docs-only 规划，尚未进入连接配置 schema / API、凭证存储或测试连接实现。
- 当前仍未新增连接配置 schema，未新增连接配置 API，未保存任何真实凭证。
- 既有文档和代码传统均强调 `tenantId` 只能来自服务端 access context 或平台受控流程，机构端不能从 body、query、header 或 localStorage 切换租户。
- 既有文档和测试传统均禁止 SQL、stack、token、secret、`DATABASE_URL`、连接串、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文和 raw payload 进入 DTO、审计、错误态或前端展示。

因此本 PR 不需要改 TypeScript、测试、API、schema、migration、权限、认证或租户隔离。

## 2. 文件职责规划

- `docs/superpowers/specs/2026-06-03-his-connection-schema-api-v1-design.md`
  - 说明本 PR 定位、非目标、未来连接配置 schema 字段、API 边界、权限与租户隔离、审计事件、DTO、错误态、凭证引用、安全禁止项和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-his-connection-schema-api-v1.md`
  - 说明本 docs-only PR 的范围、只读检查结论、文件职责、执行步骤、验收清单、验证命令和停止条件。
- `README.md`
  - 轻量同步连接配置 schema / API Plan Mode 状态，明确仍未进入 schema、migration、API、凭证存储、测试连接或真实 HIS adapter 实现。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步路线图：连接配置 schema / API 边界已规划，但 schema / migration、API 实现、凭证引用、测试连接和真实 adapter 仍需单独 PR。
- `docs/devlog/2026-06-03.md`
  - 记录本 PR 范围、完成项、边界和验证命令。

## 3. 执行步骤

### 任务 1：新增设计文档

**文件：**

- 新增：`docs/superpowers/specs/2026-06-03-his-connection-schema-api-v1-design.md`

- [ ] 写明本 PR 是连接配置 schema / API Plan Mode，不是 schema、migration、API、凭证存储、测试连接或 HIS adapter 实现。
- [ ] 写明不连接真实 HIS、不保存真实凭证、不保存 raw HIS payload、不处理真实客户数据。
- [ ] 规划未来连接配置字段：`id`、`tenantId`、`connectionName`、`sourceSystem`、`vendorType`、`systemType`、`status`、`credentialRef`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`createdBy`、`updatedBy`、`createdAt`、`updatedAt`、`revokedAt`、`deletedAt`。
- [ ] 明确 `tenantId` 只能来自服务端可信上下文，`credentialRef` 只能是凭证引用，不是凭证明文。
- [ ] 明确不保存 raw HIS payload、完整请求体、完整响应体、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、token、secret、API key、OAuth token、basic auth、签名密钥或连接串。
- [ ] 规划未来机构端 API：list、create、detail、update、pause、resume、revoke、delete。
- [ ] 规划平台端管理 API 只作为受控安全元数据视图，不在本 PR 实现。
- [ ] 明确 API 不得返回凭证明文、raw payload、内部异常细节或外部系统错误响应全文。
- [ ] 规划机构管理员、普通机构人员、平台管理员、平台运营、安全角色的可见性和操作边界。
- [ ] 规划审计事件 `his_connection:create`、`his_connection:update`、`his_connection:pause`、`his_connection:resume`、`his_connection:revoke`、`his_connection:delete`、`his_connection:test_requested`、`his_connection:test_succeeded`、`his_connection:test_failed`、`his_connection:credential_ref_updated`。
- [ ] 明确审计只记录安全元数据，禁止记录凭证明文、raw payload、SQL、stack 或 `DATABASE_URL`。
- [ ] 规划 list DTO、detail DTO、create payload、update payload、status transition payload。
- [ ] 规划稳定错误码：`unauthorized`、`forbidden`、`not_found`、`conflict`、`invalid_status_transition`、`credential_ref_invalid`、`validation_failed`、`service_unavailable`。
- [ ] 写明后续 PR A-H 拆分，且真实 HIS adapter 和测试连接不得混在 schema / API 实现 PR 里。

### 任务 2：新增计划文档

**文件：**

- 新增：`docs/superpowers/plans/2026-06-03-his-connection-schema-api-v1.md`

- [ ] 记录当前 PR 范围和非目标。
- [ ] 记录只读检查文件、关键词和结论。
- [ ] 规划文件职责。
- [ ] 列出执行步骤、验收清单和停止条件。
- [ ] 明确 docs-only 验证命令。

### 任务 3：轻量同步项目文档

**文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-06-03.md`

- [ ] README 增加连接配置 schema / API Plan Mode 状态。
- [ ] roadmap 增加连接配置 schema / API 边界规划完成状态，并保留 schema / migration、API 实现、凭证存储、测试连接和真实 adapter 未实现的边界。
- [ ] devlog 记录分支、目标、完成项、边界和验证命令。

### 任务 4：验证 docs-only diff

**命令：**

```bash
git diff --check
git diff --cached --check
```

预期：

- 两个命令均退出码为 0。
- 没有 whitespace error。

## 4. 后续 PR 拆分

建议后续拆分为：

- PR A：schema / API Plan Mode（当前 PR）。
- PR B：schema / migration 实现 Plan Mode。
- PR C：只读 list / detail API 实现。
- PR D：create / update API 实现。
- PR E：pause / resume / revoke 状态 API。
- PR F：凭证引用集成。
- PR G：测试连接 Plan Mode。
- PR H：真实 HIS adapter Plan Mode。

真实 HIS adapter 和测试连接不得混在 schema / API 实现 PR 里。凭证创建、更新、加密、轮换、撤销和销毁不得混在连接配置 API PR 里。

## 5. 验收清单

- 设计文档明确本 PR 是 schema / API Plan Mode，不是 schema 实现、migration、API 实现、凭证存储、测试连接或 HIS adapter。
- 设计文档明确不连接真实 HIS、不处理真实客户数据、不保存真实凭证、不保存 raw HIS payload。
- 设计文档明确不新增 API、不改 schema / migration、不改权限、认证或租户隔离。
- 设计文档覆盖未来连接配置字段和字段级安全边界。
- 设计文档明确 `tenantId` 只能来自服务端可信上下文，`credentialRef` 只能是凭证引用。
- 设计文档覆盖未来 API 边界，并明确 API 不返回凭证明文、raw payload 或外部系统错误响应全文。
- 设计文档覆盖权限与租户隔离，明确跨租户不可见、高危操作审计和普通机构人员可见性需要保守评估。
- 设计文档覆盖审计事件、允许记录项和禁止记录项。
- 设计文档覆盖 list DTO、detail DTO、create payload、update payload、status transition payload 和稳定错误码。
- 设计文档列出后续 PR A-H 拆分，明确测试连接和真实 adapter 不混入 schema / API PR。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、测试、API、schema、migration、权限、认证、租户隔离或 demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 6. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须写代码才能完成当前 docs-only PR。
- 必须改测试。
- 必须新增 API 或修改现有 API。
- 必须改数据库 schema 或新增 migration。
- 必须改权限、认证或租户隔离。
- 必须接真实 HIS、机构系统、企微或其他外部系统。
- 必须接 AI / RAG / Agent。
- 必须自动触达客户。
- 必须导入真实客户数据。
- 必须保存 raw HIS payload。
- 必须保存任何真实凭证。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要。
- 必须自动创建随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
