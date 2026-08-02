# 智美天工唯一下一任务

## 当前交接状态

BASE-B2 Binding transition evidence 的 accepted 决策、Schema／Migration 前置预检与独立审查已进入 `main`：

- PR #917：Head `97c02f1250f5f5fbff468b17953074db5b67eb4c`，Merge Commit `77a626ed182230f91b6d27daeaa4b0f297b377d9`，Run `30750704426` 成功；
- 独立审查 PR #918：Head `749bb269393c50bc9638ab7f76f97b04df2a610b`，Merge Commit `32b08e5e7bca4331c421ac5a637a846a884e2bf1`，Run `30751540734` 成功；
- `binding_transition_evidence_preflight_review=passed`；
- `binding_physical_model_decision_required=false`；
- Schema、Migration、journal、snapshot、Runtime 和数据库修改均为 `0`。

## 唯一下一任务

```text
BASE-B2 Binding transition evidence Expand DDL Schema／Migration 实施
```

当前状态：尚未启动；按现有 ULTRA 用户授权，可在本 handoff 合并后继续。

## 启动硬门

1. 最新 `main／origin/main`、工作树、Required Check 与受保护分支无漂移；
2. journal、SQL 集合与目标环境 latest 一致，snapshot 保持既有状态；
3. Binding current、Membership current、Scope FK、orphan 计数及并发状态重新只读冻结；
4. 实时分配唯一 Migration 编号与 Migration Lease；
5. 建立执行前恢复点并完成隔离恢复验证；
6. 目标精确为固定 localhost-only `local_acceptance`；
7. 精确四文件 allowlist 获得动态确认。

## 候选四文件

1. `drizzle/<实时编号>_base02_binding_transition_expand.sql`
2. `drizzle/meta/_journal.json`
3. `src/server/db/schema.ts`
4. `src/server/db/tests/Schema.test.ts`

## 实施边界

只允许建立：

- `auth_account_institution_binding_transitions`；
- accepted transition enum 与列 Shape；
- Binding `UNIQUE (tenant_id,id)`；
- 原／replacement Binding FK；
- command／version 唯一性、CHECK、索引；
- evidence append-only trigger；
- Binding current identity／tuple／assignment provenance 不可变；
- Binding current DELETE／TRUNCATE 拒绝。

Expand 不得夹带 legacy calibration、Runtime Writer、historical orphan 修复、FK `VALIDATE`、BASE-B3 或业务 Reader。

## 持续阻断

- BASE-B2 尚未完成；
- BASE-B3～B6 未启动；
- historical orphan 保持原值；
- A2-P2 Scope FK 继续 `NOT VALID`；
- 项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader继续阻断。
