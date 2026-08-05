# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 客户对象事实 Reader 前置设计与准入
```

## 当前基线

- 只读动态对象 Route：9；
- Object Port 可直接表达：4；
- customer Route：3；
- 当前 implementation allowlist：0；
- production Object Fact Reader Adapter：0；
- Institution Runtime `objectFactReader: null`：true；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 任务目标

1. 冻结 `customer` 对象事实的唯一业务 Owner；
2. 冻结低敏 current fact、revision、status、observedAt 与拒绝语义；
3. 冻结 Reader Port Adapter 与 Runtime 注入边界；
4. 冻结 freshness、跨 scope 拒绝、异常 fail-closed 和测试；
5. 输出实施 allowlist；
6. 本任务只设计与准入，不修改生产代码。

## 禁止范围

- 不实施 Object Fact Reader，不修改 Runtime；
- 不接线动态 Route；
- 不处理其他对象类型；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放业务 Capability，不启动 BASE-B5～B6。
