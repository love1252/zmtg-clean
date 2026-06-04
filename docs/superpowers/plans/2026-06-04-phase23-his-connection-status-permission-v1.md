# Phase 23 HIS 连接配置状态权限 v1 计划

> 本文档是 Phase 23 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 HIS 连接配置 pause / resume / revoke / delete / softDelete 状态 API 所需权限边界，不实现权限代码，不新增 API、route、service、repository、schema、migration、审计、凭证管理、测试连接或真实 HIS adapter。

## 目标

只规划 HIS 连接配置状态 API v1 的权限模型边界，明确当前权限现状、候选方案、v1 推荐 `manage_status + delete` 策略、授权角色、默认拒绝角色、tenant scope、audit action、权限测试和后续拆分。

## 背景说明

当前系统已完成 HIS 连接配置只读链路、create / update 写入链路、状态流转 repository、create / update route Plan Mode 和状态 API Plan Mode。状态 API 进入实现前，必须先明确 pause / resume / revoke / delete 不能复用只读权限，也不能把 metadata update 权限默认扩大为生命周期状态动作。

当前 PR 不改运行时代码，只把后续权限实现边界拆清楚。

## 技术范围

当前 PR 只涉及 Markdown。

本 PR 允许修改：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-permission-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-permission-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

本 PR 禁止修改：

- `src/**`
- API route 文件。
- service 文件。
- parser 文件。
- repository 文件。
- 权限实现或权限测试文件。
- audit domain / reason / query whitelist 文件。
- audit repository 文件。
- schema / migration 文件。
- `package.json` 或 lockfile。
- `.env*`。
- `.codex`。
- Superpowers 缓存目录或技能文件。

## 只读检查记录

已执行基础检查：

- `git checkout main`
- `git pull --ff-only origin main`
- `git rev-parse HEAD`
- `git status --short`

检查结论：

- 当前 main commit 为 `d3ea842620fb7c8f98b65a8c4f8310e115121f2a`。
- 建分支前工作区干净。

已只读检查：

- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-permission-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-permission-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-api-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

只读结论：

- `ACCESS_ACTIONS` 已存在 `manage_status` 与 `delete`。
- `ACCESS_RESOURCES` 已存在 `open_connection`。
- `ProtectedAction` 来自 `ACCESS_ACTIONS`。
- `TenantAuditEvent.action` 使用 `ProtectedAction`。
- 当前 `tenant_admin` 对 `open_connection` 已具备 `read_own_tenant`、`create` 和 `update`，尚未具备 `manage_status` 或 `delete`。
- 当前其他机构普通角色、平台角色和审计角色均未具备 HIS 连接配置状态写入权限。
- 当前 repository 已具备 pause / resume / revoke / softDelete 状态流转方法和测试。
- 当前尚未存在状态 API route。
- PR #142 已完成状态 API 路径、service、DTO 和审计边界规划。
- 用户指定的状态权限术语只读搜索未返回匹配行。

## 当前 PR 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-permission-v1-design.md`
  - 记录状态权限范围、禁止项、候选方案评估、v1 推荐策略、角色边界、tenant scope、route 权限顺序、audit action、DTO、测试规划和后续拆分。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-permission-v1.md`
  - 记录当前 docs-only PR 的检查结论、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 状态权限 Plan Mode 状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的状态权限规划状态和剩余缺口。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 当前 PR 执行清单

### 一、创建状态权限设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-permission-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划状态权限，不实现代码。
- [x] 明确状态 API 范围仅包含 pause / resume / revoke / delete / softDelete。
- [x] 明确推荐 API 路径和 `POST /delete` 备选边界。
- [x] 明确不得复用 `open_connection:read_own_tenant` 或只读权限放行状态写入。
- [x] 评估 `open_connection:update`、`manage_status + delete` 和细分状态 action 三种方案。
- [x] 明确 v1 推荐 pause / resume / revoke 使用 `manage_status`，delete / softDelete 使用 `delete`。
- [x] 明确 `tenant_admin` 为 v1 唯一默认授权角色。
- [x] 明确普通机构角色、平台角色、审计角色和其他只读或非管理员角色默认拒绝。
- [x] 明确 `accessContext.tenantId` 是唯一可信租户来源。
- [x] 规划 route 权限判断顺序和无权限短路要求。
- [x] 规划 audit action 使用 `manage_status` 与 `delete` 的边界。
- [x] 规划成功响应 `{ ok: true }` 和 DTO 最小化边界。
- [x] 规划权限模型测试和 route 权限测试。
- [x] 给出后续小步拆分建议。

### 二、创建当前计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-permission-v1.md`

待完成事项：

- [x] 记录目标、背景和范围。
- [x] 记录只读检查文件和结论。
- [x] 记录当前 PR 文件职责。
- [x] 记录执行清单。
- [x] 记录验证命令。
- [x] 记录停止条件。

### 三、轻量同步项目文档

修改文件：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

待完成事项：

- [x] README 增加 Phase 23 状态权限 Plan Mode 状态。
- [x] roadmap 增加状态权限规划状态和剩余缺口。
- [x] devlog 追加本分支、目标、完成项、边界和验证命令。

### 四、验证 docs-only diff

运行命令：

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

同时执行中文化残留检查，并人工确认 `git diff --name-only origin/main...HEAD` 不包含禁止范围文件。

必须满足：

- changed files 只包含允许的 Markdown 文件。
- 不包含 `src/**`。
- 不包含 API route、service、repository、parser、权限、audit domain、audit repository、schema / migration。
- 不包含 `package.json`、lockfile、`.env*`、`.codex`、Superpowers 缓存目录或技能文件。
- 空白检查通过。
- 新增 spec / plan 不包含英文模板字段。

## 后续拆分建议

建议后续独立 PR 顺序：

1. 状态 API 权限最小实现：给 `tenant_admin` 增加 `open_connection:manage_status` 与 `open_connection:delete`。
2. 状态 service Plan Mode。
3. 状态 service 最小实现。
4. pause / resume API route 最小实现。
5. revoke / delete API route 最小实现。
6. 状态 API route tests。
7. 状态 API 审计补强。
8. 状态 API 文档收尾。
9. 凭证管理、凭证撤销、测试连接和真实 HIS adapter 单独 Plan Mode。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写 TypeScript 代码。
- 必须改测试。
- 必须修改 `src/**`。
- 必须新增 API route。
- 必须修改现有 GET / POST / PATCH。
- 必须新增或修改 service。
- 必须新增或修改 parser。
- 必须新增或修改 repository。
- 必须改 schema 或 migration。
- 必须真正修改权限、认证或租户隔离实现。
- 必须修改 audit domain / reason / query whitelist。
- 必须修改 audit repository。
- 必须处理凭证管理。
- 必须做测试连接。
- 必须接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 必须保存或返回真实凭证。
- 必须保存或返回 raw HIS payload。
- 必须保存完整病历、完整治疗正文或咨询全文。
- 必须自动创建治疗摘要或随访任务。
- 必须修改 demo seed 数据。
- 必须修改 package.json 或 lockfile。
- 必须修改 `.env*`。
- 必须修改 `.codex`、Superpowers 缓存目录或技能文件。
