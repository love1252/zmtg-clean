# V0.6-INSTITUTION-KB-CARD-PANEL-PAGE-LINK-01

日期：2026-07-03

## 背景

本轮将已合并的 `InstitutionKnowledgeBaseCardPanel` 接入现有机构端知识库入口，让机构端页面可以看到机构端知识库卡片 UI / 功能壳。

## 接入位置

- 现有机构端页面入口为 `/hospital`，由 `src/app/hospital/page.tsx` 渲染 `InstitutionWorkspace`。
- `InstitutionWorkspace` 的 `knowledge` 视图已经渲染 `InstitutionKnowledgeReadonlyShell`。
- 本轮在 `src/modules/institution/components/InstitutionKnowledgeReadonlyShell.tsx` 内接入 `InstitutionKnowledgeBaseCardPanel`。

## 本轮范围

- 本轮只是页面接入。
- 保留原有机构端知识库只读内容。
- 新增 / 更新测试，覆盖机构端知识库入口可见卡片面板。
- 新增本任务说明文档。

## 受控边界

- 未新增 API route。
- 未新增页面 route。
- 未改 API URL。
- 未改 repository / service。
- 未改 DB / schema / migration。
- 未改 drizzle 目录。
- 未改 `src/server/db/**`。
- 未改 package / lock / config。
- 未引入新依赖。
- 未做真实上传 / 解析 / 训练 / 检索 runtime。
- 未改登录、权限、租户、安全相关代码。

## 操作状态

`InstitutionKnowledgeBaseCardPanel` 中的上传文档、新建知识、新建文件夹、重新解析、重新训练、删除、检索测试等操作仍为受控 disabled / 待接入说明，不调用 API、不写库、不触发真实能力。

## 后续

后续真实上传、解析、训练、检索与运营数据能力需要通过独立任务统一接入，并继续复核权限、租户、安全和运行时边界。
