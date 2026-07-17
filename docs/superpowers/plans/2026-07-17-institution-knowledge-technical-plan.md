# 机构端知识库技术计划

> 本文是 `PLAN-KB-REV-02` 的第二轮 docs-only 规划契约修订，不是 runtime、schema、migration、provider、外部集成、提交或发布授权。后续每个 `KB-*` 切片都必须重新取得任务编号、允许文件、数据影响、验证命令和停止条件的明确授权。

**目标：** 以真实、持久化、可解释且按机构隔离的知识条目列表与详情为第一发布能力；在此基础上依次建设“结构化正文 + 附件”的不可变版本、原子 publication、真实解析与索引、真实混合检索、可复核问答引用、受限客户附件和知识专属额度。任何 AI、OCR、索引或额度故障都不能破坏已发布安全内容的只读浏览。

**架构方案：** canonical 业务对象是知识条目，不是文件库。知识条目的正文修订、附件修订和元数据共同冻结为不可变版本；publication 只原子移动当前指针。跨线消费者只通过总协调台声明的 `v1` 公共契约和服务端 reader 读取当前 publication，不得读取知识库 repository/table。受限客户附件使用独立存储、索引、权限和授权域，不进入机构通用知识召回。

**技术边界：** 目标技术仍基于 Next.js、React、TypeScript、Vitest、Drizzle 和 PostgreSQL；本文只描述后续实现契约，不修改或批准任何源码、数据库、API、测试、配置、脚本、worker、scheduler、凭证或外部网络。

---

## 一、任务边界与第二轮启动检查

- 日期 / 时区：`2026-07-17 CST`。
- 当前阶段：机构端七线并行开发规划的知识库线第二轮契约返修，任务编号 `PLAN-KB-REV-02`。
- 本轮不是：`KB-01` 或后续 `KB-*` runtime；不是 schema/migration、OCR/AI/provider、外部网络、数据库访问、提交、推送、PR、合并或继续 runtime 的许可。
- 当前分支：detached `HEAD`。
- 当前 `HEAD`：`e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa`。
- 当前 `origin/main`：`e7450909b794c5dfa54e07e2fd878bdd2ab8b7aa`。
- 第二轮启动时 `git status --short`：仅有 `?? docs/superpowers/plans/2026-07-17-institution-knowledge-technical-plan.md`，即第一轮新增且本轮唯一允许修改的文件。
- 本轮遵守 [机构端七线并行开发总计划](2026-07-17-institution-seven-stream-development-plan.md) 与 [机构端导航与页面系统产品设计](../specs/2026-07-15-institution-navigation-page-system-design.md)。

`src/modules/knowledge-base/**`、平台端知识管理、`src/modules/security/**`、公共审计、`src/server/db/schema.ts`、`drizzle/**`、公共路由壳和 `InstitutionWorkspace.tsx` 均是保护区或共享热点。知识库线只能提出跨端、公共契约、权限、审计、schema/migration 和 provider 申请，不能在栏目 PR 中直接修改。

## 二、当前实现事实与隔离结论

### 2.1 当前机构入口不是目标知识库

当前正式机构入口仍集中在 `/hospital/page.tsx` 与 `InstitutionWorkspace` 的 `activeView === 'knowledge'` 单页状态中，`DemoSessionGate` 主要按 `tenant_admin` 放行。`InstitutionKnowledgeReadonlyShell` 实际包含上传、解析/OCR、embedding、索引、检索、问答和 AI 试问；显式创建、更新和归档则存在于旧 `items` API，上传流程还会隐式创建 `seed` source/document。

这不是产品规格要求的 `/hospital/knowledge/**` 稳定路由，也没有完成四角色服务端授权、canonical item、不可变版本或 production publication。`KB-01` 不得继续向旧大壳叠加状态；必须消费总协调台路由底座，并将未通过门禁的子能力隐藏而不是显示空壳。

### 2.2 已真实持久化但只能受控复用的事实

下表的“真实持久化”只表示当前数据库结构和 repository 能定位该事实，不代表它已满足目标产品、低敏、不可变、机构隔离或生产检索标准。

| 现有位置 | 已持久化且可解释的事实 | 后续可复用边界 | 当前不能据此宣称的能力 |
| --- | --- | --- | --- |
| `knowledge_document_files` | `tenantId`、document ID、原文件名、MIME、大小、`sha256`、状态、上传人、创建/归档时间；`storageKey` 仅在 tenant 内唯一 | 文件身份、完整性校验和历史归档输入 | 不是不可变附件修订、版本清单或批准素材；`storageKey` 不得给客户端；文件 bytes 当前落本地 `var/knowledge-files`，不是生产对象存储 |
| `knowledge_document_file_parses` | 解析状态、失败码/安全文案、完整 `textContent`、长度、chunk 数、`parserVersion` 和时间 | 迁移预检、解析状态和 parser 版本参考 | 一份 tenant+file 记录会被 upsert 覆盖；完整抽取文本属于高敏风险，不是不可变正文/解析修订 |
| `knowledge_document_file_parse_chunks` | `fileId + chunkIndex`、`textPreview`、字符数和时间 | 旧片段定位及迁移校验 | `textPreview` 是最长约 120 字的原始抽取文本，不具备低敏保证；重跑会 delete+replace，缺少内容 hash、偏移和修订 ID |
| `knowledge_document_file_parse_chunk_embeddings` | chunk、provider/model、维数、JSON 向量、状态和失败码 | 仅供现有受控测试与迁移识别 | 默认是 `mock_local_embedding` / `mock-local-embedding-v1`，按 chunk 覆盖，不是不可变真实向量产物或生产向量索引 |
| `knowledge_indexing_jobs` | tenant、可选 institution/actor/knowledge/file、任务类型、状态、计数、低敏失败信息、metadata 和时间 | 旧任务历史、状态页数据迁移参考 | `createAndRun*` 在同一请求创建后立即执行；没有 claim/lease/attempt 恢复模型，不是生产队列、worker 或可恢复执行器 |
| `knowledge_qa_audit_logs` | tenant、可选 institution、操作者、检索模式、引用数、安全状态和时间 | 旧调用盘点与迁移清理输入 | 表还直接持久化 `question` 和 `answerPreview`；旧 `qa` 路径保存原问题/答案预览，`answer` 路径才编码 hash/长度，语义不一致，不能作为目标低敏审计或回答快照 |
| `knowledge_quota_usage_records` 与套餐版本 | knowledge resource/action、允许/拒绝/结果、数量、低敏原因；套餐含知识存储和 entitlement JSON | 知识动作审计和额度权威配置输入 | 当前聚合主要按 tenant，不是机构子额度账本；不能把全局 `ai_calls` 当作知识专属额度 |
| `platform_knowledge_institution_visibility` | `tenantId + knowledgeDocumentId + institutionId` 唯一，可表达现有平台可见关系 | 平台授权历史的迁移输入 | 没有 item/version/publication/current pointer 或安全优先级语义，不能单独成为目标授权契约 |
| `audit_events` | 通用审计对象、动作、操作者和时间 | 公共审计迁移/扩展参考 | 当前缺少 `institutionId`，不能直接满足机构级知识审计 |
| `knowledge_sources.sourceLabel/workspaceId` | 平台端将其作为 directory/library 分组视图 | 最多作为迁移前的分组标签参考 | 新建目录仍写入 `sourceKind: mock`，重命名会级联旧 demo 数据；不是独立 library，更不能替代 canonical knowledge item |

### 2.3 必须与正式能力隔离的实现

1. `knowledge_sources`、`knowledge_documents`、`knowledge_chunks` 和旧 `knowledge_index_jobs` 的 `sourceKind` 只有 `mock | seed | demo`。这些行不得进入正式列表、publication 或指标，也不得通过改文案伪装为真实数据。
2. 公共 `src/modules/knowledge-base/**` 仍使用 `mock_demo_embedding`；平台向量路径使用 SHA-256 生成固定 8 维查询向量、Node 内存余弦和 deterministic rerank。二者必须留在 demo/test 命名空间，正式检索不得兼容回退。
3. OCR 默认 dry-run 只返回 `ocr_required`，`mock_local` 只适用于测试。`OCR-ready`、`ocr_required` 或 provider 未接入都不能显示为 OCR 成功。
4. `mockLocalProvider` 拼接 citation preview，其他 provider 可为 disabled；即使某条 answer 路径能调用真实模型，召回仍依赖 mock embedding 时也不能标记为正式知识问答。
5. 旧 job 虽有数据库记录，但同步请求内执行、可覆盖 parse/embedding 产物。正式任务记录不得混入这类运行结果，除非先经过明确迁移、来源标记和生产执行门禁。
6. 旧 parse/chunk/QA 中的原文和预览不应被直接当作低敏 DTO；迁移前必须做内容分类、保留期和安全处置申请。

## 三、总控共同冻结

### 3.1 唯一角色代码

全线只使用以下四个稳定角色代码，不增加别名或第五种知识角色：

```text
tenant_admin | tenant_operator | consultant | customer_service
```

角色展示名可以本地化，但 API、公共契约、权限测试和审计必须使用上述稳定代码。

### 3.2 统一跨线读取外层

所有跨线读取都包在总协调台声明的统一 `v1` 外层中；知识库线只记录并消费冻结字段，不拥有公共声明。

| 字段 | 冻结语义 |
| --- | --- |
| `contractVersion` | 固定为 `v1` |
| `scope` | 精确为 `{ tenantId, institutionId }`，来自服务端 access context；reader 对每次读取重新校验，不信任客户端 scope |
| `readiness` | `ready \| empty \| partial \| stale \| unavailable \| denied \| disabled` |
| `freshness` | 精确为 `{ observedAt, freshUntil } \| null`；`stale` 必须给出快照截止时间 |
| `partitions` | 每个来源/分区分别给出 `key`、六态 readiness、精确 freshness 和必有但可空的受控 `failureCode`，不能用整页成功掩盖局部失败 |
| `failureCode` | 必有但可空，只使用统一七值白名单，不返回堆栈、provider 原错、内部路径或 payload |
| `data` | `T \| null`；只在 scope 与权限通过时返回最小业务数据，拒绝态不得夹带旧缓存或对象存在性 |

状态规则统一如下：

- 只有权威 reader 查询成功且确认当前 scope 确实无记录时，才能返回 `empty` 并显示 `0`。
- `partial` 只显示已验证分区，并明确缺失分区；缺失不能按 `0` 参与指标。
- `stale` 只可展示带截止时间的已验证只读快照，不得驱动发布、回滚、发送、重建、任务重试或行动队列；知识 AI 和附件发送也不得把 stale reference 当成当前 publication。
- `unavailable` 不伪造空状态；保留其他独立可用分区。
- `denied`、`disabled`、`scope_mismatch` 一律不返回业务数据，也不泄露目标是否存在。

### 3.3 公共契约所有权

| 契约 | 公共声明所有者 | 领域 provider / server reader | 消费者 |
| --- | --- | --- | --- |
| `PublishedKnowledgeReferenceV1` | 总协调台 | 知识库模块只实现当前 publication provider | 会话、知识 AI、其他获准受控 AI |
| `ApprovedKnowledgeAssetReferenceV1` | 总协调台 | 知识库模块只实现逐附件批准素材 provider | 会话素材发送与获准渠道流程 |
| `RestrictedCustomerKnowledgeAccessV1` | 总协调台 | 客户中心、会话/任务、隐私和知识模块在各自模块提供权威分区 provider；公共 server reader 只组合 provider 结果 | 客户中心、获准的单客户 AI |

公共声明未来只能落在总协调台拥有的公共契约位置。各权威生产者在自己的模块实现 provider，公共 server reader 只通过契约组合分区结果；任何消费者或组合 reader 都不得读取其他生产者的 repository/table，也不得从 UI 状态推断权限或 current publication。

### 3.4 唯一 migration 队列

全局迁移顺序只能是：

```text
MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06
```

知识库只提出并消费 `MIG-03`，不得创建其他知识 migration 编号，也不得把 schema 改动塞入 `KB-*` 页面/API PR。`MIG-03` 的申请范围统一包含：

- knowledge item、结构化正文修订、附件与附件修订；
- 不可变版本及版本内容清单；
- publication、历史 publication 与 current pointer；
- 逐附件批准素材决定；
- parse/chunk/index 修订和可恢复任务事实；
- 精确 citation、`KnowledgeAnswerSnapshotV1` 与普通低敏审计关联；
- 受限客户附件的隔离实体、复合 scope 约束和独立索引引用；
- 旧 mock/seed/demo、原文 parse/chunk、原问题/答案预览的隔离、回填或清理策略。

具体 schema、SQL、回填、索引、外键、并发锁和回滚方案由总协调台 migration 任务另行审批并实施；本计划没有执行权限。

### 3.5 唯一外部集成串行队列

OCR、embedding、rerank、知识 AI，以及需要外部服务的索引能力，只能进入总协调台唯一外部集成串行队列。知识栏目 PR 只能：

1. 提出输入、输出、scope、安全、质量、超时、幂等、失败码和验收契约；
2. 使用 fake adapter 完成领域契约测试；
3. 在独立集成任务获批并交付 adapter 后消费其公开接口；
4. 验收真实质量、隔离、降级和 capability gate。

知识栏目 PR 不实现 provider 私有逻辑，不读取凭证，不发起未经批准的网络调用，也不自行建设第二套 adapter。纯本地解析器或可恢复任务执行器若要实现，仍须以独立 runtime/worker 任务重新授权，不能因本计划自动获得许可。

## 四、canonical 知识条目与不可变内容模型

### 4.1 canonical item，不是文件库

“资料库”是页面名；可选的 library 只允许作为分组、筛选或运营视图，不拥有内容版本和 publication，也不能形成 `/libraries/:id` 第二套详情路由。canonical 身份始终是 `knowledgeId`。

一个不可变知识版本必须冻结以下内容：

| 组成 | 必须冻结的字段与约束 |
| --- | --- |
| 条目身份 | `knowledgeId`、`tenantId`、`institutionId`、所有权来源 `institution \| platform`；机构自有与平台授权不可混写 |
| 结构化正文修订 | `bodyRevisionId`、结构化正文、正文规范化 hash、schema/template version；正文修订不可覆盖 |
| 业务元数据 | 标题、固定分类、受控标签、低敏摘要、来源、风险级别、可空有效期、可空复核时间 |
| 用途范围 | 仅 `internal_only \| ai_customer_reply`；用途变化创建新版本，不原地改当前版本 |
| 附件修订 | `fileRevisionId`、文件内容 hash、MIME、大小、安全状态、受控显示名；不得以可变 file 当前行代替版本快照 |
| 逐附件发送决定 | 每个附件独立的批准状态、批准/撤回时间、批准操作者、安全结果和渠道兼容；没有批准引用即不可发送 |
| 不可变版本 | `versionId`、单调版本号、item metadata snapshot、`bodyRevisionId`、`fileRevisionId` 清单、整体 manifest hash、创建人/时间 |
| publication | `publicationId`、`knowledgeId`、`versionId`、发布状态、发布时间/操作者、用途和安全快照；一个 item 同时至多一个 current publication |

AI 可读取 `ai_customer_reply` publication，不代表任何附件可以发送；附件发送还必须取得同一 current publication 下的 `ApprovedKnowledgeAssetReferenceV1`。

固定分类基线为 FAQ、咨询话术、项目资料、术后护理、活动政策和培训资料；具体稳定 code 由总协调台统一冻结。有效期和复核时间均可不设置；未设置或复核超期只形成治理提醒，不自动使 publication 失效，平台强制安全阻断除外。

### 4.2 内容状态矩阵

版本生命周期、item 生命周期、安全状态和附件发送状态分开建模，不能用一个 `status` 同时表达所有事实。

| 内容状态 | 可编辑 | 可进入生产检索/问答 | 可发送附件 | 历史语义 |
| --- | --- | --- | --- | --- |
| `draft` | 管理员/运营可编辑并形成新修订 | 否；只允许显式草稿预览且与生产索引隔离 | 否 | 未发布候选 |
| `publishing` | 候选 manifest 锁定，不能继续改 | 否；完成全部门禁前 current pointer 不变 | 否 | 发布事务进行中 |
| `published` | 不可编辑；编辑会新建 draft | 只有 current publication、用途和安全均允许时才可 | 仍需逐附件 `approved` | 当前生产事实 |
| `superseded` | 否 | 否 | 否 | 历史不可变版本；安全仍有效时可作为显式回滚候选 |
| `withdrawn` | 否 | 否，立即不可新召回 | 否 | 保留历史 citation/snapshot 和撤回原因 |
| `retired` | 否；item 不再接受普通新发布 | 否 | 否 | item 终止使用，历史不可删除 |

附加状态规则：

- 自动解析/索引/安全校验失败不会生成“发布失败版本”；候选回到可修正 draft 并记录受控失败，旧 current publication 保持可读。
- 安全状态至少区分待校验、允许、阻断、已过期；未知按阻断处理。平台强制安全规则可以立即禁止检索、回答或发送，不改写历史内容。
- 逐附件发送状态至少区分未批准、已批准、已撤回、已阻断；它不是双人审批，也不自动跟随 AI 用途。
- 管理员和运营均可由同一操作者完成编辑、自动门禁校验、发布、回滚和退役，不引入双人审批或互相批准状态。

## 五、权限、入口与受限客户附件

### 5.1 知识库权限矩阵

| 角色 | 知识库入口与 API | 机构知识操作 | 受限客户附件 |
| --- | --- | --- | --- |
| `tenant_admin` | 显示入口；可读取当前机构 canonical 路由 | 新建、编辑、上传、发布、回滚、退役、查看/重试获准任务 | 按当前机构和明确客户 scope 查看；写入/清理只走另行批准的客户绑定流程，不得发布为机构通用知识 |
| `tenant_operator` | 与管理员相同 | 与管理员相同；同一操作者可以完成发布，不需要管理员复核 | 与管理员相同 |
| `consultant` | 不显示知识库；深链接和知识库 API/search/QA 统一拒绝 | 无 | 只在客户中心按本人是客户负责人、本人会话分配或本人任务分配范围只读查看 |
| `customer_service` | 不显示知识库；深链接和知识库 API/search/QA 统一拒绝 | 无 | 只在客户中心按本人是客户负责人、本人会话分配或本人任务分配范围只读查看 |

服务端对列表、详情、搜索、问答、文件、任务和每个写命令分别校验角色与 `tenantId + institutionId`；客户端隐藏、路由参数或旧 demo session 都不能创造权限。越权统一为 `denied`，不泄露对象、数量、引用或任务是否存在。

### 5.2 `RestrictedCustomerKnowledgeAccessV1`

该公共契约由总协调台登记，至少冻结以下判定输入与结果：

- 全部读取套用第 3.2 节统一 `contractVersion: v1` 外层、readiness、freshness、分区状态和受控 failure code；
- 服务端 scope：`tenantId + institutionId`，以及恰好一个 `customerId`；数组、空值或多个客户一律拒绝。
- `purpose`：精确为 `attachment_read | ai_read`，不能使用自由文本用途。
- 当前角色及权威数据范围分支：`tenant_admin | tenant_operator` 以当前 `tenantId + institutionId` 为范围，不要求负责人/分配关系；`consultant | customer_service` 必须从客户中心进入，并满足本人是客户负责人、当前会话分配或当前任务分配三者之一。任何关系都不得由客户端自行声明。
- `ai_read` 额外要求独立敏感 AI 授权：授权 ID、范围、有效状态、生效/到期/撤回时间均由隐私权威 reader 校验；普通渠道授权不能替代。
- 结果只返回最小允许附件修订安全引用，不另加 payload reason code；拒绝和失败只使用统一 envelope/partition `failureCode`。不得返回客户 PII、正文、跨客户数量或内部索引信息。

`RestrictedCustomerKnowledgePartitionKeyV1` 的固定 key 集合、组合 reader 所有者、敏感 AI 授权权威来源和撤回传播时限仍由总协调台冻结；冻结前客户附件组合 reader 与敏感 AI runtime 均阻塞，知识线不得用本地枚举或默认泛型绕过。

任何 AI 使用必须同时满足：恰好一个 customerId、与当前 context 同机构、当前角色数据范围有效、独立敏感 AI 授权有效且未过期/未撤销。缺一即 fail-closed；受限附件不得混入机构知识索引、跨客户召回、平台授权、默认 AI 上下文或通用问答。

## 六、冻结引用与回答快照契约

以下字段是知识线记录的申请口径；公共声明、兼容策略和最终文件由总协调台拥有。

### 6.1 `PublishedKnowledgeReferenceV1`

payload 至少包含：

- `knowledgeId`、`publicationId`、`versionId`；
- `sourceType: institution | platform`；
- `bodyRevisionId` 与正文内容 hash；
- 标题、固定分类、低敏摘要、`useScope`、风险与有效期状态；
- publication 发布时间、current 判定和安全状态；
- 精确内容定位：`sourceKind: structured_body | attachment`、对应 `bodyRevisionId` 或 `fileRevisionId`、`chunkRevisionId`、内容 hash；
- 统一跨线读取外层的 readiness、freshness、分区状态和受控 failure code。

provider 只返回当前、未撤回、未退役且通过安全与用途校验的 publication。会话/AI 不得凭 `knowledgeId` 自行读取最新表行或拼装版本。

### 6.2 `ApprovedKnowledgeAssetReferenceV1`

payload 至少包含：

- `knowledgeId`、`publicationId`、`versionId`；
- `fileRevisionId`、文件内容 hash、MIME、大小和受控显示名；
- `sendApprovalStatus: approved`、批准时间/操作者安全引用；
- 当前安全状态、渠道兼容范围和可选失效时间；
- readiness/freshness 与受控 failure code。

该契约只返回 current publication 中仍获批准的附件修订，不返回 `storageKey`、临时 URL、凭证或原始扫描文本。AI 可读 publication 与附件可发送是两个独立决策；发送动作必须同时重新读取 publication reference、approved asset reference 和渠道安全契约。

### 6.3 `KnowledgeAnswerSnapshotV1`

每次正式问答形成一个不可变快照，至少包含：

- `snapshotId`、`tenantId`、`institutionId`、`status: answered | no_answer`；
- 已通过输出校验的答案，或只指向受保护答案内容的稳定引用；二者互斥，并保存最终内容 hash；
- 精确 citations：`publicationId`、`versionId`、`bodyRevisionId` 或 `fileRevisionId`、`chunkRevisionId`、引用内容 hash；
- `retrievalConfigVersion`、`modelConfigVersion`；只存配置版本，不存可供机构端选择的模型/provider 参数；
- 安全结果、受控 reason codes、生成时间；
- 生成时读取到的 publication/current 与 freshness 证据。

快照只保存校验后的最终答案或受保护引用，不保存 prompt、原始 provider completion、向量、检索 payload、请求体、堆栈或 provider 原始错误。

普通审计只保存：`snapshotId`、问题 hash/长度、操作者安全引用与角色、tenant/institution、状态、精确 citation IDs/定位、受控原因和时间。问题/回答低敏预览是可清理的独立 projection，保留期可在 `90–365` 天配置，默认 `180` 天；检测到 PII 时不生成或不展示预览。

预览到期只清理预览，不删除 snapshot ID、publication/version/file/chunk 定位、内容 hash、安全结果和必要审计。若底层敏感 bytes 因合法保留期清理，必须保留不可反推正文的 tombstone 与 hash，使历史引用仍可解释而不恢复原文。

### 6.4 统一 `no_answer`

以下任一条件成立时，对外状态统一为 `no_answer`，不得输出部分答案或改成“建议人工确认”的伪答案：

- 无有效 citation；
- 机构事实与平台内容存在实质冲突；
- 相关性低于已批准阈值；
- publication/version 已撤回、退役或不再是允许使用的当前引用；
- 输入、引用、答案或附件的安全校验失败。

内部只记录受控 reason code。能力整体为 `unavailable | denied | disabled` 时按统一 readiness 返回，不用 mock answer 兜底。

## 七、canonical 页面与移动端边界

### 7.1 唯一路由

| 页面 | canonical 路由 | 载体与边界 |
| --- | --- | --- |
| 资料库 | `/hospital/knowledge` | 完整页面；列出 knowledge item，不列 library entity |
| 检索测试 | `/hospital/knowledge/search` | 完整页面；只有真实混合检索门禁通过后显示 |
| 问答与引用 | `/hospital/knowledge/qa` | 完整页面；即时问答与问答审计受控分段 |
| 问答审计详情 | `/hospital/knowledge/qa/audits/:auditId` | 桌面 `560px` 只读抽屉，移动端全屏页 |
| 任务记录 | `/hospital/knowledge/jobs` | 完整页面；只显示真实持久化且可解释的任务 |
| 知识详情 | `/hospital/knowledge/items/:knowledgeId` | 桌面 `560px` 抽屉，移动端全屏页 |

知识详情 view 固定为 `overview | versions | files | chunks | references | dependencies`。旧 `activeView`、任何 library 详情路由或平台详情路由不得成为第二套 canonical 状态；兼容入口只能在目标能力可用后安全跳转。URL 只传对象 ID 和安全结构化筛选，不传问题正文、答案、文件名、客户 PII 或 provider 信息。

### 7.2 移动端只读边界

管理员和运营从移动端“更多”进入知识库后，可以浏览资料、检索、发起内部问答和查看 citation/历史审计；检索与问答虽会产生用量和审计，但不得修改知识业务内容。

移动端禁止上传、创建/编辑、发布、回滚、退役、附件批准、重新解析、OCR、生成/重建索引、取消/重试任务。对应命令由服务端能力与客户端双重拒绝，不能只隐藏按钮。知识分类改为下拉，列表/引用/检索结果使用摘要卡片，详情为全屏页。

咨询师和客服在移动端“更多”同样看不到知识库；客户附件仍只在客户中心按 `RestrictedCustomerKnowledgeAccessV1` 展示。

### 7.3 管理中心边界

管理中心只提供当前机构全局 AI 使用次数、成功/失败/拒绝、未完成调用、额度已用/剩余、周期和预警的只读视图。它不管理也不展示模型、provider、Token、价格、成本、prompt、问答内容或 citation 正文。

知识专属存储、单文件上传、OCR、索引和 QA 额度留在知识库；两处都不得因未知数据显示假 `0`。

## 八、发布、平台更新与真实能力门禁

### 8.1 机构自有知识原子发布

发布流程固定为：

```text
draft
→ 冻结候选 manifest
→ 解析 / 真实混合索引 / 安全与质量验证
→ 同一事务写 publication、移动 current pointer、标记旧 publication superseded、写审计
```

同一操作者可以完成上述流程；自动门禁不是双人审批。事务开始时锁定 `knowledgeId` 的 current pointer 与候选 version；任一步失败必须整体回滚并保留旧 current publication 可读。禁止先下架旧版再尝试发布新版，禁止原地修改 published version。

回滚只把 current pointer 原子指向既有、完整、未撤回且安全仍允许的历史 publication。撤回/退役立即停止新的检索、问答和附件发送，但保留历史 publication、citation、answer snapshot 和审计。

### 8.2 平台强制安全规则与静默版本更新

优先级固定为：

```text
平台强制安全规则 > 机构已发布事实 > 平台一般知识
```

- 平台授权知识由平台 provider 维护自己的不可变版本和 current publication；平台新版本通过平台原子门禁后静默生效，并保留版本审计，不要求机构逐次确认。
- 机构用户只能读取平台授权知识，不能编辑、回滚、撤回、退役或改变其平台 current publication。
- 平台静默更新不得改写机构自有 item/version/publication/current pointer，也不得把平台内容复制成机构版本。
- 平台强制安全规则可以立即阻断受影响的机构检索、回答或发送；阻断只改变可用性，不改写历史 snapshot。
- 机构事实与平台一般知识实质冲突时，相关 AI 返回 `no_answer` 并生成治理事项；不得让平台一般知识静默覆盖机构事实。
- 每次检索/问答仍冻结实际使用的 platform publication/version/hash。后续平台更新不能让旧 snapshot 指向新内容。

### 8.3 解析、OCR、索引和任务记录门禁

- 本地纯解析器只有在独立 runtime 授权后才能处理批准格式，并必须按 `versionId + body/attachmentRevisionId + inputHash` 写不可变 parse/chunk 修订、parser version、字符偏移和低敏失败码。
- OCR 只消费总协调台串行任务交付且获批的 adapter。没有真实 OCR 时保持 `ocr_required`，不生成假文本、chunk 或成功任务。
- 任务事实必须持久化幂等键、claim/lease、attempt、重试上限、取消点、恢复规则和安全 metadata；同步 request handler 不能进入正式任务记录。
- 只有未执行任务可以取消；瞬时故障有限幂等重试，超过上限进入失败并允许管理员/运营在桌面人工重试。
- provider、runtime、模型、内部队列、堆栈和原始错误不进入机构 UI。

### 8.4 真实混合检索发布门禁

`/hospital/knowledge/search` 和所有生产召回只有同时满足以下条件才可 capability-on：

1. 候选集合只来自当前 publication，先按 tenant/institution、角色、用途、安全和受限客户域过滤；草稿预览使用独立索引，不进入生产召回。
2. 关键词分支使用真实可解释的全文/倒排索引；向量与 rerank 只消费总协调台已批准 adapter，不读取 mock JSON 向量或在 Node 内存扫描余弦。
3. publication 对应 body/attachment 的 parse、chunk、embedding/index manifest 完整且 hash 一致；原子切换失败时旧生产索引继续服务。
4. threshold、topK、去重、query normalization、embedding/index/rerank 配置都有版本；低于阈值返回无结果，不回退关键词-only 或 mock。
5. 人工回归集覆盖期望命中、应无答案、内容冲突、撤回版本、跨 tenant、跨机构、跨客户、受限授权撤回和安全提示；数值阈值由总协调台批准后固化。
6. 跨 scope 命中必须为 `0`；撤回/退役/current pointer 变化后旧版本不得被新请求召回；并发发布与索引切换测试通过。
7. adapter、index 或权威 scope reader 不可用时返回 `unavailable/partial`，不显示假结果；stale 结果只供带截止时间的诊断查看，不进入问答或发送。

### 8.5 问答发布门禁

`/hospital/knowledge/qa` 只有在真实检索门禁、`KnowledgeAnswerSnapshotV1`、低敏审计、输出安全校验、知识 QA 额度和获批知识 AI adapter 全部可用后才开放即时问答。问答只用于机构内部验证，不提供复制发送客户、转会话、自动建业务对象或自动医疗建议。

正式 answer 必须先获得有效 current citations，再调用获批 adapter；无证据不调用。返回前完成内容 hash、citation 一致性、冲突和安全校验，并原子写 answer snapshot 与普通审计。任一步失败不展示 provider 的部分 completion。

### 8.6 额度门禁

知识库只显示真实的存储、单文件上传、OCR、索引和 QA `limit / used / remaining / status / asOf`。额度未知、无权或读取失败显示对应 readiness，不显示 `0`。额度用尽只阻断对应新动作，不阻断已发布资料、历史版本、citation 和已有 answer snapshot 的安全只读查看。

## 九、按小 PR 拆分的后续实施计划

所有条目都是未来授权候选。每个 PR 开始前必须重新检查日期、分支、HEAD、`origin/main`、允许文件、工作区、数据库隔离和同步能力；出现未授权 schema/provider/公共文件或范围外改动立即停止。

### KB-01：真实知识条目列表、详情与页面状态

**候选范围：** `/hospital/knowledge`、`/hospital/knowledge/items/:knowledgeId`、机构知识只读 read-model/service/components/tests；公共路由壳、权限、审计和 schema 只消费已批准底座。

- [ ] 实现 item canonical list/detail DTO，不包含 library/document mock 字段、原文、storage key 或 provider 信息。
- [ ] 只允许 `tenant_admin`、`tenant_operator`，并对 list/detail 分别做服务端 tenant+institution 校验；咨询师/客服和跨 scope 统一无数据拒绝。
- [ ] 接入统一 v1 readiness/freshness/partition/failure 外层，覆盖 loading、权威 empty、筛选空、partial、stale、unavailable、denied、disabled 和不存在。
- [ ] 在 `MIG-03` 与权威 reader 未就绪时返回 `disabled`，不能将旧 mock/seed/demo 查询成功包装成 `empty: 0`。
- [ ] 列表搜索只匹配标题、固定分类和低敏摘要；详情 view 与 canonical 路由可刷新恢复。

**验收：** 真实数据来源、机构隔离和角色拒绝有服务端测试；无第二套详情路由；OCR、检索、问答、任务和额度失败不影响已发布 item 只读详情。

### KB-02：不可变版本、publication 与 current pointer

`KB-02` 必须按以下独立 PR 继续拆分；`MIG-03` 是总协调台迁移单元，不是 `KB-02` 子 PR。

| PR | 单一目标 | 明确不做 |
| --- | --- | --- |
| `KB-02A` | 纯领域状态、manifest/hash、资格校验和契约测试；同时提交 `MIG-03` 数据变更申请 | 不改 schema，不写页面，不实现 provider |
| `KB-02B` | 在已完成的 `MIG-03` 上实现 item/version/publication 只读 repository 和 current reader | 不实现发布命令，不改公共契约声明 |
| `KB-02C1` | 追加不可变正文/附件修订与 version manifest；重复幂等、发布后不可修改 | 不移动 current pointer |
| `KB-02C2` | 单一原子 publication 事务、current pointer 和失败保留旧版 | 不做回滚/退役 UI，不接外部 provider |
| `KB-02C3` | 回滚、撤回、退役和历史保持；逐动作机构审计 | 不处理平台版本更新 |
| `KB-02C4` | 只消费已批准的平台 current-publication provider，在机构侧实现安全优先级、冲突判定和知识模块的 `PublishedKnowledgeReferenceV1` provider | 不修改平台版本、平台 current pointer 或公共契约声明；平台写入/静默切换只提总控/平台端申请 |
| `KB-02D` | 列表/详情只读展示 current publication、版本、用途、安全和治理状态 | 不夹带 schema、写服务或 provider 私有逻辑 |

**验收：** 并发发布至多一个 current；失败旧版仍可读；同一 idempotency key 不重复 publication；历史版本不可覆盖；同一管理员或运营可以完成发布；消费者只读公共 provider。

### KB-03：结构化正文、附件修订与批准素材

- [ ] `KB-03A`：桌面端结构化正文/元数据 draft 表单，固定分类、受控标签、低敏摘要、来源、风险、有效期、复核时间和用途范围逐项校验。
- [ ] `KB-03B`：附件上传与 attachment revision；hash 去重、安全状态、MIME/大小和版本绑定，不复用可变 file 当前行。
- [ ] `KB-03C`：逐附件批准、撤回和渠道兼容，知识模块实现 `ApprovedKnowledgeAssetReferenceV1` provider；AI 可读与发送批准分别测试。
- [ ] `KB-03D`：管理员/运营的发布、回滚、退役桌面交互；同一操作者可完成，移动端和咨询师/客服拒绝。

**验收：** published 内容不能原地修改；hash/MIME/大小或安全不一致阻断；未批准/已撤回附件不可发送；机构自有与平台授权内容不可互写。

### KB-04：解析修订、可恢复任务与任务记录

- [ ] `KB-04A`：提交 parse/chunk/job 的 `MIG-03` 细化申请和领域状态测试，不创建新 migration 编号。
- [ ] `KB-04B`：在独立 runtime 授权下实现批准格式的纯本地解析与不可变修订；扫描件保持 `ocr_required`。
- [ ] `KB-04C`：在独立 worker 授权下实现持久化 claim/lease/attempt/恢复/取消/有限重试；不把 request 内执行改名为 worker。
- [ ] 总协调台外部集成串行任务交付 OCR adapter 后，知识线仅增加 adapter 消费和验收，不实现 OCR provider。
- [ ] `KB-04D`：`/hospital/knowledge/jobs` 只读状态与桌面重试/取消命令，移动端只读，UI 不暴露 provider/runtime。

**验收：** 同一 revision/hash 幂等；断电、超时、重复触发、取消和重试不污染 current publication；OCR 未接入无假成功；旧同步 job 不混入正式任务指标。

### KB-05：真实混合检索与质量门禁

- [ ] `KB-05A`：定义 retrieval adapter、current publication filter、草稿预览隔离和 fake contract 测试；向总协调台提交 embedding/rerank/外部索引验收契约。
- [ ] 外部集成串行任务交付并获批 adapter 后，`KB-05B` 只实现关键词/向量结果合并、阈值、去重、配置版本和 no-result 裁决，不实现 provider 私有逻辑。
- [ ] `KB-05C`：建设人工回归集、scope/撤回/冲突测试和 capability gate。
- [ ] `KB-05D`：发布 `/hospital/knowledge/search` 页面；浏览器只见业务相关性与低敏匹配原因，不见原始分数、向量或模型。

**验收：** 满足第 8.4 节全部门禁；mock embedding、JSON 内存余弦、deterministic rerank、关键词-only fallback 均有负向测试。

### KB-06：内部问答、引用快照与低敏审计

- [ ] `KB-06A`：实现 `KnowledgeAnswerSnapshotV1` 与普通审计领域契约、retention projection 和 `no_answer` 原因测试；schema 仍只消费 `MIG-03`。
- [ ] 向总协调台外部集成串行任务提交知识 AI 输入/输出/安全/超时/质量契约；知识线不实现 provider。
- [ ] adapter 获批后，`KB-06B` 只编排“先取 current citations → AI → 校验 → 原子 snapshot/audit”，任何失败不返回部分 completion。
- [ ] `KB-06C`：发布 `/hospital/knowledge/qa` 与 `/hospital/knowledge/qa/audits/:auditId`；模型/provider/Token/成本不可见。

**验收：** 五类条件统一 `no_answer`；普通审计无 prompt/completion/vector/payload；PII 不显示预览；预览过期后历史 citation 仍可解释。

### KB-07：受限客户附件与单客户 AI

- [ ] 总协调台先声明 `RestrictedCustomerKnowledgeAccessV1`；客户中心、会话/任务、隐私和知识模块各自在自身模块提供权威分区 provider，公共 server reader 只组合 provider 结果，不读取生产者表。
- [ ] `KB-07A`：消费 `MIG-03` 隔离实体，建立 customer-bound 附件、parse/index namespace 和复合 scope 约束；不提供通用知识入口。
- [ ] `KB-07B`：客户中心只读附件接线；咨询师/客服仅在本人负责人/分配范围，管理员/运营仅当前机构。
- [ ] `KB-07C`：恰好一个 customerId 的 AI 读取编排；敏感 AI 授权每次重新校验，撤回即时失效。

**验收：** customer A 永不召回 customer B 或机构通用知识；任何 scope/角色/授权缺失 fail-closed；知识库 route/API 不成为咨询师/客服旁路。

### KB-08：知识专属额度

- [ ] 定义存储、单文件上传、OCR、索引和 QA 的权威口径、scope、时间窗和 `asOf`；机构子额度若缺 schema，本计划内只可申请纳入 `MIG-03`，未获纳入则该子能力保持 `disabled`，不得另造或借用其他 migration。
- [ ] 发布知识库只读额度卡与对应动作门禁；unknown/unavailable/denied 不显示 `0`。
- [ ] 管理中心只消费全局 AI 使用只读摘要；知识库与管理中心都不展示模型、provider、Token、价格、成本或问答内容。

**验收：** 额度读取失败/耗尽只影响对应新动作；已发布浏览、历史 citation 与 snapshot 保持可用；跨机构、周期切换和并发使用有服务端测试。

## 十、每个未来 runtime PR 的固定门禁

1. 重新确认日期、任务编号、分支、HEAD、`origin/main`、干净工作区和唯一允许路径；同步任务还需通过实际 `.git`/远端同步能力检查。
2. 单个 PR 只完成一个表格中的单一目标，通常不超过 3–5 个核心业务文件；schema/migration、公共契约、provider、worker 和页面 PR 分开授权。
3. 所有 scope 来自服务端 access context；客户端传入 tenant、institution、knowledge、version、publication、customer 或 provider ID 只能作为待验证引用。
4. 覆盖管理员/运营允许、咨询师/客服拒绝、未登录、跨 tenant、跨 institution、跨 customer、撤回/退役、安全阻断、并发/幂等和审计失败。
5. 正式路径不得回退到 mock/seed/demo、原文 preview、mock embedding、内存余弦、deterministic rerank、mock QA、dry-run OCR 或同步 request job。
6. 每个读模型都验证 `ready/empty/partial/stale/unavailable/denied/disabled`；只有权威 empty 能显示 `0`。
7. 合并不等于发布。真实数据、机构隔离、角色权限、不可变引用、审计、降级和本切片门禁全部通过后，才可另行申请 capability-on。

## 十一、仍需总协调台决策的真实阻塞

1. 统一 v1 跨线读取外层、三个公共契约的最终声明文件、兼容测试和受控 failure code 白名单尚需总协调台定稿；知识线不能自行声明不同版本。
2. `MIG-03` 的具体 schema、历史原文/preview 处置、回填、索引、复合外键、并发发布锁和回滚方案尚未审批；审批前真实 item/current publication reader 只能保持 `disabled`。
3. OCR、embedding、rerank、知识 AI 与外部索引 adapter 的 provider、凭证、网络、数据出境、质量、成本和生产放行均待唯一外部集成串行任务授权。
4. 真实检索人工回归集的权威样本、数值阈值和发布签字人尚需总协调台确定；未确定不得 capability-on。
5. `RestrictedCustomerKnowledgeAccessV1` 的组合 reader 所有者、敏感 AI 授权权威来源、撤回传播时限和客户附件保留/清理口径尚需总协调台与客户中心/隐私治理共同定稿。
6. 平台强制安全规则的权威 provider、规则版本和冲突治理责任人尚需平台知识管理所有者确认；优先级和 `no_answer` 行为不得由知识线另造。

## 十二、完成定义

`PLAN-KB-REV-02` 的完成只表示：本计划已对齐固定四角色、统一跨线读取语义、canonical item、不可变版本与 publication、两类知识引用契约、受限客户访问契约、回答快照、固定路由、移动端边界、平台安全优先级、唯一 `MIG-03`、外部集成串行队列和更小的 `KB-02C1–C4` PR 切片；同时保留并修正了现有真实持久化字段与 mock/job 隔离盘点。

它不表示 `KB-01` 或任何 runtime 已获授权，也不表示 schema/migration、OCR、真实检索、知识 AI、受限客户附件、额度、提交、推送、PR、合并或正式导航已经实现或可发布。
