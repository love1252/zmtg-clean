# V0.6-KB-REAL-OPERATIONS-CLOSED-LOOP-02B 管理与检索控制台

日期：2026-07-04

## 本轮完成的真实操作

本轮将机构端知识库从上传、解析、简单关键词检索，推进到可管理、可调试、可复验的真实操作闭环：

1. 检索测试台增强。
2. chunk / 片段只读可视化管理。
3. `.txt` / `.md` 文件重新解析与状态刷新。
4. 知识条目基础新建、编辑、软归档。

## 检索测试台能力

机构端保留原有知识库搜索入口，并将检索区域升级为“检索测试台”：

- 支持关键词输入。
- 支持 `topK`，默认 `5`，可选 `3 / 5 / 10`。
- 命中结果展示知识条目标题、文件名、`chunkIndex`、`textPreview`、`matchReason`、`parseStatus`。
- 对关键词命中做高亮展示。
- 支持空结果、`validation_failed`、API 错误的低敏错误态。
- 新一轮检索开始时清空上一轮旧结果。
- 页面明确说明：当前为关键词检索，不是 AI 问答，不调用 AI provider，不使用向量数据库。

## chunk / 片段可视化能力

文件 / 文档记录增加“查看片段”入口，点击后读取该文件解析后的 chunk 列表。

展示字段：

- `chunkIndex`
- `textPreview`
- `charCount`
- 文件名
- 所属知识条目

状态覆盖：加载中、解析成功有片段、无片段、错误态。当前 schema 没有 chunk 启用 / 禁用字段，因此本轮不伪造启停功能；也不做 chunk 编辑或删除。

## 重新解析能力

机构端对 `.txt` / `.md` 文件启用“重新解析”按钮，调用现有 parse service 重新解析文件。

刷新范围：

- 文件 `parseStatus`
- `textLength`
- `chunkCount`
- chunk 列表
- 检索结果（清空旧结果，提示重新复验）

PDF / Word / Excel 继续受控说明，不启用深度解析按钮，不做 OCR，不做复杂文档深度解析。

## 新建 / 编辑 / 归档能力

在不新增 DB schema / migration 的前提下实现：

- 新建知识：标题、分类 / 目录口径、摘要 / 描述。
- 编辑知识：标题、分类 / 目录口径、摘要 / 描述。
- 归档知识：软归档，带确认态，不做物理删除。

机构端不允许前端传可信 `tenantId` / `institutionId`，由服务端 `accessContext` 决定租户与机构。编辑与归档仅允许本机构归属知识；平台授权可见知识不可跨机构编辑或归档。

## 分类 / 目录口径说明

本轮使用已有 `knowledge_sources.sourceLabel` 和 `knowledge_documents.version` 等现有字段承载分类 / 摘要口径，不新增 schema，也不伪装完整文件夹树。页面统一使用“分类 / 目录口径”文案。

## 租户隔离保证

租户隔离由以下层面保证：

1. 机构端 API 从 `getDemoAccessContextFromRequest` 获取 `tenantId` 与 `institutionId`。
2. 新建 / 编辑 / 归档 service 不信任前端传入租户或机构字段。
3. 列表、文件、chunk、检索均继续过滤当前 tenant。
4. 编辑 / 归档前校验 `record.institutionId === accessContext.institutionId`，平台授权条目只读不可改。
5. 测试覆盖跨机构不能编辑 / 归档。

## API route 新增或复用

复用并增强：

- `GET /api/institution/knowledge-management/items`
- `POST /api/institution/knowledge-management/items`
- `PATCH /api/institution/knowledge-management/items`
- `GET /api/institution/knowledge-management/search`
- `GET /api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks`
- `GET /api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse`
- `POST /api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse`

未改变既有 API URL。

## repository / service 变更

有最小变更：

- `institution-knowledge-management-service` 增加新建、编辑、软归档 service。
- `institution-knowledge-write-repository` 在机构端 server 范围内承载新建、编辑、软归档最小写入逻辑。
- `institution-knowledge-file-parsing-service` 增加机构端 `.txt/.md` 重新解析 service。
- `platform-knowledge-keyword-search-service` 在检索 DTO 中补充 `parseStatus`。
- `platform-knowledge-management-repository` 仅保留只读字段兼容与既有平台端能力防回归，不承载机构端编辑 / 归档写入扩展。

## DB / schema / migration / 依赖

本轮未改 DB schema，未新增 migration，未改 `drizzle/**`，未改 `src/server/db/**`，未改 `package.json` 或 lock 文件，未引入新依赖。

## 仍未做

- AI 问答
- RAG
- embedding
- 向量数据库
- rerank
- OCR
- 复杂文档深度解析
- 训练 runtime
- 生产级队列
- 平台端租户 / 套餐管理修复

## 测试结果

已新增 / 更新机构端测试覆盖：检索测试台命中展示、`topK`、空结果、`validation_failed`、API 错误低敏展示、新一轮检索清空旧结果、chunk 成功 / 空 / 错误态、`.txt/.md` 重新解析成功、重新解析失败、PDF / Word / Excel 不误启用深度解析、新建 / 编辑 / 归档、跨机构不能编辑 / 归档、不调用 AI provider、不使用向量数据库、不启用训练 runtime。

最终验证结果以任务完成回报为准。

## 风险与后续建议

1. 当前新建知识摘要复用现有字段承载，适合本轮基础闭环；后续如需完整摘要字段或目录树，需要单独 schema 设计与 migration 授权。
2. 重新解析为同步触发，不含后台队列；后续大文件或批量解析需单独设计 worker / queue。
3. PDF / Word / Excel 继续保持受控文案，避免被误解为生产级复杂解析能力。
4. 归档为软归档，后续可补审计、恢复与更细颗粒度权限。