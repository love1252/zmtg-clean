# 全项目 Demo/mock/runtime 数据清理审计方案

> **面向 agentic worker 的要求：** 本文是方案文档，不是 runtime 实现授权。后续若进入源码、认证、API、测试、数据库或测试服务器操作，必须先取得用户明确批准，并按实施计划逐步执行。

**目标：** 清点当前仍会进入页面或 API 的 Demo、mock、UI 数据，明确清空、改真实读取、保留测试或后续单独任务的处理决策。

**方案架构：** 先区分“运行时可见数据源”和“测试/seed fixture”，再按认证、机构端业务、平台端 AI/知识库、产品套餐文案四条线分批治理。第一阶段只产出审计方案和实施计划，不修改 `src/**`，不触碰数据库 schema、migration、SQL 或真实外部系统。

**技术栈：** Next.js、React、TypeScript、Vitest、PostgreSQL、Drizzle、现有 demo session、现有只读 API 与平台端 UI。

---

## 一、当前基线

- 日期：`2026-06-22 CST`
- 当前分支：`main`
- 当前本地 HEAD：`6135ebbd7b1f352cf66e0a396be6fb1043d69e3e`
- 当前 `origin/main`：`990521b3188f1d4be56eafd984b52a41e99c99e2`
- 当前状态：本地 `main` 领先远端 1 个提交，工作树干净。
- 当前任务编号：`全项目 Demo/mock/runtime 数据清理审计-01`
- 本轮不是：DB schema、migration、SQL、真实租户创建、真实用户创建、真实认证接入、测试体系删除、套餐目录清除、真实凭证、支付、HIS、外部系统接入。

## 二、用户意图复述

用户希望系统不再把虚拟数据、Demo 数据或 UI 数据当作真实运营状态展示。后续当用户需要租户或用户时，应由用户明确提供信息，再通过真实创建流程写入数据库，并让真实用户、租户、套餐、配额、审计和统计联动。

本方案把该意图拆成两个层次：

1. **运行时治理：** 页面或 API 不应再默认显示 Demo/mock 机构、用户、客户、模型、知识库文件、用量或套餐状态。
2. **测试治理：** 测试 fixture 与 seed 可以保留，但必须隔离在测试/开发边界，不得作为页面或 API 的默认运行时数据源。

## 三、只读扫描证据

本轮扫描使用 `rg` 对 `src/**` 进行只读检索，并排除测试文件后复核运行时命中。结论如下：

| 分类 | 运行时残留位置 | 当前表现 | 处理决策 |
| --- | --- | --- | --- |
| Demo 登录与硬编码用户 | `src/modules/auth/server/demo-session.ts`、`src/app/api/auth/*`、`src/modules/security/server/access-context.ts`、`src/modules/auth/components/ConfiguredLoginPages.tsx` | 登录账号 `admin/admin123`、`platform/admin123`，cookie `zmtg_demo_session`，用户 `demo-user-admin`、`demo-user-platform`，租户 `demo-tenant-001`。 | 最高优先级。后续 runtime 任务应先把 Demo 登录改成受控开发入口或禁用态；真实认证另行单独设计。 |
| 机构端业务 Demo 常量 | `src/modules/institution/domain/customer-records.ts`、`appointment-records.ts`、`followup-workflow.ts`、`treatment-summaries.ts`、`customers.ts`、`appointments.ts`、`followups.ts` | 仍存在 demo 客户、预约、随访、治疗摘要、客户分群、预约管线等静态数组或默认 records。 | 第二优先级。后续任务应删除运行时默认 records，把页面改为 API 空态或未配置态；测试 fixture 另行保留。 |
| 机构首页演示口径 | `src/modules/workspace/domain/institution-dashboard-view-models.ts` | 指标仍出现“当前演示客户”“受控 demo 数据”口径。 | 第二优先级。后续任务改为真实 API 派生或无租户/无数据空态。 |
| 平台 AI 只读 mock | `src/modules/open-platform/mock/platformAiReadonly.ts`、`platformAiModelRegistry.ts`、`platformAiUsageCost.ts`、相关 server contract 与 UI panel | 模型名包含 `Qwen Plus 示例`，状态包含“受控只读示例”，用量说明“估算费用不是正式账单”。 | 第三优先级。后续任务改为配置未接入/无真实用量空态；真实 AI 调用和 Key 管理不进入本清理任务。 |
| 平台 AI 模型配置 mock | `src/modules/open-platform/mock/platformAiModelConfig.ts`、`OpenPlatformAiModelConfigPanel.tsx`、相关 persistence/contract | UI 文案说明“Logo、模型启用和场景默认关系均来自受控示例数据”。 | 第三优先级。后续任务改为空配置、未接入或从真实持久化记录读取；不创建真实密钥。 |
| 平台知识库 mock | `src/modules/open-platform/mock/platformKnowledge.ts`、`platformKnowledgeManagementApiContract.ts`、`platform-knowledge-management-service.ts` | mock 机构 `星澜医美中心`，文件 `星澜医美中心术后护理指南.pdf`，任务、分类、问题和导入记录均为 mock。 | 第三优先级。后续任务改为空数据响应或真实知识库 API 读取；不删除测试 fixture。 |
| 产品与套餐演示文案 | `src/modules/open-platform/components/ProductPlanPanel.tsx` | 文案“演示环境权益词汇，非真实套餐”。 | 低风险独立任务。改成“套餐目录配置”或真实空态，不清除 `tenant_plans`。 |
| seed 与测试 fixture | `src/server/db/seed-demo-data.ts`、大量 `*.test.ts(x)` | 仍大量包含 demo tenant、demo user、mock/seed/demo 标记。扫描命中数很高。 | 不在第一轮删除。拆成测试 fixture 隔离任务，保留测试稳定性。 |

## 四、和既有数据清理方案的关系

已有文档 `docs/superpowers/plans/2026-06-22-data-cleanup-real-tenant-user-plan.md` 关注本地和测试服务器数据库中 demo 租户、用户、客户、预约、随访、摘要和审计记录的归零。

本方案补齐的是另一层：**代码运行时仍会主动生成或展示 Demo/mock 数据。** 即使数据库已经清空，如果页面或 API 仍从 `src/modules/open-platform/mock/**`、`demo-session.ts` 或机构端 domain demo 常量读取，用户仍会在系统里看到“虚拟数据”。

两者关系如下：

- 数据库清理解决“库里有没有 demo 数据”。
- 本方案解决“代码会不会不依赖数据库也显示 demo/mock 数据”。
- 后续真实租户创建解决“后续真实数据如何进入系统并联动统计”。

## 五、清理原则

1. **运行时优先：** 先清理页面和 API 会默认展示的数据源，不从测试 fixture 开始。
2. **测试隔离：** 测试里的 demo/mock 可保留，但命名、路径和导入方向必须表明其只服务测试。
3. **空态优先：** 暂无真实数据源时，页面显示空态或未接入态，不用新 mock 填补。
4. **真实创建另行审批：** 真实租户、真实用户、真实认证和真实 AI 配置不在本轮直接实现。
5. **不破坏套餐目录：** `tenant_plans` 仍按用户确认保留，套餐目录治理单独处理。
6. **不删除测试体系：** 删除测试 fixture 不是目标；目标是防止 fixture 进入运行时。

## 六、推荐方案

### 方案 A：一次性删除全部 demo/mock 源

优点是表面上最彻底。缺点是风险最高，会同时冲击登录、机构端页面、平台 AI、知识库、产品套餐和大量测试。由于当前真实认证和真实用户创建尚未实现，一次性删除会导致系统不可用或测试大面积失效。

结论：不推荐。

### 方案 B：运行时空态优先，测试 fixture 隔离

做法是先让页面/API 不再默认读 demo/mock 源；暂无真实数据时展示空态或未接入态。测试文件和 seed 暂时保留，但不能被运行时路径导入。真实认证、真实租户创建、真实 AI 配置后续单独实现。

优点是符合用户“先清空，后续需要时再真实创建”的目标，风险可控。缺点是需要分批改多个模块。

结论：推荐。

### 方案 C：先实现真实认证和真实创建，再删除 demo/mock

做法是先补齐完整真实用户、租户创建和认证闭环，再清理 demo/mock。优点是业务最终形态完整。缺点是范围过大，会跨 DB、schema、权限、认证、平台 UI、审计和运维，超出当前第一阶段清理目标。

结论：作为后续路线，不作为本轮清理第一步。

## 七、运行时替代策略

### Demo 登录与硬编码用户

第一阶段 runtime 清理不接生产认证。建议先做“安全降级”：

- 保留登录页面，但不展示 `admin123` 明文密码。
- `/api/auth/login` 在未配置真实认证或开发开关时返回“登录方式未配置”。
- 平台端和机构端没有有效 session 时展示登录/未授权状态。
- 后续真实用户创建与认证单独设计，不在此任务中创建 DB 用户表或 OAuth。

### 机构端 demo 业务常量

机构端页面应改为：

- 通过现有 API 或后续真实 API 读取数据。
- 没有租户上下文或数据库 records 为空时显示空态。
- 不再从 domain 层默认 `demoTenantCustomerRecords`、`demoTenantAppointmentRecords`、`demoTenantFollowUpTasks` 或 `demoTenantTreatmentSummaryRecords` 填充页面。
- 测试需要的数据迁到测试 fixture 或测试内联 builder。

### 平台 AI 与知识库 mock

平台端 AI/知识库页面应改为：

- 没有真实配置时展示“未接入”“暂无配置”“暂无用量”“暂无知识库文件”。
- API contract 可以返回空数组和低敏状态，不返回 mock 机构、mock 文件或示例模型。
- 不显示“星澜医美中心”“Qwen Plus 示例”“受控示例用量”等运行时数据。
- 不接真实模型调用、不保存真实 Key、不做外部网络调用。

### 产品与套餐演示文案

产品与套餐页面可以保留套餐目录能力，但文案应从“演示环境权益词汇”改为“套餐目录配置”或“当前暂无套餐目录配置”。不清理 `tenant_plans`。

## 八、测试与 seed 保留边界

允许保留：

- `src/server/db/seed-demo-data.ts`，但只能作为开发/测试 fixture 或危险手动入口，不能作为测试服默认初始化路径。
- `*.test.ts(x)` 中的 `demo-tenant-001`、mock records、Phase 命名和 fixture。
- 测试内用于安全断言的 `mockSeedDemoFlag`。

必须隔离：

- 运行时代码不得从测试 fixture 导入数据。
- 页面/API 不得从 `seed-demo-data.ts` 读取默认业务数据。
- `src/modules/open-platform/mock/**` 如果继续存在，必须不再被运行时页面/API 默认导入；可迁入测试 fixture 或后续删除。

## 九、风险与回滚

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 认证 demo 移除后无法进入系统 | 最高，影响所有页面验证 | 先设计开发开关和未配置态；真实认证单独任务推进。 |
| 机构端 demo 常量删除导致测试失效 | 中高 | 先补测试 fixture，再切运行时导入。 |
| 平台 AI/知识库 mock 清空导致页面信息变少 | 中 | 用明确空态替代，不用新 mock 填充。 |
| seed 删除破坏历史测试 | 中 | 本阶段不删除 seed，只隔离运行时入口。 |
| 误把套餐目录当 demo 删除 | 中 | 明确 `tenant_plans` 保留，不在本轮清理。 |

回滚方式：

- 每批 runtime 清理单独提交。
- 任何一批失败时，可回退该批提交。
- 数据库不在本方案中变更，因此不需要数据库回滚。
- 如果测试 fixture 拆分失败，回退 fixture 拆分提交即可。

## 十、后续 runtime 实施任务拆分

1. **认证 Demo 清理任务：** 移除页面明文密码和硬编码 demo 用户默认登录，改为未配置态或开发开关态。
2. **机构端业务 Demo 清理任务：** 删除运行时默认 demo records，页面改真实 API 空态。
3. **平台 AI mock 清理任务：** AI 模型、用量、配置页面改为空配置/未接入态。
4. **平台知识库 mock 清理任务：** 知识库 API 与页面不再返回星澜医美 mock 数据。
5. **产品套餐文案清理任务：** 改演示文案为正式套餐目录文案，不清套餐目录。
6. **测试 fixture 隔离任务：** 将仍需保留的 demo seed/test 数据标记为测试专用，防止运行时导入。

## 十一、验收标准

- 能列出所有主要运行时 Demo/mock 数据源及处理决策。
- 能区分“页面/API 会显示的数据”和“只存在测试/seed 的 fixture”。
- 每类残留都有明确决策：清空、改真实读取、保留测试、或后续单独任务。
- 文档不授权 runtime 实现，不修改 `src/**`。
- 不触碰 DB schema、migration、SQL、真实认证、真实租户创建、真实用户创建或外部系统。

## 十二、自评

- 无占位或未完成字段。
- 本方案与既有数据库清理方案互补，不重复执行数据库删除。
- 本方案明确保留 `tenant_plans` 和测试 fixture 边界。
- 本方案把真实认证和真实创建拆为后续任务，避免第一阶段范围膨胀。
