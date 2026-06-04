# Phase 23 HIS 连接配置状态 service v1 计划

> 本文档是 Phase 23 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 HIS 连接配置 pause / resume / revoke / delete / softDelete 状态 service，不实现 service 代码，不新增 API、route、parser、repository、schema、migration、权限、审计实现、凭证管理、测试连接或真实 HIS adapter。

## 目标

只规划 HIS 连接配置状态 service v1 的服务层边界，明确推荐导出函数、可信输入、repository 调用、事务、allowed audit、denied audit、稳定 service result、DTO、测试覆盖和后续拆分。

## 背景说明

当前系统已完成 HIS 连接配置只读链路、create / update repository、状态流转 repository、create / update parser、写入权限、create / update service、denied audit、create / update route Plan Mode、状态 API Plan Mode、状态权限 Plan Mode 和状态权限最小实现。

状态 API 进入 route 实现前，需要先把 route 与 repository 之间的状态 service 规划清楚。后续状态 route 不应直接调用 repository 状态方法，而应通过 service 统一处理事务、审计、稳定结果映射和 DTO 最小化。

当前 PR 不改运行时代码，只把后续 service 实现边界拆清楚。

## 技术范围

当前 PR 只涉及 Markdown。

本 PR 允许修改：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-service-v1.md`
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

- 当前 main commit 为 `f4617a1855010a6c5c2a9bd31ef224b8e42dde18`。
- 建分支前工作区干净。
- 当前分支为 `docs/phase23-his-connection-status-service-plan`。

已只读检查：

- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-api-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-permission-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-permission-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

只读结论：

- 当前尚未存在 HIS 连接配置状态 service。
- 当前 create / update service 已有事务内 repository 写入与 audit 写入模式。
- 当前 repository 已具备 pause / resume / revoke / softDelete 状态流转方法。
- 当前 repository 状态 command 只需要 `tenantId`、`connectionId`、`actorUserId` 和可选 `reasonCode`。
- 当前 repository 状态 result 使用 `invalid_state_transition`。
- 状态 service 应映射为 route 可消费的 `invalid_transition`，不应修改 repository 运行时类型。
- 当前权限模型已为 `tenant_admin` 授权 `open_connection:manage_status` 与 `open_connection:delete`。
- 当前 `ACCESS_ACTIONS` 未新增 pause / resume / revoke / soft_delete。
- 当前 audit action 可使用 `manage_status` 与 `delete`。
- 用户指定的状态 service 术语只读搜索未返回匹配行。

## 当前 PR 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-v1-design.md`
  - 记录状态 service 范围、推荐导出函数、输入边界、repository 调用、事务、allowed audit、denied audit、service result、DTO、测试规划和后续拆分。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-service-v1.md`
  - 记录当前 docs-only PR 的检查结论、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 状态 service Plan Mode 状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的状态 service 规划状态和剩余缺口。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 当前 PR 执行清单

### 一、创建状态 service 设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划状态 service，不实现代码。
- [x] 明确状态 service 范围仅包含 pause / resume / revoke / delete / softDelete。
- [x] 明确推荐导出函数。
- [x] 明确 service 可信输入。
- [x] 明确禁止 body / query / header / localStorage `tenantId`。
- [x] 明确禁止凭证、raw HIS payload、SQL、stack、`DATABASE_URL` 和完整医疗正文。
- [x] 明确 repository 方法一一对应。
- [x] 明确 repository command 最小字段。
- [x] 明确 route 不直接调用 repository 状态方法。
- [x] 明确 repository 写入与 allowed / denied audit 同事务。
- [x] 明确 allowed audit 使用 `manage_status` 与 `delete`。
- [x] 明确 denied audit 对 not found、conflict、invalid transition、validation failed 的边界。
- [x] 明确 repository `invalid_state_transition` 到 service `invalid_transition` 的映射。
- [x] 明确成功响应只返回 `{ ok: true }`。
- [x] 明确 revoke 不处理凭证撤销，delete 只 softDelete。
- [x] 规划 service tests 和后续拆分。

### 二、创建当前计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-service-v1.md`

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

- [x] README 增加 Phase 23 状态 service Plan Mode 状态。
- [x] roadmap 增加状态 service 规划状态和剩余缺口。
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

1. 状态 service 最小实现。
2. pause / resume API route 最小实现。
3. revoke / delete API route 最小实现。
4. 状态 API route tests。
5. 状态 API 审计 reason / query whitelist 补强，如当前 reason 不足。
6. 状态 API 文档收尾。
7. 凭证管理、凭证撤销、测试连接和真实 HIS adapter 单独 Plan Mode。

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
