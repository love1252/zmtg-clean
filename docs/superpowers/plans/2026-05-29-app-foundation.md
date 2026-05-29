# 应用底座整理实施计划

## 目标

建立「智美天工 Clean」后续阶段可复用的应用底座，让认证类型、工作台配置、页面壳和静态演示数据边界更清晰。

本阶段只做低风险模块边界整理，不引入数据库、不实现正式 RBAC、不改变生产认证策略。核心做法是把页面组件里稳定的配置和类型抽到模块内领域文件，再由页面组件消费这些配置，保持视觉和行为不变。

## 技术范围

使用现有技术栈：

- Next.js App Router
- React
- TypeScript
- Vitest
- Testing Library
- ESLint

## 本阶段范围

适合在 `codex/app-foundation` 分支执行。

本阶段要做：

- 收拢认证角色、会话用户、会话载荷等类型。
- 抽出机构端工作台静态配置。
- 抽出平台端工作台静态配置。
- 补充领域测试，锁住导航唯一性、默认激活项和关键业务入口。
- 保持登录、退出和页面入口行为不变。

本阶段不做：

- 数据库模型或迁移。
- 真实用户、租户、RBAC、权限策略。
- API Key、OAuth、Webhook、签名或密钥存储。
- Agent 调度、知识库、RAG、计费。
- 删除旧功能或大规模重写页面视觉。

## 文件清单

新增文件：

- `src/modules/auth/domain/session.ts`
- `src/modules/auth/tests/AuthSessionDomain.test.ts`
- `src/modules/workspace/domain/institution-dashboard.ts`
- `src/modules/workspace/domain/platform-dashboard.ts`
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`

修改文件：

- `src/modules/auth/server/demo-session.ts`
- `src/modules/auth/components/DemoSessionGate.tsx`
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
- `src/modules/workspace/components/PlatformConsole.tsx`
- `docs/devlog/2026-05-29.md`

## 任务 1：收拢认证会话类型

新增 `src/modules/auth/domain/session.ts`，定义：

- `AUTH_ROLES`
- `AuthRole`
- `AuthSessionUser`
- `AuthSession`
- `AuthSessionPayload`
- `isAuthRole`

新增 `src/modules/auth/tests/AuthSessionDomain.test.ts`，验证：

- 支持的角色边界为 `tenant_admin` 和 `platform_admin`。
- `isAuthRole` 能识别已知角色，并拒绝未知值。

修改：

- `src/modules/auth/server/demo-session.ts` 复用公共认证类型。
- `src/modules/auth/components/DemoSessionGate.tsx` 复用公共角色和会话载荷类型。

验收命令：

```bash
node scripts/run-vitest.mjs run \
  src/modules/auth/tests/AuthSessionDomain.test.ts \
  src/modules/auth/tests/DemoAuthRoutes.test.ts \
  src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

## 任务 2：抽出机构端工作台配置

新增 `src/modules/workspace/domain/institution-dashboard.ts`，承载机构端：

- 导航项。
- 经营指标。
- AI 建议。
- 用户分层或客户分层配置。

修改 `src/modules/workspace/components/InstitutionWorkspace.tsx`：

- 从领域文件读取导航、指标和静态配置。
- 组件只负责渲染和布局，不再内联大段静态配置。

更新 `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`，验证：

- 机构导航标签唯一。
- 只有一个默认激活项。
- 关键入口包含工作台、客户中心、智能随访、客服工作台、预约中心、知识库。
- 指标和建议数量符合预期。

验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

## 任务 3：抽出平台端工作台配置

新增 `src/modules/workspace/domain/platform-dashboard.ts`，承载平台端：

- 导航项。
- 平台指标。
- 系统健康状态。
- 平台能力卡片。

修改 `src/modules/workspace/components/PlatformConsole.tsx`：

- 从领域文件读取静态配置。
- 保持页面展示和行为不变。

继续更新 `WorkspaceDashboardDomain.test.ts`，验证：

- 平台导航唯一。
- 平台指标包含租户、活跃机构、调用量、服务用户、收入、续费率等核心信息。
- 能力卡片包含开放接口治理、模型与智能体监控、权限审计。

验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

## 任务 4：全量验证和开发日志

运行：

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

浏览器冒烟检查：

- `/login` 登录机构演示账号后进入 `/hospital`。
- `/platform-login` 登录平台演示账号后进入 `/open-platform`。
- 退出后回到对应登录页。

更新 `docs/devlog/2026-05-29.md`，记录：

- 新增认证会话领域类型。
- 新增机构端和平台端工作台领域配置。
- 测试和构建结果。
- 风险：当前仍是演示认证，不是正式认证系统。

## 任务 5：发布前交接

提交前确认：

- `git status` 中只包含本阶段相关文件。
- 所有测试命令通过。
- 未修改 `.env`、生产配置、数据库迁移或真实认证逻辑。

发布前需要在 PR 描述里说明：

- 本阶段是应用底座整理。
- 不涉及真实权限、真实租户隔离或生产认证。
- 后续如果进入 RBAC、租户隔离、API Key、OAuth、Webhook，需要重新规划并做安全审查。

## 已完成结果

该计划对应的应用底座整理阶段已完成并进入后续 UI 和业务壳阶段。后续文档应继续使用中文标题和中文说明，代码路径、命令和类型名保持原文。
