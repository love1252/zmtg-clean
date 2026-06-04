# Phase 23 HIS 连接配置状态 API v1 计划

> 本文档是 Phase 23 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 pause / resume / revoke / delete 状态 API 的 API 边界、权限边界、service 边界、审计边界、DTO 边界和测试拆分，不新增 API route，不修改 `src/**`。

## 目标

只规划 HIS 连接配置 pause / resume / revoke / delete 状态 API v1 的后续实现边界，明确可信输入、禁止字段、权限策略、状态流转、HTTP 映射、DTO 最小化、审计边界、service 拆分和后续测试。

## 背景说明

Phase 23 create / update API 主链路已基本闭环，repository 也已经具备 pause、resume、revoke 和 softDelete 状态方法。当前缺口是状态 API 尚未进入 HTTP route、service、权限、审计和测试规划。

本 PR 只把状态 API 的后续拆分写清楚，避免后续 route 实现时同时混入凭证、测试连接、真实 HIS、状态权限扩展、audit action 扩展或 UI 写入入口。

## 技术范围

当前 PR 只涉及 Markdown。

本 PR 允许修改：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-api-v1.md`
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
- `.codex`。
- Superpowers 缓存目录或技能文件。

## 只读检查记录

已执行基础检查：

- `git checkout main`
- `git pull --ff-only origin main`
- `git rev-parse HEAD`
- `git status --short`

检查结论：

- 当前 main commit 为 `99b754a7eb02ee7b8d812364a59b2575e4cd7ac5`。
- 建分支前工作区干净。

已只读检查：

- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-create-update-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-create-update-api-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-create-update-api-route-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-create-update-api-route-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-audit-reason-v1-design.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

已执行状态术语搜索：

```bash
grep -R "pauseHisConnection\|resumeHisConnection\|revokeHisConnection\|softDeleteHisConnection\|his_connection.*pause\|his_connection.*resume\|his_connection.*revoke\|softDelete" src docs --exclude-dir=node_modules || true
```

搜索结论：

- 已有 repository 方法和 repository 测试覆盖 pause / resume / revoke / softDelete。
- 已有早期文档提及生命周期和 repository 状态流转。
- 未发现已经存在的状态 API route。
- 未发现已经存在的状态 API 专用 Plan Mode 文档。

## 当前 PR 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
  - 记录状态 API 范围、路径规划、可信输入、禁止字段、权限边界、状态流转、service 边界、审计边界、HTTP 映射、DTO 边界、测试规划和后续拆分。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-api-v1.md`
  - 记录当前 docs-only PR 的只读检查、文件职责、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 状态 API Plan Mode 状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的状态 API 规划状态和剩余缺口。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 执行清单

### 一、创建状态 API 设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划状态 API，不写代码。
- [x] 明确后续状态 API 包含 pause、resume、revoke、delete / softDelete。
- [x] 评估 `POST /pause`、`POST /resume`、`POST /revoke` 和 `DELETE /[connectionId]`。
- [x] 明确本轮不新增 route、不改现有 GET / POST / PATCH、不改 service / parser / repository / 权限 / audit domain / schema / migration。
- [x] 明确现有 repository 已具备四个状态方法。
- [x] 明确可信输入只能来自 access context、path `connectionId` 和安全 `reasonCode`。
- [x] 明确不接受 body / query / header / localStorage `tenantId`。
- [x] 明确不接受或透传凭证、raw payload、完整请求 / 响应体、SQL、stack、`DATABASE_URL`、完整医疗正文或文件原文。
- [x] 规划权限边界，明确不得复用 `read_own_tenant`。
- [x] 评估复用 `open_connection:update`、使用 `manage_status + delete` 和新增细分状态权限。
- [x] 明确 v1 默认仅 `tenant_admin` 可写，平台代管写入不进入 v1。
- [x] 规划状态流转边界和稳定错误码。
- [x] 规划 HTTP 映射和 DTO 最小化。
- [x] 规划审计边界和 route denied audit。
- [x] 规划 service 边界和 route / service 职责拆分。
- [x] 规划后续测试覆盖和小步 PR 拆分。

### 二、创建当前计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-api-v1.md`

待完成事项：

- [x] 记录目标、背景和范围。
- [x] 记录只读检查文件和结论。
- [x] 记录状态术语搜索结论。
- [x] 记录文件职责。
- [x] 记录执行清单。
- [x] 记录验证命令。
- [x] 记录停止条件。

### 三、轻量同步项目文档

修改文件：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

待完成事项：

- [x] README 追加 Phase 23 状态 API Plan Mode 状态。
- [x] roadmap 追加状态 API 规划状态和剩余缺口。
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
- 不包含 `package.json`、lockfile、`.codex`、Superpowers 缓存目录或技能文件。
- 空白检查通过。
- 新增 spec / plan 不包含英文模板字段。

## 后续拆分建议

建议后续独立 PR 顺序：

1. 状态 API 权限 Plan Mode 或权限最小实现。
2. 状态 service Plan Mode。
3. 状态 service 最小实现。
4. pause / resume API route 最小实现。
5. revoke / delete API route 最小实现。
6. 状态 API route tests。
7. 状态 API 审计补强。
8. 状态 API 文档收尾。
9. 凭证管理 Plan Mode。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写代码。
- 必须修改 `src/**`。
- 必须新增 API route。
- 必须修改现有 API route。
- 必须修改 service。
- 必须修改 parser。
- 必须修改 repository。
- 必须修改权限实现或权限测试。
- 必须修改 audit domain / reason / query whitelist。
- 必须修改 audit repository。
- 必须修改 schema / migration。
- 必须处理凭证管理。
- 必须做测试连接。
- 必须接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 必须导入真实客户数据。
- 必须保存 raw HIS payload。
- 必须保存或返回真实凭证。
- 必须返回 `credentialRef` 给前端 DTO。
- 必须展示凭证明文。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要或随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
- 必须修改 `package.json` 或 lockfile。
- 必须修改 `.codex`、Superpowers 缓存目录或技能文件。
- 必须引入新的 npm 依赖。
