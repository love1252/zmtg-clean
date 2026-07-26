# 第二十九阶段 A：下一模块选择与审计启动决策

- 日期：2026-07-27
- 启动基线：`2dd855e3e5ff51aa36326f5f0b353403fa1e1b98`
- 审计范围：`src/modules/` 下除 `institution`、`open-platform` 外的一级模块
- 模式：audit-only
- 候选模块数：17
- 唯一下一模块：`src/modules/platform-homepage/`
- 第一与第二候选分差：6.0797
- 本任务不构成源码移动或试点实施授权

## 选择方法

选择基于机器证据评分，综合考虑：

1. TypeScript 文件规模；
2. 运行时边界文件比例；
3. 跨模块入向和出向依赖边；
4. 与已闭环 `institution`、`open-platform` 的耦合边；
5. 双向模块依赖；
6. 代表性测试入口；
7. domain、contract、types 等稳定边界文件；
8. index、contract、facade 等稳定入口。

评分只用于确定下一详细审计模块，不表示该模块可以直接迁移。

选择分数是相对排序值，不是百分制，不代表重构完成率或源码迁移授权。

## 候选模块结果

| 排名 | 模块 | TS/TSX | 测试入口 | 运行时边界 | 出向边 | 入向边 | 已闭环模块耦合 | 分数 | 选择 |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | `src/modules/platform-homepage/` | 2 | 1 | 0 | 0 | 0 | 0 | 102.12 | 是 |
| 2 | `src/modules/institution-knowledge/` | 8 | 4 | 0 | 0 | 0 | 0 | 96.04 | 否 |
| 3 | `src/modules/customer-center/` | 14 | 8 | 0 | 3 | 0 | 0 | 93.94 | 否 |
| 4 | `src/modules/institution-conversations/` | 24 | 15 | 0 | 4 | 0 | 0 | 93.25 | 否 |
| 5 | `src/modules/care/` | 14 | 6 | 0 | 0 | 0 | 0 | 92.74 | 否 |
| 6 | `src/modules/institution-analytics/` | 18 | 9 | 3 | 0 | 0 | 0 | 91.55 | 否 |
| 7 | `src/modules/institution-system/` | 20 | 10 | 6 | 0 | 1 | 1 | 88.16 | 否 |
| 8 | `src/modules/deployment/` | 2 | 1 | 1 | 0 | 1 | 0 | 82.77 | 否 |
| 9 | `src/modules/institution-contracts/` | 22 | 24 | 0 | 0 | 61 | 10 | 76.51 | 否 |
| 10 | `src/modules/institution-workbench/` | 22 | 11 | 6 | 45 | 1 | 3 | 73.78 | 否 |
| 11 | `src/modules/knowledge-base/` | 24 | 13 | 15 | 4 | 18 | 9 | 66.25 | 否 |
| 12 | `src/modules/marketing/` | 4 | 8 | 3 | 2 | 19 | 13 | 64.02 | 否 |
| 13 | `src/modules/auth/` | 20 | 20 | 13 | 16 | 50 | 14 | 35.16 | 否 |
| 14 | `src/modules/workspace/` | 29 | 21 | 5 | 52 | 11 | 50 | 13.13 | 否 |
| 15 | `src/modules/audit/` | 12 | 41 | 8 | 8 | 109 | 90 | -38.19 | 否 |
| 16 | `src/modules/security/` | 39 | 119 | 22 | 25 | 278 | 178 | -182.14 | 否 |
| 17 | `src/modules/branding/` | 1 | 0 | 0 | 0 | 0 | 0 | 92.00 | 否 |

## 唯一下一模块

- 模块：`src/modules/platform-homepage/`
- TypeScript 文件：2
- 代表性测试入口：1
- 运行时边界文件：0
- 跨模块出向边：0
- 跨模块入向边：0
- 与已闭环模块耦合边：0
- 双向模块依赖：0
- 选择分数：102.1203

## 第二十九阶段 B 详细语义校正

详细审计确认：

- `domain/homepage-content.ts` 是生产 domain／contract 文件；
- `tests/PlatformHomepageContentContract.test.ts` 是测试证据，不是生产稳定入口；
- 生产 domain／contract 文件数由启发式统计 2 修正为 1；
- 稳定入口文件数由启发式统计 1 修正为 0；
- 选择分数由 105.8203 修正为 102.1203；
- `platform-homepage` 仍保持排名 1，唯一选择结论不变。

本校正只修正文档机器证据，不修改源码。

## 下一任务精确审计范围

下一任务只允许审计：

1. `src/modules/platform-homepage/` 内全部 TypeScript 文件；
2. 直接指向该模块的入向源文件；
3. 该模块直接指向的跨模块目标；
4. 与该模块有关的代表性测试入口；
5. 已存在的稳定入口、domain、contract、types 和 runtime 边界。

必须输出：

1. 逐文件职责清单；
2. 模块内部依赖边；
3. 跨模块入向和出向依赖边；
4. 运行时边界清单；
5. 领域所有权建议；
6. 最多一个后续低风险试点候选；
7. 精确允许文件、禁止范围和回退边界。

## 禁止范围

- 不修改或移动任何 `src/` 文件；
- 不修改 API；
- 不修改 `file-migration-matrix.csv`；
- 不修改 Schema、Migration、package 或锁文件；
- 不连接真实数据库、HIS、企业微信或外部服务；
- 不读取或输出真实凭证；
- 不改变权限、租户隔离、错误响应或真实渠道行为；
- 不创建无边界的全局 shared 目录；
- 不自动实施源码试点。

## 回退边界

本任务只允许修改：

- `docs/refactor/phase-29-module-candidate-inventory.csv`
- `docs/refactor/phase-29-next-module-selection.md`
- `docs/handoff/NEXT_TASK.md`

可通过删除本任务分支并恢复启动基线完整回退。
