# Phase 23 HIS 连接配置写入权限 v1 计划

> 本文档是 Phase 23 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 HIS 连接配置 create / update API 所需写入权限，不实现权限代码，不新增 API、route、service、repository、schema、migration、审计、凭证管理、测试连接或真实 HIS adapter。

## 目标

只规划 HIS 连接配置 create / update API v1 的权限模型补强边界，明确当前权限现状、未来 `open_connection:create` / `open_connection:update` 动作、角色边界、API 权限判断顺序、权限测试和后续拆分。

## 背景说明

当前系统已经完成 HIS 连接配置只读链路、repository 写入链路、create / update API Plan Mode，以及写入 payload parser / DTO helper。下一步 create / update API 接入前，必须先明确写入权限：只读权限 `open_connection:read_own_tenant` 不能放行写入，create / update 必须通过独立权限动作。

当前 PR 不改运行时代码，只把后续权限实现边界拆清楚。

## 技术范围

当前 PR 只涉及 Markdown。

后续如进入权限实现，预计涉及：

- `src/modules/security/domain/access-control.ts`
- `canAccessResource`
- `open_connection`
- `create`
- `update`
- `tenant_admin`
- HIS 连接配置 create / update API route tests

当前 PR 不修改上述源码。

## 只读检查记录

已只读检查：

- `src/modules/security/domain/access-control.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-create-update-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-create-update-api-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

只读结论：

- 当前 main commit 为 `799a299ebdb8d7e88a45551098fb9ef247e7396b`。
- 当前工作区在建分支前为干净状态。
- 当前权限模型已有 `open_connection` 资源和通用 `create` / `update` 动作。
- 当前 `tenant_admin` 对 `open_connection` 只有 `read_own_tenant`。
- 当前没有 `open_connection:create` 或 `open_connection:update` 授权。
- 当前 HIS 连接配置只读 API 只有 list / detail GET。
- 当前写入 parser 只接受 `connectionName`、`sourceSystem`、`vendorType`、`systemType`。
- 当前 repository 已具备 create / update 方法，但 API route 尚未接入。
- PR #129 已要求 create / update API 不得复用 read 权限放行写入。
- PR #130 已完成 parser 和 DTO helper，但不涉及权限模型。

## 当前 PR 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-permission-v1-design.md`
  - 记录写入权限现状、目标动作、角色边界、API 判断顺序、错误边界、权限测试和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-permission-v1.md`
  - 记录当前 docs-only PR 的检查结论、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 写入权限 Plan Mode 状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的当前能力和剩余缺口。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 当前 PR 执行清单

### 一、创建写入权限设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-permission-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划写入权限，不实现代码。
- [x] 写明当前 `tenant_admin` 只有 `open_connection:read_own_tenant`。
- [x] 写明不得复用 `read_own_tenant` 放行 create / update。
- [x] 规划未来权限动作 `open_connection:create` 和 `open_connection:update`。
- [x] 规划 `tenant_admin`、普通机构人员、顾问、客服、平台角色和审计角色边界。
- [x] 规划 API 权限判断顺序。
- [x] 规划权限模型测试和 API 权限测试。
- [x] 明确本 PR 不新增 API、不改 parser、不改 repository、不写审计、不接真实 HIS。
- [x] 给出后续小步拆分建议。

### 二、创建写入权限计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-permission-v1.md`

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

- [x] README 增加 Phase 23 写入权限 Plan Mode 状态。
- [x] roadmap 增加写入权限规划状态和剩余缺口。
- [x] devlog 追加本分支、目标、完成项、边界和验证命令。

### 四、验证 docs-only diff

运行命令：

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

预期结果：

- `git status --short` 只显示允许范围内文档变更。
- `git diff --name-only origin/main...HEAD` 只包含允许范围内文件。
- `git diff --stat origin/main...HEAD` 只展示文档变更。
- `git diff --check origin/main...HEAD` 通过。
- 中文化残留检查按用户指定命令执行；如有输出，只能来自既有历史文档，本次新增两份文档不得新增英文模板字段。

## 后续 PR 拆分建议

- 权限模型实现：只给 `tenant_admin` 增加 `open_connection:create` 和 `open_connection:update`。
- 权限模型测试：覆盖 allowed、role denied、missing tenant 和 cross tenant。
- create / update API service Plan Mode 或最小实现：规划事务、审计和 repository 结果映射。
- 审计 reason 补强：补充权限拒绝、payload 非法、not found 和 conflict 的安全 reason。
- create / update API route 实现：接入 access context、parser、权限判断、service 和错误映射。
- API tests：覆盖未登录、无租户、无权限、read-only 不可写、body tenantId 注入无效和跨租户 update 不暴露存在性。
- pause / resume / revoke / delete 状态 API 权限 Plan Mode。
- 凭证管理 Plan Mode。
- 测试连接 Plan Mode。
- 真实 HIS adapter Plan Mode。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写 TypeScript 代码。
- 必须改测试。
- 必须修改 `src/**`。
- 必须新增 API route。
- 必须新增或修改 service。
- 必须新增或修改 repository。
- 必须改 schema 或 migration。
- 必须真正修改权限、认证或租户隔离实现。
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
- 必须修改 package.json 或 lockfile。
- 必须修改 `.codex`、Superpowers 缓存目录或技能文件。
