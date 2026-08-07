# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 跨 tenant relation-orphan 终态处置分支与成功标准 ADR 决策
```

## 已完成

- XT01–XT04：accepted；
- XT05–XT07：accepted for preplanning；
- XT08：accepted；
- XT09：`blocked_invariant_conflict`；
- XT10：`blocked_by_xt09`；
- cross-tenant transfer orchestration 方向已冻结，但 implementation/execution 未授权。

## 当前冲突

未来访问迁移方向：

```text
target Membership create + target Binding create
+
source Membership revoke + source Binding revoke
```

现有 accepted Binding 规则同时要求：

- revoked Binding 永久保留；
- tenant／institution identity tuple 不可原地改写；
- BASE-B2 不提供 DELETE。

而 B5 deterministic rebind 当前成功标准要求：

```text
active_orphan=1->0
relation_orphan=1->0
```

在不创建伪 Scope、不修改旧 tuple、不 delete/archive old Binding 的情况下，只能得到：

```text
active_orphan=0
relation_orphan=1
```

## 下一任务必须明确选择

1. 保持 M09-A immutable/no-delete，并通过独立 ADR 修改 BASE-B5 relation-orphan 成功定义；
2. 重新开启 archive/delete old Binding 的治理路径；
3. 重开 Binding identity/tuple immutability；
4. 或继续保持 BASE-B5 blocked。

## 当前禁止

- 不创建或修改 Membership；
- 不创建、更新、撤销、删除或重绑 Binding；
- 不创建 source fake Scope；
- 不执行 DDL、DML、Migration、Seed 或 FK VALIDATE；
- 不实现 cross-tenant transfer orchestration；
- 不修改 same-tenant rebind 语义；
- 不开放 Reader 或业务 Capability；
- 不把 BASE-B5 或 BASE-02 写成已完成。
