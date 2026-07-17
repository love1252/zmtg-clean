# 机构端工作台技术计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 将机构端工作台收敛为受控的只读聚合层：行动区展示四张 Care 固定卡和 Care/生产会话行动队列，辅助区保留客户旅程条、受控快捷创建和可解释的局部业务摘要；工作台不承担业务写入，也不读取生产方内部表或 repository。

**架构方案：** 行动卡与行动队列只消费外部生产者契约 `CareActionSourceV1` 和 `ConversationActionSourceV1`；客户旅程条消费客户中心生产的 `CustomerLifecycleSummaryV1`；快捷创建和局部业务摘要消费总协调台声明的 `CapabilityStatusV1`。所有公共声明由总协调台维护，生产者在自己的模块实现 provider，工作台仅通过服务端 reader 消费。工作台领域层按分区处理 scope、新鲜度、失败、去重、排序和截断；页面使用 RSC 首读和受控局部读取通道，不直接访问生产者 repository/table。

**技术栈：** Next.js、React、TypeScript、Vitest、Testing Library、机构访问控制、版本化内部契约。

---

## 1. 文档状态、启动基线与任务边界

| 项目 | 结果 |
|---|---|
| 日期与时区 | `2026-07-17 CST` |
| 任务编号 | `PLAN-WB-REV-03`（第三轮定点 docs-only 返修；原计划 `PLAN-WB-01`） |
| Worktree | `/Users/dongxiaolong/.codex/worktrees/4d52/zmtg-clean` |
| 当前分支 | `HEAD (detached)` |
| 当前 `HEAD` | `e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa` |
| `main` | `e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa` |
| `origin/main` | `e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa` |
| 启动时 `git status --short` | 仅本文档为第一轮未跟踪文件，无其他改动 |
| 本轮唯一允许改动 | 本文档 |

本轮只修第二轮验收列出的公共读取、Care action、Conversation action 和 WB-03 通知前置字段冲突，不扩展页面、PR 数量或新能力；不是 `WB-01` runtime 实现，也不构成 schema/migration 或外部集成授权。本轮不修改 `src/**`、`drizzle/**`、schema、migration、API、测试、配置、脚本或其他文档；不访问凭证、数据库、外部网络，不执行提交、推送、PR 或合并。

本文不授权以下内容：

- 不接入真实 HIS、渠道、会话、消息、发送、worker 或 scheduler。
- 不修改根 `/hospital`、`InstitutionWorkspace`、`InstitutionPageState`、公共权限、公共审计或任何冻结的大型 `tenant-business-*` 文件。
- 不将客户 `nextAction`、备注、生命周期分段、机会池、AI 模拟数据或静态数字伪装成行动项；客户旅程条只是只读分布，不进入行动队列。
- 不让工作台直接读取 Customer、Care 或 Conversation 的 repository、表、旧客户端或内部 DTO。
- 不自行声明公共契约、迁移编号或外部 adapter；只记录总控 integration request。

---

## 2. 只读盘点结论

### 2.1 当前工作台

| 现状 | 证据 | 对目标工作台的结论 |
|---|---|---|
| 根入口是 `src/app/hospital/page.tsx`，经 `DemoSessionGate` 仅允许 `tenant_admin`，随后渲染 `InstitutionWorkspace`。 | `src/app/hospital/page.tsx` | 不是七栏目真实路由壳；不能由工作台线直接改造。提交给 `BASE-01A`。 |
| `InstitutionWorkspace` 用本地 `activeView` 切换全部栏目。 | `src/modules/workspace/components/InstitutionWorkspace.tsx` | 刷新、前进后退和详情深链接都不稳定；工作台线只可在将来的新目录中准备组件，接入根壳需 integration request。 |
| 当前首页并发读取 customers、appointments、followups；任一失败就清空整个 `dashboardSummary` 并进入整页错误。 | 同上 `loadDashboardSummary` | 不满足部分失败、局部刷新与来源隔离；新模型必须按 source/子计数局部失效。 |
| 当前 `buildInstitutionDashboardSummary` 显示客户总数、高优先级客户、待确认预约、待处理/完成随访、机会池，并把客户 `nextAction` 放入行动队列。 | `src/modules/workspace/domain/institution-dashboard-view-models.ts` | 旧 summary 不能成为新工作台来源，也不能复制进新实现。 |
| 当前行动项只跳转 `activeView`，没有对象详情 URL；最多 5 条，没有会话来源、稳定全局排序、数据新鲜度或逐项状态。 | 同上及 `InstitutionWorkspace.tsx` | 需要新的纯领域聚合与真实 URL；旧 action item 仅作为迁移对照。 |
| 旧只读 dashboard aggregation 已有 disabled/partial/stale 文案，但服务的是 demo 只读聚合，不是 Care/Conversation 行动源。 | `src/modules/workspace/domain/v1-workspace-dashboard-readonly-aggregation-view-models.ts` | 可借鉴状态命名，不可复用作业务行动契约。 |

### 2.2 Care、Customer 与 Conversation

| 范围 | 已有能力 | 缺口与工作台约束 |
|---|---|---|
| 预约 | `AppointmentStatus` 已含 `pending_confirmation`、`reschedule_requested`；现有记录有预约 ID、客户低敏显示名、预约时间、负责人和状态。 | 当前列表和 repository 按 `tenantId` 读取；预约没有可供工作台消费的机构级 source、新鲜度、逐卡错误或详情 URL。Care 线必须以机构级、角色过滤后的 source 输出。 |
| 随访 | 任务有 `dueAt`、`riskLevel`、`status`、`suggestedAction`；状态含 `due`、`in_progress`、`escalated`、`completed`、`cancelled`。 | “逾期”和“今日到期”尚不是稳定 source bucket；须由 Care 按机构时区计算，排除已完成/取消，并输出可解释的过滤口径。 |
| 客户 | Customer record 已有 `institutionId` 与低敏显示字段，客户时间线可关联预约、随访和审计。 | `nextAction` 是自由文本，禁止作为工作台行动来源。客户旅程条只消费客户中心 provider 的 `CustomerLifecycleSummaryV1`；行动项中的客户信息由 Care/Conversation 以低敏 `CustomerReferenceV1` 随行提供。工作台不单独读取客户列表、时间线或客户 repository。 |
| 会话 | `AiConversationWorkbenchShell` 使用 `getAiConversationWorkbenchFixture()` 在浏览器内存中模拟；明确为 mock、不真实发送。 | 不存在持久化生产会话 source、机构级列表或生产详情路由。任何 fixture、mock、dry-run 或仅前端状态都不得进入队列。`ConversationActionSourceV1` 未交付前，工作台不显示会话行动或以静态零值补位。 |

### 2.3 权限与审计

| 现状 | 风险 | 计划要求 |
|---|---|---|
| `AccessContext` 可携带 `tenantId` 和可选 `institutionId`，现有角色为 `tenant_admin`、`tenant_operator`、`consultant`、`customer_service`。 | `canAccessResource` 的核心 target 是 `tenantId`；当前预约、随访列表 API 都按租户读取。 | 新 source 必须由服务端同时验证 `tenantId + institutionId + role + 数据范围`。工作台不得在客户端补足授权。 |
| 当前 Customer 相关路径已有部分 `tenantId + institutionId` 查询；预约、随访的普通列表和旧 dashboard 仍是 tenant 范围。 | 工作台若直接复用旧 client/repository 会产生跨机构泄露风险。 | 新工作台只接收 source 已过滤的 snapshot；任何 scope 缺失、错配或未知角色均拒绝整条来源。 |
| `TenantAuditEvent` 和普通审计查询以 tenant 范围为主，事件本体没有可靠 `institutionId` 字段。 | 新的机构工作台读操作无法证明机构级审计边界。 | `BASE-04` 先解决机构级审计；工作台 runtime 再按批准的 `dashboard/read` 审计策略接入，不能自行扩展 audit schema。 |

### 2.4 所有权结论

`CareActionSourceV1`、`ConversationActionSourceV1`、`CustomerLifecycleSummaryV1` 在当前源码中均不存在；`CapabilityStatusV1` 也尚未形成可供工作台消费的冻结 runtime 声明。根据《机构端七线并行开发总计划》和本轮总控冻结，它们的公共定义统一位于 `src/modules/institution-contracts/v1/**` 且仅由总协调台修改。Care、会话、客户中心及获准的能力 provider 分别生产数据，工作台只做消费者。

工作台线未来仅拥有：

- `src/modules/institution-workbench/**` 及其独占测试；
- 在共享契约已经合并后，对四个公共契约及嵌套 `CustomerReferenceV1` 的只读 import；
- 工作台领域聚合、工作台客户端组件与其局部状态测试。

工作台线不拥有根路由、公共导航、公共页面状态、`src/modules/workspace/**` 既有大文件、`src/modules/security/**`、`src/modules/audit/**`、`src/modules/institution-contracts/v1/**`、Customer/Care/Conversation/Capability provider 或任何 schema/migration。

---

## 3. 目标边界与公共契约

### 3.1 消费边界与公共声明所有权

工作台的**当前行动队列**只允许消费 `CareActionSourceV1` 与 `ConversationActionSourceV1`。客户旅程条另行消费 `CustomerLifecycleSummaryV1`，受控快捷创建和局部业务摘要另行消费 `CapabilityStatusV1`；后二者是辅助展示输入，绝不进入行动队列。禁止输入 Customer 列表/时间线、机会池、治疗摘要、客户自由文本 `nextAction`、旧 `buildInstitutionDashboardSummary`、旧 `tenant-business-client`、任何生产者 repository/table、mock fixture 或浏览器本地状态。

四项公共契约及嵌套的 `CustomerReferenceV1`、失败码、scope、freshness 和分区结构均是**总协调台拥有的外部生产者契约**。本节只镜像总控冻结字段供消费者验收，不是在工作台线声明新的 envelope、DTO 或竞争版本。Care、Conversation、Customer 和能力所有者在各自模块实现 provider；工作台只实现服务端 reader 和消费端兼容测试。

### 3.2 通用读取语义（总控冻结字段镜像）

工作台不声明新的 envelope、freshness 或 failure code，只镜像总协调台唯一公共类型：

```ts
type InstitutionSourceEnvelopeV1<T, K> = {
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
```

reader 只接收服务端 `AccessContext` 作为输入，不属于也不得进入响应 envelope。只有顶层 `readiness` 可以是 `partial`；分区 readiness 不包含 `partial`。顶层 `denied`、`disabled` 或 `failureCode: 'scope_mismatch'` 时必须 `data: null`；顶层 `partial` 中 readiness 为 `denied`/`disabled` 的分区不向 `data` 贡献业务片段。工作台不得添加第八种 failure code，也不得把 HTTP、异常文本或 reader 参数写入公共响应。

第 3.3 节要求的 Care action `sourceVersion` 是单条权威行动版本。WB-03 局部刷新还需要一个不透明 revision 来检测旧页面冲突，但“source 级还是分区级、字段位置、由 producer 还是工作台 API 生成”尚未被总控冻结，列为 `IR-WB-01` 的真实阻塞。总协调台必须唯一选择一种形态后才能实现；工作台不得用任一 action `sourceVersion` 代替整段 revision，也不得自行把 `409` 塞入公共 readiness/failure code。

统一解释如下：

1. `ready` 表示相关权威查询成功且在有效期内；`empty` 表示权威查询成功并确认结果为空。当前值只来自 `ready`/`empty`，且只有权威空结果可以显示 `0`；第 3 条的带截止时间 stale 安全快照是唯一历史数字例外。
2. 顶层 `partial` 只是分区汇总，UI 必须继续按每个分区自身 readiness 解释：`ready`/`empty` 显示当前事实，`stale` 按第 3 条显示安全快照，`unavailable` 显示 `--`，`denied`/`disabled` 不接收该分区业务片段；`scope_mismatch` 使用受控 failure code 并令顶层 `data: null`。只有 `ready` 分区贡献当前行动。
3. `stale` 可携带已验证的卡片或旅程计数快照，并显示“截至 {observedAt}”；过期数据不得驱动当前写操作、快捷动作或行动队列。没有安全快照时显示 `--`。
4. `unavailable` 不把未知事实变成 `0`；`denied`、`disabled` 和 `failureCode: 'scope_mismatch'` 不返回卡片计数、客户引用、行动项或详情链接等业务 payload。
5. 刷新只重新读取相应公共 provider；不得读取另一来源、旧 dashboard、repository 或浏览器缓存补位。

### 3.3 外部生产者契约 `CareActionSourceV1`

**公共声明所有者：** 总协调台。**provider 所有者：** Care 线。**消费者：** 工作台。Care provider 负责四个固定分区、四卡业务 payload、Care 行动、canonical 链接及分区 freshness；工作台不得从预约/随访 DTO 自行重算状态、日期 bucket 或权限范围。

固定分区只能是：

```text
pending_confirmation_appointments
reschedule_requested_appointments
overdue_followups
today_due_followups
```

V1 payload 结构固定为 `cards + actions`。正常可用时 `cards` 覆盖四个固定 key；每个分区另有独立 `readiness`、`freshness` 和受控 failure code。若没有真实 HIS 预约事实，两个预约分区必须是 `disabled`，业务 payload 不得包含这两个分区的卡片记录、计数、行动或链接，工作台也不得合成假卡或假 `0`；分区状态元数据不属于业务卡片。

`CareActionItemV1` 的字段集合与枚举精确镜像如下，不得保留 `appointmentId`、`followupTaskId`、`scheduledAt`、`risk`、`labels` 或其他本地别名：

| 精确字段/嵌套类型 | 精确类型/受控值 |
|---|---|
| `entityType` | `appointment \| followup` |
| `objectId` | 非空对象 ID；预约和随访统一使用此字段。 |
| `sourceVersion` | 非空权威来源版本；不得替代 WB-03 的刷新 revision。 |
| `CustomerReferenceV1` | 必含低敏客户引用；具体嵌套字段名沿用公共声明，不在工作台重命名。不得含手机号、病历号、渠道账号或外部 ID。 |
| `businessState` | `pending_confirmation \| reschedule_requested \| pending \| in_progress \| waiting_customer \| escalated` |
| `cardKeys` | 只能引用 `pending_confirmation_appointments \| reschedule_requested_appointments \| overdue_followups \| today_due_followups`。 |
| `sortSignals` | 只能引用 `urgent \| overdue \| sla_due \| today \| high_priority`。 |
| `appointmentAt` | 有效 ISO 时间或 `null`。 |
| `dueAt` | 有效 ISO 时间或 `null`。 |
| `slaAt` | 有效 ISO 时间或 `null`。 |
| `riskLevel` | `normal \| watch \| urgent` |
| `priority` | `normal \| high` |
| `owner` | 公共契约规定的低敏 owner 值或 `null`；工作台不重定义其内部形状。 |
| `safeSummary` | 受控低敏摘要或 `null`；非空时规范化后最多 120 个 Unicode 字符。 |
| `detailHref` | 仅允许第 3.5 节 canonical 对象详情路由。 |

`entityType: 'appointment'` 只允许 `businessState: 'pending_confirmation' | 'reschedule_requested'`；`entityType: 'followup'` 只允许 `businessState: 'pending' | 'in_progress' | 'waiting_customer' | 'escalated'`。`overdue` 与 `today_due` 只能由机构时区和业务时间派生为 `overdue_followups`/`today_due_followups` 卡片归属及 `overdue`/`today` 排序信号，绝不能写入 `businessState`。

固定卡与目标链接是不可变的产品口径：

| 卡片 key | 显示名称 | 权威口径 | 固定 href |
|---|---|---|---|
| `pending_confirmation_appointments` | 待确认预约 | 当前角色可处理、状态仍为 `pending_confirmation` 的真实预约，按预约 ID 去重。 | `/hospital/care/appointments?status=pending_confirmation` |
| `reschedule_requested_appointments` | 改约申请 | 当前角色可处理、HIS 尚未原子接受新时段的 `reschedule_requested` 请求，按预约 ID 去重。 | `/hospital/care/appointments?status=reschedule_requested` |
| `overdue_followups` | 逾期随访 | 机构时区下，未完成且未取消、到期时间早于今日起点的随访任务，按任务 ID 去重。 | `/hospital/care/followups?bucket=overdue` |
| `today_due_followups` | 今日到期随访 | 机构时区下，未完成且未取消、到期时间落在今日的随访任务，按任务 ID 去重。 | `/hospital/care/followups?bucket=today` |

Care 必须保证卡片数字与**相同服务端范围**下的目标列表筛选结果一致；相同对象即使同时拥有多个受控排序信号，队列仍只出现一行。例如改约分区读取失败时，其他三个成功分区保持有效，改约分区显示 `--` 且不贡献行动。没有真实 HIS 时，两张预约卡不得出现，正式工作台导航仍由完整能力门禁控制，不能因随访可用就越过发布门禁。

### 3.4 外部生产者契约 `ConversationActionSourceV1`

**公共声明所有者：** 总协调台。**provider 所有者：** Conversation 线。**消费者：** 工作台。该 source 只有两个固定分区：`waiting_human` 与 `unresolved_risk`，只输出持久化、生产可用、处于真实生产分段且已按服务端 scope/RBAC 过滤的行动。fixture、mock、dry-run、演示发送、本地内存会话和未落库对象一律不输出。

`ConversationActionItemV1` 必须保留下列精确字段，不得改名为 Care 字段或本地 display 字段：

| 精确字段 | 精确类型/受控值 |
|---|---|
| `conversationId` | 非空持久化会话 ID。 |
| `segmentId` | 非空真实生产分段 ID。 |
| `sourceVersion` | 非空权威来源版本。 |
| `production` | 固定为 `true`；其他值拒绝。 |
| `subject` | `customer(CustomerReferenceV1) \| unmatched_contact('待匹配联系人')`；variant 内部字段沿用公共声明，不在工作台重定义。 |
| `conversationState` | 使用公共声明的会话状态；工作台不重命名或从摘要推断。 |
| `riskState` | 使用公共声明的风险状态；工作台不重命名为 `risk`。 |
| `partitions` | 只能引用 `waiting_human \| unresolved_risk`。 |
| `sortSignals` | 与 Care 统一，只能引用 `urgent \| overdue \| sla_due \| today \| high_priority`。 |
| `lastCustomerMessageAt` | 使用公共声明的客户最后消息业务时间；不得改名 `lastInboundAt`。 |
| `slaAt` | 使用公共声明的 SLA 时间。 |
| `priority` | 使用公共声明的受控优先级。 |
| `assignee` | 使用公共声明的低敏分配信息；不得改名 `owner`。 |
| `safeSummary` | 使用公共声明的受控低敏摘要；不得从消息正文生成。 |
| `detailHref` | 仅允许 `/hospital/conversations/:id`。 |

已匹配联系人只通过 `subject` 的 `customer(CustomerReferenceV1)` variant 提供低敏客户引用；未匹配联系人必须使用 `unmatched_contact('待匹配联系人')` variant，不得伪造客户引用。provider 与工作台 display model 均不得包含渠道昵称、渠道名片、外部账号、手机号、完整消息正文、最近消息片段、provider payload、模型思考或凭证。

缺 `conversationId`/`segmentId`、缺 scope、`sourceVersion` 不可用、`production !== true`、subject 非法、分区非法或当前角色不可见的条目均拒绝进入队列。source 为 `stale`、`unavailable`、`denied`、`disabled`、`failureCode: 'scope_mismatch'`，或当前角色没有 Conversation 模块权限时，会话筛选隐藏；`ready`/`empty` 且角色有模块权限时可保留筛选。本计划不增加会话统计卡或静态占位数字。

### 3.5 工作台行动行与 canonical 详情链接

工作台领域层只输出脱敏 display model。稳定行 key 是完整模板值，不是字面前缀 union：

```text
appointment:${objectId}
followup:${objectId}
conversation:${conversationId}
```

允许的对象详情路由只有：

| 实体 | canonical `detailHref` | 工作台动作 |
|---|---|---|
| 预约 | `/hospital/care/appointments/:id` | “查看详情”，不在工作台编辑预约。 |
| 随访 | `/hospital/care/followups/:id` | “查看详情”，不在工作台流转、认领或完成。 |
| 生产会话 | `/hospital/conversations/:id` | “查看详情”，不在工作台发送消息。 |

工作台按实体从受控对象 ID 构造并验证路径，不透传任意 URL、任意 query 或生产者提供的显示文本。字段白名单不含 scope ID、手机号、病历号、渠道账号、消息正文、客户自由备注、金额、provider payload、凭证、请求体、堆栈或 audit payload。目标页必须以同一服务端 scope 重新验证角色、机构归属、对象存在性和当前状态；工作台能生成链接不代表目标操作获准。

### 3.6 外部生产者契约 `CustomerLifecycleSummaryV1`

**公共声明所有者：** 总协调台。**provider 所有者：** Customer 线。**消费者：** 工作台客户旅程条。该契约遵循第 3.2 节的 `v1`、scope、readiness、freshness、分区状态和 failure code，生命周期稳定 key 为：

```text
consulting
scheduled
post_care
repurchase_window
silent_reactivation
```

工作台只展示前四类；`silent_reactivation` 留在经营分析/机会识别，不显示、排序或计入工作台。旅程条是只读分布，不产生行动项。每类计数只有在权威查询成功时显示数字；`stale` 只能显示带“截至某时”的安全快照，没有安全快照显示 `--`。

跳转必须由工作台用生命周期 allowlist 构造，禁止消费 provider 任意 href：

```text
/hospital/customers?lifecycle=consulting
/hospital/customers?lifecycle=scheduled
/hospital/customers?lifecycle=post_care
/hospital/customers?lifecycle=repurchase_window
```

目标客户列表使用相同服务端 scope/RBAC 重新查询。工作台不得读取 Customer repository、客户列表、时间线或自由文本 `nextAction` 来补旅程计数。

### 3.7 外部公共契约 `CapabilityStatusV1`

**公共声明所有者：** 总协调台。**状态生产者：** 获准的能力与模块所有者。**消费者：** 工作台快捷创建、局部业务摘要和导航门禁。状态按代码成熟度、机构授权、连接可用、数据 freshness、生产放行五个维度生成服务端最终结论，工作台只消费精确三值 `hidden | read_only | operational`，不自行检查 provider、凭证或环境变量，也不增加第四种展示/动作决策。

工作台所需的 capability 切片至少冻结下列消费语义，具体字段名和 capability key 注册表由总协调台拥有：

| 消费语义 | 约束 |
|---|---|
| 注册能力 key 与服务端展示决策 | key 必须来自公共注册表；未知 key 拒绝。`hidden` 不渲染，`read_only` 不启用创建，`operational` 仍须通过角色动作权限。 |
| 低敏业务标签与摘要 | 标签最多 40、摘要最多 120 个 Unicode 字符；只能描述业务可用/部分可用/过期，不得包含 adapter、端点、凭证或技术异常。 |
| readiness、freshness | 按第 3.2 节处理；stale 可保留带截止时间的摘要，但不启用动作。 |
| 公共 display order | 只按注册表顺序显示，不解析摘要文本排序。 |
| 可选诊断目标 key | 只能映射到总协调台注册的管理中心 canonical 路由；provider 不得返回任意 URL，普通业务摘要默认不可点击。 |

受控快捷创建呈现为一个“新建”菜单，菜单项只允许以下三个目标，且仅当对应 capability 明确允许当前角色创建时逐项显示：

```text
/hospital/customers?create=1
/hospital/care/appointments?create=1
/hospital/care/followups?create=1
```

全部菜单项隐藏时不显示空“新建”菜单。快捷创建只做导航；目标模块重新验证 scope、角色、能力与业务前置条件，工作台没有创建 API 或写入动作。局部业务摘要只显示 capability 提供的受控低敏业务状态，不展示 adapter 名、连接地址、凭证状态、技术错误或外部系统详情；诊断入口按注册目标跳管理中心。`stale` capability 快照不得启用快捷创建。若没有真实 HIS 预约事实，预约创建与两类预约行动保持 `disabled`，正式工作台导航仍须通过完整能力门禁。

---

## 4. 队列、局部失效与显示规则

### 4.1 精确 RBAC 与同范围一致性

稳定角色代码只能是 `tenant_admin | tenant_operator | consultant | customer_service`。所有过滤在外部 provider 和工作台服务端 reader 执行，客户端筛选只改变已授权集合的展示，不能扩大数据范围。

| 角色 | Care 卡片/行动/目标列表 | Conversation 行动 | 未分配 `waiting_human` |
|---|---|---|---|
| `tenant_admin` | 当前 `tenantId + institutionId` 内，且当前管理员拥有 Care 来源模块权限的数据。 | 当前 scope 内且拥有 Conversation 来源模块权限的活动生产分段。 | 可见，但仍要求当前机构与 Conversation 权限。 |
| `tenant_operator` | 当前 `tenantId + institutionId` 内，且当前运营拥有 Care 来源模块权限的数据。 | 当前 scope 内且拥有 Conversation 来源模块权限的活动生产分段。 | 可见，但仍要求当前机构与 Conversation 权限。 |
| `consultant` | 仅本人已分配任务、本人角色池未认领任务，以及本人是 HIS 客户负责人的预约。 | 仅本人已分配的活动生产分段。 | 不可见。 |
| `customer_service` | 仅本人已分配任务、本人角色池未认领任务，以及本人是 HIS 客户负责人的预约。 | 仅本人已分配的活动生产分段。 | 不可见。 |

Care 四卡计数、Care 队列、点击后的预约/随访目标列表必须使用同一服务端范围；Conversation 队列与目标列表亦同。对象详情页再按当前会话重验 scope、来源模块权限、分配/角色池/HIS 客户负责人关系与对象当前状态。角色切换、撤权、转派或认领后旧 snapshot 不得继续授权；`denied`、`disabled`、`failureCode: 'scope_mismatch'` 均不返回业务数据。工作台不允许“聚合可见但列表不可见”或靠 UI 隐藏修补范围差异。

### 4.2 去重、排序与截断

1. 只纳入 scope 匹配、分区为 `ready`，或顶层 `partial` 中成功且未过期分区的有效行动；`empty` 没有行动。`stale`、`unavailable`、`denied`、`disabled`、`failureCode: 'scope_mismatch'` 和非法 payload 一律不入队。
2. 按第 3.5 节完整稳定 key 去重。同一随访同时紧急且逾期、同一会话同时待人工与未解决风险时只保留一行，合并受控分区标记。
3. 全局排序只能读取 Care/Conversation 统一的 `sortSignals`，优先顺序固定为：`urgent`、`overdue`、`sla_due`、`today`、`high_priority`；没有信号的普通行动排在其后。工作台不得解析 `safeSummary`、客户名称、owner/assignee 文案或标签文本推断优先级。
4. 同一排序组用受控业务时间升序：预约使用 `appointmentAt`，随访使用 `dueAt`，会话使用 `lastCustomerMessageAt`；带 `sla_due` 信号时另要求有效 `slaAt`。实体主业务时间缺失/非法，或所需 SLA 时间缺失/非法时整行拒绝；仅时间相同时按完整稳定 key 字典序。
5. 桌面取全局排序前 6 条，移动取同一排序前 4 条；移动 4 条必须是桌面 6 条前缀。筛选先于截断，不能为移动端另建排序。
6. 队列筛选仅有“全部、预约、随访、会话”；Conversation source 为 `stale`、`unavailable`、`denied`、`disabled`、`failureCode: 'scope_mismatch'`，或当前角色无 Conversation 模块权限时隐藏“会话”；`ready`/`empty` 且有模块权限时可显示。筛选结果为空是“当前筛选无结果”，不能伪装成 source 权威空或来源失败。
7. 截断外对象只通过获准的 Care/Conversation 正式列表访问；链接按受控 key 构造，不新增工作台伪列表，不在 URL 放姓名、消息或自由文本。

### 4.3 卡片、旅程与来源状态矩阵

| source/状态 | 卡片或旅程条 | 当前行动队列 | 点击/快捷动作 | 页面提示 |
|---|---|---|---|---|
| Care `ready` | 可用分区显示权威数字 | 纳入有效 Care 行 | 卡片可跳正式筛选 | 无错误提示 |
| Care `empty` | 权威查询确认为空的分区显示 `0` | 无对应 Care 行 | 可打开同范围空列表 | 业务空状态 |
| Care 顶层 `partial` | 各分区按自身 readiness：ready/empty 当前值、stale 安全快照、unavailable `--`、denied/disabled 无业务 payload | 只纳入 `ready` 分区 | 仅当前可用分区可点击 | 分别标识 stale/失败/拒绝/禁用分区 |
| Care `stale` | 有安全快照则显示“截至某时”的值，否则 `--` | 所有 stale 分区行动剔除 | stale 卡不可驱动当前写动作；列表仍重新读取 | 过期提示与截止时间 |
| Care `unavailable` / 非法 | `--` | 受影响分区不入队 | 不提供失效业务链接 | 低敏不可用提示 |
| Care `denied` / `failureCode: 'scope_mismatch'` | 不接收计数、引用或链接 payload | 不入队 | 不可点击 | 局部无权限提示 |
| Care 预约 `disabled` | 两个预约分区不输出业务卡片、假 `0` 或链接 | 不输出预约行动 | 不显示预约快捷创建 | capability 门禁保持关闭 |
| Conversation `ready` | 本计划无会话卡 | 纳入真实生产分段，会话筛选可见 | 行可跳详情 | 无错误提示 |
| Conversation `empty` | 不显示静态 `0` 卡 | 无会话行 | 会话筛选可保留 | 业务空状态 |
| Conversation `stale` / `unavailable` / 非法 | 不受影响 | 会话行与筛选隐藏 | 无失效详情链接 | 会话局部提示 |
| Conversation `denied` / `disabled` / `failureCode: 'scope_mismatch'` | 不接收业务 payload | 不输出会话行，筛选隐藏 | 不可点击 | 无假零值 |
| Customer lifecycle `ready` / `empty` | 前四类显示权威数字，权威空显示 `0` | 从不入队 | allowlist 链接可用 | 无错误或业务空状态 |
| Customer lifecycle `stale` | 有安全快照则显示“截至某时”，否则 `--` | 从不入队 | 目标列表重新读取 | 局部过期提示 |
| Customer lifecycle 其他失败 | 前四类受影响项 `--`；denied/disabled 无业务 payload | 从不入队 | 不提供失效业务链接 | 低敏局部提示 |
| Capability `ready` | 显示获准的低敏业务摘要 | 从不入队 | 仅 `operational` 且角色获准时显示快捷创建 | 无错误提示 |
| Capability `stale` | 有安全快照则显示“截至某时”的低敏摘要，否则 `--` | 从不入队 | 禁用快捷创建 | 局部过期提示 |
| Capability `unavailable` / 非法 | `--` | 从不入队 | 不启用快捷创建 | 低敏不可用提示 |
| Capability `denied` / `disabled` / `failureCode: 'scope_mismatch'` | 不接收业务摘要或动作 payload | 从不入队 | 隐藏快捷创建 | 局部无权限/未发布状态 |

每个来源和分区均有独立刷新边界；局部失败保留其他仍新鲜或获准展示的已验证快照，不得调用旧 `dashboardSummary`、另一来源或自由文本补位。

### 4.4 未知值、空值、过期与对象变化

- `0` 是“权威成功且已去重后的数量为零”，不是默认值。
- `--` 是没有安全快照的未知、失败、过期或尚未加载；不得用 `safeNumber(value) ?? 0` 类逻辑降级。`denied`、`disabled`、`failureCode: 'scope_mismatch'` 直接不接收业务 payload。
- 已匹配客户引用缺失必要低敏字段、摘要超长、ISO 时间无效、风险/排序信号非法时，该行动行无效；未匹配会话联系人仅使用固定文案“待匹配联系人”。
- 过期行动不保留在“当前行动队列”中；stale 卡片/旅程数字只作为带验证截止时间的只读快照。若未来产品需要历史行动，必须单独设计历史区，不能混入当前排序。
- 刷新后对象已被完成、取消、关闭、撤权或删除时，来自该 source 的行立即移除；跳转目标应显示自身的不存在/无权限/状态变化结果。

---

## 5. 正式读取、页面组成与局部刷新通道

### 5.1 页面组成

`WB-03` 按产品规格保留下列区域，不能把工作台缩减为 Care/Conversation 队列：

1. 紧凑页头：标题“工作台”、业务说明、最后成功更新时间和刷新；
2. 条件式异常提示条：只在部分数据不可用、真实可计算风险或权限异常时出现，不为正常 `empty`/`disabled` 制造告警；
3. Care 固定卡（真实能力可用时四张；桌面最多 3 列；无真实 HIS 时不渲染两张预约假卡）；
4. 当前行动队列（唯一行动来源仍是 Care/Conversation）；
5. 客户旅程条（`CustomerLifecycleSummaryV1` 前四类）；
6. 一个受控“新建”菜单（`CapabilityStatusV1` 对客户/预约/随访三项逐项决定可见与可操作）；
7. 局部业务摘要（只显示低敏能力/业务状态，技术诊断经注册目标跳管理中心）。

移动端采用两列紧凑 Care 卡，随后立即展示最多 4 条行动队列，再展示客户旅程、“新建”菜单和局部业务摘要；不得把桌面卡片纵向堆成超长首屏。页头刷新与局部异常条在桌面/移动使用同一状态语义。

### 5.2 RSC、API 与 Server Action 所有权

| 通道 | 所有者 | 用途 | 边界 |
|---|---|---|---|
| `/hospital` RSC 首读与路由挂载 | 总协调台 `BASE-01A` 拥有根壳；工作台拥有其独占 server component 与 snapshot service | 服务端并发读取四项公共 provider，返回分区化 display model | 根壳不由工作台线修改；scope 只取服务端会话，不接收客户端 `tenantId`/`institutionId`。 |
| `GET /api/institution/workbench?section=care\|conversation\|lifecycle\|capabilities` | `WB-03` 工作台线 | 登录态内的局部刷新；`section` 为固定 allowlist | API 只调用工作台 snapshot service 和公共 provider reader；不读生产者 repository/table，不触发外部系统同步。 |
| Server Action | 无 | 工作台本身没有创建、认领、流转、发送或刷新写操作 | 快捷创建和详情只导航到目标模块；目标模块拥有写入及重验。不得另建与读取 API 竞争的 Server Action。 |

工作台 snapshot service 以当前服务端 `AccessContext` 绑定四角色、`tenantId + institutionId` 和来源模块权限，并分别返回 Care、Conversation、lifecycle、capabilities 分区结果。RSC 首读与 API 局部刷新调用同一服务，不允许产生两套权限、排序或空值语义。客户端只接收低敏 display model，不接收外部契约原始 payload、scope ID 或 failure 细节。

### 5.3 失效与版本冲突契约

失效注册表和公共失效 port 由总协调台拥有；生产者只在自身权威事实成功提交后请求相应分区失效，工作台线不得跨模块 import mutation 或自行监听 repository/table：

| 失效分区 | 权威触发事实 | 刷新影响范围 |
|---|---|---|
| `care` | 预约确认/改约事实、随访到期/完成/取消/转派、权限范围或机构时区配置变化 | Care 卡片与 Care 行，不替换会话/旅程/能力已验证结果。 |
| `conversation` | 生产分段进入/退出待人工或未解决风险、分配变化、会话关闭 | 仅会话行与筛选。 |
| `lifecycle` | 客户生命周期权威分段变化 | 仅前四类旅程计数。 |
| `capabilities` | 机构授权、连接可用、数据 freshness 或生产放行变化 | 快捷创建、局部业务摘要与正式导航门禁。 |

`overdue_followups` 与 `today_due_followups` 的 `freshUntil` 不得晚于下一个机构时区日界；跨日由读取时 freshness/缓存 TTL 自然到期处理，不新建 scheduler、worker 或 cron。机构时区配置变更是已提交事实，立即请求两个随访时间分区失效；若未来需要主动日界通知，须另向总协调台申请授权。服务端 cache key/tag 必须包含 `contractVersion` 与不可由客户端伪造的 scope 标识，并按上述分区隔离。

`IR-WB-01` 唯一冻结刷新 revision 的层级、字段和所有者后，刷新请求才携带最后已见 revision；冲突由工作台 API 的传输层返回 `409`，不新增公共 readiness/failure code。服务端不得合并新旧版本或保留受影响旧行动，而应强制重读该分区。任何刷新都只读取已持久化的项目内权威事实，不调用 HIS、渠道或其他外部系统。

首期闭环固定为“授权 RSC 首读 → 用户手动刷新或业务操作返回后的对应分区授权 GET → 仅以 GET 返回事实更新 UI”。首期不依赖实时通知 transport，未交付通知能力不得阻断只读工作台。`BASE-05` 后续另行获批时才可增强为“安全失效通知 → 按分区/版本去重 → 调用同一授权 GET”；通知不得携带客户名称、对象详情、消息正文、计数或业务状态，也不得直接覆盖页面事实。通知 transport 由总协调台统一选择，工作台不得另建实时通道；该增强的断连或重复通知不改变首期手动/操作后刷新能力。

### 5.4 WB-03 状态与局部刷新验收

| 场景 | RSC/API 行为 | UI 行为 |
|---|---|---|
| 首次 loading | RSC 尚未完成时只输出页面骨架；不先填 `0` | 卡片、队列、旅程和摘要使用对应 skeleton。 |
| 局部 refreshing | 只请求所选 `section`，保留其他已验证分区 | 刷新区显示忙碌状态，禁止重复请求，不清空其他区。 |
| 权威空 | provider 成功并返回 `empty` | 卡片/旅程可显示 `0`；行动区显示业务空。 |
| 筛选空 | source 非空，但授权后的当前类型筛选无行 | 显示“当前筛选无结果”，不改写 source readiness 或卡片数字。 |
| 部分失败 | 至少一个分区成功、至少一个失败 | 成功区域保留；失败分区局部 `--`/提示，不能升级为整页失败。 |
| 全部失败 | 四项权威读取均失败/`unavailable`/非法且没有安全快照，或首读服务整体失败 | 显示整页可重试状态，不回退旧 dashboard、静态数或 `nextAction`；四项 `empty` 不是失败。 |
| 全部 denied / 越权 | 服务端统一无权限结果，不含业务 payload | 进入无权限状态，不显示可重试业务页，不泄露某来源是否存在数据。 |
| capability disabled / 未发布 | 总协调台导航门禁不展示工作台；直接访问返回统一未发布状态 | 不显示空壳、假卡或故障重试。 |
| stale | 读到受控 stale 快照 | 卡片/旅程/摘要可显示“截至某时”；Care/Conversation stale 行全部剔除，快捷创建不可启用。 |
| 会话过期 | 只有 Conversation freshness 过期 | 移除会话行和筛选并显示局部过期；Care、旅程和能力不受影响。 |
| 登录会话过期 | 传输层返回受控 `401` | 清除页面业务 display model，进入统一登录态过期页；不能把它映射为 `empty`。 |
| 刷新 revision 冲突（总控冻结后） | 受影响局部读取由工作台 API 返回受控 `409`/conflict | 保留其他分区，丢弃受影响旧行动并重新读取；不做乐观合并，也不改公共 readiness/failure code。 |
| 越权或 `failureCode: 'scope_mismatch'` | 服务端返回受控 `403`/`denied` 或 `scope_mismatch`，不含业务 payload | 不显示计数、名称、行或链接；目标页仍独立重验并记录低敏拒绝审计。 |
| `BASE-05` 通知增强（获批后） | 按分区/版本去重；断连不接收事件业务 payload | 重复通知只读一次；断连时仍保留首期手动/操作后授权 GET。 |

首期测试必须分别覆盖桌面前 6、移动前 4、ready+stale、ready+unavailable、ready+disabled 组合、上述首期场景、机构时区跨日/变更、手动/操作后局部刷新和重试恢复；通知去重/断连仅在 `BASE-05` 增强获批后追加。不得用客户自由文本 `nextAction` 生成空态、摘要、行动或刷新建议。

---

## 6. 后续小 PR 拆分

所有以下 PR 都是后续 runtime 任务，需在共享底座合并后重新从干净 `origin/main` 建立短分支，并获得逐项授权。它们默认能力关闭，不创建 schema/migration，不接外部网络或真实发送。

### WB-01：外部契约消费者边界与只读领域聚合（capability off）

**前置：** 总协调台已合并 `CareActionSourceV1`、`ConversationActionSourceV1`、`CustomerLifecycleSummaryV1`、`CapabilityStatusV1`、`CustomerReferenceV1` 及 `InstitutionSourceEnvelopeV1<T, K>` 公共声明；`BASE-02` 已允许工作台按服务端 scope 消费。各 provider 可尚未实现，测试仅用符合公共类型的本地 fixture 注入；不以前置实时通知 transport 为条件。

**计划文件：**

- 新建：`src/modules/institution-workbench/domain/workbench-action-aggregation.ts`
- 新建：`src/modules/institution-workbench/domain/workbench-action-view-models.ts`
- 新建：`src/modules/institution-workbench/tests/WorkbenchActionAggregation.test.ts`
- 新建：`src/modules/institution-workbench/tests/WorkbenchActionContractBoundary.test.ts`

**实现步骤：**

- [ ] 只 import 总协调台拥有的四项 `v1` 公共契约；不得在工作台目录重声明 envelope、failure code、Customer 引用或来源 DTO。
- [ ] 行动聚合函数只接收 Care/Conversation；旅程与能力映射分别消费 Customer/Capability，禁止进入行动队列。
- [ ] 定义 scope/版本验证、固定卡 view model、稳定行 key、受控生命周期/快捷创建链接、行动去重/排序/截断和低敏字段白名单。
- [ ] 用注入式 fixture 验证四卡、四角色范围、来源隔离、未知/stale/disabled、非法 payload、生产会话守卫，以及没有跨模块 repository/table import。
- [ ] 不新增 route、API、页面、provider、feature 开关、数据库访问或旧模块 import；能力保持关闭。

**验收：** 消费端兼容测试覆盖四项外部契约；代码结构能证明行动聚合只接受 Care/Conversation，客户旅程和 capability 不能生成行动，且本线没有公共声明所有权。

### WB-02：接入 Care source（capability off）

**前置：** Care 线已交付并验证 `CareActionSourceV1` provider；四分区、`cards + actions`、机构时区、精确 RBAC、真实 HIS 能力状态、详情路由和分区级状态均可用；`BASE-02` 已验证机构范围。

**计划文件：**

- 新建：`src/modules/institution-workbench/server/care-action-source-reader.ts`
- 新建：`src/modules/institution-workbench/server/institution-workbench-snapshot-service.ts`
- 新建：`src/modules/institution-workbench/tests/CareActionSourceIntegration.test.ts`

**实现步骤：**

- [ ] 通过公共服务端 reader 读取 Care snapshot，验证完整 `InstitutionSourceEnvelopeV1<T, K>`、RBAC、四分区和精确 `CareActionItemV1` 字段，不读取 Care repository、旧 API 或数据库。
- [ ] 将单分区失败映射为局部 `--` 与行动剔除；stale 安全卡片只显示截止时间快照，不输出 stale 行。
- [ ] 无真实 HIS 时确认两个预约分区为 `disabled`，不生成预约卡、`0`、行动或快捷创建；不得用本地预约 fixture 补生产事实。
- [ ] 验证卡片、行动与目标列表采用第 4.1 节同一服务端范围。
- [ ] 只开放受控的服务端 snapshot 调用点；根 `/hospital` 接入仍等待总协调台，不修改公共 route。

**验收：** 可用卡片数字与 Care 正式筛选一致；任一分区失败不清空其他分区或来源；HIS 缺失时预约不伪装可用；能力仍关闭。

### WB-03：RSC 首读、正式局部刷新与完整工作台展示（capability off）

**前置：** `WB-02` 已合并；`BASE-01A` 已提供 capability-off 的 `/hospital` 壳、桌面/移动壳和统一页面状态插槽；总协调台已完成 `IR-WB-01` 的唯一刷新 revision 决策。四个 reader slot 已冻结。未交付生产 provider 的 production slot 只能由总协调台/来源所有者返回无业务 payload 的 `disabled`，工作台不得自行合成；契约 fixture 只存在于测试，不能进入 runtime 或冒充生产可用。`IR-WB-07` 通知 transport 不是首期硬前置。

**计划文件：**

- 修改：`src/modules/institution-workbench/server/institution-workbench-snapshot-service.ts`
- 新建：`src/app/api/institution/workbench/route.ts`
- 新建：`src/modules/institution-workbench/components/InstitutionWorkbenchShell.tsx`
- 新建：`src/modules/institution-workbench/components/WorkbenchActionQueue.tsx`
- 新建：`src/modules/institution-workbench/tests/InstitutionWorkbenchShell.test.tsx`

**实现步骤：**

- [ ] RSC 首读与局部 API 调用同一 snapshot service；服务端并发读取四个公共 reader slot，行动聚合仍只接收 Care/Conversation；未交付 slot 保持权威 `disabled`。
- [ ] 实现 `section=care|conversation|lifecycle|capabilities` allowlist、当前 session scope 绑定、低敏 display model 和局部响应；不接受客户端 scope，不新增 Server Action。
- [ ] 渲染第 5.1 节完整页面：Care 卡桌面最多 3 列/移动两列、桌面 6/移动 4 行、前四类旅程条、单一受控“新建”菜单和局部业务摘要。
- [ ] 使用第 3.3、3.5、3.6、3.7 节 allowlist 构造链接；卡片/行/旅程/快捷创建只导航，目标页重新授权与读取当前对象。
- [ ] 按统一 `InstitutionPageState` 和第 5.4 节处理 loading、局部刷新、权威空、筛选空、partial、全部失败、stale、会话过期、session 过期、冲突与越权。
- [ ] 按分区失效；总控冻结的刷新 revision 冲突由工作台 API 返回 `409`，丢弃受影响旧行动并重读，不清空其他分区，不调用外部系统。

**验收：** 桌面卡最多 3 列/移动两列、桌面 6/移动 4、完整页面区域、安全链接、同范围 RBAC、部分/全部失败和所有局部刷新状态都有组件/API 测试；无客户 `nextAction`、无生产者 repository/table import；根壳实际挂载仍由总协调台独立 PR 完成。

### WB-04：接入生产会话行动项（capability off）

**前置：** 会话线已交付持久化的 `ConversationActionSourceV1`，仅含 `waiting_human`、`unresolved_risk` 真实生产分段，具备精确机构/角色过滤、来源版本、canonical 详情路由、低敏字段和失败状态；模拟会话彻底不在 provider 输出内。

**计划文件：**

- 修改：`src/modules/institution-workbench/server/institution-workbench-snapshot-service.ts`
- 修改：`src/modules/institution-workbench/components/WorkbenchActionQueue.tsx`
- 新建：`src/modules/institution-workbench/tests/ConversationActionSourceIntegration.test.ts`

**实现步骤：**

- [ ] 接入会话 source，严格拒绝非真实生产分段、非法分区、缺 `conversationId`/`segmentId`、`production !== true` 或 subject 非法的项，并保持 Care 成功数据在会话失败/过期时可见。
- [ ] 咨询师/客服只接收本人已分配的活动分段；未分配待人工只允许当前机构且有权限的管理员/运营。
- [ ] 精确保留 `ConversationActionItemV1` 字段和 `lastCustomerMessageAt`；未匹配 subject 固定显示“待匹配联系人”，消费端字段白名单拒绝旧字段名、渠道昵称、外部账号、消息正文及最近消息片段。
- [ ] source 为 `ready`/`empty` 且当前角色有 Conversation 模块权限时可展示会话筛选；`stale`/`unavailable`/`denied`/`disabled`/`failureCode: 'scope_mismatch'` 或无模块权限时隐藏，不增加会话卡或模拟占位。

**验收：** mock/dry-run/未持久化会话永不出现；两分区、精确分配范围、会话过期、固定未匹配文案和敏感字段拒绝均通过；会话失败不影响其他来源。

### WB-05：角色范围、跨来源验收与发布申请

**前置：** `BASE-01`--`BASE-05`、Care、Conversation、Customer lifecycle、Capability、目标路由、机构权限和机构审计均已在同一主线基线完成；这不是自动发布任务。Customer 线已交付 `CustomerLifecycleSummaryV1` provider，总协调台及能力所有者已交付 `CapabilityStatusV1` provider。

**计划步骤：**

- [ ] 只经 WB-03 的公共 reader 接入 lifecycle/capability，不读取 Customer repository、客户自由文本、权限表或连接配置；验证前四类旅程、三个快捷创建 URL、低敏摘要和辅助输入不进入行动。
- [ ] 在 `.env*` 排除的隔离镜像中验证四角色、跨机构、本人任务/角色池/HIS 客户负责人、会话分配、刷新、深链接、卡片/列表一致性及局部失效。
- [ ] 覆盖部分来源、全部失败、权威空、筛选空、stale、未知值、会话过期、session 过期、冲突、越权和 provider 恢复；任何失败不得回退客户 `nextAction` 或 mock。
- [ ] 由总协调台审查代码成熟度、机构授权、连接可用、数据新鲜度和生产放行五个维度；任一不满足则保持隐藏/关闭。
- [ ] 只有真实 Care/生产会话、客户旅程、快捷创建、局部摘要及目标重验均可解释、可审计后，提交单独发布申请；没有真实 HIS 时正式工作台导航不得放行，不把代码合并等同发布。

**验收：** 与总计划 `WB-05` 一致完成角色数据范围、部分来源、过期、未知值、空数据和跨机构验收；`silent_reactivation`、`nextAction`、Customer repository 和未批准外部能力不进入工作台。

---

## 7. 消费者测试计划与验收矩阵

### 7.1 公共契约消费者验收

**四项契约共同边界：**

- [ ] `InstitutionSourceEnvelopeV1<T, K>` 的字段、顶层/分区 readiness、`observedAt`/`freshUntil`、七个受控 failure code、`data` 和 `failureCode` 精确匹配第 3.2 节；reader/`AccessContext` 不出现在响应。
- [ ] 只有顶层可 `partial`；顶层 `denied`/`disabled` 或 `failureCode: 'scope_mismatch'` 必须 `data: null`，分区 `denied`/`disabled` 不贡献业务片段。
- [ ] 总控冻结唯一刷新 revision 方案后，revision 缺失或回退时拒绝局部合并，并覆盖工作台 API 的受控 `409` conflict；不得以任一行动行 `sourceVersion` 代替。
- [ ] 只有权威查询成功且确实为空才显示 `0`；未知/失败且无安全快照显示 `--`。stale 安全卡片/旅程快照必须显示验证截止时间，stale Care/Conversation 行始终不入队。
- [ ] 顶层 `partial` 的 ready+stale、ready+unavailable、ready+disabled 组合按各分区 readiness 独立映射，不能把 stale 快照误改为 `--` 或让 disabled 返回业务数据。
- [ ] 架构测试证明工作台只 import 总协调台公共声明和 provider reader，不 import Customer/Care/Conversation repository、table、内部 DTO，也不在本模块声明竞争契约。

**`CareActionSourceV1` 消费验收：**

- [ ] 分区集合精确等于 `pending_confirmation_appointments`、`reschedule_requested_appointments`、`overdue_followups`、`today_due_followups`，正常 payload 为四卡与 actions，未知分区拒绝。
- [ ] `CareActionItemV1` 字段集合精确为 `entityType`、`objectId`、`sourceVersion`、嵌套 `CustomerReferenceV1`、`businessState`、`cardKeys`、`sortSignals`、`appointmentAt`、`dueAt`、`slaAt`、`riskLevel`、`priority`、`owner`、`safeSummary`、`detailHref`，旧别名与额外字段被拒绝。
- [ ] 预约/随访的 `businessState` 分别限于第 3.3 节枚举；`overdue`/`today_due` 只作为卡片/排序派生，统一五种 `sortSignals`、空时间与 nullable 字段均有边界测试。
- [ ] 四张可用卡的 key、中文名称、计数口径和筛选 href 完全匹配第 3.3 节；卡片、队列和目标列表在四角色下使用相同服务端范围。
- [ ] 无真实 HIS 时两个预约分区精确为 `disabled`，响应不含预约卡片、`0`、行动或链接，UI 不合成占位卡。

**`ConversationActionSourceV1` 消费验收：**

- [ ] `ConversationActionItemV1` 精确保留 `conversationId`、`segmentId`、`sourceVersion`、`production: true`、`subject`、`conversationState`、`riskState`、`partitions`、统一 `sortSignals`、`lastCustomerMessageAt`、`slaAt`、`priority`、`assignee`、`safeSummary`、`detailHref`；旧字段名与缺字段均拒绝。
- [ ] 分区集合精确等于 `waiting_human`、`unresolved_risk`；只有持久化真实生产分段进入，fixture/mock/dry-run/缺 `conversationId`/`segmentId` 或 `production !== true` 均拒绝。
- [ ] `subject` 只接受 customer `CustomerReferenceV1` 或 unmatched_contact“待匹配联系人”；渠道昵称、外部账号、手机号、消息正文/片段和 provider payload 即使出现也不得进入 display model。
- [ ] 咨询师/客服只收到本人已分配活动分段；未分配待人工只给当前机构且有权限的管理员/运营；会话详情只使用 `/hospital/conversations/:id`。

**`CustomerLifecycleSummaryV1` 消费验收：**

- [ ] provider 五类 key 全部可解析，但工作台只显示 `consulting`、`scheduled`、`post_care`、`repurchase_window`；`silent_reactivation` 不显示且永不进入行动。
- [ ] 四个客户列表 URL 只从受控 lifecycle key 构造；任意 href、Customer repository 数据与客户 `nextAction` 均被拒绝。

**`CapabilityStatusV1` 消费验收：**

- [ ] 五维服务端结论正确映射为隐藏/只读/可操作；仅获准角色的 `operational` 状态启用三个固定快捷创建 URL。
- [ ] 低敏业务标签/摘要长度、公共 display order 与诊断目标 key allowlist 逐一验证；任意 URL、未知 capability key、adapter、连接地址、凭证或技术错误被拒绝。
- [ ] stale/denied/disabled/`failureCode: 'scope_mismatch'` 不启用动作；局部摘要永不进入行动队列，三个创建项按权限逐项隐藏且全部隐藏时不渲染空“新建”菜单。

**行动聚合验收：**

- [ ] 稳定 key 精确使用 `appointment:${objectId}`、`followup:${objectId}`、`conversation:${conversationId}` 模板；同对象多信号只保留一行，不同实体的同字符串 ID 不互相去重。
- [ ] 五个统一受控 `sortSignals`、`appointmentAt`/`dueAt`/`lastCustomerMessageAt`/`slaAt` 和完整稳定 key 的次序全部覆盖；测试证明修改 `safeSummary` 不改变排序，移动 4 条等于桌面 6 条前缀。

### 7.2 WB-02--WB-05 集成、API 与组件测试

- [ ] RSC 首读与 API 局部刷新调用同一 snapshot service；API 只接受四个 `section` 值，不接受客户端 scope，不存在读取/写入 Server Action。
- [ ] 首次 loading、局部 refreshing、权威空、筛选空、Care 分区部分失败、跨来源部分失败、四项全部失败分别具有独立断言，且不会用“暂无待办”覆盖错误。
- [ ] stale Care/旅程显示安全快照和截止时间但无 stale 行；没有安全快照显示 `--`；Conversation 单独过期只移除会话行/筛选，不清空 Care、旅程或能力。
- [ ] session 过期 `401` 清除业务 display model；越权/跨机构 `403` 不泄露计数、行、名称或链接；总控冻结后的刷新 revision 冲突 `409` 只丢弃并重读受影响分区。
- [ ] 刷新 Care、Conversation、lifecycle、capabilities 分别只替换对应区域；一个 source 超时或重试不会覆盖其他已验证 source。
- [ ] 首期手动刷新和业务操作返回后的局部刷新只调用对应授权 GET；机构时区变更和跨日只失效 Care 时间分区。安全通知触发 GET、去重与断连恢复仅在 `BASE-05` 增强获批后追加验收。
- [ ] Care 卡片计数和目标页结构化筛选结果一致；咨询师/客服的本人任务、本人角色池未认领任务、本人为 HIS 客户负责人的预约，以及管理员/运营模块权限均有正反用例。
- [ ] Conversation 本人已分配活动分段与管理员/运营未分配待人工范围有正反用例；转派、认领、撤权后旧行移除，目标页再次拒绝旧授权。
- [ ] 队列筛选在截断前执行；桌面卡最多 3 列、移动两列且卡后立即是队列；桌面最多 6 行、移动最多 4 行且为同一前缀；Conversation `stale`/`unavailable`/`denied`/`disabled`/`failureCode: 'scope_mismatch'` 或无模块权限时会话筛选隐藏，`empty` 不等于无权限。
- [ ] 三种详情路径、四个 lifecycle URL、三个快捷创建 URL 逐一 allowlist；非 canonical、非法 query、跨模块和含敏感参数的链接均不渲染。
- [ ] 无真实 HIS 时两张预约卡、预约行动、预约快捷创建和正式工作台导航均未放行；不得显示假 `0`、假卡或静态行动。
- [ ] 页面保留客户旅程条、受控快捷创建和局部业务摘要；`silent_reactivation`、客户 `nextAction`、消息正文和就地写操作均不存在。
- [ ] 低敏拒绝审计不记录客户引用明文、原始会话、failure 内部详情、请求体、凭证或 provider payload。

### 7.3 建议验证命令

后续获准 runtime 时，先在无敏感环境的隔离副本中执行目标测试，再按风险逐步扩大：

```bash
node scripts/run-vitest.mjs run src/modules/institution-workbench/tests/WorkbenchActionAggregation.test.ts
node scripts/run-vitest.mjs run src/modules/institution-workbench/tests/WorkbenchActionContractBoundary.test.ts
node scripts/run-vitest.mjs run src/modules/institution-workbench/tests
pnpm typecheck
git diff --check
```

接入根壳、目标路由或跨线 provider 后，额外运行 Care、Conversation、security、audit 的已批准测试集合。涉及真实数据、机构权限或发布门禁时，必须由总协调台指定 `.env*` 排除的镜像验收命令；不得复制 `.env.local` 或执行真实外部调用。

---

## 8. Integration requests（仅记录，不在本线实现）

| 编号 | 所有者 | 请求内容 | 工作台阻塞点 |
|---|---|---|---|
| `IR-WB-01` | 总协调台 | 在 `src/modules/institution-contracts/v1/**` 声明四项公共契约、`CustomerReferenceV1` 和第 3.2 节精确 `InstitutionSourceEnvelopeV1<T, K>`；reader 仅为服务端输入。另唯一决定刷新 revision 位于既有公共契约还是工作台 API，`409` 仅归工作台 API 传输语义。 | `WB-01` 不能自行定义 envelope/freshness/failure code，WB-03 不能自行选择 revision 形态。 |
| `IR-WB-02` | Care 线 + `BASE-02` | 实现四固定分区的 `cards + actions` provider、机构时区 bucket/跨日 freshness、第 4.1 节精确 RBAC、`sourceVersion`、低敏字段与同范围目标列表；无真实 HIS 时两预约分区返回 `disabled` 且无业务 payload。 | 当前普通预约/随访列表为 tenant 范围，不能直接消费。 |
| `IR-WB-03` | Conversation 线 + `BASE-02` | 实现 `waiting_human`/`unresolved_risk` 持久化生产 provider、第 4.1 节分配范围、低敏 action 和 `/hospital/conversations/:id` 详情；模拟/干跑数据与消息正文绝不输出。 | `WB-04` 之前不得显示会话行动。 |
| `IR-WB-04` | Customer 线 + `BASE-02` | 实现五类 `CustomerLifecycleSummaryV1` provider，并保证 `/hospital/customers?lifecycle=...` 列表使用同一服务端范围。 | `WB-05` 不得读取 Customer repository 或自行分段。 |
| `IR-WB-05` | 总协调台 + 能力所有者 | 实现 `CapabilityStatusV1` provider，统一代码成熟度、机构授权、连接可用、数据 freshness、生产放行五维判断和三个创建动作权限。 | 工作台不能从配置、凭证或连接错误推断 capability。 |
| `IR-WB-06` | 总协调台（`BASE-01A`/`BASE-05`） | 建立真实 `/hospital` RSC 路由壳、移动壳、统一 `InstitutionPageState` 插槽并审查 WB-03 API 挂载；保持 `InstitutionWorkspace` 冻结直到获准迁移 PR。 | 工作台组件无法自行替换当前 `activeView` 页面。 |
| `IR-WB-07` | 总协调台 + 各生产者 | `BASE-05` 获批后的增强：提供按 scope/version/分区隔离的已授权页面失效通知；通知只含分区 key/不透明版本，支持去重、断连恢复并触发授权 GET。 | 非首期阻塞；工作台不得跨模块监听 mutation/repository、另建实时通道或用事件 payload 覆盖事实。 |
| `IR-WB-08` | `BASE-04` / 审计所有者 | 提供机构级 `dashboard/read`、拒绝与局部刷新审计策略及可靠 `institutionId` 归属，不记录业务 payload、消息原文或凭证。 | 工作台不能自行改 AuditEvent 或 schema。 |
| `IR-WB-09` | Care、Conversation、Customer 路由所有者 | 确保卡片、队列、旅程条点击后的列表/详情使用与工作台相同的服务端范围并再次授权；截断外对象只进入正式列表。 | 不新增工作台“全部待办”伪业务页，也不允许聚合与目标页范围漂移。 |

任何 integration request 未满足时，受影响能力保持隐藏或 capability-off；不得以旧 API、mock、静态 `0`、客户自由文本或跨线直接查询绕过。

---

## 9. 发布门禁、迁移/外部队列、风险与回滚

### 9.1 migration 边界

工作台线不拥有 schema/migration，也不得在页面、reader、API 或组件 PR 中夹带数据结构变更。全项目唯一迁移顺序固定为：

```text
MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06
```

若后续 provider 发现共享持久化缺口，只能向总协调台提交 integration request，由总协调台决定是否纳入上述既有串行顺序；工作台不得创建 `WB-MIG-*`、并行 migration 编号或把 schema 改动塞进任何 `WB-*` PR。

### 9.2 唯一外部集成串行队列

HIS、ERP/POS、受控导入、渠道/AIBOTK、OCR/embedding/rerank/知识 AI、经营报告 provider 全部进入总协调台唯一外部集成串行队列。工作台 PR 只能提出业务契约、消费已批准且已落为项目内权威事实的 provider/adapter 输出并验收；不得访问凭证、直接调用外部系统、触发实时同步或另建 adapter 队列。真实 HIS 预约能力未获批准并交付前，两预约分区保持 `disabled`。

### 9.3 发布门禁

工作台申请正式发布前必须同时满足：

- 四张 Care 固定卡均来自真实、持久化、机构隔离、角色过滤且可解释的数据；两张预约卡必须有真实 HIS 事实，卡片计数与同范围目标筛选一致。
- Care 和有权限的生产会话 source 都完成稳定聚合；单一对象不重复计数或重复排队。
- 客户旅程条只显示前四类并与同范围客户列表一致；快捷创建和局部业务摘要来自可解释的 `CapabilityStatusV1`，不使用客户 `nextAction`。
- 单一来源失败、局部过期、未知值和无权限均局部 fail-closed，不清空其他成功来源，也不显示假零值。
- 所有行仅跳转详情；目标页重新执行权限与机构验证。工作台没有表单、状态流转、发送或外部调用。
- 会话只来自生产持久化 source；任何 mock、dry-run、fixture、模拟发送或原始消息均不出现。
- 机构级权限、审计、深链接、移动/桌面响应式和 `.env*` 排除的隔离验收均有证据。

没有真实 HIS 预约事实、生产会话 provider、客户旅程 provider、能力状态或目标页同范围重验中的任一项时，受影响 source 保持 `disabled`/隐藏，且正式工作台导航不通过完整 capability 门禁；局部代码可用不等于产品可发布。

### 9.4 真实阻塞与回滚

当前仍需总协调台或共享线交付的真实阻塞为：

1. 总协调台尚未落地四项公共 `v1` 声明、受控 failure code 和版本兼容；工作台不能自行补声明。`BASE-05` 通知增强不是首期阻塞。
2. Care 尚缺机构级精确 RBAC source 与真实 HIS 预约事实，Conversation 尚缺持久化生产分段，Customer lifecycle 与 Capability provider 亦未交付。
3. `/hospital` RSC 路由壳、四角色 BASE scope、机构级审计和目标列表/详情同范围重验尚需共享线完成。
4. 若真实 HIS 或其他外部能力是上线前置，必须由总协调台在唯一外部集成队列中批准；工作台线无权选择 adapter 或并行推进。

主要风险是当前根壳为单页 `activeView`、预约/随访普通读路径仍按 tenant 范围、会话只是模拟、审计尚未以机构为一级范围。缓解措施是先完成共享 integration request、能力默认关闭、仅消费版本化 source、逐来源失效和最后发布。

若任一来源、权限、数据新鲜度、审计或目标详情验证回归失败，回滚策略为由总协调台将工作台 capability 调回 `hidden` 或 `read_only`，停止该 source 的展示，不回滚到旧客户自由文本行动队列，也不影响 Care/Conversation 自身页面。
