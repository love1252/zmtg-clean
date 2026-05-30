# 租户隔离与 RBAC 第一阶段执行交接

## 当前状态

- 项目目录：`/Users/dongxiaolong/Documents/zmtg-clean`
- 当前分支：`codex/tenant-rbac-phase1-design`
- 当前分支用途：承载租户隔离与 RBAC 第一阶段的设计文档和实施计划，尚未开始写实现代码。
- 主线状态：`main` 已合并机构端业务壳和开放平台治理第一阶段。
- 当前分支最新提交：
  - `ac82f84 新增租户隔离与权限底座实施计划`
  - `8a6d914 新增租户隔离与权限底座设计`
  - `4b0041c Merge pull request #5 from love1252/codex/institution-business-shell-phase1`
  - `deb3b03 Merge pull request #6 from love1252/codex/open-platform-governance-phase1-plan`

## 新窗口接手目标

继续执行「租户隔离与 RBAC 第一阶段」任务。这个阶段只做服务端可信访问上下文、权限领域模型、命名对齐、安全说明和测试底座，不做数据库迁移，不接真实生产权限系统，不实现 API Key、OAuth、Webhook 签名或真实租户数据写入。

请不要回到 PR #4 视觉验收，也不要重新扫描旧项目。以当前工作区代码、`git status`、设计文档和实施计划为准。

## 必读文档

1. 设计文档：`docs/superpowers/specs/2026-05-30-tenant-rbac-phase1-design.md`
2. 实施计划：`docs/superpowers/plans/2026-05-30-tenant-rbac-phase1.md`

实施时以实施计划为主，设计文档用于确认边界、风险和命名约束。

## 建议接手命令

```bash
cd /Users/dongxiaolong/Documents/zmtg-clean
git status -sb
git branch --show-current
```

确认当前分支是 `codex/tenant-rbac-phase1-design` 后，建议从当前分支创建实施分支：

```bash
git switch -c codex/tenant-rbac-phase1
```

这样可以把设计文档、实施计划和后续实现放在同一个 PR 链路里。如果用户明确要求继续在当前分支实现，也可以直接继续当前分支。

## 执行入口

从实施计划的「任务 1：扩展认证角色边界」开始执行：

`docs/superpowers/plans/2026-05-30-tenant-rbac-phase1.md`

建议按计划顺序推进：

1. 扩展认证角色边界。
2. 新增访问控制领域模型。
3. 从演示会话转换服务端访问上下文。
4. 对齐开放平台治理领域命名。
5. 新增安全文档。
6. 运行全量验证并准备 PR。

每个任务尽量先补测试，再补实现。遇到权限、租户隔离、审计、安全相关边界时，不要临时扩大范围，先回到设计文档确认。

## 预计改动文件

实施计划中预计涉及这些文件：

- `src/modules/auth/server/demo-session.ts`
- `src/modules/auth/tests/DemoAuthRoutes.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/server/access-context.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/security/tests/AccessContext.test.ts`
- `src/modules/open-platform/domain/platform-governance.ts`
- `src/modules/open-platform/tests/PlatformGovernanceDomain.test.ts`
- `docs/security/tenant-rbac-phase1.md`

如实际代码结构变化，以当前本地代码为准，但不要顺手做跨模块重构。

## 必守边界

- 租户身份必须来自服务端会话或可信访问上下文。
- 不允许从 `localStorage`、查询参数、请求体里的 `tenantId` 推导授权结果。
- 平台级角色不默认拥有客户隐私数据访问权。
- 未识别的角色、资源或动作必须默认拒绝。
- 本阶段不做数据库迁移。
- 本阶段不修改 `.env` 或生产配置。
- 本阶段不引入新依赖，除非用户明确确认。
- 本阶段不实现真实 API Key、OAuth、Webhook 签名或 Agent 工具授权。
- 文档、PR 标题、PR 正文、提交说明尽量使用中文；代码标识符、命令、路径可以保留英文。

## 验证命令

完成实现后至少运行：

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
node scripts/run-next.mjs build --webpack
./node_modules/.bin/tsc --noEmit
```

已知历史情况：当前项目里 `src/modules/auth/components/LuxuryLoginShell.tsx` 曾存在一个 `@next/next/no-img-element` 警告；如果仍然出现，需要在总结里如实说明。

## 开发服务器提示

可能仍有一个开发服务器在 `5010` 端口运行：

```bash
node scripts/run-next.mjs dev --webpack --port 5010
```

如果切换分支后页面热更新异常，先看终端输出。若开发服务器改动了 `next-env.d.ts`，需要确认它是否只是在 `./.next/types/routes.d.ts` 和 `./.next/dev/types/routes.d.ts` 之间切换，避免把无关生成变化混入提交。

## 完成标准

- 实施计划里的任务完成。
- 新增和修改的测试通过。
- `eslint`、`vitest`、`next build`、`tsc --noEmit` 完成并记录结果。
- 提交信息使用中文。
- PR 标题和正文使用中文。
- 推送或创建 PR 前先向用户确认。

## 风险提醒

这是权限和租户隔离底座任务，完成后必须提醒用户进入 review。重点审查：

- 是否破坏租户隔离。
- 是否存在越权访问。
- 是否缺少输入校验。
- 是否泄露 API Key 或 Token。
- 是否有前后端类型不一致。
- 是否缺少测试。
- 是否影响现有演示登录、机构端页面或开放平台治理页面。
