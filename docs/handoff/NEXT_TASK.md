# 下一任务

## 当前任务

执行第三十阶段：遗留安全治理与闭环预审。

## 第二十九阶段结论

- 四类跨模块责任链路已完成去重后的统一审计；
- 文件级依赖以 `source_path + target_path + specifier` 去重；
- 伪模块所有者未参与循环和候选判断；
- 候选模块对及逐项淘汰原因已写入 `docs/refactor/phase-29-cross-module-pilot-candidates.csv`；
- 未发现同时满足低风险规则且具有明确职责收益的唯一候选；
- 决策：`no_safe_candidate`；
- 决策原因：`no_eligible_candidate`；
- 不创建第二十九阶段源码实施分支；
- `platform-homepage` 的 `no_candidate` 结论继续有效；
- 逐模块串行审计方案已停止。

## 第三十阶段范围

1. Demo Seed CLI 守卫策略与核心 Seed Guard 一致性；
2. 旧 `DemoAuthRoutes` 测试与当前认证契约漂移；
3. 迁移矩阵和遗留风险最终预审。

## 默认保护边界

- 两项代码治理分别固定允许文件；
- 不执行真实 Seed、Migration 或数据库连接；
- 不读取或输出真实凭证；
- 不修改未授权 Schema、Migration、package 或锁文件。
