# V1 知识库 feature flag / RBAC / tenant guard 计划 01

## 0. 文档元信息

- 任务编号：`ZMTG-V1-KNOWLEDGE-BASE-FEATURE-FLAG-RBAC-TENANT-GUARD-PLAN-01`。
- 中文名：V1 知识库 feature flag / RBAC / tenant guard 计划。
- 日期与时区：2026-06-11 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：V1 知识库 demo readonly UI 入口、API 接入和摘要展示合并后的正式只读入口前置计划。
- 当前基线：`main` / `origin/main` 为 `4adc79f92d6a1879ae29280306f6ad851eb02d6a`。
- 任务性质：docs-only / guard-plan-only / no runtime / no API implementation / no UI implementation。

本文档只规划知识库从 demo readonly 入口走向更正式只读入口前，UI / API 必须具备的 feature flag、tenant guard 和 RBAC guard 边界。

本文档不是 UI 开发许可，不是 API 开发许可，不是 runtime 开发许可，也不是 schema / migration / repository / service 开发许可。后续切片建议、候选字段、验收项和风险提示均不构成本轮实现授权。

## 1. 当前已具备能力

当前 `main` 已具备以下知识库前置能力：

- 知识库 readonly boundary、catalog、version / visibility、audit、governance domain 能力。
- 知识库 demo source contract。
- 知识库 demo readonly facade。
- 知识库 demo readonly API contract。
- 知识库 demo readonly API route：`GET /api/v1/knowledge-base/demo-readonly`。
- 机构工作台中的知识库 demo readonly UI 入口、API 调用和低敏摘要展示。

当前能力仍是受控 demo 链路，不代表正式知识库只读入口已经具备生产级 guard。当前仍未进入：

- 正式知识库 feature flag runtime。
- 正式 RBAC runtime。
- 正式 tenant guard runtime。
- 真实知识库 DB / schema / migration。
- 正式 service / repository / adapter。
- 上传、文档解析、文档分块、embedding、向量索引或检索 runtime。
- AI 使用知识 runtime。
- 真实 HIS、credential、真实客户数据或真实模型。

## 2. 本计划范围与明确非目标

本计划只新增一份 `docs/product/plans/**` 下的计划文档。

本计划明确不做：

- 不修改 `src/**`。
- 不修改 tests。
- 不实现 feature flag runtime。
- 不实现 RBAC runtime。
- 不实现 tenant guard runtime。
- 不新增或修改 API route。
- 不修改 UI 组件。
- 不新增页面。
- 不接 DB。
- 不新增 schema / migration / SQL。
- 不实现 service / repository / DTO / adapter。
- 不实现上传、解析、分块、embedding、向量索引或检索 runtime。
- 不实现 AI 使用知识 runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不接真实模型。
- 不写日志。
- 不自动营销、触达、创建任务、预约、成交。
- 不做支付、合同或发票。
- 不启动 dev server。

如后续进入 UI、API、runtime、schema、migration、service、repository、adapter、RBAC、feature flag provider、tenant access-control 或测试实现，必须另开单独任务，并重新声明允许文件、禁止文件、验证命令和回滚边界。

## 3. Guard 总原则

正式知识库只读入口不得只依赖前端隐藏入口或 demo route 自身约定。未来 UI / API 必须按以下顺序收口：

1. Feature flag：默认关闭，只允许按 tenant 或明确演示环境灰度开启。
2. Tenant guard：从可信 access context 获取当前 tenant / institution / workspace，不接受客户端传入的可信 tenant。
3. RBAC guard：确认当前 actor 具备对应知识库只读权限。
4. Visibility guard：确认知识库条目、目录、版本和 searchPreview 均在当前 actor 可见范围内。
5. Response whitelist：只返回低敏 readonly summary 字段，不返回正文、raw payload 或可执行动作。
6. Action guard：只读入口不得返回 mutation 指令，不得渲染上传、编辑、删除、发布、下架、回滚、创建任务、预约、触达、营销、成交、支付、合同或发票入口。

Guard 必须服务端成立。UI 可以做提示、隐藏和安全兜底，但不能替代 API / route / service 的 feature flag、tenant、RBAC 和字段白名单判断。

## 4. Feature flag 计划

未来 feature flag candidate：

| feature flag candidate | 控制范围 | 默认状态 | 开启方式 | 关闭后行为 |
| --- | --- | --- | --- | --- |
| `v1KnowledgeBaseReadonlyEnabled` | 正式知识库只读入口、只读目录、版本、可见范围、审计摘要和低敏治理总览。 | 默认关闭。 | 只能按 tenant / institution / workspace 明确灰度开启。 | UI 不展示正式入口；API 返回低敏 disabled 或安全空态，不返回知识摘要。 |
| `v1KnowledgeBaseDemoReadonlyEnabled` | 现有 demo readonly 入口和 mock / seed / demo 展示链路。 | 默认可在演示环境开启，生产默认关闭。 | 仅限 demo tenant 或受控演示 workspace。 | 回到 demo 不可用态，不回退展示真实数据。 |
| `v1KnowledgeBaseSearchPreviewEnabled` | `searchPreview` 低敏预览。 | 默认关闭。 | 只能在 readonly 主 flag 已开启且 RBAC 通过后开启。 | 不返回 searchPreview results，不做真实检索。 |

Feature flag 规则：

- 默认关闭，不允许正式知识库入口全量默认开启。
- 不允许通过 query string、header、cookie、localStorage 或客户端状态开启正式能力。
- 不允许 feature flag 替代 tenant guard。
- 不允许 feature flag 替代 RBAC guard。
- 不允许 demo flag 读取真实知识库数据。
- 不允许关闭后保留 stale 知识摘要、缓存数量或历史候选明细。
- 不允许关闭后降级暴露 mock / seed / demo 以外的真实 tenant 数据。
- Feature disabled 时，UI 可以显示低敏不可用态，API 可以返回 `disabled`，但不得返回知识条目、目录、版本、来源、审计或 searchPreview 详情。

当前不新增配置，不新增环境变量，不新增 feature flag provider，不实现 flag 读取。

## 5. Tenant guard 计划

Tenant guard 是正式知识库只读入口的硬门槛。正式 UI / API 不得信任前端传入的 `tenantId`、`institutionId` 或 `workspaceId`。

| 场景 | 必须行为 | 禁止行为 |
| --- | --- | --- |
| tenant matched | 在 feature flag enabled 且 RBAC 通过后，才允许继续读取低敏只读摘要。 | 不得跳过 RBAC、visibility 或字段白名单。 |
| tenant mismatch | 返回低敏拒绝态，例如 `tenant_scope_mismatch`。 | 不返回知识条目、目录、数量、来源、审计或对象存在性。 |
| tenant missing | 返回未授权或低敏拒绝态。 | 不猜测 tenant，不使用默认 tenant，不返回全局知识。 |
| institution mismatch | 拒绝机构知识库读取，只可返回低敏拒绝态。 | 不提示目标机构是否存在，不返回机构知识摘要。 |
| workspace mismatch | 拒绝 workspace 级可见范围读取。 | 不回退到 tenant 全局知识，不返回 workspace 范围外内容。 |
| platform viewer 读取平台知识库 | 必须明确 viewer scope 和平台角色。 | 不允许机构角色借平台知识库入口读取平台管理视图。 |
| institution viewer 读取平台授权知识 | 只允许授权范围内低敏摘要。 | 不返回平台内部审核、适用租户配置或未发布内容。 |
| demo tenant | 必须显式标记 mock / seed / demo。 | 不冒充生产，不混入真实 tenant。 |

Tenant mismatch 响应边界：

- 可以返回 `status: "denied"`。
- 可以返回 `reasonCode: "tenant_scope_mismatch"`。
- 可以返回低敏拒绝文案。
- 不返回 `knowledgeItems`、`folders`、`categories`、`taskRecords` 或 `searchPreview.results`。
- 不返回对象数量、版本号、目录路径、来源摘要、审计轨迹或对象是否存在。

当前不实现 tenant guard runtime，不修改 access-control，不修改 service / repository。

## 6. RBAC guard 计划

RBAC guard 不能被 UI 状态替代，也不能被 demo route 的静态 policy 替代。正式知识库只读入口至少需要区分平台、机构和 workspace 角色。

未来权限 candidate：

| 权限 candidate | 适用范围 | 允许行为 | 禁止行为 |
| --- | --- | --- | --- |
| `knowledgeBase.readonly.view` | 机构工作台正式只读入口。 | 读取低敏摘要、目录、版本状态、可见范围摘要。 | 编辑、上传、发布、下架、删除、回滚、真实检索。 |
| `knowledgeBase.platformReadonly.view` | 平台知识库只读治理入口。 | 查看平台知识库低敏治理摘要。 | 查看机构私有知识、跨租户机构知识、未授权租户范围。 |
| `knowledgeBase.institutionReadonly.view` | 机构知识库只读治理入口。 | 查看当前机构内授权知识摘要。 | 查看其他机构知识或平台内部审核明细。 |
| `knowledgeBase.auditReadonly.view` | 审计与来源追踪摘要。 | 查看低敏审计摘要、来源摘要、状态汇总。 | 查看 raw audit payload、SQL、stack、credential、完整操作备注。 |
| `knowledgeBase.searchPreview.view` | mock / demo 或后续低敏检索预览。 | 查看低敏 searchPreview。 | 触发真实 embedding、向量检索、模型调用或返回原文。 |

RBAC denied 响应边界：

- 可以返回 `status: "denied"`。
- 可以返回 `reasonCode: "permission_denied"`。
- 可以返回低敏拒绝文案。
- `categories`、`folders`、`knowledgeItems`、`taskRecords`、`searchPreview.results` 必须为空。
- 不返回知识条目数量、目录数量、来源对象、版本号、审核状态、可见范围或对象存在性。
- 不返回任何下钻 URL、action code、mutation hint 或管理入口。

RBAC 规则：

- 只读权限不等于编辑权限。
- 目录只读权限不等于知识条目详情权限。
- 平台知识库权限不等于机构知识库权限。
- 机构知识库权限不等于跨机构读取权限。
- 审计摘要权限不等于 raw audit payload 权限。
- Search preview 权限不等于真实检索权限。

当前不实现 RBAC runtime，不新增 permission enum，不修改角色模型，不接 access-control。

## 7. Visibility guard 计划

知识库比普通 dashboard 摘要多一个可见范围层。即使 feature flag、tenant 和 RBAC 均通过，也必须执行 visibility guard。

Visibility guard candidate：

| 可见范围 | 允许展示 | 禁止展示 |
| --- | --- | --- |
| `platform_public` | 授权 tenant 可见的平台低敏知识摘要。 | 平台内部审核备注、未发布版本、适用租户配置明细。 |
| `specified_tenant` | 当前 tenant 被授权的低敏摘要。 | 其他 tenant 授权情况。 |
| `specified_institution` | 当前 institution 被授权的低敏摘要。 | 其他机构知识、其他机构目录。 |
| `institution_private` | 当前机构授权角色可见的低敏摘要。 | 平台角色以机构入口读取私有内容，或其他机构读取。 |
| `workspace_private` | 当前 workspace 授权角色可见的低敏摘要。 | 同 tenant 其他 workspace 内容。 |
| `review_only` | 仅审核角色可见的低敏审核摘要。 | 普通只读用户查看审核中内容。 |
| `retired` / `archived` | 只展示下架或归档状态摘要。 | 当作可用知识、进入 searchPreview 或 AI 引用。 |

Visibility denied 时，不得把对象移到普通 empty 列表来暗示数量变化。正式 API 应使用低敏拒绝态或过滤后只返回当前 actor 可见范围内的摘要，并避免泄露不可见对象存在性。

当前不实现 visibility runtime，不修改既有 domain contract。

## 8. API guard 生效点计划

未来正式 API route 不应直接复用 demo route 的静态输入。正式 API 需要在服务端完成以下生效点：

1. 从可信 session / access context 获取 actor、tenant、institution、workspace 和 role。
2. 读取 feature flag，并确认正式只读能力是否开启。
3. 执行 tenant / institution / workspace guard。
4. 执行 RBAC guard。
5. 执行 visibility guard。
6. 调用 readonly assembler 或 view model，且仅传入已授权的低敏输入。
7. 执行 response whitelist。
8. 返回低敏状态，不暴露 raw error、SQL、stack、worker、依赖错误或外部系统错误。

API 状态边界：

| 状态 | 候选 reasonCode | 候选响应 | 禁止返回 |
| --- | --- | --- | --- |
| feature disabled | `feature_flag_disabled` | `disabled` / safe empty | 知识条目、目录、数量、searchPreview。 |
| tenant mismatch | `tenant_scope_mismatch` | `denied` | 跨租户对象存在性、版本、来源摘要。 |
| RBAC denied | `permission_denied` | `denied` | 候选数量、目录路径、条目标题、来源对象。 |
| visibility denied | `visibility_scope_denied` | `denied` 或过滤后低敏摘要 | 不可见条目、不可见目录、不可见版本。 |
| empty | `knowledge_base_empty` | stable empty | 误导为真实知识库已完整配置。 |
| source missing | `source_missing` | low-sensitive unavailable | raw source、SQL、stack、worker、路径。 |
| stale | `state_stale` | readonly stale | 可执行刷新以外的业务动作。 |
| ready | `ready` | readonly summary | mutation action、上传、编辑、真实检索或 AI 调用。 |

当前不新增 API、route、service、repository、DTO，不实现 runtime 权限校验。

## 9. UI guard 生效点计划

未来正式 UI 不得仅以“demo readonly”文案作为安全边界。UI 必须跟随服务端 guard 状态展示低敏结果。

UI guard 计划：

- feature disabled：不展示正式入口，或展示低敏“能力未开启”态。
- tenant mismatch：只展示低敏拒绝态，不展示列表、数量、目录路径或下钻。
- RBAC denied：只展示低敏拒绝态，不展示知识条目存在性。
- visibility denied：只展示当前 actor 可见范围内摘要；不可见知识不得出现占位卡片。
- source missing：显示产品化低敏不可用文案，不展示技术错误。
- stale：显示可能过期提示，不触发刷新以外的业务动作。
- ready：只展示低敏 readonly summary，不出现写按钮。

UI 禁止事项：

- 不出现上传、编辑、删除、发布、下架、回滚、导入、解析、分块、训练、检索运行时或 AI 使用知识入口。
- 不出现“创建任务”“预约”“触达”“营销”“成交”“支付”“合同”“发票”等按钮或菜单动作。
- 不展示真实客户姓名、完整手机号、身份证、病历、订单、支付、合同、发票、HIS credential、模型输出、embedding、vector 或真实检索结果。
- 不把 mock / seed / demo 数据包装成生产知识库。
- 不把 searchPreview 写成真实检索。

当前不修改 UI，不启动 dev server，不打开系统预览。

## 10. Response whitelist 计划

正式知识库只读 response 只能返回低敏 readonly summary。以下字段可作为候选白名单，具体 contract 必须在后续 API / domain 任务中另行锁定。

可候选返回：

- `requestId`
- `status`
- `reasonCode`
- `tenantId` 的低敏 demo / internal 标记，正式生产响应应谨慎展示。
- `institutionId` 的低敏 demo / internal 标记，正式生产响应应谨慎展示。
- `workspaceId` 的低敏 demo / internal 标记，正式生产响应应谨慎展示。
- `summary`
- `categories`
- `folders`
- `knowledgeItems`
- `taskRecords`
- `searchPreview`
- `riskFlags`
- `recommendedReadonlyActions`

白名单字段也必须受 guard 状态约束。字段在白名单内，不代表 denied / disabled / visibility denied 状态可以返回详情。

禁止返回：

- 知识正文。
- 上传文件内容。
- 文档解析全文。
- 文档分块内容。
- embedding、向量、索引内部字段。
- 真实检索召回原文。
- AI prompt / completion / 模型推理细节或模型输出。
- 真实客户姓名、完整联系方式、身份证、地址、病历正文、诊断正文、治疗记录原文、咨询记录全文。
- 订单、支付、合同、发票、回款或成交金额。
- HIS raw payload、credential、API Key、Token、OAuth secret、Webhook secret。
- 数据库连接串、SQL、stack、worker、文件路径、依赖错误。
- 任何 mutation action code 或外部触达 payload。

## 11. 审计与错误边界计划

正式只读入口后续若需要审计，也必须保持低敏：

- 可以审计 feature disabled、tenant mismatch、RBAC denied、visibility denied、source missing、stale、ready view。
- 审计只记录低敏 reason code、resource 类型、actor role、tenant scope、resultCode 和时间。
- 不记录知识正文、raw payload、credential、完整错误、SQL、stack、客户高敏字段或模型输出。
- 审计失败不得阻断低敏拒绝态返回，也不得降级暴露敏感错误。

错误文案必须产品化：

- 不展示技术栈。
- 不展示文件路径。
- 不展示 worker、依赖错误或外部系统原文。
- 不展示 DB URL、SQL、token、secret。
- 不提示跨租户对象是否存在。

当前不实现审计 runtime，不新增 audit enum，不修改 audit repository。

## 12. 后续最小切片建议

### 12.1 Guard contract docs / test-plan-only

目标：

- 把正式知识库只读入口的 feature flag、tenant、RBAC、visibility、response whitelist 测试断言收口。
- 不修改 `src/**`。
- 不实现测试代码。

### 12.2 Domain-only guard contract

目标：

- 定义纯 domain guard input / output contract。
- 覆盖 disabled、tenant mismatch、RBAC denied、visibility denied、empty、source missing、stale、ready。
- 不接 API、不接 UI、不接 DB。

### 12.3 API contract guard mapper

目标：

- 把 domain guard result 映射为低敏 API contract response。
- 明确 denied / disabled / visibility denied 不返回对象详情。
- 不创建真实 API route。

### 12.4 API route guard 接入

目标：

- 在已有或后续正式 route 层接入 feature flag、tenant、RBAC、visibility guard。
- 只读 GET，不做 mutation。
- 必须单独授权。

### 12.5 UI guard 接入

目标：

- UI 只消费服务端 guard 后的低敏响应。
- 展示 disabled / denied / visibility denied / empty / source missing / stale / ready 状态。
- 不渲染任何写入或外部动作控件。
- 必须单独授权。

## 13. 验收检查清单

后续正式只读入口 PR 至少需要逐项回答：

- Feature flag 是否默认关闭。
- Feature disabled 是否不返回知识摘要。
- Tenant mismatch 是否不泄露对象存在性。
- RBAC denied 是否不返回目录、条目、数量或来源摘要。
- Visibility denied 是否不展示不可见知识。
- Response whitelist 是否只包含低敏字段。
- Error copy 是否不暴露技术栈、路径、worker、依赖错误、SQL 或 credential。
- UI 是否没有上传、编辑、删除、发布、下架、回滚按钮。
- UI / API 是否不触发任务、预约、触达、营销、成交、支付、合同或发票。
- Search preview 是否仍只是 mock / demo 或低敏预览，不做真实 embedding、向量检索或模型调用。
- 是否没有接真实 HIS、credential、真实客户数据或真实模型。

## 14. Go / No-Go

| 类型 | 结论 | 规则 |
| --- | --- | --- |
| docs-only guard plan | GO | 可以继续补充计划和验收边界。 |
| test-plan-only | GO | 可定义测试断言，不实现测试代码。 |
| domain-only guard contract | CONDITIONAL-GO | 必须单独授权，且只做纯函数、纯 domain、tests。 |
| API contract mapper | CONDITIONAL-GO | 必须单独授权，不创建真实 route。 |
| UI guard 接入 | NO-GO without approval | 必须单独授权，不得夹带 API / runtime。 |
| API route guard 接入 | NO-GO without approval | 必须单独授权，不得夹带 DB / service / repository 扩展。 |
| DB / schema / migration | NO-GO | 必须单独审批。 |
| 上传 / 解析 / 分块 / embedding / 检索 / RAG | NO-GO | 必须在正式 guard、权限、审计和低敏边界之后另行规划。 |
| 真实 HIS / credential / 客户数据 / 模型 | NO-GO | 当前不得接入。 |

## 15. 本计划结论

知识库 demo readonly 入口已经可以证明 mock / seed / demo 链路可被 UI 消费，但它不能直接升级为正式知识库只读入口。正式入口前必须先完成 feature flag、tenant guard、RBAC guard、visibility guard 和 response whitelist 的计划与后续最小 contract。

下一步最小安全动作建议是 test-plan-only 或 domain-only guard contract。任何 UI / API / runtime 接入都必须在新的当前任务中单独授权。
