# 智美天工 V1 机构端与平台端管理测试计划 01

任务编号：`ZMTG-V1-INSTITUTION-PLATFORM-MANAGEMENT-TEST-PLAN-01`

生成日期：2026-06-11

本文档用于把机构端管理、平台端管理、权限、租户隔离、功能开关、配额、知识库配置、AI 配置、审计、风控和监控等能力拆成后续可验证的测试断言。本文档是 test-plan-only，不是测试实现，不是 runtime 授权，不是上线准备，不是试点授权，也不是后续任务队列。

## 1. 当前阶段结论

- 智美天工不是 HIS 系统。
- 智美天工是面向医美 / 美业机构的 AI 客户运营中台。
- 当前主线是治疗后客户运营闭环。
- 当前已有内部 demo / 局部 runtime 基础，但 V1 主业务闭环仍未真实端到端跑通。
- 当前机构端管理尚未形成完整后台。
- 当前平台端管理尚未形成完整 SaaS 管理后台。
- 当前不能接真实 HIS、真实 credential、真实客户数据或真实模型。
- 本文档是 test-plan-only，不是测试实现，不是 runtime 授权。

## 2. 测试计划目标

本测试计划只定义未来测试断言，用于后续验证以下边界：

- 机构端管理边界。
- 平台端管理边界。
- tenant guard。
- RBAC。
- quota。
- feature flag。
- 审计低敏边界。
- 知识库配置边界。
- AI 配置边界。
- HIS connection 配置边界。

当前不写测试、不新增测试文件、不开发、不实现 runtime、不修改 UI / API / DB / schema。

## 3. 测试范围内

| 范围 | 未来测试目的 | 当前边界 |
|---|---|---|
| 机构基础设置边界 | 验证机构端只能表达当前租户内基础设置边界。 | 不实现设置 runtime。 |
| 门店 / 部门 / 项目组边界 | 验证组织层级、归属和可见范围的未来断言。 | 不实现组织架构 runtime。 |
| 员工管理边界 | 验证员工状态、角色归属和停用边界的未来断言。 | 不处理真实员工隐私数据。 |
| 角色 / 权限边界 | 验证机构角色、平台角色和权限拒绝边界。 | 不实现 RBAC runtime。 |
| 客户运营配置边界 | 验证运营配置只能作为配置或观察条件。 | 不实现 opportunity runtime。 |
| 客户标签 / 分层配置边界 | 验证标签和分层只能低敏表达。 | 不生成高敏画像。 |
| 复诊规则配置边界 | 验证复诊规则不等于真实约诊或 HIS 同步。 | 不自动约诊。 |
| 复购规则配置边界 | 验证复购规则不等于成交、支付或营销。 | 不自动营销。 |
| 沉睡客户规则配置边界 | 验证沉睡规则不等于自动外呼或自动消息。 | 不自动触达。 |
| 随访 SOP 配置边界 | 验证随访 SOP 只是内部流程候选。 | 不发送外部消息。 |
| 内部任务规则配置边界 | 验证任务规则不自动创建任务 / 预约 / 成交。 | 不扩展任务能力。 |
| 机构知识库配置边界 | 验证机构知识库只能在租户内生效。 | 不实现知识库 runtime。 |
| 机构 AI 配置边界 | 验证 AI 配置只规划开关、角色、场景、人审和禁用策略。 | 不接真实模型。 |
| HIS connection 配置边界 | 验证只表达元数据和低敏状态。 | 不接真实 HIS，不处理 credential。 |
| 机构审计可见范围 | 验证机构侧审计只保留低敏摘要。 | 不记录高敏原文。 |
| 额度 / 用量查看边界 | 验证额度和用量只是规划边界。 | 不实现 quota runtime。 |
| 平台租户管理边界 | 验证租户状态、内部 demo / 试用 / 正式状态区分。 | 不代表可上线。 |
| 平台套餐 / 配额边界 | 验证套餐和配额不等于计费或支付。 | 不实现支付、合同或发票。 |
| 平台功能开关边界 | 验证 feature flag 只作为未来能力边界。 | 不实现 feature flag runtime。 |
| 平台知识库管理边界 | 验证平台知识库发布、下架、回滚和适用租户范围。 | 不实现知识库 runtime。 |
| 平台 AI 管理边界 | 验证模型用途、开关、额度、成本、审计和安全边界。 | 不接真实模型或 credential。 |
| 平台审计 / 风控 / 监控边界 | 验证低敏审计、风控和监控候选断言。 | 不实现 audit runtime 或 monitoring runtime。 |

## 4. 测试范围外

本测试计划不覆盖，也不授权以下内容：

- runtime 实现。
- UI 实现。
- API / route 实现。
- service / repository / DTO 实现。
- schema / migration / SQL 实现。
- 机构端管理 runtime。
- 平台端管理 runtime。
- feature flag runtime。
- quota runtime。
- audit runtime。
- field whitelist enforcement runtime。
- 知识库 runtime。
- AI runtime。
- 真实模型接入。
- embedding / 向量库。
- RAG runtime。
- 真实 HIS。
- 真实 credential。
- 真实客户数据。
- 自动营销 / 自动触达。
- 任务 / 预约 / 成交 / 支付 / 合同 / 发票扩展。

## 5. 机构端管理测试断言

### 5.1 机构基础设置

- 未来测试应断言机构端只能读取 / 配置当前租户范围内的机构资料。
- 未来测试应断言机构基础设置不得暴露其他租户信息。
- 未来测试应断言输出中禁止出现 credential、token、secret、HIS raw payload、DB URL、SQL、stack。
- 当前不实现机构基础设置 runtime，不写 UI，不写 API。

### 5.2 员工 / 角色 / 权限

- 未来测试应断言机构角色只能影响机构内权限。
- 未来测试应断言平台角色与机构角色不得混用。
- 未来测试应断言权限拒绝时不得泄露对象详情。
- 未来测试应断言权限变更必须有低敏审计计划。
- 当前不实现员工、角色、权限 runtime。

### 5.3 客户运营配置

- 未来测试应断言复诊 / 复购 / 沉睡规则只能作为配置或观察条件。
- 未来测试应断言不得自动创建任务 / 预约 / 成交。
- 未来测试应断言不得自动营销 / 自动触达。
- 未来测试应断言不得把配置视为 opportunity runtime 已实现。
- 当前不实现客户运营配置 runtime。

### 5.4 机构知识库配置

- 未来测试应断言机构知识库只能在租户内生效。
- 未来测试应断言机构知识库不得跨租户引用。
- 未来测试应断言机构知识库不得处理真实客户数据。
- 未来测试应断言机构知识库配置不得被视为知识库 runtime 已实现。
- 当前不实现知识库 runtime，不新增索引、检索、embedding 或 RAG。

### 5.5 机构 AI 配置

- 未来测试应断言 AI 配置只能规划开关、角色、场景、人审和禁用策略。
- 未来测试应断言不得接真实模型。
- 未来测试应断言不得自动触达客户。
- 未来测试应断言不得承诺疗效。
- 未来测试应断言不得自动创建任务 / 预约 / 成交。
- 当前不实现 AI runtime，不接真实模型，不处理真实客户数据。

### 5.6 HIS connection 配置

- 未来测试应断言 HIS connection 配置只验证元数据和低敏状态。
- 未来测试应断言 fake test connection 不得被断言为真实 HIS 已接通。
- 未来测试应断言不得处理真实 credential。
- 当前不接真实 HIS，不读取真实 credential，不处理 HIS raw payload。

## 6. 平台端管理测试断言

### 6.1 租户管理

- 未来测试应断言平台可管理租户状态边界，但不得绕过 tenant guard。
- 未来测试应断言内部 demo / 试用 / 正式状态必须区分。
- 未来测试应断言当前不得断言真实客户上线条件已具备。
- 当前不实现平台租户管理 runtime。

### 6.2 套餐 / 配额

- 未来测试应断言套餐 / 配额只能作为规划边界。
- 未来测试应断言不得实现计费、支付、合同、发票。
- 未来测试应断言超限和降级必须低敏表达。
- 当前不实现 quota runtime，不实现计费或财务能力。

### 6.3 功能开关

- 未来测试应断言 feature flag 只作为未来能力边界。
- 未来测试应断言不得断言 feature flag runtime 已实现。
- 未来测试应断言禁用状态不得泄露被禁用能力的详情。
- 当前不实现 feature flag runtime。

### 6.4 平台知识库管理

- 未来测试应断言平台知识库管理只规划发布、下架、回滚、适用租户范围。
- 未来测试应断言不得实现知识库 runtime。
- 未来测试应断言不得跨租户暴露机构知识。
- 当前不实现知识库 runtime，不处理真实客户数据。

### 6.5 平台 AI 管理

- 未来测试应断言平台 AI 管理只规划模型用途、开关、额度、成本、审计、安全。
- 未来测试应断言不得接真实模型或真实 credential。
- 未来测试应断言不得绕过机构权限使用真实客户数据。
- 当前不实现 AI runtime，不接真实模型。

### 6.6 审计 / 风控 / 监控

- 未来测试应断言审计只记录低敏摘要。
- 未来测试应断言不记录 credential、token、secret、HIS raw payload、DB URL、SQL、stack。
- 未来测试应断言风控 / 监控不得被写成 runtime 已实现。
- 当前不实现 audit runtime、field whitelist enforcement runtime 或 monitoring runtime。

## 7. 权限与租户隔离测试断言

| 断言方向 | 未来测试应验证 | 当前边界 |
|---|---|---|
| tenant guard | 所有机构端管理候选能力只能作用于当前租户。 | 不实现 tenant guard runtime。 |
| RBAC | 机构角色和平台角色必须按职责边界区分。 | 不实现 RBAC runtime。 |
| 平台角色 | 平台角色不得被当成机构内操作权限。 | 不处理真实客户数据。 |
| 机构角色 | 机构角色不得被当成平台后台权限。 | 不访问平台后台。 |
| 跨租户访问禁止 | 跨租户读取、配置、知识引用和审计查询必须被禁止。 | 不暴露目标租户是否存在。 |
| 权限拒绝不泄露对象详情 | 权限拒绝只能返回低敏拒绝口径。 | 不回显对象明细。 |
| quota denied 不泄露细节 | 配额拒绝只能表达能力不可用或超限。 | 不暴露套餐内部策略。 |
| feature disabled 不泄露细节 | 功能关闭只能表达能力未开启或不可用。 | 不绕过开关返回真实数据。 |
| 审计只保留低敏摘要 | 审计只保留操作者角色、动作类别、结果和低敏原因。 | 不记录高敏原文、credential 或 stack。 |

## 8. 禁止字段 / 禁止语义清单

未来测试中应禁止出现以下字段和语义：

```text
credential
credentials
token
secret
password
HIS raw payload
hisRawPayload
DATABASE_URL
DB_URL
SQL
stack
真实 HIS 已接通
真实客户数据
真实模型
自动营销
自动触达
创建任务
创建预约
成交
支付成功
合同
发票
可上线
可试点
生产数据
```

上述清单只用于未来测试计划，不代表当前已实现字段检查、拦截、脱敏或 enforcement runtime。

## 9. 建议未来测试文件候选

以下路径只是未来 test-only 候选，不在本任务中创建：

```text
src/modules/workspace/tests/V1InstitutionPlatformManagementBoundary.test.ts
src/modules/workspace/tests/V1InstitutionManagementReadonlyBoundary.test.ts
src/modules/workspace/tests/V1PlatformManagementReadonlyBoundary.test.ts
```

- 当前不创建这些测试文件。
- 当前不写测试。
- 当前只是 test-plan-only。
- 任何 test-only 任务必须由用户单独授权，并保持最小修改范围。

## 10. 后续 Go / No-Go 规则

| 类型 | 结论 | 规则 |
|---|---|---|
| test-plan-only | GO | 可以继续，但只能新增或修改明确授权的测试计划文档。 |
| read-only | GO | 可以继续，用于复核机构端、平台端、知识库、AI、权限、租户、审计、风控和监控边界。 |
| test-only | CONDITIONAL-GO | 可以继续，但必须最小，且不得要求生产代码改动。 |
| runtime | NO-GO without approval | 必须单独授权，不得夹带在 test-plan-only 中。 |
| UI / API / DB / schema | NO-GO without approval | 必须单独授权。 |
| 机构端管理 runtime | NO-GO before plan and test plan | 必须先有 plan 和 test plan，并由用户单独授权。 |
| 平台端管理 runtime | NO-GO before plan and test plan | 必须先有 plan 和 test plan，并由用户单独授权。 |
| 真实 HIS / credential / 客户数据 / 模型 | NO-GO without approval | 必须单独授权，并先完成安全、权限、审计和低敏边界规划。 |

## 11. 推荐后续任务顺序

1. 知识库 test plan。
2. AI capability test plan。
3. 机构端 / 平台端管理最小 test-only 边界测试。
4. 知识库最小 test-only 边界测试。
5. AI capability 最小 test-only 边界测试。
6. 最小 runtime 候选只读评审。
7. 第一个最小开发 slice，必须单独授权。

上述顺序只是后续建议，不是自动开发许可。任何非文档任务都必须由用户在新的当前任务中明确授权。
