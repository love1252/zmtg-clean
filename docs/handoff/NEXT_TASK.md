# 下一任务

## 当前任务

执行第十九阶段：API 单一路由族试点设计。

## 唯一试点候选

- 路由族：`/api/institution/wecom-official-dry-run`
- 路由文件：`src/app/api/institution/wecom-official-dry-run/route.ts`
- 路由 URL：`/api/institution/wecom-official-dry-run`
- HTTP 方法：`GET`
- 版本分类：`unversioned`
- 选择层级：`A_unversioned_tested_no_runtime_consumer`

该候选是相对低风险的设计对象，不表示生产风险为低，也不表示允许直接修改 API。

## 目标

围绕唯一候选路由族形成完整、可回退的兼容迁移设计，明确：

1. 当前入口和建议目标入口；
2. Handler 复用或兼容入口方案；
3. 已知调用方处理方式；
4. 权限、租户隔离和错误响应等价性；
5. 兼容期和弃用信号；
6. 最低观测要求；
7. 退役条件；
8. 精确回退步骤；
9. 第二十阶段允许修改的精确文件清单。

## 必须输出

1. 单一路由族试点设计文档。
2. 兼容契约清单。
3. 调用方处理清单。
4. 允许文件白名单。
5. 验证计划和回退计划。

## 禁止范围

- 不修改或移动任何 API 文件。
- 不修改调用方。
- 不新增代理、重定向或兼容入口。
- 不修改 `file-migration-matrix.csv`。
- 不改变运行时行为。
- 不修改 Schema、Migration、package 或锁文件。
- 不连接数据库或真实外部服务。
- 不扩大到第二个路由族。

## 验收重点

- 只能设计 `/api/institution/wecom-official-dry-run`。
- 所有已知调用方都有明确处理结论。
- 外部未知客户端继续作为风险保留。
- 原入口在试点期内必须可用。
- 第二十阶段必须能够独立回退。
- 未经单独授权不得实施 API 迁移。

## 后续阶段

第二十阶段仅在第十九阶段设计通过并获得单独授权后，实施该单一路由族试点。
