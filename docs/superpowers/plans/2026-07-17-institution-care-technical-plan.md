# 机构端“预约与随访”技术计划

> **给后续执行 Agent 的要求：** 本计划已按 `PLAN-CARE-REV-03` 完成第三轮定点契约返修，只把“预约与随访”拆成可独立授权、可审查的小切片。它不是 runtime 授权：任何源码、API、schema、migration、测试、配置、脚本、真实消息、真实 HIS、外部网络、提交、推送、PR 或合并，都必须在对应切片中另获用户明确批准。

**目标：** 先建立不依赖真实消息或 HIS 的人工随访闭环：任务列表与详情、创建、具体员工或固定角色池分配、认领、合法流转、结构化结果与风险升级；再以版本化契约接入治疗来源、会话结果、客户时间线、工作台和路径。预约请求后置为 Care 独立切片，HIS adapter 只由总协调台的 `INT-HIS-01` 外部集成任务交付。

**架构方案：** Care 是随访任务、路径运行实例、任务结果和风险升级的规范业务所有者；客户中心拥有治疗事实，客户中心拥有客户时间线的最终聚合，会话工作台拥有会话和回复处置。各模块只通过版本化契约交换低敏引用、受控枚举、版本与失效信号，不能直接读取对方 repository 或内部表。所有写入经服务端 `tenantId + institutionId`、角色、对象归属、并发版本、审计与结构化输入校验；页面只做局部失效和重新读取，不以事件 payload 覆盖业务事实。

**技术栈：** Next.js、React、TypeScript、Vitest、Testing Library、Drizzle、PostgreSQL。

---

## 一、文档状态与任务边界

- 日期和时区：`2026-07-17 CST`
- 当前阶段：机构端七线第三轮定点 docs-only 契约返修，任务编号 `PLAN-CARE-REV-03`
- Worktree：`/Users/dongxiaolong/.codex/worktrees/7966/zmtg-clean`
- 当前分支：`HEAD`（detached，不创建分支）
- 当前 `HEAD`：`e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa`
- 当前本地 `origin/main`：`e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa`
- 第三轮启动时 `git status --short` 仅显示本文档为未跟踪文件；没有其他改动
- 规划依据：
  - `docs/superpowers/plans/2026-07-17-institution-seven-stream-development-plan.md`
  - `docs/superpowers/specs/2026-07-15-institution-navigation-page-system-design.md`

本轮允许路径只有：

```text
docs/superpowers/plans/2026-07-17-institution-care-technical-plan.md
```

本轮不是：不修改 `src/**`、`drizzle/**`、schema、migration、API、测试、配置、脚本或其他文档；不读取凭证或数据库；不调用真实消息、HIS 或任何外部网络；不提交、推送、创建 PR、合并或继续 runtime。本文涉及的字段只形成数据变更申请，不能据此直接创建表、列、索引或迁移。

---

## 二、只读基线盘点与结论

| 范围 | 当前可复用事实 | 缺口与本线处理 |
| --- | --- | --- |
| 预约 | 已有 `appointments` 及 `/api/institution/appointments`，状态为 `pending_confirmation`、`confirmed`、`arrived`、`completed`、`reschedule_requested`、`cancelled`。 | 现有模型是 tenant 级本地记录，不能证明为 HIS 预约事实，也没有待提交请求、HIS 时段、原子占位、爽约、变更历史或通知事实。`CARE-01` 至 `CARE-03` 完全不读取、不改写、不发布预约；预约/HIS 只在 `CARE-04` 起单独设计。 |
| 随访任务 | `followUpTasks`、`followup-workflow.ts` 与 `/api/institution/followups` 已支持手工创建和有限状态转换；现有状态含 `scheduled`、`due`、`in_progress`、`escalated`、`completed`、`cancelled`。 | 未区分持久化工作流与按时区派生的到期桶；没有具体员工/角色池、认领、结构化完成结果、会话处置、路径暂停或完整机构隔离。新规范不在旧模型上叠加临时字段。 |
| 路径 | 已有静态治疗路径模板、路径入组、阶段、同源建议键和“仅人工、不自动触达”边界。 | 模板不是不可变发布版本；入组没有以正式 `TreatmentCareSourceV1` 为输入，也没有会话暂停/60 分钟恢复、作废精确影响或新任务分配语义。`CARE-03` 只消费总协调台已批准并交付的 `MIG-02` 路径持久化基础，旧数据仅作迁移核对输入。 |
| 治疗来源 | 治疗摘要可生成低敏随访建议，单条建议已有来源摘要 ID 与建议键；治疗作废已有基础语义。 | 来源仍是 Care 直接依赖旧 repository 的实现细节，不是公共契约；没有来源版本、机构证明、作废影响范围或可复核的路径选择。总协调台维护 `TreatmentCareSourceV1` 声明，客户中心只在自身模块提供 provider。 |
| 会话回流 | 现有 `AiConversationWorkbench` 是明确的模拟版，含 `mock_sent`、演示状态和固定时间。 | 不能作为生产会话来源或随访完成依据。总协调台维护 `ConversationCareDispositionV1` 声明；会话线完成真实持久化与隔离后才提供 provider，Care 在此前不显示“会话回复成功”。 |
| 权限 | 当前 `AccessContext` 带 `tenantId` 与可选 `institutionId`；已有机构管理员、运营、咨询师、客服角色及 tenant 级 `follow_up` 策略。 | 现有 API 主要按 `tenantId` 查询，既缺任务分配范围，也不满足四角色的机构级数据范围。必须等待 `BASE-02` 的统一机构 guard 与成员/固定角色来源；不能从前端可见性或客户端 `institutionId` 推导授权。 |
| 审计 | 现有写入可在事务中记录 tenant 审计，并已有非法流转、来源冲突等原因码。 | 审计事件尚不能单独证明 Care 的机构归属、分配/认领/结果/强制处理及来源版本。依赖 `BASE-04` 后再扩展白名单 action、reason 和低敏元数据；高风险写入审计失败即回滚。 |
| 客户时间线 | 当前客户时间线会聚合预约、随访、治疗和低敏随访事件。 | 最终聚合所有权已分配给客户中心，Care 只能提供 `CustomerTimelineContributionV1`。不得继续把 Care 内部 DTO 直接塞入客户时间线。 |

### 2.1 冻结边界

以下现有集中式文件已被总计划冻结，Care 不得并行修改或重构：

```text
src/modules/institution/client/tenant-business-client.ts
src/modules/institution/domain/tenant-business-view-models.ts
src/modules/institution/server/tenant-business-api.ts
src/modules/institution/server/tenant-business-audit-transaction.ts
src/modules/institution/server/tenant-business-repository.ts
src/modules/institution/server/tenant-business-write-input.ts
src/modules/workspace/components/InstitutionWorkspace.tsx
src/server/db/schema.ts
drizzle/**
```

后续 Care 实现只能在获批后新增其独占目录；对既有 `/api/institution/followups` 的接管需由总协调台发起明确的过渡 integration request，不能两个实现同时写同一业务事实。

---

## 三、前置条件、所有权与非目标

### 3.1 任何 runtime 切片的前置条件

1. `BASE-01` / `BASE-01A` 已定义 `/hospital/care` 的 capability-off 路由壳；未发布时深链接返回统一未发布或无权限状态，不显示空壳。
2. `BASE-02` 已提供服务器端 `tenantId + institutionId` guard、四角色上下文和成员目录；没有可靠机构 ID、成员身份或角色池成员资格时 fail-closed。
3. `BASE-04` 与 `BASE-05` 已提供机构级审计和通用局部失效/错误状态契约。
4. 创建或持久化任务前，`MIG-02` 的数据变更申请已获批、实施并在隔离数据库中验证；否则只允许纯领域契约和无数据库测试，不得将内存数据包装成正式能力。
5. 总协调台先交付 `CustomerReferenceV1` 公共声明，客户中心提供正式 provider。会话来源任务还须满足“会话已由当前人员分配且客户已确认匹配”的来源限定条件。

### 3.2 领域所有权与公共声明所有权

所有跨线公共契约的声明、版本和兼容规则都由总协调台独占，计划落点为 `src/modules/institution-contracts/v1/**`。栏目线只能记录冻结字段、在自身模块实现 provider、通过服务端 reader 消费，不能另建同名或近义公共声明。

| 领域或公共契约 | 公共声明所有者 | 生产者/provider | Care 的职责与禁止 |
| --- | --- | --- | --- |
| 随访任务、分配、认领、状态、结果、风险升级 | 不属于公共声明 | Care | 持有规范业务事实；不以客户 `nextAction`、消息正文或 mock 生成任务。 |
| 路径运行实例、暂停/恢复、路径任务 | 不属于公共声明 | Care | 消费已验证来源并维护幂等和运行状态；不实现自由图、scheduler 或真实发送。 |
| `CustomerReferenceV1` | 总协调台 | 客户中心 | 只通过服务端 reader 消费；不按显示名匹配客户。 |
| `TreatmentCareSourceV1` | 总协调台 | 客户中心 | 完全消费冻结声明；不复制定义，不查询治疗 repository/table。 |
| `ConversationCareDispositionV1` | 总协调台 | 会话工作台 | 完全消费当前快照；不复制定义、不读取或重新分类聊天。 |
| `CustomerTimelineContributionV1` | 总协调台 | Care 等各业务线 | Care 只提供低敏 provider；不拥有最终聚合或直接写客户中心内部表。 |
| `CareActionSourceV1` | 总协调台 | Care | Care 实现 provider；工作台通过服务端 reader 消费，双方都不另造声明。 |
| `ReachOutSafetyV1` | 总协调台 | 获准渠道集成任务 | 未来只消费安全判定；不读取渠道内部状态、不发送消息。 |
| `InstitutionOperatingContextV1` | 总协调台 | 机构设置/统一上下文 provider | 消费时区及其版本；管理中心只提供获准控制面，Care 不自行维护第二套机构时区。 |

### 3.3 本计划明确不包含

- `CARE-01` 至 `CARE-03` 不包含预约创建、预约状态、HIS 可用时段、HIS adapter、凭证、外部网络、通知、发送、送达或“发送成功”。
- 不把现有 `mock_sent`、dry-run、fixture、`useState` 或人工外部动作记录表示为渠道接受、客户送达、客户回复或业务完成。
- 不创建 worker、queue、scheduler、cron、WebSocket 或跨模块直接数据库写入；60 分钟恢复资格在安全读取/明确命令时由服务端重新计算。
- 不改变客户负责人、客户生命周期、治疗事实或会话主状态；Care 只保存经过授权的来源引用和自身业务状态。
- HIS、ERP/POS、受控导入、渠道/AIBOTK、OCR/embedding/rerank/知识 AI 和经营报告 provider 全部进入总协调台唯一外部集成串行队列。Care 栏目 PR 只能提出业务契约、消费已批准 adapter 并执行验收，不实现 provider 私有逻辑。

### 3.4 统一跨线读取 envelope

Care 生产或消费的每一次跨线读取都使用总协调台冻结的 `InstitutionSourceEnvelopeV1<T, K>`，不允许某个契约自行简化或增加 freshness 变体：

```text
InstitutionSourceEnvelopeV1<T, K> = {
  contractVersion: 'v1'
  scope: { tenantId, institutionId }
  readiness: ready | empty | partial | stale | unavailable | denied | disabled
  freshness: { observedAt, freshUntil } | null
  partitions: [{
    key: K
    readiness: ready | empty | stale | unavailable | denied | disabled
    freshness: { observedAt, freshUntil } | null
    failureCode: null | upstream_unavailable | timeout | invalid_payload | scope_mismatch | permission_denied | not_released | data_incomplete
  }]
  data: T | null
  failureCode: null | upstream_unavailable | timeout | invalid_payload | scope_mismatch | permission_denied | not_released | data_incomplete
}
```

- provider 位于生产者模块；reader 只作为服务端输入，不进入响应 envelope。消费者只能调用服务端 reader，不能读取生产者 repository/table，也不能接受客户端提交的 scope。
- 只有权威查询成功且确认结果确实为空时，整体或分区才能返回 `empty` 并显示 `0`。未知、失败、未授权、未发布和过期不得折算成 `0`。
- `partial` 只允许出现在顶层；分区 readiness 不得返回 `partial`。顶层 `partial` 只保留已独立验证且对应分区为 `ready`/`empty` 的结果；失败分区显示 `--` 与同一受控 `failureCode`，不能污染成功分区。
- `stale` 可以显示带明确 `freshness.observedAt`/`freshness.freshUntil` 的已验证快照，但不得驱动当前写操作、认领、行动队列或需要当前事实的卡片计数。
- 顶层为 `denied`、`disabled`，或顶层 `failureCode=scope_mismatch` 时必须返回 `data: null`；分区出现同类状态/错误时，`T` 中不含该分区业务数据。`unavailable` 也不返回未经验证的替代事实。

---

## 四、Care 规范模型

### 4.1 任务、来源与分配

正式任务以 `FollowUpTaskV1` 为规范模型。任务必须有客户规范引用、`tenantId`、`institutionId`、当前 revision、计划时间、风险、受控建议动作、来源对象及分配状态；展示名只作为当前低敏投影，不能作为对象匹配键。

来源枚举固定为：`manual`、`treatment_summary`、`path`、`his_completed_appointment`、`conversation`。来源应同时保存对象类型、稳定 ID、来源版本/发生时间和受控理由码；不能存聊天原文、治疗全文、HIS payload、手机号、病历号、外部账号或凭证。每个自动或来源派生任务必须带稳定幂等键；手工任务不与任何来源任务去重。

分配是任务属性而非角色标签：

| 分配形式 | 规范字段 | 可执行者 | 认领与改派 |
| --- | --- | --- | --- |
| 具体员工 | `assigneeKind=user`、`assigneeUserId` | 指定员工；管理员/运营按强制处理权限例外 | 不需要认领；管理员/运营可改派，必须说明受控原因。 |
| 固定角色池 | `assigneeKind=role_pool`、`assigneeRole` | 当前机构、该角色的有效成员 | 仅未认领任务可原子认领；认领后写入具体员工和新 revision。管理员/运营可撤销认领或改派并审计。 |

固定角色池只允许：`tenant_admin`、`tenant_operator`、`consultant`、`customer_service`，不增加技能组。默认建议仅是创建时的预选项：客服处理常规提醒与反馈，咨询师处理项目/预约随访，运营处理异常和未认领兜底，管理员处理配置、审计和强制动作；它不能绕过当前机构成员资格或数据范围。

### 4.2 服务端权限矩阵

四个稳定角色代码只允许：`tenant_admin | tenant_operator | consultant | customer_service`，不得在 Care 内引入别名。管理员和运营也必须同时满足“当前 `institutionId` + 当前 Care 能力权限”，角色本身不等于无限制访问。

| 读取或动作 | `tenant_admin` | `tenant_operator` | `consultant` | `customer_service` |
| --- | --- | --- | --- | --- |
| 随访列表、卡片、行动 | 当前机构且 Care 权限允许的任务 | 当前机构且 Care 权限允许的任务 | 仅本人具体任务及本人角色池未认领任务 | 仅本人具体任务及本人角色池未认领任务 |
| 随访详情 | 在当前机构/Care 权限内重验对象 | 在当前机构/Care 权限内重验对象 | 必须仍为本人任务或本人角色池未认领任务 | 必须仍为本人任务或本人角色池未认领任务 |
| 预约列表、卡片、行动 | 当前机构且 Care 权限允许的预约 | 当前机构且 Care 权限允许的预约 | 仅本人是 HIS 客户负责人的客户预约 | 仅本人是 HIS 客户负责人的客户预约 |
| 预约详情 | 重验当前机构、Care 权限、HIS 事实版本 | 重验当前机构、Care 权限、HIS 事实版本 | 重验本人仍为该客户 HIS 负责人及事实版本 | 重验本人仍为该客户 HIS 负责人及事实版本 |
| 创建普通手工任务 | 是 | 是 | 否 | 否 |
| 从已分配、已匹配会话创建来源限定任务 | 是 | 是 | 是 | 是 |
| 认领本角色池任务 | 是，需成员资格 | 是，需成员资格 | 是 | 是 |
| 普通流转、录入结果 | 本人已分配任务 | 本人已分配任务 | 本人已分配任务 | 本人已分配任务 |
| 改派、撤销认领、强制处理 | 是，理由和审计必填 | 是，理由和审计必填 | 否 | 否 |
| 创建/编辑/发布路径模板 | 是 | 是 | 否 | 否 |

上述矩阵是 `BASE-02` 之后的 Care 能力需求，不得误读为现有 `access-control.ts` 已满足。`CareActionSourceV1` 的四卡、actions、对应目标列表和详情必须调用同一个服务端 RBAC predicate，不能各自统计后再在客户端裁剪。每个详情、认领、创建和写入接口都重新校验服务端 scope、分配/HIS 负责人、客户与来源归属、成员资格和当前 revision；列表曾经可见不代表详情或写入仍获准。范围外对象一律使用“记录不存在或已不可用”，不泄露其存在性。

### 4.3 合法状态机和并发规则

持久化主状态只允许：`pending`（待处理）、`in_progress`（处理中）、`waiting_customer`（等待客户）、`escalated`（已升级）、`completed`（已完成）、`cancelled`（已取消）。`not_due`、`due_today`、`overdue` 均由 `scheduledAt` 与服务端 reader 返回的当前 `ready` `InstitutionOperatingContextV1.data.current.timeZone` 及 `data.version` 在读取时派生，绝不持久化为工作流状态；时区分区不是 `ready`/`empty` 时，不生成当前行动队列或当前到期计数。

```text
pending ───────────────→ in_progress ⇄ waiting_customer ─────→ completed
   │                          │                │
   ├──────────────────────────┼────────────────┼──────────────→ cancelled
   └──────────────────────────┴────────────────┴──────────────→ escalated
                                                                  │
                         类型匹配的受控关闭引用 + 人工复核 ─────┘
```

- 认领只改变处理人和并发版本；首次开始处理才进入 `in_progress`。
- `completed` 与 `cancelled` 为终态。完成只能从 `in_progress` 或 `waiting_customer` 发生，且必须同时提交受控结构化结果；取消必须有受控取消原因。
- `escalated` 不能普通完成。临床风险必须具备最新 revision、同机构、同客户、同风险事件、有效且未撤销的外部临床关闭引用；非临床风险及 `complaint`、`refund_dispute`、`privacy_request`、`opt_out` 必须具备满足同样 revision/scope/风险事件/有效性条件的对应受控治理关闭引用。两类都须经过具备权限的人工复核后才能转回 `in_progress`；非临床引用不得替代临床引用，内部备注、会话结束或强制结束不得替代任何关闭引用。
- 每个写操作带服务端读取的 `revision` 比较条件。认领、改派和状态更新命中 `0` 行时返回明确的认领冲突或 revision 冲突并局部刷新，不能覆盖他人的认领或更新。
- 管理员/运营的强制动作必须保存 `overrideReasonCode`，且与任务更新、任务事件和审计在同一事务中成功；审计失败时整个高风险写入失败。

### 4.4 结构化结果、风险与会话处置

完成结果固定为：`contact_completed`、`no_response_closed`、`his_appointment_linked`、`customer_declined`、`invalid_or_duplicate`。每种结果可带受控原因码和最多 240 字低敏人工摘要；继续随访必须明确创建关联任务，不能用自由文本暗示“后续再联系”。完成结果不是发送、送达、回复或转化指标。

风险与会话分类按以下优先级处理：`risk > substantive_consultation > ambiguous > simple_confirmation`。

| 来源处置 | Care 写入 | 路径影响 | 禁止动作 |
| --- | --- | --- | --- |
| `simple_confirmation` | 仅按第 5.3 节当前 snapshot 守卫，以 `contact_completed` 完成；守卫不满足时转人工复核。 | 不暂停。 | 不根据自由文本或旧 snapshot 推断完成。 |
| `substantive_consultation` 或 `ambiguous` | 当前任务保持/转为 `waiting_customer`，记录受控处置引用。 | 暂停关联路径，按第 5.3 节 60 分钟无新消息守卫恢复。 | 不自动完成、不自动创建预约。 |
| `risk` | 原子转为 `escalated`，写受控风险升级引用。 | 暂停关联路径；临床风险须最新 revision、同机构、同客户、同风险事件、有效且未撤销的外部临床关闭引用，非临床风险及 `complaint`/`refund_dispute`/`privacy_request`/`opt_out` 须满足同样条件的对应受控治理关闭引用，两类均须人工复核。 | 不普通完成；非临床引用不替代临床引用，内部备注或会话结束不替代任何关闭引用。 |

Care 只消费会话工作台提供的当前分类 snapshot，不保存聊天正文或自行重跑分类；具体 `revision`、重复回流、60 分钟和类型化关闭引用守卫以第 5.3 节为准。

---

## 五、跨线版本化契约与局部失效

### 5.1 生产统一 `CareActionSourceV1`

`CareActionSourceV1` 的公共声明由总协调台维护，Care 只在自身模块提供 provider。工作台使用服务端 reader 读取统一 envelope；Care 与工作台都不得声明第二个版本、读取对方内部表或让客户端裁剪权限。

四个固定 partition key 与 card key 使用同一稳定代码：

| partition/card key | 卡片标题 | canonical 目标列表 |
| --- | --- | --- |
| `pending_confirmation_appointments` | 待确认预约 | `/hospital/care/appointments?status=pending_confirmation` |
| `reschedule_requested_appointments` | 改约申请 | `/hospital/care/appointments?status=reschedule_requested` |
| `overdue_followups` | 逾期随访 | `/hospital/care/followups?bucket=overdue` |
| `today_due_followups` | 今日到期随访 | `/hospital/care/followups?bucket=today` |

统一 envelope 的 `data` 只包含“四卡 + actions”，并由四个固定 `partitions` 分别报告 readiness、freshness 与受控 failure code：

```text
cards[]:
  key, count, canonicalHref

actions[]:
  entityType: appointment | followup
  objectId
  sourceVersion
  customer: CustomerReferenceV1
  businessState
  cardKeys[]
  sortSignals
  appointmentAt
  dueAt
  slaAt
  riskLevel
  priority
  owner: 低敏 user/role-pool 引用
  safeSummary
  detailHref: canonical 详情链接
```

- `entityType`、`businessState`、`cardKeys`、`riskLevel`、`priority` 和 `sortSignals` 都使用总协调台冻结的受控枚举/结构；`sortSignals` 只表达未解决风险、是否逾期、SLA/行动时间、优先级和稳定对象 ID，不接受客户端排序权重或自由文本。
- `safeSummary` 必须是长度受控的低敏业务摘要，禁止 PII、聊天正文、治疗内容、HIS payload、外部账号、凭证或内部错误；不可安全生成时返回统一受控占位，不回退原文。
- `entityType=appointment` 的 `detailHref` 只能是 `/hospital/care/appointments/:appointmentId`；`entityType=followup` 的 `detailHref` 只能是 `/hospital/care/followups/:taskId`。URL 不传姓名、摘要、负责人、消息或来源正文。
- 同一对象可带多个受控业务徽标，但在 actions 中只出现一次；四卡、actions 和目标列表均使用第 4.2 节同一个服务端 RBAC predicate。管理员/运营按当前机构及 Care 权限；咨询师/客服的随访仅本人任务与本人角色池未认领任务，预约仅本人是 HIS 客户负责人的客户。
- 每个 action 的 `sourceVersion` 用于重读详情和冲突校验；目标详情必须再次验证服务端 scope、当前分配/HIS 负责人和 revision，不能因为 action 曾返回就放行。
- 卡片只有对应分区权威查询成功且确实为空时显示 `0`。顶层为 `partial` 时，其失败分区显示 `--`；`stale` 快照可显示截止时间与历史值，但不进入当前 actions、不驱动写操作；`denied`、`disabled`、`scope_mismatch` 和 `unavailable` 不返回该分区业务数据。

### 5.2 完全消费 `TreatmentCareSourceV1`

Care 完全消费总协调台冻结的 `TreatmentCareSourceV1` 与统一 envelope，本计划不重复字段定义。客户中心在自身模块实现 provider；Care 只通过服务端 reader 获取当前来源快照，并逐字段使用客户线公共声明，不重命名、投影或兼容第二套字段。创建或变更前校验 `contractVersion: 'v1'`、服务端 scope、readiness、freshness、`CustomerReferenceV1` 和当前 `sourceVersion`。

Care 使用三类不含 `sourceVersion` 的稳定幂等键；`sourceVersion` 只用于当前性与冲突校验，绝不进入幂等身份：

| 用途 | 稳定键组成 |
| --- | --- |
| 治疗来源单次任务 | `institutionId + sourceId + suggestionKey` |
| 治疗来源路径入组 | `institutionId + sourceId + templateFamilyKey` |
| 路径节点任务 | `institutionId + pathEnrollmentId + nodeKey` |

- 普通治疗编辑只使旧快照失效并要求后续读取新 `sourceVersion`；不会自动重建、改写或取消已经存在的单次任务、路径或节点。
- 治疗作废的自动影响严格限定为：同源路径实例、该路径尚未完成的节点任务、未来且尚未发送的触达。处理方式是受控取消或进入人工复核，并保留来源、历史和审计。
- 手工任务、治疗来源单次任务、其他来源任务/路径、已完成节点、已完成任务以及已经发送/送达的事实全部保留，不自动撤销；受影响但不能自动改变的对象只进入人工复核。
- `partial`、`stale`、`unavailable`、`denied`、`disabled`、scope mismatch、`sourceVersion` 冲突或来源完整性失败时 fail-closed：不新建、不入组、不把未知当作“未作废”。重复作废回流按 `sourceId + sourceVersion` 幂等处理。

### 5.3 完全消费 `ConversationCareDispositionV1` 当前快照

Care 完全消费总协调台冻结的 `ConversationCareDispositionV1` 当前快照与统一 envelope，本计划不重复字段定义。会话工作台在自身模块提供 provider；Care 只通过服务端 reader 取得当前 snapshot，不保存聊天正文、附件、AI 输出或渠道 payload，也不重新分类回复。

| 当前快照结论 | Care 守卫与结果 |
| --- | --- |
| `simple_confirmation` | 仅当任务为 `waiting_customer`，服务端 reader 返回 `readiness=ready` 的最新 snapshot 且其 `revision` 为当前 revision，scope/customer/task 全部匹配，并同时满足 `identityState=matched`、`classification=simple_confirmation`、`resolutionState=resolved`、`riskState=none`、`blockingReasonCodes=[]`，规范服务才可用受控 `contact_completed` 完成当前任务；任一条件不满足即转人工复核。 |
| `substantive_consultation` | 任务保持/进入 `waiting_customer`，关联路径暂停。只有 snapshot 最新、envelope `readiness=ready`、其 `revision` 为当前 revision 且 scope/customer/task 匹配，满足 `resolutionState=resolved`、`riskState=none`、`blockingReasonCodes=[]`，并从 `resolvedAt` 与 `lastCustomerMessageAt` 较晚者起连续 60 分钟无新消息时，才产生可恢复判定。 |
| `ambiguous` | 与实质咨询采用相同的最新 `revision`、`readiness=ready`、scope/customer/task 匹配、`resolutionState=resolved`、`riskState=none`、`blockingReasonCodes=[]` 和 60 分钟守卫；未满足时保持等待和暂停，不自动完成。 |
| `risk` | 原子升级任务并暂停路径。临床风险必须具备最新 revision、同机构、同客户、同风险事件、有效且未撤销的外部临床关闭引用；非临床风险及 `complaint`、`refund_dispute`、`privacy_request`、`opt_out` 必须具备满足同样 revision/scope/风险事件/有效性条件的对应受控治理关闭引用；两类都只能在有权人工复核后解除阻断。非临床引用不得替代临床引用，内部备注、普通会话结束或管理员强制结束不得替代任何关闭引用。 |

- 实质/含糊的可恢复判定由当前快照确定性计算，可在获批的受控命令中恢复；任何新客户消息或新的 `revision` 都重置 60 分钟计时。恢复后已经逾期的路径节点仍逐项人工复核，不集中补发。
- 临床风险的外部临床关闭引用只有在最新 revision、同机构、同客户、同风险事件、有效且未撤销时，才解除“禁止评估”的前置阻断；仍须有权人工复核才能从 `escalated` 转回 `in_progress`，不得自动完成或自动恢复路径。任一条件不满足或引用无法验证时继续阻断。
- 非临床风险及 `complaint`、`refund_dispute`、`privacy_request`、`opt_out` blocker 必须分别由最新 revision、同机构、同客户、同风险事件、有效且未撤销的对应受控治理关闭引用解除，并经过有权人工复核。非临床引用不得替代或降低临床风险的外部临床关闭要求；内部备注、会话结束、强制结束或其他类型引用不能清空任何 blocker。
- 同一 `dispositionId + revision` 的重复回流只处理一次；更高 revision 使旧 snapshot 失效。`stale` snapshot 只能显示带截止时间的历史说明，不得完成任务、解除风险或恢复路径。

### 5.4 Care 的时间线贡献

`CustomerTimelineContributionV1` 的公共声明由总协调台维护，Care 只提供 provider。贡献内容包括任务创建、分配/认领、状态改变、风险升级、结构化完成、路径暂停/恢复/取消的低敏事件；每项只含客户引用、事件 ID、发生时间、受控标题/原因码、风险和 canonical 来源链接，不传人工摘要全文、消息文本、诊疗结论或外部系统内容。客户中心拥有最终聚合、排序和读取权限。

### 5.5 `InstitutionOperatingContextV1` 与时区版本

- 今日到期、逾期、预约日期和排序边界统一消费 `InstitutionOperatingContextV1.data.current.timeZone` 与 `data.version`，通过统一服务端 reader 获取，不能从浏览器时区或 Care 自建设置推导。
- 生成卡片、行动与目标列表时记录用于派生的 `InstitutionOperatingContextV1.data.version`/freshness，使三处口径一致。上下文 version 冲突时重新读取后再计算，不使用旧版本驱动当前行动。
- 时区设置变化只影响后续读取时的派生分桶和展示；历史任务时间、预约事实、完成结果、事件发生时间、审计和已经形成的发送/送达事实不回写。

### 5.6 局部失效与事实分离

每个成功 mutation 或正式来源 revision 变化都只发出：`institutionId`、安全对象类型/ID、当前 revision 与受影响资源键。客户端按资源键失效并重新调用已授权 reader，不能把失效消息当作业务事实。

| 变化 | 必须局部刷新 | 不应刷新 |
| --- | --- | --- |
| 认领、改派、状态、结果、升级 | 该任务详情、当前筛选列表、对应 CareAction 分区、该客户 Care 时间线 | 全局客户列表、无关机构、其他角色详情。 |
| 治疗普通编辑 | 对应来源快照与需要显示来源的对象 | 自动重建/取消任何任务或路径。 |
| 治疗作废 | 同源路径/未完成节点、该客户时间线、对应 CareAction 分区 | 手工/单次/其他来源/已完成/已发送事实。 |
| 会话处置 revision 变化 | 关联任务/路径详情、该客户时间线、对应 CareAction 分区 | 原始会话内容、全局会话队列。 |
| operating context 变化 | 依赖日期分桶的四卡、actions 和目标列表 | 历史事实、历史审计或已形成结果。 |
| 单一分区失败或过期 | 该分区显示 `--`/截止时间和低敏 failure code | 其他已验证分区或整页业务数据。 |

预约通知、随访通知、provider 接受、渠道送达、客户回复和业务完成始终是不同事实：通知失败不回滚预约/HIS 事实或自动改变随访完成结果；业务完成也不倒推出发送或送达成功。首期没有实时推送承诺，同页 mutation 响应触发失效，跨线事实在用户刷新、受控轮询或未来获批的安全失效通知后重读。

---

## 六、唯一 migration 队列与数据变更申请

全项目唯一 migration 顺序冻结为：

```text
MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06
```

Care 只能向总协调台提出或消费申请，不能创建并行 migration 编号，也不能把 schema、SQL、Drizzle 元数据或回填塞进页面/API PR。

### 6.1 `MIG-02` 的 Care 限定输入

`MIG-02` 只承载以下已冻结范围；公共机构归属/审计基础消费 `MIG-01`，会话事实消费 `MIG-04`，不在本线扩大：

| 限定范围 | 需表达的业务事实 | 核心约束 |
| --- | --- | --- |
| 客户稳定引用与责任归属 | 当前机构内的 `CustomerReferenceV1` 对应关系、规范责任成员引用 | 不按名称或 tenant 猜测机构；客户端不能提交权威 scope/责任人。 |
| 随访任务与来源 | 计划时间、受控来源类型、`sourceId`、`sourceVersion`、具体成员或固定角色池 | `sourceVersion` 用于当前性，不进入三类稳定幂等键。 |
| 认领、状态与并发 | 认领人、认领时间、主状态、当前 revision、创建/更新时间 | 认领与状态写入使用 revision 条件，区分 claim conflict 与 revision conflict。 |
| 结构化结果与风险 | 受控结果、低敏原因、风险，以及临床外部关闭引用或对应非临床受控治理关闭引用的最小安全引用 | 两类引用都校验最新 revision、同机构、同客户、同风险事件、有效、未撤销并要求人工复核；完成/风险变化与任务事件原子化，不保存聊天、病历或 provider payload。 |
| 稳定幂等 | 单次任务、路径入组、路径节点三类键 | 键组成遵循第 5.2 节，均不含 `sourceVersion`。 |
| 线性路径最小持久化 | `templateFamilyKey` 模板族、不可变模板版本、发布指针、`pathEnrollmentId` 运行实例、`nodeKey` 稳定节点身份，以及任务关联、暂停/恢复/取消状态和来源关联 | `MIG-02` 只提供获批的最小持久化；版本发布后不可改写，发布指针只影响后续入组，`nodeKey` 不得由显示顺序或标题推导；不借此扩张页面范围或自由图能力。 |

存量预检必须回答哪些 `follow_up_tasks`、来源、认领/操作者和路径实例可以可靠回填 `institutionId`、客户引用与责任归属；不可靠者进入 legacy 隔离或人工复核，绝不猜测。只有总协调台批准后，`MIG-02` 才能在唯一迁移队列中按获批方案实施；本计划没有 schema/migration 授权。

### 6.2 预约数据变更申请

预约请求、HIS 预约事实、变更历史和通知事实不进入 `MIG-02`。Care 在 `CARE-04` 只提交 `CARE-DCR-APPT-01`，说明权威来源、机构隔离、负责人、幂等、历史预检、回滚和通知事实分离；由总协调台评审并分配后续唯一 migration ID。未分配前不得新增预约 schema，也不得复用随访字段伪装预约。

---

## 七、按 CARE-01 起的可执行小 PR 计划

每一项开始前都要重新执行日期、分支、`HEAD`、`origin/main`、`git status`、允许路径和共享文件锁检查；每个 runtime PR 都从满足前置条件的最新干净 `origin/main` 建立短分支。所有能力先保持关闭，代码合入不等于导航发布。

### CARE-01：人工随访任务、分配与认领

**前置：** `BASE-01/02/04/05`、`CustomerReferenceV1` 与获批的 `MIG-02` 中 Care 数据基础。

1. `CARE-01A`：在计划新增的 `src/modules/care/domain/**` 定义任务、分配、认领、状态前置条件、并发冲突和受控输入的纯领域契约；新增独占单元测试。不得接路由、数据库或旧 `tenant-business-*`。
2. `CARE-01B`：在计划新增的 `src/modules/care/server/**` 建立 institution-scoped repository/service 和原子认领/改派命令；区分 claim conflict 与 revision conflict，每个写入同时写 Care 事件和机构级审计。不得修改集中式 repository 或 schema。
3. `CARE-01C`：由明确 integration request 将规范服务接入 `/api/institution/followups/**`；提供列表、详情、创建、认领和改派的窄接口，所有详情/写入逐项校验服务端 scope、当前分配、revision、来源和任务范围。现有单文件旧路由不能由 Care 分支直接并行编辑。
4. `CARE-01D`：实现 `/hospital/care/followups`、`/hospital/care/followups/:taskId` 对应页面和计划新增的 `src/modules/care/client/**`。桌面使用列表 + `720px` 详情，移动端同链接全屏；创建表单只含客户、阶段、计划时间、受控动作、风险、具体员工或角色池和可选安全来源引用。

**验收：** 角色池只能由同机构、对应角色的员工原子认领；重复认领准确返回冲突；具体员工任务不显示认领；管理员/运营的改派有审计；咨询师/客服无法枚举其他员工任务；无来源、无客户或跨机构均不能创建；无任何发送、预约或 HIS 状态。

### CARE-02：结构化结果、风险升级、时间线与会话回流

**前置：** `CARE-01` 已合并并完成机构隔离验收；会话回流部分额外等待生产 `ConversationCareDispositionV1`。

1. `CARE-02A`：实现状态机命令、结构化结果、低敏人工反馈、风险升级和强制处理。先覆盖纯领域与服务层测试，随后以窄路由接入；不得允许自由文本完成或从 `escalated` 普通完成。
2. `CARE-02B`：按总协调台公共声明实现 `CustomerTimelineContributionV1` provider、四分区/四卡/actions 的 `CareActionSourceV1` provider 与局部失效键；客户中心/工作台各以独立消费者 PR 接入，Care 不改其页面、聚合或公共声明。
3. `CARE-02C`：在会话线提供正式 provider 后，消费 `ConversationCareDispositionV1` 当前快照。落实简单确认全量守卫、实质/含糊 `blockingReasonCodes=[]` 与 60 分钟守卫、按 `dispositionId + revision` 幂等，以及第 5.3 节对临床外部关闭引用和非临床受控治理关闭引用的最新 revision、同机构、同客户、同风险事件、有效、未撤销、不可互相替代及人工复核守卫；没有正式快照时入口隐藏且不做模拟替代。

**验收：** 完成必有受控结果；高风险无法普通完成；实质咨询/含糊不完成且暂停关联路径；风险同时产生升级和低敏审计；会话新消息或处置版本更新令旧恢复资格失效；时间线与工作台只刷新受影响客户/对象。

### CARE-03：版本化线性路径与治疗来源

**前置：** `CARE-01/02`、客户中心的正式 `TreatmentCareSourceV1`，以及已由总协调台批准并独立交付的 `MIG-02`。`CARE-03` 只消费该迁移结果，不创建、改号或夹带任何 migration。

1. `CARE-03A`：消费 `MIG-02` 已交付的线性模板族、不可变版本、发布指针、运行实例和节点稳定身份，实现受控停止条件、来源匹配和三类不含 `sourceVersion` 的稳定幂等规则；模板编辑/发布权限只开放给管理员与运营。
2. `CARE-03B`：消费总控冻结的 `TreatmentCareSourceV1`，实现路径入组、全部未来任务创建、暂停/恢复、取消与来源作废精确影响；不重复声明契约，不读取客户中心 repository/table，普通治疗编辑不自动重建或取消。
3. `CARE-03C`：完成路径运行实例、详情和客户只读关联视图；咨询师/客服仅从已授权任务或客户详情读取关联路径，不显示路径管理导航。

**验收：** 无标准项目映射时进入受控异常而非套用通用模板；同源模板族只入组一次；普通治疗编辑不自动重建/取消；治疗作废仅影响同源路径、未完成节点和未来未发送触达，手工/单次/其他来源/已完成/已发送事实保留并进入必要人工复核；暂停后不补发、恢复后逾期阶段逐项人工复核；路径运行不生成真实消息。

### CARE-04：预约请求与 HIS 事实的独立技术设计

本项不是 `CARE-01` 至 `CARE-03` 的附带实现。独立计划须定义本地“待提交/已失效”请求与 HIS 预约事实的分离、客户负责人、时段重新校验、变更历史、取消/爽约理由和通知状态；同时只提交 `CARE-DCR-APPT-01`，等待总协调台分配唯一 migration ID。本地请求绝不能显示成预约或占用时段；本项仍不得接 HIS、凭证或网络。

### CARE-05：消费 `INT-HIS-01` 并完成业务验收/发布

Care 不实现 HIS adapter。总协调台在唯一外部集成串行队列中独立交付并批准 `INT-HIS-01` 后，Care 只消费其正式 adapter，执行业务契约验收、机构/RBAC 验收、错误映射验收和 capability 发布。HIS 始终是预约唯一事实源；HIS 不可用、超时或时段无法确认时只保存低敏待提交预约请求，不生成本地假预约、占位或已确认事实。通知发送结果与 HIS 预约事实、客户确认和业务完成继续分离。

### CARE-06：今日队列与移动端紧凑计数

在预约与随访均具备真实、持久化且可解释来源后，才实现 `/hospital/care` 的六个受控计数和上下两个分区。预约区在上、随访区在下；每区最多 10 条；唯一行内写操作是“认领随访”。读取遵守统一 envelope 与 `InstitutionOperatingContextV1` 时区版本；任何单一来源失败显示 `--` 与局部状态，不显示静态 `0`，也不清空另一个分区。只有权威查询成功且确实为空时才显示 `0`。

---

## 八、接口、页面和测试门禁

### 8.1 未来规范接口与路由边界

页面 canonical 路由只允许以下一套，不得省略 `/hospital` 前缀或建立第二套详情入口：

| 页面 | canonical 路由 | 约束 |
| --- | --- | --- |
| 今日队列 | `/hospital/care` | 预约区在上、随访区在下；能力不满足时不显示空壳。 |
| 预约管理 | `/hospital/care/appointments` | 列表与四卡目标使用同一服务端 RBAC。 |
| 预约详情 | `/hospital/care/appointments/:appointmentId` | 重验 scope、HIS 客户负责人、事实版本与 Care 权限。 |
| 随访任务 | `/hospital/care/followups` | 列表、筛选和 actions 使用同一服务端 RBAC。 |
| 随访详情 | `/hospital/care/followups/:taskId` | 重验 scope、分配/角色池资格与 revision。 |
| 路径管理 | `/hospital/care/paths` | 管理员/运营管理；咨询师/客服不显示管理入口。 |
| 路径详情 | `/hospital/care/paths/:enrollmentId` | 从获准任务/客户入口访问时仍重验 scope 和对象归属。 |

规划中的业务 API 边界为：

| 能力 | 业务 API | 约束 |
| --- | --- | --- |
| 随访列表/创建 | `/api/institution/followups` | 只接受结构化筛选与受控创建字段；列表不含人工反馈全文或原始消息。 |
| 任务详情/状态 | `/api/institution/followups/:taskId` | 读、状态更新和 revision 冲突分别处理；不能从列表权限推导详情/写权限。 |
| 认领/改派/结果 | `/api/institution/followups/:taskId/claim`、`/reassign`、`/result` | 命令式端点均要求当前 revision、服务端 scope、分配范围和审计。 |
| 路径 | `/api/institution/followup-paths/**` | 只处理运行实例与受控模板；无正式来源时不入组。 |

`customerId`、`sourceConversationId` 只可作安全对象引用预填，目标页必须重新读取和验证。实际路径迁移由总协调台确认，不得以新增平行 v2 路由绕过共享 API 文件锁，也不得让旧 API 与新 API 对同一任务同时写入。

### 8.2 最小测试集

| 层级 | 必测场景 |
| --- | --- |
| 统一 envelope | `InstitutionSourceEnvelopeV1<T, K>` 的 `contractVersion: 'v1'`、双 scope、顶层七种 readiness、唯一 freshness、分区六种 readiness 和统一 failure code；仅权威 `empty` 显示 `0`；`stale` 不返回当前 actions/写能力；`denied`、`disabled`、scope mismatch 不返回业务数据。 |
| `CareActionSourceV1` | 四个固定 partition/card key、四卡 + actions，以及 `entityType/objectId/sourceVersion/customer/businessState/cardKeys/sortSignals/appointmentAt/dueAt/slaAt/riskLevel/priority/owner/safeSummary/detailHref`；四卡、actions、目标列表和详情使用同一 RBAC，部分失败只影响对应分区。 |
| 领域状态 | 全部合法/非法流转、结构化结果必填、风险优先级、simple confirmation 全量守卫、实质/含糊 `blockingReasonCodes=[]` 与 60 分钟、新消息重置；临床外部关闭引用与非临床受控治理关闭引用都验证最新 revision、同机构、同客户、同风险事件、有效、未撤销和人工复核，且不可互相替代。 |
| 服务与 repository | `tenantId + institutionId`、客户/来源归属、具体成员/角色池资格、双人并发认领、claim conflict、revision conflict、任务事件与审计同事务。 |
| RBAC/API | 四稳定角色、管理员/运营 Care 权限、咨询师/客服本人随访范围、HIS 客户负责人预约范围；未登录、缺机构、越权、跨机构、范围外详情、非法输入和审计失败。 |
| 治疗来源 | 三类稳定幂等键分别使用 `institutionId + sourceId + suggestionKey`、`institutionId + sourceId + templateFamilyKey`、`institutionId + pathEnrollmentId + nodeKey` 且均不含 `sourceVersion`；重复回流不重复创建；普通治疗编辑不重建/取消；作废只影响同源路径/未完成节点/未来未发送触达并保留其他事实。 |
| 会话来源 | 不重新分类/不保存正文；四类 disposition、重复 revision 幂等、旧 revision 失效；临床外部关闭引用与非临床受控治理关闭引用分别覆盖最新 revision、同机构、同客户、同风险事件、有效/撤销、人工复核、不可互相替代，以及内部备注/会话结束不能替代引用。 |
| 时区与事实分离 | `InstitutionOperatingContextV1.data.version` 与 `data.current.timeZone` 一致驱动卡片/actions/列表；版本变化不回写历史事实；通知待发送/接受/送达/失败与预约事实、回复和业务完成互不冒充。 |
| 页面与失效 | 七条 canonical 路由、无省略 `/hospital` 前缀或重复路由、桌面抽屉/移动全屏、筛选恢复、空数据、过期、`--` 非零化、局部刷新不清空无关分区。 |

建议验证顺序（均须在获批 runtime 任务中执行）：目标模块 Vitest → `pnpm typecheck` → 必要的页面测试 → 机构隔离/权限/审计回归。涉及数据库时使用 `.env*` 排除的隔离镜像与独立测试数据库；不得读取或复制 `.env.local`，也不得让多个 Worktree 同时写同一开发库。

### 8.3 发布门禁与回滚

- `CARE-01` 只能在 capability-off 状态合并，不能独立进入正式导航，也不能把“可创建/认领”描述成人工随访闭环已经发布。
- 随访子能力正式进入导航至少等待 `CARE-02A` 与 `CARE-02B`：任务、分配/认领、合法流转、结构化结果、权限、机构隔离、审计、持久化、时间线贡献、统一 CareAction provider 和局部失败均完成真实验收。会话消费和路径仍可按各自 capability 后置。
- `/hospital/care` 今日队列的正式发布还须等待 `CARE-06`，并且预约分区必须来自已验收的 HIS 事实；只有随访成熟时可只发布 `/hospital/care/followups`，不得用假预约补齐根页面。
- 任何 Care 页面进入正式导航前，必须同时满足 capability、机构授权、统一 readiness/freshness、权限、审计和模块验收；未完成能力直接隐藏。未知、失败、顶层 `partial` 所含失败分区、`denied`、`disabled` 或过期不得显示 `0`。
- 出现来源版本不一致、跨机构、审计失败、风险未关闭或结构化结果缺失时，阻断当前写入并保留既有事实；不以降级为假完成。
- 回滚遵循新增规范服务/路由壳的可逆发布：先关闭 capability，保留任务历史、审计和时间线，不物理删除或回写治疗/会话来源；migration 回滚仅按获批 `MIG-02` 方案单独执行。

---

## 九、进入下一任务前的明确决策与停止条件

1. **`MIG-02` 执行排期与授权：** 范围已按第 6.1 节冻结，但仍须总协调台放入唯一迁移队列并单独批准；实施前 `CARE-01` 只能做纯领域契约，不能做持久化 UI/API。
2. **成员与责任来源：** `BASE-02` 必须给出可验证的当前机构成员、固定角色池资格和客户责任成员来源；没有该来源，不实现认领、改派或咨询师/客服数据范围。
3. **公共 contract/provider 可用性：** 总协调台须交付 v1 公共声明；客户中心、会话线和机构上下文分别提供 `CustomerReferenceV1`/`TreatmentCareSourceV1`、`ConversationCareDispositionV1`、`InstitutionOperatingContextV1` provider。未 ready 的消费者切片保持关闭。
4. **预约数据：** `CARE-DCR-APPT-01` 仍需总协调台评审并分配后续唯一 migration ID；未分配前不创建预约数据结构。
5. **HIS 集成：** `INT-HIS-01` 必须由总协调台外部集成串行队列独立授权和交付；Care 只消费、验收和发布。真实 HIS、凭证、网络和通知不从本计划自动获得许可。

任何一项不满足，停止在对应前一小 PR，保持 capability-off，并向总协调台提交 integration request 或数据变更申请；不得通过 Mock、in-memory 状态、旧 tenant 级记录或客户端权限绕过。
