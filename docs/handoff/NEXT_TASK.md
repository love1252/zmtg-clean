# 智美天工唯一下一任务

## 唯一下一任务

```text
W1B Customer Channel / WeCom Mapping Writer symbol audit + exact implementation allowlist admission
```

## 已完成

- BASE-02 complete=true；
- Business Writer Admission passed；
- W1 symbol audit passed；
- W1A Customers Core admission passed；
- W1A exact 6-file Runtime implementation merged；
- W1A Independent Review passed；
- W1A Customers Core complete=true；
- Customers canonical application service/repository 已建立；
- tenantId + institutionId attribution 已强制；
- cross-institution mutation fail-closed；
- legacy customer parallel Writer 已关闭。

## W1B 范围

W1B 只处理：

```text
Customer Channel
+
WeCom Customer Mapping
```

首要现有真实 Writer 候选：

```text
src/modules/institution/server/wecom-customer-mapping-repository.ts
```

下一任务必须先完成：

1. 逐符号重新核验 WeCom mapping 的真实 insert/update；
2. 枚举实际 production callers / services / routes；
3. 确认 Customers/Messaging canonical Owner；
4. 冻结 tenantId + institutionId attribution contract；
5. 区分 current canonical candidate 与 legacy/bypass；
6. 冻结 exact implementation file allowlist；
7. 冻结 targeted / negative tests；
8. 得到明确 Runtime implementation 授权后才能改代码。

## 明确不属于 W1B

以下留给 W1C，不得混入：

```text
trusted-reachout-safety-repository.ts
wecom-customer-broadcast-task-outcome-repository.ts
wecom-real-send-proof-repository.ts
```

W1C = Trusted Reach-out / Broadcast / Real-send evidence。

## 当前仍禁止

- W1B Runtime 未授权；
- 不连接数据库；
- 不执行 DDL/DML/Migration/Seed/FK VALIDATE；
- 不修改 Schema；
- Customers Route/Reader/Capability 不开放；
- 不扩展 Care/Audit；
- 不执行 W1C Runtime；
- 不做生产变更。
