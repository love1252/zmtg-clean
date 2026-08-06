# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 客户随访时间线 Route Object Guard 最小接线
```

## 当前基线

- shared Object Route Guard：已实施并通过独立审查；
- customer complete timeline wiring：已完成；
- customer followup overview wiring：已完成；
- current customer Section/Object wiring：2／2；
- followup timeline current wiring：0／0；
- implementation allowlist：2；
- business followup timeline read：继续关闭；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 权威输入

1. `docs/decisions/base02-b4-customer-followup-timeline-object-guard-admission-20260806.md`
2. `docs/operations/base02-b4-customer-followup-timeline-object-guard-baseline-20260806.csv`
3. `docs/operations/base02-b4-customer-followup-timeline-object-guard-allowlist-20260806.csv`
4. `docs/operations/base02-b4-customer-followup-timeline-object-guard-admission-independent-review-20260806.md`

## 执行目标

严格按 2 文件 allowlist：

1. 接线客户随访时间线 Route；
2. 更新客户随访时间线 Route 测试。

## 冻结边界

- 复用现有 `withInstitutionObjectRouteGuardV1`；
- sectionId=`customers`；
- objectType=`customer`；
- action=`read`；
- objectId=`context.params.customerId`；
- 所有 Guard 失败统一 no-store 403；
- 授权通过后仍调用原 no-store 503 Handler。

## 禁止范围

- 不修改共享 Guard、Reader、Runtime 或 Security 核心；
- 不开放随访时间线真实业务读取；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5～B6。
