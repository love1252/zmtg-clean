# 智美天工唯一下一任务

## 唯一下一任务

```text
W1A Customers Core exact allowlist Runtime implementation explicit authorization
```

## 已完成

- BASE-02 complete=true；
- Business Writer Admission passed；
- W1 symbol audit passed；
- W1A Customers Core exact allowlist frozen；
- customers Route capability-off=true；
- Schema/Migration expansion required=false。

## Runtime implementation 只能修改

`docs/operations/base02-w1-customers-core-implementation-exact-allowlist-20260808.csv`

中的 exact files。

目标：建立 Customers canonical application service/repository，强制 tenantId + institutionId attribution，关闭 legacy customer 并行 Writer，并保持 Reader/Capability 关闭。

## 当前未授权

```text
w1a_runtime_implementation_authorized=false
database_connection=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
reader_release=false
capability_release=false
production_change=false
```
