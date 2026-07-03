# V0.6 Open Platform Knowledge Management Card Reference Alignment 03

日期：2026-07-03

## 任务范围

本轮基于用户提供的 5 张知识库参考图、旧版 `zmtg-projects` 平台端知识库页面，以及新版 `zmtg-clean` 现有知识库数据契约，对平台端知识库管理页做第三轮卡片功能与视觉对齐升级。

旧版仅作为 UI、信息架构、卡片密度与交互层级参考；新版字段真源仍以 `src/modules/open-platform/server/platformKnowledgeManagementApiContract.ts` 和 `src/modules/open-platform/lib/platformKnowledgeManagementViewLoader.ts` 为准，不把旧版 DTO、旧版 API route 或旧版 DB 结构迁入新版。

## 本轮完成的平台端卡片功能

1. 平台端总览区继续保留并强化 5 个运营指标卡：接入机构、知识条目、累计命中、训练 / 解析覆盖、待优化。
2. 当前范围运营摘要继续展示当前机构范围、知识条目、文件数、命中数和数据来源说明。
3. 左侧机构运营卡继续按机构展示知识数、命中数、覆盖率和运行状态，并支持点击联动当前范围。
4. 当前范围健康卡继续展示导入成功率、命中覆盖率、训练 / 解析覆盖率；无数据时使用受控 fallback，不伪装真实统计。
5. 文件管理 tab 保留文件卡片网格，并展示文件名、机构、解析状态、文件类型 / 大小、分类、文件夹、解析字符数、解析片段 fallback、更新时间、错误信息、下载能力和操作状态。
6. 右侧运营信号保留风险等级表达，用于高频问题、热门分类、零命中知识、导入成功率等只读运营信号。
7. 下方运营模块继续保留分类表现、高频问题、知识条目、导入 / 训练任务记录，保持新版 tabs 与只读数据链路。

## 新版真实字段使用

1. 文件卡片解析字符数使用 `PlatformKnowledgeFileDto.parsedChars`。
2. 文件名、机构、解析状态、文件类型、文件大小、分类、文件夹、更新时间、错误信息继续使用新版 files contract 已有字段。
3. 知识条目、分类表现、高频问题、导入任务记录继续使用新版 overview / items / files contract 和 viewLoader 输出。
4. 下载能力只基于新版已有 `tenantId`、`knowledgeId`、`fileId` 与现有下载路径做受控判断，不新增旧版下载接口。

## 受控 fallback

1. 当 `parsedChars` 缺失或不是有限数字时，文件卡片显示“当前数据契约未提供解析字符数”，不显示 `0` 伪装真实统计。
2. 当前 `PlatformKnowledgeFileDto` 未提供文件级解析片段数字段，文件卡片显示“当前数据契约未提供解析片段数”。
3. 当前范围健康卡在缺少可计算数据时显示“暂无可用数据”。
4. 文件卡片操作按钮不新增真实解析 runtime，继续显示受控操作状态。

## 未包含内容

1. 未新增 API route。
2. 未修改 API URL。
3. 未修改 repository / service。
4. 未修改 DB / schema / migration。
5. 未修改 `drizzle/**` 或 `src/server/db/**`。
6. 未引入新依赖。
7. 未复制旧版后端代码。
8. 未接旧版 API。
9. 未做真实上传 runtime 改造。
10. 未做真实解析 runtime 改造。
11. 未做真实训练 runtime 改造。
12. 未修改权限、登录、租户或安全相关代码。

## 机构端参考图后续建议

后 2 张机构端知识库参考图本轮仅记录为后续设计建议：可在后续单独任务中为机构端知识库设计卡片化文件管理、知识条目健康状态、解析任务进度、低命中内容优化入口与受控操作提示。本轮不新增机构端 API、不新增机构端 route、不硬造后端字段，也不把机构端作为代码实现目标。
