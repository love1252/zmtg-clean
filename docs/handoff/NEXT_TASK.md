# 智美天工唯一下一任务

## 当前交接状态

BASE-B2 Binding transition evidence Expand DDL 已完成实施、唯一受控执行、恢复核验和独立审查：

- repository／environment journal：`45／45`；
- latest：`0044_base02_binding_transition_expand`；
- Catalog：`all_exact`；
- transition evidence rows：`0`；
- guarded command／automatic retry／second invocation：`1／0／0`；
- business DML／sequence advance：`0／0`；
- 执行前后恢复点和隔离恢复：通过；
- active Execution Lease：`0`；
- `0044` 已消费且不得改写或重跑。

## 唯一下一任务

```text
BASE-B2 Binding Runtime Writer／same-transaction transition evidence 前置预检
```

## 任务目标

只读审计并冻结 Access Control Owner 下 Binding 生命周期写入的实施边界：

1. create／rebind／revoke／expire command 与状态机；
2. Binding current、Membership current 和 transition evidence 的同事务顺序；
3. command replay、Binding version CAS、Membership revision 与 Scope revision 观察值；
4. external transaction／UoW 接口与 rollback 语义；
5. legacy Writer、direct Drizzle／raw SQL 写入面；
6. 合成测试、事务测试、并发测试和失败矩阵；
7. 精确文件 allowlist、回退点和后续实施准入。

## 本轮禁止

- 不修改 Schema／Migration／journal／snapshot；
- 不连接数据库、不运行 Migration；
- 不写入真实业务数据；
- 不执行 legacy calibration；
- 不处理 historical orphan；
- 不执行 Scope FK `VALIDATE`；
- 不启动 BASE-B3～B6；
- 不提前放行项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

## 当前门禁

```text
binding_runtime_writer_preflight_started=false
binding_runtime_writer_started=false
eligible_for_binding_runtime_writer_implementation=false
base_b2_complete=false
eligible_for_base_b3=false
```
