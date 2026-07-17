# 机构端-管理中心技术计划（第三轮定点契约返修）

> **给后续执行 Agent 的要求：** 本文是 PLAN-SYS-REV-03 的 docs-only 定点返修，只修正第二轮验收列出的字段和路由冲突，不扩展页面、PR 数量或新能力，也不构成 runtime、schema、migration、外部 adapter、凭证或生产放行授权。任何 SYS-*、BASE-*、MIG-* 或外部集成任务都必须再次获得用户对具体范围的明确批准。

**目标：** 将管理中心固定为机构级控制面，以七个固定二级页一一对应规划真实、可解释、按机构隔离且受审计保护的能力；首个 runtime 候选仍固定为“AI 与额度只读页”。

**架构方案：** 公共契约声明由总协调台统一拥有，事实生产者在自身模块提供 provider，管理中心只通过服务端 reader 消费 contractVersion: v1 的机构范围投影。管理中心不读取生产者 repository 或 table，不拥有客户、会话、预约、随访、交易、知识、渠道交付或外部系统事实，也不因页面打开或刷新触发任何外部副作用。

**技术栈：** Next.js、React、TypeScript、Vitest、Drizzle、PostgreSQL、Git Worktree、GitHub PR。

---

## 一、任务边界与启动基线

| 检查项 | 结果 |
| --- | --- |
| 日期与时区 | 2026-07-17 CST（Asia/Shanghai） |
| 当前阶段 | 机构端七线并行开发的第三轮定点 docs-only 返修 |
| 任务编号 | PLAN-SYS-REV-03 |
| 当前分支 | detached HEAD |
| 当前 HEAD | e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa |
| origin/main | e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa |
| 启动状态 | 仅有本轮允许的目标计划文档 |
| 唯一允许文件 | docs/superpowers/plans/2026-07-17-institution-system-technical-plan.md |

已读取并作为上位约束：

- AGENTS.md；
- docs/superpowers/plans/2026-07-17-institution-seven-stream-development-plan.md；
- docs/superpowers/specs/2026-07-15-institution-navigation-page-system-design.md。

本轮不是源码实现，不修改 src、drizzle、schema、migration、API、测试、配置、脚本或其他文档；不访问凭证、数据库、外部网络或 AIBOTK runtime；不提交、推送、创建 PR、合并或继续任何 runtime。工作区一旦出现本文之外的改动，立即停止。

---

## 二、固定产品边界

### 2.1 管理中心只做控制面

| 业务事实 | provider 所在生产模块 | 管理中心允许做什么 | 管理中心禁止做什么 |
| --- | --- | --- | --- |
| 客户、归属、预约、随访 | 客户中心、预约与随访 | 读取低敏摘要；发起经批准的幂等命令 | 直接读写客户、预约或随访 repository/table |
| 会话、消息、渠道交付 | 会话工作台、渠道集成 | 读取状态和复核投影 | 保存消息正文、发送、重试或跨渠道补发 |
| 消费、支付、退款、导入事实 | 经营分析、导入生产者 | 读取治理摘要；发起受控导入命令 | 读取行原文或改写消费/支付事实 |
| 知识内容与客户授权 | 知识库、客户中心、隐私生产者 | 读取治理投影 | 扩大资料范围、批量推定客户同意 |
| AI 使用 | AI 使用生产者 | 读取全局低敏使用摘要、业务 serviceKey 聚合和可信额度 | 读取经营报告内容或管理模型、prompt、Token、provider、价格、成本 |
| 公共审计 | 总协调台公共审计 | 按角色读取机构范围白名单事件 | 伪造业务事件或展示敏感 payload |

所有公共契约的声明所有者均为总协调台。生产者在自身模块实现 provider；管理中心是消费者，只实现服务端 reader 和本线视图模型。任何消费者都不得绕过 provider 去读生产者 repository/table，也不得复制公共声明形成另一版本。

### 2.2 稳定角色代码

全线只使用以下四个稳定角色代码：

- tenant_admin；
- tenant_operator；
- consultant；
- customer_service。

管理中心导航和深链接只向 tenant_admin 与 tenant_operator 开放。consultant 与 customer_service 不进入管理中心；其与身份复核有关的动作只发生在会话工作台的既定入口。

### 2.3 七个固定二级页

名称、顺序、canonical 路由和切片编号固定如下，不得新增同义路由或调整顺序：

| 顺序 | 固定二级页 | canonical 路由 | 切片 | 固定职责 |
| --- | --- | --- | --- | --- |
| 1 | 系统概览 | /hospital/system | SYS-07 | 最后聚合已发布能力的真实低敏卡片 |
| 2 | 机构与成员 | /hospital/system/organization | SYS-02 | 机构设置、成员、一次性密码、状态治理和责任转交 |
| 3 | 渠道接入 | /hospital/system/channels | SYS-03 | 渠道、服务商、连接实例、四类独立状态及身份匹配 |
| 4 | 数据接入与治理 | /hospital/system/data | SYS-04 | 数据源、批次、高水位、治理异常、受控导入和映射 |
| 5 | AI 与额度 | /hospital/system/ai-usage | SYS-01 | 真实持久化使用、成功率、失败/拒绝、未完成、业务 serviceKey 摘要和可信剩余额度 |
| 6 | 数据与隐私 | /hospital/system/privacy | SYS-05 | 客户级同意、受限知识资料和留存治理投影 |
| 7 | 审计与安全 | /hospital/system/audit | SYS-06 | 机构范围低敏审计与安全状态 |

以下是产品规格已经冻结的既有列表/详情 canonical 路由，不新增页面能力，也不改变七个固定二级页：

| 既有页面/详情 | canonical 路由 |
| --- | --- |
| 成员详情 | /hospital/system/organization/members/:memberId |
| 渠道连接详情 | /hospital/system/channels/connections/:connectionId |
| 身份匹配 | /hospital/system/channels/mappings |
| 身份匹配详情 | /hospital/system/channels/mappings/:mappingId |
| 数据源详情 | /hospital/system/data/sources/:sourceId |
| 导入批次详情 | /hospital/system/data/imports/:batchId |
| AI 服务项目详情 | /hospital/system/ai-usage/services/:serviceKey |
| 审计详情 | /hospital/system/audit/:eventId |

### 2.4 桌面端、移动端和旧路由

- 桌面端承载成员管理、一次性密码、责任转交、身份匹配、受控导入、项目映射、策略修改和完整确认流程。
- 移动端使用全宽筛选器和单列状态卡；除获准角色的渠道紧急暂停外均只读。身份匹配、受控导入、项目映射、成员管理和策略修改不在移动端提供，不能出现桌面流程的只读候选详情或缩小版表单。
- /hospital/system/wecom/** 仅在新目标页正式可用后做安全兼容跳转。联系人入口跳到 /hospital/system/channels/mappings?channelType=wecom_customer_contact；旧映射列表跳到 /hospital/system/channels/mappings，旧映射详情经安全 mappingId 映射后跳到 /hospital/system/channels/mappings/:mappingId；mock 入口不得跳成生产入口。
- /hospital/system/his/** 仅在目标页正式可用后跳到 /hospital/system/data?sourceType=his 或安全的数据源详情。
- 兼容跳转不得形成第二套 canonical 页面，不得把旧查询参数直接当作服务端 scope 或授权依据。

---

## 三、公共 v1 读取契约

### 3.1 统一读取外壳

每次跨线读取只能消费总协调台声明的唯一公共类型 InstitutionSourceEnvelopeV1<T,K>：

~~~ts
type InstitutionSourceEnvelopeV1<T,K> = {
  contractVersion: 'v1';
  scope: {
    tenantId: string;
    institutionId: string;
  };
  readiness:
    | 'ready'
    | 'empty'
    | 'partial'
    | 'stale'
    | 'unavailable'
    | 'denied'
    | 'disabled';
  freshness: {
    observedAt: string;
    freshUntil: string;
  } | null;
  partitions: Array<{
    key: K;
    readiness:
      | 'ready'
      | 'empty'
      | 'stale'
      | 'unavailable'
      | 'denied'
      | 'disabled';
    freshness: {
      observedAt: string;
      freshUntil: string;
    } | null;
    failureCode:
      | null
      | 'upstream_unavailable'
      | 'timeout'
      | 'invalid_payload'
      | 'scope_mismatch'
      | 'permission_denied'
      | 'not_released'
      | 'data_incomplete';
  }>;
  data: T | null;
  failureCode:
    | null
    | 'upstream_unavailable'
    | 'timeout'
    | 'invalid_payload'
    | 'scope_mismatch'
    | 'permission_denied'
    | 'not_released'
    | 'data_incomplete';
};
~~~

reader 及其 AccessContext、角色和查询参数只作为服务端输入，不属于也不得进入响应 envelope。只有顶层 readiness 可以是 partial；分区 readiness 不包含 partial。顶层与分区使用同一组“null + 七个非空受控值”的 failureCode，不得增加其他 code，也不得返回异常文本、HTTP 状态或 provider 原始错误。

读取规则：

1. 只有权威查询成功且确实无记录时，readiness 才能为 empty，页面才可显示 0。
2. 顶层 partial 只展示已验证分区；只有 readiness 为 ready 或 empty 的分区贡献当前事实，失败分区显示未知或不可读取，不补 0。
3. stale 可展示以 observedAt 标明截止时间的已验证快照，但不得驱动当前写操作、行动队列、告警处置或“立即执行”按钮。
4. unavailable 不伪装成空数据；页面保留其他已验证分区。
5. 顶层 denied、disabled 或 failureCode 为 scope_mismatch 时 data 必须为 null；任一分区发现 scope_mismatch 时必须提升为顶层 scope_mismatch 并令整个 data 为 null。顶层 partial 中 denied、disabled 分区不得向 data 贡献业务片段，也不得泄露业务存在性。
6. 所有写命令在提交时重新读取最新权威状态；客户端曾看到 ready 不构成写入许可。

### 3.2 公共声明和 provider 边界

- InstitutionSourceEnvelopeV1、CapabilityStatusV1、IdentityMatchReviewV1、CustomerReferenceV1、InstitutionOperatingContextV1、AnalyticsDataGovernanceSummaryV1、ControlledImportCommandV1、AnalyticsReportInputV1 及其他跨线公共契约均由总协调台声明。
- 本计划可以记录已冻结字段、状态和消费规则，但不声称管理线拥有这些声明。
- 生产者负责 provider 的事实正确性、机构隔离、新鲜度、分区状态和审计引用。
- 管理中心服务端 reader 负责会话 scope、角色范围、字段白名单和失败关闭，不重新解释生产者内部表结构。
- 生产者尚未提供获批 provider 时，对应区块保持 disabled 或隐藏；不得由管理中心临时直连数据库补齐。

---

## 四、只读现状与发布判断

| 领域 | 当前可验证基础 | 主要差距 | 规划判断 |
| --- | --- | --- | --- |
| 机构资料与成员 | 租户、账号、密码哈希、重置标记和租户成员角色已有持久化基础 | 机构归属、正式设置、生效历史、成员治理和转交未形成机构范围闭环 | 依赖 MIG-01、MIG-02 和公共 provider 后实施 |
| 渠道与身份匹配 | 部分企微映射状态和客户渠道同意已持久化 | 候选周边仍有 mock/进程态；缺独立四状态与正式 adapter | 不得显示假“已连接”或假零值 |
| HIS 与数据治理 | HIS 连接元数据存在 | 主要是 tenant 范围；凭证和测试连接是敏感 runtime；ERP/POS、导入治理不足 | 只消费后续 institution-scoped 低敏 provider |
| AI 使用 | AI 调用使用记录可按 tenantId + institutionId 聚合 | 剩余额度存在 fixture/mock 路径 | SYS-01 是首个候选；fixture 剩余额度整块隐藏 |
| 隐私 | 客户渠道同意、退订和撤销已有部分持久化 | 敏感 AI 授权、受限知识资料和留存摘要未统一 | 客户级授权逐项读取，失败关闭 |
| 审计 | 通用审计已有操作者、角色、租户、动作和结果 | 缺正式 institutionId 范围和运营数据范围闭环 | 依赖 MIG-01 与公共审计 provider |

上述盘点只用于确定计划顺序。现有表、mock、测试数据、dry-run、mock_sent 或页面壳均不构成正式产品事实。

---

## 五、SYS-01：AI 与额度只读页

### 5.1 首个 runtime 候选固定范围

SYS-01 仍是唯一首个 runtime 候选，但本轮不授权实施。/hospital/system/ai-usage 首期只展示：

- 当前机构、受控时间范围内真实持久化的 AI 使用次数及可解释的已使用服务单位；
- 成功率，以及失败数和拒绝数；
- 未完成调用数；
- 按稳定业务 serviceKey 聚合的低敏摘要，至少覆盖会话 AI、知识问答和经营报告；
- 仅在来源权威、持久化、同机构、可追溯且 readiness 为 ready 时展示可信剩余额度；
- 数据截止时间、最近更新时间、分区状态和受控失败说明。

明确不展示、不管理：

- prompt、answer、completion、聊天原文或知识原文；
- 模型、Token、provider、内部折算、价格、成本、账单、合同或套餐变更；
- 成功数不单独展示，只作为成功率计算输入；不得用原始 serviceName、模型名或 provider 名替代业务 serviceKey；
- 趋势、排行或其他未经本轮冻结的扩展指标；
- fixture、mock_contract、fixture_backed 或无法与真实机构套餐联动的 remaining、上限、使用率和预警；
- 外部 AI 调用、模型配置、额度写入、扣减、超限策略或自动扩容。

### 5.2 固定指标口径

| 指标 | 口径 | 失败关闭 |
| --- | --- | --- |
| AI 使用 | 当前机构、受控周期内真实持久化记录数，以及权威记录中可解释的已使用服务单位合计 | 非权威读取失败不显示 0；单位缺失时只显示调用次数 |
| 成功率 | 生产者按冻结终态计算成功 ÷（成功 + 失败 + 拒绝）；成功数只用于计算，不单独展示 | 未知/未完成状态不进入分母；分母为 0 显示“--”，不显示 0% |
| 失败/拒绝 | 分别展示生产者冻结的失败终态数与拒绝终态数 | 不返回错误全文、命中输入或规则细节 |
| 未完成调用 | 生产者冻结的非终态真实持久化记录数 | 不进入成功率分母；来源不完整时不显示 0 |
| 业务 serviceKey 摘要 | 按生产者提供的稳定业务 serviceKey 聚合使用、成功率、失败/拒绝和未完成；至少包含会话 AI、知识问答、经营报告 | serviceKey 不稳定或分区不可用时对应摘要显示不可读取，不按模型、provider 或原始服务名自行归类 |
| 剩余额度 | 权威套餐额度减权威已用量，或权威 provider 直接给出的可信值 | 任一来源非 ready、不同机构或未联动时整块隐藏 |

时间范围按 InstitutionOperatingContextV1 的有效 current 时区解释；在该契约未提供前使用明确标记为产品默认的 Asia/Shanghai。stale 使用快照可展示截止时间，但不能驱动额度写操作、告警处置或套餐行动。

### 5.3 小 PR 分解

- [ ] SYS-01A：向总协调台提交 AI 使用 v1 读取契约需求；消费既有公共声明，冻结终态分类、未完成口径、业务 serviceKey、日期范围和 fixture 隐藏验收，不在管理线声明第二份公共 DTO。
- [ ] SYS-01B：由 AI 使用生产者提供 institution-scoped provider；管理中心只实现服务端 reader，验证跨机构、empty、partial、stale、denied、disabled 和失败关闭。
- [ ] SYS-01C：实现使用、成功率、失败/拒绝、未完成、serviceKey 摘要和可信额度的纯只读桌面/移动 UI；无写入口、无外部请求。
- [ ] SYS-01D：完成管理员/运营读取范围、低敏审计、真实来源和 capability 发布门禁；任何 fixture remaining 存在即不发布额度区块。

---

## 六、SYS-02：机构与成员

### 6.1 InstitutionOperatingContextV1

管理中心消费总协调台声明、机构设置/统一上下文 provider 提供的 `InstitutionOperatingContextV1`。该别名固定为 `InstitutionSourceEnvelopeV1<InstitutionOperatingContextPayloadV1, 'operating_context'>`；`contractVersion`、`tenantId + institutionId` scope、readiness、freshness、partitions 和 failureCode 只在 envelope，不在 payload 重复。payload 冻结字段和语义如下：

| 字段 | 冻结语义 |
| --- | --- |
| version | 不透明的并发控制版本 |
| source | 精确为 `institution_config \| product_default` |
| current | 当前有效 `{ timeZone, defaultCurrency }`；分别使用 IANA time zone 与 ISO 4217 currency code |
| pending | `null` 或下一统计周期待生效的 `{ timeZone, defaultCurrency, requestedVersion, effectiveFromBusinessDate }` |
| updatedAt | 权威修改时间 |
| updatedBy | 低敏操作者引用，不返回姓名、手机号或账号凭证 |

规则：

1. 未配置时使用 `current.timeZone=Asia/Shanghai` 与 `current.defaultCurrency=CNY`，并将 `source` 明确标记为 `product_default`；不得伪装成管理员已配置。
2. 只有 tenant_admin 可修改；tenant_operator 只读。
3. 修改在下一统计周期的 `pending.effectiveFromBusinessDate` 生效，`current` 与 `pending` 同时可解释，不能由浏览器自行切换。
4. 历史事实、历史 snapshot 和历史报告保留原口径，不回写、不重算。
5. `current.defaultCurrency` 只定义默认录入/展示口径，不执行换汇，不把不同币种直接相加。
6. 任何落库字段、历史回填或生效调度均需独立设计与批准；SYS 页面 PR 不承载 migration。

### 6.2 一次性密码

- 仅 tenant_admin 可在获准的成员邀请或密码重置命令中生成一次性密码；tenant_operator 只读。
- 明文只在命令成功后的单次受控交接视图出现。服务端只保存哈希，不进入 URL、日志、审计、通知重试 payload、客户端持久化或后续回显。
- 再次进入页面不能恢复旧明文，只能按授权重新生成并使旧凭据失效。
- 首次登录必须强制改密；过期、重放、失败锁定和密码重置状态由账号生产者的凭据状态机控制。成员停用/恢复只归 6.3 的成员状态机；凭据服务仅消费其结果并拒绝停用账号继续认证。
- 管理中心不自行声明第二套账号状态枚举，只消费公共状态与受控命令结果。

### 6.3 成员状态与角色

- 每名成员首期只有一个主角色，只能取四个稳定角色代码之一；不提供自定义角色或逐人权限复选框。
- 只有 tenant_admin 可创建成员、修改低敏显示名和主角色、停用或恢复账号；tenant_operator 只读成员和权限上限。
- 创建成员必须通过账号/成员生产者的幂等命令，并与一次性密码发行结果协调；管理中心不直接写 auth 或成员表。
- 角色变更、停用、恢复和首次改密状态全部由权威账号状态机给出 expectedRevision、合法迁移和受控 failure code；客户端不得直接切换状态。
- 降权或停用前先执行责任预检；恢复账号不会自动恢复历史责任、渠道授权或生产权限。
- 管理员不能修改平台角色上限、创建第五种角色或建立跨机构成员绑定。

### 6.4 责任转交

- 停用、降权或移出成员前，服务端 provider 必须预检当前机构内客户责任、活动会话、未完成预约、随访及其他已建责任对象。
- 接替人必须是同机构、有效且具备目标责任所需角色的成员；客户端选择不能替代服务端校验。
- 转交命令至少绑定 tenantId、institutionId、fromMember、toMember、expectedRevision、precheckId、idempotencyKey 和低敏操作者引用。
- 责任转交、成员状态变更和公共审计必须保持原子语义；失败不产生部分转交。
- 最后一名有效 tenant_admin 不得停用、降权或移出机构。
- 管理中心不读写客户、会话、预约或随访表，只调用责任生产者的预检和命令 provider。

### 6.5 小 PR 分解

为避免 SYS-02C/D 继续混合密码、责任转交、状态机和 UI，固定拆分：

- [ ] SYS-02A：机构资料与成员只读 reader；依赖 MIG-01 的机构归属。
- [ ] SYS-02B1：InstitutionOperatingContextV1 只读投影和默认值标记。
- [ ] SYS-02B2：管理员设置命令与并发/下一周期生效服务；schema/migration 另行批准。
- [ ] SYS-02B3：机构设置桌面 UI；运营只读。
- [ ] SYS-02C1：一次性密码发行/重置命令适配，不含 UI。
- [ ] SYS-02C2：首次改密、过期、重放、锁定和重置的凭据状态机适配，不含成员停用/恢复或 UI。
- [ ] SYS-02C3：一次性交接与状态反馈桌面 UI，不新增账号状态事实。
- [ ] SYS-02D1：成员创建与低敏显示名命令适配；协调 SYS-02C1 的一次性密码结果，不含 UI。
- [ ] SYS-02D2：角色变更、停用、恢复、移出和最后管理员保护的服务端状态机，不含 UI。
- [ ] SYS-02D3：责任转交预检与幂等命令；依赖 MIG-02，不含成员表单。
- [ ] SYS-02D4：成员创建、显示名、角色和状态管理桌面 UI。
- [ ] SYS-02D5：责任转交确认、阻断原因和原子失败反馈桌面 UI。
---

## 七、SYS-03：渠道接入

### 7.1 IdentityMatchReviewV1

渠道页严格消费总协调台已冻结的 IdentityMatchReviewV1：

| 字段组 | 冻结字段 |
| --- | --- |
| 身份与并发 | contractVersion: v1、reviewId、revision |
| scope | tenantId、institutionId |
| 会话来源 | conversationId、segmentId、connectionInstanceId、不可逆安全 irreversibleIdentityReference |
| 候选版本 | candidateSnapshotVersion、candidateSetDigest |
| state | pending_review、awaiting_customer_creation、matched、rejected、conflict、withdrawn、expired、revoked |
| lastDecision | confirm_existing、delegate_create_customer、reject、withdraw、revoke 或空 |
| 结果 | resolvedCustomer: CustomerReferenceV1 或空 |
| 决定信息 | lastDecisionReasonCode 或空、lastDecisionActorReference 或空 |
| 提交与分配 | submittedBy、submittedAt、assignedReviewer 或空、assignedAt 或空 |
| 时间 | decidedAt、expiresAt、expiredAt，均可为空 |
| 审计 | auditReference |

唯一合法状态迁移：

- pending_review → matched、awaiting_customer_creation、rejected、conflict、withdrawn、expired；
- awaiting_customer_creation → matched、pending_review、conflict、withdrawn、expired；
- conflict → pending_review，仅在形成新 candidateSnapshotVersion 后；
- matched → revoked；撤销后如需再匹配必须创建新的 reviewId；
- rejected、withdrawn、expired、revoked 均不得在原 review 上恢复为 matched。

职责与命令边界：

1. consultant 与 customer_service 只能从其已分配会话提交 review；不能在管理中心作决定。
2. tenant_admin 与 tenant_operator 在管理中心确认既有客户、拒绝、撤销或委派创建客户；对已匹配关系的 revoke 也必须走受控决定。
3. confirm_existing、delegate_create_customer、reject、withdraw、revoke 都必须携带 expectedRevision、candidateSnapshotVersion 和 idempotencyKey，并在服务端重验 scope、角色和候选版本。
4. `candidateReference` 仅服务端解析，不进入 URL、客户端持久化或审计。`IdentityMatchReviewV1` 跨线快照只暴露 `candidateSnapshotVersion` 和 `candidateSetDigest`；低敏候选摘要与短时效行动令牌若需要，必须定义为独立、短时、服务端授权的 UI 投影，不能并入该公共契约。
5. 管理中心不写客户表。delegate_create_customer 只委派客户中心的幂等命令。
6. 客户中心返回 CustomerReferenceV1 后，由身份服务重新校验机构、review revision 和候选版本，再原子转为 matched；失败时不得留下部分匹配或重复客户。
7. 客户创建与匹配审计以 reviewId 关联，不记录原始外部 ID、候选原文、消息正文或表单正文。

### 7.2 固定三层模型

| 层级 | 固定定义 | 示例与边界 |
| --- | --- | --- |
| 渠道类型 | 用户关系和消息能力所属的业务渠道 | 个人微信；企业微信客户联系，其中会话存档是受控能力；微信客服；未来获准渠道 |
| 接入服务商 | 向某渠道提供技术接入的 provider/adapter | 官方接口；AIBOTK；未来获准适配器 |
| 连接实例 | 当前机构的具体账号与接入组合 | tenantId + institutionId、具体账号安全引用、渠道类型、服务商、低敏别名、能力矩阵 |

AIBOTK 永远是接入服务商，不是渠道类型，也不是系统状态。它只允许进入总协调台批准的受控试点。

连接实例不得返回原始外部 ID、手机号、二维码内容、cookie、token、secret、webhook、凭证引用明文或 provider payload。能力矩阵只能表达获准能力，例如接收、人工回复、会话存档可用性、主动发送许可和紧急暂停支持。

### 7.3 四类状态必须独立

每个连接实例分别读取以下四种状态，不得折叠成单一“已连接”：

1. 授权状态：机构是否已授予服务商访问指定能力。
2. 连接状态：凭证和链路是否完成本系统定义的连接。
3. 渠道可用状态：该渠道能力当前是否可被业务安全使用。
4. 生产放行状态：是否已通过安全、稳定、审计和运营门禁，允许生产发送。

连接成功不等于渠道可用；渠道可用不等于可生产发送。任一上游状态 stale、unavailable、denied、disabled 或 scope mismatch 时，不得把下游状态推定为 ready。

### 7.4 AIBOTK 试点边界

- 只能使用非核心、可隔离、可撤销的试点账号，禁止接入核心客户资产账号。
- 必须保留人工接管路径、可观测状态和按连接实例的急停；自动化失效时业务切回人工，不做隐式补发。
- 禁止自动营销、批量群发和跨渠道补发；失败消息不能因服务商切换而在另一渠道重发。
- PoC 通过不等于生产放行。安全评审、隐私范围、稳定性窗口、速率限制、审计、人工接管演练和急停演练均为独立门禁。
- 服务商 adapter、凭证、真实网络、测试连接、发送和恢复全部在独立外部集成任务交付，不能进入 SYS 页面 PR。

### 7.5 角色和控制边界

| 动作 | tenant_admin | tenant_operator |
| --- | --- | --- |
| 读取低敏状态 | 允许 | 允许 |
| 渠道紧急暂停 | 允许，需服务端预检和审计 | 允许，限已确认范围，需服务端预检和审计 |
| 首次授权 | 允许 | 禁止 |
| 重连 | 允许 | 禁止 |
| 撤销授权/连接 | 允许 | 禁止 |
| 重新启用/解除急停 | 允许 | 禁止 |
| 生产放行状态 | 只读；放行由总协调台和外部集成门禁决定，SYS 不提供放行命令 | 只读；不得发起放行 |

紧急暂停的持久化安全状态只有在 MIG-06 获批后进入正式事实；在此之前不得以进程内布尔值或前端状态代替。移动端只允许上述获准的紧急暂停，授权、重连、撤销和重新启用仅桌面管理员可见。

### 7.6 小 PR 分解

- [ ] SYS-03A：消费总协调台三层模型、四状态和能力矩阵公共声明。
- [ ] SYS-03B：实现连接实例与状态的 institution-scoped 服务端 reader 和只读 UI。
- [ ] SYS-03C1：实现紧急暂停预检/命令适配；依赖获批 MIG-06，不含 UI。
- [ ] SYS-03C2：实现桌面/移动急停确认和状态反馈 UI。
- [ ] SYS-03D1：实现管理员授权、重连、撤销和重新启用命令适配，不含 provider runtime。
- [ ] SYS-03D2：实现仅桌面管理员可见的控制 UI。
- [ ] SYS-03E1：实现 IdentityMatchReviewV1 服务端 reader 与命令适配；不实现候选算法或客户写入。
- [ ] SYS-03E2：实现管理员/运营身份复核桌面 UI；会话提交入口仍归会话线。
- [ ] 外部渠道/AIBOTK adapter：进入总协调台串行队列，独立于全部 SYS PR。

---

## 八、SYS-04：数据接入与治理

### 8.1 AnalyticsDataGovernanceSummaryV1

管理中心消费 AnalyticsDataGovernanceSummaryV1，只展示：

- 低敏数据源类型、状态和安全引用；
- 导入/同步批次安全引用、权威状态和时间；
- 数据高水位和明确时区；
- 覆盖范围、完整性、新鲜度；
- v1 scope、readiness、freshness、分区状态和受控 failure code。

数据载荷必须明列以下治理维度，不得用一个“异常总数”替代：

| 治理维度 | 冻结展示要求 |
| --- | --- |
| 稳定消费单可用性 | 明确表示稳定业务消费单是否可计数/查看；不可用时说明受控原因，不能用支付笔数或导入行数替代 |
| 接受/拒绝 | 接受计数与拒绝计数分别展示 |
| 重复 | 被识别并排除的重复计数 |
| 冲突 | 未解决的幂等、来源或版本冲突计数 |
| 未匹配客户 | 未获得有效 CustomerReferenceV1 的记录计数 |
| 未映射项目 | 未映射到当前有效 HIS 标准目录版本的记录计数 |
| 多币种 | 多币种异常或不可直接聚合的记录计数；不同币种不相加 |
| 孤儿退款 | 无法关联有效稳定消费单的退款计数 |
| 追加纠正 | 已追加纠正记录计数，保留原事实和版本链 |

上述计数仍逐分区遵守 InstitutionSourceEnvelopeV1：只有权威查询成功且确实为空时显示 0；partial 中只使用已验证分区，stale 只显示 observedAt 截止快照且不能驱动纠正或导入。

明确不得包含：

- 文件名、路径、原始行、行片段或上传者自由文本；
- 原始外部 ID、支付标识、订单号原文；
- 姓名、手机号、证件、地址等 PII；
- credential、token、secret、webhook、连接字符串；
- provider 请求/响应 payload、错误堆栈或可逆敏感引用。

只有权威批次查询成功且确实没有记录时才显示 0。某分区 stale 时可显示截至时间和已验证异常计数，但不得据此发起当前导入修复或行动队列。

### 8.2 ControlledImportCommandV1

tenant_admin 与 tenant_operator 可在桌面端完成服务端预检后确认 ControlledImportCommandV1。命令冻结要求：

| 字段 | 要求 |
| --- | --- |
| contractVersion | 固定为 'v1' |
| tenantId | 服务端绑定并在确认时重验 |
| institutionId | 服务端绑定并在确认时重验 |
| precheckId | 不可变、短时有效，只对应一次权威预检快照 |
| fileSecurityReference | 不可逆、不可由客户端改写的文件安全引用，不含文件名或路径 |
| approvedScope | 预检批准的数据类型、周期和允许动作 |
| approvedRowCount | 获准合法行数；必须与预检快照一致 |
| approvedRowsDigest | 获准合法行集合的不可逆摘要；不得包含原始行 |
| hisDirectoryVersion | 预检绑定的当前有效 HIS 标准目录版本 |
| mappingVersion | 预检绑定的项目/客户映射版本 |
| idempotencyKey | 同机构同预检命令的幂等键 |
| operatorReference | 当前低敏操作者引用及稳定角色 |
| expectedVersion | 命令及预检状态的并发控制版本 |
| sourceAuditReference | 受控审计关联 |
| reasonCode | 总协调台白名单内的受控导入原因码 |

控制规则：

1. 预览只读取已解析的低敏预检投影，不写入批次、行、消费、支付、退款或映射事实。
2. 确认时重新验证 precheckId、tenantId、institutionId、fileSecurityReference、approvedScope、approvedRowCount、approvedRowsDigest、hisDirectoryVersion、mappingVersion、idempotencyKey、operatorReference、expectedVersion、sourceAuditReference 和 reasonCode；stale 预检必须重新执行。
3. 导入生产者拥有批次、行状态、消费事实和追加纠正；管理中心只发起受控命令并读取结果。
4. 项目映射只能指向当前有效、未撤销且版本匹配的 HIS 标准目录；自由文本、过期目录或未验证项目不能成为正式映射目标。
5. 管理中心不读取上传文件、不解析原始行、不直接写经营或支付表。

### 8.3 追加纠正边界

- HIS、ERP、POS 来源事实错误时优先回来源系统纠正，并由各自 adapter 重新同步；管理中心只读取新的权威状态。
- 没有回源能力的受控导入只能新增纠正记录，并安全引用原事实、原批次/行、受控原因、操作者、expectedRevision 和 idempotencyKey。
- 追加纠正形成新的可审计事实，不覆盖、删除、静默改写或伪造回滚历史；原记录和纠正链均由导入/经营事实生产者持有。
- 管理中心只消费纠正预检和结果 provider，并发起获批命令；不直接写批次、行、消费、支付、退款或映射表。

### 8.4 小 PR 分解

- [ ] SYS-04A：消费 AnalyticsDataGovernanceSummaryV1，完成数据源/批次/高水位/治理异常只读 reader。
- [ ] SYS-04B：实现桌面/移动只读治理 UI；局部失败和 stale 截止时间独立显示。
- [ ] SYS-04C1：消费受控导入预检 provider，仅展示低敏预览。
- [ ] SYS-04C2：适配 ControlledImportCommandV1 的桌面确认命令；不实现导入 runtime。
- [ ] SYS-04D1：消费有效 HIS 标准目录和映射 provider。
- [ ] SYS-04D2：实现桌面项目映射 UI；不修改 HIS adapter 或目录事实。
- [ ] SYS-04E1：消费追加纠正预检/命令契约；不实现来源回写或事实存储。
- [ ] SYS-04E2：实现桌面追加纠正确认和结果 UI；原历史保持可见且不可覆盖。
- [ ] HIS、ERP、POS、受控导入 adapter：各自作为独立交付单元进入总协调台外部集成串行队列。

---

## 九、SYS-05：数据与隐私

### 9.1 客户级授权

- 客户级同意、退订、撤销和受限知识资料授权必须逐客户、逐用途、逐渠道读取；机构策略、成员角色、渠道连接或导入成功均不能批量视为客户同意。
- 未知、过期、撤销、读取失败、scope mismatch 或来源不可靠时 fail-closed，不得扩大处理范围。
- 管理中心只展示机构级低敏治理计数和异常类别；不提供批量“补同意”或绕过撤销的操作。

### 9.2 知识受限资料的隐私治理投影

- 受限资料的内容事实、版本、用途范围和客户授权仍分别归知识库与客户/隐私生产者所有。
- 管理中心只消费低敏治理投影，例如授权状态计数、即将过期计数、撤销计数、范围冲突计数和数据截止时间。
- 投影不得包含客户身份、文件名、知识原文、切片文本、OCR 原文、embedding、检索结果、prompt、answer 或 provider payload。
- 管理中心不得把客户中心可见范围扩大到知识库，也不得把知识库授权扩大到客户中心；两侧都必须由服务端分别校验 tenantId + institutionId、客户引用、用途和版本。
- stale 投影可供治理观察，不能驱动批量授权、知识发布或自动触达。

### 9.3 敏感 AI 授权与留存策略

- 一般渠道授权不得替代敏感 AI 授权。治理投影至少分开显示授权、即将到期、撤销、未知和范围冲突计数，不返回客户身份或授权原文。
- 客户级授权的获取与撤销仍在客户/会话生产流程完成；管理中心只提供低敏治理摘要、结构化筛选和安全入口。
- 原始会话与问答预览保留期只允许 tenant_admin 在系统批准的 90–365 天范围内受控修改，产品默认 180 天；tenant_operator 只读并处理被授权的数据质量异常。
- 保留期命令必须绑定 tenantId、institutionId、expectedRevision、幂等键、受控原因和低敏操作者，并由隐私生产者执行；管理中心不直接删除数据。
- 必要业务事实、知识精确引用和安全审计使用独立生命周期，不随预览保留期缩短而删除或失去可解释性。
- pending 策略和实际清理状态必须分别展示；stale、partial 或审计不可写时不能提交策略变更。

### 9.4 小 PR 分解

- [ ] SYS-05A：消费客户级同意和受限知识资料 v1 治理投影。
- [ ] SYS-05B：实现 institution-scoped 低敏 reader、逐用途分区状态和失败关闭。
- [ ] SYS-05C：实现客户同意、敏感 AI 授权和受限知识资料的只读治理 UI 与安全跳转。
- [ ] SYS-05D1：消费保留期当前/待生效状态和受控策略命令，不实现清理 runtime。
- [ ] SYS-05D2：实现仅桌面管理员可见的保留期确认 UI；运营只读。
- [ ] 原始数据清理、高风险处置和原文查看：分别另行设计与审批，不进入 SYS-05 页面 PR。

---

## 十、SYS-06：审计与安全

### 10.1 固定数据范围

- tenant_admin：可读取当前机构内公共白名单允许的全部低敏审计事件。
- tenant_operator：只可读取已授权模块的低敏事件，加上本人的低敏操作事件。
- 两个角色都不得跨机构读取；consultant 与 customer_service 不进入管理中心审计页。
- 管理员与运营使用同一 institution-scoped 公共审计 provider 和同一字段白名单，只通过服务端数据范围过滤产生差异，不能各自维护第二套事实。

### 10.2 安全字段与依赖

审计详情仅展示必要的动作、结果、受控原因码、低敏资源引用、角色和时间。不得返回 credential、token、secret、原始请求、聊天内容、HIS payload、文件名、行原文、SQL、DB URL 或 stack。

机构级审计归属和机构设置依赖 MIG-01。渠道持久化安全状态依赖获批 MIG-06；SYS-06 只能消费，不得在本线自建 migration 或用前端/进程态补事实。

### 10.3 小 PR 分解

- [ ] SYS-06A：消费总协调台 institution-scoped 审计 v1 声明和 provider。
- [ ] SYS-06B：实现管理员/运营统一服务端 reader、范围过滤和受控筛选。
- [ ] SYS-06C：实现桌面/移动只读审计 UI 与局部失败状态；安全控制命令仍归对应能力切片。

---

## 十一、SYS-07：系统概览

SYS-07 永远最后实施，只聚合已经正式发布的六个子页能力：

- 每张卡只显示 CapabilityStatusV1、2 至 3 个真实低敏指标、数据截止时间和 canonical 详情链接。
- 卡片必须沿用原 provider 的 v1 scope、readiness、freshness、分区状态和 failure code，不二次查询生产者 table。
- 无权限、disabled 或 denied 的卡片不返回业务数据；unavailable 不显示 0；stale 明示截止时间且不形成行动队列。
- 移动端单列卡片，只读；桌面端也不在概览复制成员、导入、渠道或隐私写操作。

“需要处理”列表只消费总协调台公共声明和各生产者提供的低敏行动投影：

- 只纳入当前 tenantId + institutionId、当前角色确实可行动且对象分区为 ready 的唯一对象；partial 响应只纳入其中 ready 分区的对象。
- stale、empty、unavailable、denied、disabled、scope mismatch 或来源无法验证的对象一律不进入列表或 badge。
- 每项使用生产者给出的稳定 actionReference 和 actionKind 跨卡去重；同一底层对象只计一次，导航 badge 与列表使用同一去重口径。
- 列表只提供低敏原因、截止时间和 canonical 目标链接，不在概览执行命令；进入目标页后仍重新验证最新 revision、readiness、scope、角色和审计。

小 PR：

- [ ] SYS-07A：定义管理线内部卡片视图模型和去重键，只消费公共契约。
- [ ] SYS-07B1：实现状态卡服务端聚合 reader 与分区失败测试。
- [ ] SYS-07B2：实现“需要处理”服务端 reader、角色过滤、稳定去重和 stale 禁入测试。
- [ ] SYS-07C：实现状态卡与只读行动列表 UI、角色可见性和 canonical 跳转。

---

## 十二、唯一 migration 队列

唯一顺序固定为：

MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06

| migration | 总计划范围 | 管理中心依赖/边界 |
| --- | --- | --- |
| MIG-01 | 机构归属与机构级审计 | 机构归属、InstitutionOperatingContextV1 持久化设置和机构审计依赖；SYS 只提出/消费申请 |
| MIG-02 | 客户稳定引用、责任归属与随访结构化结果 | 责任转交和 CustomerReferenceV1 相关 provider 依赖；SYS 不写跨域表 |
| MIG-03 | 知识不可变版本与发布指针 | 隐私页只消费受限知识治理投影，不拥有知识 schema |
| MIG-04 | 会话、消息、分配、风险和逐消息结果 | IdentityMatchReviewV1 的会话来源由生产线提供；SYS 不拥有会话 schema |
| MIG-05 | 消费、支付、退款、导入批次和项目映射 | AnalyticsDataGovernanceSummaryV1、ControlledImportCommandV1 结果和项目映射由生产者提供 |
| MIG-06 | 指标快照、AI 报告与持久化安全状态 | 管理中心只消费全局 AI 使用摘要和获批安全状态；经营报告 snapshot、来源完整性、留档和版本生命周期归经营分析 |

约束：

1. 同一时间只允许一个 migration PR，严格按上述顺序。
2. 栏目计划只能提出或消费申请，不能另造 SYS-MIG、MIG-SYS 或其他并行编号。
3. 页面、状态机、UI 或命令 PR 都不得夹带 schema/migration。
4. 未获批 migration 的能力保持 disabled 或只读差距状态，不以临时字段、JSON、fixture 或进程态绕过。

---

## 十三、唯一外部集成串行队列

以下均由总协调台排入唯一队列，逐项、独立、串行交付；同一表格行是一个独立交付单元，ERP 与 POS 分开，渠道官方接口也按具体渠道分开。栏目 PR 只提出业务契约、消费已批准 adapter 并验收：

| 独立 adapter/交付单元 | 生产者责任 | 管理中心边界 |
| --- | --- | --- |
| HIS | 连接、凭证、安全测试、目录和同步 | 只读状态、治理摘要和获准控制命令 |
| ERP | 数据接入、批次和来源事实 | 只读治理摘要 |
| POS | 数据接入、批次和来源事实 | 只读治理摘要 |
| 受控导入 | 文件安全引用、预检、批次、行和事实消费 | 预览低敏投影并发起 ControlledImportCommandV1 |
| 单一渠道官方接口 | 对个人微信、企业微信客户联系或微信客服分别交付授权、连接、接收/发送和交付事实 | 只读四状态及获准控制面 |
| AIBOTK | 受控试点 adapter、人工接管和急停能力 | 只读状态；不拥有 provider runtime |
| OCR | 文档解析和低敏结果 provider | 不展示原文；只读治理状态 |
| embedding | 索引向量生成和版本事实 | 不读取向量；只读治理状态 |
| rerank | 检索排序 provider | 不读取 payload；只读治理状态 |
| 知识 AI | 知识问答 provider 和用途边界 | 只读隐私/治理投影 |
| AI 经营报告 provider | 只接收 AnalyticsReportInputV1，并返回总协调台冻结的固定结构与 metric evidence 引用；不持有 snapshot、来源完整性、留档或版本生命周期 | 管理中心不消费报告输出或报告发布状态，只通过 AI 使用生产者消费全局 AI 使用摘要 |

每一项都要有独立分支、允许路径、fake 契约测试、凭证/真实网络审批、审计、急停和生产放行判断。PoC、测试连接成功或 adapter 合并都不等于栏目可发布。

经营分析线负责生成并验证 AnalyticsReportInputV1，拥有分析 snapshot、来源完整性、报告输入/输出留档、不可变版本和归档生命周期。AI 经营报告 provider 只完成固定结构生成，不能重算核心数字、补齐缺失来源或成为报告事实所有者；管理中心不复制这些事实。

---

## 十四、角色、设备与写操作总表

| 能力 | tenant_admin | tenant_operator | 移动端 |
| --- | --- | --- | --- |
| AI 使用与可信额度 | 只读 | 只读 | 只读 |
| 机构设置 | 可受控修改 | 只读 | 只读 |
| 成员与一次性密码 | 可受控操作 | 只读 | 不提供成员管理或一次性密码入口 |
| IdentityMatchReviewV1 决定 | 可操作 | 可操作 | 不提供身份复核入口或候选详情 |
| 渠道状态 | 只读 | 只读 | 只读 |
| 渠道紧急暂停 | 可操作 | 可在已确认边界内操作 | 唯一可获准的移动写操作 |
| 渠道授权、重连、撤销、重新启用 | 仅管理员 | 禁止 | 禁止 |
| 受控导入确认 | 可操作 | 可操作 | 禁止 |
| 项目映射 | 可操作 | 按批准范围可操作 | 禁止 |
| 隐私治理摘要 | 只读；策略另行审批 | 只读 | 只读 |
| 审计 | 当前机构白名单全量 | 授权模块 + 本人低敏操作 | 只读 |

任何写操作都要在服务端重新验证 role、tenantId + institutionId、对象归属、expected revision、最新 readiness、幂等键和审计可写性。审计不可写时，高风险命令 fail-closed。

---

## 十五、发布门禁和验证计划

### 15.1 每页共同发布门禁

1. 数据真实持久化、来源可解释，并由权威 provider 提供。
2. 所有跨线读取符合公共 v1 契约和服务端 institution scope。
3. 空、局部、过期、不可用、拒绝和禁用状态按冻结语义呈现。
4. 管理员/运营数据范围、深链接和对象归属均由服务端验证。
5. 页面打开、刷新和查看详情不产生外部调用、同步、发送、测试连接、扣费或状态改变。
6. 不含 fixture、mock、进程内事实、原始外部 ID、PII、credential 或 provider payload。
7. capability-off、跨机构、无权限、局部失败、stale、幂等和审计失败均有验收。
8. 代码完成、PoC 成功或 adapter 合并不等于生产放行；最终仍需人工判断。

SYS-01 额外门禁：使用、成功率、失败/拒绝、未完成调用和业务 serviceKey 摘要来自真实持久化记录；成功数只用于成功率；remaining 只有可信 provider 为 ready 才显示，否则整个额度剩余区块隐藏。

### 15.2 本文档返修验证

- Markdown 标题层级连续，表格各行列数一致；
- 七个固定二级页和八个已冻结列表/详情 canonical 路由各自只有一个定义；
- InstitutionSourceEnvelopeV1<T,K> 的 scope、七种顶层 readiness、六种分区 readiness、freshness、data，以及 null + 七个非空受控 failureCode 逐字段一致；
- 固定四角色代码、三层渠道模型、四类状态、八个 IdentityMatchReviewV1 状态均可检索；
- ControlledImportCommandV1 的十五个冻结字段、AnalyticsDataGovernanceSummaryV1 的指定治理维度和 AI serviceKey 摘要均可检索；
- MIG-01 至 MIG-06 只使用唯一顺序；
- 旧 wecom/his 路由只作为兼容跳转；
- git diff --check 通过；
- git status --short 仅包含本文档。

---

## 十六、真实阻塞与停止条件

仍需总协调台完成的真实前置，不由本计划自行决定：

1. 发布公共 v1 声明、受控 failure code 白名单、服务端 reader 约定和各生产者 provider 责任清单。
2. 按唯一队列分别批准并交付 MIG-01 至 MIG-06；管理中心不得先行创造替代数据模型。
3. 按唯一外部集成队列逐项批准 adapter、凭证、真实网络、安全测试、急停和生产放行。
4. 在每个 SYS 小 PR 开工前明确允许文件、当时基线、测试范围和 capability 发布门禁。

后续出现 schema/migration、外部网络、凭证、真实发送、生产配置、跨模块直接读写，或无法证明 institution-scoped 权威来源时，立即停止并请求明确授权。

---

## 十七、docs-only 自检

- [x] 保持七个固定二级页，补齐产品已冻结的八个列表/详情 canonical 路由，并保持桌面/移动边界和旧 wecom/his 兼容跳转。
- [x] 稳定角色统一为 tenant_admin、tenant_operator、consultant、customer_service。
- [x] 所有跨线读取逐字段统一为 InstitutionSourceEnvelopeV1<T,K>；reader 参数只在服务端输入，只有顶层允许 partial。
- [x] 公共声明归总协调台，管理中心不读生产者 repository/table。
- [x] 首个候选仍是 AI 与额度只读页，恢复未完成调用与业务 serviceKey 摘要，fixture 剩余额度隐藏，且不展示 prompt、answer、模型、Token、provider、价格或成本。
- [x] 固定渠道三层模型、独立四状态、AIBOTK 试点边界和管理员/运营控制边界。
- [x] 完整记录 IdentityMatchReviewV1 的 reviewId/revision、八状态、受控决定、CustomerReferenceV1 原子回填和服务端 candidateReference。
- [x] 冻结 InstitutionOperatingContextV1、AnalyticsDataGovernanceSummaryV1 指定治理维度和 ControlledImportCommandV1 十五字段超集。
- [x] 客户级授权不批量视为同意，知识受限资料投影不扩大数据范围。
- [x] migration 唯一顺序和外部 adapter 唯一串行队列已收口；AI 经营报告 provider 只接收 AnalyticsReportInputV1，报告 snapshot/完整性/留档/版本归经营分析。
- [x] SYS-02C/D 已将密码、责任转交、状态机和 UI 拆分。
- [x] 本轮未授权 runtime、schema/migration、外部集成、提交、推送、PR 或合并。
