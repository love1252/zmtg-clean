# 智美天工当前项目状态

- 更新时间：2026-07-25
- 仓库：`love1252/zmtg-clean`
- 当前重构分支：`refactor/directory-foundation-20260725-204841`
- 重构基线：`1613c4b320b185fb1ebe79dbc9899be4acca647d`
- 架构形态：模块化单体
- 数据库迁移目录：`drizzle/`
- 数据库运行时入口：`src/server/db/`

## 当前重点问题

1. `src/modules/institution/` 体积较大，混合页面、领域、服务和业务能力。
2. `src/modules/open-platform/` 聚合了较多平台端职责。
3. 客户、随访、知识库和工作台存在职责重叠。
4. API 同时存在版本化与非版本化路径。
5. 项目文档较多，但缺少统一的状态与下一任务入口。

## 当前重构边界

- 不修改 Schema。
- 不修改 Migration。
- 不修改 package.json 或 lockfile。
- 不连接真实数据库。
- 不调用真实 HIS。
- 不调用真实企业微信。
- 不改变租户隔离和权限模型。
- 第一阶段不移动正式源码。
