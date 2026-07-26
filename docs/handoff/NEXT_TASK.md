# 下一任务

## 当前任务

执行第二十九阶段 B：`src/modules/platform-homepage/` 职责与依赖审计。

## 审计范围

只读审计：

- `src/modules/platform-homepage/` 内全部 TypeScript 文件；
- 直接指向该模块的入向源文件；
- 该模块直接指向的跨模块目标；
- 该模块的代表性测试入口；
- 稳定入口、domain、contract、types 和 runtime 边界。

## 必须输出

1. 逐文件职责清单；
2. 模块内部依赖边；
3. 跨模块入向和出向依赖边；
4. 运行时边界清单；
5. 领域所有权建议；
6. 最多一个后续低风险试点候选；
7. 精确允许文件、禁止范围和回退边界。

## 默认边界

- 本阶段 audit-only；
- 不修改或移动任何 `src/` 文件；
- 不修改 API；
- 不修改 `file-migration-matrix.csv`；
- 不修改 Schema、Migration、package 或锁文件；
- 不连接真实数据库或外部服务；
- 不读取或输出真实凭证；
- 不改变权限、租户隔离、错误响应或真实渠道行为；
- 不创建无边界的全局 shared 目录；
- 不自动实施源码试点。

## 选择依据

- 候选清单：`docs/refactor/phase-29-module-candidate-inventory.csv`；
- 选择结论：`docs/refactor/phase-29-next-module-selection.md`；
- 唯一模块：`src/modules/platform-homepage/`；
- 选择分数：105.8203；
- 代表性测试入口：1；
- 运行时边界文件：0；
- 跨模块出向边：0；
- 跨模块入向边：0。

## 验证

1. `git diff --check`
2. 逐文件清单与实际文件集合一致
3. 依赖边可追溯
4. 唯一领域所有权建议可解释
5. 无源码、API、迁移矩阵或运行时配置修改
6. `pnpm typecheck`
7. `pnpm lint`
8. 代表性测试
9. `pnpm build`

## 退出条件

- 模块内全部文件均有职责；
- 入向、出向和运行时边界无遗漏；
- 领域所有权建议明确；
- 最多一个低风险试点候选已选定或明确无候选；
- 后续试点设计必须单独授权。
