# 智美天工架构 V2

- 版本：`V2-01`
- 日期：2026-07-27
- 启动基线：`035c4516f448ca3bfcd95ba835c32ac367e0d964`
- 状态：统一目标架构与七线重启基线
- 本阶段性质：`docs-only`
- runtime、Schema、Migration、package、lock 修改：0

## 1. 目的

架构 V2 不延续上一轮“目录治理编号阶段”，而是独立的业务架构演进计划。

上一轮已完成全仓盘点、依赖审计、风险分类和低风险试点；本计划负责把目标模块边界与机构端七条业务线合并，在完成真实业务闭环的同时逐步落位最终架构。

禁止两种做法：

1. 先把全部文件搬完，再补业务；
2. 继续把七线功能堆入旧聚合模块，将来再整体搬迁。

唯一允许的主路径：

```text
领域契约
→ 持久化／权威 reader
→ application service
→ API
→ canonical 页面
→ 权限与审计
→ capability read_only／operational
→ 旧实现退出
```

## 2. 最终逻辑结构

```text
src/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── (institution)/hospital/
│   ├── (platform)/open-platform/
│   └── api/v1/
├── modules/
│   ├── identity/
│   ├── tenancy/
│   ├── access-control/
│   ├── security/
│   ├── institution-contracts/
│   ├── workbench/
│   ├── customers/
│   ├── conversations/
│   ├── care/
│   ├── knowledge/
│   ├── analytics/
│   ├── institution-system/
│   ├── platform-system/
│   ├── messaging/
│   ├── audit/
│   ├── entitlements/
│   └── branding/
├── integrations/
│   ├── his/
│   ├── wecom/
│   ├── ai/
│   ├── excel/
│   └── webhooks/
├── shared/
└── server/
    ├── db/
    ├── config/
    ├── context/
    ├── storage/
    ├── jobs/
    └── operations/
```

该结构是所有权目标，不授权创建空目录。目录只在首个获批实现进入时创建。

## 3. 数据库与测试边界

数据库继续使用：

```text
drizzle/
src/server/db/
scripts/db/
```

不为匹配目录名称创建第二套 `database/`。

测试采用混合模式：

```text
src/modules/*/tests/
tests/contract/
tests/security/
tests/integration/
tests/e2e/
```

现有模块测试不批量搬迁。

## 4. 强制写入政策

### `src/modules/institution/`

从 V2-01 合并后进入 `freeze_new_business`：

- 允许缺陷修复；
- 允许兼容出口；
- 允许为迁移删除调用方；
- 允许精确迁出；
- 禁止新增新的业务事实、repository、长期 DTO、provider 或页面实现。

### `src/modules/open-platform/`

进入 `freeze_new_cross_domain_file`：

- 新能力必须先确定 tenancy、entitlements、branding、AI integration 或 platform-system 所有者；
- 不再新增同时跨多个平台职责的巨型文件；
- 既有实现按垂直切片迁出。

### `src/modules/security/`

进入 `split_by_responsibility`，不得整体重命名为 `access-control`：

- 成员资格、provenance、机构级 guard、对象级 guard 和 action policy 逐步迁入 `access-control`；
- 密钥加密、低敏输出保护、安全开关及其他非授权安全能力继续由 `security` 所有；
- 不允许在一次迁移中把 39 个现有文件整体搬入单一权限模块；
- 新文件必须先声明属于 authorization 还是 general security。

### 公共契约和权限

- `institution-contracts` 是跨线契约唯一声明位置；
- `access-control` 是成员资格、机构级 guard、对象级 guard 和 action policy 唯一所有者；
- `security` 是密钥、低敏输出、安全开关及通用安全能力所有者；
- capability 不是授权事实；
- 页面可见性不能替代服务端权限。

## 5. 路由政策

Route Group 迁移不得改变用户 URL：

```text
src/app/hospital
→ src/app/(institution)/hospital

src/app/open-platform
→ src/app/(platform)/open-platform
```

API 采用按路由族兼容迁移，不批量重写：

```text
/api/institution/*
→ /api/v1/institution/*

/api/open-platform/*
→ /api/v1/open-platform/*
```

七线旧技术计划中已经列明的 `src/app/api/institution/**` 路由族，继续保留业务归属证据，但不再表示新业务逻辑的默认物理路径。统一解释规则如下：

1. 新实现默认进入 `src/app/api/v1/institution/**`；
2. 旧计划明确列出的非版本化端点，可以申请薄兼容 Route，但必须逐路由列入 V2-02 白名单；
3. 薄兼容 Route 只能执行服务端转发、输入兼容和安全响应映射，不得保存第二套业务逻辑、repository 或 DTO；
4. 每个兼容例外必须记录旧端点、v1 owner、调用方、测试、观测、回退和删除门禁；
5. 未被旧计划明确列出或未进入白名单的新增端点，禁止进入 `src/app/api/institution/**`；
6. 旧入口只有在调用方迁移归零、兼容观测完成和回退条件满足后退出。

因此，旧七线计划的 API 路径记载与 V2 版本化目标并不并行形成两套长期实现：其业务归属继续有效，物理实现路径由本节和 V2-02 路由族白名单统一解释。

## 6. 外部集成政策

正式调用关系固定为：

```text
业务模块
→ application port
→ messaging／integration boundary
→ src/integrations/<provider>
```

正式集成目录按提供方职责显式冻结为：

```text
src/integrations/his
src/integrations/wecom
src/integrations/ai
src/integrations/excel
src/integrations/webhooks
```

- Care、客户、会话和系统模块不得直接调用企业微信；
- HIS adapter 不进入 customers 或 care；
- AI provider 不拥有客户画像、标签、机会或随访业务规则；
- 真实消息只能通过统一 messaging 领域和人工审批门禁。

## 7. 业务集成与发布顺序

业务开发顺序与 Migration 编号顺序是两套不同门禁，但所有真实机构级 reader 必须先满足其消费事实的 MIG-01 完整关闭条件。

```text
V2-02 公共路由、Access Control 与 MIG-01 完整关闭预检
→ MIG-01A2 + BASE-02 双写／Guard + MIG-01B + MIG-01C
→ 客户中心／管理中心真实只读基础
→ MIG-02 客户稳定引用／责任归属 + Care 人工闭环
→ MIG-03 Knowledge 持久化闭环
→ Knowledge scope-bound 正式 Reader／机构页面
→ MIG-04 Conversations 持久化闭环
→ MIG-05 Analytics 消费事实、有效链与确定性聚合
→ MIG-06 Analytics snapshot／报告治理 + System 持久化渠道安全状态
→ Analytics snapshot repository/API、正式 providers 与五页 UI
→ Workbench 真实聚合
→ 七线发布验收
→ 旧实现退出
```

设计可以并行；Schema、Migration、主线集成和发布必须串行。V2-02 可以完成 Route Group 证明、provenance、成员资格和两级 guard 的预检或获批无数据库切片，但不得把 `MIG-01A1` 存在解释为机构隔离已关闭。

客户中心、管理中心及其他直接消费既有机构归属事实的真实 reader，只有在其消费事实完成 MIG-01B 回填、MIG-01C 非空／外键／shape enforce，且 BASE-02 提供当前成员的服务端双键上下文后才能启动。此前可以保留纯领域、契约或 capability-off 壳，但不得连接 tenant-only、默认机构或未 enforce 的数据来源。

Knowledge 的 scope-bound repository、current reader 和正式机构页面除上述 MIG-01 门禁外，还必须等待 MIG-03 完成。MIG-03 前，mock／seed／demo、可覆盖 parse/index 结果、mock embedding、内存索引和旧 preview 均不得进入正式知识列表、publication、指标、检索或问答。

Analytics 在 MIG-05 后只能实现机构消费事实 reader、有效纠正链和确定性聚合，不得据此创建 snapshot API、正式 Analytics providers 或五页 UI。snapshot repository/API、`AnalyticsCustomerConsumptionV1`、`AnalyticsDataGovernanceSummaryV1`、五页 UI 和报告治理必须等待 MIG-06 与 AN-03C。

Care、Knowledge、Conversations、Analytics 与 Institution System 各自拥有核心事实；跨线只通过 `institution-contracts` 中的版本化公共契约接线，不读取另一条线的 repository、内部表或内部 DTO。

## 8. Migration 队列与所有权

### 8.1 MIG-01 完整关闭链

`MIG-01A1` 只完成 expand，不等于机构隔离关闭。完整前置链固定为：

```text
MIG-01A1 expand（已存在）
→ MIG-01A2 锚点 provisioning
→ BASE-02B／BASE-02 锚点验证、scope revision、Guard 与全部 writer 双写
→ 最小审计兼容 writer／必要模板保护
→ MIG-01B 确定性回填、追赶和冲突清零
→ MIG-01C 非空、外键、attribution 与 shape enforce
→ 各七线 reader 在最新 main 上重新验收
```

| 单元 | 当前状态 | 关闭证据 |
|---|---|---|
| MIG-01A1 | 已存在 | expand schema／metadata／tests 一致；只允许可空过渡结构 |
| MIG-01A2 | 未关闭 | 已批准锚点按 manifest provision，重复执行安全且不覆盖 |
| BASE-02B／BASE-02 | 部分能力存在，需逐项复核 | 当前成员双键上下文、锚点 revision、Guard、全部 writer 双写 |
| 审计兼容／模板保护 | 未统一关闭 | institution attribution 连续写入；模板边界 fail-closed |
| MIG-01B | 未实施 | 确定性回填、高水位追赶、冲突清零 |
| MIG-01C | 未实施 | institution 非空、外键、audit attribution 和 shape enforce |

V2-02 的任务是审计并冻结该完整关闭链。只有 MIG-01C 完成且对应 BASE-02 上下文可用后，才能把 MIG-01 标记为 closed，才能启动 CUS-01B 及其他读取这些事实的真实机构级 reader。

### 8.2 MIG-02～MIG-06 串行队列

```text
MIG-02 Customers + Care
→ MIG-03 Knowledge
→ MIG-04 Conversations
→ MIG-05 Analytics facts
→ MIG-06 Analytics reports + Institution System channel safety
```

| 顺序 | 编号 | 所有者／范围 | 当前状态 | 实施规则 |
|---:|---|---|---|---|
| 1 | MIG-02 | Customers + Care：客户稳定引用、责任归属、认领、随访任务、结构化结果和线性路径最小持久化 | 未实施 | 必须在 MIG-01 完整关闭后独立设计、升级和回退验证 |
| 2 | MIG-03 | Knowledge：不可变版本、publication/current pointer、附件修订、parse/chunk/index/job、受限附件与回答快照 | 仅设计 | MIG-02 后独立实施 |
| 3 | MIG-04 | Conversations：会话根、分段、消息、逐消息结果、分配、风险、处置 revision 与身份复核 | 仅设计 | MIG-01、MIG-02、MIG-03 后独立实施 |
| 4 | MIG-05 | Analytics facts：消费来源、导入批次、稳定消费单、支付退款、客户匹配、HIS 项目映射和纠正链 | 仅设计 | MIG-01～MIG-04 后实施；只解锁事实 reader／有效链／确定性聚合，不解锁 snapshot API 或五页 UI |
| 5 | MIG-06 | Analytics + Institution System：分析 snapshot、报告输入输出／版本／归档／来源变化，以及持久化渠道安全状态 | 仅计划 | MIG-05 后冻结双域白名单并独立实施；合并后才允许 AN-03C snapshot repository/API、正式 providers 和五页 UI |

不得把 MIG-02～MIG-06 合并到一个 PR，也不得为了页面开发顺序重排编号。

MIG-02 是 Customers 与 Care 的共享数据单元：客户稳定引用和责任归属由 Customers 领域解释，随访任务、认领、结构化结果和线性路径由 Care 领域解释；总协调台拥有唯一 schema/migration 编排。任何一方都不得复制另一方 repository 或内部 DTO。

MIG-06 是 Analytics 与 Institution System 的共享、后置数据单元。Analytics 拥有 snapshot／报告事实；Institution System 只拥有渠道急停等持久化安全状态及其控制面语义。MIG-06 不包含 provider 凭证、真实网络、消息正文、外部 payload 或生产放行。

### 8.3 权威计划对齐

以下既有硬前置继续有效：

- MIG-01 必须完成 A1、A2、BASE-02 双写／Guard、B 回填和 C enforce；
- MIG-02 必须保留客户稳定引用、责任归属及 Care 最小持久化；
- MIG-04 必须等待 MIG-01、MIG-02、MIG-03；
- MIG-05 必须等待 MIG-01～MIG-04，且只交付消费事实、有效链与确定性聚合；
- MIG-06 必须等待 MIG-05，并保留分析 snapshot／报告与持久化渠道安全状态两类受控范围；
- Analytics snapshot repository/API、正式 providers、五页 UI 与最终发布申请必须等待 MIG-06 和 AN-03C。

V2-01 不改写这些任务，只统一最终模块所有权、业务发布尺度和旧目录停止增长政策。

## 9. capability 发布门禁

每个栏目只有全部满足才允许发布：

1. 领域模型和唯一事实所有者明确；
2. 持久化或权威 reader 完成；
3. API 使用统一服务端 guard；
4. canonical 页面连接真实数据；
5. 空、错、无权、不可用状态不伪装为业务空数据；
6. 写入具有并发控制和低敏审计；
7. 模块、契约、安全和业务闭环测试通过；
8. 测试环境验收完成；
9. 旧入口兼容与回退可用。

代码存在、测试通过或 PR 已合并，均不单独构成发布。

## 10. 计划阶段

| 阶段 | 目标 |
|---|---|
| V2-01 | 目标架构、Markdown 模块映射、七线重启基线和决策冻结 |
| V2-02 | Route Group、正式来源证明、成员资格、两级 guard 与 MIG-01 完整关闭预检 |
| V2-03 | 完成 MIG-01A2、必要 BASE-02／writer 门禁、MIG-01B 和 MIG-01C；随后管理 MIG-02～MIG-06 串行队列 |
| V2-04 | MIG-01C 后启动客户中心／System 真实只读基础；Knowledge 仅保留领域、契约和迁移准备，正式 Reader 等待 MIG-03 |
| V2-05 | MIG-02：客户稳定引用／责任归属与 Care 垂直闭环 |
| V2-06 | MIG-03：Knowledge 垂直闭环 |
| V2-07 | MIG-04：Conversations 垂直闭环 |
| V2-08 | MIG-05 交付 Analytics 事实／有效链／确定性聚合；MIG-06 后交付 snapshot repository/API、正式 providers、五页 UI、报告治理与 System 持久化渠道安全状态 |
| V2-09 | Workbench 真实聚合、七线发布验收、旧代码退出和最终架构审计 |

每一阶段仍须单独授权，不构成后续 runtime、Schema 或 Migration 自动许可。

## 11. 权威文件

1. `docs/architecture/architecture-v2.md`
2. `docs/decisions/architecture-v2-decisions.md`
3. `docs/architecture/architecture-v2-module-map.md`
4. `docs/architecture/institution-seven-stream-restart-baseline.md`
5. 七线具体技术计划和 MIG 设计
6. 历史目录重构文档

历史目标目录和旧计划保留为来源证据，但不得覆盖本文件的当前所有权和实施顺序。旧计划中 `src/app/api/institution/**` 的记载按第五节解释为业务路由族归属和受控兼容候选，不再构成新增非版本化业务实现的自动许可。

## 12. 本阶段文件数量例外

V2-01 使用 7 个同主题 Markdown 文件，超过 docs-only 的通常建议，原因是架构、机器映射、七线基线、决策、状态、下一任务和发布历史必须原子一致。
