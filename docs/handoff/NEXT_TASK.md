# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 全量入口 Guard／绕过闭环终检复算
```

## 当前基线

- shared Object Route Guard：已实施并通过独立审查；
- customer complete timeline wiring：已完成；
- customer followup overview wiring：已完成；
- customer followup timeline wiring：已完成；
- current customer Section/Object wiring：3／3；
- remaining unwired customer Routes：0；
- 三条 Handler 继续保持 capability-disabled；
- business customer read：继续关闭；
- BASE-B4：未完成，等待全量入口终检复算；
- BASE-B5：未启动。

## 任务目标

1. 基于最新 main 重新枚举全部机构入口；
2. 复算 formal guarded、capability-off、dynamic object 与 lifecycle 分类；
3. 复核 Membership／Binding Owner、Writer／Deleter 与运维入口；
4. 复核三条客户动态 Route 的 Section／Object Guard 接线；
5. 判定 BASE-B4 是否具备 completion candidate；
6. 只做静态终检复算，不开放 Reader 或业务 Capability。

## 禁止范围

- 不修改生产 Route、Guard、Reader、Runtime 或 Security 核心；
- 不开放客户、知识库或其他业务真实读取；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5～B6。
