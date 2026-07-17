# 机构端客户中心技术计划

> 本文由 `PLAN-CUS-01` 首轮盘点形成，经 `PLAN-CUS-REV-02` 统一共同冻结契约，并在 `PLAN-CUS-REV-03` 中定点修正字段冲突。本文只规划后续小 PR，不构成 runtime、schema、migration、外部集成、提交、推送、PR 或合并授权。

**目标：** 将机构端客户能力收敛为“客户列表、治疗记录”两个稳定顶部页签，提供低敏客户查询、稳定详情 URL、概览、跨线时间线、预约/随访只读摘要与安全跳转、治疗记录、桌面抽屉、移动全屏和可靠浏览器恢复，并让所有读取严格受服务端 `tenantId + institutionId`、精确角色范围、版本化读取状态和能力门禁约束。

**架构方案：** 客户中心拥有客户事实、客户读模型、客户详情聚合、治疗事实和明示例外外的客户 API 子树；公共契约声明一律由总协调台维护，客户中心只在自身模块实现 mapper/provider，消费者只能通过已批准的 `contractVersion: v1` 契约读取。跨线读取统一返回带 scope、readiness、freshness、分区状态和受控 failure code 的 `InstitutionSourceEnvelopeV1<T, K>`；reader 只作为服务端输入，不进入响应 envelope。任何栏目不得直读另一生产线的 repository 或表。

**技术栈：** Next.js App Router、React、TypeScript、Vitest、Testing Library、Drizzle、PostgreSQL。

---

## 一、文档状态与历史启动基线

- 初始规划日期：`2026-07-17 CST`，由当次 `date '+%Y-%m-%d %Z'` 核验。
- 初始任务链：`PLAN-CUS-01 → PLAN-CUS-REV-02 → PLAN-CUS-REV-03`，均为 docs-only 规划或修订。
- 历史启动基线：第一轮文档从 `e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa` 的独立 detached Worktree 形成；该值只记录启动事实，不代表后续审查时的当前 `HEAD` 或 `origin/main`。
- 发布载体：本文已纳入 Draft PR `#536` 的 `codex/institution-plans-customer-care-conversation` 分支；Draft 只表示候选，不代表已获合并或 runtime 授权。
- 任何后续审查都必须以当次命令重新核验日期、分支、`HEAD`、`origin/main` 和 `git status --short`，不得复用本节历史快照。
- 文档文件边界：`docs/superpowers/plans/2026-07-17-institution-customer-center-technical-plan.md`。
- 授权边界：本计划本身不授权修改 `src/**`、`drizzle/**`、schema、migration、API、测试、配置、脚本或其他文档，也不授权访问凭证、数据库、外部网络、提交、推送、创建/合并 PR 或继续 runtime；任何实际动作均需独立明确授权。

本文遵从《机构端七线并行开发总计划》和《机构端导航与页面系统设计》。计划中出现的类型、路由、文件和测试均为后续授权边界，不是本轮实施结果。

---

## 二、总控共同冻结

### 2.1 稳定角色与机构范围

机构端稳定角色代码只有：

```ts
type InstitutionRoleV1 =
  | 'tenant_admin'
  | 'tenant_operator'
  | 'consultant'
  | 'customer_service';
```

- 所有页面、API、provider 和 adapter 都从服务端 session/guard 推导 `tenantId + institutionId + reader`；客户端提交的租户、机构、角色、客户归属或展示字段不参与授权。
- 平台角色不因具备平台管理能力而自动取得机构客户数据。
- scope mismatch、角色拒绝或能力关闭时不返回客户、计数、事件、附件、金额或其他业务数据，也不得用响应差异泄露对象是否存在。

### 2.2 公共契约所有权

- 所有跨线公共契约声明的唯一所有者是总协调台，目标目录为 `src/modules/institution-contracts/v1/**`。
- 本文冻结客户线需要提交给总协调台的字段和语义，但不声称客户中心拥有公共声明文件。
- 生产者在自己的领域模块实现 provider、mapper、adapter 和兼容测试；消费者只调用 provider，不读取生产者 repository、内部 service 或表。
- 公共契约升级必须由总协调台按兼容窗口处理；栏目线不得自行产生另一个 V1 形状。

### 2.3 唯一迁移与外部集成队列

- 全项目唯一 migration 顺序是 `MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06`。客户中心只能提出或消费数据变更申请，不创建并行 migration 编号，也不把 schema 改动塞进页面或 API PR。
- 客户机构归属只消费 `MIG-01`；稳定客户引用、可靠负责人关系和 Care 数据基础只进入 `MIG-02`。
- 多项目、生命周期纠正历史、客户别名/合并谱系、导入批次与逐行结果分别提交独立数据变更申请，由总协调台决定是否及何时编入唯一迁移队列。
- HIS、ERP/POS、受控导入、渠道/AIBOTK、OCR、embedding、rerank、知识 AI 和经营报告 provider 全部进入总协调台唯一外部集成串行队列。客户中心 PR 只提出业务契约、消费已批准 adapter 并验收，不直接联网、不读取凭证、不实现第二套集成。

---

## 三、只读盘点与所有权结论

| 范围 | 当前事实 | 后续计划结论 |
| --- | --- | --- |
| 机构入口 | 当前根入口仍由 `InstitutionWorkspace.tsx` 的 `activeView` 驱动，`DemoSessionGate` 的现状不能代表四角色正式权限。 | `BASE-01A` 先交付真实路由壳；客户线不改根页面、公共导航或共享门禁。 |
| 客户列表 | 旧 `GET /api/institution/customers` 和部分读模型只按 `tenantId`。 | 新列表、计数、筛选候选与详情必须在查询阶段按 `tenantId + institutionId` 约束；旧根列表不作为新栏目正式数据源。 |
| 客户详情 | 旧时间线已聚合预约、随访、治疗和审计，但跨线读取仍直接依赖内部读模型。 | 客户中心保留最终聚合与排序，只消费各生产线 provider；普通客户读取权限不能自动获得审计事件。 |
| 治疗记录 | 现有治疗 API 和壳已有增删改语义，部分路径仍只有租户边界。 | CUS-02 先做机构隔离的只读列表/详情；CUS-03 再单独授权管理员写入和 Care 来源 provider。 |
| 权限 | `AccessContext.institutionId` 仍可选，现有资源权限不能证明所有对象关系均按机构隔离。 | 依赖 `BASE-02` 服务端 guard；缺机构或无法证明关联归属时 fail-closed。 |
| 客户模型 | 负责人、多项目、稳定引用、受控下一步、纠正历史、合并谱系和导入批次的可靠持久化并不完整。 | 不映射旧自由文本伪装结构化事实；分别提交数据变更申请并等待唯一迁移队列。 |
| 客户 URL 下的 Care 路径 | `followup-*` 与触达安全路径位于客户 API 子树，但业务事实不属于客户中心。 | Care 与获准渠道集成继续独占；客户中心只消费已批准契约。 |

---

## 四、目标范围、前置与完成定义

### 4.1 CUS-01 只读闭环

CUS-01 在后续逐 PR 授权后交付：

1. `/hospital/customers` 客户列表、五类生命周期聚合、低敏搜索和结构化筛选。
2. `/hospital/customers/:customerId` 稳定对象链接，以及 `overview`、`timeline` 的真实只读内容。
3. 桌面 `720px` 详情抽屉与移动全屏共用同一 URL、数据读取和权限判定。
4. 直接打开、刷新、前进/后退、页签切换、筛选、分页、滚动恢复和局部刷新。
5. 服务端机构隔离、四角色精确读范围、统一 envelope、完整页面状态和低敏失败语义。
6. 顶部“治疗记录”页签及完整详情页签枚举的路由保留，但未到对应切片时必须通过 capability-off 门禁，不查询业务数据。

### 4.2 不在 CUS-01A 至 CUS-01G

- 客户创建、编辑、导入执行、归档、合并、生命周期人工纠正或下一步行动写入。
- 治疗列表/详情正式发布、治疗新建/编辑/作废或 Care 任务创建。
- 预约、随访、路径、会话、消费、完整审计、附件内容、真实消息或外部触达实现；预约/随访只读摘要与跳转仅在后置 `CUS-01H` 消费正式 `CustomerCareSummaryV1`，不进入前七个切片。
- schema、migration、共享权限、共享契约声明、根 layout、公共导航、旧大型集中式文件修改。
- 任何外部网络、真实 HIS、ERP/POS、渠道、AI、经营报告 provider 或真实凭证。

### 4.3 硬前置

前置按具体能力判定：`MIG-01` 是基础机构隔离门禁；`MIG-02` 不是已有可靠 `customerId + institutionId` 基础列表的整体阻断项。

| 前置 | 所有者 | 客户中心可消费结果 | 未满足时行为 |
| --- | --- | --- | --- |
| `BASE-01` 能力发布 | 总协调台 | 导航、深链接与 API 共用 `hidden / read_only / operational` 结论。 | 页面显示统一未开放状态，API 返回 `disabled` 且无 data。 |
| `BASE-01A` 路由壳 | 总协调台 | `/hospital/customers/**` 可挂载，静态 `treatments` 前缀不会被动态客户 ID 吞并。 | 不在旧 `activeView` 中复制第二套路由。 |
| `BASE-02` 机构 guard | 总协调台 | 服务端推导 `tenantId + institutionId + reader` 并验证能力/对象范围。 | 不创建正式查询或 provider。 |
| `BASE-05` 页面状态 | 总协调台 | loading、empty、partial、stale、unavailable、denied、disabled 与记录不可用表现。 | 不自造另一套状态枚举。 |
| `MIG-01` 可消费关系 | 总协调台 | 客户及必要关联可证明当前机构归属。 | 对不能证明归属的来源停止发布。 |
| `MIG-02` 可消费关系 | 总协调台 | 稳定客户引用、可靠负责人和 Care 基础事实。 | 缺负责人时只隐藏 owner/“我的客户”及其依赖；已有可靠 `customerId + institutionId` 的基础列表不被阻断。 |
| 公共契约注册窗口 | 总协调台 | 本文列出的 V1 声明、兼容测试和 provider 注册方式。 | 客户线只保留本地 adapter 草案，不写共享目录。 |

### 4.4 完成定义

- 四机构角色只看各自服务端角色范围内的低敏客户数据；跨机构、缺机构、平台角色和能力关闭均无业务数据侧信道。
- 自由文本关键词不进入 URL、浏览器持久化、日志、审计正文、错误消息或 provider failure。
- 只有权威查询成功且确实为空时显示 0；缺失、局部失败、过期或未开放不转成 0。
- 桌面与移动使用同一稳定对象链接，前进/后退和刷新不丢失可持久化的结构化列表状态。
- 时间线按 provider 分区解释 freshness/readiness；stale 快照仅显示已验证截止时间，不驱动当前写操作或行动队列。

---

## 五、顶部页签、canonical 路由与体验契约

### 5.1 冻结顶部页签与路由

顶部页签顺序固定为“客户列表、治疗记录”。canonical 路由只有下表这些入口：

| 层级 | canonical URL | 能力阶段 | 页面形态 |
| --- | --- | --- | --- |
| 客户列表 | `/hospital/customers` | CUS-01 | 桌面表格、移动卡片完整页面。 |
| 治疗记录 | `/hospital/customers/treatments` | CUS-02 | 桌面表格、移动卡片完整页面。 |
| 治疗详情 | `/hospital/customers/treatments/:summaryId` | CUS-02 | 桌面 `720px` 抽屉、移动全屏。 |
| 客户详情 | `/hospital/customers/:customerId` | CUS-01 | 桌面 `720px` 抽屉、移动全屏。 |

客户详情 `view` 白名单固定为：

```text
overview | timeline | appointments | followups | treatments | consumption | audit
```

- 默认 canonical 详情为 `/hospital/customers/:customerId?view=overview`；省略 `view` 时服务端规范化为 `overview`。
- 其他详情页签使用同一客户详情 URL 的 `view` 查询参数，不创建重复的 path 版本。
- `appointments`、`followups`、`treatments`、`consumption`、`audit` 只有对应 provider、角色权限和 capability 同时可用时才呈现内容；否则返回 `disabled` 或 `denied` 且无业务 data。
- `appointments` 与 `followups` 只消费 Care 提供的 `CustomerCareSummaryV1`，每组显示最多 5 条只读摘要、同一 Care RBAC 查询安全派生的 `hasMore` 和 Care 提供的 canonical `detailHref`；不复制预约/随访表单、状态机、repository 或列表算法，不在客户抽屉内实现分页或“加载更多”。
- 客户页派生的列表与新建跳转固定为 `/hospital/care/appointments?customerId=:customerId`、`/hospital/care/appointments?customerId=:customerId&create=1`、`/hospital/care/followups?customerId=:customerId`、`/hospital/care/followups?customerId=:customerId&create=1`。列表跳转只要求对应摘要读取范围；任何 `create=1` 快捷入口必须另由 Care 服务端写权限 authorizer 对当前机构、角色、客户、来源和 capability 返回 fresh allow，不能由摘要可读、item 存在或 `hasMore` 推导。普通手工随访快捷入口只对管理员/运营开放；咨询师/客服的会话来源限定例外仍只能从已分配且已匹配的会话发起。来源页只传当前已验证的客户 ID；Care 目标页重新校验全部写权限和当前事实，打开页面不等于创建成功。
- 路由匹配必须优先保留静态 `/hospital/customers/treatments/**`，再处理动态 `:customerId`，并用路由测试证明 `treatments` 不会被识别为客户 ID。

### 5.2 `BASE-01A` 交接与 capability-off 门禁

`BASE-01A` 负责公共 layout、顶部导航槽位、响应式路由壳、路由冲突保护和统一未开放页面；客户中心只在已分配的叶子路由中实现页面。交接验收必须证明：

1. “客户列表、治疗记录”标签和 canonical URL 映射稳定，浏览器刷新不回退到旧 `activeView`。
2. 页面、深链接和 API 查询同一个 `CapabilityStatusV1` 结论；导航隐藏不能替代 API 拒绝。
3. capability-off 时不挂载业务 client、不调用 repository/provider、不预取计数，envelope 为 `readiness: 'disabled'`、`data: null`。
4. CUS-01 发布时仅客户列表、客户详情的 `overview/timeline` 可进入 `read_only`；治疗顶部页签和其余详情页签继续受独立能力门禁。

### 5.3 URL、搜索与筛选

允许写入列表 URL 的结构化键为 `lifecycle`、`priority`、`ownerId`、`projectId`、`tag`、`lastTouchedFrom`、`lastTouchedTo`、`sort`、`direction` 和正整数 `page`。枚举、日期、页码以及 `ownerId/projectId/tag` 都必须由当前机构的服务端受控选项验证；未知键、重复键、非法值或越界值回退安全默认值且不回显原输入。

低敏搜索词只驻留当前页面内存，300–500ms 防抖，`Enter` 立即查询，刷新或新开页面清空。只匹配客户中心生成的低敏 `displayName` 和可空脱敏引用；不匹配原始手机号、身份证、病历正文、备注、聊天正文、外部 ID 或任意自由文本字段。

### 5.4 历史、刷新与响应式恢复

1. 列表点击客户或治疗摘要使用 `push`；关闭桌面抽屉或移动全屏详情使用浏览器返回，恢复筛选、页码和滚动锚点。
2. 详情内切换 `view` 使用 `replace`，不为页签切换堆积历史记录。
3. 直接打开客户或治疗详情：桌面可并行恢复背景列表并打开抽屉，移动端直接全屏；背景列表失败不阻断已获授权的详情独立读取。
4. 局部刷新只重取当前列表、overview、timeline 或已发布页签；保留已授权内容并标示刷新进度，不整页 reload。
5. 跨机构、归档、合并后不可直接访问或物理不存在统一显示“记录不存在或已不可用”，不暴露具体原因。

### 5.5 完整页面状态

| 页面状态 | envelope 条件 | UI 规则 | 是否允许显示 0/业务数据 |
| --- | --- | --- | --- |
| 首次加载 | 请求尚未完成 | 与最终布局一致的 skeleton。 | 否。 |
| ready | `readiness = ready` | 显示权威当前数据和 freshness。 | 可显示真实计数。 |
| empty | `readiness = empty` | 区分“机构确实无数据”和“筛选无结果”。 | 仅权威查询成功且确实为空时可显示 0。 |
| partial | `readiness = partial` | 仅在没有任何 scope mismatch 时保留成功分区，明确普通失败分区并允许局部重试。 | 缺失分区不转 0；任一 scope mismatch 整包无数据。 |
| stale | `readiness = stale` | 显示已验证快照、`observedAt/freshUntil` 和过期提示。 | 可显示带 freshness 的快照值，但不能驱动写操作或行动队列。 |
| unavailable | `readiness = unavailable` | 显示受控暂不可用状态和安全重试。 | 否。 |
| denied | `readiness = denied` | 统一无权限页面或隐藏页签。 | 否，`data` 必须为 `null`。 |
| disabled | `readiness = disabled` | 统一未开放页面或隐藏入口。 | 否，且不得查询生产者。 |
| 记录不可用 | 对象定位返回受控不可用语义 | 不区分不存在、跨机构、归档或已合并。 | 否。 |
| 登录会话过期 | 服务端判定 session 失效或过期 | 清除受保护页面缓存，跳转登录页；返回地址必须通过站内白名单校验。 | 否。 |
| revision 冲突 | 写命令的 `expectedRevision` 与当前事实不一致 | 不静默覆盖；提示数据已更新并重新读取当前已授权 revision。 | 只显示重新读取的当前事实，不继续旧写操作。 |

---

## 六、API、数据与持久化边界

### 6.1 目标 API

以下仅是后续授权后的目标边界：

| API | 阶段 | 目的与关键规则 |
| --- | --- | --- |
| `POST /api/institution/customers/query` | CUS-01 | 请求体承载内存关键词和白名单筛选；返回低敏分页、受控筛选项和生命周期状态，不把关键词写入 URL。 |
| `GET /api/institution/customers/lifecycle-summary` | CUS-01 | 通过客户中心 provider 返回机构级 `CustomerLifecycleSummaryV1`；列表与工作台共用相同角色范围。 |
| `GET /api/institution/customers/:customerId/overview` | CUS-01 | 返回客户中心本地 `CustomerOverviewV1` 的低敏投影。 |
| `GET /api/institution/customers/:customerId/timeline` | CUS-01 | 聚合已注册 `CustomerTimelineContributionV1` provider，不直读其他线表。 |
| `GET /api/institution/customers/:customerId/care-summary` | CUS-01H | 通过服务端 reader 原样消费 Care 的 `CustomerCareSummaryV1`；不读取 Care 表、不重算列表或 `hasMore`、不扩大当前角色范围。 |
| `GET /api/institution/treatment-summaries` | CUS-02 | 机构隔离的治疗只读列表，管理员/运营/咨询师可读。 |
| `GET /api/institution/treatment-summaries/:summaryId` | CUS-02 | 机构隔离的治疗详情，客服 fail-closed。 |
| `POST /api/institution/customers/from-identity-review` | CUS-04 | 幂等消费已批准身份复核命令；客户中心只创建客户事实，不修改复核状态。 |

共同规则：

- guard 先推导并验证 scope、reader、capability，再在数据库查询阶段按 `tenantId + institutionId` 限定对象、总数、筛选候选和关联事实。
- 未登录、无机构/角色、对象不可用与基础服务失败使用总协调台批准的 HTTP 映射；响应体仍遵守统一 envelope，不能用错误差异泄露对象存在性。
- 不返回原始联系方式、身份证、完整病历、备注、消息正文、自由文本下一步、外部 ID、provider payload、连接信息或凭证。
- 旧 `GET /api/institution/customers` 可在兼容窗口保留，但新页面/client 不调用；下线或收窄另开集成 PR。

### 6.2 机构隔离

- 客户主查询、分页计数、生命周期聚合和筛选候选均在查询层使用 `tenantId + institutionId`，禁止先按租户读取再在内存过滤。
- 预约、随访、治疗、消费、审计、附件和会话分配由各自 provider 重新验证事实归属；“客户已验证”不能替代来源校验。
- 缓存键如后续获批，至少包含 contractVersion、tenantId、institutionId、reader role/data-scope version、对象或筛选摘要；权限或 provider 状态变化后不得返回旧越权数据。
- 无法依赖 `MIG-01` 证明机构归属时，该来源返回 unavailable/受控 failure，不按租户默认机构兜底。

### 6.3 数据变更申请归属

| 数据需求 | 唯一队列归属 | 客户 PR 可做什么 | 在持久化完成前禁止什么 |
| --- | --- | --- | --- |
| 客户及关联机构归属 | 只依赖 `MIG-01` | 消费已批准关系并补机构隔离测试。 | 猜测机构、租户内过滤或自行加列。 |
| 稳定客户引用、可靠负责人、Care 基础 | 只进入 `MIG-02` | 提交字段/约束/回填/回滚需求，等待可消费版本。 | 用旧自由文本或前端过滤伪装稳定关系。 |
| 多项目与主项目 | 独立“多项目数据变更申请” | 定义受控项目引用、唯一主项目和历史预检。 | 把 `projectInterest` 自由文本映射为项目 ID。 |
| 生命周期纠正历史 | 独立“纠正历史数据变更申请” | 定义确定性 basis、纠正人/原因码/版本和回滚。 | 覆盖原事实或保存无界原因正文。 |
| 客户别名与合并谱系 | 独立“别名/合并数据变更申请” | 定义 canonical customer、alias、可逆关系、并发与审计。 | 物理删除或仅在 UI 合并。 |
| 导入批次与逐行结果 | 独立“导入批次数据变更申请” | 定义批次、行状态、幂等键、错误码、审计与保留策略。 | 只做内存预检后宣称真实导入成功。 |

### 6.4 导入与合并的真实持久化前置

- CUS-05 可先交付纯解析/预检，但“执行导入”必须等受控导入 adapter 进入总协调台串行队列，并具备持久化批次、逐行结果、精确重复唯一约束、幂等重试、事务、低敏审计和失败恢复。
- CUS-06 的归档/合并必须先有 canonical/alias 谱系、关系转移清单、行级并发保护、责任转交、可逆操作、审计原子性和恢复演练；任何一项缺失均只显示预检，不执行写入。
- 两者不得把 mock、进程内状态、上传成功或任务已接受表述为业务持久化成功。

---

## 七、统一跨线读取 envelope

公共声明只采用总协调台唯一的 `InstitutionSourceEnvelopeV1<T, K>`，客户中心不保留本地字段变体：

```ts
type InstitutionSourceReadinessV1 =
  | 'ready'
  | 'empty'
  | 'partial'
  | 'stale'
  | 'unavailable'
  | 'denied'
  | 'disabled';

type InstitutionSourcePartitionReadinessV1 =
  | 'ready'
  | 'empty'
  | 'stale'
  | 'unavailable'
  | 'denied'
  | 'disabled';

type InstitutionSourceFailureCodeV1 =
  | 'upstream_unavailable'
  | 'timeout'
  | 'invalid_payload'
  | 'scope_mismatch'
  | 'permission_denied'
  | 'not_released'
  | 'data_incomplete';

type InstitutionSourceFreshnessV1 = {
  observedAt: string;
  freshUntil: string;
};

type InstitutionSourcePartitionV1<K extends string> = {
  key: K;
  readiness: InstitutionSourcePartitionReadinessV1;
  freshness: InstitutionSourceFreshnessV1 | null;
  failureCode: InstitutionSourceFailureCodeV1 | null;
};

type InstitutionSourceEnvelopeV1<T, K extends string> = {
  contractVersion: 'v1';
  scope: { tenantId: string; institutionId: string };
  readiness: InstitutionSourceReadinessV1;
  freshness: InstitutionSourceFreshnessV1 | null;
  partitions: InstitutionSourcePartitionV1<K>[];
  data: T | null;
  failureCode: InstitutionSourceFailureCodeV1 | null;
};
```

强制语义：

1. scope 由服务端生成；reader 只作为 provider/公共 reader 的服务端输入，不序列化进响应 envelope。消费者仍须在自己的服务端边界重验，浏览器不得构造或提升范围。
2. 顶层与 partition 使用同一个受控 failure code 集合。未知 contractVersion 或不合规 payload 统一按 `invalid_payload` fail-closed。
3. 只有顶层 readiness 可以是 `partial`；partition 不允许 partial。顶层 partial 只携带已授权且验证成功的分区数据，缺失分区保留各自状态，不补空数组或 0。
4. 顶层为 `denied`、`disabled` 或 `failureCode=scope_mismatch` 时必须 `data: null`。分区为 `denied`、`disabled` 时只是不向 payload 贡献该分区业务数据；但任一分区出现 `failureCode=scope_mismatch` 时必须提升为顶层 `failureCode=scope_mismatch`，整包 `data: null`，不得以 `partial` 保留其他成功分区。
5. `stale` 只可携带同一 scope 和当前服务端 reader 已验证的快照，并显示 `observedAt/freshUntil`；不能据此创建、重建、取消任务或进入当前行动队列。
6. `empty` 只表示权威查询成功并确认确实为空；超时、失败、过期、禁用和无权限均不能转成 empty。
7. failureCode 只用于受控分支和低敏审计，不携带异常正文、查询、搜索词或生产者 payload。

---

## 八、客户中心相关契约

### 8.1 `CustomerReferenceV1`

**公共声明所有者：** 总协调台。**事实生产者：** 客户中心。**用途：** 仅定位已获授权客户。

```ts
type CustomerReferenceV1 = {
  contractVersion: 'v1';
  customerId: string;
  displayName: string;
  maskedReference: string | null;
};
```

- `displayName` 必须由客户中心按低敏规则生成；`maskedReference` 只能是客户中心生成的脱敏引用。
- 此对象不是授权凭证。每个消费者必须按服务端 `tenantId + institutionId + reader` 重验客户归属和角色范围。
- 不得增加生命周期、负责人、项目、下一步、治疗、消费、联系方式、外部 ID、更新时间或自由文本；这些事实由各自受控契约承载。

### 8.2 客户中心本地 `CustomerOverviewV1`

`CustomerOverviewV1` 是客户中心内部读 DTO，不是跨线公共声明：

```ts
type CustomerLifecycleV1 =
  | 'consulting'
  | 'scheduled'
  | 'post_care'
  | 'repurchase_window'
  | 'silent_reactivation';

type CustomerOverviewV1 = {
  contractVersion: 'v1';
  customer: CustomerReferenceV1;
  lifecycle: CustomerLifecycleV1;
  priority: 'high' | 'medium' | 'watch';
  owner: { userId: string; displayName: string } | null;
  primaryProject: { projectId: string; displayName: string } | null;
  projects: Array<{ projectId: string; displayName: string }>;
  tags: Array<{ tagCode: string; displayName: string }>;
  lifecycleBasis: {
    basisCode: string;
    sourceKind: string;
    sourceId: string;
    occurredAt: string;
  } | null;
  updatedAt: string;
};
```

- lifecycle 必须由确定性规则或有版本的受控纠正事实产生；存在 basis 时其 code/kind 必须来自白名单，不能是自由文本解释；暂无可靠 basis 时返回 `null`，不得伪造。
- owner、项目和标签只有可靠关系可用时才返回；缺 `MIG-02` 负责人时隐藏 owner/“我的客户”，不阻断已有可靠 `customerId + institutionId` 的基础列表，也不从旧文本猜测。
- CUS-04 真正交付前，禁止把旧自由文本 `nextAction` 映射进 overview 或任何公共契约。
- 未来下一步行动只能包含受控 `actionCode`、计划时间 `plannedAt` 和经低敏校验的说明 `safeNote`；该结构需在 CUS-04 单独申请并审查，不提前进入本 V1。

### 8.3 `CustomerLifecycleSummaryV1`

**公共声明所有者：** 总协调台。**provider 生产者：** 客户中心。**消费者：** 客户列表与机构工作台。

```ts
type CustomerLifecycleSummaryPayloadV1 = {
  buckets: Array<{
    key: CustomerLifecycleV1;
    count: number | null;
  }>;
};

type CustomerLifecycleSummaryV1 = InstitutionSourceEnvelopeV1<
  CustomerLifecycleSummaryPayloadV1,
  CustomerLifecycleV1
>;
```

- provider 与客户列表使用完全相同的服务端角色范围：四个机构角色均只能读取其客户列表本来可见范围的低敏聚合。
- buckets 必须且只能各含一次 `consulting`、`scheduled`、`post_care`、`repurchase_window`、`silent_reactivation`；状态只通过 envelope partitions 表达。
- 任一分区缺失、失败或过期时对应 count 为 `null`，不得在 payload 中增加竞争性的 total 或第二套状态字段。
- 只有同一 scope 下权威查询成功并确认真实为空时，五个 count 才可为 0。stale 可显示带 freshness 的历史计数，但不能驱动当前工作台行动项。

### 8.4 `CustomerTimelineContributionV1` provider

**公共声明所有者：** 总协调台。**最终聚合/排序：** 客户中心。**provider：** 各事实生产线在自身模块实现。

```ts
type CustomerTimelineEventV1 = {
  providerKey: 'customer' | 'care' | 'treatment' | 'conversation' | 'audit';
  eventId: string;
  eventTypeCode: string;
  occurredAt: string;
  customer: CustomerReferenceV1;
  source: { sourceKind: string; sourceId: string; sourceVersion: string };
  titleCode: string;
  safeSummary: string | null;
  statusCode: string | null;
  riskCode: 'normal' | 'watch' | 'urgent' | null;
  target: { targetKind: 'none' | 'care' | 'treatment'; targetId: string | null };
};

type CustomerTimelineContributionV1 = InstitutionSourceEnvelopeV1<
  {
    providerKey: CustomerTimelineEventV1['providerKey'];
    events: CustomerTimelineEventV1[];
  },
  CustomerTimelineEventV1['providerKey']
>;
```

- provider 对自身事实重新做机构、角色和对象归属校验，只输出字段白名单生成的低敏摘要。
- 客户中心以 `providerKey + sourceKind + sourceId + sourceVersion` 去重，按 `occurredAt` 倒序，再按 providerKey/eventId 稳定排序。
- 单个 provider 的普通可用性失败可形成 partial；权限或契约失败不得保留该分区旧数据，任一 scope mismatch 必须提升为顶层同名错误并清空整包 data。审计 provider 只对审计页签授权角色注册，不因客户可读而自动进入常规 timeline。
- `eventTypeCode`、`titleCode`、`statusCode`、source/target kind 等自由 code 只登记为后续总协调台受控注册表申请；本轮不新增注册表、PR 或能力。

### 8.5 `TreatmentCareSourceV1`

**公共声明所有者：** 总协调台。**provider 生产者：** 客户中心治疗模块。**消费者：** Care。

```ts
type TreatmentCareSuggestionV1 =
  | { state: 'none' }
  | {
      state: 'available';
      suggestionKey: string;
      actionCode: string;
      dueAt: string | null;
    }
  | { state: 'blocked'; reasonCode: string };

type TreatmentCareSourcePayloadV1 = {
  sourceId: string;
  sourceVersion: string;
  customer: CustomerReferenceV1;
  treatmentOccurredAt: string;
  projectRef: { projectId: string; displayName: string } | null;
  categoryCode: string | null;
  treatmentStageCode: string | null;
  recoveryStageCode: string | null;
  riskLevel: 'normal' | 'watch' | 'urgent';
  approvedTagCodes: string[];
  sourceState: 'active' | 'voided';
  suggestion: TreatmentCareSuggestionV1;
  voidedAt: string | null;
  voidReasonCode: string | null;
};

type TreatmentCareSourceV1 = InstitutionSourceEnvelopeV1<
  TreatmentCareSourcePayloadV1,
  'treatment_source'
>;
```

- project、category、treatment stage、recovery stage、risk、approved tag、action、void reason 和 suggestion reason 都来自受控目录；没有无界行动正文。
- 外层失败与 `suggestion.state = 'none'` 严格区分：none 表示来源读取成功且确定没有建议；unavailable/denied/disabled/scope mismatch 必须 `data: null`。
- `available` 只是可供 Care 重新授权和人工/规则确认的建议，不是医疗结论、自动消息或自动任务。
- 单次任务幂等身份固定为 `institutionId + sourceId + suggestionKey`；路径入组幂等身份固定为 `institutionId + sourceId + templateFamilyKey`。`sourceVersion` 只用于乐观并发/冲突校验，不能进入幂等身份。
- 路径节点稳定身份固定为 `institutionId + pathEnrollmentId + nodeKey`；重试、恢复和作废处理不得按节点数组位置重新生成身份，也不得省略机构维度或把 `sourceVersion` 加入幂等键。
- 治疗普通编辑不自动重建或取消任务，也不改变既有路径身份；只有受控新 suggestionKey 或人工操作可产生新的单次任务候选。
- 治疗作废只自动取消该来源生成的路径、该路径未完成节点和未来未发送触达。人工任务、单次任务、其他来源任务、已完成节点和已发送事实必须保留，并标记人工复核；客户中心不直写 Care 表。

### 8.6 `CreateCustomerFromIdentityReviewV1`

**公共声明所有者：** 总协调台。**命令处理者与客户创建事实所有者：** 客户中心。**复核状态所有者：** 身份复核生产线。

```ts
type Cus04CreateCustomerDtoV1 = {
  displayName: string;
  ownerUserId: string | null;
  sourceCode: string;
  projectRefs: Array<{ projectId: string }>;
  primaryProjectRef: { projectId: string } | null;
  priority: 'high' | 'medium' | 'watch';
  nextAction: {
    actionCode: string;
    plannedAt: string | null;
    safeNote: string | null;
  } | null;
};

type CreateCustomerFromIdentityReviewV1 = {
  contractVersion: 'v1';
  reviewId: string;
  expectedRevision: string;
  candidateSnapshotVersion: string;
  idempotencyKey: string;
  actionToken: string;
  createCustomer: Cus04CreateCustomerDtoV1;
};

type CreateCustomerFromIdentityReviewResultV1 =
  | { outcome: 'created'; customer: CustomerReferenceV1 }
  | {
      outcome: 'rejected';
      rejectionCode:
        | 'scope_mismatch'
        | 'role_denied'
        | 'capability_disabled'
        | 'candidate_not_found'
        | 'candidate_stale'
        | 'duplicate_customer'
        | 'invalid_low_sensitivity_input'
        | 'audit_unavailable'
        | 'persistence_unavailable'
        | 'conflict';
    };
```

- 服务端只允许 `tenant_admin`、`tenant_operator`，并重新验证当前机构、角色、`expectedRevision`、`candidateSnapshotVersion`、重复客户、完整 CUS-04 DTO、审计与持久化能力。
- `createCustomer` 必须使用已批准的完整标准 CUS-04 创建 DTO：`displayName` 是低敏名称，负责人和来源由服务端校验，项目引用来自受控目录且主项目属于项目集合，priority 只有 `high/medium/watch`，下一步行动只含受控 actionCode、计划时间和低敏说明。
- `actionToken` 必须由身份决定服务端签发，绑定当前机构/reader/review/revision/DTO 摘要且短期有效，并只在服务端编排调用客户中心命令时透传和一次性消费；不得返回浏览器内存或响应，不得进入 URL、浏览器持久化、日志或审计，客户端不能自行构造、读取或续期。
- `idempotencyKey` 由服务端按当前机构和 review 绑定并持久化；同一有效键重试返回同一创建结果或同一受控冲突，不得重复建客。
- 稳定渠道身份只由服务端从已验证 review 解析；客户端不得提交 `maskedReference` 作为创建事实或渠道身份。
- 成功只返回 `CustomerReferenceV1`；失败不返回候选内容、重复客户详情或存在性侧信道。
- 客户中心不直接修改身份复核状态。身份复核生产线根据命令结果在自身事务/补偿边界更新状态；两个事实不能伪装成跨库原子写入。

### 8.7 `AnalyticsCustomerConsumptionV1`

**公共声明所有者：** 总协调台。**provider 生产者：** 经营分析。**消费者：** 客户中心 consumption 页签。

- 公共结果别名统一为 `AnalyticsCustomerConsumptionV1 = InstitutionSourceEnvelopeV1<AnalyticsCustomerConsumptionPayloadV1, AnalyticsCustomerConsumptionPartitionKeyV1>`；客户中心直接消费，不再包装或声明额外结果类型。`AnalyticsCustomerConsumptionPartitionKeyV1` 的固定 key 集合仍由总协调台冻结，冻结前经营分析 provider 与客户消费 consumer runtime 均阻塞。
- 客户中心不读取交易/订单表，不复制金额、退款、口径、币种或归因算法。
- `tenant_admin`、`tenant_operator` 可在当前机构和目标客户范围内读取；`consultant`、`customer_service` 必须 `denied + data: null`，页签隐藏且深链接/API fail-closed。
- 缺失、partial、stale 或经营分析 provider 未发布不得显示 0；stale 只显示清晰口径版本和截止时间，不进入当前经营行动队列。
- 双向安全跳转固定为客户详情 `/hospital/customers/:customerId?view=consumption` 与分析页 `/hospital/analytics/consumption?customerId=:customerId&from=:from&to=:to`。两个目标页都必须重新校验角色、`tenantId + institutionId`、customerId 和日期范围；来源页参数不构成授权或可信口径。

### 8.8 `RestrictedCustomerKnowledgeAccessV1`

**公共声明所有者：** 总协调台。**权威分区 provider：** 客户中心、会话/任务、隐私和知识模块分别提供自身事实，公共 server reader 只组合结果。**消费入口：** 客户中心受限附件区域与获准敏感 AI。

```ts
type RestrictedCustomerKnowledgeReaderInputV1 = {
  customerId: string;
  purpose: 'attachment_read' | 'ai_read';
};

type RestrictedAttachmentRevisionSafeReferenceV1 = {
  attachmentId: string;
  revisionId: string;
  safeDisplayName: string;
};

type RestrictedCustomerKnowledgeAccessPayloadV1 = {
  attachmentRevisions: RestrictedAttachmentRevisionSafeReferenceV1[];
};

type RestrictedCustomerKnowledgeAccessV1 = InstitutionSourceEnvelopeV1<
  RestrictedCustomerKnowledgeAccessPayloadV1,
  RestrictedCustomerKnowledgePartitionKeyV1
>;
```

- 公共 reader 组合多个权威分区 provider；`RestrictedCustomerKnowledgePartitionKeyV1` 的固定 key 集合、组合 reader 所有者、敏感 AI 授权权威来源和撤回传播时限仍由总协调台冻结，冻结前相应 runtime 阻塞。客户中心不重声明或猜测 key、不自行减少必需分区，也不直读任何知识 repository/table。
- `tenant_admin`、`tenant_operator` 可按当前机构管理范围读取；`consultant`、`customer_service` 只能在客户中心内，凭服务端可验证的负责人、会话分配或任务分配关系读取目标客户附件。
- purpose 只有 `attachment_read`、`ai_read`；结果只含最小受限附件修订安全引用，不含知识发布版本字段、附件内容或授权内部事实。
- 不接受前端声明的 owner/assignment，不因能打开客户详情就自动取得附件权限；denied/scope mismatch 不返回附件修订引用。
- `ai_read` 还必须把请求约束为单一 `customerId`，并验证仍有效的敏感 AI 授权；多客户检索、无授权或授权过期均 fail-closed。
- 客户中心不复制附件内容、发布状态或知识检索逻辑；OCR、embedding、rerank 和知识 AI 仍在总协调台外部集成串行队列中。

### 8.9 `CustomerCareSummaryV1`

**公共声明所有者：** 总协调台。**provider 生产者：** Care。**消费者：** 客户中心 `appointments`、`followups` 页签。

客户中心完全消费以下冻结形状，不增减字段、不包装第二个结果类型：

```ts
type AppointmentBusinessStateV1 =
  | 'pending_confirmation'
  | 'confirmed'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'no_show';

type FollowUpTaskStateV1 =
  | 'pending'
  | 'in_progress'
  | 'waiting_customer'
  | 'escalated'
  | 'completed'
  | 'cancelled';

type CustomerCareAppointmentSummaryItemV1 = {
  appointmentId: string;
  sourceVersion: string;
  scheduledAt: string;
  businessState: AppointmentBusinessStateV1;
  rescheduleRequestState: 'pending' | null;
  safeSummary: string | null;
  detailHref: string;
};

type CustomerCareFollowUpSummaryItemV1 = {
  taskId: string;
  sourceVersion: string;
  dueAt: string;
  businessState: FollowUpTaskStateV1;
  riskLevel: 'normal' | 'watch' | 'urgent';
  safeSummary: string | null;
  detailHref: string;
};

type CustomerCareSummaryPayloadV1 = {
  customerId: string;
  appointments: {
    items: CustomerCareAppointmentSummaryItemV1[];
    hasMore: boolean;
  } | null;
  followups: {
    items: CustomerCareFollowUpSummaryItemV1[];
    hasMore: boolean;
  } | null;
};

type CustomerCareSummaryV1 = InstitutionSourceEnvelopeV1<
  CustomerCareSummaryPayloadV1,
  'appointments' | 'followups'
>;
```

- `appointments.items` 与 `followups.items` 各最多 5 条；预约固定按 `scheduledAt DESC, appointmentId ASC`，随访固定按 `dueAt DESC, taskId ASC`。`hasMore` 必须由 Care 在对应确定性排序的同一次 RBAC 查询中以固定 `limit + 1` 安全派生，不是精确总数，也不得通过额外全量统计生成。客户中心不实现抽屉内分页；`hasMore=true` 只显示“查看全部”并跳往第 5.1 节对应 canonical Care 列表。
- 对应分区为 `ready`、`empty` 或 `stale` 时字段可以非 null：`empty` 固定返回 `{ items: [], hasMore: false }`；`stale` 仅返回同一 scope 下已验证的只读快照，并展示 envelope freshness，不得驱动新建、编辑或其他写操作。分区为 `unavailable`、`denied` 或 `disabled` 时对应字段必须为 null，不把未知值显示为 0。
- 顶层 `partial` 只能在不存在 scope mismatch 时保留已验证的 `ready`、`empty` 或 `stale` 分区，另一普通失败分区保持 null；任一分区 `scope_mismatch` 必须提升为顶层同名错误并整包 `data: null`。
- 每个分区的 `items` 与 `hasMore` 必须来自同一次 Care 服务端 RBAC `limit + 1` 查询、相同 `tenantId + institutionId`、customerId、reader 数据范围、筛选和上述稳定排序，不能先读取全机构结果再在客户中心裁剪。管理员/运营仍受当前机构和 Care 权限约束；咨询师/客服的预约只限本人为 HIS 客户负责人的客户，随访只限本人具体任务及本人角色池未认领任务。
- 预约 `businessState` 只表达 HIS 预约事实，不含 `reschedule_requested`。`rescheduleRequestState='pending'` 只表示独立改约请求尚未由 HIS 原子接受；此时仍展示原预约时间和原事实状态。HIS 接受新时段后才更新 `scheduledAt/sourceVersion/businessState` 并清空该标记，完整请求历史不进入摘要 payload。
- 客户中心只展示 Care 返回的安全 item 和 canonical `detailHref`，不重算状态、风险、排序或详情链接。列表/新建 URL 由客户中心按第 5.1 节固定规则派生，目标 Care 模块重新授权；任何页签可见性都不授予创建或写入权限。
- 新建快捷入口不属于 `CustomerCareSummaryV1`。客户中心只有在 Care 服务端 write-authorizer 返回 fresh allow 后才显示：预约按当前机构 Care 权限及 HIS 客户负责人范围判断；普通手工随访仅管理员/运营。咨询师/客服不得从摘要读权限获得普通手工随访新建入口，其来源限定权限仍留在已分配且已匹配的会话。
- 预约分区在真实 HIS 预约 provider 未验收前保持 `disabled` 且 `appointments=null`；客户中心不得以旧本地预约、治疗事实、fixture 或静态 0 替代。

---

## 九、API 子树、文件锁与跨线例外

### 9.1 客户中心后续可拥有范围

```text
src/app/hospital/customers/**
src/app/api/institution/customers/**
src/modules/customer-center/**
src/modules/customer-center/tests/**
src/app/api/institution/treatment-summaries/**
```

- 治疗 API 只有在 CUS-02/CUS-03 单独授权和文件锁确认后才迁入。
- 新代码不得继续向 `CustomerCenterShell.tsx`、`CustomerTimelineDrawer.tsx`、`tenant-business-client.ts`、`tenant-business-api.ts`、`tenant-business-repository.ts` 或 `InstitutionWorkspace.tsx` 叠加栏目逻辑。
- 共享契约、security、审计核心、schema、migration、公共导航和根 layout 均不属于客户线。

### 9.2 Care 与渠道严格例外

以下路径由 Care 独占，客户中心不得修改、复制、迁移或直读其内部 repository：

```text
src/app/api/institution/appointments/**
src/app/api/institution/followups/**
src/app/api/institution/customers/[customerId]/followup-feedback/**
src/app/api/institution/customers/[customerId]/followup-overview/**
src/app/api/institution/customers/[customerId]/followup-timeline/**
src/app/api/institution/followup-message-drafts/**
```

`src/app/api/institution/customers/[customerId]/wecom-reachout-safety/**` 属于获准渠道/触达安全集成任务。provider 未就绪时显示 disabled/unavailable，不能直接读表、复制端点或假称已发送。

### 9.3 共享文件正确动作

| 共享范围 | 客户线禁止 | 正确动作 |
| --- | --- | --- |
| 根 layout/page、公共导航 | 修改路由壳和全局入口 | 向 `BASE-01A` 提交路由/标签/capability 交接申请。 |
| `src/modules/security/**` | 自行扩角色或绕 guard | 向 `BASE-02` 提交精确权限矩阵。 |
| `src/modules/institution-contracts/v1/**` | 声明或改写公共契约 | 向总协调台提交本文冻结字段和兼容测试申请。 |
| schema、`drizzle/**`、审计核心 | 页面 PR 夹带字段、迁移或审计实现 | 提交数据/审计申请，等待唯一串行队列。 |
| 其他线 repository/table | 直读或复制生产逻辑 | 申请 provider；未交付时使用受控状态。 |

---

## 十、精确角色与目标数据范围

### 10.1 页面与事实权限

| 能力 | tenant_admin | tenant_operator | consultant | customer_service | 服务端目标范围 |
| --- | --- | --- | --- | --- | --- |
| 客户列表/低敏搜索/筛选 | 允许 | 允许 | 允许 | 允许 | 当前机构且符合该角色客户列表范围；无可靠分配前不伪造“我的客户”。 |
| overview | 允许 | 允许 | 允许 | 允许 | 每次按 scope 重验对象；字段依本地 overview 白名单。 |
| 常规 timeline | 允许 | 允许 | 允许 | 允许 | 仅角色可读 provider 分区；不自动含完整审计、消费或附件。 |
| appointments 摘要 | CUS-01H 后按当前机构 Care 权限 | CUS-01H 后按当前机构 Care 权限 | 仅本人是该客户 HIS 负责人时 | 仅本人是该客户 HIS 负责人时 | 直接消费 `CustomerCareSummaryV1.appointments`；真实 HIS 预约 provider 未发布时 disabled/null。 |
| followups 摘要 | CUS-01H 后按当前机构 Care 权限 | CUS-01H 后按当前机构 Care 权限 | 仅本人具体任务及本人角色池未认领任务 | 仅本人具体任务及本人角色池未认领任务 | 直接消费 `CustomerCareSummaryV1.followups`；客户可读不扩大任务分配范围。 |
| 客户详情预约新建快捷入口 | Care write-authorizer fresh allow | Care write-authorizer fresh allow | 仅本人仍为该客户 HIS 负责人且 write-authorizer allow | 仅本人仍为该客户 HIS 负责人且 write-authorizer allow | 与摘要读取独立判定；目标 Care 再次授权并实时校验 HIS，`create=1` 不表示已创建。 |
| 客户详情普通随访新建快捷入口 | Care write-authorizer fresh allow | Care write-authorizer fresh allow | 不显示 | 不显示 | 普通手工任务仅管理员/运营；会话来源限定例外不从客户详情开放。 |
| 治疗列表/详情 | CUS-02 后允许 | CUS-02 后允许 | CUS-02 后允许 | 永久拒绝 | 当前机构、目标客户/摘要双重归属；入口隐藏和 API 拒绝一致。 |
| 治疗新建/编辑/作废 | CUS-03 后允许 | 拒绝 | 拒绝 | 拒绝 | 管理员服务端写权限、并发和审计均通过。 |
| 客户创建/编辑/低敏导入 | CUS-04/05 后允许 | CUS-04/05 后允许 | 拒绝 | 拒绝 | 当前机构；真实持久化与审计就绪。 |
| 客户归档/合并 | CUS-06 后允许 | 拒绝 | 拒绝 | 拒绝 | 管理员、可逆、关系转移和审计原子化。 |
| consumption | CUS-07 后允许 | CUS-07 后允许 | 拒绝 | 拒绝 | 只消费经营分析 provider。 |
| 受限客户附件 | 机构管理范围 | 机构管理范围 | 负责人/会话/任务分配 | 负责人/会话/任务分配 | 通过 `RestrictedCustomerKnowledgeAccessV1` 重验。 |

### 10.2 audit 页签目标范围

- `tenant_admin`：可读当前机构完整的白名单客户审计目标范围，但仍不返回请求体、搜索词、敏感原文、provider payload 或凭证。
- `tenant_operator`：只读本人操作以及其已获授权模块内的低敏客户审计事件；不能扩大为全机构完整审计。
- `consultant`、`customer_service`：audit 页签隐藏，深链接和 API `denied + data: null`。
- audit provider 必须先验证客户范围，再验证审计 detail 权限和事件白名单；常规 timeline 不复用 audit 权限做隐式扩权。

---

## 十一、从 CUS-01 开始的小 PR 执行路线

每个切片都必须基于已合并底座、单独获得 runtime 授权、重新做启动/同步能力检查并保持 3–5 个核心业务文件规模；下列清单不是自动执行许可。

### 11.1 CUS-01 客户只读闭环

| PR | 目标 | 计划文件 | 关键测试与门禁 |
| --- | --- | --- | --- |
| `CUS-01A` | 本地查询 parser、列表 DTO、`CustomerOverviewV1`、`CustomerReferenceV1` mapper；同时向总协调台提交公共声明申请。 | `src/modules/customer-center/domain/**`、定向 tests。 | 引用严格四字段；拒绝敏感搜索、未知筛选、旧自由文本下一步。 |
| `CUS-01B` | 机构隔离 list/overview read service、查询 API、生命周期 summary provider。 | 客户中心 server/read-model、query/overview/summary routes 与 tests。 | 双机构、四角色、五分区、missing/stale 不为 0；MIG-01 未就绪停止，MIG-02 缺负责人只隐藏 owner/“我的客户”。 |
| `CUS-01C` | `/hospital/customers`、顶部标签交接、低敏搜索、筛选、分页、生命周期聚合和完整状态。 | 客户列表 page、独占 components/UI tests。 | capability-off 不取数；刷新清关键词但保留结构化状态；空态与失败分离。 |
| `CUS-01D` | `/hospital/customers/:customerId` overview/timeline、桌面抽屉、移动全屏。 | 详情 page、timeline aggregate、timeline route/tests。 | provider 分区、稳定排序、partial/stale、跨机构、直接 URL。 |
| `CUS-01E` | 浏览器恢复和只读发布回归。 | 独占 e2e/route/UI tests；不新增业务能力。 | push/replace/back/forward/refresh、滚动恢复、平台角色拒绝、无敏感 URL。 |
| `CUS-01F` | audit 只读页签。 | 客户详情 audit adapter/page tests。 | 管理员全机构白名单；运营本人/授权模块；咨询师/客服 fail-closed。 |
| `CUS-01G` | 受限客户附件入口。 | 客户详情知识 adapter/page tests。 | 管理角色、负责人/会话/任务分配、单客户敏感 AI 授权；provider 未就绪 disabled。 |
| `CUS-01H` | 消费 Care 的 `CustomerCareSummaryV1`，交付 appointments/followups 各最多 5 条稳定排序的只读摘要、`hasMore`“查看全部”及列表/新建安全跳转。 | 客户详情 care-summary server adapter/API、两个页签与定向 tests；不修改 Care 或公共声明。 | Care provider 与公共声明已交付；沿用 Care RBAC，预约在真实 HIS 前 disabled；新建入口由独立 Care write-authorizer 决定且目标模块再次授权，客户中心不复制表单、分页或列表算法。 |

### 11.2 CUS-02 治疗只读

- `CUS-02A`：先交付 `/hospital/customers/treatments` 的机构隔离列表、结构化筛选、游标加载更多和角色门禁。
- `CUS-02B`：再交付 `/hospital/customers/treatments/:summaryId` 和客户详情 `view=treatments`；桌面抽屉/移动全屏复用稳定摘要 ID。
- 管理员、运营、咨询师可读；客服的导航、深链接、API 和预取全部 fail-closed。

### 11.3 CUS-03 治疗写入与 Care 来源

- `CUS-03A`：管理员新建/编辑/作废，要求机构归属、并发、审计和受控字段均就绪。
- `CUS-03B`：在治疗模块实现总协调台声明的 `TreatmentCareSourceV1` provider 和合同测试；Care 只消费 provider。
- `CUS-03C`：与 CARE-03 验证固定任务/路径幂等身份、普通编辑不自动重建/取消、作废保留事实并标记人工复核。

### 11.4 CUS-04 至 CUS-07

| 切片 | 小 PR 顺序 | 硬门禁 |
| --- | --- | --- |
| `CUS-04` 客户创建/编辑 | A：受控客户写 DTO 与 overview；B：受控下一步行动；C：`CreateCustomerFromIdentityReviewV1` 幂等命令。 | MIG-02、项目/纠正申请按需已批准；不映射旧自由文本。 |
| `CUS-05` 受控导入 | A：离线解析/预检；B：重复复核；C：获批 adapter 后真实执行。 | 导入批次真实持久化、唯一约束、逐行结果、幂等、事务、审计和外部串行队列。 |
| `CUS-06` 归档/合并 | A：只读预检；B：管理员可逆归档；C：关系转移/合并与恢复。 | 别名/合并谱系、锁、责任转交、审计和回滚原子化。 |
| `CUS-07` consumption | A：adapter/角色测试；B：页签与状态。 | 直接消费 `AnalyticsCustomerConsumptionV1`；经营分析 provider、冻结的 partition key 与口径/freshness 可用。 |

---

## 十二、测试、发布门禁与停止条件

### 12.1 后续实现测试矩阵

| 层级 | 必测内容 |
| --- | --- |
| 领域 | 查询白名单、四字段 CustomerReference、CustomerOverview 确定性、五生命周期、受控 suggestion、identity 幂等；`actionToken` 服务端绑定/过期/一次性/重放及绝不返回浏览器。 |
| repository/read service | `tenantId + institutionId` 双键、同租户双机构、分页/聚合、关联事实归属；MIG-01 缺失失败，MIG-02 缺负责人时隐藏 owner/“我的客户”。 |
| API/provider | 四角色、平台角色、任一分区 scope mismatch 整包无数据、七种 readiness、freshness/分区/failure code、`CustomerCareSummaryV1` 精确字段/预约事实与独立改约请求分离/每组最多 5 条/稳定排序/同一 RBAC `limit + 1` 派生 `hasMore`/分区 null 规则，以及无数据泄露。 |
| UI | 两个顶部页签、四条 canonical 路由、七个详情 view、桌面抽屉、移动全屏、完整状态；appointments/followups 只读摘要、`hasMore` 仅显示“查看全部”且无抽屉内分页、Care `detailHref` 与四条列表/新建安全跳转；新建入口必须由独立 fresh write-authorizer 控制，读取权限不能推导写入口。 |
| 浏览器 | 直达、刷新、push、replace、back、forward、筛选/页码/滚动恢复、关键词不持久化。 |
| 跨线 | timeline、`CustomerCareSummaryV1`、TreatmentCare、analytics、knowledge 和 identity 兼容测试；路径节点键严格为 `institutionId + pathEnrollmentId + nodeKey`；消费者不直读生产者 repository/table。 |

### 12.2 发布门禁

1. 页面、深链接、API、预取和 provider 的 capability/角色/scope 结论一致。
2. 列表、详情、生命周期、治疗、消费、审计和附件均按 `tenantId + institutionId` 及精确 reader 范围隔离。
3. `empty`、`partial`、`stale`、`unavailable`、`denied`、`disabled` 不被混淆；缺失/过期绝不转 0。
4. 任一分区 `scope_mismatch` 提升为顶层同名错误并整包 `data:null`；其他普通分区失败才允许 partial 保留已验证分区。
5. URL、浏览器存储、日志、审计和错误中没有搜索原文、联系方式、病历、消息、金额、外部 ID、payload 或凭证。
6. 客户/治疗桌面抽屉与移动全屏可从 canonical URL 恢复；静态 treatments 路由没有动态冲突。
7. CUS-01 只申请 `read_only`；`CUS-01H` 只读消费 Care 摘要，预约与随访写能力仍由 Care 独立发布；每个后续能力只在自身切片真实完成后独立发布。

### 12.3 必须停止

| 风险或条件 | 停止动作 |
| --- | --- |
| `BASE-01A/02/05`、MIG-01 或所需公共契约未就绪 | 不造临时壳、第二套 guard、另一版 envelope 或跨线直读。 |
| schema、migration、真实外部 adapter/凭证成为前置 | 只提交数据变更/集成申请，等待总协调台串行排期。 |
| 无法证明机构、角色、分配或对象归属 | fail-closed，不显示旧缓存、数量或存在性。 |
| 导入/合并缺真实持久化与审计 | 只允许预检，不表述为执行成功。 |
| Care、analytics、knowledge、identity provider 未批准 | 显示 disabled/unavailable，不读取其表或复制算法。 |
| `CustomerCareSummaryV1` 声明/provider、Care RBAC 或 `hasMore` 同查询派生未就绪 | 不实现 `CUS-01H`，appointments/followups 页签保持关闭，不以 timeline、CareAction 或旧客户 API 替代。 |
| 工作树出现本文以外改动 | 立即停止，不修复、不混入本轮。 |

---

## 十三、总协调台申请与真实阻塞

客户线进入 runtime 前，需由总协调台关闭以下事项：

1. `BASE-01A` 冻结两顶部页签、四条 canonical 路由、静态/动态匹配顺序和 capability-off 页面/API 映射。
2. 在公共 V1 目录声明统一读取 envelope，以及本文列出的 CustomerReference、生命周期 summary、timeline、CustomerCareSummary、TreatmentCare、identity、analytics consumption 和受限知识访问契约；客户线不落公共声明。
3. 明确 `MIG-01` 可证明的客户/关联机构关系，以及 `MIG-02` 的稳定客户引用、可靠负责人和 Care 基础可消费版本。
4. 决定多项目、纠正历史、别名/合并、导入批次四项数据变更申请进入唯一迁移队列的阶段；页面 PR 不夹带实现。
5. 为受控导入、渠道、HIS、ERP/POS、知识 AI 和经营报告 provider 维护唯一外部集成串行队列及验收责任。

除这些共享前置外，客户中心可以按 `CUS-01A → CUS-01G` 的小 PR 顺序继续细化；本文完成后不自动开始任何 runtime。
