# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-02 post-closure business Writer dual-write / old Writer blockade admission
```

## 已完成

```text
BASE-B1 complete
BASE-B2 complete
BASE-B3 complete
BASE-B4 complete
BASE-B5 complete
BASE-B6 completion audit passed
BASE-02 complete
```

当前授权完整性终态：

```text
active authorization orphan = 0
active Scope relation orphan = 0
retained revoked historical relation orphan = 1 expected
```

## BASE-02 完成不代表什么

仍未放行：

- business Reader；
- business Capability；
- 全业务 Writer；
- Audit attribution / templates；
- MIG-01B；
- MIG-01C；
- physical FK VALIDATE；
- production release。

## 下一阶段目标

按照既有顺序进入：

```text
全部业务 Writer 双写
+
旧 Writer / bypass 封堵
```

下一任务先做 admission，不直接批量修改代码。

必须：

1. 重新枚举机构端各业务事实 Writer；
2. 按 Customers / Care / Knowledge / Conversations / Analytics / Institution System 等 Owner 分类；
3. 冻结 `tenantId + institutionId` attribution 写入契约；
4. 识别旧 Writer、直写 Repository、Seed/fixture/import/maintenance 绕过；
5. 按垂直切片给出 exact allowlist；
6. 不把 Access Control Binding lifecycle Writer 与业务 Writer 混为一类；
7. Reader/Capability 继续关闭。

## Physical FK 独立边界

B6 已完成 terminal strategy preplanning，但尚未决策。

候选：

```text
PFK-1 active-only constraint trigger
PFK-2 derived active relation projection + standard FK
PFK-3 current/history physical split
PFK-0 keep NOT VALID (temporary only)
```

physical FK terminal ADR 是 MIG-01C 前置，不与 business Writer admission 混做。

## 当前禁止

- 未经新授权不得批量修改业务 Writer；
- 不执行数据库连接、DDL、DML、Migration、Seed；
- 不执行 FK VALIDATE；
- 不删除/归档/改写 historical Binding；
- 不开放 Reader/Capability；
- 不做生产变更。
