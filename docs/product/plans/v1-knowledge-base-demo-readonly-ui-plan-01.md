# V1 知识库 demo readonly UI 入口计划 01

## 0. 文档元信息

- 任务编号：ZMTG-V1-KNOWLEDGE-BASE-DEMO-READONLY-UI-PLAN-01。
- 中文名：V1 知识库 demo readonly UI 入口计划。
- 日期与时区：2026-06-11 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：V1 知识库 demo readonly API route 合并后的 UI 接入前计划。
- 当前基线：`main` / `origin/main` 为 `a0c04a9902464c2fd005bf1ed42aab5c839c1943`。
- 任务性质：docs-only / UI-plan-only / no UI implementation / no runtime / Draft PR only。

本文档只定义后续 V1 知识库 demo readonly UI 入口的产品和技术边界，不实现 UI，不修改组件，不新增页面，不接 DB，不新增 schema / migration，不实现 runtime service / repository / adapter。

本文档不是 UI 开发许可，不是 runtime 开发许可，也不是 DB / schema / migration 开发许可。后续切片建议、候选入口、测试范围和验收项均不构成本轮实现授权。

## 1. 当前已完成能力

当前 `main` 已具备以下知识库 demo readonly 前置能力：

- V1 知识库 demo source contract。
- V1 知识库 demo readonly facade。
- V1 知识库 demo readonly API contract。
- V1 知识库 demo readonly API route：`GET /api/v1/knowledge-base/demo-readonly`。

当前仍未进入：

- UI 实现。
- DB / schema / migration。
- runtime service / repository / adapter。
- 上传 / 解析 / 分块 / embedding / 向量索引 / 检索 runtime。
- 真实 HIS / credential / 客户数据 / 模型。

## 2. 本轮范围与明确非目标

本轮只新增一份 `docs/product/plans/**` 下的计划文档。

本轮明确不做：

- 不修改 `src/**`。
- 不修改 tests。
- 不实现 UI。
- 不新增页面。
- 不修改组件。
- 不新增 API route。
- 不修改现有 API route。
- 不接 DB。
- 不写 SQL。
- 不新增 schema / migration。
- 不实现 runtime service / repository / adapter。
- 不实现上传、文档解析、文档分块、embedding、向量索引或检索 runtime。
- 不实现 AI 使用知识 runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不接真实模型。
- 不写日志。
- 不自动营销、触达、创建任务、预约或成交。
- 不做支付、合同或发票。

如后续 UI 接入需要页面、组件、路由、状态管理、fetch、loading / error / empty、权限判断、视觉样式或测试，必须另开单独 PR，并在新任务中重新声明允许文件、禁止文件、验证命令和回滚边界。

## 3. UI 入口建议

### 3.1 推荐入口

首个 UI 入口建议放在机构工作台 / dashboard 的 demo 区域，以“知识库 demo readonly”作为只读预览入口。

推荐路径：

- 入口位置：机构工作台或 dashboard 的受控 demo 区域。
- 入口性质：低敏只读预览入口。
- 数据来源：仅调用 `GET /api/v1/knowledge-base/demo-readonly`。
- 展示口径：只展示该 API response 中的 mock / seed / demo 数据。

选择机构工作台 / dashboard 的原因：

- 当前知识库 demo readonly route 使用机构视角的 `tenantId`、`institutionId`、`workspaceId` 和 `viewerScope: "institution"`。
- 后续 UI 可以作为演示链路的“知识库数据已可只读装配”入口，而不承诺真实知识库管理、上传、解析或检索能力。
- 对机构运营负责人来说，知识库只读总览更适合作为 dashboard 中的治理提示，而不是作为完整知识库产品页面。

### 3.2 是否需要新增页面

最小 UI 切片不建议新增完整知识库管理页面。

推荐顺序：

1. 先在现有机构工作台 / dashboard 增加一个只读入口卡片或轻量 section。
2. 卡片内展示 summary、status、categories、folders 和 searchPreview 的最小摘要。
3. 如果后续需要详情，再单独评估是否新增只读详情页或抽屉。

不建议在首个 UI 切片中新增完整页面的原因：

- 当前能力只证明 demo readonly contract 可被 API / UI 消费，不代表知识库管理、上传、解析、检索或 AI 使用知识已 ready。
- 完整页面容易被误解为知识库产品已可真实使用。
- 首个 UI 切片应优先证明入口、安全文案、loading / error / empty 和低敏字段白名单。

### 3.3 平台侧入口候选

平台侧可以作为后续候选入口，但不建议作为首个 UI 切片：

- 可候选放在平台演示治理或 demo readiness 区域。
- 仅展示平台知识库与机构知识库 demo readonly 的低敏概览。
- 不展示跨机构真实数据，不提供租户级真实知识库管理能力。

## 4. 只读展示范围

未来 UI 只能展示 `v1-knowledge-base-demo-readonly-api-contract` response 中的低敏字段。字段必须使用 camelCase，不得新增未审查字段。

### 4.1 可展示字段

可展示为页面或卡片摘要的字段：

| 字段 | 展示建议 | 边界 |
| --- | --- | --- |
| `requestId` | 可在调试态或低敏追踪区域展示。 | 不作为真实审计 ID。 |
| `tenantId` | 可在内部 demo 标记中展示。 | 只能是 demo tenant，不得展示真实租户敏感信息。 |
| `institutionId` | 可在内部 demo 标记中展示。 | 只能是 demo institution。 |
| `workspaceId` | 可在内部 demo 标记中展示。 | 只能是 demo workspace。 |
| `status` | 主状态。 | 仅说明 readonly demo 状态。 |
| `summary.title` | 卡片标题。 | 不写成真实知识库管理能力已完成。 |
| `summary.statusText` | 状态说明。 | 不暴露技术栈或错误详情。 |
| `summary.description` | 低敏说明。 | 只解释只读 demo contract 状态。 |
| `categories` | 平台知识库 / 机构知识库摘要。 | 只展示计数和低敏 summary。 |
| `folders` | 目录总览与可见范围摘要。 | 不展示真实目录文件或客户资料。 |
| `knowledgeItems` | 发布状态、版本、审计总览。 | 不展示知识正文、文档原文或解析结果。 |
| `taskRecords` | route / facade 装配状态。 | 失败原因必须是产品化低敏文案。 |
| `searchPreview` | mock / demo 检索预览。 | 不做真实检索，不展示 embedding、向量或模型结果。 |
| `facade` | facade 低敏快照。 | 只展示 status、facadeStatus、governanceSummary、demoSourceSummary。 |
| `riskFlags` | 风险标记摘要。 | 仅内部参考，不作为真实风控结论。 |
| `recommendedReadonlyActions` | 只读提示。 | 只能是 `_readonly` 类提示，不触发动作。 |

### 4.2 必须保持低敏的字段

以下字段即使展示，也必须保持低敏摘要，不得展开为真实对象明细：

- `tenantId`
- `institutionId`
- `workspaceId`
- `categories[].summary`
- `folders[].summary`
- `knowledgeItems[].summary`
- `taskRecords[].failureReason`
- `searchPreview.results[].snippet`
- `facade.governanceSummary`
- `facade.demoSourceSummary`
- `riskFlags`
- `recommendedReadonlyActions`

### 4.3 禁止展示字段或内容

未来 UI 不得展示以下内容：

- 真实客户姓名。
- 完整手机号、完整联系方式、身份证号、地址。
- 病历正文、诊断正文、治疗记录原文、咨询记录全文。
- 订单、支付、合同、发票、回款或成交金额。
- 真实 HIS credential、API Key、Token、OAuth secret、Webhook secret。
- 真实 HIS raw payload、外部系统请求 / 响应正文。
- 数据库连接串、SQL、stack、worker、文件路径、依赖错误。
- AI prompt、completion、模型推理细节或模型输出。
- embedding、向量索引、真实检索召回结果。
- 上传文件、文档解析结果、文档分块内容。
- 任何可执行 mutation 指令、自动任务、预约、触达、营销、成交、支付、合同或发票入口。

## 5. 用户可见信息边界

UI 必须明确告诉用户当前是 demo readonly 预览，不得把 demo 数据包装成生产知识库。

用户可见内容必须满足：

- 只展示 mock / seed / demo 数据。
- 不展示真实客户数据。
- 不展示 credential。
- 不展示原始 HIS 数据。
- 不展示模型推理细节。
- 不展示真实模型输出。
- 不展示真实知识文档正文。
- 不展示真实检索结果。
- 不展示任何会触发写入或外部动作的控件。

推荐文案方向：

- “知识库 demo readonly 预览”
- “当前仅展示 mock / seed / demo 只读数据”
- “该预览不接真实 HIS、不读取 credential、不使用真实客户数据”
- “searchPreview 为 mock / demo 预览，不代表真实检索”
- “推荐动作仅为只读提示，不会创建任务、预约、触达、营销、成交、支付、合同或发票”

避免文案：

- “知识库已接入真实文档”
- “已完成 AI 知识问答”
- “已完成向量检索”
- “自动生成营销任务”
- “自动触达客户”
- “已同步 HIS 知识库”
- “真实客户知识画像”

## 6. 后续 UI 实现切片建议

### 6.1 切片一：最小 UI 壳层

目标：

- 在机构工作台 / dashboard demo 区域增加一个知识库 demo readonly 入口卡片或轻量 section。
- 展示固定标题、demo readonly 标记和低敏边界文案。
- 不调用 API，不展示详情，不新增完整页面。

验收候选：

- 页面不出现写按钮。
- 页面不出现真实客户、HIS、credential、模型、支付、合同、发票等内容。
- 页面文案明确是 demo readonly。

### 6.2 切片二：API 调用与 loading / error / empty 状态

目标：

- 调用 `GET /api/v1/knowledge-base/demo-readonly`。
- 处理 loading、error、empty、disabled、denied、partial、stale、ready 等状态。
- error 文案必须产品化低敏，不展示 stack、路径、worker、依赖错误或网络原文。

验收候选：

- loading 不闪现敏感字段。
- error 只显示低敏文案。
- empty / disabled / denied 不泄露对象存在性。
- ready 只展示 contract 白名单字段。

### 6.3 切片三：只读详情或摘要卡片

目标：

- 展示 `summary`、`categories`、`folders`、`knowledgeItems`、`taskRecords`、`searchPreview` 的低敏摘要。
- 详情可以使用卡片、只读列表或抽屉，但不得出现编辑、上传、解析、检索运行时或 AI 使用知识入口。

验收候选：

- `searchPreview.mode` 明确为 `mock_demo_preview`。
- `searchPreview.results[].sourceKind` 只允许 `demo` / `seed`。
- `taskRecords[].failureReason` 不含技术栈、文件路径、worker 或依赖错误。
- `recommendedReadonlyActions` 只渲染为只读提示，不渲染为按钮或菜单动作。

### 6.4 切片四：后续可选测试范围

后续 UI PR 可选测试范围：

- route fetch mock 或 MSW 等价 mock，确认只请求 `GET /api/v1/knowledge-base/demo-readonly`。
- loading / error / empty / ready 状态渲染。
- 字段白名单测试：页面不渲染真实客户、HIS、credential、模型、支付、合同、发票、embedding、vector、retrieval。
- 行为测试：页面没有上传、编辑、删除、创建任务、预约、触达、营销、成交、支付、合同或发票按钮。
- smoke 测试：机构工作台入口可见且只读。

上述测试建议不授权本任务实现测试。本任务只形成计划。

## 7. 强制禁止事项

后续任何 UI 入口实现前，必须继续遵守以下禁止事项：

- 不在本计划 PR 中做代码实现。
- 不在本计划 PR 中修改 UI 文件。
- 不接 DB。
- 不做 schema / migration。
- 不做 runtime service / repository / adapter。
- 不做上传。
- 不做文档解析。
- 不做文档分块。
- 不做 embedding。
- 不做向量索引。
- 不做真实检索 runtime。
- 不做 AI 使用知识 runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不接真实模型。
- 不写日志。
- 不自动营销、触达、创建任务、预约或成交。
- 不做支付、合同或发票。

## 8. 后续任务拆分建议

后续如果进入 UI 实现，建议拆成小 PR：

| 切片 | 建议任务 | 允许范围候选 | 禁止扩大 |
| --- | --- | --- | --- |
| UI 壳层 | V1 知识库 demo readonly UI shell | 机构工作台 / dashboard 小范围组件与测试。 | 不接 API，不新增 route。 |
| API 接入 | V1 知识库 demo readonly UI fetch | 只调用现有 GET route，增加 loading / error / empty。 | 不接 DB，不新增 runtime。 |
| 摘要展示 | V1 知识库 demo readonly summary cards | 展示 contract 白名单字段。 | 不展示真实知识正文，不做检索。 |
| 安全测试 | V1 知识库 demo readonly UI guard tests | 低敏字段、只读动作、敏感词排除。 | 不修复无关 UI 测试。 |

## 9. 计划验收清单

本计划文档完成后，应满足：

- 已明确 UI 入口建议。
- 已说明最小切片不建议新增完整页面。
- 已明确只展示 demo readonly API response 的低敏字段。
- 已列出必须保持低敏的字段。
- 已列出禁止展示的字段和内容。
- 已明确只展示 mock / seed / demo 数据。
- 已明确不展示真实客户数据、credential、原始 HIS 数据和模型推理细节。
- 已给出后续 UI 实现切片建议。
- 已列出强制禁止事项。
- 未修改 `src/**`。
- 未修改 UI 文件。
- 未新增测试。
- 未接 DB / schema / migration / runtime service / repository / adapter。
