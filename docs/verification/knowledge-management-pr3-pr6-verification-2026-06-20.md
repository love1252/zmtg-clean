# 知识库管理 PR3-PR6 验收说明

> 分支：`codex/old-ai-model-config-parity-01`
> 日期：2026-06-20 CST +0800
> 目标：供 Claude Code 对平台端 `知识库管理` PR3-PR6 做复审

## 一、任务边界

本轮覆盖 PR3 到 PR6 的收口能力：

| PR | 目标 | 本轮验收点 |
| --- | --- | --- |
| PR3 | 文件与导入任务真实数据闭环 | 概览文件列表携带 `tenantId + knowledgeId + fileId`，批量下载按每个文件自身归属调用下载接口；导入任务继续由文件解析状态派生 |
| PR4 | 检索、向量、QA 与审计边界收口 | 页面明确标识关键词检索为真实链路，向量索引与知识库问答为 `mock/local`，审计只展示低敏字段 |
| PR5 | 按钮与交互真实性治理 | `功能真实性` 卡片拆分真实链路、`mock/local`、未启用能力；OCR、真实 AI、worker / queue / scheduler 标识为未启用 |
| PR6 | 白色主题布局与验收收口 | 维持白色后台主题、默认进入文件管理工作区、下线生产能力状态大卡片 |

本轮不包含：

- 不运行 migration。
- 不读取 `.env` / `.env.local`。
- 不接真实 AI、OCR、向量数据库、worker、queue、scheduler。
- 不输出任何凭据、连接配置、存储定位键或向量原文等敏感内容。
- 不提交、不推送、不创建 PR。

## 二、功能真实性矩阵

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| 概览数据 | `repository` 时为真实链路，mock fallback 时为 mock | 页面显示当前 `dataSource` |
| 文件管理 | 真实链路 | 上传、解析、下载、归档走平台端知识库 API |
| 批量下载 | 真实链路 | 已修复为逐文件使用自身 `tenantId + knowledgeId + fileId` |
| 关键词检索 | 真实链路 | 基于已解析 chunk 的服务端关键词匹配 |
| 向量索引 | `mock/local` | 不接真实向量库，不输出向量原文 |
| 知识库问答 | `mock/local` | 不调用真实 AI，展示引用结构与低敏审计编号 |
| 问答审计 | 低敏只读 | 不展示 prompt、answer 原文、凭据或存储定位键 |
| OCR | 未启用 | 页面明确标识未启用 |
| 真实 AI | 未启用 | 页面明确标识不调用外部 AI、Embedding 或重排模型 |
| worker / queue / scheduler | 未启用 | 页面明确标识本阶段不启用后台异步调度 |

## 三、重点修复

1. 文件 DTO 增加可选 `knowledgeId` 归属字段。
2. repository 的文件概览返回 `knowledgeDocumentId`，用于跨机构、跨知识库文件操作。
3. 批量下载不再使用当前下拉选中的知识库上下文，而是按每个已选文件自身归属拼接下载 URL。
4. `功能真实性` 卡片增加独立 `aria-label="知识库功能真实性状态"`，方便自动化验收。
5. 真实性行从合并文案拆成独立能力：文件管理、关键词检索、向量索引、知识库问答、OCR、真实 AI、worker / queue / scheduler。

## 四、建议 Claude Code 复审命令

```bash
date '+%Y-%m-%d %Z %z'
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short
git diff --check
pnpm test src/modules/open-platform/tests/OpenPlatformKnowledgeManagementPanel.test.tsx
pnpm test src/modules/open-platform/tests/OpenPlatformKnowledgeManagementRealApiRoute.test.ts src/modules/open-platform/tests/PlatformKnowledgeFileManagementApiRoute.test.ts
pnpm exec eslint src/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel.tsx src/modules/open-platform/server/platform-knowledge-management-repository.ts src/modules/open-platform/server/platformKnowledgeManagementApiContract.ts src/modules/open-platform/tests/OpenPlatformKnowledgeManagementPanel.test.tsx
pnpm exec tsc --noEmit --pretty false
```

## 五、复审重点

- 点击 `知识库管理` 后默认展示白色主题文件管理工作区。
- 页面不再出现 `生产能力状态` 卡片。
- `功能真实性` 卡片内能看到：
  - `概览数据`
  - `文件管理`
  - `关键词检索`
  - `向量索引`
  - `知识库问答`
  - `OCR`
  - `真实 AI`
  - `worker / queue / scheduler`
- 批量下载已选文件时，fetch URL 应分别使用每个文件自己的 `tenantId` 和 `knowledgeId`。
- 页面与响应不应展示任何凭据、连接配置、存储定位键或向量原文等敏感内容。
