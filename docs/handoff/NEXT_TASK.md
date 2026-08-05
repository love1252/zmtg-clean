# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 客户只读动态对象 Route Object Guard 接线前置预检
```

## 当前基线

- customer Object Fact Reader：已实施；
- Security Application façade：已实施；
- architecture exception：0；
- production Object Fact Reader Adapter：1；
- Institution Runtime reader：已懒注入；
- customer dynamic Route：3；
- customer Route wiring：0；
- business Capability：继续关闭；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 任务目标

1. 复核 3 条 customerId GET Route 的 Handler 和现有状态码；
2. 冻结 Section、objectType=customer、action=read；
3. 冻结 Scope + Section + Object 授权顺序；
4. 冻结 Guard 拒绝结果的 HTTP 映射；
5. 冻结 no-store、payload 与兼容性测试；
6. 输出首个窄实施 allowlist；
7. 本任务只预检，不修改生产 Route。

## 禁止范围

- 不实施 Route 接线；
- 不修改 Reader 核心、Security 核心或 Action Policy；
- 不处理其他对象类型；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放 mutation 或外部触达；
- 不启动 BASE-B5～B6。
