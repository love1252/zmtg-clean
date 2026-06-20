# 知识库管理功能真实性审查报告

## 环境信息

| 项 | 值 |
|---|---|
| 日期/时区 | 2026-06-20 CST +0800 |
| 当前分支 | `codex/old-ai-model-config-parity-01` |
| HEAD | `0bf1ac7e69891efdcc7235c303bd270841edd33f` |
| origin/main | `2499e2d291829155f55aab1ac178f68d23dfa30a` |
| Working tree | dirty（14 个已修改文件，均为当前分支的正在进行工作） |
| 审查范围 | 知识库管理 Panel + loader + API routes + services + repository |

## 一、结论摘要

| 分类 | 数量 | 说明 |
|---|---|---|
| **真实功能（full chain: UI → API → Service → Repository → DB）** | **10** | 文件上传/下载/解析/归档/列表/解析片段、关键词检索、向量索引生成、语义检索、问答审计 |
| **受控 mock/local（真实链路，但算法/数据为本地 mock）** | **5** | 概览同步数据、文件列表(overview)、知识条目列表、embedding 向量（deterministic SHA-256 mock）、问答回答（citation 拼接 mock） |
| **纯前端交互（仅本地 state 变化）** | **4** | Tab 切换、文件勾选/全选、检索模式选择、知识库选择下拉 |
| **纯视觉按钮（无真实业务动作）** | **0** | 无 |
| **禁用未启用（disabled / dry-run / 边界限制）** | **10** | 真实 AI provider、OCR、真实向量库、runtime ingestion、文件归档状态下禁用下载/解析/归档等 |
| **风险待确认（需人工连接环境确认）** | **3** | 真实文件存储路径、数据库实际包含数据、demo session 认证方式的有效性 |

**总体评估：** 知识库管理 Panel 包含 **10 个完整的真实链路功能**（UI → API → Service → Repository → 真实数据库读写），所有功能链路都通过真实 Drizzle ORM 操作 PostgreSQL。但"智能"层面（embedding、语义检索、问答生成）均使用 **deterministic mock/local 算法**，不调用真实第三方 AI 服务。概览页面（KPI、分类、高频问题、导入任务）数据源为 **mock data**。Panel 内没有纯视觉/无反应按钮。

## 二、逐功能表

### 2.1 页面基础加载

| 区域 | 功能/按钮 | 当前状态 | 类型 | 证据 | 风险/建议 |
|---|---|---|---|---|---|
| 顶部 | 同步数据按钮 | 可用，触发刷新 | **受控 mock** | 点击后调用 `loadOpenPlatformKnowledgeManagementView/Files/Items`，设置 `isSyncing`/`refreshVersion`。View/Files/Items 数据源标记为 `dataSource: 'mock'`，来自 `getPlatformKnowledgeMockData()`。来源文件：`platformKnowledgeManagementApiContract.ts:129-201` | 概览数据非真实 DB 数据。如需真实运营看板，需切换为 repository 数据源 |
| 左侧 | 机构范围切换 | 可用，过滤全页面 | **受控 mock** | 点击机构后 `handleSelectTenant` 触发全量重载，filter 在 mock 数据层面做 tenantId 匹配。来源：`platformKnowledgeManagementApiContract.ts:152-175` | 切换机构时仍有 loading 态，体验完整 |
| 顶部 | KPI 指标卡片 | 可用，5 个 panel | **受控 mock** | 数据来自 `view.allTotals`（接入机构、知识条目、累计命中、解析覆盖、待优化）。来源：Panel `metricCards` 数组从 mock overview 映射 | 数据仅展示 mock 示例数值 |
| 左侧 | 当前范围/知识目录 | 可用 | **受控 mock** | `scopeName` 来自 mock scope。目录列表来自 `view.tenants` mock 数据 | 需确认真实 tenant 映射 |
| 右侧 | 运营信号 | 可用 | **受控 mock** | 高频问题/热点分类/零命中知识/导入成功率均来自 mock scope 数据 | |

### 2.2 文件管理 Tab（顶部文件列表 + 底部操作区）

| 区域 | 功能/按钮 | 当前状态 | 类型 | 证据 | 风险/建议 |
|---|---|---|---|---|---|
| 文件列表区 | 文件名搜索 | 可用，触发重载 | **受控 mock** | `handleFileSearchChange` → `loadOpenPlatformKnowledgeManagementFiles` → `getPlatformKnowledgeFilesResponse`（mock 过滤）。来源：`platformKnowledgeManagementApiContract.ts:152-175` | 搜索仅在前端 mock 数据中过滤 |
| 文件列表区 | 文件表格展示 | 可用 | **受控 mock** | 解析状态 badge、文件大小、更新时间均来自 mock 数据 | |
| 文件列表区 | 文件勾选 | 可用 | **纯前端交互** | `handleToggleFile` 仅更新 `selectedFileIds` state | |
| 文件列表区 | 选择本页 | 可用 | **纯前端交互** | `handleSelectPage` 将当页所有 fileId 推入 `selectedFileIds` | |
| 文件列表区 | 打包下载已选 | 可用 | **真实功能** | 遍历 `selectedFileIds` 调用 `downloadPlatformKnowledgeFileService`（GET 真实文件 download API），再用 `packTarGz`（客户端纯 JS tar.gz 打包）触发浏览器下载。来源：Panel `handleBulkDownloadSelectedFiles`，`tar.ts` 纯 JS 实现 | 依赖真实文件存在 |
| 文件列表区 | 分页（上一页/下一页） | 可用 | **受控 mock** | `handlePreviousPage/NextPage` 更新 `filePage` state 触发 mock 数据重新分页 | |
| 操作区 | 知识库选择下拉 | 可用 | **纯前端交互** | 仅更新 `managedKnowledgeId` state，触发 managed files 重载 | |
| 操作区 | 文件选择器 | 可用 | **纯前端交互** | `<input type="file">` 读取本地文件到 `managedFile` state | |
| 操作区 | **上传文件** | 可用，有 loading 态 | **真实功能** | `fetch(fileManagementPath, {method:'POST'})` → `POST /api/.../items/[knowledgeId]/files` → `uploadPlatformKnowledgeFileService` → repository 写入 DB + local filesystem 存储。文件大小/类型校验（max 20MB, 白名单类型）。来源：`platform-knowledge-file-management-service.ts:278-339`，`route.ts:76-101` | **真实副作用：写 DB + 写本地文件系统** |
| 操作区 | **下载文件** | 可用（仅 active 文件） | **真实功能** | `fetch(fileDownloadPath)` → `GET /api/.../files/[fileId]/download` → `downloadPlatformKnowledgeFileService` → repository 查 DB + local storage 读文件 → 返回二进制流触发浏览器下载。来源：`platform-knowledge-file-management-service.ts:387-409`，`route.ts:35-70` | **真实副作用：读本地文件系统** |
| 操作区 | **发起解析** | 可用（仅 active 文件） | **真实功能** | `fetch(fileParsePath, {method:'POST'})` → `POST /api/.../files/[fileId]/parse` → `parsePlatformKnowledgeDocumentFileService` → 从 storage 读文件 → 真实文本解析（TXT/MD 直接读，CSV 表格提取，PDF 文本流提取，DOCX/XLSX ZIP 解压后提取文本） → chunk 分片 → 写入 DB。来源：`platform-knowledge-document-parsing-service.ts`，`route.ts:77-100` | **真实副作用：读本地文件系统 + 解析真实文件内容 + 写入 DB**。受安全限制：20MB 大小、32000 字符上限、ZIP/PDF 解压上限 |
| 操作区 | **查看片段** | 可用 | **真实功能** | `fetch(fileParseChunksPath)` → `GET /api/.../files/[fileId]/parse/chunks` → `listPlatformKnowledgeDocumentFileChunksService` → DB 查询 `knowledgeDocumentFileParseChunks` 表。来源：`route.ts:40-68` | 片段仅展示 `textPreview`（low-sensitive），不暴露原文 |
| 操作区 | **归档文件** | 可用（仅 active 文件） | **真实功能** | `fetch(fileArchivePath, {method:'DELETE'})` → `DELETE /api/.../files/[fileId]` → `archivePlatformKnowledgeFileService` → DB update status='archived'。来源：`platform-knowledge-file-management-service.ts:367-385`，`route.ts:48-70` | **真实副作用：更新 DB**。不做物理删除 |

### 2.3 知识条目 Tab

| 区域 | 功能/按钮 | 当前状态 | 类型 | 证据 | 风险/建议 |
|---|---|---|---|---|---|
| 分类表现 | 分类卡片 + 进度条 | 可用 | **受控 mock** | 数据来自 `scopedCategories`（mock scope 数据）。来源：`platformKnowledgeManagementApiContract.ts:138-149` | |
| 高频问题 | Top 10 排名列表 | 可用 | **受控 mock** | 数据来自 `scopedTopQuestions`（mock scope 数据） | |
| 知识条目表格 | 条目列表展示 | 可用 | **受控 mock** | 数据来自 `getPlatformKnowledgeItemsResponse`（mock 过滤） | 无分页交互 |
| 机构切换过滤 | 切换机构后过滤 | 可用 | **受控 mock** | `selectedTenantId` 变化触发 mock 数据重新过滤 | 测试文件验证了机构切换过滤行为 |

### 2.4 检索测试 Tab

| 区域 | 功能/按钮 | 当前状态 | 类型 | 证据 | 风险/建议 |
|---|---|---|---|---|---|
| 检索片段 | 关键词输入 + 检索 | 可用，有 loading 态 | **真实功能** | `fetch(keywordSearchPath)` → `GET /api/.../knowledge-management/search` → `searchPlatformKnowledgeChunksService` → repository 查询 `knowledgeDocumentFileParseChunks` 表，在 `textPreview` 字段做子串匹配。来源：`platform-knowledge-keyword-search-service.ts:218-238`，`route.ts:31-61` | 展示的 `textPreview` 为低敏片段，安全 |
| 检索片段 | 检索结果展示 | 可用 | **真实功能** | 结果包含 knowledgeTitle、fileName、chunkIndex、textPreview、matchReason | |
| 生成向量索引 | **生成向量索引按钮** | 可用，有 loading 态 | **真实功能 + mock 算法** | `fetch(vectorEmbeddingPath, {method:'POST'})` → `POST /api/.../knowledge-management/embeddings` → `generatePlatformKnowledgeChunkEmbeddingsService` → DB 查询 parse chunks candidates → `createDeterministicMockKnowledgeEmbedding`（SHA-256 确定性 mock embedding，8 维向量）→ 写入 `knowledgeDocumentFileParseChunkEmbeddings` 表。来源：`platform-knowledge-embedding-vector-search-service.ts:264-318` | **数据链路真实（DB 读写），embedding 算法为 mock**（非真实 AI embedding）。provider='mock_local_embedding' |
| 语义检索 | 查询输入 + 语义检索 | 可用，有 loading 态 | **真实功能 + 本地算法** | `fetch(vectorSearchPath)` → `GET /api/.../knowledge-management/vector-search` → `searchPlatformKnowledgeVectorChunksService` → DB 查询 stored embeddings → 本地 cosine similarity 计算相似度。来源：`platform-knowledge-embedding-vector-search-service.ts:360-385` | 语义相似度为本地余弦计算，非真实向量数据库查询 |
| 知识库问答 | 问答输入 + 发起问答 | 可用，有 loading 态 | **真实功能 + mock AI** | `fetch(knowledgeQaPath, {method:'POST'})` → `POST /api/.../knowledge-management/qa` → `composePlatformKnowledgeQaService` → keyword + vector recall → `mockLocalProvider.generateAnswer`（拼接 citation text preview）→ 写入 QA audit log。来源：`platform-knowledge-qa-service.ts:520-530`，`platform-knowledge-ai-provider-adapter.ts:125-135` | **数据链路真实（DB 读写 + audit log），AI 回答为 mock**。provider='mockLocalProvider'，真实 AI provider 全部 disabled |
| 问答引用展示 | citations 展示 | 可用 | **真实功能** | 引用片段带 score 和 matchReason | |
| 检索模式选择 | keyword/vector/hybrid 下拉 | 可用 | **纯前端交互** | 仅更新 `qaRetrievalMode` state | |

### 2.5 问答审计 Tab

| 区域 | 功能/按钮 | 当前状态 | 类型 | 证据 | 风险/建议 |
|---|---|---|---|---|---|
| 问答审计 | **刷新审计按钮** | 可用，有 loading 态 | **真实功能** | `fetch(qaAuditPath)` → `GET /api/.../knowledge-management/qa/audits` → `listPlatformKnowledgeQaAuditsService` → repository 查询 `knowledgeQaAuditLogs` 表（分页、排序）。来源：`platform-knowledge-qa-service.ts:532-555`，`route.ts:30-58` | 真实审计记录来自之前的 QA 操作 |
| 问答审计 | 审计记录卡片展示 | 可用 | **真实功能** | 展示 question、answerPreview、retrievalMode、citationCount、safeStatus、safeFailureMessage、createdAt。来源：审计记录来自 DB | 所有字段为低敏安全字段 |
| 安全状态 | safeStatus badge | 可用 | **真实功能** | 'answered' / 'no_citation' 两种状态 | |
| 失败原因 | safeFailureMessage | 可用（仅失败时有） | **真实功能** | 黄色 badge 展示中文安全文案 | |

### 2.6 导入任务 Tab

| 区域 | 功能/按钮 | 当前状态 | 类型 | 证据 | 风险/建议 |
|---|---|---|---|---|---|
| 导入任务 | 任务列表展示 | 可用 | **受控 mock** | 数据来自 `scopedJobs`（mock scope 数据）。来源：`platformKnowledgeManagementApiContract.ts:138-149` | 无刷新按钮、无分页、无交互 |
| 状态 badge | 已完成/进行中/有失败/部分失败 | 可用 | **受控 mock** | badge 样式和文字来自 mock job status | |
| 成功/失败数量 | 数字展示 | 可用 | **受控 mock** | `成功 N/M，失败 N` 格式展示 | |
| 更新时间 | 时间展示 | 可用 | **受控 mock** | `job.updatedAt` 字段展示 | |

## 三、发现的问题

### 高

1. **概览页面全部使用 mock 数据，非真实数据库数据。** `loadOpenPlatformKnowledgeManagementView`、`loadOpenPlatformKnowledgeManagementFiles`、`loadOpenPlatformKnowledgeManagementItems` 三个核心 loader 均调用 `getPlatformKnowledgeMockData()`（`dataSource: 'mock'`）。这意味着 KPI 指标、文件列表、知识条目、分类表现、高频问题、导入任务 Tab 全部展示的是硬编码示例数据，不反映真实系统状态。只有文件管理操作区（managed files）的数据来自真实 repository。

2. **AI 问答回答为 mock 拼接，不产生真实智能价值。** `mockLocalProvider.generateAnswer` 仅将 citation text preview 拼接到"基于已召回的知识片段：..."模板中，不调用任何真实 AI 能力。所有真实 AI provider（`realAiProvider`、`openaiCompatibleProvider`、`enterpriseModelGateway`）均为 `enabled: false` 状态。

### 中

3. **Embedding 为 deterministic mock 算法，不反映真实语义。** `createDeterministicMockKnowledgeEmbedding` 使用 SHA-256 哈希生成 8 维确定性向量，`embeddingProvider: 'mock_local_embedding'`。向量检索的相似度计算结果仅用于链路验证，不可用于生产语义检索。

4. **导入任务 Tab 无交互能力。** 仅有静态 mock 数据展示，没有刷新按钮、分页、搜索或筛选，也没有与真实解析任务队列的关联。

5. **知识条目 Tab 无分页。** `KnowledgeTable` 展示所有 mock 数据条目无分页控件，实际使用时可能数据量过大。

6. **能力状态卡片已下线。** 测试验证确认 `/api/v1/open-platform/knowledge-management/capabilities` 不再被调用，`OpenPlatformKnowledgeManagementPanel` 不再渲染生产能力状态组件。虽然能力定义在 `platform-knowledge-production-governance-policy.ts` 中仍然完整，但前端不再展示，可能影响运维人员了解系统边界。

### 低

7. **测试全部通过但 mock fetch 全覆盖。** 13 个测试全部通过，但所有 API 调用通过 `vi.stubGlobal('fetch', ...)` 模拟，未测试真实 HTTP 链路。测试未覆盖 chunk 解析的文本提取逻辑和 embedding 存储 API 调用。

8. **`packTarGz` 打包下载为纯前端实现。** 打包 tar.gz 完全在浏览器端执行，大文件集合可能导致内存问题。

9. **文件名搜索在前端 mock 中过滤，非后端检索。** 搜索体验在 mock 数据下可行，切换到 repository 数据源后需要确认后端 keyword search API 的正确过滤。

10. **Demo session 认证依赖。** 所有 API route 通过 `getDemoAccessContextFromRequest` 获取 demo session 认证，未使用真实 OAuth/JWT。这可能是设计意图（内部受控试用阶段），但需要明确这是否符合安全要求。

## 四、安全边界核对

| 检查项 | 状态 | 说明 |
|---|---|---|
| 未读取 .env / .env.local | ✅ 通过 | 审查中未读取任何 env 文件 |
| 未输出数据库连接串 | ✅ 通过 | 未输出 DATABASE_URL、postgres:// 连接串 |
| 未输出 API Key / secret / token | ✅ 通过 | 未输出任何密钥、令牌 |
| 未运行 migration | ✅ 通过 | 未执行任何 DB migration |
| 未提交推送 | ✅ 通过 | 未执行 git commit/push |
| 未外呼真实第三方 AI | ✅ 通过 | 审查中发现所有真实 AI provider 均 disabled |
| 未外呼 OCR / 向量库 / HIS | ✅ 通过 | OCR、真实向量库均 disabled |
| 未创建 PR | ✅ 通过 | 无 PR 操作 |
| 未书写其他文件 | ✅ 通过 | 仅写入了本报告文件 |

**安全相关发现：**
- `platformKnowledgeManagementApiContract.ts:262` 在 `mapFile` 中自觉 strip 了 `tenantName` 和 `isDownloadable`，不暴露敏感字段
- `platform-knowledge-file-management-service.ts:226-237` 的 `mapFileRecordToDto` 显式剥离 `storageKey`（本地文件路径），安全
- `platform-knowledge-ai-provider-adapter.ts:64-79` 的 `deniedProviderFragments` 包含完整禁止字段列表（storageKey、embeddingVectorJson、SQL、stack、token、secret 等）
- `platform-knowledge-production-governance-policy.ts:214-254` 定义了 allowlist/denylist 敏感字段策略
- 所有 error message 均使用中文安全文案，不暴露底层错误

## 五、建议后续任务

### 近期建议（完善当前阶段）

1. **切换概览数据源到 repository。** 当前 `getPlatformKnowledgeOverviewResponse`、`getPlatformKnowledgeFilesResponse`、`getPlatformKnowledgeItemsResponse` 全部使用 mock 数据。建议为 overview 和 list 创建对应的 repository 查询（类似 `listKnowledgeItems` 已有 repository 方法），使运营看板反映真实数据。

2. **为导入任务 Tab 添加 repository 数据源。** 解析任务完成后已在 DB 中存储 parse record，可以关联查询展示真实任务列表。

3. **补充 chunk 解析的集成测试。** 当前测试只验证了 mock fetch 链路，建议增加对 `parsePlatformKnowledgeDocumentFileService` 的单元测试，验证不同文件类型的文本提取逻辑。

### 中期建议（下一阶段）

4. **接入真实 AI provider 前的准备工作清单**（已在 `platform-knowledge-production-governance-policy.ts:232-238` 中定义）：
   - 完成密钥治理
   - 成本限额
   - 质量评估
   - 安全评估（含 prompt injection 防护）
   - 灰度开关
   - 回滚方案

5. **补全知识条目 Tab 的分页交互。**

6. **考虑恢复能力状态卡片或在合适位置展示当前系统边界**，让运维人员了解哪些功能处于受控试用阶段。

### 长期建议

7. **真实向量数据库接入**（需先完成选型、schema/migration 审批、租户隔离、索引重建方案）。

8. **runtime ingestion 启用**（需先完成 worker/queue/scheduler 方案、幂等、重试、死信和可观测性）。

9. **OCR 接入**（需先完成文件安全策略、扫描件识别质量评估、失败补偿方案）。

10. **将 demo session 认证切换为生产级认证**（如果进入正式发布阶段）。

---

**审查结论：** 知识库管理功能已实现完整的"上传→解析→chunk→关键词检索→mock embedding→语义检索→mock QA→审计"闭环链路。文件管理操作区（上传、下载、解析、归档）为真实 DB+文件系统操作，检索和审计为真实 DB 查询。AI 层面的 embedding 和回答生成均为 deterministic mock/local 实现，不调用真实第三方服务。概览数据目前为 mock 示例数据，需切换为 repository 数据源才能反映真实运营状态。整体架构安全边界清晰，敏感字段已做隔离处理。
