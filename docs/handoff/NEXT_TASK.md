# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 跨 tenant transfer orchestration 4-file 最小实现授权与执行
```

## 已完成

- relation-orphan Option 1 ADR 已收口；
- transfer implementation admission 已通过；
- exact source/test allowlist 已冻结为 4 文件；
- minimal foundation 不需要 Schema/Migration/AQ008/既有 Writer/Port/composition-root 修改。

## 冻结 allowlist

```text
src/modules/access-control/application/cross-tenant-transfer-service.ts
src/modules/access-control/server/cross-tenant-transfer-transaction.ts
src/modules/access-control/tests/CrossTenantTransferService.test.ts
src/modules/access-control/tests/CrossTenantTransferTransaction.test.ts
```

## 下一任务进入条件

必须取得明确“实际代码实现”授权。

授权后仍只允许修改上述 4 个文件；若实现证明需要第 5 个文件，必须立即停止并重新准入。

## 当前仍禁止

- 数据库连接；
- DDL/DML/Migration/Seed/FK VALIDATE；
- Membership/Binding 实际数据库写入；
- historical orphan remediation；
- composition root/API/runner 接线；
- Reader/Capability release；
- 生产变更；
- 把 BASE-B5/BASE-02 写成完成。
