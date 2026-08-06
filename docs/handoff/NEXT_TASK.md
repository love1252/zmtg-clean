# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 客户随访概览 Route Object Guard 接线前置准入
```

## 当前基线

- shared Object Route Guard：已实施；
- customer complete timeline Section/Object wiring：true／true；
- current customer Section/Object wiring：1／1；
- remaining unwired customer Routes：2；
- capability-disabled handlers：3；
- business Timeline read：继续关闭；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 任务目标

1. 复核客户随访概览 Route 与测试基线；
2. 复核共享 Object Route Guard 独立审查结果；
3. 冻结客户随访概览的 2 文件最小 allowlist；
4. 冻结 customers／customer／read 常量；
5. 冻结原 503 capability-disabled Handler 保留；
6. 本任务只做准入，不修改生产 Route。

## 禁止范围

- 不接线客户随访概览或客户随访时间线 Route；
- 不修改共享 Guard、Reader、Runtime 或 Security 核心；
- 不开放随访概览业务读取；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5～B6。
