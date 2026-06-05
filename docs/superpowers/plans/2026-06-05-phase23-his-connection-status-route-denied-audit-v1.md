# Phase 23 HIS 连接配置状态 API route denied audit v1 实施计划

> 面向执行代理：实施时必须按任务顺序推进；建议使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`，并在每个小任务后运行对应验证。

**目标：** 为 HIS 连接配置状态 API 补齐 route 层 denied audit：权限拒绝写安全 denied audit，parser 失败写安全 denied audit，audit 写入失败 fail closed 返回 `503 service_unavailable`，同时避免重复记录 status service 已负责的 repository 失败审计。

**架构：** 保持现有 status route -> status service -> repository / audit service 职责拆分。route 层只处理 access context、权限、path、最小 body parser、HTTP 映射和 route-level denied audit；status service 继续负责成功 allowed audit 与 repository 稳定非 ok denied audit。

**技术栈：** Next.js App Router、TypeScript、Vitest、现有 `canAccessResource`、现有 audit event factory、现有 audit repository、现有 HIS connection status service。

## 当前事实

- pause / resume / revoke route 已存在，使用 `open_connection:manage_status`。
- DELETE route 已存在，使用 `open_connection:delete`。
- 状态 route 当前已实现 `401`、空 ID `404`、权限拒绝 `403`、parser 失败 `400` 和 status service result 到 HTTP 的稳定映射。
- 状态 route 当前尚未在权限拒绝和 parser 失败时写 route denied audit。
- create / update route 已有 route denied audit helper，可作为安全模式参考，但不得在本计划中修改 create / update 行为。
- status service 已负责成功 allowed audit 和 repository 稳定非 ok denied audit。

## 范围

允许修改：

- `src/app/api/institution/his-connections/[connectionId]/pause/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/resume/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/revoke/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- 必要时最小新增 route audit helper，位置必须靠近 status route 或现有 route helper，输入只允许安全字段。

禁止修改：

- status service。
- parser 公共契约。
- repository。
- 权限模型。
- audit domain / reason / query whitelist。
- audit repository schema。
- database schema / migration。
- 凭证管理。
- 测试连接。
- 真实 HIS adapter。
- demo seed。
- `package.json` 或 lockfile。

## 任务一：补权限拒绝 route audit 的失败用例

文件：

- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`

步骤：

- [ ] 为 pause 权限拒绝添加断言：返回 `403 forbidden` 前写一条 denied audit。
- [ ] 为 resume 权限拒绝添加断言：返回 `403 forbidden` 前写一条 denied audit。
- [ ] 为 revoke 权限拒绝添加断言：返回 `403 forbidden` 前写一条 denied audit。
- [ ] 为 DELETE 权限拒绝添加断言：返回 `403 forbidden` 前写一条 denied audit。
- [ ] 断言 pause / resume / revoke 使用 `resource: open_connection`、`action: manage_status`、`result: denied`。
- [ ] 断言 DELETE 使用 `resource: open_connection`、`action: delete`、`result: denied`。
- [ ] 断言 `resourceId` 来自 trim 后 path `connectionId`。
- [ ] 断言权限拒绝时不读取 body、不调用 status service、不调用真实 HIS、不处理凭证。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/HisConnectionApiRoutes.test.ts
```

预期：

- 新增用例先失败，失败原因指向缺少 route denied audit。

## 任务二：实现权限拒绝 route audit

文件：

- `src/app/api/institution/his-connections/[connectionId]/pause/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/resume/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/revoke/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`

步骤：

- [ ] 在权限拒绝分支写 route denied audit。
- [ ] pause / resume / revoke 使用 `manage_status`。
- [ ] DELETE 使用 `delete`。
- [ ] reason 使用 `canAccessResource` 返回的既有 reason。
- [ ] audit 写入成功时保留原 `403 forbidden`。
- [ ] audit 写入失败时返回 `503 service_unavailable`。
- [ ] audit 写入失败不得调用 status service。
- [ ] 不从 body / query / header 读取 tenant、resourceId 或敏感字段。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/HisConnectionApiRoutes.test.ts
```

预期：

- 权限拒绝 route audit 用例通过。
- 既有状态 API route 用例不回退。

## 任务三：补 parser 失败 route audit 的失败用例

文件：

- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`

步骤：

- [ ] 为 pause parser 失败添加 denied audit 断言。
- [ ] 为 resume parser 失败添加 denied audit 断言。
- [ ] 为 revoke parser 失败添加 denied audit 断言。
- [ ] 为 DELETE parser 失败添加 denied audit 断言。
- [ ] 覆盖 malformed JSON。
- [ ] 覆盖未知字段。
- [ ] 覆盖 body `tenantId` 注入。
- [ ] 覆盖非 string `reasonCode`。
- [ ] 断言 parser 失败 reason 为 `invalid_his_connection_payload`。
- [ ] 断言 parser 失败 audit 成功时返回 `400 validation_failed`。
- [ ] 断言 parser 失败不调用 status service。
- [ ] 断言 audit event 不包含 raw body、body tenantId、凭证、SQL、stack 或 `DATABASE_URL`。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/HisConnectionApiRoutes.test.ts
```

预期：

- 新增 parser 失败 audit 用例先失败，失败原因指向缺少 route denied audit。

## 任务四：实现 parser 失败 route audit

文件：

- `src/app/api/institution/his-connections/[connectionId]/pause/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/resume/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/revoke/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`

步骤：

- [ ] 在权限允许之后、调用 status service 之前处理 parser 失败 route audit。
- [ ] parser 失败 reason 固定为 `invalid_his_connection_payload`。
- [ ] pause / resume / revoke 使用 `manage_status`。
- [ ] DELETE 使用 `delete`。
- [ ] audit 写入成功时保留原 `400 validation_failed`。
- [ ] audit 写入失败时返回 `503 service_unavailable`。
- [ ] audit 写入失败不得调用 status service。
- [ ] 保持权限拒绝时不读取 body。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/HisConnectionApiRoutes.test.ts
```

预期：

- parser 失败 route audit 用例通过。
- 权限拒绝 route audit 用例继续通过。

## 任务五：补不重复审计和不覆盖场景

文件：

- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`

步骤：

- [ ] 断言 `401 unauthorized` 不写 route audit。
- [ ] 断言空 path `connectionId` 的 `404 not_found` 不写 route audit。
- [ ] 断言 status service `not_found` 不额外写 route audit。
- [ ] 断言 status service `conflict` 不额外写 route audit。
- [ ] 断言 status service `invalid_transition` 不额外写 route audit。
- [ ] 断言 status service `validation_failed` 不额外写 route audit。
- [ ] 断言 status service `service_unavailable` 不额外写 route audit。
- [ ] 断言 create / update route 行为未被本次状态 route 改动影响。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/HisConnectionApiRoutes.test.ts
```

预期：

- 所有状态 API route 审计隔离用例通过。

## 任务六：收口验证

命令：

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
node scripts/run-vitest.mjs run src/modules/institution/tests/HisConnectionApiRoutes.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/HisConnectionStatusService.test.ts
node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventsDomain.test.ts
node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventQueryParser.test.ts
./node_modules/.bin/tsc --noEmit
```

预期：

- working tree 只包含本实现 PR 允许范围内文件。
- 不修改 audit reason / action / query whitelist。
- 不修改 status service、repository、权限模型、schema 或 migration。
- 所有指定测试通过。
- typecheck 通过。

## 停止条件

出现以下任一情况必须停止并回报：

- 需要新增 audit reason。
- 需要新增 `pause`、`resume`、`revoke` 或 `soft_delete` action。
- 需要修改 status service。
- 需要修改 repository。
- 需要修改权限模型。
- 需要修改 audit domain / query whitelist。
- 需要修改 schema / migration。
- 需要处理凭证、测试连接或真实 HIS。
- 需要读取或记录 raw request body、raw HIS payload、凭证、SQL、stack 或 `DATABASE_URL`。
