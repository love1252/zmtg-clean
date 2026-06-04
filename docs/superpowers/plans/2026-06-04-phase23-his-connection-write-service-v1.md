# Phase 23 HIS 连接配置写入 service v1 计划

> 本文档是 Phase 23 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 HIS 连接配置 create / update API 的 service 层事务边界、repository 结果映射、审计写入边界、DTO 边界和 API 错误映射，不实现 service 代码，不新增 API route，不修改 parser、repository、权限、schema、migration、审计实现、凭证管理、测试连接或真实 HIS adapter。

## 目标

只规划 HIS 连接配置 create / update service v1 的后续实现边界，明确 service 输入来源、事务内写入与审计顺序、repository result 映射、API 错误响应、DTO 最小化、测试规划和后续拆分。

## 背景说明

当前系统已经完成 HIS 连接配置只读链路、repository 写入链路、create / update API Plan Mode、写入 payload parser / DTO helper，以及 `tenant_admin` 写入权限最小实现。下一步 create / update API 接入前，需要先把 service 层事务和错误映射边界拆清楚，避免 route 直接散落写入、审计和错误映射逻辑。

当前 PR 不改运行时代码，只产出 Plan Mode 文档。

## 技术范围

当前 PR 只涉及 Markdown。

后续如进入 service 实现，预计涉及：

- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `createHisConnectionRepository`
- `createAuditEventRepository`
- `mapHisConnectionWriteMetadataToDto`
- `canAccessResource`
- Drizzle transaction
- Vitest

当前 PR 不新增或修改上述源码。

## 只读检查记录

已只读检查：

- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-create-update-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-create-update-api-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-permission-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-permission-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

只读结论：

- 当前 main commit 为 `3a65928b89234bf4804e8f0a4075f997002bc50f`。
- 当前工作区在建分支前为干净状态。
- 写入 parser 已完成，只接受四个安全元数据字段。
- parser 已拒绝外部 `tenantId`、凭证字段、raw payload、SQL、stack 和 `DATABASE_URL`。
- repository create / update 已完成，并返回稳定 `ok` / `validation_failed` / `conflict` / `not_found` 结果。
- repository 写入绑定可信 `tenantId`，update 绑定 `tenantId + connectionId + deletedAt is null`。
- 权限模型已授予 `tenant_admin` `open_connection:create` 和 `open_connection:update`。
- 普通机构人员、顾问、客服、平台角色和审计角色仍未获得 HIS 连接配置写入权限。
- 审计模型可表达 `open_connection:create` 和 `open_connection:update` allowed audit，但 HIS 连接配置 payload 非法、conflict、repository validation_failed 等 denied reason 仍需后续补强。
- 现有治疗摘要写入 API 已展示事务内业务写入和审计写入的项目风格。

## 当前 PR 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-service-v1-design.md`
  - 记录 service 目标、可信输入、禁止输入、事务边界、repository result 映射、API 错误响应、审计边界、DTO 边界、测试规划和后续拆分。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-service-v1.md`
  - 记录当前 docs-only PR 的检查结论、文件职责、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 写入 service Plan Mode 状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的当前能力和剩余缺口。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 当前 PR 执行清单

### 一、创建 service 设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-service-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划 service 边界，不实现代码。
- [x] 写明后续 service 目标。
- [x] 写明 service 输入只能来自服务端可信来源和 parser 输出。
- [x] 写明 service 不接受 body / query / header / localStorage `tenantId`。
- [x] 写明 service 不接受凭证、raw HIS payload、完整请求 / 响应体、SQL、stack 或 `DATABASE_URL`。
- [x] 规划 create / update 事务边界。
- [x] 规划 repository result 映射。
- [x] 规划 API 错误响应边界。
- [x] 规划审计写入边界。
- [x] 规划 DTO 最小化边界。
- [x] 规划后续 service tests 和 API route tests。
- [x] 给出后续小步拆分建议。

### 二、创建 service 计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-service-v1.md`

待完成事项：

- [x] 记录只读检查文件和结论。
- [x] 记录当前 PR 文件职责。
- [x] 记录当前 docs-only 执行清单。
- [x] 记录验证命令。
- [x] 记录停止条件。

### 三、轻量同步项目文档

修改文件：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

待完成事项：

- [x] README 增加 Phase 23 写入 service Plan Mode 状态。
- [x] roadmap 增加写入 service 规划状态和剩余缺口。
- [x] devlog 追加本分支、目标、完成项、边界和验证命令。

### 四、验证 docs-only diff

运行命令：

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
按本 PR 要求执行中文化残留检查
```

预期结果：

- `git status --short` 只显示允许范围内文档变更。
- `git diff --name-only origin/main...HEAD` 只包含允许范围内文档。
- `git diff --stat origin/main...HEAD` 只展示文档变更。
- `git diff --check origin/main...HEAD` 通过。
- 中文化残留检查无本次新增英文模板字段。
- 禁止范围检查确认 changed files 不包含 `src/**`、API route、service、repository、parser、权限文件、schema / migration、`package.json`、lockfile、`.codex`、Superpowers 缓存目录或技能文件。

## 后续 PR 拆分建议

- service 最小实现。
- service tests。
- 审计 reason 补强。
- create / update API route Plan Mode 或实现。
- API route tests。
- pause / resume / revoke / delete API 权限 Plan Mode。
- 凭证管理 Plan Mode。
- 测试连接 Plan Mode。
- 真实 HIS adapter Plan Mode。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写 service 代码。
- 必须新增 API route。
- 必须修改现有 API route。
- 必须修改 parser。
- 必须修改 repository。
- 必须修改权限实现或权限测试。
- 必须改 schema 或 migration。
- 必须写审计实现。
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
