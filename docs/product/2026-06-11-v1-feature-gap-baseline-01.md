# 智美天工 V1 待完成功能缺口基线 01

任务编号：`ZMTG-V1-FEATURE-GAP-BASELINE-DOCS-ONLY-01`

生成日期：2026-06-11

本文档是 V1 待完成功能缺口基线，用于后续规划知识库、AI、机构端管理、平台端管理和 V1 主业务闭环 runtime 的工作顺序。本文档仅为 docs-only 基线，不是 runtime 授权，不是 Phase 24 启动文件，也不是后续任务队列。

## 1. 当前阶段结论

- 智美天工不是 HIS 系统。
- 智美天工是面向医美 / 美业机构的 AI 客户运营中台。
- 当前主线是治疗后客户运营闭环。
- 当前已有内部 demo / 局部 runtime 基础，包括客户、预约、治疗摘要、随访、审计、平台租户 / 配额、HIS connection 元数据和 fake test connection 等。
- 当前 V1 主业务闭环仍未真实端到端跑通，复诊、复购、沉睡客户机会尚未形成统一 opportunity runtime。
- 当前只能视为内部受控 demo 雏形。
- 当前不具备真实客户上线条件，也不能宣称可试点。
- 不得把 plan / mock / domain-only / test-only 当成 runtime。

## 2. 已完成或局部完成能力

| 能力 | 当前状态 | 边界说明 |
|---|---|---|
| demo 登录 | 局部 runtime 基础 | 可用于内部 demo，不等于生产认证闭环。 |
| 机构工作台 | 局部 runtime 基础 | 可展示机构端基础入口和摘要，不等于完整运营闭环。 |
| 客户中心 | 局部 runtime 基础 | 支持受控客户档案能力，不等于真实客户数据导入已打通。 |
| 预约中心 | 局部 runtime 基础 | 支持预约相关演示，不等于真实预约 / HIS 同步。 |
| 智能随访 | 局部 runtime 基础 | 只能说明内部随访任务与建议能力，不等于自动触达。 |
| 治疗摘要 | 局部 runtime 基础 | 支持治疗摘要管理和低敏摘要表达，不等于医疗诊断。 |
| 治疗摘要建议到内部随访任务 | 局部 runtime 基础 | 已有确定性建议和人工确认创建内部随访任务能力，但不是统一 opportunity 闭环。 |
| 客户时间线 | 局部 runtime 基础 | 可展示低敏结构化事件，不等于完整客户旅程 runtime。 |
| 审计查询 | 局部 runtime 基础 | 支持机构 / 平台审计查询，不等于 V1 opportunity audit runtime 已实现。 |
| 平台租户 / 配额 | 局部 runtime 基础 | 可用于平台只读管理和配额基础，不等于完整平台运营管理。 |
| HIS connection 元数据 | 局部 runtime 基础 | 只是连接配置和状态元数据，不等于真实 HIS 接通。 |
| fake test connection | 局部 runtime 基础 | 只能演示假连接测试，不得宣称真实 HIS 已接通。 |
| V1 opportunity readonly domain | domain-only | 已有只读 domain 输出和 guard 边界，未接 UI / API / runtime。 |
| V1 主业务闭环 readonly 边界测试 | test-only | 证明低敏 mock / demo 闭环表达边界，不证明真实业务闭环跑通。 |
| V1 dashboard 聚合误读边界测试 | test-only | 证明 readonly opportunity 不应被误读为真实 dashboard aggregation 或真实业务动作。 |

## 3. P0 待完成功能

| P0 能力 | 当前缺口 | 为什么不能直接 runtime | 后续最小安全动作 |
|---|---|---|---|
| V1 主业务 runtime 闭环 | 缺统一 opportunity runtime、人工确认对象、状态流转、审计输入和最小 UI / API 边界。 | 直接 runtime 会把 domain-only / test-only 输出误当真实业务闭环，并可能混入任务、预约、成交或自动触达。 | 先做 V1 最小 runtime 候选只读评审，再做最小 test-only / docs-only 收口。 |
| 知识库 | 缺平台知识库、机构知识库、内容治理、版本、权限和检索边界。 | 直接做完整知识库 runtime 会提前引入 schema、权限、索引、检索和真实内容治理风险。 | 先做知识库 / AI 能力规划 docs-only，再做知识库 test plan。 |
| AI 功能 | 缺机构端 AI 能力定义、平台端 AI 管理、模型配置、审计、成本、权限和安全边界。 | 直接接真实模型会涉及真实客户数据、prompt / completion 低敏、成本控制和自动决策风险。 | 先做 AI 能力规划 docs-only 和 test-plan-only，不接真实模型。 |
| 机构端管理 | 缺机构基础设置、员工 / 角色 / 权限、客户运营配置、知识库配置、AI 配置、任务规则和 HIS 配置的 V1 边界。 | 直接开发会扩大 UI / API / service / repository / schema 范围，并可能绕过权限设计。 | 先做机构端管理能力规划 docs-only。 |
| 平台端管理 | 缺租户管理、套餐 / 配额、功能开关、平台知识库、平台 AI 管理、审计 / 风控 / 监控的完整口径。 | 直接开发会牵涉生产配置、计费、权限、审计和平台运营风险。 | 先做平台端管理能力规划 docs-only。 |
| 真实 dashboard aggregation 边界 | 缺真实聚合来源、状态纳入 / 排除、去重、空态 / 异常态、下钻和审计边界。 | 直接 SQL / aggregation runtime 会把 mock 指标或 readonly summary 误写成真实经营统计。 | 先做最小 runtime 候选只读评审和 dashboard aggregation test plan 复核。 |
| opportunity runtime 边界 | 缺机会对象、状态机、人工确认、幂等、字段白名单、审计和回滚边界。 | 直接写 opportunity runtime 会把客户 lifecycle、随访任务或 dashboard 指标混成同一对象。 | 先做 opportunity runtime 最小候选只读评审。 |

## 4. 知识库功能缺口

### 平台知识库

- 缺平台统一内容分类、发布、版本、适用租户范围、停用和回滚规则。
- 缺平台知识库与套餐 / 配额 / 功能开关的关系说明。
- 缺平台知识库内容的审计、风险词、敏感内容和医疗合规边界。

### 机构知识库

- 缺机构自有知识内容、项目说明、术后护理说明、客服话术、内部 FAQ 的管理边界。
- 缺机构知识库的员工权限、内容审核、版本回滚和停用规则。
- 缺机构知识库与客户运营闭环、治疗摘要、随访建议的低敏引用边界。

### 知识库基础设施

- 缺知识对象、内容版本、索引、检索、引用、权限、审计和回滚的候选设计。
- 缺字段白名单和禁止内容清单，尤其是完整病历、完整联系方式、HIS raw payload、真实客户数据和外部系统错误全文。
- 当前不应直接进入完整知识库 runtime，应先通过 docs-only / test-plan-only 收口内容结构、权限、审计和低敏边界。

## 5. AI 功能缺口

### 机构端 AI 能力

- 缺机构端 AI 使用场景边界，例如治疗后摘要辅助、随访建议辅助、客服话术辅助和内部运营提示。
- 缺 AI 输出是否可见、是否可编辑、是否需要人工确认、是否写审计的规则。
- 缺禁止 AI 自动医疗判断、自动营销和自动触达的明确验收断言。

### 平台端 AI 管理

- 缺平台级模型配置、租户开关、用量配额、成本上限、降级策略和禁用策略。
- 缺平台 AI 能力的审计、风控、异常处理和回滚边界。
- 缺不同套餐或租户的 AI 能力差异化管理规则。

### AI 与知识库结合

- 缺 AI 使用平台知识库和机构知识库的引用规则。
- 缺知识来源、版本、引用摘要、命中失败、空态和低敏 fallback 的边界。
- 缺防止 AI prompt / completion 泄露真实客户数据、凭证、HIS payload 或内部错误的断言。

### AI 审计 / 成本 / 权限 / 安全

- 缺 AI 调用审计、成本归属、权限校验、限流、失败降级和人工复核边界。
- 缺 AI 输入输出字段白名单和禁止字段清单。
- 当前不应直接接真实模型、真实客户数据或自动触达；任何 AI runtime 必须先有 plan 和 test plan。

## 6. 机构端管理缺口

| 管理能力 | 当前缺口 | 边界 |
|---|---|---|
| 机构基础设置 | 缺机构资料、品牌、服务范围、营业信息和基础偏好的管理规划。 | 不直接改 UI / API / schema。 |
| 员工 / 角色 / 权限 | 缺员工、角色、权限、审计可见性和最小权限矩阵。 | 不直接扩 RBAC runtime。 |
| 客户运营配置 | 缺客户分层、生命周期、复诊 / 复购 / 沉睡阈值和人工确认口径。 | 不直接写 opportunity runtime。 |
| 知识库配置 | 缺机构知识库栏目、内容权限、审核和停用规则。 | 不直接写知识库 runtime。 |
| AI 配置 | 缺租户级 AI 开关、场景授权、成本上限和人工复核规则。 | 不直接接真实模型。 |
| 任务规则 | 缺内部任务生成、去重、过期、完成和回滚规则。 | 不扩任务 / 预约 / 成交能力。 |
| HIS 配置 | 缺真实 HIS adapter、credential provider、连接测试和错误治理边界。 | fake test connection 不能当真实 HIS 接通。 |

## 7. 平台端管理缺口

| 管理能力 | 当前缺口 | 边界 |
|---|---|---|
| 租户管理 | 缺租户生命周期、启停、环境隔离和试用 / 内部 demo 状态定义。 | 不直接做生产租户管理扩展。 |
| 套餐 / 配额 | 缺套餐能力矩阵、AI 配额、知识库容量、功能开关和超限策略。 | 不直接做计费、支付、合同或发票。 |
| 功能开关 | 缺 V1 主业务、知识库、AI、dashboard aggregation、opportunity runtime 的开关策略。 | 不直接实现 feature flag runtime。 |
| 平台知识库 | 缺平台内容发布、适用范围、版本和审计规则。 | 不直接写知识库 runtime。 |
| 平台 AI 管理 | 缺模型配置、租户授权、成本、限流、审计和禁用策略。 | 不直接接真实模型或真实客户数据。 |
| 审计 / 风控 / 监控 | 缺平台级风险规则、监控指标、异常事件和处置流程。 | 不直接实现 audit runtime 或 monitoring runtime。 |

## 8. 不能提前进入的能力

以下能力不得作为下一步直接开发，也不得从本文档推导为授权：

- Phase 24。
- 完整 runtime。
- UI。
- API / route。
- service / repository / DTO。
- schema / migration / SQL。
- dashboard aggregation runtime。
- opportunity runtime。
- audit runtime。
- field whitelist enforcement runtime。
- 真实 HIS。
- 真实 credential。
- 真实客户数据。
- 自动营销 / 自动触达。
- 任务 / 预约 / 成交 / 支付 / 合同 / 发票扩展。

## 9. 推荐后续任务顺序

1. 知识库 / AI 能力规划 docs-only。
2. 机构端 / 平台端管理能力规划 docs-only。
3. V1 最小 runtime 候选只读评审。
4. 最小知识库只读 slice。
5. 最小 AI 配置只读 slice。
6. V1 主业务 runtime 最小闭环。

上述顺序是规划建议，不是自动开发许可。任何进入 runtime、UI、API、DB、schema、真实 HIS、真实 credential、真实客户数据或自动触达的动作，都必须另行获得明确授权。

## 10. Go / No-Go 规则

| 类型 | 结论 | 规则 |
|---|---|---|
| docs-only | GO | 可以继续，但只能新增或修改明确授权的文档。 |
| read-only | GO | 可以继续，用于复核基线、缺口、风险和候选顺序。 |
| test-only | CONDITIONAL-GO | 可以继续，但必须最小、只测边界、不要求生产代码改动。 |
| runtime | NO-GO without approval | 必须单独授权，且需要明确范围、测试、回滚和风险边界。 |
| UI / API / DB / schema | NO-GO without approval | 必须单独授权，不得夹带在 docs-only 或 test-only 任务中。 |
| 知识库 runtime | NO-GO before plan and test plan | 必须先有知识库 plan 和 test plan。 |
| AI runtime | NO-GO before plan and test plan | 必须先有 AI plan 和 test plan，且不得直接接真实模型或真实客户数据。 |

