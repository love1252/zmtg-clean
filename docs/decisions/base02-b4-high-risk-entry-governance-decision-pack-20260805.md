# BASE-B4 剩余高风险正式入口治理决策包

## 1. 决策结论

```text
base02_b4_high_risk_entry_governance_decision=approved
route_count=81
formal_guarded_route_count=15
governance_required_count=66
readonly_dynamic_object_count=9
production_change=false
database_connection=false
migration_execution=false
dml_execution=false
base_b4_complete=false
base_b5_started=false
next_task=BASE-B4 只读动态对象正式入口 Object Guard 精确预检
```

## 2. 总体原则

1. 现有 15 个共享 Scope + Section Guard 入口保持不变；
2. 剩余 66 个入口不得批量套用同一个 broad Section Guard；
3. write／mixed 入口必须使用 Route 特定 Action／Object 与 mutation-security；
4. dynamic object GET 入口先进入 Scope + Section + Object Guard 精确预检；
5. legacy／compatibility 入口先证明退役或 canonical delegation；
6. demo／fixture 不得静默进入 formal runtime；
7. direct DB 与 external touch 入口必须先冻结 Adapter、Preflight 与 Safety Switch；
8. 本任务只作治理决策，不修改生产代码。

## 3. 风险族分布

- `demo_fixture`：1
- `external_touch`：1
- `legacy_or_compatibility`：3
- `mutation_or_mixed`：52
- `readonly_dynamic_object`：9

## 4. 第一治理切片

下一步只进入只读动态对象入口 Object Guard 精确预检，共 `9` 个：

1. `src/app/api/institution/followup-paths/enrollments/[enrollmentId]/route.ts` → Section `care`
2. `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts` → Section `care`
3. `src/app/api/institution/customers/[customerId]/followup-overview/route.ts` → Section `customers`
4. `src/app/api/institution/customers/[customerId]/followup-timeline/route.ts` → Section `customers`
5. `src/app/api/institution/customers/[customerId]/timeline/route.ts` → Section `customers`
6. `src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/route.ts` → Section `knowledge`
7. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route.ts` → Section `knowledge`
8. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route.ts` → Section `knowledge`
9. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/route.ts` → Section `knowledge`

该切片只冻结：

- Section 归属；
- 对象参数；
- Scope + Section + Object Guard 链；
- 直接与传递兼容性测试；
- 原状态码、payload 与 no-store 保持要求。

不在本决策任务中修改生产 Route。

## 5. 权威证据

1. `docs/operations/base02-b4-remaining-formal-entry-inventory-20260805.csv`
2. `docs/operations/base02-b4-completion-audit-gap-list-20260805.csv`
3. `docs/operations/base02-b4-high-risk-entry-governance-matrix-20260805.csv`
4. `docs/operations/base02-b4-high-risk-entry-governance-execution-order-20260805.csv`
5. `docs/operations/base02-b4-readonly-dynamic-object-preflight-slice-20260805.csv`

## 6. 边界

- production change：0；
- database／migration／DML：0；
- business Reader／Capability：继续关闭；
- BASE-B4：未完成；
- BASE-B5：未启动。
