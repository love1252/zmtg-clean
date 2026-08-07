# W1_CUSTOMERS_MESSAGING 逐符号复核与 W1A Customers Core 实现准入

> 日期：2026-08-08
> Base：8a819b6d37cae28e2c05d98a392260944265108c
> 状态：admission_passed

## 结论

```text
w1_static_candidate_count=12
w1_true_db_writer_file_count=7
w1_static_false_positive_file_count=5
w1_customer_core_production_caller_count=0
w1a_exact_allowlist_file_count=6
```

W1 粗粒度候选已按真实 Drizzle / sql-tag mutation 重新核验；UI 文案、普通 update/delete 方法名和纯 Domain 文本不再作为 Writer。

首个原子子切片冻结为：

`W1A_CUSTOMERS_CORE`

W1A 只处理 Customers Core 的 create/update business fact Writer、tenantId + institutionId attribution 和 legacy customer Writer blockade。WeCom/reach-out/Care/Provisioning 均不混入本 slice。

## Exact implementation allowlist

见：`docs/operations/base02-w1-customers-core-implementation-exact-allowlist-20260808.csv`

任何实现证明需要列表外文件、Schema 或 Migration，必须停止并重新准入。

## 测试硬门

- create 同时持有 tenantId + institutionId；
- update 同时限制 tenant + institution + customer identity；
- cross-institution update fail-closed；
- missing institution fail-closed；
- client institution 不可直接成为权威 attribution；
- no default/first institution fallback；
- legacy customer 并行 Writer 必须关闭；
- customers Route 继续 capability-off；
- Care / Messaging Writer 不受影响。

## 当前授权

```text
w1a_runtime_implementation_authorized=false
runtime_change=false
database_connection=false
ddl=false
dml=false
migration=false
reader_release=false
capability_release=false
```
