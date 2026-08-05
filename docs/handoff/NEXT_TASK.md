# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 客户对象事实 Reader 核心实施
```

## 当前基线

- semantic owner：`src/modules/customers`；
- customer dynamic Route：3；
- production Object Fact Reader Adapter：0；
- Institution Runtime `objectFactReader: null`：true；
- implementation allowlist：7；
- Schema／Migration／Route wiring：0；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 权威输入

1. `docs/decisions/base02-b4-customer-object-fact-reader-design-20260805.md`
2. `docs/operations/base02-b4-customer-object-fact-reader-source-evidence-20260805.csv`
3. `docs/operations/base02-b4-customer-object-fact-reader-contract-matrix-20260805.csv`
4. `docs/operations/base02-b4-customer-object-fact-reader-implementation-allowlist-20260805.csv`
5. `docs/operations/base02-b4-customer-object-fact-reader-independent-review-20260805.md`

## 持续禁止

- 不修改任何 Route；
- 不开放业务 Capability；
- 不修改 Schema、Migration、journal、snapshot 或 Seed；
- 不新建第二数据库客户端；
- 不连接数据库，不执行 DDL、DML 或 Migration；
- 不处理其他对象类型；
- 不启动 BASE-B5～B6。
