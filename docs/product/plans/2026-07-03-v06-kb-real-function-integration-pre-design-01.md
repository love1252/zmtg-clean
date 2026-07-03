# V0.6-KB-REAL-FUNCTION-INTEGRATION-PRE-DESIGN-01：知识库真实功能接入前置设计

## 1. 日期 / 时区

- 日期：2026-07-03
- 时区：CST / Asia/Shanghai

## 2. 当前主线

- 仓库：`love1252/zmtg-clean`
- 本地路径：`/Users/dongxiaolong/Documents/zmtg-clean`
- 当前 main / origin/main：`098b3da1b548dd95cc0a634265ee91187a7e7b5f`
- 当前任务性质：docs-only / design-only / no code / no DB migration

## 3. 本轮目标

本轮只做知识库真实功能接入前置设计，目标是回答三个问题：

1. 当前项目中真实知识库功能的基础设施已经到什么程度。
2. 是否可以用一个较大的目标 PR 接入真实功能最小闭环。
3. 后续较大目标 PR 需要哪些专项审查智能体来降低误接、越权和误宣称风险。

本轮不修改产品代码、测试代码、API、DB、配置，不部署，也不做真实上传、解析、训练、检索 runtime 改造。

## 4. 只读盘点范围

本轮只读检查了以下范围：

1. `src/modules/knowledge-base/**`
2. `src/modules/institution/**`
3. `src/modules/open-platform/**`
4. `src/app/api/**knowledge**`
5. `src/app/api/**open-platform**`
6. `src/app/api/**institution**`
7. `src/server/db/**`
8. `drizzle/**`
9. `docs/product/plans/**knowledge**`
10. 相关 tests

重点检索词包括：`knowledge`、`knowledge-base`、`upload`、`parse`、`train`、`search`、`task`、`folder`、`directory`、`audit`、`tenant`、`institution`。

## 5. 当前真实功能基础盘点

### 5.1 DB / schema / migration

当前已有真实知识库 DB schema，不是纯 UI shell。

已存在的 migration / schema 能力包括：

1. `knowledge_sources`
2. `knowledge_documents`
3. `knowledge_chunks`
4. `knowledge_index_jobs`
5. `platform_knowledge_institution_visibility`
6. `knowledge_document_files`
7. `knowledge_document_file_parses`
8. `knowledge_document_file_parse_chunks`
9. `knowledge_document_file_parse_chunk_embeddings`
10. `knowledge_qa_audit_logs`

这些结构已经覆盖知识来源、知识文档、chunk、索引任务、平台授权机构可见性、文件、解析记录、解析 chunk、mock/local embedding 摘要和 QA audit。

结论：当前已有真实知识库 DB schema。后续最小闭环不一定必须新增 schema/migration，但如果要补“知识条目编辑历史、删除原因、人工审核状态、生产级任务队列、文件存储策略审计”等能力，则必须单独审批 DB/schema/migration。

### 5.2 文件 / 文档表

当前已有文件 / 文档表：

1. 文档主表：`knowledge_documents`
2. 文件表：`knowledge_document_files`
3. 解析表：`knowledge_document_file_parses`
4. 解析 chunk 表：`knowledge_document_file_parse_chunks`

平台端和机构端均已有 service 读取这些表的基础路径。

### 5.3 知识条目表

当前 `knowledge_documents` 承担知识条目 / 文档主记录角色，`knowledge_chunks` 和 `knowledge_document_file_parse_chunks` 承担拆分片段角色。

结论：已有知识条目基础表，但“新建知识 / 编辑知识 / 归档知识”所需的写入 API 和 UI 状态还需要统一切片接入。

### 5.4 目录 / 文件夹结构

当前已有目录 / 文件夹的基础表达，但不是独立 `folders` 表：

1. 平台端目录使用 `knowledge_sources.sourceLabel` 与 `knowledge_sources.workspaceId` 表达。
2. 平台端 service 已有 `createKnowledgeDirectory`、`renameKnowledgeDirectory`、`archiveKnowledgeDirectory`、`reorderKnowledgeDirectories`。
3. 平台端 route 已存在 `directories`、`directories/[directoryId]`、`directories/reorder`。

结论：当前已有可用目录结构基础，但未来如要做多级目录、排序权重、软删除原因和审计详情，可能需要进一步 schema 设计。

### 5.5 任务记录结构

当前已有 `knowledge_index_jobs`，也已有文件解析状态、解析 chunk 和 UI 上的导入 / 训练任务记录表达。

结论：已有任务记录雏形，但不是生产级异步任务队列；后续最小闭环可先做同步或受控任务记录，不应直接引入 worker / queue / cron。

### 5.6 上传 API

当前已有上传 API：

1. 平台端：`POST /api/v1/open-platform/knowledge-management/items/[knowledgeId]/files`
2. 机构端：`POST /api/institution/knowledge-management/upload`

同时已有本地文件存储适配：`createLocalPlatformKnowledgeFileStorage`。

结论：已有上传 API 基础，但生产级文件存储策略、容量治理、病毒扫描和高敏扫描仍需专项设计。

### 5.7 解析 API

当前已有解析 API：

1. 平台端：`GET/POST /api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/parse`
2. 平台端 chunk：`GET /api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks`
3. 机构端解析状态：`GET /api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse`
4. 机构端 chunk：`GET /api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks`

当前解析 service 支持 `.txt`、`.md`、`.csv`、`.json`，并有针对 `.pdf`、`.docx`、`.xlsx` 的受控解析尝试和低敏失败态。

结论：已有解析基础，但复杂 PDF / Word / Excel 深度解析不应纳入最小闭环。

### 5.8 训练 API

当前没有“真实训练模型”的 API。现有相关能力更准确地说是：

1. `knowledge_index_jobs` 索引任务记录。
2. mock/local embedding 生成与保存。
3. 向量检索 route / service。
4. UI 中使用“训练 / 解析覆盖”作为运营表达。

结论：当前没有生产级训练 API。后续最小闭环不应宣称“真实训练完成”，可以保留“解析 / 索引任务记录”或“关键词检索可用”。

### 5.9 检索 API

当前已有检索 API：

1. 平台端关键词检索：`GET /api/v1/open-platform/knowledge-management/search`
2. 机构端关键词检索：`GET /api/institution/knowledge-management/search`
3. 平台端向量检索：`GET /api/v1/open-platform/knowledge-management/vector-search`
4. 机构端向量检索：`GET /api/institution/knowledge-management/vector-search`

结论：关键词检索已具备最小闭环基础。向量检索仍应作为后置或只读演示能力，不应在最小闭环中宣称生产级 AI / provider 已接入。

### 5.10 平台端知识库 API

当前平台端知识库 API 已较完整，至少覆盖：

1. 概览：`GET /api/v1/open-platform/knowledge-management`
2. 条目：`GET /api/v1/open-platform/knowledge-management/items`
3. 目录：`POST/PATCH/DELETE /api/v1/open-platform/knowledge-management/directories`
4. 文件：`GET /api/v1/open-platform/knowledge-management/files`
5. 文件上传 / 下载 / 归档 / 解析 / chunk
6. 关键词检索
7. 向量检索
8. QA 与 QA audit
9. 机构可见性绑定

结论：平台端已经不是纯 mock API，已有 repository 数据链路和较多测试覆盖。

### 5.11 机构端知识库 API

当前机构端知识库 API 已覆盖：

1. 授权可见知识条目：`GET /api/institution/knowledge-management/items`
2. 上传：`POST /api/institution/knowledge-management/upload`
3. 文件列表 / 下载 / 解析状态 / chunk
4. 关键词检索
5. 向量检索
6. QA 和 QA audit

结论：机构端也已有真实 API 基础，但当前新卡片 UI / 功能壳仍未把这些能力统一接成可操作闭环。

### 5.12 Repository / service

当前已有 repository / service：

1. `platform-knowledge-management-repository.ts`
2. `platform-knowledge-management-service.ts`
3. `platform-knowledge-file-management-service.ts`
4. `platform-knowledge-document-parsing-service.ts`
5. `platform-knowledge-keyword-search-service.ts`
6. `platform-knowledge-embedding-vector-search-service.ts`
7. `platform-knowledge-qa-service.ts`
8. `institution-knowledge-management-service.ts`
9. `institution-knowledge-upload-service.ts`
10. `institution-knowledge-file-management-service.ts`
11. `institution-knowledge-file-parsing-service.ts`
12. `institution-knowledge-keyword-search-service.ts`
13. `institution-knowledge-vector-search-service.ts`
14. `institution-knowledge-qa-service.ts`

结论：后续最小闭环应优先复用这些现有服务，不应重造平行体系。

### 5.13 审计能力

当前已有：

1. 知识库 QA audit 表：`knowledge_qa_audit_logs`
2. 平台端目录操作部分 audit event 记录。
3. 平台端 / 机构端 QA audit 查询与测试。
4. 全局 audit event 体系可复用。

结论：已有审计基础，但“新建知识、编辑知识、归档 / 删除知识、上传、解析触发、检索测试”等写入链路是否全部写 audit，需要在后续目标 PR 中逐项补齐或明确暂不做。

### 5.14 租户隔离能力

当前已有：

1. 知识库核心表均带 `tenant_id`。
2. 机构端 route 使用 `accessContext.tenantId` 和 `accessContext.institutionId`，不信任客户端覆盖。
3. `platform_knowledge_institution_visibility` 表达平台知识授权机构可见。
4. 搜索和文件下载 service 中已有机构可见性判断。
5. 测试覆盖跨 tenant / 跨 institution 不可见。

结论：已有租户隔离基础，但后续真实功能接入前仍必须做专项租户权限审查。

## 6. 平台端与机构端 UI 按钮可接入真实能力评估

### 6.1 平台端

平台端知识库管理页可优先接入或继续保持的真实能力：

1. 新建目录 / 文件夹：已有 route / service / repository。
2. 重命名目录：已有 route / service / repository。
3. 归档空目录：已有 route / service / repository。
4. 上传文件：已有平台端上传 route / service / storage。
5. 下载文件：已有平台端下载 route / service / storage。
6. 解析文件：已有平台端解析 route / service。
7. 查看解析 chunk：已有 route / service。
8. 关键词检索：已有 route / service。
9. QA / QA audit：已有 route / service，但最小闭环建议暂不接 provider。
10. 机构授权可见性：已有绑定 / 解绑能力。

平台端仍需补齐或审查的能力：

1. 新建知识条目。
2. 编辑知识条目。
3. 归档 / 删除知识条目。
4. 写入操作审计的一致性。
5. UI 按钮从受控 disabled 到真实启用后的错误态和回滚态。

### 6.2 机构端

机构端卡片 UI 可优先接入的真实能力：

1. 上传文档：已有 `POST /api/institution/knowledge-management/upload`。
2. 查看本机构知识条目：已有 `GET /api/institution/knowledge-management/items`。
3. 查看文件 / 下载文件：已有文件 API。
4. 查看解析状态 / chunk：已有解析 API。
5. 关键词检索测试：已有 `GET /api/institution/knowledge-management/search`。

机构端建议后置的能力：

1. 新建知识。
2. 编辑知识。
3. 删除知识。
4. 重新训练。
5. AI 问答正式入口。
6. 向量检索正式入口。

原因：机构端写入权限、审核、审计、内容归属和误操作恢复需要更严格的专项审查。

## 7. 是否可以用一个较大目标 PR 做最小真实闭环

建议可以做一个较大的目标 PR，但必须严格限制为“真实功能最小闭环”，并设置专项审查智能体。

推荐目标 PR：

`V0.6-KB-REAL-MINIMUM-CLOSED-LOOP-01`

推荐理由：

1. 当前已有 DB schema、API route、repository、service 和测试基础。
2. 平台端和机构端 UI 已经有卡片壳和入口，下一步继续只做 shell 会开始堆叠体验债。
3. 最小闭环可以优先打通“目录 / 知识条目 / 文件上传记录 / 简单解析 / 关键词检索 / 基础审计”，避免直接跳到 AI provider 或向量库。
4. 一个较大目标 PR 有利于统一检查跨平台端、机构端、租户隔离、审计和回归测试。

必须注意：较大目标 PR 不是“生产知识库完成”，而是“最小真实闭环可验收”。

## 8. `V0.6-KB-REAL-MINIMUM-CLOSED-LOOP-01` 建议范围

建议包含：

1. 真实新建文件夹。
2. 真实新建知识。
3. 真实编辑知识。
4. 真实归档 / 删除知识。
5. 真实文件上传记录。
6. 真实解析任务记录。
7. 受控文本 / Markdown 简单解析。
8. 关键词检索测试。
9. 平台端可查看机构知识库真实数据。
10. 机构端只能操作本机构数据。
11. 基础审计日志。
12. UI 按钮从 disabled 变成部分真实可用。

建议实现顺序：

1. 先确定使用现有 schema，若必须新增字段则先暂停并单独审批 migration。
2. 先完成 API contract 和权限边界。
3. 再接平台端按钮。
4. 再接机构端按钮。
5. 最后做本地 5010 和测试服验收文档。

## 9. `V0.6-KB-REAL-MINIMUM-CLOSED-LOOP-01` 必须排除

必须排除：

1. 不接 AI provider。
2. 不接向量数据库。
3. 不做复杂 PDF / Word / Excel 深度解析。
4. 不做生产级异步任务队列。
5. 不做自动训练模型。
6. 不做复杂权限矩阵。
7. 不直接宣称生产可用。
8. 不做真实 AI smoke。
9. 不把 mock/local embedding 包装为真实 AI 训练。
10. 不把简单关键词检索包装为完整 RAG。

## 10. 后续必须拆分的功能

以下功能必须拆到后续 PR：

1. DB/schema/migration 扩展。
2. 生产级文件存储策略。
3. 病毒扫描 / 高敏扫描 / 凭证扫描。
4. PDF / Word / Excel 深度解析。
5. OCR。
6. 异步任务队列 / worker / retry / DLQ。
7. AI provider 接入。
8. 向量数据库或生产级 embedding。
9. 复杂角色权限矩阵。
10. 审核流、发布流、版本回滚。
11. 生产上线验收。

## 11. 前置关键判断

### 11.1 是否必须允许 DB/schema/migration

最小真实闭环建议优先不改 DB/schema/migration，复用当前已有表。

但如果后续需求包含以下任一项，必须单独允许 DB/schema/migration：

1. 知识条目编辑历史。
2. 多级目录排序权重。
3. 删除 / 归档原因和恢复。
4. 人工审核状态。
5. 生产级任务队列状态。
6. 文件存储策略版本。
7. 内容安全扫描结果。

### 11.2 是否必须明确文件存储策略

如果要接真实上传，必须明确文件存储策略。

当前已有 local storage adapter 和 `storage_key` 字段，但还需要后续明确：

1. 本地 / 测试服 / 生产存储路径。
2. 文件生命周期。
3. 归档与删除行为。
4. 容量限制。
5. 下载权限。
6. orphan file 清理。
7. 备份和恢复。

### 11.3 是否必须明确 AI / 向量 / provider

如果要接“训练 / 检索”相关能力，必须明确是否使用 AI / 向量 / provider。

本轮建议：

1. 最小闭环只做关键词检索。
2. 不接 AI provider。
3. 不接向量数据库。
4. 不把 mock/local embedding 宣称为真实训练。
5. QA / RAG 可以作为只读演示或后置任务，不纳入最小闭环。

## 12. 专项审查智能体设计

以下 6 个审查智能体只负责审查，不允许改代码。

### 12.1 产品体验审查智能体

- 审查目标：确认平台端和机构端知识库真实功能最小闭环是否易用、文案是否克制、按钮状态是否符合能力边界。
- 输入材料：PR diff、产品文档、平台端和机构端截图或本地 5010 页面、测试用例、API response 示例。
- 测试场景：新建文件夹、新建知识、编辑知识、上传文件、解析文件、关键词检索、错误态、空态、disabled / loading 状态。
- 必须通过条件：用户能理解哪些按钮真实可用，哪些能力仍待接入；不出现“真实训练完成”“生产可用闭环”等误导文案。
- 必须阻断条件：UI 暗示 AI 训练、向量检索或生产可用已完成；错误态暴露技术细节；机构端出现平台内部字段。
- 是否允许改代码：否。

### 12.2 租户权限审查智能体

- 审查目标：确认平台端、机构端、tenant、institution、workspace 的权限和可见范围不串号。
- 输入材料：route 代码、access context、repository 查询、service 权限判断、跨租户测试。
- 测试场景：机构 A 访问机构 B 数据、tenant A 访问 tenant B 数据、平台账号访问机构 API、机构账号访问平台 API、客户端注入 tenantId / institutionId。
- 必须通过条件：机构端只使用 access context 的 tenantId / institutionId；平台端写入必须要求 platform scope；权限拒绝不泄露资源存在性。
- 必须阻断条件：客户端参数覆盖可信租户；跨租户可读写；机构端可调用平台写入；权限拒绝返回敏感细节。
- 是否允许改代码：否。

### 12.3 API 合同审查智能体

- 审查目标：确认 API 请求、响应、状态码、错误码和低敏 DTO 稳定。
- 输入材料：API route、service DTO、client 调用、测试断言、PR body。
- 测试场景：成功、新建、编辑、归档、上传、解析、检索、参数错误、权限拒绝、not found、service unavailable。
- 必须通过条件：API response 不含 `storageKey`、原始 `textContent`、内部 stack、DB URL、provider、token、embeddingVectorJson；状态码与错误文案稳定。
- 必须阻断条件：新增未审查 API route；破坏既有 API URL；response 泄露内部字段；机构端返回平台内部成本或 provider 信息。
- 是否允许改代码：否。

### 12.4 数据安全审查智能体

- 审查目标：确认上传、解析、存储、检索和审计不暴露高敏内容。
- 输入材料：文件处理 service、parser、storage adapter、DB 字段、低敏测试、错误态测试。
- 测试场景：超大文件、非法扩展名、路径穿越文件名、空文件、带凭证文本、带手机号 / 身份证文本、parser 报错、下载权限拒绝。
- 必须通过条件：文件名安全化；失败态低敏；下载权限校验；不展示凭证、客户手机号、身份证、病历详情、SQL、stack、DB URL。
- 必须阻断条件：保存或返回高敏原文；错误态泄露 parser / storage / worker 详情；未授权可下载文件；上传 bypass 类型限制。
- 是否允许改代码：否。

### 12.5 任务流审查智能体

- 审查目标：确认上传、解析、任务记录和检索的流程边界清楚，不把同步能力伪装成生产级异步任务。
- 输入材料：上传 service、解析 service、index job 记录、UI 任务记录、测试日志、PR body。
- 测试场景：上传成功后解析成功、解析失败、部分失败、重复上传、归档后解析、解析前检索、解析后检索。
- 必须通过条件：任务状态解释清晰；overdue / failed / pending 有低敏文案；不宣称生产级队列；不出现无限重试或隐式后台 worker。
- 必须阻断条件：引入未审批 worker / cron / queue；失败后无限重试；UI 宣称自动训练完成；任务记录与真实状态不一致。
- 是否允许改代码：否。

### 12.6 回归测试审查智能体

- 审查目标：确认较大目标 PR 不破坏平台端、机构端、知识库、权限和构建稳定性。
- 输入材料：测试命令输出、coverage 重点、changed files、PR body、CI checks。
- 测试场景：定向知识库 service/API/UI 测试、institution tests、open-platform tests、完整 Vitest、ESLint、build、git diff check。
- 必须通过条件：新增功能有定向测试；完整 Vitest、ESLint、build、git diff check 通过或清晰区分既有无关问题。
- 必须阻断条件：本轮修改文件导致测试失败；跳过关键权限测试；build fail；lint error；PR body 漏写未做边界。
- 是否允许改代码：否。

## 13. 风险与防误导说明

1. 当前已有真实 DB 和部分真实 API，但平台端 / 机构端卡片 UI 中仍有功能壳和受控按钮。
2. “训练 / 解析覆盖”是运营表达，不等于真实模型训练完成。
3. mock/local embedding 不等于 provider 真实调用。
4. 关键词检索不等于完整 RAG。
5. 文件上传可用不等于生产级文件存储策略完成。
6. 解析服务可处理部分格式不等于复杂 PDF / Word / Excel 深度解析完成。
7. QA audit 存在不等于所有写入链路审计完整。
8. 最小闭环 PR 通过后也不能直接宣称生产可用。

## 14. 本轮明确未做

1. 未修改 `src/**`。
2. 未修改 tests。
3. 未修改 `src/app/api/**`。
4. 未修改 repository / service。
5. 未修改 server / domain。
6. 未修改 DB/schema/migration。
7. 未修改 `drizzle/**`。
8. 未修改 `src/server/db/**`。
9. 未修改 package / lock / config。
10. 未引入新依赖。
11. 未部署。
12. 未提交参考图资源。
13. 未做真实上传 / 解析 / 训练 / 检索 runtime 改造。

## 15. 结论

建议下一步进入 `V0.6-KB-REAL-MINIMUM-CLOSED-LOOP-01` 的目标 PR 设计与实现准备。

推荐采用一个较大的目标 PR，但必须满足：

1. 明确不做 DB/schema/migration，除非用户单独批准。
2. 明确不接 AI provider、不接向量数据库、不做复杂解析。
3. 只打通最小真实闭环：目录、知识条目、文件上传记录、简单解析、关键词检索、平台/机构可见范围、基础审计、部分按钮启用。
4. 合并前必须经过 6 个专项审查智能体只读复核。
5. 后续仍需单独做测试服验收和生产上线前安全验收。
