# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 客户完整时间线 Route Object Guard 最小接线
```

## 当前基线

- customer Object Fact Reader：已实施；
- production Object Fact Reader Adapter：1；
- customer dynamic Route：3；
- current customer Section/Object wiring：0／0；
- first slice：客户完整时间线；
- implementation allowlist：4；
- business Capability：继续关闭；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 权威输入

1. `docs/decisions/base02-b4-customer-route-object-guard-preflight-20260806.md`
2. `docs/operations/base02-b4-customer-route-object-guard-preflight-matrix-20260806.csv`
3. `docs/operations/base02-b4-customer-route-object-guard-http-mapping-20260806.csv`
4. `docs/operations/base02-b4-customer-route-object-guard-first-slice-allowlist-20260806.csv`
5. `docs/operations/base02-b4-customer-route-object-guard-preflight-independent-review-20260806.md`

## 执行目标

严格按 4 文件 allowlist：

1. 在共享 Guard 中新增 Section + Dynamic Object wrapper；
2. 完成共享 Guard 两个 fresh Authorization 的顺序测试；
3. 仅接线客户完整时间线 Route；
4. 更新客户完整时间线 Route 测试。

## 冻结边界

- sectionId=`customers`；
- objectType=`customer`；
- action=`read`；
- Section 与 Object 各使用 fresh Authorization；
- Context 只在 Section allow 后读取；
- Guard 阶段不读取 Request；
- 所有 Guard 失败统一 no-store 403；
- 允许后仍保留原 capability-disabled 503 Handler。

## 禁止范围

- 不接线随访概览或随访时间线 Route；
- 不开放 Timeline 业务读取；
- 不修改 Reader、Runtime、Security 核心或 Action Policy；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5～B6。
