# WORKBENCH-FOLLOWUP-01：正式工作台随访全量统计与优先待办

## 任务与启动基线

- 日期：2026-10-05，Asia/Shanghai（命令返回 CST +0800）。
- 本阶段：正式机构工作台随访读取改进。用户在治理 PR #1275 收口后授权按推荐启动下一批。
- 基线及初始 HEAD：`34aa7f47b20c063283d34b469bb5b331fae28012`，包含 #1274、#1276、#1277、#1275。
- 分支：`codex/workbench-followup-01-20261005`，从上述远端主线创建干净隔离工作树。
- Git 元数据创建／删除探针、远端访问检查通过；主 Agent 单写，其他 Agent 只读复核。
- 原目录 `main` 经不重叠检查后安全快进到同一基线；已有 234 个修改或未跟踪文件的内容摘要和工作树状态均保持不变。

## 问题与结果

原读取按到期时间取前 101 条，再在内存中过滤活跃任务、统计卡片。最早 101 条均为已完成或已取消时，后面的真实今日待办可能全部漏掉；高风险任务也可能被截断。

新工作台查询在同一只读、可重复读事务中读取当前成员可见的逾期／今日全量计数，以及最多 6 条优先候选。先排除终态和未来任务，再依次按高风险、到期时间、稳定 ASCII ID 排序。统计不会因候选上限而减少。

编排先读可信机构运营上下文，固定一次参考时间并派生业务日期；查询和投影使用同一时区与上下文版本。上下文缺失、读取异常、损坏计数、跨机构／重复／终态／未来候选或数量矛盾均表现为不可用，不能补成零。

## 文件与兼容范围

4 个核心文件：

1. `src/modules/care/ports/formal-follow-up-store.ts`：增加独立工作台查询类型及存储扩展。
2. `src/modules/care/server/formal-follow-up-repository.ts`：全量聚合和限量优先候选。
3. `src/server/orchestration/institution-care-action-source.ts`：可信上下文、授权及读取接线。
4. `src/modules/care/application/formal-care-action-source.ts`：分离计数与候选，验证快照并投影。

3 个相关测试文件与本说明共 4 个辅助文件，均服务于同一读取行为，完整 PR 为 8 个文件。

保留原分页列表、受控写入接口和权限语义；保持四个分区、两个预约分区未发布、顶层 partial、5 秒 freshness、原 bucket 下钻及详情链接。全局工作台聚合器继续负责会话混排、桌面 6 条和移动 4 条上限。

本轮不涉及 Approved V1.1 工作台、数据库 schema／Migration、真实业务数据库、外部系统、后台任务、依赖变更、正式发布或新的业务板块。独立治理规则修改不夹带在此功能 PR。

## 验证与证据边界

- `pnpm test src/modules/care/tests src/modules/institution-workbench/tests`：52 个文件、498 个用例通过。
- 增强仓库权限布尔表达式与完整分桶 SQL 断言后，重新运行 `pnpm test src/modules/care/tests/FormalFollowUpWorkbenchRepository.test.ts`：20 个用例通过。
- 临时注入权限 AND→OR、移除机构时区两种变异：断言均正确捕获，生产文件已按原内容完整恢复；两项独立只读复核通过。
- `pnpm typecheck`：通过。`pnpm lint`：通过，4 项已有 img 警告，不在本次范围。
- `git diff --check`：通过。提交后以 `pnpm check:architecture -- --base origin/main --head HEAD` 核验增量架构；GitHub 必需工作流按当前 Head 执行完整质量检查。
- 验收覆盖：155 条计数、前 101 条终态、后段高风险、稳定 ID 排序、四角色个人／角色池可见性、上海和纽约跨日、异常快照、真实全局聚合器 6／4 与会话混排。
- 仓库测试使用隔离传输模拟，并编译实际 Drizzle SQL，完整核验权限括号、AND／OR 关系、聚合、机构时区及排序；没有执行真实 PostgreSQL 查询，未宣称真实环境性能或数据验收。

最终提交、GitHub 检查链接及草稿 PR 状态以 PR 描述为准。

## 风险与回滚

新增全量聚合会扫描当前成员可见范围；未执行真实数据规模的查询计划或性能测试。本轮不增加索引，部署前若大租户性能证据不足，应在获准的隔离环境补充验证。

回滚本功能提交可恢复原工作台读取路径；无需数据或 Migration 回滚。当前交付为功能分支与草稿 PR，不自动进入正式审查、合并或部署。
