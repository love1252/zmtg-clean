# Phase 23 HIS 连接配置 create / update API v1 计划

> 本文档是 Phase 23 Plan Mode。当前 PR 只新增和同步 Markdown，不实现 API、route、服务层、repository、schema、权限、审计、凭证管理、测试连接或真实 HIS adapter。

## 目标

只规划 HIS 连接配置 create / update API v1 的后续实现边界，明确 HTTP 载荷解析器、权限判断、服务层事务、审计写入、DTO 数据最小化、API 错误映射和测试拆分。

## 架构说明

当前系统已经完成 HIS 只读链路和 repository 写入闭环。未来 create / update API 应在 route 层读取服务端 access context，在 parser 层只接受安全元数据，在服务层事务内调用既有 repository 并写安全审计，最后返回最小化 DTO。

当前 PR 不改运行时代码，只把后续实现拆清楚。

## 技术范围

当前 PR 只涉及 Markdown。

后续如进入实现，预计涉及：

- Next.js App Router route
- TypeScript
- Vitest
- Drizzle transaction
- `getDemoAccessContextFromRequest`
- `canAccessResource`
- `createHisConnectionRepository`
- `createAuditEventRepository`
- HIS 连接配置 parser
- HIS 连接配置服务层

## 只读检查记录

已只读检查：

- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
- `src/modules/institution/server/treatment-summary-write-input.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/security/domain/access-control.ts`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-api-v1.md`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-repository-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-repository-v1.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

只读结论：

- 当前 main commit 为 `fdcbe47161a23411c1157dba6745b787039d3586`。
- 当前 HIS route 只有 list / detail GET，没有 POST 或 PATCH。
- GET route 只使用服务端 access context 的 `tenantId`。
- GET DTO 不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw payload。
- repository 已具备 `createHisConnectionForTenant` 和 `updateHisConnectionForTenant`。
- create / update repository 只写 `connectionName`、`sourceSystem`、`vendorType`、`systemType` 等安全元数据。
- repository 状态流转方法也已存在，但本计划不实现状态 API。
- 当前权限模型只给 `tenant_admin` `open_connection:read_own_tenant`，没有 `open_connection:create` 或 `open_connection:update`。
- 现有治疗摘要写入 API 使用 JSON parser、权限判断、事务、repository、审计和安全 DTO 模式。

## 当前 PR 文件职责

- `docs/superpowers/specs/2026-06-03-phase23-his-connection-create-update-api-v1-design.md`
  - 记录 create / update API v1 的边界、输入字段、禁止项、权限、服务层事务、审计、DTO、错误映射、测试和后续拆分。
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-create-update-api-v1.md`
  - 记录当前 docs-only PR 的检查结论、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 create / update API Plan Mode 状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的当前能力和缺口。
- `docs/devlog/2026-06-03.md`
  - 记录本分支、范围、完成项、边界和验证。

## 当前 PR 执行清单

### 一、创建设计文档

修改文件：

- `docs/superpowers/specs/2026-06-03-phase23-his-connection-create-update-api-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，不实现 API、route、服务层、repository、schema、权限、审计、凭证或测试连接。
- [x] 写明 create / update API 只处理 `connectionName`、`sourceSystem`、`vendorType`、`systemType`。
- [x] 写明 `tenantId` 只来自服务端 access context。
- [x] 写明严禁返回 `credentialRef`、token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串、raw HIS payload、完整请求体 / 响应体、SQL、stack、`DATABASE_URL`。
- [x] 规划 HTTP 载荷解析器。
- [x] 规划权限判断。
- [x] 规划服务层事务。
- [x] 规划审计写入。
- [x] 规划 DTO 数据最小化。
- [x] 规划 API 错误映射。
- [x] 规划 create / update API 测试。
- [x] 写明后续 PR 拆分建议。

### 二、创建计划文档

修改文件：

- `docs/superpowers/plans/2026-06-03-phase23-his-connection-create-update-api-v1.md`

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
- `docs/devlog/2026-06-03.md`

待完成事项：

- [x] README 增加 Phase 23 create / update API Plan Mode 状态。
- [x] roadmap 增加 create / update API 规划状态和剩余缺口。
- [x] devlog 记录分支、目标、完成项、边界和验证命令。

### 四、验证 docs-only diff

运行命令：

```bash
git diff --check
git diff --cached --check
git diff --stat docs/superpowers/plans docs/superpowers/specs
git diff --name-only
```

预期结果：

- `git diff --check` 通过。
- `git diff --cached --check` 通过。
- `git diff --stat docs/superpowers/plans docs/superpowers/specs` 只展示本次新增计划和设计文档。
- 中英文模板残留检查如有输出，只能来自既有历史文档；本次新增两份文档不得新增英文模板字段。
- `git diff --name-only` 只包含允许范围内文件。

## 后续 PR 拆分建议

- HTTP 载荷解析器和 parser 测试。
- 权限模型补强 Plan Mode，评估 `open_connection:create` 与 `open_connection:update`。
- create / update API route 和服务层事务实现。
- create / update API 测试。
- pause / resume / revoke / delete 状态 API。
- 审计 reason 补强和审计查询展示边界。
- 凭证管理 Plan Mode。
- 测试连接 Plan Mode。
- 真实 HIS adapter Plan Mode。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写 TypeScript 代码。
- 必须改测试。
- 必须新增 API route。
- 必须新增或修改服务层。
- 必须新增或修改 repository。
- 必须新增 parser。
- 必须改 schema 或 migration。
- 必须改权限、认证或租户隔离。
- 必须写审计实现。
- 必须处理凭证管理。
- 必须做测试连接。
- 必须接真实 HIS、机构系统、企微、AI 或自动触达。
- 必须保存或返回真实凭证。
- 必须保存或返回 raw HIS payload。
- 必须保存完整病历、完整治疗正文或咨询全文。
- 必须自动创建治疗摘要或随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
