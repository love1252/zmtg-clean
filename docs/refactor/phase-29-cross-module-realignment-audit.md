# 第二十九阶段跨模块职责重新对齐审计

- 日期：2026-07-27
- 启动基线：`e324b0cc691f24ed417913b716af602c716190d6`
- 模式：audit-only
- 原逐模块串行审计：superseded
- 依赖边去重：已执行
- 伪模块循环：已排除
- 真实模块 SCC：已计算
- 候选明细：`docs/refactor/phase-29-cross-module-pilot-candidates.csv`
- 最终试点决策：`no_safe_candidate`
- 决策原因：`no_eligible_candidate`
- 唯一试点：`none`

## 四类链路结论

### 知识库与工作台

- 模块：`institution-knowledge|knowledge-base|workspace|institution-workbench`
- TypeScript 文件：83
- 内部生产边：1
- 内部测试边：1
- 入向生产边：9
- 出向生产边：51
- 双向模块对：0
- 真实循环分量：0
- 内部保护边：0
- 邻接保护边：40
- 内部运行时边：1
- 风险：`medium`
- 结论：`audit_only`
- 原因：`internal_runtime_boundary`

### 客户档案与随访

- 模块：`customer-center|care|institution-conversations|institution-contracts`
- TypeScript 文件：74
- 内部生产边：4
- 内部测试边：0
- 入向生产边：11
- 出向生产边：0
- 双向模块对：0
- 真实循环分量：0
- 内部保护边：0
- 邻接保护边：4
- 内部运行时边：0
- 风险：`low`
- 结论：`pilot_candidate_pool`
- 原因：`directed_internal_dependencies`

### 页面层与领域层

- 模块：`platform-homepage|marketing|branding`
- TypeScript 文件：7
- 内部生产边：0
- 内部测试边：0
- 入向生产边：10
- 出向生产边：0
- 双向模块对：0
- 真实循环分量：0
- 内部保护边：0
- 邻接保护边：4
- 内部运行时边：0
- 风险：`low`
- 结论：`keep_current`
- 原因：`no_internal_production_dependency`

### 公共类型与共享服务

- 模块：`institution-contracts|security|audit|auth`
- TypeScript 文件：93
- 内部生产边：9
- 内部测试边：17
- 入向生产边：183
- 出向生产边：10
- 双向模块对：1
- 真实循环分量：1
- 内部保护边：9
- 邻接保护边：182
- 内部运行时边：9
- 风险：`high`
- 结论：`protect_or_defer`
- 原因：`internal_cycle_or_protected_boundary`

## 所有权规则

1. 业务事实和语义由来源领域拥有；
2. `institution-contracts` 只拥有稳定跨模块合同；
3. `security`、`audit`、`auth` 和运行时边界保持保护；
4. 不允许双重所有权和无边界 shared；
5. 正常领域模块依赖稳定合同不构成职责错位。

## 第二十九阶段剩余工作

- 无剩余第二十九阶段分支，进入第三十阶段。
