# 数据清理与真实租户用户闭环方案

> **面向 agentic worker 的要求：** 本文是方案文档，不是执行授权。后续若进入实现或数据操作，必须先使用 `superpowers:writing-plans` 产出逐步实施计划，并在执行前再次确认数据备份、目标环境和审批边界。

**目标：** 清空本地和测试服务器中现有 demo 租户、用户及其关联业务数据，并让后续租户、用户、套餐、配额和统计只从真实数据库写入流程派生。

**方案架构：** 先把 demo seed 与真实运行数据彻底分层，再对本地和测试服执行可回滚的数据归零，最后补齐真实租户/用户创建闭环。GitHub 远程侧没有运行时数据库，治理重点是移除或隔离会重新写入 demo 租户/用户的 seed 入口。

**技术栈：** Next.js、React、PostgreSQL、Drizzle、Vitest、PM2、pnpm、SSH 测试服 release 发布。

---

## 一、当前基线

- 日期：`2026-06-22`
- 当前分支：`feat/platform-tenant-management-v11-ui-01`
- 当前 HEAD：`7120c360cb7caaadc36015c8bc54f67b36d898ad`
- `origin/main`：`9884bdd231a8ff4753995bb692df04e9cc66fe7c`
- 当前任务：数据清理方案-01
- 本轮不是：DB 删除执行、schema 修改、migration、SQL 脚本落地、真实租户创建实现、真实用户创建实现、生产配置变更。

## 二、用户意图复述

用户希望当前本地系统、GitHub 远程代码和测试服务器中，不再保留随 seed 生成的 demo 租户或用户数据。后续需要租户或用户时，由用户明确提供信息，再通过真实创建流程写入数据库，并且这些数据必须能和系统统计、套餐、配额、审计、权限联动。

该目标包含三个不同层面：

- 本地数据库：清理本地现有租户、用户和关联业务数据。
- 测试服务器数据库：清理测试服现有 demo seed 数据。
- GitHub 远程代码：治理 `src/server/db/seed-demo-data.ts` 和 `package.json` 的 `db:seed`，避免后续误把 demo 数据重新写入真实环境。

## 三、用户已确认的执行口径

- 套餐目录先不清除：`tenant_plans` 暂时保留，作为后续真实租户创建时可选择的套餐目录。
- 本地和测试服审计记录允许清理：清理范围包含 demo 租户、demo 用户、demo 客户和 demo 业务记录相关审计；如果后续执行“完全归零”，本地剩余审计也可清除。
- 测试服允许进入完全无租户状态：清理后测试服平台端应展示租户空状态，不再显示 seed 租户、seed 成员、seed 客户和 seed 业务统计。
- 未来真实创建入口已确认采用“API/service 先行，平台后台 UI 承载，运维脚本只做兜底”的路线。

## 四、只读盘点结果

### 本地数据库

本地当前租户和业务主数据已经基本为空：

| 表 | 当前数量 |
| --- | ---: |
| `tenants` | 0 |
| `tenant_members` | 0 |
| `customers` | 0 |
| `appointments` | 0 |
| `treatment_summaries` | 0 |
| `follow_up_tasks` | 0 |
| `tenant_plans` | 0 |
| `tenant_plan_assignments` | 0 |
| `tenant_quota_snapshots` | 0 |
| `audit_events` | 233 |
| `homepage_brand_audit_logs` | 31 |
| `platform_ai_model_config_snapshots` | 1 |

本地重点不是清租户，而是决定是否清空带用户标识的审计和配置快照记录。

### 测试服务器数据库

测试服务器当前 release：`7120c360cb7caaadc36015c8bc54f67b36d898ad`。

测试服当前存在完整 demo seed：

| 表 | 当前数量 |
| --- | ---: |
| `tenants` | 4 |
| `tenant_members` | 5 |
| `customers` | 10 |
| `appointments` | 5 |
| `treatment_summaries` | 7 |
| `follow_up_tasks` | 4 |
| `audit_events` | 14 |
| `tenant_plans` | 4 |
| `tenant_plan_assignments` | 4 |
| `tenant_quota_snapshots` | 4 |
| `homepage_brand_audit_logs` | 1 |

测试服 4 个租户为：

- `demo-tenant-001`：星澜医美中心
- `demo-tenant-002`：青禾皮肤管理
- `demo-tenant-003`：澄镜医疗美容
- `demo-tenant-004`：远山医美连锁

这些数据来自 `src/server/db/seed-demo-data.ts`，不是本轮 UI 同步创建出来的。

## 五、数据分类与清理边界

### 必须清理的租户作用域数据

这些表直接代表租户、用户、客户或租户业务记录，归零目标应覆盖：

- `follow_up_tasks`
- `treatment_summaries`
- `appointments`
- `customers`
- `tenant_quota_snapshots`
- `tenant_plan_assignments`
- `tenant_members`
- `tenants`
- `audit_events` 中与 demo tenant、demo user 或 demo resource 相关的记录

### 需要保留的数据

`tenant_plans` 不是租户实例数据，而是套餐目录。当前测试服的套餐目录来自 demo seed：

- `starter-care`
- `growth-care`
- `trial-care`
- `enterprise-care`

用户已确认：**套餐目录先不要清除。**

因此第一轮数据库归零只清理租户实例、成员、客户、预约、摘要、随访、套餐分配、配额快照和审计记录，不删除 `tenant_plans`。后续应单独治理套餐目录来源，把它从 demo seed 中迁移为正式套餐配置或后台维护流程。

### 不应在本轮清理的系统配置

以下内容不是租户/用户数据，清理会影响平台配置，不应混入第一轮：

- `platform_ai_provider_configs`
- `platform_ai_model_config_snapshots`
- `homepage_brand_configs`
- `homepage_brand_assets`
- `homepage_brand_versions`
- 静态上传文件和首页品牌资源

但如果用户要求“所有用户痕迹归零”，可在后续单独处理 `homepage_brand_audit_logs` 和 `platform_ai_model_config_snapshots.updated_by` 相关记录。

### 当前为空但需要纳入防回归检查的租户作用域表

这些表当前本地和测试服大多为 0，但后续真实租户创建和清理验证需要覆盖：

- `his_connections`
- `his_connection_credential_compensation_operations`
- `his_connection_credential_compensation_jobs`
- `knowledge_sources`
- `knowledge_documents`
- `knowledge_chunks`
- `knowledge_chunk_embeddings`
- `knowledge_index_jobs`
- `knowledge_document_files`
- `knowledge_document_file_parses`
- `knowledge_document_file_parse_chunks`
- `knowledge_document_file_parse_chunk_embeddings`
- `knowledge_qa_audit_logs`
- `platform_knowledge_institution_visibility`

## 六、GitHub 远程代码治理

GitHub 远程没有数据库数据，但当前仓库包含 demo seed 写入入口：

- `src/server/db/seed-demo-data.ts`
- `package.json` 中的 `db:seed`
- 大量测试直接复用 seed fixture。

推荐分两阶段治理：

### 阶段 A：先禁用运行时误写入

- 保留 seed fixture 以维持测试稳定。
- 将 `db:seed` 从普通脚本入口移除或改名为更明确的 `db:seed:demo:dangerous`。
- 在 README 或治理文档中明确：demo seed 不允许在测试服或生产库运行。
- 保留 `assertDemoSeedExecutionAllowed()` 的生产保护，并增加对测试服务器环境的显式阻断。

### 阶段 B：拆分测试 fixture 与真实初始化

- 将测试依赖的 demo 数据从 runtime seed 中拆出为测试 fixture。
- 新增正式套餐目录初始化路径，但不写任何租户、用户、客户、预约或审计。
- 后续真实租户创建流程只通过受控 service / API 写入。

## 七、数据归零执行原则

本方案不直接执行清理。执行时必须满足：

1. 明确目标环境：本地、测试服，或两者。
2. 执行前备份数据库。
3. 备份文件校验可读，并记录时间戳。
4. 先停写入入口或确认系统处于无人操作窗口。
5. 在单个事务内按外键依赖顺序清理。
6. 清理后立即跑只读计数检查。
7. 重启测试服应用并验证 UI 空状态。
8. 保留回滚路径。

## 八、建议的清理顺序

实际执行计划必须基于数据库外键再次确认。根据当前 schema，建议顺序为：

1. 清理随访任务：`follow_up_tasks`
2. 清理治疗摘要：`treatment_summaries`
3. 清理预约：`appointments`
4. 清理客户：`customers`
5. 清理 HIS / 知识库等租户作用域子表
6. 清理配额快照：`tenant_quota_snapshots`
7. 清理套餐分配：`tenant_plan_assignments`
8. 清理租户成员：`tenant_members`
9. 清理租户：`tenants`
10. 清理审计记录：`audit_events`
11. 按用户确认清理品牌和平台配置审计中的用户痕迹

明确不清理：

- `tenant_plans`

## 九、归零后的验收口径

### API 验收

- `GET /api/open-platform/tenants` 返回 `records: []`。
- 租户管理首页显示暂无租户空状态。
- 平台总览不再由 demo 租户派生租户数量、套餐覆盖率、配额风险和拒绝审计信号。
- 机构端在无租户上下文时应稳定显示未配置或未授权状态，不泄露错误详情。

### 数据库验收

核心表应满足：

| 表 | 期望 |
| --- | --- |
| `tenants` | 0 |
| `tenant_members` | 0 |
| `customers` | 0 |
| `appointments` | 0 |
| `treatment_summaries` | 0 |
| `follow_up_tasks` | 0 |
| `tenant_plan_assignments` | 0 |
| `tenant_quota_snapshots` | 0 |
| `audit_events` | 本地和测试服允许归零 |
| `tenant_plans` | 保留 |

### 前端验收

- 平台端「租户管理」展示空状态。
- 不展示星澜医美中心、青禾皮肤管理、澄镜医疗美容、远山医美连锁。
- 不展示 demo user、demo customer、demo audit。
- 新建租户流程仍保持 UI-only，直到真实创建任务另行批准。

## 十、真实租户和用户创建闭环方向

后续真实创建能力不应复用 demo seed。推荐拆成三个独立任务：

### 已确认路线：API/service 先行，平台后台 UI 承载

建议不要把“真实租户创建”先做成运维脚本，也不要只做成前端 UI 表单。最稳妥的顺序是：

1. 先做服务端 API 和事务 service：把真实创建规则、权限、校验、审计和回滚放在后端。
2. 再让平台后台 UI 调用这个 API：管理员在页面上创建租户，但所有真实写库动作都由后端统一完成。
3. 运维脚本只作为受控兜底：用于一次性修复、数据导入或紧急补录，不作为日常创建入口。

理由：

- API/service 是统计联动的唯一可信入口，能保证 `tenants`、`tenant_members`、套餐分配、配额快照和审计在一个事务里一致写入。
- 平台后台 UI 对你最友好，后续你给出机构信息后，可以通过页面完成创建和复核。
- 运维脚本容易绕开权限、校验和审计，不适合成为长期日常入口。

### 任务 1：真实创建后端 API 与事务 service

目标：用户明确给出租户信息后，写入租户主体、套餐分配、初始配额快照、初始管理员成员和审计。

一次真实创建至少应写入：

- `tenants`
- `tenant_plan_assignments`
- `tenant_quota_snapshots`
- `tenant_members` 中的初始管理员成员
- `audit_events`

要求：

- tenant id 由服务端生成或由用户明确确认，不使用 `demo-*`。
- 手机号、邮箱只保存脱敏或受控字段。
- 创建成功后平台统计从这些记录派生。
- 失败时事务回滚，不留下半租户。

### 任务 2：平台后台真实创建 UI

目标：把当前 UI-only 新建租户流程接入真实 API，但仍保留提交确认、审计摘要和敏感信息脱敏展示。

边界：

- 不展示明文密码。
- 不允许前端直接拼接数据库写入。
- 不绕过服务端校验和审计。

### 任务 3：真实套餐目录治理

目标：保留现有 `tenant_plans`，但把套餐目录来源从 demo seed 迁移为正式配置口径。

边界：

- 不创建租户。
- 不创建客户。
- 不创建预约、随访或摘要。

### 任务 4：真实用户和认证模型补齐

当前 `tenant_members` 只有成员关系和 `userId`，不是完整用户账号表。若要支持真实用户，需要先明确：

- 是否新增用户账号表。
- 登录凭证如何保存。
- 初始管理员如何激活。
- 是否允许测试服真实登录。
- 用户和租户成员、审计 actor 的一致性约束。

该任务可能涉及 schema、migration、认证和凭证边界，必须单独审批。

## 十一、风险与回滚

### 主要风险

- 清理顺序错误导致外键失败。
- 误清平台配置或品牌配置。
- 测试服清理后机构端演示入口无数据，部分页面需要空状态兜底。
- 测试依赖 demo seed，如果直接删除 seed 文件会造成大量测试失败。
- 真实用户创建涉及认证、凭证、审计和租户隔离，不能和清库混在一个任务里。

### 回滚策略

- 执行前必须备份本地和测试服数据库。
- 每次清理使用单独时间戳记录备份文件。
- 如 UI 或 API 验证失败，优先回滚数据库备份。
- 测试服 release 可继续通过 `/www/wwwroot/zmtg-clean/current` 软链回滚代码版本。

## 十二、建议的执行拆分

### PR 1：docs-only 数据清理方案

只提交本文档，不改 runtime，不清 DB。

验证：

- `git diff --check`

### PR 2：禁用 demo seed 运行入口

目标：防止 GitHub 远程代码继续暴露普通 `db:seed` 入口。

可能修改：

- `package.json`
- `src/server/db/seed-demo-data.ts`
- README 或治理文档
- seed 相关测试

验证：

- `pnpm test -- Schema.test.ts`
- `pnpm test`
- `pnpm lint`
- `pnpm build`

### 运维任务 1：本地数据库归零

目标：清理本地剩余审计和用户痕迹。

前置：

- 用户已确认允许清理审计记录。
- 如要清理 `homepage_brand_audit_logs`、`platform_ai_model_config_snapshots`，执行前再单独确认。

### 运维任务 2：测试服数据库归零

目标：清理测试服 demo seed 租户、成员、客户、预约、摘要、随访、套餐分配、配额和审计。

前置：

- 测试服数据库备份完成。
- 用户已确认允许测试服进入完全无租户状态。
- 用户已确认 `tenant_plans` 先不清除。

### Runtime 任务 1：真实创建后端 API 与事务 service

目标：建立真实租户创建的唯一可信写入入口。

### Runtime 任务 2：平台后台真实创建 UI

目标：让平台管理员通过后台页面调用真实 API 创建租户。

### Runtime 任务 3：真实套餐目录治理

目标：保留现有套餐目录，同时移除 demo seed 对套餐目录的运行时写入依赖。

### Runtime 任务 4：真实用户账号模型

目标：补齐真实用户账号、认证、激活和审计 actor 一致性。

## 十三、执行前必须由用户确认的问题

已确认：

- `tenant_plans` 保留。
- 本地和测试服审计记录允许清理。
- 测试服允许进入完全无租户状态。

仍需执行前确认：

1. 本地是否清空 `homepage_brand_audit_logs` 和 `platform_ai_model_config_snapshots` 中的用户痕迹？
2. 数据库备份文件保存位置和保留期限。
3. 测试服清理执行窗口。

## 十四、推荐结论

推荐先执行：

1. 保留本文档作为 docs-only 方案。
2. 下一步先做“禁用 demo seed 运行入口”PR，避免清完后又被重新 seed。
3. 再执行测试服和本地数据库备份与归零。
4. 最后按“后端 API 与事务 service -> 平台后台 UI -> 套餐目录治理 -> 真实用户账号模型”的顺序，单独做真实租户/用户创建闭环。

这样能避免最危险的情况：数据库清空了，但 GitHub 里仍有普通 seed 入口，后续一次误操作又把 demo 租户写回测试服。
