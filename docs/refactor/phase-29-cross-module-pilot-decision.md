# 第二十九阶段跨模块唯一试点决策

- 日期：2026-07-27
- 启动基线：`e324b0cc691f24ed417913b716af602c716190d6`
- 决策：`no_safe_candidate`
- 决策原因：`no_eligible_candidate`
- 唯一试点：`none`
- 本任务源码修改：0

## 证据修正规则

- 依赖边去重键：`source_path + target_path + specifier`；

- 每条边按 `source_path + target_path + specifier` 唯一去重；
- 多个扫描器命中同一 import 时只合并 detection kinds，不重复计数；
- `__src_app__`、`__src_server__` 等伪模块所有者只用于记录入向／出向，不参与模块循环和候选判断；
- 循环使用真实模块图的强连通分量判断；
- 候选机器清单：`docs/refactor/phase-29-cross-module-pilot-candidates.csv`。

## 候选规则

候选必须同时满足：单向依赖、无反向边、生产边 1～5、来源文件不超过 6、无运行时和保护模块、存在代表性测试，并且不是正常的领域模块到稳定合同模块依赖。

## 候选逐项结论

- `auth -> institution-contracts`：eligible=no；生产边=1；反向边=0；运行时边=1；原因=`runtime_boundary_involved|protected_module_involved`
- `auth -> security`：eligible=no；生产边=3；反向边=3；运行时边=3；原因=`reverse_dependency_present|runtime_boundary_involved|protected_module_involved`
- `customer-center -> institution-contracts`：eligible=no；生产边=3；反向边=0；运行时边=0；原因=`normal_domain_to_stable_contract_dependency`
- `institution-conversations -> institution-contracts`：eligible=no；生产边=1；反向边=0；运行时边=0；原因=`normal_domain_to_stable_contract_dependency`
- `security -> auth`：eligible=no；生产边=3；反向边=3；运行时边=3；原因=`reverse_dependency_present|runtime_boundary_involved|protected_module_involved`
- `security -> institution-contracts`：eligible=no；生产边=2；反向边=0；运行时边=2；原因=`runtime_boundary_involved|protected_module_involved`
- `workspace -> knowledge-base`：eligible=no；生产边=1；反向边=0；运行时边=1；原因=`runtime_boundary_involved`

## 无安全候选

去重并排除伪模块循环后，仍没有形成一个满足全部低风险条件且唯一优于其他候选的模块对。因此不强行创建 facade、adapter、入口文件或全局 shared。
