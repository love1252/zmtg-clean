# V0.6 Open Platform Knowledge Management Card UI Upgrade 01

日期：2026-07-03

## 本轮目标

本轮只做平台端知识库管理 UI / 信息架构升级，参考旧版 `zmtg-projects` 的平台端知识库管理卡片体验，但不复制旧版后端、不接旧版 API、不改数据库结构。

新版实现继续复用 `zmtg-clean` 已有的知识库 API contract、viewLoader、service、repository，以及 `OpenPlatformKnowledgeManagementPanel` 当前的数据加载链路。

首轮验收合格线：打开新版平台端知识库管理页后，文件管理 tab 不再只是表格，而是可以看到文件卡片网格；每张卡片能快速识别文件名、所属机构、解析状态、类型 / 大小、分类 / 文件夹、解析字符数、更新时间、错误信息和受控操作入口。

## 已新增或强化的卡片

1. 顶部 5 个运营指标卡：
   - 接入机构
   - 知识条目
   - 累计命中
   - 训练 / 解析覆盖
   - 待优化
2. 左侧机构卡片：展示知识数、命中数、覆盖率、运营状态，并继续通过 `selectedTenantId` 联动当前页面范围。
3. 当前范围健康卡：展示导入成功率、命中覆盖率、训练 / 解析覆盖率。
4. 文件管理 tab 文件卡片网格：展示文件名、机构、解析状态、文件类型 / 大小、分类、文件夹、解析字符数、更新时间、错误信息、下载 / 操作按钮。
5. 右侧运营信号卡片：展示高频问题、热门分类、零命中知识、导入成功率。

## 指标来源

来自新版现有数据契约的指标：

- `view.allTotals.tenantCount`
- `view.allTotals.knowledgeCount`
- `view.allTotals.hitCount`
- `view.allTotals.trainingCoverageRate`
- `view.allTotals.pendingOptimizationCount`
- `view.totals.importSuccessRate`
- `view.totals.hitCoverageRate`
- `view.totals.trainingCoverageRate`
- `view.categoryStats`
- `view.topQuestions`
- `filesResponse.records`
- `itemsResponse.records`

前端受控派生 / fallback：

- 覆盖率在当前范围没有知识、文件或任务数据时显示“暂无可用数据”，不伪装真实统计。
- 机构运营状态由知识数、源文件数、异常导入任务数、待优化数前端受控派生。
- 零命中知识由当前范围知识条目 `hitCount === 0` 派生。
- 文件卡片“操作受控”按钮保持禁用，用于说明本轮不新增操作接口。

## 未包含内容

- 未新增 API route。
- 未改 API URL。
- 未改 repository / service。
- 未改 DB / schema / migration。
- 未执行 migration / db:seed。
- 未做真实上传、解析、训练 runtime 改造。
- 未引入新 UI 库或新依赖。
- 未复制旧版后端代码。
- 未接旧版 API。

## 后续建议

如果后续需要真实统计 API、真实训练状态、真实训练任务编排、文件操作权限细化或跨租户运营统计，需要单独立项并补充对应后端 contract、权限测试和测试服验收。
