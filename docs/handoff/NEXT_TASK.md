# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 只读动态对象正式入口 Object Guard 精确预检
```

## 当前基线

- routes：81；
- formal guarded Routes：15；
- governance required：66；
- readonly dynamic object first slice：9；
- production change：0；
- business Reader／Capability：继续关闭；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 权威输入

1. `docs/decisions/base02-b4-high-risk-entry-governance-decision-pack-20260805.md`
2. `docs/operations/base02-b4-high-risk-entry-governance-matrix-20260805.csv`
3. `docs/operations/base02-b4-high-risk-entry-governance-execution-order-20260805.csv`
4. `docs/operations/base02-b4-readonly-dynamic-object-preflight-slice-20260805.csv`
5. `docs/operations/base02-b4-high-risk-entry-governance-independent-review-20260805.md`

## 任务目标

1. 精确复核只读动态对象入口；
2. 冻结每个入口的 Section、对象参数与对象事实来源；
3. 冻结 Scope + Section + Object Guard 链；
4. 冻结直接／传递兼容性测试；
5. 保持现有状态码、payload 与 no-store；
6. 输出下一窄实施 allowlist；
7. 本任务不修改生产代码。

## 禁止范围

- 不处理 mutation／mixed、external touch、direct DB 或 legacy 实施；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不处理 historical orphan，不验证 Scope FK；
- 不启动 BASE-B5～B6、业务 Writer、Audit／模板或 MIG-01B／C。
