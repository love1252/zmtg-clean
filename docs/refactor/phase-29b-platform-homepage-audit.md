# 第二十九阶段 B：platform-homepage 职责与依赖审计

- 日期：2026-07-27
- 启动基线：`830f0854ef236181fb4969da2209171972d2ee34`
- 审计模块：`src/modules/platform-homepage/`
- 模式：audit-only
- TypeScript 文件：2
- 生产领域文件：1
- 契约测试文件：1
- 内部依赖边：1
- 外部入向依赖边：0
- 外部出向依赖边：0
- 运行时边界文件：0
- 数据库访问：0
- 外部网络访问：0
- 环境变量访问：0

## 逐文件职责

### `src/modules/platform-homepage/domain/homepage-content.ts`

- 职责：平台首页内容合同、默认发布内容、草稿版本治理、字段规范化和安全校验；
- 领域所有者：`platform_homepage_content`；
- type exports：18；
- const exports：3；
- function exports：4；
- 运行时边界：无；
- 跨模块依赖：无；
- 建议动作：`keep_current`。

### `src/modules/platform-homepage/tests/PlatformHomepageContentContract.test.ts`

- 职责：平台首页 CMS 内容合同验收；
- 测试用例：8；
- 运行时边界：无；
- 唯一内部依赖：指向 `src/modules/platform-homepage/domain/homepage-content.ts`；
- 建议动作：`keep_current`。

## 依赖结论

- 内部依赖边恰好 1 条；
- 该边仅为契约测试导入领域合同；
- 跨模块入向依赖为 0；
- 跨模块出向依赖为 0；
- 无循环依赖；
- 无双重领域所有权。

## 运行时边界结论

两个文件均不读取数据库、环境变量、请求上下文或外部网络，也不承担 API、Repository、Provider、Gateway 或 Client 职责。

## 领域所有权建议

唯一领域所有者为：

`platform_homepage_content`

职责边界包括：

1. 首页 Header、Hero、Stats、Features、Clients、Plans、Footer 和 SEO 合同；
2. draft／published 版本元数据；
3. 文案、链接、图片和数组长度校验；
4. 知识库敏感字段隔离；
5. 对应契约测试。

## 阶段 A 机器证据校正

阶段 A 使用文件名启发式，将测试文件名中的 `Contract` 同时计入 domain／contract 和稳定入口。详细语义审计已修正为：

- domain／contract 文件：1；
- 稳定生产入口：0；
- 修正后选择分数：102.1203；
- 排名仍为第 1；
- 唯一选择结论不变。

## 低风险试点结论

本模块明确为：

`no_candidate`

原因：

1. 生产文件已位于正确的 `domain/` 目录；
2. 测试已位于正确的 `tests/` 目录；
3. 无外部运行时调用方；
4. 无跨模块依赖；
5. 无运行时边界；
6. 当前创建新入口或移动文件只会增加无收益改动。

因此不进入源码试点设计或实施。

## 下一模块

完成本模块 audit-only 闭环后，按修正后的候选排序，下一详细审计模块为：

`src/modules/institution-knowledge/`

该模块必须在独立任务中审计，不在本 PR 中展开。

## 本任务精确允许文件

本任务只允许修改以下 8 个文档文件：

- `docs/refactor/phase-29-module-candidate-inventory.csv`
- `docs/refactor/phase-29-next-module-selection.md`
- `docs/handoff/NEXT_TASK.md`
- `docs/refactor/phase-29b-platform-homepage-file-responsibility-inventory.csv`
- `docs/refactor/phase-29b-platform-homepage-dependency-edges.csv`
- `docs/refactor/phase-29b-platform-homepage-runtime-boundaries.csv`
- `docs/refactor/phase-29b-platform-homepage-audit.md`
- `docs/refactor/phase-29b-platform-homepage-pilot-decision.md`

## 禁止范围

- 不修改或移动任何 `src/` 文件；
- 不修改 API；
- 不修改 `docs/refactor/file-migration-matrix.csv`；
- 不修改 Schema、Migration、package 或锁文件；
- 不连接数据库、HIS、企业微信或外部服务；
- 不读取或输出真实凭证；
- 不改变权限、租户隔离、错误响应或真实渠道行为；
- 不创建全局 shared 目录；
- 不实施源码试点。

## 回退边界

删除本任务分支并恢复启动基线即可完整回退；所有源码和运行时行为保持不变。
