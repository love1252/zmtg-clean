# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 Owner 外 Membership／Binding Writer／Deleter 关闭前置预检
```

## 判定来源

```text
decision_reason=owner_outside_direct_writer
formal_route_guarded_count=14
route_review_candidate_count=56
capability_off_unwired_count=52
owner_outside_direct_writer_count=1
lifecycle_unresolved_count=4
base_b4_completion_candidate=false
```

## 优先候选

1. `scripts/verify/architecture-quality.test.mjs`

完整清单见：

- `docs/operations/base02-b4-full-entry-guard-inventory-20260805.csv`
- `docs/operations/base02-b4-lifecycle-bypass-inventory-20260805.csv`
- `docs/operations/base02-b4-full-entry-bypass-closure-preflight-20260805.md`
- `docs/operations/base02-b4-full-entry-bypass-closure-independent-review-20260805.md`

## 固定边界

- BASE-B4 当前仍未完成；
- BASE-B5 未启动；
- 业务 Reader 与新 Capability 继续关闭；
- historical orphan 不处理；
- Scope FK 不验证；
- 下一切片必须从最新 main 再冻结精确文件 allowlist；
- 不得把静态候选自动改写为生产缺陷或直接批量修改。

## 禁止范围

- 不连接数据库；
- 不执行 DDL、DML、Migration 或 Seed；
- 不修改 Schema、journal 或 snapshot；
- 不启动 BASE-B5～B6、业务 Writer、Audit／模板或 MIG-01B／C；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability。
