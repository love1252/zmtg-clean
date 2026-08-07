# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-02 business Writer W1_CUSTOMERS_MESSAGING first vertical slice implementation exact allowlist freeze / authorization decision
```

## 已完成

- BASE-02 complete=true；
- Business Writer Admission passed；
- Independent Review passed；
- static Writer inventory complete；
- mutation candidate files=75；
- business Writer surface=27；
- bypass review surface=3；
- vertical slice matrix frozen；
- current mutation candidate surface exact paths frozen；
- attribution contract frozen：institution-scoped fact 必须 `tenantId + institutionId`；
- old Writer / bypass terminal policy：delegate 或 fail-closed。

## 下一任务边界

下一任务只针对 `W1_CUSTOMERS_MESSAGING`：

1. 逐符号确认静态候选是否真实写业务事实；
2. 剔除 UI 文案、普通方法名、非 SQL 文本等静态误报；
3. 确认 Customers / Messaging canonical Owner；
4. 区分 canonical Writer 与 old/bypass Writer；
5. 冻结 implementation exact file allowlist；
6. 冻结 targeted / negative tests；
7. 如需要 Schema/Migration/范围外第 N 个文件，立即停止并重新准入；
8. 取得明确代码实现授权后才能修改 Runtime。

## 当前仍禁止

- 未授权不得修改 Runtime Writer；
- 不连接数据库；
- 不执行 DDL/DML/Migration/Seed/FK VALIDATE；
- Reader/Capability 不开放；
- physical FK ADR 不与 Writer slice 混做；
- 不做生产变更。
