# BASE-B5 historical orphan 权威处置分支决策前置规划

> 日期：`2026-08-06`
>
> 前置状态：`BASE-B4 complete`
>
> 本文只冻结决策输入、分支和停止条件，不选择分支、不连接数据库、不授权 DML。

## 结论

```text
base02_b5_historical_orphan_decision_preplanning=ready
base_b4_complete=true
base_b5_started=false
historical_orphan_remediation_authorized=false
accepted_evidence_active_historical_orphan_count=1
accepted_evidence_scope_relation_orphan_count=1
live_readonly_reprobe_required=true
external_authority_required=true
revoke_only_satisfies_b5_success=false
deterministic_rebind_requires_exact_scope_authority=true
tenancy_provisioning_must_be_separate=true
controlled_delete_requires_retention_authority=true
keep_blocked_is_default=true
database_connection=false
dml_execution=false
fk_validation_authorized=false
reader_release=false
next_task=BASE-B5 historical orphan 权威处置分支决策与证据准入
```

## 决策前必须提供的权威输入

1. 仓库外权威业务依据，证明该 Binding 应撤销、重绑、删除或等待独立 Provisioning；
2. 若选择重绑，必须精确证明目标 tenant／institution Scope，不能以“当前只有一个 Scope”推断；
3. 若真实机构 Scope 尚不存在，必须退出 BASE-B5，另立 Tenancy Provisioning 任务；
4. 若选择删除或归档，必须有记录无效依据和数据保留政策；
5. 固定 localhost-only 目标、恢复点、无并发 Writer、精确定位和低敏输出规则；
6. 现场只读复核 active historical orphan 与全部 Scope relation orphan；
7. 明确 `expected=1`、`affected=1`、`conflict=0`、`unexpected=0`；
8. 事务、停止、结果不确定、forward-fix 和独立审查规则。

## 分支说明

分支矩阵见：

`docs/operations/base02-b5-historical-orphan-decision-branch-matrix-20260806.csv`

默认分支始终是保持阻断。任何证据不足、候选不唯一、计数漂移、并发 Writer、
结果不确定或需要自动重试的情况，均不得选择执行分支。

## 禁止范围

- 不在本文中选择处置分支；
- 不读取或公开原始双键、PII、连接参数或凭证；
- 不连接数据库；
- 不执行 UPDATE、DELETE、INSERT、Migration、Seed 或 FK VALIDATE；
- 不从 Binding 反向创建 Scope；
- 不放行 Reader 或业务 Capability；
- 不把 BASE-B4 complete 写成 BASE-02 complete。

## 唯一下一任务

`BASE-B5 historical orphan 权威处置分支决策与证据准入`
