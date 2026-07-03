# V0.6-KB-REAL-MINIMUM-CLOSED-LOOP-01

日期：2026-07-04

## 本轮目标

本轮在现有知识库 DB / schema / API / service / repository 基础上完成真实知识库最小闭环的页面接入，重点让机构端知识库卡片面板从纯静态受控壳转为可读取真实机构端数据，并开放 txt / md 上传与关键词检索测试。

## 本轮实现的真实功能

1. 机构端真实知识列表接入
   - `InstitutionKnowledgeBaseCardPanel` 调用现有 `listInstitutionKnowledgeItems`，读取 `/api/institution/knowledge-management/items` 的机构可见知识。
   - 指标卡基于真实返回的知识条目、文件记录和解析状态计算。
   - 当前机构无数据时展示真实空状态，不用静态示例冒充生产数据。

2. 机构端文件 / 文档卡片接入
   - 对当前可见知识调用现有 `/api/institution/knowledge-management/items/[knowledgeId]/files`。
   - 展示真实文件名、类型 / 大小、解析状态、解析字符数、更新时间、错误信息。

3. 机构端上传文档接入
   - 上传入口从 disabled 改为可用。
   - 使用现有 `POST /api/institution/knowledge-management/upload`。
   - 本轮 UI 仅开放 `.txt` / `.md`，避免误导复杂文档深度解析已完成。
   - 上传后刷新真实知识列表和文件列表。
   - 已提供 loading / success / error 状态。

4. txt / md 简单解析闭环
   - 上传后复用现有机构端 upload service，其内部复用现有文件存储、知识来源 / 文档创建和解析 service。
   - 解析结果通过文件卡片和解析任务记录展示。

5. 机构端关键词检索测试接入
   - 检索按钮从 disabled 改为可用。
   - 使用现有 `GET /api/institution/knowledge-management/search`。
   - 展示命中结果、空结果和错误态。
   - 明确不调用 AI provider，不使用向量数据库。

6. 平台端真实数据查看保持可用
   - 本轮未改平台端知识库 API / service / repository。
   - 定向运行了平台端知识库面板测试，确认现有卡片 UI 未被破坏。

## 按钮状态

### 已启用

- 上传文档
- 开始检索测试
- 刷新真实数据

### 仍保持受控 / 后续接入

- 新建知识：待接入可靠新建知识 API。
- 新建文件夹：待接入目录写入 API。
- 重新解析：待接入机构端重新解析触发入口。
- 重新训练：未接训练 runtime。
- 删除：待接入删除审计和恢复策略。
- AI 问答、向量检索、真实训练：本轮不接入。

## API / service / repository 说明

- 未新增 API route。
- 复用已有机构端 API：
  - `GET /api/institution/knowledge-management/items`
  - `GET /api/institution/knowledge-management/items/[knowledgeId]/files`
  - `POST /api/institution/knowledge-management/upload`
  - `GET /api/institution/knowledge-management/search`
- 复用已有 service / repository：
  - 机构端知识列表 service
  - 机构端上传 service
  - 平台端文件解析 service
  - 平台知识库 repository
  - 机构端关键词检索 service

## DB / schema / migration

- 未新增 DB/schema/migration。
- 未改 `drizzle/**`。
- 未改 `src/server/db/**`。
- 现有表已支持本轮最小闭环：知识来源、知识文档、文件记录、解析记录、解析片段、机构可见性和 QA audit 基础表。

## 未接入能力

- 未接 AI provider。
- 未接真实向量数据库。
- 未做复杂 PDF / Word / Excel 深度解析。
- 未做 OCR。
- 未做生产级异步队列 / worker / cron。
- 未做自动训练模型。
- 未宣称生产可用闭环。

## 租户隔离

租户隔离继续依赖现有机构端 API / service：

- 机构端 API 从请求上下文解析 `tenantId` / `institutionId`，不接受前端传入覆盖。
- `listInstitutionKnowledgeItemsService` 只返回当前 tenant 下本机构自有或平台授权可见的知识。
- 关键词检索 service 只检索当前 tenant 下、active 文件、解析成功且本机构可见的知识片段。
- 本轮新增 UI 测试确认不会渲染其他机构不可见知识；既有 service/API 测试继续覆盖跨 tenant / institution 隔离。

## 审计覆盖

- 本轮没有新增审计表或审计 route。
- 现有 QA audit 能覆盖问答链路，但本轮未启用 AI 问答。
- 目录操作已有 audit event 基础，但本轮未启用目录写入。
- 上传、解析、关键词检索是否写入完整统一 audit event 当前未在本轮补齐；这是后续风险项，不能伪装为已完整审计。

## 后续专项审查

后续必须由 6 个专项审查智能体分别检查：

1. 租户隔离与权限边界。
2. 上传 / 文件存储安全。
3. 解析与低敏 DTO 泄露风险。
4. 关键词检索与错误态安全。
5. 平台端知识库管理回归。
6. 审计覆盖与后续真实功能接入风险。
