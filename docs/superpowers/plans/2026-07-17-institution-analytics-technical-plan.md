# 机构端经营分析技术计划（第三轮字段定点返修）

> **给后续执行 Agent 的要求：** 本文由 `PLAN-AN-01` 首轮形成，经 `PLAN-AN-REV-02` 按总控冻结契约返修，并在 `PLAN-AN-REV-03` 中仅修正验收确认的字段冲突。本文只定义技术边界和后续小 PR 切片，不授权任何 runtime、schema、migration、API、导入、外部 adapter、真实 AI、提交、推送、PR 或合并。后续每一个切片仍需用户单独授权。

**目标：** 为机构端经营分析建立以可追溯消费事实为唯一金额来源的技术路线，先完成确定性指标与五页一致性，再由总控唯一外部集成串行队列在独立审批下交付受控导入、HIS/ERP/POS 和 AI 报告 provider。

**架构方案：** 消费事实输入先保留来源、事件、金额、币种、客户/项目匹配和更正链，再由服务端以机构时区的半开期间确定性聚合。页面、客户消费页和固定报告均消费同一个版本化分析快照；AI 只能读取低敏的已计算快照并输出受约束叙述，不能计算、改写或补全核心数字。

**技术栈：** Next.js、React、TypeScript、Vitest、Testing Library、Drizzle、PostgreSQL、Git Worktree、GitHub PR。

---

## 一、文档状态与任务边界

- 日期与时区：`2026-07-17 CST`。
- 当前阶段：机构端七线并行开发规划契约定点返修；任务编号 `PLAN-AN-REV-03`。
- 启动基线：detached `HEAD` 与本地 `origin/main` 均为 `e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa`；本轮禁止外部网络，未执行 fetch。
- 启动时 `git status --short` 只有首轮未跟踪的本文档；本轮只允许修改本文档。
- 上游总计划：`docs/superpowers/plans/2026-07-17-institution-seven-stream-development-plan.md` 第十节、十二节和十四节。
- 本轮不是：不修改 `src/**`、`drizzle/**`、schema、migration、API、测试、配置、脚本或依赖；不执行文件导入，不调用 HIS/ERP/POS/AI，不读取凭证，不提交、不推送、不创建或合并 PR，不继续任何 runtime 工作。

本文中的未来路径、表名、DTO、路由和测试文件均为后续任务的候选所有权，不是本轮创建许可。基础能力 `BASE-01`、`BASE-02`、`BASE-03`、`BASE-04` 和 `BASE-05` 未完成前，不得把经营分析加入正式导航。

---

## 二、总控共同冻结契约

### 2.1 角色、范围与公共声明所有权

四种机构角色稳定代码统一为：

| 角色代码 | 中文标签 | 经营分析权限上限 |
| --- | --- | --- |
| `tenant_admin` | 机构管理员 | 可读取经营分析、客户消费、治理摘要并人工按需生成/归档报告。 |
| `tenant_operator` | 机构运营 | 与管理员相同的经营分析读取和报告权限；不因此获得凭证、外部连接或 migration 权限。 |
| `consultant` | 咨询师 | 不显示经营分析或客户消费入口，深链接 fail-closed。 |
| `customer_service` | 客服 | 不显示经营分析或客户消费入口，深链接 fail-closed。 |

所有公共跨线契约的声明所有者均为总协调台，计划落点只能是总控维护的 `src/modules/institution-contracts/v1/**`。经营分析线可以记录已冻结字段、在 `src/modules/institution-analytics/**` 提供自己的 provider，并消费其他生产者的服务端 reader；不得声称拥有公共声明，也不得读取其他线的 repository/table。客户中心、管理中心及其他消费者同样只能经总控公共契约的服务端 reader 读取本线 provider。

### 2.2 统一跨线只读信封

所有跨线读取逐字段统一为 `InstitutionSourceEnvelopeV1<T,K>`，响应结构只能是：

```ts
type InstitutionSourceEnvelopeV1<T,K> = {
  contractVersion: 'v1'
  scope: { tenantId: string; institutionId: string }
  readiness: 'ready' | 'empty' | 'partial' | 'stale' | 'unavailable' | 'denied' | 'disabled'
  freshness: { observedAt: string; freshUntil: string } | null
  partitions: Array<{
    key: K
    readiness: 'ready' | 'empty' | 'stale' | 'unavailable' | 'denied' | 'disabled'
    freshness: { observedAt: string; freshUntil: string } | null
    failureCode: null | 'upstream_unavailable' | 'timeout' | 'invalid_payload' | 'scope_mismatch' | 'permission_denied' | 'not_released' | 'data_incomplete'
  }>
  data: T | null
  failureCode: null | 'upstream_unavailable' | 'timeout' | 'invalid_payload' | 'scope_mismatch' | 'permission_denied' | 'not_released' | 'data_incomplete'
}
```

`reader` 只作为服务端输入与授权边界，不进入响应 envelope；客户端提交的范围不构成授权。只有顶层 `readiness` 可以为 `partial`，`partitions[].readiness` 不包含 `partial`。只有权威查询成功且确认数据确实为空时，顶层或对应分区的 `readiness = empty` 才允许显示业务 `0`。顶层 `partial` 显示已验证值和缺口，`unavailable` 显示 `--`；`stale` 可展示带 `freshness` 截止时间的已验证快照，但不得驱动新报告生成、当前写操作或行动队列。顶层 `readiness = denied | disabled`、顶层或分区 `failureCode = scope_mismatch`、对象归属不明时必须 `data = null`，不得泄露业务数据或对象是否存在。顶层与分区只使用同一组受控 `failureCode`，不返回 SQL、stack、请求体、外部原文或 provider payload。

### 2.3 唯一 migration 与外部集成队列

唯一 migration 顺序固定为：

```text
MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06
```

经营分析线只提交或消费总协调台的数据变更申请，不创建并行 migration 编号，不修改 `src/server/db/schema.ts` 或 `drizzle/**`，也不把 schema 改动塞进领域、API、页面或报告 PR。HIS、ERP/POS、受控导入、渠道/AIBOTK、OCR/embedding/rerank/知识 AI、经营报告 provider 全部进入总协调台唯一外部集成串行队列；经营分析只提出业务契约、消费已批准 adapter 并执行验收。

---

## 三、只读盘点结论

### 3.1 现有机会、客户和治疗数据不能作为消费事实

| 现有能力 | 已确认事实 | 对经营分析的可用性与硬边界 |
| --- | --- | --- |
| 机会池 | `src/modules/institution/server/opportunity-pool-service.ts` 按客户 `lifecycle` 派生复诊、复购、沉睡机会；`/api/institution/opportunities` 只读取客户。 | 目标枚举只保留 `revisit \| repurchase \| reactivation`；现有 `dormant_reactivation` 仅在兼容层转换。机会只读、无独立实体或 CRM 状态，也绝不能推算消费额。 |
| 客户、预约、治疗摘要、随访 | `src/server/db/schema.ts` 已有 `customers`、`appointments`、`treatment_summaries`、`follow_up_tasks`。治疗摘要仅含项目、治疗阶段、风险和护理摘要等临床/服务资料。 | 可作为后续客户引用、项目候选或运营上下文；不得用治疗摘要、预约或随访状态冒充实付、退款、净额或项目销售额。 |
| 现有客户导入 | `/api/institution/customers/import` 是低敏客户资料预览/执行入口，面向客户字段与审计。 | 不能复用为消费文件导入执行器；消费导入必须另设文件契约、金额校验、批次、去重、更正和行级结果。 |
| 平台商业记录 | `tenant_commercial_records` 关联租户套餐、计划变更等平台商业资料。 | 属于平台商业域，禁止进入机构消费事实、机构营收、客单价或项目排行。 |

### 3.2 现有 AI 与数据接入能力不是经营收入来源

| 现有能力 | 已确认事实 | 对经营分析的硬边界 |
| --- | --- | --- |
| 机构 AI 服务使用 | `ai_call_usage_records` 保存模型、token、调用状态和 `aiCreditsConsumed`；`institution-ai-service-usage.ts` 明确是低敏只读用量视图且不代表真实扣减或财务账单。 | AI 积分、token、模型调用量和套餐额度都不是客户消费、支付或退款；只能作为管理中心全局 AI 使用参考，不能进入经营指标。 |
| 平台 AI 积分 | `src/modules/open-platform/server/ai-usage-credits.ts` 聚合平台调用及积分。 | 该数据属于平台运营/计量，禁止作为机构营收、成本、毛利或报告证据。 |
| HIS 连接 | `his_connections` 保存连接名称、来源系统、厂商、状态、凭证引用和健康摘要；现有测试连接 provider 为 fake。 | 当前没有 HIS 消费事实同步。HIS 消费接入必须进入独立集成交付队列，不能因“连接健康”而认定存在可用消费数据。 |
| HIS 标准项目目录 | 产品规格已冻结“当前机构 HIS 标准项目目录”为项目分析唯一规范目录；当前代码尚无可证明真实、机构隔离且可审计的目录。 | 经营分析只能提出和消费公共目录/映射契约；没有满足门禁的目录时，项目分析和五页统一发布均失败。 |

### 3.3 本轮形成的事实判断

1. 当前没有可直接复用的机构消费单、成功支付、确认退款、项目目录映射或消费导入批次事实源。
2. “机会”“治疗摘要”“客户旅程”“平台商业记录”“演示/fixture 数据”“AI 积分与调用量”均不是消费事实，后续测试和页面不得以它们替代真实输入。
3. 因此经营分析第一批可合并的 runtime 只能是纯领域计算与其边界测试，且 capability 必须保持关闭；任何有金额的展示都必须等待受控事实进入并完成完整性判定。

---

## 四、经营事实与口径契约

### 4.1 唯一可计金额的输入

后续 `AnalyticsConsumptionFactV1` 只接受下列两种不可变业务事件；来源可为受控文件、HIS、ERP 或 POS，但来源类型不改变事件口径。

| 事件 | 计入条件 | 期间归属 | 金额方向 | 必填追溯字段 |
| --- | --- | --- | --- | --- |
| `payment_succeeded` | 外部或受控导入来源已明确为成功实付；待支付、已创建、已取消、未知或只含订单金额一律不计。 | 成功日所在机构本地业务日。 | 正数。 | `sourceSystem`、来源单号/支付 ID、来源版本、成功时间、币种、原子金额、接收批次/连接、高水位或文件行引用。 |
| `refund_confirmed` | 退款已确认；申请中、撤销、拒绝、未知或仅预计退款一律不计。 | 确认退款日所在机构本地业务日。 | 原始事实保存正数，聚合时作为减项。 | 原支付/退款关联（如来源提供）、来源退款 ID、来源版本、确认时间、币种、原子金额、接收批次/连接、高水位或文件行引用。 |

共同要求：

- 事实必须由服务端绑定可信 `tenantId + institutionId`；不得以页面、文件行或客户端传入的机构 ID 作为授权依据。
- 金额使用最小货币单位整数与 ISO 4217 币种代码；不得用浮点数、展示金额字符串或隐含默认币种计算。
- 来源主键、来源版本（或等价不可变 revision）与事件类型构成幂等键。重放同一来源版本不重复入账；新的更正只能追加可追溯更正事实，不能静默覆盖历史行。
- 每条事实必须携带稳定业务消费单引用或明确的 `missing_stable_consumption_reference`。只有稳定引用完成去重和归集后，才允许展示消费单数、次数、消费单列表或 `/hospital/analytics/consumption/:recordId` 详情。
- 客户和项目初始只允许记录“已匹配 / 未匹配 / 待复核”及候选引用。不得为凑齐指标猜测客户或项目。
- 所有事实都必须带来源时间、接收时间、导入批次或连接版本及数据新鲜度；缺失这些字段的行不进入“完整”口径。

### 4.2 指标公式、去重和特殊值

所有聚合先按 `institutionId + currency` 分区，再按事件幂等键去重；不同币种永不相加。

| 指标 | 确定性公式 | 边界 |
| --- | --- | --- |
| 成功实付 | 窗口内去重后的 `payment_succeeded.amountMinor` 之和。 | 只按成功日，不使用创建日、预约日、治疗日或导入日。 |
| 确认退款 | 窗口内去重后的 `refund_confirmed.amountMinor` 之和。 | 只按确认退款日；跨期退款在退款确认所在期间扣减。 |
| 净额 | `成功实付 - 确认退款`，按币种分别计算。 | 允许负值，必须原样展示并标注退款影响；不得截断为 0 或把负额移出统计。 |
| 已匹配客户数 | 窗口内有至少一笔成功实付且已确认客户匹配的去重客户数。 | 退款本身不创造客户数；未匹配客户不计入该分母。客户归档不改变历史事实归属。 |
| 客单价 | 同币种的“已匹配客户净额”除以“已匹配客户数”。 | 分子包含该匹配客户在窗口内的确认退款，因此可下降或为负；分母为 0 时显示 `--`，绝不能显示 0。 |
| 标准项目排行 | 同币种、已映射到有效项目目录版本的净额按项目汇总。 | 未映射项目金额不进入排行；项目目录变更不得重写历史映射版本。 |
| 未匹配客户金额 | 无确认客户匹配的成功实付与确认退款的净影响。 | 必须进入机构总额和完整性说明，但不进入客户数、客单价或客户明细。 |
| 未映射项目金额 | 无有效项目目录映射的成功实付与确认退款的净影响。 | 必须进入机构总额和完整性说明，但不进入标准项目排行。 |

不得把“退款关联不到原支付”自动丢弃。其在通过来源幂等和币种校验后仍影响同币种机构净额，同时进入 `orphan_refund` 数据质量项；在无法确定其机构、币种或金额时，整行拒绝并计入批次异常，而非静默计为 0。

事实状态门禁统一为：待支付、失败支付、取消支付、退款申请中、退款失败和退款取消均不计金额；被权威幂等键确认的重复事实只保留一份有效事实并记录排除数量；追加纠正按最新有效链重算当前快照，但不静默改写历史报告。来源或分区过期时只能返回 `stale` 的已验证截止快照，不能把缺口解释为 0。

### 4.3 稳定消费单门禁

- 稳定业务消费单引用必须在当前机构内唯一、可审计、可从支付/退款事实重放归集，且不能暴露原始订单号或支付号。
- 只有 `countAvailability = available` 时，消费单数/次数才为非空数值并允许进入页面或客户消费契约；否则统一为 `null`，只隐藏与消费单数/次数相关的 UI，不影响可靠的项目金额分析。
- 单条事实缺少稳定消费单引用时，若机构、币种、金额和事件资格仍可权威验证，可进入机构金额聚合并单列质量缺口，但不进入消费单数、消费单列表或详情。
- 如果当前没有任何可用于列表和详情的稳定消费单引用，只关闭消费单数/次数、明细列表和记录详情；可靠的基础金额、趋势、项目、机会和 AI 报告不因此阻断。不得以支付笔数、项目行数或数据库行数代替消费单数。

### 4.4 HIS 标准项目目录与映射

当前机构 HIS 标准项目目录是项目分析唯一规范目录。经营分析消费总控公共声明和 HIS 目录 provider，不创建第二套项目目录。ERP、POS 和受控导入只提供来源项目引用/别名，映射必须绑定 `tenantId + institutionId + hisDirectoryVersion + canonicalProjectId`，并保留映射版本、来源、操作者和审计。

未映射项目的有效金额继续计入同币种机构实付、退款和净额，但排除标准项目排行、项目占比、分类结构和项目详情；项目详情只能由有效 HIS 规范项目 ID 打开。没有真实、机构隔离、版本化且可审计的 HIS 标准项目目录时，项目分析为 `disabled`，五页统一发布门禁失败，不允许用治疗摘要自由文本、同名、别名或错别字直接合并。

---

## 五、机构经营上下文、期间与图表粒度

### 5.1 `InstitutionOperatingContextV1`

经营分析只引用由机构设置/统一上下文 provider 生产、总协调台声明的 `InstitutionOperatingContextV1`，并通过服务端 reader 消费；管理中心只提供获准的展示与设置控制面。该别名固定为 `InstitutionSourceEnvelopeV1<InstitutionOperatingContextPayloadV1, 'operating_context'>`，经营分析不读取机构配置表，也不在本线重定义字段。其 `data` 仅包含 `version`、`source = institution_config | product_default`、`current`、可空 `pending`、`updatedAt` 和 `updatedBy`。

- `current` 包含当前生效的 IANA 时区和 ISO 4217 默认币种。
- `pending` 精确包含待生效 `timeZone`、待生效 `defaultCurrency`、`requestedVersion` 和 `effectiveFromBusinessDate`；在该机构业务日期到达前仍使用 `current`。
- `updatedAt` 与 `updatedBy` 沿用管理中心/总控冻结的更新时间和低敏更新者引用，不由经营分析另造审计字段。
- 机构尚未配置时使用 `Asia/Shanghai` 和 `CNY`，并明确 `source = product_default`，不能伪装为机构配置。
- 新版本只对下一统计周期及之后的新 snapshot 生效；历史 snapshot、客户消费结果和报告继续绑定生成时的 operating-context version，不回填、不重算、不静默改写。
- envelope 顶层 `readiness = denied | disabled` 或 `failureCode = scope_mismatch` 时 `data = null`；`stale` 只允许查看截止快照，不生成新报告。

### 5.2 期间预设和上一等长周期

统一 `AnalyticsPeriodV1` 使用机构 IANA 时区和本地日期半开区间 `[startDate, endDateExclusive)`：

| 预设 | 当前周期 | 默认图表粒度 |
| --- | --- | --- |
| 今日 | 当地今日 00:00 至明日 00:00。 | 小时；数据不足时降为受控时间段或单日汇总。 |
| 本周 | 当地 ISO 周一至明日 00:00，仅统计截至今日。 | 日。 |
| 本月 | 当地自然月首日至明日 00:00；默认筛选即“本月截至今日”。 | 日。 |
| 本季度 | 当地自然季度首日至明日 00:00。 | 周，可切换日。 |
| 本年度 | 当地自然年首日至明日 00:00。 | 月，可切换周；上年度同期只能作为附加比较。 |
| 自定义 | 用户选择的完整本地日期范围，结束日转换为下一日 00:00 排他。 | 短周期按日；跨度较长时使用服务端允许的周/月粒度。 |

当前周期包含 `N` 个本地日历日时，上一等长周期固定为紧邻当前开始日之前的 `N` 日：`[startDate - N days, startDate)`。两期分别独立计算成功实付、确认退款、净额、付费客户、客单价、项目和质量状态；只有同币种、同指标且完整性可比较时才输出差值或百分比。上期/分母为 0、币种集合变化或数据不可比较时显示 `--`，不得出现 `Infinity` 或跨币种比较。

支付只按成功日、退款只按确认日进入对应机构本地周期；净额允许为负。所有卡片、图表、客户消费契约和报告按币种分区展示，多币种永不相加、永不由前端换算。

---

## 六、canonical 路由与详情表现

| 页面 | canonical 路由 | 详情与兼容规则 |
| --- | --- | --- |
| 经营总览 | `/hospital/analytics` | 完整页面。 |
| 消费分析 | `/hospital/analytics/consumption` | 完整页面；周期、粒度和安全结构化筛选可进入 URL。 |
| 消费记录详情 | `/hospital/analytics/consumption/:recordId` | 桌面 `720px` 只读抽屉，移动端全屏；仅稳定消费单门禁通过后可用。 |
| 项目分析 | `/hospital/analytics/projects` | 完整页面；仅 HIS 规范目录门禁通过后可用。 |
| 项目详情 | `/hospital/analytics/projects/:projectId` | 桌面 `720px` 只读抽屉，移动端全屏；`:projectId` 只能是当前有效 HIS 规范项目 ID。 |
| 客户与机会 | `/hospital/analytics/opportunities` | 完整页面；三类派生机会只读。 |
| 机会详情 | `/hospital/analytics/opportunities/:customerId?kind=:opportunityKind` | 桌面 `560px` 只读抽屉，移动端全屏；由已验证客户 ID 与 `revisit \| repurchase \| reactivation` 定位。 |
| AI 经营报告 | `/hospital/analytics/reports` | 五种固定方向的人工按需生成入口与机构共享历史。 |
| 报告详情 | `/hospital/analytics/reports/:reportId` | 桌面 `720px` 只读抽屉，移动端全屏。 |

旧 `/hospital/opportunities` 及 `/hospital/opportunities/:customerId?kind=:opportunityKind` 只在目标能力正式可用时安全兼容跳转到对应 canonical 路由，保留已验证结构化筛选，不保留第二套路由状态、页面、详情或 repository。桌面抽屉与移动全屏共用同一对象链接；不允许抽屉套抽屉，跨模块跳转先关闭当前抽屉。

1. 查询输入统一为机构时区内的日期范围 `[startDate, endDateExclusive)`，结束日期排他；所有页面和报告使用同一个 `AnalyticsPeriodV1`。
2. 成功日/确认退款日的时间戳先转换为机构 IANA 时区，再决定其本地业务日。禁止由浏览器时区或数据库服务器默认时区决定归属。
3. 当前期间按 `N` 个本地日历日计算；上一等长周期紧邻当前开始日：`[startDate - N days, startDate)`。它不是“上月同日”或不等长自然月替代品。
4. 两段期间分别独立计算支付、退款、净额、客户数、客单价、项目排行和质量标记；比较仅在同币种、相同指标和可比较完整性等级下产生差值/百分比。
5. 上期为 0、分母为 0、币种集合变化或任一期间不可比较时，百分比显示 `--` 并说明原因；不得产生 `Infinity`、自动归零或跨币种百分比。

---

## 七、完整性、快照与跨线输出契约

### 7.1 完整性和版本化快照

`AnalyticsDataCompletenessV1` 不是布尔值，至少覆盖来源覆盖、批次/同步、稳定消费单、客户匹配、HIS 项目映射、幂等/追加纠正和事实新鲜度。任一来源迟到、失败、覆盖范围不明或高水位缺失时，只有 envelope 顶层可以为 `partial`；受影响的 `partitions[]` 按事实使用 `stale`、`unavailable`、`denied` 或 `disabled`，不得使用 `partial`。没有权威可用来源时顶层为 `unavailable`。未匹配、未映射、负净额、拒绝行、孤儿退款、重复排除、失败/取消和多币种拆分均必须显式计数或标记。

`AN-03` 以后五页只从同一服务端 `AnalyticsSnapshotV1` 读取，不各自扫描事实。快照最少绑定 `tenantId + institutionId`、当前/上一等长周期、`InstitutionOperatingContextPayloadV1.version`、算法版本、`snapshotId`/版本、生成时间、按币种指标、项目/客户/机会/预约随访聚合、来源高水位、完整性、新鲜度和 `partitions` 状态。

快照是只读计算结果而非财务总账，不包含发票、税、成本、利润、合同、支付凭证正文或原始外部 payload。追加纠正、有效映射版本或新批次改变时生成新快照；旧快照和绑定报告不回写。只有权威查询成功且确实为空时可生成 `readiness = empty` 的零值快照；其他未知或失败显示 `--`。

### 7.2 `AnalyticsCustomerConsumptionV1` 与 payload

公共声明归总协调台；经营分析线生产 provider，客户中心只通过服务端 reader 只读消费。公共结果别名固定为 `AnalyticsCustomerConsumptionV1 = InstitutionSourceEnvelopeV1<AnalyticsCustomerConsumptionPayloadV1, AnalyticsCustomerConsumptionPartitionKeyV1>`；`AnalyticsCustomerConsumptionPartitionKeyV1` 的固定 key 集合仍由总协调台冻结，冻结前 provider 和 consumer runtime 均阻塞。envelope 的 `K` 只约束 `partitions[].key`，不属于 payload。该结果仅允许 `tenant_admin | tenant_operator`；reader 的可信范围、角色和查询对象只作为服务端输入，不作为额外响应字段。

`AnalyticsCustomerConsumptionPayloadV1` 只包含以下字段组，不重复 envelope 的 `contractVersion`、`scope`、`readiness`、`freshness`、`partitions` 或 `failureCode`：

| 字段组 | 白名单内容 |
| --- | --- |
| snapshot | `snapshotId`、snapshot/algorithm/operating-context version 和 snapshot 生成时间，不返回完整 snapshot。 |
| 客户 | 已验证 `customerId`；provider 必须根据服务端 reader 输入重新确认客户属于当前机构。 |
| 周期 | 当前周期、上一等长周期、IANA 时区及实际起止日期。 |
| 币种指标 | 每币种的成功实付、确认退款和净额；多币种不相加。 |
| `paidCustomer` | 每币种三态 `paid \| not_paid \| unknown`。 |
| 消费单计数 | `consumptionOrderCount: number \| null` 与 `countAvailability = available \| unavailable_unstable_reference \| unavailable_incomplete_source`。 |
| 低敏明细 | 仅在稳定消费单门禁通过时返回内部不可逆安全记录引用、发生时间、HIS 规范项目低敏名称/分类、每币种实付/退款/净额、受控来源类型、质量状态和更新时间。 |

没有稳定业务消费单引用时 `consumptionOrderCount = null`，`countAvailability` 说明原因，客户中心和经营分析同时隐藏消费单数/次数、列表和详情，不能以支付笔数或行数替代。契约禁止返回原始订单/支付/退款标识、文件名/文件内容、外部账号、客户姓名/联系方式等 PII、自由文本、票据/合同、凭证或 provider payload；客户中心不得复制金额算法、读取经营分析 repository/table 或创建第二套交易存储。

`paidCustomer = paid` 只表示该客户在当前周期存在有效成功实付；`not_paid` 只有在权威客户范围和消费查询成功且确认没有成功实付时才返回；来源不完整、过期或无法确认时必须为 `unknown`，不得用 `not_paid` 冒充零消费。

### 7.3 `AnalyticsDataGovernanceSummaryV1`

公共声明归总协调台；经营分析线生产低敏 provider，管理中心只通过服务端 reader 消费，且只允许 `tenant_admin | tenant_operator`。除统一只读信封外，只允许返回：来源类型与覆盖、最近成功高水位/截止时间、批次成功/部分/失败摘要、稳定消费单可用性、接受计数、拒绝计数、未解决冲突计数、多币种或不可聚合记录计数、按币种的未匹配客户和未映射项目金额/记录数、孤儿退款、排除重复、失败/取消、追加纠正和过期分区摘要，以及指向管理中心数据源/批次/治理页的安全对象引用。接受、拒绝、未解决冲突和多币种四项必须独立表达，不能由批次状态或失败/取消计数替代。

该契约不返回文件名/行内容、原始订单/支付/退款号、客户级金额、外部账号、凭证、自由文本、SQL、stack 或 provider payload。envelope 顶层 `readiness = denied | disabled` 或 `failureCode = scope_mismatch` 时 `data = null`；`stale` 必须带 `freshness` 且不能触发导入、同步、重试或纠正。

### 7.4 机会只读契约

经营机会固定为 `revisit | repurchase | reactivation` 三类生命周期派生快照，不增加待处理、已处理、关闭、转化、负责人变更或其他 CRM 状态。详情仅由当前机构已验证的 `customerId + opportunityKind` 定位；生命周期变化后不再满足条件时返回“已不再满足派生条件”，不保存虚构历史机会实体。

经营分析只能经总控公共客户引用/生命周期 reader 消费客户中心 provider，不读取客户 repository/table。机会只允许查看客户或跳转获准的预约/随访入口；打开链接或创建请求不自动改变机会、生命周期或经营指标。

---

## 八、从 `AN-01` 开始的连续小 PR

所有 runtime PR 均以共享底座完成后的同一最新 `main` 为基线，默认 capability-off。每个 PR 只改本线独占目录及其测试；公共路由、能力注册、访问控制、审计核心、`src/server/db/schema.ts` 和 `drizzle/**` 继续遵守总协调台文件锁与唯一 migration 队列。

| 切片 | 可交付内容 | 前置门禁与明确非范围 | 验收重点 |
| --- | --- | --- | --- |
| `AN-01` | 纯领域消费事实资格、稳定消费单门禁、幂等/纠正、金额/币种、`InstitutionOperatingContextV1` 消费、六类期间、上一等长周期和项目/客户归集计算器。 | 需单独 runtime 授权；不接数据库、API、页面、导入、公共声明或 provider。 | 成功日/确认退款日跨期、失败/取消/重复、部分/全额/孤儿退款、负净额、0 分母、未匹配、未映射、两币种、DST/时区、stale 和不可比较上期均有边界测试。 |
| `AN-02` | 向总协调台提交 `MIG-05` 数据变更申请。 | 仅申请，不修改 schema/migration；必须等待 `MIG-01 → MIG-04`。 | `MIG-05` 只含消费来源、导入批次及行、稳定业务消费单、支付/退款、客户匹配、HIS 项目映射和幂等/追加纠正；不含 snapshot 或报告。 |
| `AN-03A` | 在总控合并 `MIG-05` 后实现机构事实读取、幂等有效链和确定性聚合。 | 依赖 `BASE-02/04/05` 和已批准数据模型；不接外部来源。 | 服务端 `tenantId + institutionId`、固定角色、分区 readiness/freshness、低敏 failure code 与金额口径。 |
| `AN-03B` | 向总协调台提交并消费 `MIG-06` 申请。 | 仅申请，不修改 schema/migration；必须在 `MIG-05` 后。 | `MIG-06` 只含分析 snapshot、报告输入/输出、报告版本、归档和来源数据变化状态。 |
| `AN-03C` | 在总控合并 `MIG-06` 后实现 snapshot repository/API，以及本线的 `AnalyticsCustomerConsumptionV1`、`AnalyticsDataGovernanceSummaryV1` provider。 | 公共声明仍由总协调台维护；客户中心/管理中心消费者另提 integration request；消费分区 key 未冻结前保持阻塞。 | `InstitutionSourceEnvelopeV1<T,K>` 七态顶层 readiness、分区六态、服务端 reader 输入、scope mismatch 无数据、`empty` 才为 0、stale 截止快照和多币种分区。 |
| `AN-04A` | `/hospital/analytics` 与 `/hospital/analytics/consumption`，含稳定消费单详情门禁。 | 依赖 `AN-03C`；capability-off；不修改公共 `/hospital` 壳。 | 六类周期、粒度、同一 snapshot、当前/上期、按币种展示、局部失效和安全 URL。 |
| `AN-04B` | `/hospital/analytics/projects`、项目详情和客户与机会页/详情。 | 依赖真实 HIS 标准目录 provider、总控客户 reader；不读取其他 repository。 | 未映射排除排行/占比/详情；三类机会只读，不新增 CRM 状态。 |
| `AN-05` | 完成本线 `AnalyticsCustomerConsumptionV1` provider 验收，并向客户中心提交消费页签消费 integration request；向总协调台提交旧机会兼容跳转 request。 | 不在本线修改客户中心或公共路由文件；`AnalyticsCustomerConsumptionPartitionKeyV1` 未冻结前不得实现。 | 客户 ID 重验、仅 `tenant_admin \| tenant_operator`、payload 不重复 envelope 字段、计数可空、低敏明细白名单、旧路由无第二套状态。 |
| `AN-06A` | `AnalyticsReportInputV1` 独立白名单投影、五种固定方向和关键/非关键缺失预检。 | 不调用 AI，不发送完整 snapshot。 | 关键缺失硬阻断；非关键缺失显示覆盖并要求人工确认；stale 不生成新报告。 |
| `AN-06B` | 报告输入/输出、版本、不可变历史、来源变化标记和归档服务。 | 依赖总控 `MIG-06`；不接 provider、不导出。 | 绑定 snapshot，不编辑/覆盖/硬删；数据变化后生成新版本。 |
| `AN-06C` | `/hospital/analytics/reports`、手工按需多步骤生成、共享历史和只读详情/归档 UI。 | 只允许管理员/运营；无自由 prompt、定时或页面触发。 | AI 不可用不影响四个基础页和历史报告；失败不创建空白成功报告。 |
| `AN-06D` | 消费总控已批准的经营报告 adapter，执行结构化响应、metric evidence、`recommendations[]` 结构与低敏输出校验。 | provider/凭证/网络仍由总控外部集成队列交付；本线不实现私有 provider。 | AI 不重算/补齐数字；建议缺字段或 evidence 引用无效时校验失败，不留档为成功，不覆盖旧报告。 |
| `AN-07` | 五页口径、角色/机构隔离、目录/消费单、完整性、审计和 capability 发布申请。 | 依赖 `AN-04A/04B/05/06A-D` 与所有共享门禁；仅申请发布。 | 第十一节全部通过后，才可由总协调台决定正式导航。 |

上述切片的编号只是经营分析业务 PR 拆分，不是 migration 或外部集成编号。任何 schema/migration、adapter、凭证、worker/scheduler、生产开关或公共契约声明都不能混入栏目 PR；合并前必须更新到最新 `main` 并重新验证。

---

## 九、`AnalyticsReportInputV1` 与固定报告治理

### 9.1 独立机构级低敏白名单

`AnalyticsReportInputV1` 的公共声明归总协调台。经营分析服务只能从已验证 snapshot 生成一个独立、最小的机构级投影，再交给总控批准的报告 adapter；禁止直接序列化、传输或让 provider 读取完整 `AnalyticsSnapshotV1`。

允许字段只有：

- `contractVersion: 'v1'`、报告方向、IANA 时区、当前/上一等长周期、snapshot/algorithm/template/operating-context version。
- 按币种的机构级成功实付、确认退款、净额、已匹配付费客户数、客单价和可比较差异；不同币种保持独立。
- 已映射 HIS 项目结构、客户结构计数、`revisit | repurchase | reactivation` 机会计数、预约/随访效能等机构级聚合；所有跨线聚合均来自总控公共 `v1` 服务端 reader。
- 来源覆盖、高水位、freshness、readiness/分区状态、未匹配客户、未映射项目、孤儿退款、重复排除、失败/取消和其他质量摘要。
- `metricEvidence`：只包含白名单 `metricKey`、已计算数值/空值、币种、时间窗口、比较窗口、snapshot/version 和质量状态，用于逐条约束报告结论。

禁止字段包括 `customerId`、客户姓名/联系方式、任何客户级消费或机会、原始订单/支付/退款、导入文件或行、治疗/会话/随访正文、备注/自由文本、用户自由 prompt、外部标识/账号、凭证、provider payload、模型/Token/成本以及任何完整 snapshot 内部字段。AI 不得重算、四舍五入、换算、跨币种合并、修改或补齐核心数字。

### 9.2 五个固定报告方向

| 稳定代码 | 展示名称 | 允许聚焦内容 |
| --- | --- | --- |
| `overall_operations` | 综合经营 | 按币种经营结果、主要变化和质量覆盖。 |
| `consumption_trend` | 消费趋势 | 支付、退款、净额与上一等长周期的确定性趋势。 |
| `project_structure` | 项目结构 | 仅已映射 HIS 规范项目的结构、变化和覆盖缺口。 |
| `customer_repurchase` | 客户复购 | 机构级新/存量付费与复购相关聚合、三类机会计数；不下钻客户。 |
| `appointment_followup_effectiveness` | 预约随访效能 | 仅来自权威预约/随访公共 reader 的机构级结构化计数。 |

仅 `tenant_admin | tenant_operator` 可以人工按需生成。首期无自由 prompt、无定时/批量生成、无 worker/scheduler、无页面打开/刷新触发，也不得由指标卡、机会、导入或外部同步自动触发。

### 9.3 预检、留档与失败语义

生成流程固定为：选择固定方向和周期 → 服务端 snapshot/权限/完整性预检 → 展示输入覆盖 → 人工确认 → 调用总控批准 adapter → 结构化输出及低敏校验 → 创建不可变报告版本。

- 机构 scope、角色、snapshot、金额口径、币种分区、核心指标 evidence、关键来源校验、模板/版本或 `readiness = unavailable | denied | disabled | stale` 任一失败时硬阻断。
- 非关键项目/客户/机会/预约随访聚合缺失时，页面明确展示缺失、覆盖范围和不确定性；只有人工确认后才可继续，缺失必须写入报告。
- 报告固定展示方向、时区/周期、版本、生成时间、发起人低敏引用、来源/高水位/freshness、质量摘要、metric evidence、关键变化、数据不足和“仅供内部经营决策参考，需人工判断”。受限建议固定为结构化 `recommendations[]`，每项至少包含 `evidenceReferences`、`priority`、`expectedImprovementDirection`、`risk` 和 `uncertainty`；输出校验必须检查字段完整性，并确认每个 `evidenceReferences` 均能解析到本报告获准的 metric evidence，失败时不得展示或留档为成功。
- 当前机构管理员与运营共享历史。每份报告绑定 snapshot、报告输入/输出版本和来源状态，不可编辑、覆盖、硬删或导出，只能归档。
- 底层事实、映射或 snapshot 变化后标记“来源数据已变化”；需要更新时人工生成新版本，旧报告不回写。
- AI/provider 不可用、超时、额度不足或输出校验失败只让当前生成失败，不影响基础分析和历史报告；未经校验的部分文本不得展示或留档为成功。

---

## 十、总控唯一外部集成串行队列

以下均为总协调台唯一串行队列中的交付项，不是经营分析子队列，也不是 `AN-*` 的隐含授权。总协调台决定任务编号、顺序、允许路径、凭证/网络审批和生产放行；经营分析只提出业务契约、消费已批准 adapter 并验收。

| 总控队列交付项 | 经营分析提出/验收的契约 | 经营分析明确不做 |
| --- | --- | --- |
| HIS 目录与消费接入 | 当前机构 HIS 标准项目目录版本、来源项目引用映射、成功支付/确认退款、稳定消费单、客户引用、时区、高水位、幂等与追加纠正。 | 不实现 HIS adapter、凭证、网络、同步、重试或目录私有副本。 |
| ERP/POS 接入 | 来源支付/退款、稳定消费单、来源客户/项目引用、币种、高水位、重放与纠正；项目别名映射到有效 HIS 目录版本。 | 不把 ERP/POS 项目直接当 canonical 项目，不从页面直连外部系统。 |
| 受控文件导入 | 文件契约、预检、批次/行、幂等、合法行确认、客户匹配候选、HIS 项目映射候选和追加纠正。 | 不在经营分析页面解析/执行导入，不读取文件内容或导入 repository。 |
| AI 经营报告 provider | 只接收 `AnalyticsReportInputV1`，返回固定结构和 metric evidence 引用。 | 不实现 provider 私有逻辑、凭证/网络、自由 prompt、定时任务或核心数字计算。 |

`ControlledImportCommandV1` 的公共声明归总协调台，由独立受控导入集成任务生产和执行，并与管理中心逐字段一致。该命令精确且仅包含：`contractVersion`、`tenantId`、`institutionId`、`precheckId`、`fileSecurityReference`、`approvedScope`、`approvedRowCount`、`approvedRowsDigest`、`hisDirectoryVersion`、`mappingVersion`、`idempotencyKey`、`operatorReference`、`expectedVersion`、`sourceAuditReference`、`reasonCode`；其中 `contractVersion` 固定为 `'v1'`。不得把原始文件、行内容、客户 PII、订单/支付号、外部账号、凭证或额外 provider payload 传给经营分析。经营分析只验收最终规范化事实、批次摘要和治理结果，不发出或执行该命令。

受控导入生命周期固定为：文件接收 → 安全预检 → 结构校验 → 行级规范化 → 幂等/冲突预检 → 客户与 HIS 项目候选映射 → 人工确认合法行 → 不可变批次写入 → 新事实触发新 snapshot → 追加纠正。任何失败都不能伪造“导入成功”；重放必须可识别，更正必须保留原事实、原因、操作者和版本链。

经营分析页面刷新只读取本系统已持久化事实、snapshot 和治理摘要，不触发 HIS/ERP/POS/导入/报告 provider 调用、测试连接、同步、重试或补偿。

---

## 十一、五页统一发布门禁

五页固定为：`经营总览`、`消费分析`、`项目分析`、`客户与机会`、`AI 经营报告`。它们不是可独立提前正式发布的五个功能；必须在同一机构、角色、期间、时区、快照和能力状态下共同验收。

| 门禁 | 五页共同要求 |
| --- | --- |
| 路由与五页 | canonical 页面固定为经营总览、消费分析、项目分析、客户与机会、AI 经营报告；详情共用稳定链接和抽屉/移动全屏语义，旧 `/hospital/opportunities` 只有安全兼容跳转。 |
| 事实与口径 | 五页只消费同一 `AnalyticsSnapshotV1`；支付按成功日、退款按确认日、净额可负、上一周期等长、六类周期和多币种分区口径一致。 |
| 经营上下文 | snapshot 绑定同一 `InstitutionOperatingContextPayloadV1.version`、IANA 时区和 ISO 4217 默认币种；pending 按 `effectiveFromBusinessDate` 在下一统计周期边界生效，历史不回写。 |
| 稳定消费单 | 稳定业务消费单引用、去重和归集可审计；没有稳定引用时只关闭消费单数/次数、明细列表和记录详情，不阻断可靠的基础金额、趋势、项目、机会和 AI 报告。 |
| HIS 项目目录 | 当前机构存在真实、隔离、版本化且可审计的 HIS 标准项目目录；ERP/POS/导入别名映射到有效版本。未映射金额计总额但排除排行、占比和详情。 |
| 数据质量 | 同一来源覆盖、高水位、freshness、未匹配客户、未映射项目、孤儿退款、重复排除、失败/取消、纠正和负净额一致可见；只有权威空才显示 0。 |
| 跨线读取 | 所有公共读取均使用总控 `InstitutionSourceEnvelopeV1<T,K>`；reader 仅作服务端输入，只有顶层可 `partial`，消费者不读取生产者 repository/table。stale 不驱动报告或写操作。 |
| 机会边界 | 只展示 `revisit \| repurchase \| reactivation` 生命周期快照，不新增 CRM 状态、处理/转化动作或虚构机会实体。 |
| 安全与权限 | 仅 `tenant_admin \| tenant_operator` 可读和人工生成报告；`consultant \| customer_service`、越权深链接、scope mismatch 均 fail-closed 且不返回业务数据。 |
| 报告治理 | 五种固定方向、独立低敏 `AnalyticsReportInputV1`、关键缺失阻断、非关键缺失人工确认、metric evidence、不可变版本与只归档全部通过。 |
| 交付与发布 | `MIG-01 → MIG-06` 顺序、总控外部集成验收、领域/API/UI/权限/审计/局部失效回归均完成；由总协调台单独决定从 capability-off 进入导航。 |

任一门禁不满足时，经营分析保持隐藏或统一的未发布/不可用状态；不得显示“开发中”空壳、演示金额或推测性报告。代码合并、数据源连通、成功创建导入批次和生成 AI 文本均不等于正式发布成功。

---

## 十二、验证、停止条件与总控阻塞

每个获批 runtime 切片至少验证：纯领域单测/边界表、类型检查、相关 API 或 UI 测试、`git diff --check`、只允许文件清单、机构隔离和 capability-off 行为。涉及数据模型、受控导入、HIS/ERP/POS、AI provider、真实凭证、外部网络、worker/scheduler 或生产开关时，立即停止并取得对应独立授权，不得以本计划作为许可。

### 12.1 本计划的 docs-only 验证

1. Markdown 标题从单一 H1 顺序进入 H2/H3，不跳级；所有表格有分隔行且列数一致。
2. canonical 路由完整且唯一：`/hospital/analytics`、`/consumption`、消费详情、`/projects`、项目详情、`/opportunities`、机会详情、`/reports`、报告详情；旧机会路由只出现为兼容入口。
3. 角色代码、`InstitutionSourceEnvelopeV1<T,K>`、七态顶层 readiness、六态分区 readiness、服务端 reader 输入、`scope`、`freshness`、`partitions`、同一受控 `failureCode` 和公共声明所有权逐字段一致。
4. 成功实付、确认退款、净额、六类期间、上一等长周期、未匹配客户、未映射项目、孤儿退款、失败/取消/重复、过期、负净额和多币种口径完整。
5. `AnalyticsCustomerConsumptionV1` 及其 payload 与公共 envelope、`AnalyticsReportInputV1`、`AnalyticsDataGovernanceSummaryV1`、`InstitutionOperatingContextV1` 和 `ControlledImportCommandV1` 的生产/消费与禁止字段明确；`recommendations[]` 纳入报告输出校验。
6. HIS 标准项目目录、稳定消费单、固定报告方向、MIG-05/MIG-06 边界和五页统一门禁完整。
7. HIS、ERP/POS、受控导入和经营报告 provider 全部归总控唯一串行队列；栏目 PR 不实现 adapter。
8. 对未跟踪本文档使用安全 `git diff --no-index --check /dev/null <file>`，并确认最终 `git status --short` 只有本文档。

### 12.2 仍需总协调台决定的真实阻塞

- 在公共契约目录声明上述 `v1` 契约、逐字段一致的 `InstitutionSourceEnvelopeV1<T,K>` 和受控 failure code 白名单，并指定各服务端 reader/provider 的最终签名。
- 指定并验收 `InstitutionOperatingContextV1` 的机构设置/统一上下文 provider、管理中心控制面、`effectiveFromBusinessDate` 生效边界和数据过期阈值；在此之前只能使用明确标记的产品默认值。
- 严格按唯一队列审批并合并 `MIG-05` 与 `MIG-06`；栏目线不能提前建表或持久化 snapshot/报告。
- 在唯一外部集成串行队列中审批真实 HIS 目录/消费、ERP/POS、受控导入和报告 provider；没有真实 HIS 目录或权威消费事实时，五页正式发布持续阻塞。没有稳定消费单引用只关闭消费单数/次数、明细列表和记录详情，不阻断其余可靠分析与 AI 报告。
